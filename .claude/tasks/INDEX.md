# Task index

Status values: todo | in-progress | awaiting-human | done | blocked
`/next-task` picks the first task that is `todo` and whose dependencies are all `done`.

Order: foundation, shared display rules, shared components (used on 2+ screens), backend foundations (auth, sessions, demo seeding per #78), then one vertical slice per screen or widget. Screen tasks reuse the shared components and never rebuild them. Detailed so far: 000 to 003; the rest are outline rows, detailed by `/next-task` when picked.

| Task | Title | Covers | Gate | Depends on | Status |
|------|-------|--------|------|------------|--------|
| 000 | Foundation: workspaces, tokens, assets, test harness, Clock and time zone | #4 #5 #54 #65 #66 #70 #73 #74 #79 #80 | human | - | done |
| 001 | Shared display rules: money, dates, percentages, names, amount input | #11 #19 #61 #62 #64 #74 #82 #84 | auto | 000 | done |
| 002 | Shared components: form controls, auth layout and dev gallery | US-01 to US-03 (controls), #6 #51 #63 #86 #87 | human | 000 | done |
| 003 | Shared components: app shell (sidebar, header, layout) | US-04 (visuals), #5 #38 #83 | human | 001, 002 | todo |
| 004 | Shared components: section cards, tabs, data states, category icons, date and amount boxes | #6 #19 #56 (104 to 112) | human | 001, 002 | todo |
| 005 | Shared components: Popup, amount input, Dropdown | #31 #35 #60 #64 #69 #71 (104.1, 110.1, 110.2; 106, 110, 111) | human | 001, 002 | todo |
| 006 | Shared components: comparison bar chart and target vs achievement gauge | #11 #20 #29 #55 (104, 109, 110) | human | 001, 004 | todo |
| 007 | Backend: users, sessions and auth API (sign up, login, logout, me, guard, CSRF) | US-01, US-02 (API), #14 #15 #46 #62 #63 #67 #75 | human | 000 | todo |
| 008 | Backend: data model, BankDataProvider, demo dataset generator and sign-up seeding | #1 #24 #53 #56 #57 #77 #78, `demo-data.md` | human | 007 | todo |
| 009 | Login screen and route protection | US-01 (1 to 12, 14, 15), US-04 (12), #3 #14 #39; links get the #87 teal :focus-visible ring | human | 002, 007 | todo |
| 010 | Sign up and Forgot Password screens | US-02 (1 to 8, 10 to 14), US-03, #15 #16 | human | 008, 009 | todo |
| 011 | App shell slice: signed-in user, date, greeting, navigation, logout, unknown URLs | US-04, #3 #9 #10 #38 #39 #47 #54 | human | 003, 009 | todo |
| 012 | Google sign-in (needs the Google OAuth client, #75) | US-01 (13, 16), US-02 (9, 15), #2 #63 #75 #81 | human | 010, 011 | todo |
| 013 | Overview: page grid and Total Balance | US-05, #17 #25 #57 | human | 004, 008, 011 | todo |
| 014 | Overview: Goals card and edit goal popup | US-06, #18 #31 #58 #64 #69 #71 #85; goal request schemas must reject negative amounts (moneySchema allows negatives) | human | 005, 006, 013 | todo |
| 015 | Overview: Upcoming Bill | US-07, #28 #48 | human | 004, 013 | todo |
| 016 | Overview: Recent Transaction | US-08, #19 #40 #49 #56 | human | 004, 013 | todo |
| 017 | Overview: Statistics (y-axis ticks in the backend) | US-09, #20 #55 | human | 006, 013 | todo |
| 018 | Overview: Expenses Breakdown | US-10, #21 #61 | human | 004, 013 | todo |
| 019 | Balances: account list | US-11, #22 #23 #24 #50 | human | 013 | todo |
| 020 | Transactions: list, tabs and Load More | US-13, #19 #27 #57 | human | 016 | todo |
| 021 | Account Details: details and transaction history | US-12 (1 to 3, 10 to 17), #27 #39 #47 | human | 019, 020 | todo |
| 022 | Account Details: edit details | US-12 (4 to 9, 18), #26 #60 | human | 005, 021 | todo |
| 023 | Bills: upcoming bills table | US-14, #28 #41 | human | 015 | todo |
| 024 | Expenses: monthly comparison chart and category cards | US-15, #29 #55 #61 | human | 017, 018 | todo |
| 025 | Goals: Savings Goal card, month selector and Adjust Goal popup | US-16 (1, 2, 4 to 6, 9, 11), US-17 (110.1), #30 #58 #60 | human | 014 | todo |
| 026 | Goals: Saving Summary chart | US-16 (3, 6, 12, 13), #42 #59 #68 #72 | human | 017, 025 | todo |
| 027 | Goals: Expenses Goals by Category and Adjust popup | US-16 (7, 8, 10), US-17 (110.2), #32 | human | 025 | todo |
| 028 | Settings: Account tab profile fields | US-18 (1 to 5, 7 to 9, 11, 14, 15), #33 #43 #52 #62 | human | 005, 011 | todo |
| 029 | Settings: profile photo upload | US-18 (6, 8 photo rule, 10, 12, 13), #44 #76 | human | 028 | todo |
| 030 | Settings: Security tab | US-19, #2 #34 | human | 028 | todo |

Open questions: none.
