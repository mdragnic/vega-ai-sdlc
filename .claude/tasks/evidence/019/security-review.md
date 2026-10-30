# Task 019 security review, 2026-10-30

`security-review` on the task's uncommitted changes (`git diff HEAD`, new files intent-to-add; `.claude/`, `docs/` and
this folder left out). The skill's own diff was empty (the changes are not committed on `main`), so its review sub-task
read `git diff HEAD`. One review sub-task; no finding reached the false-positive filtering step.

## Result: no vulnerabilities found

What was checked:

- **Backend, `backend/src/accounts/accounts.service.ts`**: the one change adds `bankName: account.bankName` to the
  per-account object, built from an explicit list of keys. The accounts still come from
  `BankDataProvider.listAccounts(userId)` (`TypeOrmBankDataProvider`: `find({ where: { userId } })`, parameterized,
  scoped to the signed-in user): no IDOR, no SQL injection. `userId` comes from `@CurrentUser()` behind the global
  `SessionGuard` (APP_GUARD); the controller is unchanged. The number is still masked only by `maskAccountNumber`; no
  `accountNumber`, `branchName` or `openingBalanceCents` reaches the response (the tests check the Branch Names and the
  opening balance are absent).
- **Contract, `shared/src/contract/account.ts`**: `bankNameSchema` (`z.string().min(1).max(100)`) in
  `accountSummarySchema`, a response shape only; no new input path. The existing `updateAccountDetails` write path is
  unchanged.
- **Frontend**: `AccountType` renders `account.bankName` as a React text child (escaped), so a Bank Name edited later
  (task 022) cannot inject markup. The `useId` ids feed `aria-describedby`; the logo's `src` and `alt` come from a fixed
  map keyed by the contract's card network enum. `Button` is a React Router `Link` to
  `accountDetailsPath(String(account.id))` (the contract's positive integer id, `encodeURIComponent`): no `javascript:`
  URL or open redirect. No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, raw `href`, logging or new storage in the
  non-test diff. `BalancesPage`, `AccountTypeSkeleton`, `AddAccountsCell` and `AddAccountsButtonBig` are static or
  visual only; `routes.tsx` only attaches `BalancesPage` to the existing guarded route. `assets/brand/index.ts` only
  moves the logo map; the gallery uses hard-coded sample data on a dev-only route.
- **Tests** (`shared/test`, `backend/test`, `frontend/test`, `e2e/tests`): test code only.

Fixes: none needed.
