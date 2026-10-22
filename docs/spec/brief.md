# Finebank: product brief (DRAFT)

Status: draft written by `/write-spec` on 2026-10-22 from Figma metadata and the PNG exports in `docs/figma/`. It becomes the spec only after human review.
Screens and node IDs: `docs/figma/inventory.md`. Components: `docs/figma/components.md`. Open questions: `docs/decisions.md`.

## Product summary

Finebank (branded "FINEbank.IO") is a desktop web dashboard for managing personal finances.
A signed-in user sees their total balance across accounts, recent transactions, upcoming bills, expenses by category, and savings goals in one place.
Each area has a section of its own: Balances (accounts and account details), Transactions, Bills, Expenses, Goals and Settings.
The user can set a monthly savings target and per-category expense goals, and compare spending with earlier periods in charts.
The main goal is to give one person a clear overview of where their money is and where it goes.

## Users and their goals

The design shows one kind of user. No roles, admin screens or multi-user features are visible.

| User | Goals |
|------|-------|
| Visitor (signed out) | Sign in, create an account, recover a forgotten password |
| Signed-in user | See total balance and accounts, review transactions and bills, understand spending by category, set and track savings and expense goals, manage profile and password |

ASSUMPTION: one user type only. Any roles or permissions are an open question, not part of this brief.

## Feature list

1. **Authentication**: login with email and password, "Keep me signed in", "Continue with Google", sign up, forgot password (101, 102, 103).
2. **App shell**: dark sidebar with logo, 7 sections, Logout and a profile block. Header with date (greeting on Overview), notification bell and search (all app screens).
3. **Overview dashboard** (104, 104.1):
   - Total Balance with an account carousel
   - Goals card with a target vs achievement gauge and an edit popup
   - Upcoming Bill
   - Recent Transaction with All / Revenue / Expenses tabs
   - Statistics: a weekly comparison bar chart
   - Expenses Breakdown by category compared with last month
4. **Balances** (105): one account card per account with type, bank or issuer, masked number, total amount, Remove and Details. Entry points for Add Accounts and Edit Accounts.
5. **Account Details** (106): bank, type, balance, branch and number, Edit Details, Remove, and a Transactions History table with Load More.
6. **Transactions** (107): transaction table with All / Revenue / Expenses tabs and Load More.
7. **Bills** (108): upcoming bills table with due date, logo, description, last charge and amount.
8. **Expenses** (109): a monthly comparison bar chart, plus breakdown cards per category with a change vs last month and line items.
9. **Goals** (110, 110.1, 110.2):
   - Savings goal with a period selector, gauge and "Adjust Goal"
   - Saving Summary line chart
   - Expense goals per category with "Adjust"
   - Adjust popups
10. **Settings** (111, 112):
    - Account tab: full name, email, username, phone, profile picture upload, Update Profile
    - Security tab: old, new and retype password, phone, Update Password

## Screen flow

```
Auth (signed out)
  101 Login ──"Create an account"──> 102 Signup ──"Sign in here"──> 101 Login
  101 Login ──"Forgot Password?"──> 103 Forgot Password ──"Back to login"──> 101 Login
  101 Login / 102 Signup ──submit──> 104 Overview            (ASSUMPTION, decisions #3)

App (signed in). The sidebar is on every screen:
  Overview -> 104   Balances -> 105   Transactions -> 107   Bills -> 108
  Expenses -> 109   Goals -> 110      Settings -> 111       Logout -> 101 (ASSUMPTION, #3)

104 Overview
  Goals card edit icon ──> 104.1 popup                       (ASSUMPTION, #18)
  Upcoming Bill "View All" ──> 108 Bills                     (ASSUMPTION)
  Recent Transaction "View All" ──> 107 Transactions         (ASSUMPTION)
  Expenses Breakdown item arrow ──> 109 Expenses?            (open, #21)
105 Balances
  card "Details" ──> 106 Account Details                     (ASSUMPTION)
  "Add Accounts" / "Edit Accounts" / "Remove" ──> not designed (#22, #23)
106 Account Details
  "Edit Details" / "Remove" ──> not designed (#23, #26). Back: sidebar only (#26)
110 Goals
  "Adjust Goal" ──> 110.1 popup (Target + Present Amounts)   (ASSUMPTION, #31)
  category "Adjust" ──> 110.2 popup (Target Amounts only)    (ASSUMPTION, #31)
111 Settings Account <──tabs──> 112 Settings Security
```

Popups close with an X. Whether Esc or a backdrop click also closes them is open (#35).

## Global rules

### Viewports
- The design has desktop frames only, all 1440x1024. There are no tablet or mobile frames.
- CLAUDE.md asks for validation at 1440x900 and 375x812. The 900 height differs from the 1024 frames, and there is no mobile design. See decisions #4 and #5.
- ASSUMPTION: the 1440-wide frames are the desktop reference. Behaviour below 1440 is undefined until #4 is answered.

### Layout
- App screens: a fixed-width dark sidebar (280px) on the left, a header (88px) at the top, and content on a light gray background (`F3F3F3` family). Content sits in white cards with rounded corners.
- Auth screens: a centered form column (400px wide) on a light gray background, with no sidebar.
- Popups: a white rounded modal, centered over the content area. The overlay dims the content area only, not the sidebar or header (104.1, 110.1, 110.2; #35).

### Design system
- Tokens shown on the Components page (`418:6459`):
  - 5 font weights
  - Type scale 12/16, 14/20, 16/24, 18/24, 20/28, 22/32, 24/28
  - Colors `299D91` (primary), `191919`, `525256`, `666666`, `878787`, `9F9F9F`, `E8E8E8`, `F3F3F3`
  - Special colors `E73D1C` (red, increase), `4DAF6E` (green, decrease), `D2D2D2` at 25%, `FFFFFF` at 70% and at 8%
- Whether these exist as Figma variables was not checked. The font family is not known (#13).
- 73 components: 5 component sets and 68 standalone, of which 44 are icons. Some names collide or are misspelled (#36). Full map: `docs/figma/components.md`.
- 11 of 15 screens are flattened images in Figma, so exact spacing for them comes from the PNGs only (#37).

### Content
- All amounts are shown in `$`. Formats vary ($240,399 / $25000 / $25,056.00 / 12K / $20k), as do date formats (#11).
- ASSUMPTION: names, amounts, dates, banks and logos in the design are sample data, not fixed content. The same entity sometimes shows different values on different screens (#12).

## Not designed

Things a real product needs that Figma does not show:

- **Auth**:
  - Validation and error messages on all forms (#14, #15)
  - Wrong-credentials state
  - Loading state on submit
  - Forgot password success state and the reset-password page (#16)
  - The Google sign-in flow (#2)
  - The terms of service page (#15)
- **Session**: route protection, session expiry, logout confirmation, post-login and post-logout destinations (#3).
- **Data states**: loading, empty and error states for every widget, list, table and chart (#6).
- **Feedback**: success and failure messages after Save, Update Profile, Update Password and Remove.
- **Accounts**: the Add Accounts form, the Edit Accounts flow, the Edit Details form, remove confirmation (#22, #23, #26).
- **Header**: search results (#7), notifications panel (#8), profile and kebab menu (#9).
- **Dropdowns**: the options for "Weekly Comparison", "Monthly Comparison", "01 May ~ 31 May" and "Mar 2022" (#20, #29, #30).
- **Charts**: tooltips, hover and other interaction (#20).
- **Lists**: Load More loading and end-of-list states (#27), and what happens past the first page of the Overview widgets.
- **Tabs**: active states for the Revenue and Expenses tabs (only "All" is shown active) (#19).
- **Interaction states**: hover, focus and disabled states for most elements. Exceptions: nav items (Active/Inactive/Hover), inputs (Active Yes/No), Remind me (checked/unchecked) and Button/primary (Active Yes/No) have them as component variants.
- **Responsive**: mobile and tablet layouts (#4).
- **Other**: a 404 / not-found page. An avatar placeholder when no photo is uploaded.

## Assumptions

- ASSUMPTION: there is one user type (an individual), with no roles.
- ASSUMPTION: app screens 104 to 112 need a signed-in user, and screens 101 to 103 are for signed-out visitors (#3).
- ASSUMPTION: the sidebar and header are shared by all app screens. The active nav item shows the current section, and Account Details belongs to Balances.
- ASSUMPTION: frames with a `.1` or `.2` suffix are popup states of their base screen, not separate pages.
- ASSUMPTION: values in the design are sample data.
- ASSUMPTION: currency is USD (`$`) everywhere (#11).
- ASSUMPTION: the 1440-wide desktop frames are the visual reference (#4, #5).
- ASSUMPTION: the flows marked ASSUMPTION in "Screen flow" above follow from the labels ("View All", "Details", "Adjust") and are not shown as prototype links in Figma. Prototype links were not checked.
