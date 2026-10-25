import type {
  AccountType,
  CardNetwork,
  ExpenseCategory,
  TransactionDirection,
  TransactionStatus,
} from '@finebank/shared';

/** An account as the bank holds it: raw fields only, no balance and no mask (#25, #57, #77). */
export interface BankAccount {
  id: number;
  accountType: AccountType;
  bankName: string;
  branchName: string;
  cardNetwork: CardNetwork | null;
  /** The full number. Masked by the app before it leaves the backend (#25). */
  accountNumber: string;
  openingBalanceCents: number;
}

/** A transaction as the bank holds it. Credit/Debit and Payment Method are derived, never stored (#27, #57). */
export interface BankTransaction {
  id: number;
  accountId: number;
  /** UTC (#11). */
  occurredAt: Date;
  direction: TransactionDirection;
  status: TransactionStatus;
  category: ExpenseCategory | null;
  item: string;
  shopName: string;
  receipt: string;
  amountCents: number;
}

/** The fields Edit Details changes (#26). */
export interface AccountDetails {
  bankName: string;
  branchName: string;
  accountType: AccountType;
}

export interface TransactionFilter {
  accountId?: number;
  direction?: TransactionDirection;
  /** Inclusive. */
  occurredFrom?: Date;
  /** Exclusive. */
  occurredBefore?: Date;
  /** `nextCursor` of the previous page. */
  cursor?: string;
  /** Page size, a positive integer; without it every match is returned. */
  limit?: number;
}

export interface TransactionPage {
  /** Newest first: `occurredAt` descending, then `id` descending. */
  transactions: BankTransaction[];
  /** The cursor of the next page, or null on the last page. */
  nextCursor: string | null;
}

/** A cursor the provider did not make. Task 020 maps it to 400. */
export class InvalidCursorError extends Error {
  constructor() {
    super('The cursor is not valid');
    this.name = 'InvalidCursorError';
  }
}

/**
 * Account and transaction data (#1, #77): today the app's own tables, later possibly a bank API.
 * Every method takes the signed-in user's ID and reads or changes only that user's data (#39, #46).
 * Balances, totals, masks and hiding entries dated after today are app calculations over this data.
 */
export interface BankDataProvider {
  /** The user's accounts, oldest first (#24). */
  listAccounts(userId: number): Promise<BankAccount[]>;
  /** The account, or null when it does not exist or belongs to another user (#39). */
  getAccount(userId: number, accountId: number): Promise<BankAccount | null>;
  /** Stores the details and returns the account, or null (nothing changed) as for getAccount. */
  updateAccountDetails(userId: number, accountId: number, details: AccountDetails): Promise<BankAccount | null>;
  /**
   * The user's transactions matching the filter, newest first. Read them through VisibleTransactions,
   * which hides entries dated after today (#53). Throws InvalidCursorError for a cursor it did not
   * make and RangeError for a limit that is not a positive integer.
   */
  listTransactions(userId: number, filter: TransactionFilter): Promise<TransactionPage>;
}

export const BANK_DATA_PROVIDER = Symbol('BankDataProvider');
