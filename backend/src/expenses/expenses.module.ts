import { Module } from '@nestjs/common';

import { BankDataModule } from '../bank-data/bank-data.module.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';

/**
 * The expenses (#21, #29): the breakdown per category, read by Overview and the Expenses page, and the Expenses
 * chart. Read only through `VisibleTransactions` (#53, #77); no table of its own.
 */
@Module({
  imports: [BankDataModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
