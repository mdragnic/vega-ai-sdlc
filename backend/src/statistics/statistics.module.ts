import { Module } from '@nestjs/common';

import { BankDataModule } from '../bank-data/bank-data.module.js';
import { StatisticsController } from './statistics.controller.js';
import { StatisticsService } from './statistics.service.js';

/**
 * The charts' numbers (#20): the Overview Statistics weekly comparison for now; the Expenses page's monthly
 * comparison later (task 024). Read only through `VisibleTransactions` (#53, #77); no table of its own.
 */
@Module({
  imports: [BankDataModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
