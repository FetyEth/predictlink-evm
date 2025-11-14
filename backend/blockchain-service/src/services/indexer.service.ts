import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { BlockchainService } from './blockchain.service';

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private lastIndexedBlock: number = 0;

  constructor(
    private blockchainService: BlockchainService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async indexNewBlocks() {
    try {
      const provider = this.blockchainService.getProvider();
      const currentBlock = await provider.getBlockNumber();

      if (this.lastIndexedBlock === 0) {
        this.lastIndexedBlock = currentBlock - 100;
      }

      if (currentBlock > this.lastIndexedBlock) {
        await this.processBlocks(this.lastIndexedBlock + 1, currentBlock);
        this.lastIndexedBlock = currentBlock;
      }
    } catch (error) {
      this.logger.error(`Indexing error: ${error.message}`);
    }
  }

  private async processBlocks(fromBlock: number, toBlock: number) {
    this.logger.log(`Indexing blocks ${fromBlock} to ${toBlock}`);

    const oracleRegistry = this.blockchainService.getContract('oracleRegistry');
    if (!oracleRegistry) return;

    const filter = oracleRegistry.filters.EventCreated();
    const events = await oracleRegistry.queryFilter(filter, fromBlock, toBlock);

    for (const event of events) {
      await this.handleEventCreated(event);
    }
  }

  private async handleEventCreated(event: any) {
    try {
      const eventManagerUrl = this.configService.get('EVENT_MANAGER_URL');

      await firstValueFrom(
        this.httpService.post(`${eventManagerUrl}/events/blockchain`, {
          eventId: event.args.eventId,
          description: event.args.description,
          resolutionTime: event.args.resolutionTime,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        }),
      );

      this.logger.log(`Indexed event: ${event.args.eventId}`);
    } catch (error) {
      this.logger.error(`Failed to handle event: ${error.message}`);
    }
  }
}