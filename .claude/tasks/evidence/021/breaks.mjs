// Task 021 validation step 4: break the code on purpose, one mutation at a time, run the named tests, restore.
// Usage: node breaks.mjs <id>[,<id>...] | all     (run from anywhere; the repo root is fixed below)
import { createHash } from 'node:crypto';
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'D:/Projects/VegaAI/finebank-v1';
const LOG = join(import.meta.dirname, 'breaks-log.txt');

const sh = (cmd, cwd = ROOT) => execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const state = () =>
  createHash('sha256')
    .update(sh('git diff HEAD'))
    .update('\0')
    .update(sh('git status --short'))
    .digest('hex');

const be = (files) => ({ cwd: 'backend', cmd: `npx vitest run ${files}` });
const fe = (files) => ({ cwd: 'frontend', cmd: `npx vitest run ${files}` });
const sharedT = (files) => ({ cwd: 'shared', cmd: `npx vitest run ${files}` });
const e2e = (grep) => ({ cwd: 'e2e', cmd: `npx playwright test tests/account-details.spec.ts --grep "${grep}" --reporter=line` });

const files = {
  provider: 'backend/src/bank-data/typeorm-bank-data-provider.ts',
  txService: 'backend/src/transactions/transactions.service.ts',
  txController: 'backend/src/transactions/transactions.controller.ts',
  accService: 'backend/src/accounts/accounts.service.ts',
  accController: 'backend/src/accounts/accounts.controller.ts',
  accountContract: 'shared/src/contract/account.ts',
  client: 'frontend/src/api/client.ts',
  page: 'frontend/src/app/pages/AccountDetailsPage.tsx',
  historyTable: 'frontend/src/components/TransactionsHistoryTable/TransactionsHistoryTable.tsx',
  loadMore: 'frontend/src/components/LoadMore/LoadMore.tsx',
  itemCss: 'frontend/src/components/TransactionsHistoryItem/TransactionsHistoryItem.module.css',
  cardCss: 'frontend/src/components/AccountDetailsCard/AccountDetailsCard.module.css',
};

const hasAccountLine = '    if (!(await this.accounts.hasAccount(userId, accountId))) return null;\n';
const userWhere = ".where('a.userId = :userId', { userId })";

const mutations = {
  '1-getAccount-no-user': {
    what: "the provider's getAccount without its user condition (findOneBy({ id: accountId }))",
    edits: [[files.provider, 'findOneBy({ id: accountId, userId })', 'findOneBy({ id: accountId })']],
    tests: [be('test/account-details.test.ts test/bank-data-provider.test.ts'), e2e('malformed ID')],
  },
  '2a-history-no-hasAccount': {
    what: 'the getAccount check removed from the history (no hasAccount)',
    edits: [[files.txService, hasAccountLine, '']],
    tests: [be('test/account-details.test.ts test/bank-data-provider.test.ts')],
  },
  '2b-and-provider-no-user': {
    what: "then also the user condition removed from the provider's transaction query",
    edits: [
      [files.txService, hasAccountLine, ''],
      [files.provider, userWhere, ".where('1 = 1')"],
    ],
    tests: [be('test/account-details.test.ts test/bank-data-provider.test.ts')],
  },
  '3a-filter-only-first-page': {
    what: 'the account filter dropped in the paging path (accountId only when there is no cursor)',
    edits: [
      [
        files.txService,
        '    const page = await this.visibleTransactions.list(userId, timeZone, {\n      accountId,\n',
        '    const page = await this.visibleTransactions.list(userId, timeZone, {\n      ...(cursor === undefined && { accountId }),\n',
      ],
    ],
    tests: [be('test/transaction-history.test.ts'), e2e('adds page 2 with')],
  },
  '3b-provider-no-account-filter': {
    what: "the provider's accountId condition removed",
    edits: [[files.provider, "    if (accountId !== undefined) query.andWhere('t.accountId = :accountId', { accountId });\n", '']],
    tests: [be('test/transaction-history.test.ts')],
  },
  '4a-full-number': {
    what: 'a full number in the response (maskedNumber: account.accountNumber in details)',
    edits: [
      [
        files.accService,
        '      maskedNumber: maskAccountNumber(account),\n      balance: usd(balancesOf(',
        '      maskedNumber: account.accountNumber,\n      balance: usd(balancesOf(',
      ],
    ],
    tests: [be('test/account-details.test.ts test/bank-data-source.test.ts test/accounts-service.test.ts')],
  },
  '4b-extra-accountNumber': {
    what: 'an extra accountNumber key in the details',
    edits: [
      [
        files.accService,
        '      maskedNumber: maskAccountNumber(account),\n      balance: usd(balancesOf(',
        '      maskedNumber: maskAccountNumber(account),\n      accountNumber: account.accountNumber,\n      balance: usd(balancesOf(',
      ],
    ],
    tests: [be('test/account-details.test.ts test/bank-data-source.test.ts test/accounts-service.test.ts')],
  },
  '5-second-balance-path': {
    what: "a second balance path: details sums the account's transactions of every status in its own loop",
    edits: [
      [
        files.accService,
        '      balance: usd(balancesOf([account], transactions).get(account.id)!),',
        "      balance: usd(transactions.reduce((sum, t) => sum + (t.direction === 'income' ? t.amountCents : -t.amountCents), account.openingBalanceCents)),",
      ],
    ],
    tests: [be('test/account-details.test.ts test/accounts-service.test.ts')],
  },
  '6-non-numeric-400': {
    what: 'a non-numeric ID answered 400 (a validating pipe on the path parameter)',
    edits: [
      [files.accController, "import { Controller, Get, Param } from '@nestjs/common';", "import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';"],
      [files.accController, "@Param('accountId') rawAccountId: string | undefined,", "@Param('accountId', ParseIntPipe) rawAccountId: string | undefined,"],
    ],
    tests: [be('test/account-details.test.ts')],
  },
  '7a-loose-parse': {
    what: 'a loose parse (Number(raw) with Number.isInteger and > 0) in the shared accountIdSchema',
    edits: [
      [
        files.accountContract,
        'export const accountIdSchema = z\n  .string()\n  .regex(/^[1-9][0-9]*$/)\n  .transform(Number)\n  .refine(Number.isSafeInteger);',
        'export const accountIdSchema = z.string().transform(Number).refine((id) => Number.isInteger(id) && id > 0);',
      ],
    ],
    buildShared: true,
    tests: [
      sharedT('test/account-details-contract.test.ts'),
      be('test/account-details.test.ts'),
      fe('test/api/client.test.ts test/app/account-details.test.tsx'),
    ],
  },
  '7b-no-empty-segment-routes': {
    what: 'the empty-segment routes removed',
    edits: [
      [files.accController, '@Get([accountsContract.details.path, emptyAccountIdPath(accountsContract.details.path)])', '@Get(accountsContract.details.path)'],
      [files.txController, '@Get([transactionsContract.history.path, emptyAccountIdPath(transactionsContract.history.path)])', '@Get(transactionsContract.history.path)'],
      [files.accController, "import { accountIdFrom, accountNotFound, emptyAccountIdPath } from './account-not-found.js';", "import { accountIdFrom, accountNotFound } from './account-not-found.js';"],
      [files.txController, "import { accountIdFrom, accountNotFound, emptyAccountIdPath } from '../accounts/account-not-found.js';", "import { accountIdFrom, accountNotFound } from '../accounts/account-not-found.js';"],
    ],
    tests: [be('test/account-details.test.ts')],
  },
  '7c-frontend-raw-param': {
    what: 'the frontend sending the raw param without the shared parse (the page and apiRequest)',
    edits: [
      [files.page, '  const parsed = accountIdSchema.safeParse(accountId);', '  const parsed = { success: true as const, data: accountId as unknown as number };'],
      [files.page, "import { accountIdSchema } from '@finebank/shared';\n", ''],
      [files.client, 'Object.entries(entry.params.parse(params))', 'Object.entries(params as Record<string, string>)'],
    ],
    tests: [fe('test/app/account-details.test.tsx'), e2e('malformed ID')],
  },
  '8-fetch-then-compare': {
    what: 'fetch-then-compare: details reads listAccounts(userId) and picks the ID',
    edits: [
      [
        files.accService,
        '    const account = await this.bankData.getAccount(userId, accountId);',
        '    const account = (await this.bankData.listAccounts(userId)).find((a) => a.id === accountId) ?? null;',
      ],
    ],
    tests: [be('test/accounts-service.test.ts test/bank-data-source.test.ts')],
  },
  '9-no-redirect': {
    what: "the redirect: the page shows DataState's error state on a 404 instead of opening Balances",
    edits: [[files.page, '  if (isAccountNotFound(account.error) || isAccountNotFound(history.error)) {', '  if (false as boolean) {']],
    tests: [fe('test/app/account-details.test.tsx'), e2e('malformed ID')],
  },
  '10a-load-more-kept': {
    what: '"Load More" kept at the end of the list',
    edits: [[files.historyTable, '  const hasMore = (pages.at(-1)?.nextCursor ?? null) !== null;', '  const hasMore = pages.length > 0;']],
    tests: [fe('test/app/account-details.test.tsx'), e2e('2022-01-15')],
  },
  '10b-focus-left-on-button': {
    what: 'focus left on the button after the rows arrive (the shared LoadMore)',
    edits: [[files.loadMore, '    if (active === null || active === document.body || active === buttonRef.current) row.focus({ preventScroll: true });', '    void row;']],
    tests: [fe('test/app/account-details.test.tsx test/app/transactions.test.tsx'), e2e('2022-01-15')],
  },
  '12-unlatched-gate': {
    what: 'the skeleton gate not latched (code review): recalculated on every render',
    edits: [
      [files.page, '  if (!answered && firstAnswerIn(account) && firstAnswerIn(history)) setAnswered(true);', '  const unlatched = firstAnswerIn(account) && firstAnswerIn(history);'],
      [files.page, 'query={answered ? account : waiting(account)}', 'query={unlatched ? account : waiting(account)}'],
      [files.page, 'query={answered ? history : waiting(history)}', 'query={unlatched ? history : waiting(history)}'],
    ],
    tests: [fe('test/app/account-details.test.tsx')],
  },
  '13-no-failure-branch': {
    what: "the gate without its first-try-failed branch (a card waits for the other's retries to end)",
    edits: [[files.page, "query.status !== 'pending' || query.failureCount > 0;", "query.status !== 'pending';"]],
    tests: [fe('test/app/account-details.test.tsx')],
  },
  '11-nowrap': {
    what: 'the rows and the values kept on one line (white-space: nowrap on every cell and value)',
    edits: [
      [files.itemCss, '.date,\n.text {\n  overflow-wrap: anywhere;\n  hyphens: auto;\n}', '.date,\n.text {\n  white-space: nowrap;\n}'],
      [files.cardCss, '.text {\n  overflow-wrap: anywhere;\n  hyphens: auto;\n}', '.text {\n  white-space: nowrap;\n}'],
    ],
    tests: [e2e('wraps 100-character names in words .* at 1280')],
  },
};

const log = (line) => {
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
};

/** The test runner's summary and failing test names. */
function summarize(output) {
  const lines = output.split(/\r?\n/);
  const summary = lines.filter((l) => /^\s*(Tests|Test Files)\s/.test(l) || /^\s*\d+ (passed|failed|flaky|skipped)/.test(l));
  const failing = lines
    .filter((l) => /^\s*×|✘|^\s*\[chromium\] › .*›/.test(l) && !/^\s*✓/.test(l))
    .map((l) => l.trim())
    .filter((l, i, all) => all.indexOf(l) === i)
    .slice(0, 25);
  return { summary: summary.map((s) => s.trim()), failing };
}

function run(id) {
  const m = mutations[id];
  if (!m) throw new Error(`unknown mutation ${id}`);
  log(`\n=== ${id}: ${m.what}`);
  const before = state();
  const backups = new Map();
  for (const [file] of m.edits) if (!backups.has(file)) backups.set(file, readFileSync(join(ROOT, file), 'utf8'));
  try {
    for (const [file, from, to] of m.edits) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      const count = text.split(from).length - 1;
      if (count !== 1) throw new Error(`${file}: expected the text once, found ${count}: ${from.slice(0, 60)}`);
      writeFileSync(join(ROOT, file), text.replace(from, to));
    }
    if (m.buildShared) sh('npm run build -w shared');
    for (const t of m.tests) {
      const r = spawnSync(t.cmd, { cwd: join(ROOT, t.cwd), shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 900_000 });
      const { summary, failing } = summarize(`${r.stdout}\n${r.stderr}`);
      log(`  [${t.cwd}] ${t.cmd}\n    exit ${r.status}; ${summary.join(' | ')}`);
      for (const f of failing) log(`    FAIL ${f}`);
    }
  } finally {
    for (const [file, text] of backups) writeFileSync(join(ROOT, file), text);
    if (m.buildShared) sh('npm run build -w shared');
  }
  const after = state();
  log(`  state before ${before.slice(0, 16)} after ${after.slice(0, 16)}: ${before === after ? 'restored' : 'DIFFERENT'}`);
  if (before !== after) throw new Error('The working tree did not come back');
}

const arg = process.argv[2] ?? 'all';
const ids = arg === 'all' ? Object.keys(mutations) : arg.split(',');
for (const id of ids) run(id);
