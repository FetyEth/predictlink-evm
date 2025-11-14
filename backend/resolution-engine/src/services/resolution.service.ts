import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { StateMachineService } from './state-machine.service';
import { BlockchainService } from './blockchain.service';
import { CacheService } from './cache.service';

enum ResolutionState {
  CREATED = 'created',
  DETECTING = 'detecting',
  EVIDENCE_GATHERING = 'evidence_gathering',
  PROPOSING = 'proposing',
  LIVENESS = 'liveness',
  MONITORING = 'monitoring',
  DISPUTED = 'disputed',
  ARBITRATION = 'arbitration',
  RESOLVED = 'resolved',
  SETTLED = 'settled',
}

interface ResolutionContext {
  eventId: string;
  proposalId?: string;
  currentState: ResolutionState;
  metadata: Record<string, any>;
  timestamp: number;
}

@Injectable()
export class ResolutionService {
  private readonly logger = new Logger(ResolutionService.name);

  constructor(
    @InjectQueue('liveness-monitoring')
    private livenessQueue: Queue,
    @InjectQueue('settlement-processing')
    private settlementQueue: Queue,
    private httpService: HttpService,
    private configService: ConfigService,
    private stateMachine: StateMachineService,
    private blockchainService: BlockchainService,
    private cacheService: CacheService,
  ) {}

  async processEvent(eventId: string): Promise<ResolutionContext> {
    try {
      this.logger.log(`Processing event resolution: ${eventId}`);

      const event = await this.fetchEventData(eventId);
      
      const context: ResolutionContext = {
        eventId,
        currentState: event.status,
        metadata: event.metadata || {},
        timestamp: Date.now(),
      };

      await this.stateMachine.transition(context, event.status);

      return context;
    } catch (error) {
      this.logger.error(`Failed to process event ${eventId}: ${error.message}`);
      throw error;
    }
  }

  async initiateProposal(eventId: string, proposalData: any): Promise<string> {
    try {
      this.logger.log(`Initiating proposal for event: ${eventId}`);

      const proposal = await this.submitProposalToChain(eventId, proposalData);

      await this.scheduleLivenessMonitoring(proposal.proposalId, proposal.livenessExpiry);

      await this.updateEventState(eventId, ResolutionState.LIVENESS);

      return proposal.proposalId;
    } catch (error) {
      this.logger.error(`Failed to initiate proposal: ${error.message}`);
      throw error;
    }
  }

  async handleDisputeDetected(proposalId: string, disputeData: any): Promise<void> {
    try {
      this.logger.log(`Handling dispute for proposal: ${proposalId}`);

      const proposal = await this.fetchProposalData(proposalId);

      await this.updateEventState(proposal.eventId, ResolutionState.DISPUTED);

      await this.notifyArbitrators(proposalId, disputeData);

      await this.pauseLivenessMonitoring(proposalId);
    } catch (error) {
      this.logger.error(`Failed to handle dispute: ${error.message}`);
      throw error;
    }
  }

  async finalizeProposal(proposalId: string): Promise<void> {
    try {
      this.logger.log(`Finalizing proposal: ${proposalId}`);

      const proposal = await this.fetchProposalData(proposalId);

      const canFinalize = await this.checkFinalizationConditions(proposal);

      if (!canFinalize) {
        throw new Error('Finalization conditions not met');
      }

      await this.blockchainService.finalizeProposal(proposalId);

      await this.updateEventState(proposal.eventId, ResolutionState.RESOLVED);

      await this.scheduleSettlement(proposal.eventId);
    } catch (error) {
      this.logger.error(`Failed to finalize proposal: ${error.message}`);
      throw error;
    }
  }

  async settleEvent(eventId: string): Promise<void> {
    try {
      this.logger.log(`Settling event: ${eventId}`);

      const event = await this.fetchEventData(eventId);

      if (event.status !== ResolutionState.RESOLVED) {
        throw new Error('Event not in resolved state');
      }

      await this.blockchainService.settleEvent(eventId);

      await this.distributeRewards(eventId);

      await this.updateEventState(eventId, ResolutionState.SETTLED);

      await this.cleanupEventData(eventId);
    } catch (error) {
      this.logger.error(`Failed to settle event: ${error.message}`);
      throw error;
    }
  }

  private async scheduleLivenessMonitoring(
    proposalId: string,
    livenessExpiry: number,
  ): Promise<void> {
    const delay = livenessExpiry - Date.now();

    await this.livenessQueue.add(
      'check-liveness',
      { proposalId },
      {
        delay: Math.max(0, delay),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Scheduled liveness monitoring for proposal: ${proposalId}`);
  }

  private async pauseLivenessMonitoring(proposalId: string): Promise<void> {
    const jobs = await this.livenessQueue.getJobs(['delayed', 'waiting']);
    
    for (const job of jobs) {
      if (job.data.proposalId === proposalId) {
        await job.remove();
      }
    }

    this.logger.log(`Paused liveness monitoring for proposal: ${proposalId}`);
  }

  private async scheduleSettlement(eventId: string): Promise<void> {
    await this.settlementQueue.add(
      'settle-event',
      { eventId },
      {
        delay: 60000,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      },
    );

    this.logger.log(`Scheduled settlement for event: ${eventId}`);
  }

  private async checkFinalizationConditions(proposal: any): Promise<boolean> {
    if (proposal.status !== 'liveness') {
      return false;
    }

    if (Date.now() < proposal.livenessExpiry) {
      return false;
    }

    const disputes = await this.fetchProposalDisputes(proposal.proposalId);
    
    return disputes.length === 0;
  }

  private async distributeRewards(eventId: string): Promise<void> {
    try {
      const rewardServiceUrl = this.configService.get('REWARD_SERVICE_URL');

      await firstValueFrom(
        this.httpService.post(`${rewardServiceUrl}/distribute`, { eventId }),
      );

      this.logger.log(`Rewards distributed for event: ${eventId}`);
    } catch (error) {
      this.logger.error(`Failed to distribute rewards: ${error.message}`);
    }
  }

  private async submitProposalToChain(eventId: string, proposalData: any): Promise<any> {
    return await this.blockchainService.submitProposal(eventId, proposalData);
  }

  private async notifyArbitrators(proposalId: string, disputeData: any): Promise<void> {
    try {
      const notificationServiceUrl = this.configService.get('NOTIFICATION_SERVICE_URL');

      await firstValueFrom(
        this.httpService.post(`${notificationServiceUrl}/notify-arbitrators`, {
          proposalId,
          disputeData,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to notify arbitrators: ${error.message}`);
    }
  }

  private async fetchEventData(eventId: string): Promise<any> {
    const cacheKey = `event:${eventId}`;
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const eventServiceUrl = this.configService.get('EVENT_MANAGER_URL');
    const response = await firstValueFrom(
      this.httpService.get(`${eventServiceUrl}/events/${eventId}`),
    );

    await this.cacheService.set(cacheKey, JSON.stringify(response.data), 300);

    return response.data;
  }

  private async fetchProposalData(proposalId: string): Promise<any> {
    const cacheKey = `proposal:${proposalId}`;
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const proposalServiceUrl = this.configService.get('PROPOSAL_SERVICE_URL');
    const response = await firstValueFrom(
      this.httpService.get(`${proposalServiceUrl}/proposals/${proposalId}`),
    );

    await this.cacheService.set(cacheKey, JSON.stringify(response.data), 300);

    return response.data;
  }

  private async fetchProposalDisputes(proposalId: string): Promise<any[]> {
    const disputeServiceUrl = this.configService.get('DISPUTE_SERVICE_URL');
    const response = await firstValueFrom(
      this.httpService.get(`${disputeServiceUrl}/disputes`, {
        params: { proposalId },
      }),
    );

    return response.data;
  }

  private async updateEventState(eventId: string, state: ResolutionState): Promise<void> {
    const eventServiceUrl = this.configService.get('EVENT_MANAGER_URL');
    
    await firstValueFrom(
      this.httpService.patch(`${eventServiceUrl}/events/${eventId}`, {
        status: state,
        updatedAt: new Date().toISOString(),
      }),
    );

    await this.cacheService.delete(`event:${eventId}`);

    this.logger.log(`Updated event ${eventId} state to: ${state}`);
  }

  private async cleanupEventData(eventId: string): Promise<void> {
    await this.cacheService.delete(`event:${eventId}`);
    
    const proposalIds = await this.cacheService.keys(`proposal:*:${eventId}`);
    for (const key of proposalIds) {
      await this.cacheService.delete(key);
    }

    this.logger.log(`Cleaned up data for event: ${eventId}`);
  }
}