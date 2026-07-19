import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CasesModule } from './cases/cases.module';
import { HealthController } from './health.controller';
import { OperationsModule } from './operations/operations.module';
import { PrismaModule } from './prisma/prisma.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CasesModule,
    AnalyticsModule,
    OperationsModule,
    SyncModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
