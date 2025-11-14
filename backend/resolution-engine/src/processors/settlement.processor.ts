mport { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ResolutionService } from '../services/resolution.service';

@Processor('settlement-processing')
export class SettlementProcessor {
  private readonly logger = new Logger(SettlementProcessor.name);

  constructor(private resolutionService: ResolutionService) {}

  @Process('settle-event')
  async handleSettlement(job: Job<{ eventId: string }>) {
    this.logger.log(`Processing settlement for event: ${job.data.eventId}`);

    try {
      await this.resolutionService.settleEvent(job.data.eventId);
      this.logger.log(`Event settled: ${job.data.eventId}`);
    } catch (error) {
      this.logger.error(
        `Settlement failed for ${job.data.eventId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('batch-settlement')
  async handleBatchSettlement(job: Job<{ eventIds: string[] }>) {
    this.logger.log(`Processing batch settlement for ${job.data.eventIds.length} events`);

    const results = await Promise.allSettled(
      job.data.eventIds.map((eventId) =>
        this.resolutionService.settleEvent(eventId),
      ),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(`Batch settlement complete: ${successful} successful, ${failed} failed`);
  }
}