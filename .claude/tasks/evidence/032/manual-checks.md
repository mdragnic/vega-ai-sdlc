# Task 032: manual browser checks

Playwright MCP (headed Chromium, classic 15 px scrollbar), the e2e backend on the fixed clock and Vite, a new demo user, Europe/Belgrade. The two servers this session started were ended by PID afterwards (ports 3000 and 5173 free).

## Every popup and dropdown, at 1440x720 (every page scrolls there, #135)

Each opened by a click and closed with Escape; `gap` is `innerWidth - clientWidth` (the drawn scrollbar), `search-right` the header search's right edge.

| Control | Closed | Open | Closed again |
|---------|--------|------|--------------|
| P1 Overview, Edit savings goal | gap 15, body 1425, search-right 1393, height 1143 | gap 0, body 1425, 1393, 1143 | as closed |
| D1 Overview, Statistics | gap 15, body 1425, 1393, 1143 | gap 0, body 1425, 1393, 1143 | as closed |
| P2 Goals, Adjust Goal | gap 15, body 1425, 1393, 781 | gap 0, body 1425, 1393, 781 | as closed |
| P3 Goals, each of the six categories' Adjust | gap 15, body 1425, 1393, 781 | gap 0, body 1425, 1393, 781 | as closed |
| D3 Goals, Savings Goal month | gap 15, body 1425, 1393, 781 | gap 0, body 1425, 1393, 781 | as closed |
| D4 Goals, Saving Summary month | gap 15, body 1425, 1393, 781 | gap 0, body 1425, 1393, 781 | as closed |
| D2 Expenses, Monthly Comparison | gap 15, body 1425, 1393, 1066 | gap 0, body 1425, 1393, 1066 | as closed |
| D5 Account Details edit mode, Account Type | gap 15, body 1425, 1393, 1368 | gap 0, body 1425, 1393, 1368 | as closed |
| D6 Settings, Country code | gap 15, body 1425, 1393, 784 | gap 0, body 1425, 1393, 784 | as closed |

Nothing moved; the thumb is hidden only while one is open (gap 0), as #134 b1 decided.

## Balances and Account Details: the controls that do nothing

- Tabbed through Balances: each card's "Remove" then "Details", then "Add Accounts" and "Edit Accounts"; the ring on each; "Not available" above "Add Accounts", under "Edit Accounts" and each "Remove", while focused; Escape hid it with focus kept.
- Hovered each: "Not available" shown, kept while moving onto it, gone after leaving; a click focused the control with no ring and changed nothing.
- Accessibility snapshot of Balances' main: six list items (five cards and the Add Accounts cell); `button "Remove" [disabled]` in each card, `button "Add Accounts" [disabled]`, `button "Edit Accounts" [disabled]`; each `aria-disabled="true"`, described by "Not available", `tabIndex` 0, no `title`.
- Account Details: `button "Edit Details"`, then `button "Remove" [disabled]`, described by "Not available"; in edit mode "Remove" after Cancel, the tooltip above it covering nothing.
