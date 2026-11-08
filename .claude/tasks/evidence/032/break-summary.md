# Task 032: break summary

Validation step 4, item 2 only (it shows money's direction; items 1 and 3 touch no security, user scoping, money or dates). Each break changed the code, ran only its test files (the unit file `frontend/test/components/signed-amounts.test.tsx` and the e2e spec named), restored the code, and compared the hashes of `git diff HEAD` plus `git status --short` before and after.

| Break | Change | Unit tests that failed | E2E tests that failed | Restore hash |
|-------|--------|------------------------|-----------------------|--------------|
| B1 | `RecentTransactionItem`: income given the expense class | `RecentTransactionItem` "gives an income amount the income colour and keeps its text" (1 of 11) | `overview-recent-transaction.spec.ts` "shows income amounts in green and expense amounts in red on every tab" (1 of 14) | `cce4424febdfab73` before and after, match |
| B2 | `TransactionItem`: income given the expense class | `TransactionItem` "gives an income amount the income colour and keeps its text" (1 of 11) | `transactions.spec.ts` "shows income amounts in green and expense amounts in red on every tab, the rows "Load More" adds included" (1 of 17) | `cce4424febdfab73` before and after, match |
| B3 | `TransactionsHistoryItem`: income given the expense class | `TransactionsHistoryItem` "gives an income amount the income colour and keeps its text" (1 of 11) | `account-details.spec.ts` "shows income amounts in green and expense amounts in red in the history, the rows "Load More" adds included" (1 of 14) | `cce4424febdfab73` before and after, match |
| B4 | `ExpensesLineItem`: the unsigned card items given the expense class, and its own `color` removed from `.amount` as in the three signed items | "leaves the Expenses card items in Secondary, without the signed colours" (1 of 11) | `expenses.spec.ts` "keeps the Expenses card line items unsigned, in Secondary": `$20.16` in `rgb(221, 56, 23)`, expected `rgb(82, 82, 86)` (1 of 14) | `cce4424febdfab73` before and after, match |

B4 was first run with the class added only, the item's `.amount` colour left in place: the unit test failed (the import), and the e2e test passed, correctly, since the item's own rule came later in the CSS and the amount stayed Secondary on screen (restore hash matched). The break was then run as above, the mistake that changes what the user sees.
