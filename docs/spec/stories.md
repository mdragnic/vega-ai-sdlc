# Finebank: user stories (DRAFT)

Status: draft written by `/write-spec` on 2026-10-22. Updated on 2026-10-22 to apply `docs/decisions.md` (general rule and #1 to #70, all closed, with #33 as changed by #62 and #13 as updated by #70). It becomes the spec only after human review.
Format: `.claude/templates/story.md`. Screens and node IDs: `docs/figma/inventory.md`. Decisions: `docs/decisions.md`. Demo dataset: `docs/spec/demo-data.md`.

Rules for every story (details in `docs/spec/brief.md`, Global rules):
- No design, no feature: anything not designed in Figma is built visually as designed, with no behavior and no backend logic. Links between existing screens work. Exceptions only for the states in #6 and auth in #2 and #3 (decisions, general rule). Where a story adds behavior, the decision is cited.
- Desktop only, viewport 1440x1024, sidebar fixed and content scrolls. Every story lists mobile as "none" (decisions #4, #5).
- All data comes from the backend. Every new user gets their own copy of the demo dataset on sign up, described in `docs/spec/demo-data.md` (decisions #1, #53). Values marked "sample" are the Figma values, written in the display formats; the demo dataset has its own dates and amounts. The demo dataset is consistent across screens: where Figma conflicts, the entity's own detail screen wins, and between Transactions and Expenses, Transactions wins. Totals are calculated, so they may differ from Figma. Visual checks compare layout and style, not demo numbers (decisions #12, #56).
- Demo dates are fixed and cover 2022 to 2028. Entries dated after today are not shown or counted anywhere. Bills are the exception: their future due dates are what "upcoming" means, and a bill drops off once its due date passes (decisions #53).
- "Today", every period boundary (this week, this month, this year) and the dates shown for transactions use the browser's time zone. The frontend sends its IANA name (e.g. `Europe/Belgrade`) with each request and the backend uses it. Weeks run Monday to Sunday. Timestamps stay stored in UTC, and there is no time zone setting in the UI. Tests run with a fixed clock and time zone (decisions #54).
- Every transaction belongs to exactly one of the user's accounts. An expense is a transaction with direction "expense" and exactly one of the 6 fixed categories (Housing, Food, Transportation, Entertainment, Shopping, Others), the same for every user; income has no category. Every expense figure is a sum of expense transactions (decisions #56, #57).
- All statuses (Complete, Pending, Failed) are listed. Only Complete transactions count in balances, totals, charts and percentages (decisions #57).
- Amounts display as `$25,056.00`, dates as `17 May, 2023`, month labels as `May, 2023`. Compact format (`$12.5k`) only on chart axes and goal gauges. Sample values below are written in these formats (decisions #11).
- Every widget, list, table and chart uses the shared loading, empty and error pattern. Every form disables its submit button with a spinner while saving, shows field errors inline under the field and server errors above the submit button (decisions #6).
- Design tokens come from `docs/figma/tokens.md`, written and reviewed during Task 000 (decisions #65). Icons, card-network logos and biller logos come from the SVG exports in `docs/figma/assets/icon/`, navigation icons in its `Menu/` folder, a name that stays; Lucide is used only for an icon missing from the export (decisions #66, #70). The Google icon is exported from Figma into `docs/figma/assets/icon/`, or the official Google G SVG is used (decisions #70). The logo is embedded as an inline SVG in code with `fill="currentColor"`, not loaded with an `<img>` tag, so one file renders white or teal by token (decisions #70).

---

## US-01: Log in

- Figma: desktop `137:7477`, mobile none (decisions #4) (screenshots: `docs/figma/101. Login.png`)
- Story: As a returning user I want to sign in with my email and password so that I can reach my financial dashboard.

Acceptance criteria:
1. Given I open the login screen, when it renders, then I see, top to bottom:
   - the "FINEbank.IO" logo, in primary teal (decisions #66, #70)
   - an "Email Address" field
   - a "Password" field with a "Forgot Password?" link to the right of its label
   - a "Keep me signed in" checkbox
   - a "Login" primary button
   - an "or sign in with" divider
   - a "Continue with Google" secondary button with the Google icon (decisions #70)
   - a "Create an account" link
2. Given the password field, when I type, then the characters are masked and an eye icon shows at the right edge.
3. Given the password field, when I click the eye icon, then the password switches between masked and visible. This is frontend only (decisions #51).
4. Given the login screen opens, then "Keep me signed in" is checked by default. When I click it, it switches between checked (teal with a white check) and unchecked (decisions #14).
5. Given a field has focus, then it shows the active input style (darker border), as on the email field in the design. A filled field without focus keeps the normal border, as on the password field in the design (decisions #63).
6. Given I click "Forgot Password?", then the Forgot Password screen opens (US-03).
7. Given I click "Create an account", then the Sign up screen opens (US-02).
8. Given I entered a registered email and its password, when I click "Login", then I am signed in and the app page I originally asked for opens, or Overview (US-05) if I did not ask for one (decisions #3).
9. Given Email is empty or not a valid email format, or Password is empty, when I click "Login", then the form is not submitted and the error shows inline under that field (decisions #14).
10. Given the email or the password is wrong, when I click "Login", then I stay on Login and "Email or password is incorrect" shows above the Login button, without saying which one is wrong (decisions #14).
11. Given I submitted the form, while the request runs, then the Login button is disabled and shows a spinner. If the server fails, its error shows above the Login button (decisions #6).
12. Given "Keep me signed in" was checked when I logged in, then my session lasts 30 days. Given it was unchecked, then my session ends when the browser closes (decisions #14).
13. Given I click "Continue with Google", then I sign in with my Google account, with Google as the identity provider, and land as in criterion 8. A Google account is matched to a user by email; a new email creates a user with the demo dataset, the name from the Google profile and a generated username, as in Sign up (US-02, criterion 12) (decisions #2, #3, #62). The session lasts 30 days, the same as Login with "Keep me signed in" checked (decisions #63).
14. Given I am already signed in, when I open the Login screen, then Overview opens (decisions #3).
15. Given the Email or Password field is empty, then it shows no placeholder text, since none is designed (decisions #63).
16. Given I clicked "Continue with Google", when I cancel the Google sign-in, then I return to Login with no message. When the Google sign-in fails, then I return to Login and "Google sign-in failed. Please try again." shows above the Login button (decisions #81).

States:
- Designed: default; email focused and filled (Input Active=Yes, the focus style, decisions #63); password filled and masked (Input Type=Password, normal border); checkbox checked (Remind me Active=Yes). Component variants also exist for Show Password and checkbox unchecked.
- Missing from design: validation errors and wrong credentials (decisions #14), loading while signing in (decisions #6), Google sign-in flow and its session length (decisions #2, #63), Google sign-in cancelled or failed (decisions #81), empty fields (no placeholder, decisions #63)

Out of scope: brute-force protection such as lockout after failed attempts (decisions #14). The auth technology, chosen at /set-stack (decisions #2).
Assumptions: none
Open questions: none

---

## US-02: Sign up

- Figma: desktop `137:8071`, mobile none (decisions #4) (screenshots: `docs/figma/102. Signup.png`)
- Story: As a new visitor I want to create an account so that I can start using the dashboard.

Acceptance criteria:
1. Given I open the sign up screen, when it renders, then I see, top to bottom:
   - the "FINEbank.IO" logo, in primary teal (decisions #66, #70)
   - the heading "Create an account"
   - a "Name" field
   - an "Email Address" field with placeholder "hello@example.com"
   - a "Password" field (masked, with an eye icon)
   - the text "By continuing, you agree to our terms of service.", where "terms of service." is a teal link
   - a "Sign up" primary button
   - an "or sign up with" divider
   - a "Continue with Google" button
   - the text "Already have an account? Sign in here", where "Sign in here" is a teal link
2. Given the password field, when I click the eye icon, then the password switches between masked and visible. This is frontend only (decisions #51).
3. Given I click "Sign in here", then the Login screen opens (US-01).
4. Given all fields are valid and the email is not registered, when I click "Sign up", then my account is created and active immediately, with no email verification, I am signed in for 30 days, and Overview opens with the demo dataset (US-05) (decisions #1, #3, #15, #63).
5. Given a field breaks its rule, when I click "Sign up", then the form is not submitted and the error shows inline under that field. Rules: Name required, max 100 characters; Email required and a valid format; Password at least 8 characters with at least one letter and one number (decisions #15).
6. Given the email is already registered, when I click "Sign up", then "An account with this email already exists" shows inline under Email, with the "Sign in here" link as designed (decisions #15).
7. Given I sign up with an email that has capital letters, then it is stored in lowercase (decisions #15).
8. Given I submitted the form, while the request runs, then "Sign up" is disabled and shows a spinner. If the server fails, its error shows above "Sign up" (decisions #6).
9. Given I click "Continue with Google", then I sign in with my Google account, Overview opens and the session lasts 30 days (decisions #63). An existing user is matched by email; a new email creates a user with the demo dataset, the name from the Google profile and a username generated as in criterion 12 (decisions #2, #3, #62).
10. Given I click "terms of service.", then nothing happens: the link is visual only (decisions #15).
11. Given I am already signed in, when I open the Sign up screen, then Overview opens (decisions #3).
12. Given my account is created, then my username is made from the part of my email before `@`, lowercased (decisions #62). Characters the username rules do not allow are removed (`marko-d` becomes `markod`), the result is cut to 26 characters, and digits are added until it has at least 3 characters (`jo` becomes `jo1`). If that username is already taken, the uniqueness number is added (`marko`, then `marko2`). The result always passes the username rules in Settings (US-18), where I can change it later (decisions #62, #67).
13. Given a field has focus, then it shows the active input style (darker border), as on Name in the design. A filled field without focus keeps the normal border (decisions #63).
14. Given the Name or Password field is empty, then it shows no placeholder text, since none is designed. Email shows its designed placeholder "hello@example.com" (decisions #63).
15. Given I clicked "Continue with Google", when I cancel the Google sign-in, then Login opens with no message. When the Google sign-in fails, then Login opens and "Google sign-in failed. Please try again." shows above the Login button (US-01) (decisions #81).

States:
- Designed: default with Name focused and filled (active border, the focus style, decisions #63; sample "Tanzir Rahman"); Email empty with placeholder; password masked
- Missing from design: validation errors and email already registered (decisions #15), loading and server errors (decisions #6), success (Overview opens, decisions #3, #15), session length (30 days, decisions #63), the generated username (decisions #62, #67), Google sign-in cancelled or failed (back to Login, decisions #81), empty Name and Password (no placeholder, decisions #63)

Out of scope: the terms of service page (decisions #15). Email verification (decisions #15).
Assumptions: none
Open questions: none

---

## US-03: Forgot password

- Figma: desktop `167:7873`, mobile none (decisions #4) (screenshots: `docs/figma/103. Forgot Password.png`)
- Story: As a user who forgot my password I want to request a reset link so that I can get back into my account.
- Scope: built visually as designed and reachable from Login, with no behavior (decisions #16).

Acceptance criteria:
1. Given I open the forgot password screen, when it renders, then I see:
   - the "FINEbank.IO" logo, in primary teal (decisions #66, #70)
   - the heading "Forgot Password?"
   - the text "Enter your email address to get the password reset link."
   - an "Email Address" field with placeholder "hello@example.com"
   - a "Password Reset" primary button
   - a gray "Back to login" link
2. Given I click "Back to login", then the Login screen opens (US-01).
3. Given I click "Password Reset", with or without an email entered, then no request is sent, no email goes out, and no validation, confirmation or error shows (decisions #16).

States:
- Designed: default (empty email)
- Missing from design: confirmation or success state, error state, loading, the reset-password page. None are built (decisions #16).

Out of scope: sending the reset email and the page that sets a new password, until designed. The screen is built so that flow can be added later without reworking it (decisions #16).
Assumptions: none
Open questions: none

---

## US-04: App shell (sidebar and header)

- Figma: desktop: Nav bar component `411:6442` (instance `411:6510` in 104) and Header component `411:6067` (instance `411:6089` in 104), on every app frame 104 to 112. Mobile none (decisions #4). Screenshots: `docs/figma/104. Overview.png`, `docs/figma/105. Balances.png`, and every app PNG.
- Story: As a signed-in user I want a persistent sidebar and header so that I can move between sections and reach search and notifications from any screen.

Acceptance criteria:
1. Given I am on any app screen, when it renders, then a dark left sidebar shows:
   - the "FINEbank.IO" logo, in white (decisions #66, #70)
   - the menu items Overview, Balances, Transactions, Bills, Expenses, Goals and Settings, each with its icon
   - a "Logout" button near the bottom
   - a profile block with avatar, user name (sample "Tanzir Rahman"), "View profile" and a vertical three-dot icon. The avatar is the photo uploaded in Settings (US-18, decisions #33).
2. Given I am in a section, when the sidebar renders, then that section's menu item has the Active style (teal background, white text) and the others have the Inactive style.
3. Given I hover an inactive menu item, then it shows the Hover style (Menu component `2:112`, Status=Hover).
4. Given I click a menu item, then that section opens:
   - Overview opens US-05
   - Balances opens US-11
   - Transactions opens US-13
   - Bills opens US-14
   - Expenses opens US-15
   - Goals opens US-16
   - Settings opens US-18
5. Given I am on Account Details (US-12), when the sidebar renders, then "Balances" is the active item (decisions #47).
6. Given I am on any app screen, when the header renders, then it shows:
   - a "»" icon followed by today's date in the browser's time zone (sample "19 May, 2023") (decisions #10, #11, #54)
   - a bell icon with a teal dot
   - a search field with placeholder "Search here" and a search icon
7. Given I am on Overview, when the header renders, then the greeting "Hello <first name>" with the signed-in user's first name, the first word of their Full Name (sample "Hello Tanzir"), shows before the date. On every other app screen, only the date shows (decisions #10, #62).
8. Given I click "Logout", then my session ends immediately, with no confirm dialog, and the Login screen opens (US-01) (decisions #3).
9. Given I click "View profile", then Settings opens on the Account tab (US-18) (decisions #9).
10. Given I click the three-dot icon, the "»" icon or the bell, then nothing happens: they are visual only. The bell always shows its teal dot (decisions #8, #9, #10).
11. Given I use the search field, then no search runs and no results show: it is visual only (decisions #7).
12. Given I am signed out, when I open any app screen's URL, then Login opens, and after I log in the screen I asked for opens (decisions #3).
13. Given an app screen's content is taller than the viewport, when I scroll, then the content scrolls and the sidebar stays fixed (decisions #5).
14. Given I have not uploaded a profile photo, when the sidebar renders, then the avatar is a circle with my initials, using design tokens. Initials are the first letter of the first and the last word of my Full Name, uppercase ("Tanzir Rahman" gives "TR"); a one-word name gives one letter. The demo dataset has no profile photo, so every new user, including a Google user, sees their initials until they upload one in Settings (US-18) (decisions #38, #62).
15. Given I am signed in, when I open a URL that does not exist, then Overview opens. Given I am signed out, then Login opens. No not-found page is shown (decisions #3, #39).

States:
- Designed: menu item Active, Inactive and Hover (component variants); bell with dot
- Missing from design: search results (none, decisions #7); notifications panel and bell without dot (none, decisions #8); profile or three-dot menu (none, decisions #9); avatar without photo (initials, decisions #38); not-found page (none, unknown URLs redirect, decisions #39)

Out of scope: search, notifications and a three-dot menu (decisions #7, #8, #9). Any action on the "»" icon, such as collapsing the sidebar (decisions #10). A not-found page (decisions #39).
Assumptions: none
Open questions: none

---

## US-05: Overview: Total Balance

- Figma: desktop `66:4732`, section `405:5461`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to see my total balance and browse my accounts on the Overview so that I know how much money I have.

Acceptance criteria:
1. Given I open Overview, when the "Total Balance" card renders, then it shows the sum of all my account balances, calculated in the backend (sample "$240,399.00"), and the label "All Accounts" (decisions #11, #17). Each account balance is its opening balance plus all its Complete transactions dated up to today, calculated in the backend, so Total Balance, the account cards and the transaction history always reconcile (decisions #53, #57).
2. Given the card renders, then it shows one account per slide as a teal card with:
   - the label "Account Type"
   - the type (sample "Credit Card")
   - the masked number in the format "**** **** **** 2598" (decisions #25)
   - a card-network logo, only when the account has a card network set (sample Mastercard) (decisions #24)
   - the account balance, calculated as in criterion 1 (sample "$25,000.00") (decisions #11, #57)
   - a round arrow icon
3. Given the card renders, then a control below it shows "Previous" (with left chevron), one dot per account and "Next" (with right chevron). The dot count follows my accounts, not the 3 dots in Figma, and this difference is not a visual defect (decisions #17).
4. Given the first account is shown, then "Previous" is disabled and muted (gray) and the first dot is active (teal) (decisions #17).
5. Given I click "Next", then the next account shows and the active dot moves one step.
6. Given I click "Previous" when not on the first account, then the previous account shows.
7. Given the last account is shown, then "Next" is disabled (decisions #17).
8. Given I click "All Accounts", then the Balances screen opens (US-11) (decisions #17).
9. Given I click the round arrow icon, then nothing happens: it is visual only (decisions #17).

States:
- Designed: first account selected
- Missing from design: last account ("Next" disabled, decisions #17); no accounts, loading, error (decisions #6)

Out of scope: any action on the round arrow icon (decisions #17).
Assumptions: none
Open questions: none

---

## US-06: Overview: Goals card and edit goal popup

- Figma: desktop `66:4732`, section `405:5491`; popup state `416:7385` (Popup Input instance `416:7863`, component `416:6381`); mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`, `docs/figma/104.1. Overview.png`)
- Story: As a signed-in user I want to see this month's savings target against what I achieved, and edit it, so that I can track my progress.

Acceptance criteria:
1. Given I open Overview, when the "Goals" card renders, then it shows the savings goal of the current month: the Target Amount (sample "$20,000.00"), with a pencil icon button next to it, and the month (sample "May, 2023"). Each month has at most one savings goal; this card and its pencil always use the current month (decisions #11, #18, #58).
2. Given the card renders, then it shows "Target Achieved" with a trophy icon and the Present Amount, the amount saved so far (sample "$12,500.00"), and "This month Target" with a target icon and the Target Amount (sample "$20,000.00") (decisions #11, #18).
3. Given the card renders, then it shows a semicircle gauge labelled "Target vs Achievement". The teal arc and needle show progress = Present Amount / Target Amount. The gauge shows a min label ("$0"), a max label (sample "$20k") and the Present Amount in the center, in compact format (sample "$12.5k") (decisions #11, #18).
4. Given the Present Amount is greater than the Target Amount, then the gauge shows 100% (decisions #31).
5. Given I click the pencil icon, then popup 104.1 opens over the content area with (decisions #18, #31):
   - a close (X) button
   - a "Target Amounts" field, prefilled with the current Target Amount
   - a "Present Amounts" field, prefilled with the current Present Amount, with the placeholder "Write present amount here" whenever it is empty (decisions #71)
   - a "Save" primary button
6. Given the popup is open, then the content area behind it is dimmed as designed (the sidebar and header are not), but the whole page, sidebar and header included, is blocked, and keyboard focus stays inside the popup (decisions #35).
7. Given the popup is open, when I click X, press Esc or click the dimmed backdrop, then it closes and unsaved changes are discarded (decisions #35).
8. Given I entered valid amounts, when I click "Save", then the goal is updated in the backend, the popup closes and the Goals card shows the new values (decisions #18, #31).
9. Given an amount breaks a rule, when I click "Save", then nothing is saved and the error shows inline under that field. Rules: numbers only, up to 2 decimals; Target Amount greater than 0; maximum 1,000,000,000; Present Amount may be 0 and may exceed the Target Amount; the `$` is added by the UI, not typed (decisions #6, #31).
10. Given I clicked "Save", while saving, then "Save" is disabled and shows a spinner. If the server fails, its error shows above "Save" (decisions #6).
11. Given the current month has no savings goal, then the card shows the empty message "No goal for this month" and keeps the pencil icon (decisions #6, #58).
12. Given the current month has no savings goal, when I click the pencil, then the popup opens with both fields empty, showing the `$` prefix. Target Amount has no placeholder (decisions #63, #69); Present Amount shows its placeholder "Write present amount here" (decisions #71). Target Amount is required, and "Save" creates the goal for the current month. Nothing is copied from the previous month (decisions #58).
13. Given an amount field in the popup, then it looks as designed: the `$` directly before the number, with no space and no thousands separators (sample "$500000"). The `$` is shown by the input, not typed. A prefilled value shows decimals only when they are not zero (`$500000`, `$1250.50`). Outside inputs, amounts use the display format (`$500,000.00`) (decisions #11, #31, #64).
14. Given I type in an amount field, then I can type digits and an optional decimal point, with at most 2 decimals; a typed comma is rejected (decisions #31, #64).

States:
- Designed: card default; popup open (104.1)
- Missing from design: validation errors (decisions #6, #31); saving and save failure (decisions #6); card loading and error (decisions #6); no goal for the current month (empty message, and empty popup fields with the `$` prefix and the Present Amount placeholder, decisions #58, #69, #71)

Out of scope: none
Assumptions: none
Open questions: none

---

## US-07: Overview: Upcoming Bill

- Figma: desktop `66:4732`, section `405:5530`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to see my next bills on the Overview so that I am not surprised by upcoming charges.

Acceptance criteria:
1. Given I open Overview, when the "Upcoming Bill" card renders, then it shows the title and a "View All" link with a right chevron.
2. Given the card renders, then it shows my next 2 upcoming bills (due date today or later, today in the browser's time zone), soonest first. A bill drops off once its due date passes (decisions #28, #53, #54). Each row shows:
   - a gray date box with month (sample "May") and day (sample "15")
   - the biller logo from the backend (sample Figma) (decisions #28)
   - the bill title (sample "Figma - Yearly Plan", as on Bills) (decisions #12)
   - "Last Charge - <date>" (sample "Last Charge - 14 May, 2022")
   - the amount in a bordered box (sample "$150.00") (decisions #11)
3. Given there are two rows, then a divider line separates them.
4. Given I click "View All", then the Bills screen opens (US-14) (decisions #48).

States:
- Designed: 2 bills
- Missing from design: more than 2 upcoming bills (only the next 2 show, decisions #28); no upcoming bills, loading, error (decisions #6)

Out of scope: bill actions such as pay, mark as paid or add (decisions #28).
Assumptions: none
Open questions: none

---

## US-08: Overview: Recent Transaction

- Figma: desktop `66:4732`, section `66:4747`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to see my latest transactions on the Overview, filtered by type, so that I can spot recent activity quickly.

Acceptance criteria:
1. Given I open Overview, when the "Recent Transaction" card renders, then it shows the title and a "View All" link with a right chevron.
2. Given the card renders, then it shows the tabs "All", "Revenue" and "Expenses". "All" is active (teal text with teal underline). An active "Revenue" or "Expenses" tab uses the same style (decisions #19).
3. Given the "All" tab is active, then the list shows my latest 5 transactions, income and expense, of any status, dated up to today, newest first (decisions #40, #53, #57). Each row shows:
   - the icon of the transaction's category in a gray square. An income transaction has no category and shows the wallet icon. GTR 5 is in Entertainment and shows that icon, not Figma's gamepad: a known difference from Figma, not a visual defect (decisions #56)
   - the item name (sample "GTR 5")
   - the shop name below it (sample "Gadget & Gear")
   - the amount on the right with its sign, `+` for income and `-` for expense (sample "+$160.00" or "-$160.00"), in the designed colour (decisions #19)
   - the date below the amount, in the browser's time zone (sample "17 May, 2023") (decisions #11, #54)
4. Given the list renders, then rows are separated by divider lines.
5. Given I click "Revenue", then it becomes active and the list shows my latest 5 income transactions, newest first. Given I click "Expenses", then it becomes active and the list shows my latest 5 expense transactions, newest first. "All" shows both (decisions #19, #40).
6. Given I click "View All", then the Transactions screen opens (US-13) (decisions #49).

States:
- Designed: "All" tab active with 5 rows
- Missing from design: Revenue and Expenses active states (same style as "All", decisions #19); empty list, loading, error (decisions #6); row order and the rows of each tab (latest 5 per tab, newest first, decisions #40)

Out of scope: none
Assumptions: none
Open questions: none

---

## US-09: Overview: Statistics (weekly comparison)

- Figma: desktop `66:4732`, section `66:4933`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to compare this week's expenses with last week's in a chart so that I can see how my spending is changing.

Acceptance criteria:
1. Given I open Overview, when the "Statistics" card renders, then its header shows "Weekly Comparison" with a down chevron, and a legend: "This week" (teal swatch) and "Last week" (light gray swatch).
2. Given the chart renders, then it shows my expenses per day from the backend, the sum of my Complete expense transactions on that day, this week vs last week: 7 day groups on the x-axis, Monday to Sunday in the browser's time zone, each with a light gray bar (last week) and a teal bar (this week). Labels show the day number and weekday as designed (Figma sample "17 Sun" to "23 Sat") (decisions #20, #54, #56, #57).
3. Given the chart renders, then the y-axis is linear with 5 labels, $0 and 4 equal steps, and horizontal grid lines. The top label is the smallest "nice" value (1, 2, 2.5, 4, 5, 6 or 8 times a power of 10) at or above the highest bar, with whole-cent steps and 5 exact compact labels (decisions #91), and the labels use the compact format: a highest bar of $322.00 gives "$0", "$100", "$200", "$300", "$400". The labels differ from Figma's "$0", "$2k", "$10k", "$50k", "$250k" (decisions #11, #20, #55, #91).
4. Given I click "Weekly Comparison", then no other options are offered: the dropdown is shown as designed with "Weekly Comparison" only (decisions #20).
5. Given I hover a bar, then no tooltip shows (decisions #20).
6. Given a day of this week is after today, then it has no teal bar; its axis label and last week's gray bar stay, and earlier days are drawn in full (decisions #55).
7. Given every value of both weeks is 0, then the chart shows the empty state (decisions #6, #55).

States:
- Designed: default chart
- Missing from design: dropdown options (none, decisions #20); bar hover or tooltip (none, decisions #20); days after today (no bar, decisions #55); no data (all values 0), loading, error (decisions #6, #55)

Out of scope: other comparison options and chart tooltips (decisions #20).
Assumptions: none
Open questions: none

---

## US-10: Overview: Expenses Breakdown

- Figma: desktop `66:4732`, section `66:4999`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to see my spending per category compared with last month so that I know where my money goes.

Acceptance criteria:
1. Given I open Overview, when the "Expenses Breakdown" card renders, then the title shows with the note "*Compare to last month" on the right.
2. Given the card renders, then it always shows all 6 categories in a 3x2 grid, separated by lines: Housing, Food, Transportation, Entertainment, Shopping and Others. They are fixed and the same for every user (decisions #56, #61).
3. Given a category cell renders, then it shows:
   - the category icon in a gray square
   - the category name
   - this month's total for the category: the sum of my Complete expense transactions in that category this month, up to today, with the month in the browser's time zone, calculated in the backend. A category with no expenses this month shows `$0.00` (sample Housing "$250.00") (decisions #21, #53, #54, #56, #57, #61)
   - the % change vs last month, calculated in the backend and rounded to a whole number, with no leading zero, with an asterisk (sample "15%*"; Figma's "08%*" shows as `8%*`, a design artifact) (decisions #21, #61)
   - an arrow, red and pointing up, or green and pointing down
   - a right arrow
4. Given spending in a category increased vs last month, then its arrow points up in red (`E73D1C`). Given it decreased, then the arrow points down in green (`4DAF6E`) (decisions #21).
5. Given last month's total for a category was 0, then no percentage and no arrow show for it (decisions #21).
6. Given I hover a category's right arrow, then it shows the teal hover state, as drawn on Housing in Figma. This applies to every category (decisions #21).
7. Given I click a category's right arrow, then the Expenses screen opens (US-15) (decisions #21).
8. Given a category's change is 0% or rounds to 0%, then it shows `0%` with no arrow (decisions #61).

States:
- Designed: default. The teal right arrow on Housing is the hover state, not the default (decisions #21).
- Missing from design: a category with no expenses this month (`$0.00`, decisions #61); a change of 0% (no arrow, decisions #61); loading, error (decisions #6)

Out of scope: none
Assumptions: none
Open questions: none

---

## US-11: Balances: account list

- Figma: desktop `66:5320` (Account Type instances `410:5376` and siblings, component `410:5353`; Add Account cell `410:5516`), mobile none (decisions #4) (screenshots: `docs/figma/105. Balances.png`)
- Story: As a signed-in user I want to see all my accounts with their balances so that I can manage them in one place.

Acceptance criteria:
1. Given I open Balances, when it renders, then the title "Balances" shows, "Balances" is the active sidebar item, and the header shows only the date.
2. Given I have accounts, then each account shows as a card in Figma's 3-column grid, oldest first (sample: 5 cards), wrapping to more rows as needed (decisions #24). Each card shows:
   - the account type (sample "Credit Card")
   - the Bank Name, the value edited on Account Details (US-12) (sample "Master Card") (decisions #57)
   - a card-network logo (Mastercard or VISA), only when the account has a card network set (sample Mastercard, VISA) (decisions #24)
   - the masked account number in the format "**** **** **** 2598", with the label "Account Number" (decisions #25)
   - the account balance, calculated as on Overview (US-05, criterion 1) (sample "$25,000.00"), with the label "Total amount" (decisions #11, #57)
   - a teal "Remove" text link
   - a teal "Details" button with a right chevron
3. Given the grid renders, then the last cell, always after all account cards, shows an "Add Accounts" primary button and a gray "Edit Accounts" text link (decisions #24).
4. Given I click "Details" on a card, then the Account Details screen opens for that account (US-12) (decisions #50).
5. Given I click "Remove", "Add Accounts" or "Edit Accounts", then nothing happens: they are visual only, with no forms or flows (decisions #22, #23).

States:
- Designed: 5 accounts plus the add cell
- Missing from design: more accounts (the grid wraps, decisions #24); no accounts, loading, error (decisions #6); remove confirmation and the Add and Edit Accounts flows (none, decisions #22, #23)

Out of scope: the Add Accounts form, the Edit Accounts flow and the remove flow (decisions #22, #23).
Assumptions: none
Open questions: none

---

## US-12: Account Details

- Figma: desktop `416:7878`, mobile none (decisions #4) (screenshots: `docs/figma/106. Account Details.png`)
- Story: As a signed-in user I want to see the details and transaction history of one account so that I can check what happened on it.

Acceptance criteria:
1. Given I open an account's details, when it renders, then the title "Account Details" shows and "Balances" is the active sidebar item (decisions #47).
2. Given the details card renders, then it shows these labelled values, matching the account's card on Balances (decisions #12):
   - "Bank Name" (sample "AB Bank Ltd.")
   - "Account Type" (sample "Checking")
   - "Balance", calculated as on Overview (US-05, criterion 1) (sample "$25,056.00") (decisions #57)
   - "Branch Name" (sample "Park Street Branch")
   - "Account Number", masked in the format "**** **** **** 2598" (decisions #25)
3. Given the details card renders, then it shows an "Edit Details" primary button and a "Remove" text button.
4. Given I click "Edit Details", then Bank Name, Branch Name and Account Type turn into inputs on the same page, using the existing input styles from the components page. All other fields, such as Balance and Account Number, stay read-only (decisions #26).
5. Given I am editing, then Account Type is a select styled like an input, with the values Credit Card, Checking, Savings, Investment and Loan. Its open list is drawn by the shared Dropdown component (decisions #26, #60).
6. Given I am editing, then "Edit Details" is replaced by "Save" and "Cancel", using the existing button components (decisions #26).
7. Given Bank Name or Branch Name is empty or longer than 100 characters, when I click "Save", then nothing is saved and the error shows inline under that field (decisions #6, #26).
8. Given the fields are valid, when I click "Save", then the change is stored in the backend and the page returns to view mode with the new values. While saving, "Save" is disabled and shows a spinner; if the server fails, its error shows above "Save" (decisions #6, #26).
9. Given I am editing, when I click "Cancel", then my changes are discarded and the page returns to view mode (decisions #26).
10. Given I click "Remove", then nothing happens: it is visual only (decisions #23).
11. Given the "Transactions History" section renders, then a table shows this account's transactions, the same records as on Transactions (US-13), of any status, dated up to today, newest first, with the columns Date, Status, Transaction Type, Receipt and Amount (decisions #27, #53, #57). Dates use the browser's time zone (decisions #54). Amounts are bold, right-aligned and signed: `+` for income, `-` for expense (decisions #19). Sample row: "17 Apr, 2023", "Complete", "Credit", "8C52d5DKDJ5", "+$160.00".
12. Given a row renders, then Status is Complete, Pending or Failed; Transaction Type is Credit (income) or Debit (expense); and Receipt is a plain-text receipt ID, not a link or download (decisions #19, #27).
13. Given the table renders, then it shows the first 10 rows, separated by divider lines, with a "Load More" primary button below the table (decisions #27).
14. Given I click "Load More", then the next 10 rows are fetched from the backend and added to the table. While fetching, the button shows the loading pattern (decisions #6, #27).
15. Given there are no more rows, then "Load More" is hidden (decisions #27).
16. Given the screen renders, then there is no back or breadcrumb control; the sidebar is the way back to Balances (decisions #26).
17. Given I open an Account Details URL for an account that does not exist or belongs to another user, then the backend returns not found, no account data is shown, and Balances opens (US-11). Another user's data is never returned or shown (decisions #39).
18. Given I saved a new Account Type, then Payment Method on Transactions (US-13) shows the new type for this account's transactions. Given I saved a new Bank Name, then this account's card on Balances (US-11) shows it (decisions #57).

States:
- Designed: details plus 4 history rows
- Missing from design: edit mode (decisions #26); the Account Type open list (shared Dropdown, decisions #60); remove flow (none, decisions #23); loading, error, no transactions (decisions #6); more than 10 rows (the demo dataset has them on every account, so "Load More" shows, decisions #53); end of list (decisions #27); a back control (none, decisions #26); an account that does not exist or belongs to another user (redirect to Balances, decisions #39)

Out of scope: the remove flow (decisions #23).
Assumptions: none
Open questions: none

---

## US-13: Transactions

- Figma: desktop `66:5474`, mobile none (decisions #4) (screenshots: `docs/figma/107. Transactions.png`)
- Story: As a signed-in user I want a full list of my transactions, filterable by type, so that I can review my spending and income.

Acceptance criteria:
1. Given I open Transactions, when it renders, then the title "Recent Transaction" shows and "Transactions" is the active sidebar item.
2. Given the screen renders, then the tabs "All", "Revenue" and "Expenses" show above the table. "All" is active (teal text and underline). An active "Revenue" or "Expenses" tab uses the same style (decisions #19).
3. Given the table renders, then it shows the columns Items, Shop Name, Date, Payment Method and Amount. Each row has its category icon and item name in the first column. An income transaction has no category and shows the wallet icon; GTR 5 is in Entertainment and shows that icon, not Figma's gamepad, a known difference from Figma (decisions #56). Payment Method is the type of the account the transaction belongs to, so it follows an Account Type edit on Account Details (US-12) (decisions #57). Dates use the browser's time zone (decisions #54). The amount is bold, right-aligned and signed: `+` for income, `-` for expense (decisions #19). Sample row: "GTR 5", "Gadget & Gear", "17 May, 2023", "Credit Card", "$160.00" with its sign. Figma shows 7 rows.
4. Given the table renders, then it shows the first 10 transactions of any status, dated up to today, newest first (decisions #27, #53, #57).
5. Given I click "Revenue", then it becomes active and the table shows only income transactions. Given I click "Expenses", then it becomes active and the table shows only expense transactions. "All" shows both (decisions #19).
6. Given I click "Load More", then the next 10 rows are fetched from the backend and added to the table. While fetching, the button shows the loading pattern (decisions #6, #27).
7. Given there are no more rows, then "Load More" is hidden (decisions #27).

States:
- Designed: "All" tab with 7 rows
- Missing from design: Revenue and Expenses active states (same style as "All", decisions #19); income rows (the demo dataset has them, so the Revenue tab is not empty, decisions #53); empty, loading, error (decisions #6); end of list (decisions #27)

Out of scope: none
Assumptions: none
Open questions: none

---

## US-14: Bills

- Figma: desktop `66:5609`, mobile none (decisions #4) (screenshots: `docs/figma/108. Bills.png`)
- Story: As a signed-in user I want to see all my upcoming bills with due dates and amounts so that I can plan my payments.

Acceptance criteria:
1. Given I open Bills, when it renders, then the title "Upcoming Bills" shows and "Bills" is the active sidebar item.
2. Given the table renders, then it shows the columns Due Date, Logo, Item Description, Last Charge and Amount.
3. Given the table renders, then it lists all my upcoming bills (due date today or later, today in the browser's time zone), soonest due first, not paginated (decisions #28, #41, #54). Each row (sample: 2 rows) shows:
   - a gray date box with month and day (sample "May" / "15")
   - the biller logo from the backend (sample Figma) (decisions #28)
   - a bold title (sample "Figma - Yearly Plan") with a description paragraph from the backend below it (decisions #28)
   - the last charge date (sample "14 May, 2022")
   - the amount in a bordered box (sample "$150.00") (decisions #11)
4. Given there are several rows, then divider lines separate them.
5. Given the Bills screen renders, then there is no action to pay a bill, mark it as paid or add one (decisions #28).
6. Given a bill's due date is before today, then it is not listed: a bill drops off once its due date passes. Only upcoming bills show, matching the title "Upcoming Bills" (decisions #41, #53).
7. Given a bill's due date has passed, then the demo dataset has its matching expense transaction, listed on Transactions (US-13). There is no "Bills" category: each bill maps to an existing category, for example rent to Housing and subscriptions to Entertainment or Others (decisions #56).

States:
- Designed: 2 bills
- Missing from design: many upcoming bills (all listed, not paginated, decisions #28, #41); no bills, loading, error (decisions #6); any bill action (none, decisions #28); past bills (not shown, decisions #41); row order (soonest due first, decisions #41)

Out of scope: paying, marking as paid, adding or editing bills (decisions #28).
Assumptions: none
Open questions: none

---

## US-15: Expenses

- Figma: desktop `66:5698`, mobile none (decisions #4) (screenshots: `docs/figma/109. Expenses.png`)
- Story: As a signed-in user I want to compare my expenses over time and see them per category so that I understand my spending habits.

Acceptance criteria:
1. Given I open Expenses, when it renders, then "Expenses" is the active sidebar item and the section "Expenses Comparison" shows a card with:
   - "Monthly Comparison" and a down chevron
   - a legend: "This year" (teal) and "Last year" (gray). Figma's "This Week" / "Last Week" is a design error (decisions #29).
2. Given the chart renders, then it shows my total expenses per month from the backend, the sum of my Complete expense transactions: 12 month groups (Jan to Dec), each with a gray bar (last year) and a teal bar (this year), with the year in the browser's time zone. Month labels are always 3 letters (Jan ... Jul ... Dec), so Figma's "July" shows as "Jul". The y-axis is linear with 5 labels, $0 and 4 equal steps up to the smallest "nice" value (1, 2, 2.5, 4, 5, 6 or 8 times a power of 10) at or above the highest bar, with whole-cent steps and 5 exact compact labels, in compact format, with grid lines (decisions #11, #29, #54, #55, #56, #57, #91).
3. Given the "Expenses Breakdown" section renders, then all 6 category cards always show in a 3x2 grid: Housing, Food, Transportation, Entertainment, Shopping and Others (decisions #56, #61).
4. Given a category card renders, then its gray header shows:
   - the category icon
   - the category name
   - the category total for the current month, the same value as on Overview (US-10): `$0.00` when the category has no expenses this month (sample Housing "$250.00") (decisions #29, #61)
   - the % change vs last month (sample "15%"; Figma's "08%" shows as `8%`), with an up arrow in red for an increase or a down arrow in green for a decrease, with the same values and rules as Overview Expenses Breakdown (US-10), including `0%` with no arrow (decisions #12, #21, #61)
   - the text "Compare to last month"
5. Given a category card renders, then its body lists the category's 2 most recent Complete expenses in the current month, separated by a divider. They are expense transactions, the same records as on Transactions (US-13); where Figma's values differ, Transactions wins (sample "Taxi fare" is $10.00, not Figma's $30.00 on this page). Each shows a name (sample "House Rent"), an amount (sample "$230.00") and a date (sample "17 May, 2023") (decisions #11, #29, #56, #57, #61).
6. Given I click "Monthly Comparison", then no other options are offered: the dropdown is shown as designed with "Monthly Comparison" only (decisions #29).
7. Given I click a category card, then nothing happens: cards are not clickable (decisions #29).
8. Given a month of this year is after the current month, then it has no teal bar; its label and last year's gray bar stay, and earlier months are drawn in full (decisions #55).
9. Given every value of both years is 0, then the chart shows the empty state (decisions #6, #55).
10. Given a category has no Complete expenses in the current month, then its card body shows "No expenses this month" (decisions #6, #61).

States:
- Designed: default with 2 line items per category
- Missing from design: dropdown options (none, decisions #29); more than 2 line items (only the 2 most recent show, decisions #29); a category with no expenses this month ("No expenses this month", decisions #61); months after the current month (no bar, decisions #55); chart tooltips (none, decisions, general rule); no data (all values 0), loading, error (decisions #6, #55)

Out of scope: other comparison options (decisions #29).
Assumptions: none
Open questions: none

---

## US-16: Goals

- Figma: desktop `66:5829`, mobile none (decisions #4) (screenshots: `docs/figma/110. Goals.png`)
- Story: As a signed-in user I want to see my savings goal, my saving trend and my spending limit per category so that I can keep my finances on track.

Acceptance criteria:
1. Given I open Goals, when it renders, then the title "Goals" shows and "Goals" is the active sidebar item.
2. Given the "Savings Goal" card renders, then it shows:
   - a period selector: one control in this card's Figma style (a gray box with a chevron), showing the selected month (sample "Mar, 2026"), set to the current month by default (Figma shows "01 May ~ 31 May") (decisions #30, #60)
   - "Target Achieved": the Present Amount of the selected month's savings goal (sample "$12,500.00"); each month has at most one savings goal (decisions #11, #18, #30, #58)
   - "This month Target": the Target Amount for the selected month (sample "$20,000.00") (decisions #11, #18, #30)
   - a gauge labelled "Target vs Achievement" showing progress = Present Amount / Target Amount, with min, center and max values (sample "$0", "$12.5k", "$20k"); the center shows the Present Amount in compact format, and a Present Amount above the Target shows 100% (decisions #11, #18, #31)
   - an outlined teal "Adjust Goal" button with a pencil icon
3. Given the "Saving Summary" card renders, then it shows:
   - its own period selector: one control in this card's Figma style (plain text with a chevron), showing the selected month as above, set to the current month by default (Figma shows "Mar 2022"; the mismatch with the May x-axis is a design error) (decisions #30, #60)
   - a legend: "This month" (teal) and "Same period last month" (gray)
   - a line chart of daily savings for the selected month, from the backend, with a teal line and teal gradient fill for this month, and a dashed gray line for daily savings on the same days of the month before the selected month (decisions #30, #42). For both lines, a day's saving is my Complete income minus my Complete expenses on that day, calculated in the backend from transactions; it can be negative. It is not linked to the Present Amount, and the month's total does not have to equal it (decisions #57, #59)
   - a linear y-axis with 5 labels, $0 and 4 equal steps up to the smallest "nice" value (1, 2, 2.5, 4, 5, 6 or 8 times a power of 10) at or above the highest point, with whole-cent steps and 5 exact compact labels (decisions #91), in compact format, so the labels differ from Figma's "$0", "$500", "$2000" and "$5000". When a day is negative, the axis extends below $0 with the same step size as above $0, so there can be more than 5 labels (e.g. "-$500", "$0", "$500") (decisions #11, #20, #42, #55, #59, #68). When no day is above $0 but not all are $0, the top label is "$0" and the steps go downward, sized from the lowest point with the same "nice" value rule (decisions #72)
   - x-axis labels for days of the selected month in short day format, day first (sample "01 May"; Figma shows May 01, May 05, May 10, May 15, May 20, May 25 and May 30), with vertical grid lines (decisions #11, #42)
4. Given a period selector renders, then its label uses the month format (sample "Mar, 2026") (decisions #11, #30, #60).
5. Given I open a period selector, then one list of months shows, newest first, from the current month back to the month of my earliest data; future months are not listed. The open list is drawn by the shared Dropdown component, from tokens (Popup radius and shadow) (decisions #30, #60).
6. Given I pick a month in the "Savings Goal" selector, then the goal summary shows that month. Given I pick a month in the "Saving Summary" selector, then only its chart changes (decisions #30).
7. Given the "Expenses Goals by Category" section renders, then 6 cards show in a 3x2 grid: Housing, Food, Transportation, Entertainment, Shopping and Others. Each card has the category icon, name, the monthly spending limit I set for that category (sample "$250.00") and an outlined teal "Adjust" button with a pencil icon (decisions #32). The categories are fixed and the same for every user (decisions #56).
8. Given my actual spending in a category exceeds its limit, then no comparison or warning shows (decisions #32).
9. Given I click "Adjust Goal", then popup 110.1 opens for the month selected in the "Savings Goal" selector, past months included (US-17, criterion 1) (decisions #31, #58).
10. Given I click "Adjust" on a category card, then popup 110.2 opens (US-17, criterion 2) (decisions #31).
11. Given the selected month has no savings goal, then the "Savings Goal" card shows the empty message "No goal for this month" and keeps "Adjust Goal" (decisions #6, #58).
12. Given a day of the selected month is after today, then the chart shows no point for it; its axis label stays, and earlier days are drawn in full (decisions #55).
13. Given every daily saving on both lines is 0, then the chart shows the empty state (decisions #6, #55).

States:
- Designed: default
- Missing from design: the period selector's open list (one list of months, shared Dropdown, decisions #60); chart tooltips (none, decisions, general rule); no goal for the selected month ("No goal for this month", decisions #58); loading, error (decisions #6); Saving Summary y-axis scale, negative days, no day above $0 and x-axis label format (differ from Figma, decisions #42, #55, #59, #68, #72); days after today (no point, decisions #55)

Out of scope: comparing category limits with actual spending, and warnings when a limit is exceeded (decisions #32).
Assumptions: none
Open questions: none

---

## US-17: Goals: adjust goal popups

- Figma: desktop `416:6052` (110.1) and `416:6413` (110.2), component Popup Input `416:6381`, mobile none (decisions #4) (screenshots: `docs/figma/110.1. Goals.png`, `docs/figma/110.2. Goals.png`)
- Story: As a signed-in user I want to change my savings target and my category spending limits so that my goals match my plans.

Acceptance criteria:
1. Given I clicked "Adjust Goal", when popup 110.1 opens, then it shows a close (X) button, a "Target Amounts" field and a "Present Amounts" field, both prefilled with the values of the month selected on Goals (US-16), past months included (the Present Amounts placeholder, shown whenever the field is empty, is "Write present amount here"; decisions #71), and a "Save" primary button (decisions #18, #31, #58).
2. Given I clicked "Adjust" on a category card, when popup 110.2 opens, then it shows a close (X) button, a "Target Amounts" field prefilled with that category's current monthly spending limit, and a "Save" primary button, with no "Present Amounts" field (decisions #31, #32).
3. Given a popup is open, then the content area behind it is dimmed as designed (the sidebar and header are not), but the whole page, sidebar and header included, is blocked, and keyboard focus stays inside the popup (decisions #35).
4. Given a popup is open, when I click X, press Esc or click the dimmed backdrop, then it closes and unsaved changes are discarded (decisions #35).
5. Given I entered valid amounts, when I click "Save", then the backend is updated, the popup closes and the matching card on Goals shows the new value (decisions #31).
6. Given an amount breaks a rule, when I click "Save", then nothing is saved and the error shows inline under that field. Rules: numbers only, up to 2 decimals; Target Amount greater than 0; maximum 1,000,000,000; Present Amount may be 0 and may exceed the Target Amount; the `$` is added by the UI, not typed (decisions #6, #31).
7. Given I clicked "Save", while saving, then "Save" is disabled and shows a spinner. If the server fails, its error shows above "Save" (decisions #6).
8. Given the selected month has no savings goal, when popup 110.1 opens, then both fields are empty, showing the `$` prefix. Target Amount has no placeholder (decisions #63, #69); Present Amount shows its placeholder "Write present amount here" (decisions #71). Target Amount is required, and "Save" creates the goal for that month. Nothing is copied from the previous month (decisions #58).
9. Given an amount field, then it looks as designed: the `$` directly before the number, with no space and no thousands separators (sample "$500000"). The `$` is shown by the input, not typed. A prefilled value shows decimals only when they are not zero (`$500000`, `$1250.50`). Outside inputs, amounts use the display format (`$500,000.00`) (decisions #11, #31, #64).
10. Given I type in an amount field, then I can type digits and an optional decimal point, with at most 2 decimals; a typed comma is rejected (decisions #31, #64).

States:
- Designed: savings popup with two fields (110.1); category popup with one field (110.2)
- Missing from design: validation errors (decisions #6, #31); saving and save failure (decisions #6); success feedback (the page shows the new value, decisions #31); a month with no goal (empty fields with the `$` prefix and the Present Amount placeholder, decisions #58, #69, #71)

Out of scope: none
Assumptions: none
Open questions: none

---

## US-18: Settings: Account tab

- Figma: desktop `66:6324`, mobile none (decisions #4) (screenshots: `docs/figma/111. Settings.png`)
- Story: As a signed-in user I want to view and update my profile details and photo so that my account information is correct.

Acceptance criteria:
1. Given I open Settings, when it renders, then "Settings" is the active sidebar item and a card shows the tabs "Account" and "Security". "Account" is active (teal text and underline).
2. Given the Account tab is active, then it shows these labelled fields as inputs styled as designed, with no borders (decisions #33):
   - "Full name" (sample "Tanzir Rahman"), editable
   - "Email" (sample "tanzir.rahman@email.com"), read-only, as it is the login identity and links Google sign-in (decisions #33)
   - "Username" (sample "tanzir.rahman"), editable (decisions #33, #62)
   - "Phone Number", editable: a country code dropdown styled as designed and a number, separated by a vertical divider (sample "+880" and "51547 58868") (decisions #33)
3. Given the Account tab is active, then "Your Profile Picture" shows a dashed upload box with an image icon and the text "Upload your photo".
4. Given the Account tab is active, then an "Update Profile" primary button shows below the fields.
5. Given I click "Security", then the Security tab opens (US-19).
6. Given I click the upload box, then a file picker opens to choose a photo (decisions #33).
7. Given I changed a field, when I click "Update Profile", then the changes are saved to the backend and the short message "Profile updated" shows above the button, the same pattern as on the Security tab (decisions #33, #34, #52).
8. Given a field breaks its rule, when I click "Update Profile", then nothing is saved and the error shows inline under that field. Rules: Full name required, max 100 characters; Username 3 to 30 characters, only lowercase letters, numbers, dot and underscore; Phone Number optional, digits only; photo JPG or PNG, max 2 MB, no cropping (decisions #6, #33, #62).
9. Given I clicked "Update Profile", while saving, then the button is disabled and shows a spinner. If the server fails, its error shows above the button (decisions #6).
10. Given I saved a new photo, then it is stored in the backend and replaces the avatar in the sidebar profile block, which shows my initials until I upload a photo (US-04) (decisions #33, #38).
11. Given I open the country code dropdown, then it lists the codes of all countries from the standard international list, each option showing only the code, as designed (sample "+880"). A new user's default is +1 (decisions #43). The open list is drawn by the shared Dropdown component (decisions #60).
12. Given I have uploaded a photo, then the upload box shows my current photo. Given I have not, then it is empty as designed (decisions #38, #44).
13. Given I chose a new file in the upload box, then no preview of it shows. The photo in the upload box and the sidebar avatar update only after "Update Profile" saves (decisions #33, #44).
14. Given I enter a username that another user already has, when I click "Update Profile", then nothing is saved and "This username is already taken" shows inline under Username (decisions #62).
15. Given I saved a new Full name, then the Overview greeting uses its first word and the sidebar initials use the first letter of its first and last word (US-04) (decisions #62).

States:
- Designed: Account tab with filled values; empty upload box
- Missing from design: field focus style (none, fields styled as designed, decisions #33); validation and upload errors, username already taken (decisions #6, #33, #62); saving (decisions #6); the current photo in the upload box (shown, decisions #44) and a preview of a newly chosen file (none, decisions #44); avatar when no photo is uploaded (initials, decisions #38); country code options and default (all countries, default +1, shared Dropdown, decisions #43, #60); success feedback ("Profile updated", decisions #52)

Out of scope: changing Email (decisions #33). Photo cropping (decisions #33). A preview of a newly chosen photo before saving (decisions #44).
Assumptions: none
Open questions: none

---

## US-19: Settings: Security tab

- Figma: desktop `123:7763`, mobile none (decisions #4) (screenshots: `docs/figma/112. Settings.png`)
- Story: As a signed-in user I want to change my password so that my account stays secure.

Acceptance criteria:
1. Given I click the "Security" tab, when it renders, then "Security" is active (teal text and underline) and "Account" is inactive.
2. Given the Security tab is active, then it shows:
   - the masked fields "Old Password", "New Password" and "Retype Password"
   - the field "Phone Number" (sample "+880" and "51547 58868"), read-only; it is edited only on the Account tab (US-18) (decisions #34)
   - an "Update Password" primary button
3. Given I signed up with Google only and have no password, then the password section (the three password fields and "Update Password") is hidden (decisions #2, #34).
4. Given I click "Account", then the Account tab opens (US-18).
5. Given New Password has fewer than 8 characters, has no letter or no number, or is the same as the old password, when I click "Update Password", then nothing is saved and the error shows inline under New Password (decisions #15, #34).
6. Given Retype Password does not match New Password, when I click "Update Password", then nothing is saved and "Passwords do not match" shows under Retype Password (decisions #34).
7. Given Old Password is wrong, when I click "Update Password", then nothing is saved and "Current password is incorrect" shows under Old Password (decisions #34).
8. Given all fields are valid, when I click "Update Password", then the password is changed, "Password updated" shows above the button, the fields are cleared and I stay signed in (decisions #34).
9. Given I clicked "Update Password", while saving, then the button is disabled and shows a spinner. If the server fails, its error shows above the button (decisions #6).

States:
- Designed: Security tab with masked values
- Missing from design: field focus style (none, built as designed, decisions, general rule); validation errors and wrong old password (decisions #34); saving (decisions #6); success feedback (decisions #34)

Out of scope: two-factor authentication (decisions #34).
Assumptions: none
Open questions: none
