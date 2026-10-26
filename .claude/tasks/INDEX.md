# Task index

Status values: todo | in-progress | awaiting-human | done | blocked
`/next-task` picks the first task that is `todo` and whose dependencies are all `done`.

Order: foundation, shared display rules, shared components (used on 2+ screens), backend foundations (auth, sessions, demo seeding per #78), then one vertical slice per screen or widget. Screen tasks reuse the shared components and never rebuild them. Detailed so far: 000 to 014; the rest are outline rows, detailed by `/next-task` when picked. Every page is full width (#94): the screen tasks from 013 apply it to their card grids.

| Task | Title | Covers | Gate | Depends on | Status |
|------|-------|--------|------|------------|--------|
| 000 | Foundation: workspaces, tokens, assets, test harness, Clock and time zone | #4 #5 #54 #65 #66 #70 #73 #74 #79 #80 | human | - | done |
| 001 | Shared display rules: money, dates, percentages, names, amount input | #11 #19 #61 #62 #64 #74 #82 #84 | auto | 000 | done |
| 002 | Shared components: form controls, auth layout and dev gallery | US-01 to US-03 (controls), #6 #51 #63 #86 #87 | human | 000 | done |
| 003 | Shared components: app shell (sidebar, header, layout) | US-04 (visuals), #5 #38 #83 | human | 001, 002 | done |
| 004 | Shared components: section cards, tabs, data states, category icons, date and amount boxes | #6 #19 #56 #87 #88 (104 to 112); per-widget error boundary in the #6 error state | human | 001, 002 | done |
| 005 | Shared components: Popup, amount input, Dropdown | #31 #35 #60 #64 #69 #71 #84 #87 #90 (104.1, 110.1, 110.2; 106, 110, 111) | human | 001, 002, 003, 004 | done |
| 006 | Shared components: comparison bar chart and target vs achievement gauge | #6 #11 #18 #20 #29 #31 #55 #82 #86 #87 #89 #91 #92 #93 (104, 109, 110) | human | 001, 004 | done |
| 007 | Backend: users, sessions and auth API (sign up, login, logout, me, guard, CSRF) | US-01, US-02 (API), #3 #14 #15 #39 #46 #62 #63 #67 #74 #75 #78 #79 #80 #95 | human | 000 | done |
| 008 | Backend: data model, BankDataProvider, demo dataset generator and sign-up seeding | #1 #11 #24 #25 #39 #53 #54 #56 #57 #77 #78 #80 #85 #96, `demo-data.md`; `VisibleTransactions` (added at the start) | human | 007 | done |
| 009 | Login screen and route protection | US-01 (1 to 12, 14, 15), US-04 (12), #3 #14 #39 #74 #87 #95 #97 #98; return target a relative in-app path only; links get the #87 teal :focus-visible ring; ButtonPrimary loading keeps keyboard focus on the button (task 005 review: focus moved to the page body while saving) | human | 002, 007 | done |
| 010 | Sign up and Forgot Password screens | US-02 (1 to 8, 10 to 14), US-03, #1 #3 #15 #16 #37 #39 #51 #63 #65 #74 #78 #87 #95 #97 #99; reuse tasks 002, 007, 008 and 009, nothing redeclared; Google visual only until task 012 | human | 008, 009 | done |
| 011 | App shell slice: signed-in user, date, greeting, navigation, logout, unknown URLs | US-04, #3 #5 #9 #10 #38 #39 #47 #54 #62 #74 #80 #83 #87 #94 #97 #98 #100 #101; scrollbar-gutter: stable on the scroll container, so classic (Windows) scrollbars do not shift the header by 15px | human | 003, 009 | done |
| 012 | Google sign-in (against the fake Google client until a real one exists, #102) | US-01 (13, 16), US-02 (9, 15), #2 #3 #15 #39 #62 #63 #67 #74 #75 #78 #80 #81 #97 #102 #103 #104; returnTo a relative in-app path only, with the task 009 rule moved to shared for the backend | human | 010, 011 | done |
| 013 | Overview: page grid and Total Balance | US-05, #6 #11 #17 #24 #25 #39 #53 #54 #57 #74 #77 #87 #89 #93 #94 #96 #101 #105 #106 #107; all six Overview sections in the grid, only Total Balance filled; balances only through `VisibleTransactions`; numbers masked in the backend | human | 004, 008, 011 | done |
| 014 | Overview: Goals card and edit goal popup | US-06, #6 #11 #18 #31 #35 #39 #54 #58 #64 #69 #71 #74 #75 #80 #84 #85 #87 #88 #89 #90 #92 #94 #96 #97 #105 #106 #108; goal request schemas must reject negative amounts (moneySchema allows negatives); clear the mutation cache when a session ends; clear cached data when the signed-in user changes in another tab (task 009 review); the first write: user-scoped, session guard and Nest CSRF, integer cents with USD; only the goal queries invalidated after a save | human | 005, 006, 013 | todo |
| 015 | Overview: Upcoming Bill | US-07, #28 #48; compare `bills.due_date` with today as a `YYYY-MM-DD` string in the user's zone, never a `Date` parameter (it binds as `YYYY-MM-DD HH:MM:SS.SSS` and would drop the bill due today; task 008 review) | human | 004, 013 | todo |
| 016 | Overview: Recent Transaction | US-08, #19 #40 #49 #56 | human | 004, 013 | todo |
| 017 | Overview: Statistics (y-axis ticks in the backend) | US-09, #20 #55 #91 (empty message) #93 (header row) | human | 006, 013 | todo |
| 018 | Overview: Expenses Breakdown | US-10, #21 #61 | human | 004, 013 | todo |
| 019 | Balances: account list | US-11, #22 #23 #24 #50 | human | 013 | todo |
| 020 | Transactions: list, tabs and Load More | US-13, #19 #27 #57 | human | 016 | todo |
| 021 | Account Details: details and transaction history | US-12 (1 to 3, 10 to 17), #27 #39 #47 | human | 019, 020 | todo |
| 022 | Account Details: edit details | US-12 (4 to 9, 18), #26 #60; Dropdown id prop for a visible label (task 005 review) | human | 005, 021 | todo |
| 023 | Bills: upcoming bills table | US-14, #28 #41; `due_date` compared as a `YYYY-MM-DD` string, as in row 015 (task 008 review) | human | 015 | todo |
| 024 | Expenses: monthly comparison chart and category cards | US-15, #29 #55 #61 #91 (empty message) #93 (header row) | human | 017, 018 | todo |
| 025 | Goals: Savings Goal card, month selector and Adjust Goal popup | US-16 (1, 2, 4 to 6, 9, 11), US-17 (110.1), #30 #58 #60 | human | 014 | todo |
| 026 | Goals: Saving Summary chart | US-16 (3, 6, 12, 13), #42 #59 #68 #72 #93 (header row) | human | 017, 025 | todo |
| 027 | Goals: Expenses Goals by Category and Adjust popup | US-16 (7, 8, 10), US-17 (110.2), #32 | human | 025 | todo |
| 028 | Settings: Account tab profile fields | US-18 (1 to 5, 7 to 9, 11, 14, 15), #33 #43 #52 #62 | human | 004, 005, 011 | todo |
| 029 | Settings: profile photo upload | US-18 (6, 8 photo rule, 10, 12, 13), #44 #76 | human | 028 | todo |
| 030 | Settings: Security tab | US-19, #2 #34 | human | 028 | todo |

Open questions: none.
