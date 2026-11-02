# Code review, task 021 (Account Details), 2026-11-02

`superpowers:requesting-code-review`: one reviewer sub-task on `git diff HEAD` (uncommitted on 049fc1e), the task file as
the plan, read-only. Verdict: **With fixes** (no Critical).

## Findings and what was done

| # | Severity | Finding | Done |
|---|----------|---------|------|
| 1 | Important | `AccountDetailsPage`: the gate that holds both cards on their skeletons until both first answers are in was recalculated on every render. TanStack Query resets a query with no data to `pending` with no failures when it is asked again, so a Retry of one failed card, or a refetch on window focus while one card is in its error state, sent the other, working card back to its skeleton and dropped its keyboard focus (AC17, #114, #117 a, #118 a). | Fixed test-first: the gate is latched for the account's page (`useState`, set once both first answers are in; the page is keyed by the account ID). New tests: the history and focus on "Load More" kept while a held Retry of the details runs, and when the window gets focus back while the details are in error (both red before the fix). Mutation 12 (the gate unlatched) fails both. |
| 2 | Minor | `retryUnlessNotFound` copied the app's default retry rule. | Fixed: `session.ts` exports `retryQuery` (the default, used by the query client), and the account queries compose it with the 404 exception. |
| 3 | Minor | `pathWith`'s comment over-promised: `encodeURIComponent` leaves `.` and `..`, which a URL resolves; safe today only because `accountIdSchema` is digits only. | Fixed test-first: `.` and `..` are refused whatever the params schema allows (a `TypeError` before any request); two client tests, red before the fix. Comment narrowed. |
| 4 | Minor | The gate's first-try-failed branch (a card shows while the other is still between its retries) had no test. | Fixed: a test with the details failing on every try asserts the history shows before the retries end. Mutation 13 (the branch removed) fails it and the details' keyboard Retry test. |
| 5 | Minor | The ID-comparison source guard covered all backend code outside `bank-data/` and `demo/`, which could flag unrelated code later. | Scoped to the `accounts/` and `transactions/` modules (AC19's wording); mutation 8 (fetch-then-compare) still fails it. |
| 6 | Minor | A stray line break in `app-shell.test.tsx`'s `builtSections` comment. | Fixed. |

## Declined to judge (the reviewer's list, with the rulings)

- Skeleton widths reuse unrelated tokens: the convention of tasks 019 and 020. Kept.
- The history with a foreign or malformed ID and a cursor over 64 characters answers 400 (the query pipe runs first), alike for every ID, so nothing leaks; AC12 uses a valid cursor. Kept, noted in the Log.
- `/balances/%31` opens account 1: React Router and the backend both decode the segment the same way. Kept.
- A click on the inert "Edit Details" or "Remove" blurs a focused element, as a click on any non-focusable area does (as on Balances, task 019). Kept.
- An empty page after a valid cursor would leave focus on the body: needs rows removed between pages, which the app cannot do; inherited unchanged from task 020's Load More. Kept.
- `details` reads the account's visible transactions for the balance: the one calculation (#57). Kept.
- Any 404 in the shared error shape redirects to Balances: the account routes answer no other 404. Kept.
- The visual match and e2e geometry were not run by the reviewer: covered by validation steps 3 and 5.
