// Writes one mutation spec per break of task 022's Validation step 4 into ./specs/.
import { mkdirSync, writeFileSync } from 'node:fs';

const dir = new URL('./specs/', import.meta.url);
mkdirSync(dir, { recursive: true });

const be = (files) => `cd backend && npx vitest run ${files}`;
const fe = (files) => `cd frontend && npx vitest run ${files}`;
const sh = (files) => `cd shared && npx vitest run ${files}`;
const e2e = (grep) => `cd e2e && npx playwright test tests/account-details-edit.spec.ts --reporter=line --grep "${grep}"`;
const buildShared = 'npm run build -w shared';

const provider = 'backend/src/bank-data/typeorm-bank-data-provider.ts';
const service = 'backend/src/accounts/accounts.service.ts';
const guard = 'backend/src/auth/session.guard.ts';
const contract = 'shared/src/contract/account.ts';

const specs = {
  '01-update-without-user': {
    edits: [
      {
        file: provider,
        from: 'this.accounts.update({ id: accountId, userId }, {',
        to: 'this.accounts.update({ id: accountId }, {',
      },
    ],
    commands: [be('test/account-details-edit.test.ts -t "not-found rule"'), e2e('same 404')],
  },
  '02-read-before-write': {
    edits: [
      {
        file: service,
        from: '    const account = await this.bankData.updateAccountDetails(userId, accountId, {',
        to: '    if ((await this.bankData.getAccount(userId, accountId)) === null) return null;\n    const account = await this.bankData.updateAccountDetails(userId, accountId, {',
      },
    ],
    commands: [
      be('test/accounts-service.test.ts -t updateDetails'),
      be('test/account-details-edit.test.ts -t "UPDATE"'),
      be('test/bank-data-source.test.ts'),
    ],
  },
  '03-raw-header-compared': {
    edits: [
      {
        file: guard,
        from: '    if (expected.data !== (await this.users.emailOf(userId))) {',
        to: '    if (request.header(EXPECTED_USER_HEADER) !== (await this.users.emailOf(userId))) {',
      },
    ],
    commands: [be('test/account-details-edit.test.ts -t "another case"'), be('test/write-guard.test.ts -t "another case"')],
  },
  '04-guard-removed': {
    edits: [
      {
        file: guard,
        from: '    if (!readMethods.has(request.method)) {',
        to: "    if (!readMethods.has(request.method) && request.method === 'NEVER') {",
      },
    ],
    commands: [
      be('test/account-details-edit.test.ts -t "order and the protections"'),
      be('test/write-guard.test.ts'),
      e2e('stale tab'),
    ],
  },
  '05-frontend-no-header': {
    edits: [
      {
        file: 'frontend/src/api/client.ts',
        from: '  return send(entry, args, { [EXPECTED_USER_HEADER]: expectedUser });',
        to: '  return send(entry, args, {});',
      },
    ],
    commands: [
      fe('test/api/client.test.ts -t sendWrite'),
      fe('test/app/account-details-edit.test.tsx -t "a save"'),
      fe('test/app/overview-goals.test.tsx -t "saving the goal"'),
      e2e('saves Checking|keyboard|Mastercard'),
    ],
  },
  '06-no-session-check-after-409': {
    edits: [
      {
        file: 'frontend/src/api/session.ts',
        from: '        if (isOtherUserSignedIn(error)) void queryClient.invalidateQueries({ queryKey: sessionQueryKey, exact: true });',
        to: '',
      },
    ],
    commands: [
      fe('test/app/account-details-edit.test.tsx -t "409"'),
      fe('test/app/overview-goals.test.tsx -t "409"'),
      e2e('stale tab'),
    ],
  },
  '07-untrimmed-name-stored': {
    shared: true,
    edits: [{ file: contract, from: '    .trim()\n    .refine((text) => !invisibleOnly', to: '    .refine((text) => !invisibleOnly' }],
    commands: [
      sh('test/account-edit-contract.test.ts'),
      `${buildShared} && ${be('test/account-details-edit.test.ts -t "an own account"')}`,
      e2e('saves Checking'),
    ],
  },
  '08-whitespace-only-stored': {
    shared: true,
    edits: [
      {
        file: contract,
        from: '    .refine((text) => !invisibleOnly.test(text), { error: messages.required, abort: true })\n',
        to: '',
      },
    ],
    commands: [
      sh('test/account-edit-contract.test.ts'),
      `${buildShared} && ${be('test/account-details-edit.test.ts -t "the rules"')}`,
      `${buildShared} && ${fe('test/app/account-details-edit.test.tsx -t "rules"')}`,
    ],
  },
  '09-utf16-units-counted': {
    shared: true,
    edits: [
      {
        file: contract,
        from: '    .refine((text) => [...text].length <= MAX_NAME_CODE_POINTS, { error: messages.max });',
        to: '    .refine((text) => text.length <= MAX_NAME_CODE_POINTS, { error: messages.max });',
      },
    ],
    commands: [
      sh('test/account-edit-contract.test.ts'),
      `${buildShared} && ${be('test/account-details-edit.test.ts -t "the rules"')}`,
    ],
  },
  '10-mass-assignment': {
    shared: true,
    edits: [
      { file: contract, from: 'export const accountDetailsRequestSchema = z.object({', to: 'export const accountDetailsRequestSchema = z.looseObject({' },
      { file: service, from: '    { bankName, branchName, accountType }: AccountDetailsRequest,', to: '    request: AccountDetailsRequest,' },
      {
        file: service,
        from: 'updateAccountDetails(userId, accountId, { bankName, branchName, accountType });',
        to: 'updateAccountDetails(userId, accountId, request);',
      },
      { file: provider, from: '    { bankName, branchName, accountType }: AccountDetails,', to: '    details: AccountDetails,' },
      {
        file: provider,
        from: 'this.accounts.update({ id: accountId, userId }, { bankName, branchName, accountType });',
        to: 'this.accounts.update({ id: accountId, userId }, details);',
      },
    ],
    commands: [`${buildShared} && ${be('test/account-details-edit.test.ts -t "an own account"')}`],
  },
  '11a-no-transactions-reset': {
    edits: [
      {
        file: 'frontend/src/api/accounts.ts',
        from: '      if (typeChanged) void queryClient.resetQueries({ queryKey: transactionListsQueryKey });\n',
        to: '',
      },
    ],
    commands: [
      fe('test/api/update-account-details.test.tsx'),
      fe('test/app/account-details-edit.test.tsx -t "each screen"'),
      e2e('saves Checking'),
    ],
  },
  '11b-no-accounts-reset': {
    edits: [
      {
        file: 'frontend/src/api/accounts.ts',
        from: '        void queryClient.resetQueries({ queryKey: accountsQueryKey, exact: true });\n',
        to: '',
      },
    ],
    commands: [
      fe('test/api/update-account-details.test.tsx'),
      fe('test/app/account-details-edit.test.tsx -t "each screen"'),
      e2e('saves Checking'),
    ],
  },
  '11c-everything-invalidated': {
    edits: [
      {
        file: 'frontend/src/api/accounts.ts',
        from: '      if (typeChanged) void queryClient.resetQueries({ queryKey: transactionListsQueryKey });',
        to: '      void queryClient.invalidateQueries();',
      },
    ],
    commands: [fe('test/api/update-account-details.test.tsx')],
  },
  '12-no-focus-after-save': {
    edits: [{ file: 'frontend/src/app/pages/AccountDetailsPage.tsx', from: '    editButton.current?.focus();\n', to: '' }],
    commands: [fe('test/app/account-details-edit.test.tsx -t "a save"'), e2e('keyboard')],
  },
};

for (const [name, spec] of Object.entries(specs)) {
  writeFileSync(new URL(`${name}.json`, dir), JSON.stringify({ name, ...spec }, null, 2));
}
console.log(Object.keys(specs).join('\n'));
