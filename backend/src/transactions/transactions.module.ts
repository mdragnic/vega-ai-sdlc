import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/accounts.module.js';
import { BankDataModule } from '../bank-data/bank-data.module.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

/**
 * The transactions (#19): the Overview Recent Transaction card (#40) and the Transactions page (#27). Read only
 * through `VisibleTransactions` (#53, #77), the Payment Method through `AccountsService` (#57); no table of its own.
 */
@Module({
  imports: [BankDataModule, AccountsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
