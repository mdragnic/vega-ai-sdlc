# Finebank: user stories (DRAFT)

Status: draft written by `/write-spec` on 2026-10-22. It becomes the spec only after human review.
Format: `.claude/templates/story.md`. Screens and node IDs: `docs/figma/inventory.md`. Open questions: `docs/decisions.md`.
Values in quotes marked "sample" are design sample data, not fixed content (see brief, Assumptions).
No mobile frames exist, so every story lists mobile as "none" (decisions #4).

---

## US-01: Log in

- Figma: desktop `137:7477`, mobile none (decisions #4) (screenshots: `docs/figma/101. Login.png`)
- Story: As a returning user I want to sign in with my email and password so that I can reach my financial dashboard.

Acceptance criteria:
1. Given I open the login screen, when it renders, then I see, top to bottom:
   - the "FINEbank.IO" logo
   - an "Email Address" field
   - a "Password" field with a "Forgot Password?" link to the right of its label
   - a "Keep me signed in" checkbox
   - a "Login" primary button
   - an "or sign in with" divider
   - a "Continue with Google" secondary button with the Google icon
   - a "Create an account" link
2. Given the password field, when I type, then the characters are masked and an eye icon shows at the right edge.
3. Given the password field, when I click the eye icon, then the password switches between masked and visible.
4. Given the "Keep me signed in" checkbox, when I click it, then it switches between checked (teal with a white check) and unchecked.
5. Given I focus or fill a field, when it is active, then it shows the active input style (darker border), as in the filled email field.
6. Given I click "Forgot Password?", then the Forgot Password screen opens (US-03).
7. Given I click "Create an account", then the Sign up screen opens (US-02).
8. Given I entered a valid email and password, when I click "Login", then I am signed in and the Overview opens (US-05).
9. Given a field is empty or invalid, when I click "Login", then the form is not submitted and an error is shown.

States:
- Designed: default; email filled (Input Active=Yes); password masked (Input Type=Password); checkbox checked (Remind me Active=Yes). Component variants also exist for Show Password and checkbox unchecked.
- Missing from design: validation errors, wrong credentials, loading while signing in, Google sign-in flow (see decisions #2, #6, #14)

Out of scope: how authentication is implemented (#2), session duration of "Keep me signed in" (#14), Google sign-in until #2 is answered.
Assumptions: ASSUMPTION: the eye icon toggles visibility (the Input component has Password and Show Password variants). ASSUMPTION: a successful login opens Overview (#3). ASSUMPTION: empty or invalid fields block submit (rules in #14).
Open questions: decisions #2, #3, #6, #14

---

## US-02: Sign up

- Figma: desktop `137:8071`, mobile none (decisions #4) (screenshots: `docs/figma/102. Signup.png`)
- Story: As a new visitor I want to create an account so that I can start using the dashboard.

Acceptance criteria:
1. Given I open the sign up screen, when it renders, then I see, top to bottom:
   - the "FINEbank.IO" logo
   - the heading "Create an account"
   - a "Name" field
   - an "Email Address" field with placeholder "hello@example.com"
   - a "Password" field (masked, with an eye icon)
   - the text "By continuing, you agree to our terms of service.", where "terms of service." is a teal link
   - a "Sign up" primary button
   - an "or sign up with" divider
   - a "Continue with Google" button
   - the text "Already have an account? Sign in here", where "Sign in here" is a teal link
2. Given the password field, when I click the eye icon, then the password switches between masked and visible.
3. Given I click "Sign in here", then the Login screen opens (US-01).
4. Given all fields are valid, when I click "Sign up", then the account is created and I land on the next screen.
5. Given a field is empty or invalid, when I click "Sign up", then the form is not submitted and an error is shown.

States:
- Designed: default with Name filled (active border, sample "Tanzir Rahman"); Email empty with placeholder; password masked
- Missing from design: validation errors, email already registered, loading, success (see decisions #6, #15)

Out of scope: the terms of service page content (#15), Google sign-up until #2 is answered.
Assumptions: ASSUMPTION: the eye icon toggles visibility. ASSUMPTION: after sign up the user lands on Overview (#3, #15). ASSUMPTION: empty or invalid fields block submit (rules in #15).
Open questions: decisions #2, #3, #6, #15

---

## US-03: Forgot password

- Figma: desktop `167:7873`, mobile none (decisions #4) (screenshots: `docs/figma/103. Forgot Password.png`)
- Story: As a user who forgot my password I want to request a reset link so that I can get back into my account.

Acceptance criteria:
1. Given I open the forgot password screen, when it renders, then I see:
   - the "FINEbank.IO" logo
   - the heading "Forgot Password?"
   - the text "Enter your email address to get the password reset link."
   - an "Email Address" field with placeholder "hello@example.com"
   - a "Password Reset" primary button
   - a gray "Back to login" link
2. Given I click "Back to login", then the Login screen opens (US-01).
3. Given I entered a valid email, when I click "Password Reset", then the request is sent and I see a confirmation.
4. Given the email is empty or invalid, when I click "Password Reset", then the request is not sent and an error is shown.

States:
- Designed: default (empty email)
- Missing from design: confirmation or success state, error state, loading, the reset-password page the link opens (see decisions #6, #16)

Out of scope: the page that sets a new password from the email link (not designed, #16).
Assumptions: ASSUMPTION: a confirmation is shown after submit (not designed, #16). ASSUMPTION: an invalid email blocks submit (#14).
Open questions: decisions #2, #6, #14, #16

---

## US-04: App shell (sidebar and header)

- Figma: desktop: Nav bar component `411:6442` (instance `411:6510` in 104) and Header component `411:6067` (instance `411:6089` in 104), on every app frame 104 to 112. Mobile none (decisions #4). Screenshots: `docs/figma/104. Overview.png`, `docs/figma/105. Balances.png`, and every app PNG.
- Story: As a signed-in user I want a persistent sidebar and header so that I can move between sections and reach search and notifications from any screen.

Acceptance criteria:
1. Given I am on any app screen, when it renders, then a dark left sidebar shows:
   - the "FINEbank.IO" logo
   - the menu items Overview, Balances, Transactions, Bills, Expenses, Goals and Settings, each with its icon
   - a "Logout" button near the bottom
   - a profile block with avatar, user name (sample "Tanzir Rahman"), "View profile" and a vertical three-dot icon
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
5. Given I am on Account Details (US-12), when the sidebar renders, then "Balances" is the active item.
6. Given I am on any app screen, when the header renders, then it shows:
   - a "»" icon followed by a date (sample "May 19, 2023")
   - a bell icon with a teal dot
   - a search field with placeholder "Search here" and a search icon
7. Given I am on Overview, when the header renders, then the greeting "Hello <first name>" (sample "Hello Tanzir") shows before the date. On every other app screen, only the date shows.
8. Given I click "Logout", then I am signed out and the Login screen opens (US-01).

States:
- Designed: menu item Active, Inactive and Hover (component variants); bell with dot
- Missing from design: search results, notifications panel, bell without dot, profile or three-dot menu, avatar without photo (see decisions #7, #8, #9)

Out of scope: search results, notifications panel and profile menu until #7, #8 and #9 are answered.
Assumptions: ASSUMPTION: Logout signs out and opens Login (#3). ASSUMPTION: the header date is the current date (#10). ASSUMPTION: Account Details counts as part of Balances.
Open questions: decisions #3, #7, #8, #9, #10

---

## US-05: Overview: Total Balance

- Figma: desktop `66:4732`, section `405:5461`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to see my total balance and browse my accounts on the Overview so that I know how much money I have.

Acceptance criteria:
1. Given I open Overview, when the "Total Balance" card renders, then it shows the total amount (sample "$240,399") and the label "All Accounts".
2. Given the card renders, then it shows one account at a time as a teal card with:
   - the label "Account Type"
   - the type (sample "Credit Card")
   - the masked number (sample "**** **** **** 2598")
   - a card-network logo (sample Mastercard)
   - the account amount (sample "$25000")
   - a round arrow icon
3. Given the card renders, then a control below it shows "Previous" (with left chevron), 3 dots and "Next" (with right chevron).
4. Given the first account is shown, then "Previous" is muted (gray) and the first dot is active (teal).
5. Given I click "Next", then the next account shows and the active dot moves one step.
6. Given I click "Previous" when not on the first account, then the previous account shows.

States:
- Designed: first account selected
- Missing from design: last account (is "Next" muted?), no accounts, loading, error (see decisions #6, #17)

Out of scope: what "All Accounts" and the round arrow icon do (#17).
Assumptions: ASSUMPTION: muted "Previous" means disabled on the first item. ASSUMPTION: Previous and Next step through the user's accounts (#17).
Open questions: decisions #1, #6, #11, #17

---

## US-06: Overview: Goals card and edit goal popup

- Figma: desktop `66:4732`, section `405:5491`; popup state `416:7385` (Popup Input instance `416:7863`, component `416:6381`); mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`, `docs/figma/104.1. Overview.png`)
- Story: As a signed-in user I want to see this month's savings target against what I achieved, and edit it, so that I can track my progress.

Acceptance criteria:
1. Given I open Overview, when the "Goals" card renders, then it shows the target amount (sample "$20,000") with a pencil icon button next to it, and the month (sample "May, 2023").
2. Given the card renders, then it shows "Target Achieved" with a trophy icon and amount (sample "$12,500"), and "This month Target" with a target icon and amount (sample "$20,000").
3. Given the card renders, then it shows a semicircle gauge labelled "Target vs Achievement". The gauge shows a min label (sample "$0"), a max label (sample "$20k") and the achieved value in the center (sample "12K"), with the teal arc and needle at the achieved share.
4. Given I click the pencil icon, then a modal opens over the content area with:
   - a close (X) button
   - a "Target Amounts" field (sample value "$500000")
   - a "Present Amounts" field (placeholder "Write presents amounts here")
   - a "Save" primary button
5. Given the modal is open, then the content area behind it is dimmed, and the sidebar and header are not.
6. Given the modal is open, when I click X, then it closes and nothing changes.
7. Given I entered valid amounts, when I click "Save", then the modal closes and the Goals card shows the new values.
8. Given an amount is empty or not a number, when I click "Save", then nothing is saved and an error is shown.

States:
- Designed: card default; modal open (104.1)
- Missing from design: validation error, saving or loading, save failure, card loading, empty or error (see decisions #6, #18)

Out of scope: how the gauge value is calculated beyond what the design shows (#18).
Assumptions: ASSUMPTION: the pencil icon opens the 104.1 popup (#18). ASSUMPTION: X closes without saving. ASSUMPTION: Save updates the card (#18). ASSUMPTION: non-numeric input blocks save (#31).
Open questions: decisions #1, #6, #18, #31, #35

---

## US-07: Overview: Upcoming Bill

- Figma: desktop `66:4732`, section `405:5530`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to see my next bills on the Overview so that I am not surprised by upcoming charges.

Acceptance criteria:
1. Given I open Overview, when the "Upcoming Bill" card renders, then it shows the title and a "View All" link with a right chevron.
2. Given the card renders, then each bill row (sample: 2 rows) shows:
   - a gray date box with month (sample "May") and day (sample "15")
   - the biller logo (sample Figma)
   - the bill title (sample "Figma - Monthly")
   - "Last Charge - <date>" (sample "Last Charge - 14 May, 2022")
   - the amount in a bordered box (sample "$150")
3. Given there are two rows, then a divider line separates them.
4. Given I click "View All", then the Bills screen opens (US-14).

States:
- Designed: 2 bills
- Missing from design: no upcoming bills, more than 2 bills, loading, error (see decisions #6, #28)

Out of scope: bill actions (#28).
Assumptions: ASSUMPTION: "View All" opens Bills (US-14). ASSUMPTION: the widget shows a limited number of the nearest bills (count in #28).
Open questions: decisions #1, #6, #12, #28

---

## US-08: Overview: Recent Transaction

- Figma: desktop `66:4732`, section `66:4747`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to see my latest transactions on the Overview, filtered by type, so that I can spot recent activity quickly.

Acceptance criteria:
1. Given I open Overview, when the "Recent Transaction" card renders, then it shows the title and a "View All" link with a right chevron.
2. Given the card renders, then it shows the tabs "All", "Revenue" and "Expenses". "All" is active (teal text with teal underline).
3. Given the "All" tab is active, then the list (sample: 5 rows) shows on each row:
   - a category icon in a gray square
   - the item name (sample "GTR 5")
   - the shop name below it (sample "Gadget & Gear")
   - the amount on the right (sample "$160.00")
   - the date below the amount (sample "17 May 2023")
4. Given the list renders, then rows are separated by divider lines.
5. Given I click "Revenue" or "Expenses", then that tab becomes active and the list shows only transactions of that type.
6. Given I click "View All", then the Transactions screen opens (US-13).

States:
- Designed: "All" tab active with 5 rows
- Missing from design: Revenue and Expenses active states, empty list, loading, error (see decisions #6, #19)

Out of scope: none
Assumptions: ASSUMPTION: the Revenue and Expenses tabs filter the list (#19). ASSUMPTION: "View All" opens Transactions (US-13).
Open questions: decisions #1, #6, #19

---

## US-09: Overview: Statistics (weekly comparison)

- Figma: desktop `66:4732`, section `66:4933`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to compare this week with last week in a chart so that I can see how my money flow is changing.

Acceptance criteria:
1. Given I open Overview, when the "Statistics" card renders, then its header shows "Weekly Comparison" with a down chevron, and a legend: "This week" (teal swatch) and "Last week" (light gray swatch).
2. Given the chart renders, then it shows 7 day groups on the x-axis (sample "17 Sun" to "23 Sat"), each with a light gray bar (last week) and a teal bar (this week).
3. Given the chart renders, then the y-axis shows the labels "$0", "$2k", "$10k", "$50k" and "$250k", with horizontal grid lines.
4. Given I click "Weekly Comparison", then a list of comparison options opens.

States:
- Designed: default chart
- Missing from design: dropdown options, bar hover or tooltip, no data, loading, error (see decisions #6, #20)

Out of scope: chart interactions beyond what is designed (#20).
Assumptions: ASSUMPTION: the chevron opens a dropdown (#20). ASSUMPTION: the chart shows the same measure as the y-axis labels; what it measures is in #20.
Open questions: decisions #1, #6, #20

---

## US-10: Overview: Expenses Breakdown

- Figma: desktop `66:4732`, section `66:4999`, mobile none (decisions #4) (screenshots: `docs/figma/104. Overview.png`)
- Story: As a signed-in user I want to see my spending per category compared with last month so that I know where my money goes.

Acceptance criteria:
1. Given I open Overview, when the "Expenses Breakdown" card renders, then the title shows with the note "*Compare to last month" on the right.
2. Given the card renders, then it shows 6 categories in a 3x2 grid, separated by lines: Housing, Food, Transportation, Entertainment, Shopping and Others.
3. Given a category cell renders, then it shows:
   - the category icon in a gray square
   - the category name
   - the amount (sample Housing "$250.00")
   - a percentage with an asterisk (sample "15%*")
   - an arrow, red and pointing up, or green and pointing down
   - a right arrow
4. Given a category's percentage is an increase, then its arrow points up in red (`E73D1C`). Given it is a decrease, then the arrow points down in green (`4DAF6E`).
5. Given I click a category's right arrow, then the Expenses screen opens (US-15).

States:
- Designed: default. The Housing right arrow is teal while the others are gray, which may be a hover state (#21).
- Missing from design: no expenses, loading, error (see decisions #6, #21)

Out of scope: none
Assumptions: ASSUMPTION: up means spending went up compared with last month. ASSUMPTION: the right arrow opens Expenses (#21).
Open questions: decisions #1, #6, #21

---

## US-11: Balances: account list

- Figma: desktop `66:5320` (Account Type instances `410:5376` and siblings, component `410:5353`; Add Account cell `410:5516`), mobile none (decisions #4) (screenshots: `docs/figma/105. Balances.png`)
- Story: As a signed-in user I want to see all my accounts with their balances so that I can manage them in one place.

Acceptance criteria:
1. Given I open Balances, when it renders, then the title "Balances" shows, "Balances" is the active sidebar item, and the header shows only the date.
2. Given I have accounts, then each account shows as a card in a 3-column grid (sample: 5 cards) with:
   - the account type (sample "Credit Card")
   - the bank or issuer name (sample "Master Card")
   - a card-network logo where available (sample Mastercard, VISA)
   - the account number (sample "3388 4556 8860 8***") with the label "Account Number"
   - the amount (sample "$25000") with the label "Total amount"
   - a teal "Remove" text link
   - a teal "Details" button with a right chevron
3. Given the grid renders, then the last cell shows an "Add Accounts" primary button and a gray "Edit Accounts" text link.
4. Given I click "Details" on a card, then the Account Details screen opens for that account (US-12).
5. Given I click "Remove", "Add Accounts" or "Edit Accounts", then the not-yet-designed flow for that action starts (#22, #23).

States:
- Designed: 5 accounts plus the add cell
- Missing from design: no accounts, many accounts, loading, error, remove confirmation, Add and Edit Accounts flows (see decisions #6, #22, #23, #24)

Out of scope: the Add Accounts form, the Edit Accounts flow and the remove flow until #22 and #23 are answered.
Assumptions: ASSUMPTION: "Details" opens Account Details for that account. ASSUMPTION: the add cell is always last in the grid (#24).
Open questions: decisions #1, #6, #22, #23, #24, #25

---

## US-12: Account Details

- Figma: desktop `416:7878`, mobile none (decisions #4) (screenshots: `docs/figma/106. Account Details.png`)
- Story: As a signed-in user I want to see the details and transaction history of one account so that I can check what happened on it.

Acceptance criteria:
1. Given I open an account's details, when it renders, then the title "Account Details" shows and "Balances" is the active sidebar item.
2. Given the details card renders, then it shows these labelled values:
   - "Bank Name" (sample "AB Bank Ltd.")
   - "Account Type" (sample "Checking")
   - "Balance" (sample "$25,056.00")
   - "Branch Name" (sample "Park Street Branch")
   - "Account Number" (sample "133 456 886 8****")
3. Given the details card renders, then it shows an "Edit Details" primary button and a "Remove" text button.
4. Given the "Transactions History" section renders, then a table shows the columns Date, Status, Transaction Type, Receipt and Amount. Amounts are bold and right-aligned. Sample row: "17 Apr, 2023", "Complete", "Credit", "8C52d5DKDJ5", "$160.00".
5. Given the table renders, then rows are separated by divider lines and a "Load More" primary button shows below the table.
6. Given I click "Load More", then more rows are added to the table.
7. Given I click "Edit Details" or "Remove", then the not-yet-designed flow for that action starts (#23, #26).

States:
- Designed: details plus 4 history rows
- Missing from design: loading, error, no transactions, end of list, edit and remove flows, a back control (see decisions #6, #23, #26, #27)

Out of scope: the edit details form and the remove flow until #23 and #26 are answered.
Assumptions: ASSUMPTION: "Load More" appends the next page (#27). ASSUMPTION: the user returns to Balances through the sidebar only (#26).
Open questions: decisions #1, #6, #12, #23, #26, #27

---

## US-13: Transactions

- Figma: desktop `66:5474`, mobile none (decisions #4) (screenshots: `docs/figma/107. Transactions.png`)
- Story: As a signed-in user I want a full list of my transactions, filterable by type, so that I can review my spending and income.

Acceptance criteria:
1. Given I open Transactions, when it renders, then the title "Recent Transaction" shows and "Transactions" is the active sidebar item.
2. Given the screen renders, then the tabs "All", "Revenue" and "Expenses" show above the table. "All" is active (teal text and underline).
3. Given the table renders, then it shows the columns Items, Shop Name, Date, Payment Method and Amount. Each row has a category icon and item name in the first column, and the amount is bold and right-aligned. Sample row: "GTR 5", "Gadget & Gear", "17 May, 2023", "Credit Card", "$160.00". The sample has 7 rows.
4. Given I click "Revenue" or "Expenses", then that tab becomes active and the table shows only transactions of that type.
5. Given I click "Load More", then more rows are added to the table.

States:
- Designed: "All" tab with 7 rows
- Missing from design: Revenue and Expenses active states, empty, loading, error, end of list (see decisions #6, #19, #27)

Out of scope: none
Assumptions: ASSUMPTION: the tabs filter the table (#19). ASSUMPTION: "Load More" appends the next page (#27).
Open questions: decisions #1, #6, #19, #27

---

## US-14: Bills

- Figma: desktop `66:5609`, mobile none (decisions #4) (screenshots: `docs/figma/108. Bills.png`)
- Story: As a signed-in user I want to see all my upcoming bills with due dates and amounts so that I can plan my payments.

Acceptance criteria:
1. Given I open Bills, when it renders, then the title "Upcoming Bills" shows and "Bills" is the active sidebar item.
2. Given the table renders, then it shows the columns Due Date, Logo, Item Description, Last Charge and Amount.
3. Given a bill row renders (sample: 2 rows), then it shows:
   - a gray date box with month and day (sample "May" / "15")
   - the biller logo (sample Figma)
   - a bold title (sample "Figma - Yearly Plan") with a description paragraph below it
   - the last charge date (sample "14 May, 2022")
   - the amount in a bordered box (sample "$150")
4. Given there are several rows, then divider lines separate them.

States:
- Designed: 2 bills
- Missing from design: no bills, many bills or pagination, loading, error, any bill action (see decisions #6, #28)

Out of scope: paying, adding or editing bills (not designed, #28).
Assumptions: none
Open questions: decisions #1, #6, #12, #28

---

## US-15: Expenses

- Figma: desktop `66:5698`, mobile none (decisions #4) (screenshots: `docs/figma/109. Expenses.png`)
- Story: As a signed-in user I want to compare my expenses over time and see them per category so that I understand my spending habits.

Acceptance criteria:
1. Given I open Expenses, when it renders, then "Expenses" is the active sidebar item and the section "Expenses Comparison" shows a card with:
   - "Monthly Comparison" and a down chevron
   - a legend: "This Week" (teal) and "Last Week" (gray), labelled as designed (#29)
2. Given the chart renders, then it shows 12 month groups (Jan to Dec), each with a gray bar and a teal bar, and the y-axis labels "$0", "$2k", "$10k", "$50k" and "$250k" with grid lines.
3. Given the "Expenses Breakdown" section renders, then 6 category cards show in a 3x2 grid: Housing, Food, Transportation, Entertainment, Shopping and Others.
4. Given a category card renders, then its gray header shows:
   - the category icon
   - the category name
   - the total (sample Housing "$250.00")
   - the percentage (sample "15%"), with an up arrow in red or a down arrow in green
   - the text "Compare to last month"
5. Given a category card renders, then its body lists line items (sample: 2 per card), separated by a divider. Each shows a name (sample "House Rent"), an amount (sample "$230.00") and a date (sample "17 May 2023").
6. Given I click "Monthly Comparison", then a list of comparison options opens.

States:
- Designed: default with 2 line items per category
- Missing from design: dropdown options, more than 2 line items, no expenses, loading, error, chart tooltips (see decisions #6, #29)

Out of scope: none
Assumptions: ASSUMPTION: the chevron opens a dropdown (#29). ASSUMPTION: the arrow colours mean the same as on Overview (US-10).
Open questions: decisions #1, #6, #12, #29

---

## US-16: Goals

- Figma: desktop `66:5829`, mobile none (decisions #4) (screenshots: `docs/figma/110. Goals.png`)
- Story: As a signed-in user I want to see my savings goal, my saving trend and my expense goals per category so that I can keep my finances on track.

Acceptance criteria:
1. Given I open Goals, when it renders, then the title "Goals" shows and "Goals" is the active sidebar item.
2. Given the "Savings Goal" card renders, then it shows:
   - a period selector (sample "01 May ~ 31 May") with a down chevron
   - "Target Achieved" (sample "$12,500")
   - "This month Target" (sample "$20,000")
   - a gauge labelled "Target vs Achievement" with min, center and max values (sample "$0", "12K", "$20k")
   - an outlined teal "Adjust Goal" button with a pencil icon
3. Given the "Saving Summary" card renders, then it shows:
   - a period selector (sample "Mar 2022") with a down chevron
   - a legend: "This month" (teal) and "Same period last month" (gray)
   - a line chart with a teal line and teal gradient fill for this month, and a dashed gray line for last month
   - y-axis labels "$0", "$500", "$2000" and "$5000"
   - x-axis labels May 01, May 05, May 10, May 15, May 20, May 25 and May 30, with vertical grid lines
4. Given the "Expenses Goals by Category" section renders, then 6 cards show in a 3x2 grid: Housing, Food, Transportation, Entertainment, Shopping and Others. Each card has the category icon, name, amount (sample "$250.00") and an outlined teal "Adjust" button with a pencil icon.
5. Given I click "Adjust Goal", then the savings goal popup opens (US-17, criterion 1).
6. Given I click "Adjust" on a category card, then the category goal popup opens (US-17, criterion 2).
7. Given I click a period selector, then a list of periods opens.

States:
- Designed: default
- Missing from design: period selector options, chart tooltips, no goals set, loading, error (see decisions #6, #30, #32)

Out of scope: none
Assumptions: ASSUMPTION: "Adjust Goal" opens the 110.1 popup and "Adjust" opens the 110.2 popup (#31). ASSUMPTION: the selectors open a period list (#30).
Open questions: decisions #1, #6, #30, #31, #32

---

## US-17: Goals: adjust goal popups

- Figma: desktop `416:6052` (110.1) and `416:6413` (110.2), component Popup Input `416:6381`, mobile none (decisions #4) (screenshots: `docs/figma/110.1. Goals.png`, `docs/figma/110.2. Goals.png`)
- Story: As a signed-in user I want to change my savings target and my category targets so that my goals match my plans.

Acceptance criteria:
1. Given I clicked "Adjust Goal", when the popup opens, then it shows a close (X) button, a "Target Amounts" field (sample "$500000"), a "Present Amounts" field (placeholder "Write presents amounts here") and a "Save" primary button.
2. Given I clicked "Adjust" on a category card, when the popup opens, then it shows a close (X) button, a "Target Amounts" field (sample "$500000") and a "Save" primary button, with no "Present Amounts" field.
3. Given a popup is open, then the content area behind it is dimmed, and the sidebar and header are not.
4. Given a popup is open, when I click X, then it closes and nothing changes.
5. Given I entered a valid amount, when I click "Save", then the popup closes and the matching card on Goals shows the new value.
6. Given an amount is empty or not a number, when I click "Save", then nothing is saved and an error is shown.

States:
- Designed: savings popup with two fields (110.1); category popup with one field (110.2)
- Missing from design: validation error, saving, save failure, success feedback (see decisions #31)

Out of scope: none
Assumptions: ASSUMPTION: which popup opens from which button (#31). ASSUMPTION: X closes without saving. ASSUMPTION: Save updates the card (#31). ASSUMPTION: non-numeric input blocks save (#31).
Open questions: decisions #31, #35

---

## US-18: Settings: Account tab

- Figma: desktop `66:6324`, mobile none (decisions #4) (screenshots: `docs/figma/111. Settings.png`)
- Story: As a signed-in user I want to view and update my profile details and photo so that my account information is correct.

Acceptance criteria:
1. Given I open Settings, when it renders, then "Settings" is the active sidebar item and a card shows the tabs "Account" and "Security". "Account" is active (teal text and underline).
2. Given the Account tab is active, then it shows the labelled fields:
   - "Full name" (sample "Tanzir Rahman")
   - "Email" (sample "tanzir.rahman@email.com")
   - "Username" (sample "tanzir.rahman")
   - "Phone Number": a country code and a number separated by a vertical divider (sample "+880" and "51547 58868")
3. Given the Account tab is active, then "Your Profile Picture" shows a dashed upload box with an image icon and the text "Upload your photo".
4. Given the Account tab is active, then an "Update Profile" primary button shows below the fields.
5. Given I click "Security", then the Security tab opens (US-19).
6. Given I click the upload box, then a file picker opens to choose a photo.
7. Given I changed a field, when I click "Update Profile", then the changes are saved and I see a confirmation.
8. Given a field is invalid, when I click "Update Profile", then nothing is saved and an error is shown.

States:
- Designed: Account tab with filled values; empty upload box
- Missing from design: editable or focused field style, validation errors, photo preview after upload, upload error, saving, success feedback (see decisions #33)

Out of scope: none
Assumptions: ASSUMPTION: the fields are editable even though no input borders are drawn (#33). ASSUMPTION: the upload box opens a file picker (#33). ASSUMPTION: Update Profile saves and confirms (#33).
Open questions: decisions #1, #33

---

## US-19: Settings: Security tab

- Figma: desktop `123:7763`, mobile none (decisions #4) (screenshots: `docs/figma/112. Settings.png`)
- Story: As a signed-in user I want to change my password so that my account stays secure.

Acceptance criteria:
1. Given I click the "Security" tab, when it renders, then "Security" is active (teal text and underline) and "Account" is inactive.
2. Given the Security tab is active, then it shows:
   - the masked fields "Old Password", "New Password" and "Retype Password"
   - the field "Phone Number" (sample "+880" and "51547 58868")
   - an "Update Password" primary button
3. Given I click "Account", then the Account tab opens (US-18).
4. Given "New Password" and "Retype Password" do not match, when I click "Update Password", then nothing is saved and an error is shown.
5. Given all fields are valid, when I click "Update Password", then the password is changed and I see a confirmation.

States:
- Designed: Security tab with masked values
- Missing from design: field focus style, validation errors, wrong old password, saving, success feedback (see decisions #34)

Out of scope: what the phone number on this tab is for (#34).
Assumptions: ASSUMPTION: a mismatch between new and retyped password blocks submit (#34). ASSUMPTION: a successful change shows a confirmation (#34).
Open questions: decisions #2, #34
