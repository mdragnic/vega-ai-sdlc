# Task 032: visual check

Playwright MCP, a fresh context at 1440x1024, device scale 2, Europe/Belgrade, the page clock fixed at 2026-10-22T10:00:00Z, the e2e backend on the same clock, a new demo user per run. Compared by eye with the PNGs in `docs/figma/` (no Figma calls). Scrollbars hidden for the PNG comparisons (`html { scrollbar-width: none }` injected into the context), shown (the headed browser's classic 15 px scrollbar) for item 1.

## Item 1: popups and dropdowns, the classic scrollbar shown

| Capture | What it shows |
|---------|---------------|
| `item1-before-p1-closed.png`, `item1-before-p1-open.png`, `item1-before-d1-open.png` | Before the fix: with P1 or D1 open the header's search ends at x 1378 instead of 1393 and the cards move left; a light 15 px strip right of the dim |
| `item1-after-p1-closed.png`, `item1-after-p1-open.png`, `item1-after-d1-open.png` | After: the search at 1393 open and closed, the cards in place, the dim to the gutter; the thumb hidden while open, its gutter kept (#134 b1) |

Measured with each capture: `body` 1425 wide, `margin-right` 0, the search's right edge 1393, the Goals section at x 675 and the page 1125 tall, closed, open and closed again (before: 1410, 15px, 1378, 670 and 1143 while open).

## Each touched screen against its PNG

| Screen | Captures | Differences |
|--------|----------|-------------|
| 104 Overview | `104-overview.png` | Decided: Recent Transaction's amounts red for expenses (`-$266.00` and the rest), green for income on Revenue (#132, #134 a). Listed by earlier tasks: the demo data and the date (#12), the top row's height and the bills' amount boxes under their text (#105 a, #111 a), the Statistics scale and days (#55, #72), the Total Balance slider's five dots, initials for the photo (task 029) |
| 104.1 Overview popup | `104.1-overview-popup.png` | None new: the popup as task 014 built it, the page behind it unmoved |
| 105 Balances | `105-balances.png`, `105-balances-add-accounts-hover.png`, `105-balances-add-accounts-focus.png`, `105-balances-edit-accounts-focus.png`, `105-balances-remove-focus.png` | Decided (#133): "Add Accounts" in the gray disabled look (`--color-button-secondary` fill, `--color-input-active` text) instead of teal; each card's "Remove" Gray/03 instead of teal; "Not available" (not designed) above "Add Accounts" and under "Edit Accounts" and each "Remove" on hover and keyboard focus; the #87 ring on the focused control. Listed by earlier tasks: the demo numbers and masked numbers (#12, #25), the date, initials for the photo |
| 106 Account Details | `106-account-details.png`, `106-account-details-remove-hover.png`, `106-account-details-edit.png`, `106-account-details-edit-remove-hover.png` | Decided: the history's amounts signed in green and red (#132); "Not available" above "Remove" on hover (#134 c), "Remove" itself as drawn. Listed by earlier tasks: the demo data, the masked number (#25), the history's rows and Load More (#27), edit mode not designed (#26) |
| 107 Transactions | `107-transactions.png` | Decided: amounts red for expenses, green for income (`+$179.20`) (#132). Listed by earlier tasks: the demo rows and date, the wallet icon for income and Entertainment's icon for GTR 5 (#56) |
| 109 Expenses | `109-expenses.png`, `109-expenses-d2-open.png` | None new: the card line items unsigned in Secondary as before (#122 b); D2 open with the page unmoved |
| 110 Goals | `110-goals.png` | None new |
| 110.1 Goals popup | `110.1-goals-adjust-goal.png` | None new |
| 110.2 Goals popup | `110.2-goals-adjust-housing.png` | None new |
| 111 Settings | `111-settings.png`, `111-settings-d6-open.png` | None new: D6 open as task 028 built it |

Found and fixed during this check: the first captures put "Not available" above "Edit Accounts", where it covered the "Add Accounts" label, and above each card's "Remove", where it covered the card's "Total amount". Both now show under their control (`NotAvailableTooltip` `side="bottom"`); the e2e check of the tooltip's place now also checks that it covers no text or control on Balances. Figma calls: 0.
