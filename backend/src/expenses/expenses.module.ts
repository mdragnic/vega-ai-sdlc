import { Module } from '@nestjs/common';

import { BankDataModule } from '../bank-data/bank-data.module.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';

/**
 * The expenses per category (#21): the Overview Expenses Breakdown for now; the Expenses page later (task 024). Read
 * only through `VisibleTransactions` (#53, #77); no table of its own.
 */
@Module({
  imports: [BankDataModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
