import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { BlockchainService } from './services/blockchain.service';
import { ContractService } from './services/contract.service';
import { IndexerService } from './services/indexer.service';
import { EventListener } from './listeners/event.listener';
import { ProposalListener } from './listeners/proposal.listener';
import { BlockchainController } from './controllers/blockchain.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [BlockchainController],
  providers: [
    BlockchainService,
    ContractService,
    IndexerService,
    EventListener,
    ProposalListener,
  ],
  exports: [BlockchainService, ContractService],
})
export class BlockchainServiceModule {}

