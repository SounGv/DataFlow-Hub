import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SearchController } from '../search/search.controller';
import { OperationsController } from './operations.controller';

@Module({
  imports: [AuthModule],
  controllers: [OperationsController, SearchController],
})
export class OperationsModule {}
