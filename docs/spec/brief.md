# Finebank: product brief (DRAFT)

Status: draft written by `/write-spec` on 2026-10-22 from Figma metadata and the PNG exports in `docs/figma/`. Updated on 2026-10-22 to apply `docs/decisions.md` (general rule and #1 to #70, all closed, with #33 as changed by #62 and #13 as updated by #70). It becomes the spec only after human review.
Screens and node IDs: `docs/figma/inventory.md`. Components: `docs/figma/components.md`. Decisions: `docs/decisions.md`. Demo dataset: `docs/spec/demo-data.md`.

## Product summary

Finebank (branded "FINEbank.IO") is a desktop web dashboard for managing personal finances.
A signed-in user sees their total balance across accounts, recent transactions, upcoming bills, expenses by category, and savings goals in one place.
Each area has a section of its own: Balances (accounts and account details), Transactions, Bills, Expenses, Goals and Settings.
The user can set a monthly savings target and a monthly spending limit per expense category, and compare spending with earlier periods in charts (decisions #32).
The main goal is to give one person a clear overview of where their money is and where it goes.
The app has its own backend with a database and user accounts. All data comes from it, and every new user gets their own copy of a demo dataset on sign up, so the dashboard matches Figma on first login (decisions #1, #53).

## Users and their goals

The design shows one kind of user. No roles, admin screens or multi-user features are visible.

| User | Goals |
|------|-------|
| Visitor (signed out) | Sign in with email and password or with Google, create an account (decisions #2). The Forgot Password screen exists but is visual only (decisions #16) |
| Signed-in user | See total balance and accounts, review transactions and bills, understand spending by category, set and track savings goals and category spending limits, manage profile and password |

A user who signed up with Google only has no password. The only difference is that the password section in Settings, Security is hidden for them (decisions #2).

One user type, no roles. Every signed-in user sees only their own data (decisions #46).

## Scope rule

**No design, no feature** (decisions, general rule). Anything not designed in Figma is built visually as designed, with no behavior and no backend logic. Links between existing screens work. Exceptions only for what the app cannot work without: the states in decisions #6 and auth in decisions #2 and #3. Where a decision below adds behavior, it is cited.

## Feature list

1. **Authentication** (101, 102, 103):
   - Login with email and password; "Keep me signed in" keeps the session for 30 days, unchecked it ends when the browser closes (decisions #14)
   - "Continue with Google", with Google as the identity provider (decisions #2)
   - Sign up, active immediately, no email verification; the username is generated from the email (decisions #15, #62, #67)
   - After sign up and after Google sign-in, the session lasts 30 days (decisions #63)
   - Logout without a confirm dialog (decisions #3)
   - Forgot Password: built visually as designed, no email sent and no reset page (decisions #16)
2. **App shell**: dark sidebar with the logo in white (decisions #66, #70), 7 sections, Logout and a profile block. "View profile" opens Settings, Account tab; the three-dot icon is visual only (decisions #9). Header with today's date and, on Overview only, a greeting with the user's first name, the first word of their Full Name (decisions #10, #62). The "»" icon, the notification bell and the search field are visual only (decisions #7, #8, #10).
3. **Overview dashboard** (104, 104.1):
   - Total Balance (sum of all accounts) with an account carousel, one slide per account (decisions #17)
   - Goals card for the current month with a target vs achievement gauge and an edit popup; "No goal for this month" when the month has none (decisions #18, #58)
   - Upcoming Bill: the next 2 upcoming bills (decisions #28)
   - Recent Transaction with All / Revenue / Expenses tabs, the latest 5 per tab, newest first (decisions #19, #40)
   - Statistics: expenses per day, this week vs last week, as a bar chart (decisions #20, #55)
   - Expenses Breakdown: all 6 categories, this month's total and the change vs last month (decisions #21, #61)
4. **Balances** (105): one account card per account with type, Bank Name, masked number, balance, Remove and Details (decisions #57). Add Accounts, Edit Accounts and Remove are visual only (decisions #22, #23).
5. **Account Details** (106): bank, type, balance, branch and number. Edit Details edits Bank Name, Branch Name and Account Type on the same page; Account Type uses the shared Dropdown (decisions #26, #60). Remove is visual only (decisions #23). A Transactions History table of this account's transactions, with Load More (decisions #27, #57).
6. **Transactions** (107): transaction table with All / Revenue / Expenses tabs and Load More. Payment Method is the type of the transaction's account (decisions #19, #27, #57).
7. **Bills** (108): upcoming bills table (due date today or later, soonest due first, not paginated; past bills are not shown) with due date, logo, description, last charge and amount. No bill actions (decisions #28, #41).
8. **Expenses** (109): total expenses per month, this year vs last year, as a bar chart (decisions #29, #55), plus breakdown cards for all 6 categories with a change vs last month and the 2 most recent Complete expenses of the current month (decisions #29, #61).
9. **Goals** (110, 110.1, 110.2):
   - Savings goal of the selected month (at most one per month) with a month selector, gauge and "Adjust Goal" (decisions #30, #31, #58, #60)
   - Saving Summary line chart of daily savings (income minus expenses per day, decisions #59), with its own month selector (decisions #30, #60), and a dashed line for the same days of the month before (decisions #42)
   - A monthly spending limit per expense category with "Adjust" (decisions #32)
   - Adjust popups (decisions #31)
10. **Settings** (111, 112):
    - Account tab: full name, email (read-only), username (editable, decisions #62), phone with a country code dropdown (decisions #43, #60), profile picture upload showing the current photo (decisions #44), Update Profile with a "Profile updated" message (decisions #33, #52)
    - Security tab: old, new and retype password, phone (read-only), Update Password. The password section is hidden for Google-only users (decisions #2, #34)

## Screen flow

```
Auth (signed out)
  101 Login ──"Create an account"──> 102 Signup ──"Sign in here"──> 101 Login
  101 Login ──"Forgot Password?"──> 103 Forgot Password ──"Back to login"──> 101 Login
  103 Forgot Password ──"Password Reset"──> no action, visual only     (decisions #16)
  101 Login ──submit──> the app page the user asked for, else 104 Overview (decisions #3)
  102 Signup ──submit──> 104 Overview                                (decisions #3, #15)
  101 Login / 102 Signup ──"Continue with Google"──> Google sign-in    (decisions #2)
  Google sign-in cancelled ──> 101 Login, no message                 (decisions #81)
  Google sign-in failed ──> 101 Login, error above the Login button  (decisions #81)
  Signed out, any app URL ──> 101 Login                              (decisions #3)
  Signed in, 101 Login or 102 Signup ──> 104 Overview                (decisions #3)
  Unknown URL ──> 104 Overview, or 101 Login when signed out         (decisions #3, #39)

App (signed in). The sidebar is on every screen:
  Overview -> 104   Balances -> 105   Transactions -> 107   Bills -> 108
  Expenses -> 109   Goals -> 110      Settings -> 111
  Logout -> 101, no confirm dialog                           (decisions #3)
  Profile block "View profile" -> 111 Settings, Account tab  (decisions #9)

104 Overview
  Total Balance "All Accounts" ──> 105 Balances              (decisions #17)
  Goals card pencil icon ──> 104.1 popup                     (decisions #18)
  Upcoming Bill "View All" ──> 108 Bills                     (decisions #48)
  Recent Transaction "View All" ──> 107 Transactions         (decisions #49)
  Expenses Breakdown item arrow ──> 109 Expenses             (decisions #21)
105 Balances
  card "Details" ──> 106 Account Details                     (decisions #50)
  "Add Accounts" / "Edit Accounts" / "Remove" ──> no action, visual only (decisions #22, #23)
106 Account Details
  "Edit Details" ──> edit mode on the same page              (decisions #26)
  "Remove" ──> no action, visual only (decisions #23). Back: sidebar only (decisions #26)
  account not found or another user's ──> 105 Balances      (decisions #39)
110 Goals
  "Adjust Goal" ──> 110.1 popup (Target + Present Amounts) for the selected month (decisions #31, #58)
  category "Adjust" ──> 110.2 popup (Target Amounts only)    (decisions #31)
111 Settings Account <──tabs──> 112 Settings Security
```

Popups close with X, Esc or a click on the dimmed backdrop, and unsaved changes are discarded. While a popup is open the whole page, sidebar and header included, is blocked, and keyboard focus stays inside the popup (decisions #35).

## Global rules

### Viewports
- Desktop only. There is no mobile or tablet layout (decisions #4).
- The visual reference is 1440x1024, the size of every Figma frame (decisions #5).
- The sidebar stays fixed and the content scrolls (decisions #5).

### Layout
- App screens: a fixed dark sidebar (280px) on the left, a header (88px) at the top, and content on a light gray background (`F3F3F3` family). Content sits in white cards with rounded corners.
- Auth screens: a centered form column (400px wide) on a light gray background, with no sidebar.
- Popups: a white rounded modal, centered over the content area. The overlay dims the content area only, as designed, but the whole page is blocked while a popup is open (104.1, 110.1, 110.2; decisions #35).

### Design system
- Tokens shown on the Components page (`418:6459`):
  - 5 font weights
  - Type scale 12/16, 14/20, 16/24, 18/24, 20/28, 22/32, 24/28
  - Colors `299D91` (primary), `191919`, `525256`, `666666`, `878787`, `9F9F9F`, `E8E8E8`, `F3F3F3`
  - Special colors `E73D1C` (red, increase), `4DAF6E` (green, decrease), `D2D2D2` at 25%, `FFFFFF` at 70% and at 8%
- Token source: colors, typography and effects come from one approved `get_variable_defs` call on the Typography & Color frame `418:6459` during Task 000 (Figma budget rule in CLAUDE.md). Spacing, radius and shadow values not defined there are measured from the PNGs and rounded to a 4px grid. All tokens go to `docs/figma/tokens.md`, reviewed before Task 000 continues, and every task uses them (decisions #65).
- UI font: Inter (decisions #13).
- Logo: exported from Figma as SVG to `docs/figma/assets/logo.svg`, not live text. Task 000 copies it into the app (decisions #13, #45). It is embedded as an inline SVG in code with `fill="currentColor"`, not loaded with an `<img>` tag, so one file renders white in the sidebar and primary teal on Login, Sign up and Forgot Password, colored by token (decisions #66, #70). This updates "used as an image" in decisions #13 (decisions #70).
- Icons, card-network logos (Mastercard, VISA) and biller logos (Figma, Adobe) are exported manually from the Figma components page as SVG, with no MCP calls, into `docs/figma/assets/icon/`, navigation icons in `docs/figma/assets/icon/Menu/`, file name = Figma name. Task 000 copies them into the app. Lucide is used only for an icon missing from the export (decisions #66). The Google icon is exported from Figma into `docs/figma/assets/icon/`, or the official Google G SVG is used. The `Menu/` folder name stays (decisions #70).
- 73 components: 5 component sets and 68 standalone, of which 44 are icons. Full map: `docs/figma/components.md`.
- Code component names: the Figma name in PascalCase, with spelling fixed (Trasnport becomes Transport). Where several Figma components share a name, the code name adds the purpose (e.g. HeaderSearch, TableSearch). The "Code name" column in `docs/figma/components.md` is filled once and used by every task (decisions #36).
- One shared Dropdown code component draws every open dropdown list from tokens (Popup radius and shadow): the Goals period selectors, Account Type and the phone country code. No dropdown's open state is designed and no Figma component exists for it (decisions #60).
- 11 of 15 screens (102, 103, 106 to 112) are flattened images in Figma and no layered source exists. They are built from their PNG exports in `docs/figma/` plus components and tokens from the components page, and visual validation compares against the PNGs (decisions #37).

### Data
- All data (profile, accounts, balances, transactions, bills, expenses, goals) comes from the app's own backend. The data model follows the Figma screens. Account and transaction data can be swapped for an external bank API later. Technology is decided at /set-stack (decisions #1).
- Every new user gets their own copy of the demo dataset on sign up, including a new user created through Google (decisions #1, #2, #53). It is described in `docs/spec/demo-data.md`.
- Demo dates and values are fixed, not relative to sign up, and cover 2022 to 2028, so current periods always have data; there is no rolling or regeneration. Entries dated after today are not shown or counted yet. Bills are the exception: future due dates are what "upcoming" means, and a bill drops off once its due date passes. The set has income and expense transactions and more than 10 transactions on every account, so the Revenue tab and "Load More" show (decisions #53).
- The demo dataset is one consistent set: each entity exists once and every screen shows the same values. Where Figma conflicts, the value from the entity's own detail screen wins (Transactions, Expenses, Bills, Balances); between Transactions and Expenses, Transactions wins. Totals and summaries are calculated from the data, so they may differ from the numbers drawn in Figma. Visual checks compare layout and style, not demo numbers (decisions #12, #56).
- Transactions: every transaction belongs to exactly one of the user's accounts and has a direction, income or expense (decisions #19, #57). An expense has exactly one of 6 fixed categories, the same for every user: Housing, Food, Transportation, Entertainment, Shopping, Others. Income has no category and uses the wallet icon. A row's icon is its category icon; GTR 5 is Entertainment, a known difference from Figma's gamepad icon. Every expense figure (Expenses page, Expenses Breakdown, category goals, Statistics, Expenses chart) is a sum of expense transactions. There is no "Bills" category: each bill maps to an existing one (rent to Housing, subscriptions to Entertainment or Others), and once a bill's due date passes the demo data has its matching expense transaction (decisions #56).
- Accounts: balance = opening balance + all Complete transactions of that account, calculated in the backend, so balances, Total Balance and the transaction history always reconcile. All statuses (Complete, Pending, Failed) are listed; only Complete transactions count in balances, totals, charts and percentages. Payment Method shows the type of the linked account, so it follows an Account Type edit. The name on a Balances card is the Bank Name edited on Account Details (decisions #57).
- Savings goals: each month has at most one. The Overview widget and its pencil use the current month; the Goals page uses the month picked in its top selector, past months included. A month with no goal shows "No goal for this month" and keeps the pencil and "Adjust Goal"; the popup then opens with both fields empty, showing the `$` prefix; Target has no placeholder (decisions #69), and Present Amount shows its designed placeholder "Write present amount here", as it does whenever it is empty (decisions #71). Target is required, and saving creates the goal for that month. Nothing is copied from the previous month. The demo dataset has a goal for every month up to the current one (decisions #58).
- Saving Summary: a day's saving = Complete income minus Complete expenses on that day, calculated in the backend from transactions; it can be negative. The "Same period last month" line uses the same calculation. Present Amount stays entered by the user and is not linked to it (decisions #59).
- Profile: the username is generated at sign up from the part of the email before `@`, lowercased (decisions #62). Characters the username rules do not allow are removed (`marko-d` becomes `markod`), the result is cut to 26 characters, digits are added until it has at least 3 characters (`jo` becomes `jo1`), and then, if taken, the uniqueness number is added (`marko`, `marko2`). The result always passes the username rules (decisions #67). The user can change it in Settings: 3 to 30 characters, lowercase letters, numbers, dot and underscore, unique. First name = first word of Full Name. Initials = first letter of the first and last word, uppercase; one word gives one letter. A new Google user gets the name from their Google profile, with the same rules (decisions #62).
- The backend masks account and card numbers and never returns full numbers. One format everywhere: `**** **** **** 2598` (decisions #25).

### Money and dates
- Backend: money is stored and calculated exactly, never as floating point, with a currency code (USD) on every amount. All totals, sums and percentages are calculated in the backend; the frontend only displays them. Timestamps are stored in UTC, due dates and other calendar dates as plain dates (decisions #11).
- Display, locale en-US: amounts `$25,056.00` everywhere, including headline totals; dates `17 May, 2023`; month labels `May, 2023` (decisions #11).
- Compact format only on chart axes and goal gauges: thousands with one decimal, rounded down, `.0` dropped (`$12,500` shows `$12.5k`, `$12,580` shows `$12.5k`, `$20,000` shows `$20k`); under 1,000 shown exactly (`$999`). Compact is display only (decisions #11).
- Transaction amounts show a sign wherever they are listed: income `+$160.00`, expense `-$160.00`. Colours stay as designed (decisions #19).
- Percentages are whole numbers without a leading zero: `8%`, `15%`, `120%` (Figma's `08%` is a design artifact). A change of 0%, or one that rounds to 0%, shows `0%` with no arrow (decisions #61).
- Amount inputs look as designed: `$500000`, with the `$` directly before the number, no space and no thousands separators. The `$` is shown by the input, not typed. The user types digits and an optional decimal point, max 2 decimals; typed commas are rejected. Prefilled values show decimals only when not zero (`$500000`, `$1250.50`). Outside inputs, amounts use the display format above (`$500,000.00`) (decisions #64).
- Full dates have no leading zero: `1 May, 2026`, `17 May, 2023`. In amount inputs a lone `.` is allowed while typing (so `.5` can be typed) and on save counts as an empty field (decisions #84).
- Time zone: the browser's. The frontend sends its IANA name (e.g. `Europe/Belgrade`) with each request, and the backend uses it for "today" and every period boundary (header date, upcoming bills, Statistics, Expenses Breakdown, Expenses chart, the Goals default month and the months that cannot be selected) and for the dates shown for transactions. Weeks run Monday to Sunday (decisions #20). Stored timestamps stay in UTC (decisions #11). No time zone setting in the UI. Tests run with a fixed clock and time zone (decisions #54).

### Charts
- Applies to Statistics (decisions #20), the Expenses chart (decisions #29) and Saving Summary (decisions #42) (decisions #55):
  - Days or months after today show no bar or point. Their axis labels stay, and earlier periods are drawn in full.
  - Y-axis: 5 labels, $0 and 4 equal steps. The top is the smallest "nice" value (1, 2, 2.5 or 5 times a power of 10) at or above the highest value. Compact format (decisions #11).
  - Exception: Saving Summary extends below $0 when a day is negative (decisions #59). The same step size as above $0 continues downward, so there can be more than 5 labels (e.g. -$500, $0, $500) (decisions #68). When no day is above $0 but not all are $0, the top label is $0 and the steps go downward, sized from the lowest value with the "nice" value rule above (decisions #72).
  - If all values in the period are 0, the chart shows the empty state (decisions #6).
  - Month labels are always 3 letters (Jan ... Jul ... Dec).

### States
- One shared pattern for all widgets, lists, tables and charts, built from existing design tokens and components (decisions #6):
  - Loading: a skeleton matching the widget's shape
  - Empty: a short message in the widget ("No transactions yet"), no illustration
  - Error: a message in the widget with a Retry button; one failing widget does not break the rest of the page
- Forms: the submit button is disabled with a spinner while saving; field errors show inline under the field, server errors above the submit button (decisions #6).

## Not designed

Things a real product needs that Figma does not show, and how the decisions handle them:

- **Auth**:
  - Validation and error messages on all forms: decided (decisions #14, #15)
  - Wrong-credentials state: one generic message above the Login button (decisions #14)
  - Loading state on submit: forms pattern (decisions #6)
  - Forgot password success state and the reset-password page: out of scope until designed (decisions #16)
  - The Google sign-in flow: Google is the identity provider (decisions #2)
  - Google sign-in cancelled or failed: a cancel returns to Login with no message; a failure returns to Login with "Google sign-in failed. Please try again." above the Login button (decisions #81)
  - The terms of service page: none, the link is visual only (decisions #15)
  - Brute-force protection: out of scope for now (decisions #14)
  - Focus style: the active (darker) border shows only while a field has focus; filled fields keep the normal border, as in the PNGs (decisions #63)
  - Empty-field placeholders: fields without placeholder text in the design stay without one (decisions #63)
- **Session**: route protection, post-login and post-logout destinations, and no logout confirmation (decisions #3). Session length: on Login it follows "Keep me signed in" (decisions #14); after sign up and after Google sign-in (on Login or Sign up) it is 30 days (decisions #63).
- **Data states**: the shared pattern (decisions #6).
- **Feedback**: server errors above the submit button (decisions #6). "Password updated" after Update Password (decisions #34). After popup Save the page shows the new values (decisions #18, #31); after Edit Details Save the page returns to view mode (decisions #26). "Profile updated" after Update Profile, the same pattern (decisions #52). Remove is visual only (decisions #23).
- **Accounts**: Add Accounts, Edit Accounts and Remove are visual only (decisions #22, #23). Edit Details edits in place (decisions #26).
- **Header**: search (decisions #7) and notifications (decisions #8) are visual only. "View profile" opens Settings and the three-dot icon is visual only (decisions #9).
- **Dropdowns**: "Weekly Comparison" and "Monthly Comparison" have no other options (decisions #20, #29). Each Goals period selector is one control per card, keeping its own Figma style, showing the selected month (`Mar, 2026`); it opens one list of months, newest first, from the current month back to the user's earliest data, and future months are not listed. This replaces the month and year pick lists of decisions #30, with the same behavior. Open dropdown lists are not designed: the shared Dropdown component draws them (decisions #60).
- **Charts**: no tooltips (decisions #20). No other chart interaction (decisions, general rule). Future periods, y-axis labels, all-zero data and month labels follow the chart rules above (decisions #55).
- **Lists**: Load More loads 10 rows, shows the loading pattern and is hidden at the end of the list (decisions #27). Overview Upcoming Bill shows the next 2 bills (decisions #28). Overview Recent Transaction shows the latest 5 rows of each tab, newest first (decisions #40). The Bills page lists only upcoming bills (due date today or later), soonest due first, not paginated; past bills are not shown. This refines decisions #28 (decisions #41). Expenses Breakdown always shows all 6 categories, `$0.00` for a category with no expenses this month. Each Expenses page card lists the 2 most recent Complete expenses of its category in the current month, or "No expenses this month" (decisions #61).
- **Goals**: a month with no savings goal shows "No goal for this month", and the popup opens with both fields empty, showing the `$` prefix; Target has no placeholder (decisions #58, #69), and Present Amount shows its designed placeholder "Write present amount here" (decisions #71).
- **Tabs**: the Revenue and Expenses active states use the style of the designed active "All" tab (decisions #19).
- **Interaction states**: hover, focus and disabled states are not designed for most elements. Exceptions: nav items (Active/Inactive/Hover), inputs (Active Yes/No), Remind me (checked/unchecked) and Button/primary (Active Yes/No) have them as component variants; the Expenses Breakdown arrow hover (decisions #21); Previous and Next disabled in the Total Balance carousel (decisions #17). Everything else is built as designed (decisions, general rule).
- **Responsive**: none, desktop only (decisions #4).
- **Charts (Goals)**: Saving Summary shows the dashed "Same period last month" line: daily savings on the same days of the month before the selected month, where a day's saving is Complete income minus Complete expenses (decisions #42, #59). Y-axis per the chart rules above, extending below $0 with the same step size when a day is negative (decisions #68); when no day is above $0 but not all are $0, the top label is $0 and the steps go downward (decisions #72). X-axis labels in short day format `01 May` (decisions #11, #20, #42, #55, #59).
- **Settings**: the country code dropdown lists all countries, each option showing only the code (`+880`), default +1 for a new user (decisions #43). Username is editable, with an inline error "This username is already taken" when it is not unique (decisions #33, #62).
- **Time zone**: no setting is designed; the browser's time zone is used (decisions #54). The upload box shows the current photo when one is uploaded, otherwise it is empty as designed; a newly chosen file is not previewed, and the photo and sidebar avatar update after "Update Profile" saves (decisions #44).
- **Other**: no not-found page. Unknown URLs go to Overview, or to Login when signed out; an Account Details URL for an account that does not exist or belongs to another user redirects to Balances, and another user's data is never returned or shown (decisions #39). Without a profile photo, the avatar is a circle with the user's initials, using design tokens; the demo dataset has no photo (decisions #38).

## Assumptions

None. The earlier assumptions are now decided:
- One user type, no roles; every signed-in user sees only their own data (decisions #46).
- The sidebar and header show on every app frame (104 to 112). The active nav item shows the current section, and on Account Details "Balances" is active (decisions #47).
- Upcoming Bill "View All" opens Bills (decisions #48), Recent Transaction "View All" opens Transactions (decisions #49), and a Balances card's "Details" opens that account's Account Details (decisions #50).
