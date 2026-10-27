import { Module } from '@nestjs/common';

import { BankDataModule } from '../bank-data/bank-data.module.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

/**
 * The transactions (#19, #40): the Overview Recent Transaction card for now; the Transactions page later (task 020).
 * Read only through `VisibleTransactions` (#53, #77); no table of its own.
 */
@Module({
  imports: [BankDataModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
