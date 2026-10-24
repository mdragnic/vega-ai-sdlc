# Finebank: demo dataset (APPROVED)

Status: APPROVED by Marko on 2026-10-22. Written on 2026-10-22 per `docs/decisions.md` #53 and reviewed before the first backend task.
Sources: the PNG exports in `docs/figma/` (no Figma calls) and decisions #1, #11, #12, #17 to #19, #24 to #28, #31, #32, #38, #43, #53 to #59, #62. Values that Figma does not show are marked "invented".

## Rules

- Every new user gets their own copy of this dataset on sign up, including a new user created through Google (decisions #1, #2, #53).
- The dataset is fixed: dates and values do not depend on the sign-up date, and nothing rolls or regenerates. The rules below are applied once to produce a static seed file, the same for every user (decisions #53).
- It covers 1 Jan 2022 to 31 Dec 2028. Entries dated after today are not shown or counted yet. Bills are the exception: their future due dates are what "upcoming" means, and a bill drops off once its due date passes (decisions #41, #53).
- Each entity exists once. Where Figma conflicts, the entity's own detail screen wins (Balances for accounts, Transactions for transactions, Bills for bills), and between Transactions and Expenses, Transactions wins. Totals, balances and percentages are not stored; the backend calculates them (decisions #12, #56, #57).
- Money is stored exactly, in USD (decisions #11). Each transaction's timestamp is 12:00 UTC on its date, so the date reads the same in every browser time zone from UTC-12 to UTC+11 (decisions #11, #54). Due dates and last charge dates are plain dates (decisions #11).

Size per user: 5 accounts, 3,411 transactions (about 41 a month for 84 months), 14 bills, 84 monthly savings goals and 6 category spending limits.

## Profile

The profile is not part of the dataset. Full Name and Email come from sign up or Google, the username is generated from the email (decisions #62), the phone number is empty with country code +1 (decisions #43), and there is no photo (decisions #38). Figma's sample profile (Tanzir Rahman, `tanzir.rahman@email.com`, `tanzir.rahman`, +880 51547 58868) is not seeded.

## Accounts

Created in this order, so Balances and the Total Balance carousel show them oldest first (decisions #24).

| # | Account Type | Bank Name | Branch Name | Card network | Account number (stored) | Shown as (decisions #25) | Opening balance, 1 Jan 2022 |
|---|--------------|-----------|-------------|--------------|-------------------------|--------------------------|-----------------------------|
| 1 | Credit Card | Master Card | Main Branch (invented) | Mastercard | 3388 4556 8860 2598 | `**** **** **** 2598` | $25,000.00 |
| 2 | Checking | AB Bank Ltd | Park Street Branch | VISA | 6934 5669 9012 7310 (invented) | `**** **** **** 7310` | $25,000.00 |
| 3 | Savings | Brac Bank Ltd. | Gulshan Branch (invented) | none | 1334 5688 6801 4421 (invented) | `**** **** **** 4421` | $25,000.00 |
| 4 | Investment | AB Bank Ltd | Park Street Branch (invented) | none | 6984 5686 6201 6652 (invented) | `**** **** **** 6652` | $25,000.00 |
| 5 | Loan | City Bank Ltd. | Motijheel Branch (invented) | none | 3634 5689 6601 9083 (invented) | `**** **** **** 9083` | $25,000.00 |

Figma values and how conflicts were resolved:
- Types, Bank Names and card networks come from Balances, which wins over Account Details: Checking's Bank Name is "AB Bank Ltd", not Account Details' "AB Bank Ltd." (decisions #12, #57).
- Account Details shows Checking with the Savings card's number ("133 456 886 8****"). Balances wins, so Checking keeps its own number (decisions #12).
- Only the Credit Card's last 4 digits appear in Figma ("2598", on Overview). Balances' "3388 4556 8860 8***" gives a different 13th digit, but only the last 4 digits are ever shown (decisions #25), so Overview's are kept. The other numbers keep Figma's visible leading digits from Balances; their last 4 are invented.
- Figma's balances ($25000 on Balances, $25,056.00 on Account Details, $240,399 Total Balance) are not stored. A balance is the opening balance plus the account's Complete transactions dated up to today (decisions #17, #57). The opening balance is Figma's Balances value.

## Categories

Six fixed categories, the same for every user (decisions #56). Icons use the code names in `docs/figma/components.md`.

| Category | Icon | Spending limit (decisions #32) |
|----------|------|--------------------------------|
| Housing | `Housing` | $250.00 |
| Food | `Food` | $250.00 |
| Transportation | `Transport` | $250.00 |
| Entertainment | `Movie` | $250.00 |
| Shopping | `Shopping` | $250.00 |
| Others | `Others` | $250.00 |

Income has no category and uses the `Wallet` icon (decisions #56). The limits are Figma's Goals values, one per category, not per month (decisions #32).

## Transactions

### Monthly template

Every month from Jan 2022 to Dec 2028 has these rows. A row on day 29, 30 or 31 exists only in months that have that day. Transaction Type follows the direction: income is Credit, expense is Debit (decisions #27). Payment Method on Transactions is the account's type (decisions #57).

Income (no category):

| Day | Item | Shop Name | Account | Base amount |
|-----|------|-----------|---------|-------------|
| 1 | Design project (invented) | Acme Ltd. (invented) | Checking | $700.00 |
| 3, 10, 17, 24 | Freelance payment (invented) | Bright Studio (invented) | Checking | $160.00 |
| 15 | Dividend (invented) | AB Bank Ltd | Investment | $75.00 |
| 27 | Card repayment (invented) | AB Bank Ltd | Credit Card | $450.00 |
| 28 | Interest (invented) | Brac Bank Ltd. | Savings | $40.00 |

Expenses:

| Day | Item | Shop Name | Category | Account | Base amount | Status |
|-----|------|-----------|----------|---------|-------------|--------|
| 1 | House Rent | Park View Apartments (invented) | Housing | Checking | $230.00 | Complete |
| 2 | Polo shirt | XL fashions | Shopping | Credit Card | $20.00 | Complete |
| 3 | Taxi fare | Uber | Transportation | Credit Card | $10.00 | Complete |
| 4 | Grocery | Green Grocers (invented) | Food | Checking | $230.00 | Complete |
| 5 | Biriyani | Hajir Biriyani | Food | Credit Card | $12.00 | Complete |
| 6 | Movie ticket | Inox | Entertainment | Credit Card | $15.00 | Complete |
| 7 | Metro Card bill | Metro Rail (invented) | Transportation | Checking | $20.00 | Complete |
| 8 | Pizza | Pizza Hit | Food | Credit Card | $20.00 | Complete |
| 9 | Keyboard | Gadget & Gear | Shopping | Credit Card | $30.00 | Complete |
| 10 | Loan installment (invented) | City Bank Ltd. | Others | Loan | $100.00 | Complete |
| 11 | Donation | City Charity Trust (invented) | Others | Checking | $30.00 | Complete |
| 12 | iTunes | iTunes Store (invented) | Entertainment | Checking | $50.00 | Complete |
| 13 | Taxi fare | Uber | Transportation | Credit Card | $10.00 | Complete |
| 14 | Parking | City Parking (invented) | Housing | Checking | $20.00 | Complete |
| 15 | Shirt | XL fashions | Shopping | Checking | $230.00 | Complete |
| 16 | Biriyani | Hajir Biriyani | Food | Credit Card | $12.00 | Complete |
| 16 | Pizza | Pizza Hit | Food | Credit Card | $20.00 | Failed |
| 17 | GTR 5 | Gadget & Gear | Entertainment | Credit Card | $160.00 | Complete |
| 18 | Restaurant bill | Spice Garden (invented) | Food | Checking | $120.00 | Complete |
| 19 | Taxi fare | Uber | Transportation | Credit Card | $10.00 | Complete |
| 20 | Pizza | Pizza Hit | Food | Credit Card | $20.00 | Complete |
| 21 | Movie ticket | Inox | Entertainment | Credit Card | $15.00 | Complete |
| 22 | Jeans | Denim House (invented) | Shopping | Checking | $190.00 | Complete |
| 23 | Biriyani | Hajir Biriyani | Food | Credit Card | $12.00 | Complete |
| 24 | Gift | Gift Corner (invented) | Others | Checking | $20.00 | Complete |
| 25 | Taxi fare | Uber | Transportation | Credit Card | $10.00 | Complete |
| 25 | Polo shirt | XL fashions | Shopping | Credit Card | $20.00 | Pending |
| 26 | Polo shirt | XL fashions | Shopping | Credit Card | $20.00 | Complete |
| 27 | Parking | City Parking (invented) | Housing | Checking | $20.00 | Complete |
| 28 | Pizza | Pizza Hit | Food | Credit Card | $20.00 | Complete |
| 29 | Taxi fare | Uber | Transportation | Credit Card | $10.00 | Complete |
| 30 | Movie ticket | Inox | Entertainment | Credit Card | $15.00 | Complete |
| 31 | Biriyani | Hajir Biriyani | Food | Credit Card | $12.00 | Complete |

Every day from 2022 to 2028 has at least one Complete expense, so the Statistics chart has a bar on every day up to today. Each Pending or Failed row has a Complete expense on the same day. All statuses are listed; only Complete rows count (decisions #57).

Bill charges are added to this template; see Bills below.

### Amounts per month

The base amounts vary by year and month, so charts and the change vs last month are not flat:
- Income: base x year factor.
- Expense: base x year factor x category-month factor.
- Bill charges: fixed, not scaled.
- Rounding: to the cent, half up, in integer cents: `cents = round_half_up(base_cents x year% x month% / 10000)`.

| Year | 2022 | 2023 | 2024 | 2025 | 2026 | 2027 | 2028 |
|------|------|------|------|------|------|------|------|
| Factor | 95% | 100% | 104% | 108% | 112% | 116% | 120% |

| Category | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Housing | 100% | 95% | 100% | 87% | 100% | 105% | 95% | 110% | 100% | 90% | 105% | 120% |
| Food | 110% | 95% | 105% | 109% | 100% | 90% | 115% | 105% | 95% | 110% | 100% | 125% |
| Transportation | 95% | 100% | 110% | 114% | 100% | 85% | 105% | 120% | 100% | 95% | 110% | 115% |
| Entertainment | 120% | 90% | 100% | 118% | 100% | 110% | 125% | 95% | 85% | 105% | 115% | 130% |
| Shopping | 115% | 85% | 90% | 80% | 100% | 120% | 95% | 110% | 105% | 125% | 90% | 140% |
| Others | 90% | 105% | 95% | 81% | 100% | 110% | 100% | 85% | 120% | 95% | 105% | 115% |

The 2023 factor and every May factor are 100%, so May 2023 has every Figma amount exactly: for example GTR 5 is $160.00 on 17 May 2023, Figma's date. In October 2026, Taxi fare is $10.00 x 112% x 95% = $10.64.

### Figma values and conflicts (decisions #12, #56)

| Item | Figma | Kept | Why |
|------|-------|------|-----|
| Biriyani | $10.00 on Overview, $12.00 on Transactions | $12.00 | Transactions wins (decisions #12) |
| Taxi fare | $12.00 on Overview ("Taxi Fare"), $10.00 on Transactions, $30.00 on Expenses | "Taxi fare", $10.00 | Transactions wins (decisions #12, #56) |
| Movie ticket | $15.00 on Transactions, $30.00 on Expenses | $15.00 | Transactions wins (decisions #56) |
| Keyboard | $22.00 on Overview, $30.00 on Transactions | $30.00 | Transactions wins (decisions #12) |
| Polo shirt | "Polo Shirt" on Overview, "Polo shirt" on Transactions, both $20.00 | "Polo shirt", $20.00 | Transactions wins (decisions #12) |
| GTR 5 | $160.00, gamepad icon | $160.00, Entertainment | No gamepad category; the Entertainment icon shows, a known difference (decisions #56) |
| Payment Method | "Credit Card" on all 7 Transactions rows | Those 7 items belong to the Credit Card account | Payment Method is the account's type (decisions #57) |
| Expenses-only items (House Rent, Parking, Grocery, Restaurant bill, Metro Card bill, iTunes, Shirt, Jeans, Donation, Gift) | Amounts on Expenses, no shop name | Expenses amounts, invented shop names | No Transactions value to conflict with (decisions #56) |
| Account Details history | 4 rows of "17 Apr, 2023, Complete, Credit, 8C52d5DKDJ5, $160.00" on Checking | The Freelance payment of 17 Apr 2023 on Checking, $160.00, receipt `8C52d5DKDJ5` | Receipts are unique here, so only one row keeps Figma's ID |
| Category totals and changes ($250.00, 15%, ...) | Overview and Expenses | Not stored | Calculated from transactions (decisions #12, #21, #56) |
| Dates | All Figma rows on 17 May, 2023 | Spread over the month as in the template | Dates are free to choose (decisions #53) |

### Receipts

Every transaction has a unique receipt ID of 11 letters and digits, like Figma's `8C52d5DKDJ5`, generated once with a fixed seed and stored in the seed file. The Freelance payment of 17 Apr 2023 keeps `8C52d5DKDJ5` (decisions #27).

## Bills

Each bill row has one due date; bills do not roll forward (decisions #53). There are 14 bills: 2 billers, one due date a year from 2022 to 2028.

| Title | Logo | Amount | Due date | Last Charge | Category | Charge transaction |
|-------|------|--------|----------|-------------|----------|--------------------|
| Figma - Yearly Plan | `Figma` (`docs/figma/assets/icon/Figma.svg`) | $150.00 | 15 May, each year 2022 to 2028 | 14 May of the year before | Others | 14 May of the due year, Credit Card, shop "Figma" |
| Adobe Inc - Yearly Plan | `Adobe` (`docs/figma/assets/icon/Adobe.svg`) | $559.00 | 16 Jun, each year 2022 to 2028 | 17 Jun of the year before | Others | 17 Jun of the due year, Credit Card, shop "Adobe Inc" |

- Description, for both, as on Bills: "For advanced security and more flexible controls, the Professional plan helps you scale design processes company-wide."
- Overview shows "Figma - Monthly", "Adobe - Yearly" and a last charge of "17 Jun, 2023" for Adobe. Bills wins: the titles above, and last charges of 14 May, 2022 and 17 Jun, 2022 for the 2023 due dates (decisions #12).
- Both are subscriptions and map to Others; there is no Bills category (decisions #56). Each charge transaction exists once its due date has passed: Figma is charged the day before its due date, Adobe the day after (decisions #56).
- The 2022 bills have Last Charge dates in 2021 (14 May, 2021 and 17 Jun, 2021). These are dates only, with no transaction, since the dataset starts in 2022.

## Savings goals

One savings goal per month from Jan 2022 to Dec 2028, 84 in all, so every month up to the current one has a goal (decisions #58). Months after the current one exist in the data but cannot be selected (decisions #30, #60).

- Target Amount: $20,000.00 every month (Figma).
- Present Amount, by calendar month, the same every year:

| Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| $9,500.00 | $10,250.00 | $11,000.00 | $11,750.00 | $12,500.00 | $13,250.00 | $14,000.00 | $14,750.00 | $15,500.00 | $16,250.00 | $17,000.00 | $21,000.00 |

May is Figma's $12,500.00. December is above the target, so the gauge shows 100% (decisions #31). Present Amounts are invented, apart from May.

## What a first login shows

Calculated from the rules above for 22 Oct 2026, with dates read in UTC. These values are for review; the backend calculates them.

- Total Balance: $130,254.67, from Credit Card $21,019.18, Checking $33,362.48, Savings $27,356.80, Investment $29,503.00 and Loan $19,013.21. Every balance stays positive until the end of 2028; the lowest is Loan at $15,932.45 in Dec 2028.
- Every account has more than 10 transactions by then (Savings, Investment and Loan have 57 or 58), so "Load More" shows on every Account Details page, and the Revenue tab has rows (decisions #53).
- Goals card: Oct, 2026, target $20,000.00, present $16,250.00, gauge center `$16.2k`.
- Upcoming Bill: Figma - Yearly Plan due 15 May 2027 ($150.00) and Adobe Inc - Yearly Plan due 16 Jun 2027 ($559.00), the same days as Figma. The Bills page lists 4 bills (2027 and 2028 for each biller).
- Recent Transaction (All): Jeans -$266.00 (22 Oct), Movie ticket -$17.64, Pizza -$24.64, Taxi fare -$10.64, Restaurant bill -$147.84.
- Statistics: bars for Mon 19 to Thu 22 Oct, no teal bars for Fri to Sun. The highest bar is last Thursday's $322.00, so the y-axis is $0, $100, $200, $300, $400 (decisions #55, #91).
- Expenses Breakdown (1 to 22 Oct vs all of Sep): Housing $252.00 down 17%, Food $510.04 up 7%, Transportation $53.20 down 32%, Entertainment $282.24 up 16%, Shopping $658.00 up 14%, Others $138.32 down 31%.
- Saving Summary, Oct 2026: daily values from -$283.36 to +$552.16. Most days are small negative values, with spikes on income days, so the y-axis extends below $0 (decisions #59).

## Review points

1. Balances move away from Figma's $25,000, and Total Balance is about $130,000, not $240,399. Both are calculated (decisions #12, #17, #57).
2. Saving Summary is mostly small negative days with income spikes, not Figma's smooth positive curve (decisions #59 allows negative days).
3. After 16 Jun 2028 there are no upcoming bills, so Upcoming Bill and Bills show the empty state for the rest of 2028. Keeping them filled would need a bill due later in 2028; only the Figma and Adobe logos exist.
4. Invented values: income items and their shops, shop names of the Expenses-only items, branch names other than Park Street Branch, account numbers apart from the Credit Card's, the Loan installment, the year and month factors, and the Present Amounts other than May.
5. Pending and Failed rows repeat every month, including old months, because the data is fixed (decisions #53).
6. "Card repayment" is the Credit Card's only income, so it appears on the Revenue tab.
7. The same items repeat every month (for example GTR 5 is bought monthly), which keeps Figma's names on screen at first login.
