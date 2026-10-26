import { Inject, Injectable } from '@nestjs/common';
import type { AccountsResponse, Money } from '@finebank/shared';

import { BANK_DATA_PROVIDER, type BankDataProvider } from '../bank-data/bank-data-provider.js';
import { VisibleTransactions } from '../bank-data/visible-transactions.js';
import { maskAccountNumber } from './mask-account-number.js';

/** Integer cents in USD, the only currency (#11, #96). */
const usd = (cents: number): Money => ({ cents, currency: 'USD' });

/** The amount itself when it is a safe integer of cents; anything else throws rather than being rounded (#11). */
function safeCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('An amount is outside the safe integer range of cents');
  }
  return cents;
}

/** `a + b` in integer cents, each of them and the sum safe integers. */
const addCents = (a: number, b: number): number => safeCents(safeCents(a) + safeCents(b));

/** The accounts of the Total Balance card (#17), calculated here, never in the frontend (#11, #77). */
@Injectable()
export class AccountsService {
  constructor(
    @Inject(BANK_DATA_PROVIDER) private readonly bankData: BankDataProvider,
    private readonly visibleTransactions: VisibleTransactions,
  ) {}

  /**
   * The user's accounts, oldest first (#24), each with its balance: the opening balance plus the account's
   * Complete transactions dated up to today in `timeZone`, income added and expenses subtracted (#53, #57). The
   * total is the sum of the balances. Only the contract's fields: the number masked (#25), no opening balance,
   * Bank Name or transaction.
   */
  async summary(userId: number, timeZone: string): Promise<AccountsResponse> {
    const accounts = await this.bankData.listAccounts(userId);
    const { transactions } = await this.visibleTransactions.list(userId, timeZone);

    const balances = new Map(accounts.map((account) => [account.id, safeCents(account.openingBalanceCents)]));
    for (const { accountId, status, direction, amountCents } of transactions) {
      const balance = balances.get(accountId);
      if (status !== 'complete' || balance === undefined) continue;
      balances.set(accountId, addCents(balance, direction === 'income' ? amountCents : -amountCents));
    }

    let totalCents = 0;
    for (const balance of balances.values()) totalCents = addCents(totalCents, balance);

    return {
      totalBalance: usd(totalCents),
      accounts: accounts.map((account) => ({
        id: account.id,
        accountType: account.accountType,
        cardNetwork: account.cardNetwork,
        maskedNumber: maskAccountNumber(account),
        balance: usd(balances.get(account.id)!),
      })),
    };
  }
}
