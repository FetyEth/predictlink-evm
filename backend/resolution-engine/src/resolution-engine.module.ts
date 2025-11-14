import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { ResolutionService } from './services/resolution.service';
import { StateMachineService } from './services/state-machine.service';
import { LivenessProcessor } from './processors/liveness.processor';
import { SettlementProcessor } from './processors/settlement.processor';
import { ResolutionController } from './controllers/resolution.controller';
import { CacheService } from './services/cache.service';
import { BlockchainService } from './services/blockchain.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USER'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [],
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'liveness-monitoring' },
      { name: 'settlement-processing' },
    ),
    HttpModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [ResolutionController],
  providers: [
    ResolutionService,
    StateMachineService,
    LivenessProcessor,
    SettlementProcessor,
    CacheService,
    BlockchainService,
  ],
})
export class ResolutionEngineModule {}