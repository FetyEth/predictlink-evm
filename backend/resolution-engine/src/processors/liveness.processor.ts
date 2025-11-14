import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ResolutionService } from '../services/resolution.service';

@Processor('liveness-monitoring')
export class LivenessProcessor {
  private readonly logger = new Logger(LivenessProcessor.name);

  constructor(private resolutionService: ResolutionService) {}

  @Process('check-liveness')
  async handleLivenessCheck(job: Job<{ proposalId: string }>) {
    this.logger.log(`Checking liveness for proposal: ${job.data.proposalId}`);

    try {
      await this.resolutionService.finalizeProposal(job.data.proposalId);
      this.logger.log(`Proposal finalized: ${job.data.proposalId}`);
    } catch (error) {
      this.logger.error(
        `Liveness check failed for ${job.data.proposalId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

