import { Module } from '@nestjs/common';

import { BANK_DATA_PROVIDER } from './bank-data-provider.js';
import { TypeOrmBankDataProvider } from './typeorm-bank-data-provider.js';
import { VisibleTransactions } from './visible-transactions.js';

/** Account and transaction data behind BANK_DATA_PROVIDER (#77), and VisibleTransactions for reads (#53). */
@Module({
  providers: [{ provide: BANK_DATA_PROVIDER, useClass: TypeOrmBankDataProvider }, VisibleTransactions],
  exports: [BANK_DATA_PROVIDER, VisibleTransactions],
})
export class BankDataModule {}
