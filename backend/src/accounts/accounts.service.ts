import { Inject, Injectable } from '@nestjs/common';
import type { AccountDetailsResponse, AccountsResponse, AccountType, Money } from '@finebank/shared';

import {
  BANK_DATA_PROVIDER,
  type BankAccount,
  type BankDataProvider,
  type BankTransaction,
} from '../bank-data/bank-data-provider.js';
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

/**
 * The one balance calculation (#57): each account's opening balance plus its Complete transactions, income added and
 * expenses subtracted, in safe integer cents. `transactions` are the visible ones, dated up to today (#53); one on an
 * account not in `accounts` counts nowhere.
 */
function balancesOf(accounts: BankAccount[], transactions: BankTransaction[]): Map<number, number> {
  const balances = new Map(accounts.map((account) => [account.id, safeCents(account.openingBalanceCents)]));
  for (const { accountId, status, direction, amountCents } of transactions) {
    const balance = balances.get(accountId);
    if (status !== 'complete' || balance === undefined) continue;
    balances.set(accountId, addCents(balance, direction === 'income' ? amountCents : -amountCents));
  }
  return balances;
}

/**
 * The accounts of the Total Balance card (#17), the Balances cards (#24) and Account Details (106), calculated here,
 * never in the frontend (#11, #77).
 */
@Injectable()
export class AccountsService {
  constructor(
    @Inject(BANK_DATA_PROVIDER) private readonly bankData: BankDataProvider,
    private readonly visibleTransactions: VisibleTransactions,
  ) {}

  /**
   * The user's accounts, oldest first (#24), each with its Bank Name and its balance: the opening balance plus the
   * account's Complete transactions dated up to today in `timeZone`, income added and expenses subtracted (#53,
   * #57). The total is the sum of the balances. Only the contract's fields: the number masked (#25), no opening
   * balance, Branch Name or transaction.
   */
  async summary(userId: number, timeZone: string): Promise<AccountsResponse> {
    const accounts = await this.bankData.listAccounts(userId);
    const { transactions } = await this.visibleTransactions.list(userId, timeZone);
    const balances = balancesOf(accounts, transactions);

    let totalCents = 0;
    for (const balance of balances.values()) totalCents = addCents(totalCents, balance);

    return {
      totalBalance: usd(totalCents),
      accounts: accounts.map((account) => ({
        id: account.id,
        accountType: account.accountType,
        bankName: account.bankName,
        cardNetwork: account.cardNetwork,
        maskedNumber: maskAccountNumber(account),
        balance: usd(balances.get(account.id)!),
      })),
    };
  }

  /**
   * One of the user's accounts for Account Details (US-12 criterion 2): exactly its type, Bank Name, Branch Name,
   * masked number (#25) and balance, from the same calculation as `summary` (#57). The account is read only through
   * the provider's `getAccount`, whose one query holds the user and the account (#39); null when it finds none (an
   * unknown ID or another user's account), and then no transaction is read. The account's transactions come through
   * `VisibleTransactions`, filtered by the user and the account in the provider's one query.
   */
  async details(userId: number, timeZone: string, accountId: number): Promise<AccountDetailsResponse | null> {
    const account = await this.bankData.getAccount(userId, accountId);
    if (account === null) return null;
    const { transactions } = await this.visibleTransactions.list(userId, timeZone, { accountId });
    return {
      accountType: account.accountType,
      bankName: account.bankName,
      branchName: account.branchName,
      maskedNumber: maskAccountNumber(account),
      balance: usd(balancesOf([account], transactions).get(account.id)!),
    };
  }

  /** Whether the account is the user's: the provider's `getAccount`, the user and the account in one query (#39). */
  async hasAccount(userId: number, accountId: number): Promise<boolean> {
    return (await this.bankData.getAccount(userId, accountId)) !== null;
  }

  /**
   * Each of the user's accounts' type by its ID: the Payment Method of the account's transactions, read on every call,
   * so a changed type shows on the next request (#57, #77).
   */
  async accountTypes(userId: number): Promise<Map<number, AccountType>> {
    const accounts = await this.bankData.listAccounts(userId);
    return new Map(accounts.map((account) => [account.id, account.accountType]));
  }
}
