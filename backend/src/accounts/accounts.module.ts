import { Module } from '@nestjs/common';

import { BankDataModule } from '../bank-data/bank-data.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

/**
 * The accounts with their balances and the Total Balance, calculated from the bank data (#17, #57, #77). Exports
 * `AccountsService` for the Payment Method of the Transactions page (task 020).
 */
@Module({
  imports: [BankDataModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
