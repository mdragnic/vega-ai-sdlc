# Figma component map

Source: `get_metadata` on the Components page `56:1396` (2026-10-22). Usage was counted from instances in the screen metadata of `66:4728`.

Limits of the usage count:
- Only 4 of the 15 desktop screens have layers: 101, 104, 104.1, 105. The other 11 are flattened images, so they have no instances to count (see decisions #37). Visual matches in those screens are listed separately below and are not counted.
- `get_metadata` does not expand an instance's children. Components nested inside other components (for example the Menu items inside Nav bar, or the Button inside Account Type) show 0 direct uses.
- 104 and 104.1 are the same screen (104.1 adds a popup), so every instance on 104 is counted twice.

Code components use the names in the "Code name" column (CLAUDE.md, decisions #36): the Figma name in PascalCase, with spelling fixed. Where several components share a name, the code name adds the purpose seen in the screens; a component with no use found gets what tells it apart instead. Icons that share a name differ only in size, so they get the size as a suffix. See "Naming issues".

## Components used in screens (metadata verified)

Sorted by use count, highest first.

| Component | Code name | Node ID | Variants | Used in screens | Use count |
|-----------|-----------|---------|----------|-----------------|-----------|
| Expences Item † | `ExpensesItem` | `42:777` | - | 104, 104.1 (Expenses Breakdown) | 12 |
| Item | `RecentTransactionItem` | `407:5649` | - | 104, 104.1 (Recent Transaction) | 10 |
| chevron-right | `ChevronRight` | `14:745` | - | 104, 104.1 (View All, Previous, Next) | 8 |
| Account Type ¶ | `AccountType` | `410:5353` | - | 105 | 5 |
| Header | `Header` | `411:6067` | - | 104, 104.1, 105 | 3 |
| Nav bar | `NavBar` | `411:6442` | - | 104, 104.1, 105 | 3 |
| Input | `Input` | `402:5191` (set) | Type=Name-Email, Password, Show Password, Phone number x Active=Yes/No (8) | 101 | 2 |
| Mastercard | `Mastercard` | `408:5979` | - | 104, 104.1 (Total Balance card) | 2 |
| edit | `Edit` | `27:450` | - | 104, 104.1 (Goals card) | 2 |
| Award | `Award` | `66:1698` | - | 104, 104.1 (Target Achieved) | 2 |
| octicon:goal-16 | `OcticonGoal16` | `38:535` | - | 104, 104.1 (This month Target) | 2 |
| Button Big ‡ | `AddAccountsButtonBig` | `410:5537` | - | 105 (Add Accounts) | 1 |
| Popup Input ‡ | `GoalPopupInput` | `416:6381` | - | 104.1 | 1 |
| Remind me | `RemindMe` | `402:5226` (set) | Active=Yes, Active=No | 101 | 1 |
| Button/primary | `ButtonPrimary` | `402:5239` (set) | Active=Yes, Active=No | 101 | 1 |
| Button/secondary | `ButtonSecondary` | `402:5233` (set) | Icon=Yes, Icon=No | 101 | 1 |

† The instances are named `Item` but are 200x74, the exact size of `Expences Item`. `Item` itself is 303x88. Matched by size, not by name. Verified in task 018 on PNG 104 (no Figma call): the tiles and right arrows place each item at 200x74, 16 at the sides and 8 above the tile, in a 3x2 grid 40 and 24 apart; built as `ExpensesItem`.
‡ Two components share this name. Matched by exact size: Button Big 208x48 and Popup Input 488x392. `GoalPopupInput` holds `PopupInputSmall` fields (`Popup Input (small)` `416:6338`): two in 104.1 and 110.1, one in 110.2 (task 005). `AddAccountsButtonBig` was built in task 019 from PNG 105 (no Figma call): the 208x48 teal "Add Accounts", visual only (#22), in `AddAccountsCell`.
¶ Verified in task 019 on PNG 105 (no Figma call): each card 352x288 (on Overview's grid, narrowing with the window, #94), the type and the Bank Name with the card network logo over a Gray/06 divider, the masked number and the balance each over its label, then "Remove" (visual only, #23) and the nested `Button` "Details >" (110x36); built as `AccountType`, with `Button` as a link to Account Details (#50).

Used in 2+ screens: Expences Item, Item, chevron-right, Header, Nav bar, Mastercard, edit, Award and octicon:goal-16 (9). Only Header and Nav bar appear in 2 distinct screens (Overview and Balances) when 104 and 104.1 count as one screen.

## Visual matches in flattened screens (unverified, not counted)

Matched by look and approximate size in the PNGs (pixel size / 2). Verify with `get_design_context` before relying on them.

| Component | Code name | Node ID | Seen in screens (PNG) | Evidence |
|-----------|-----------|---------|-----------------------|----------|
| Header | `Header` | `411:6067` | 106, 107, 108, 109, 110, 110.1, 110.2, 111, 112 | Same date, bell and search bar |
| Nav bar | `NavBar` | `411:6442` | 106, 107, 108, 109, 110, 110.1, 110.2, 111, 112 | Same sidebar |
| Menu (set) | `NavMenu` | `2:112` | All app screens (inside Nav bar) | Items are 224x48, one per section, Active style on the current section |
| Search | `HeaderSearch` | `404:5262` | All app screens (inside Header) | Search field is about 352x48 |
| Input | `Input` | `402:5191` | 102 (Name, Email, Password), 103 (Email) | Same field style, eye icon on password |
| Button/primary | `ButtonPrimary` | `402:5239` | 102 "Sign up", 103 "Password Reset" | 400x48 teal button |
| Button/secondary | `ButtonSecondary` | `402:5233` | 102 "Continue with Google" | 400x48 gray button with icon |
| Transaction item | `TransactionItem` | `411:5582` | 107 table rows | Row is about 1048x72 |
| Bill item | `BillItem` | `411:5746` | 108 table rows | Row is about 1046x162 |
| Expenses Breakdown | `ExpensesBreakdown` | `50:3852` | 109 category cards | Card is about 352x238 |
| Goal Item | `GoalItem` | `413:8749` | 110 category cards | Card is about 352x104 |
| Popup Input | `GoalPopupInput` | `416:6381` | 110.1 | Same popup as 104.1 (Target Amounts, Present Amounts, Save) |
| Settings Input | `SettingsInput` | `54:2202` | 111, 112 fields | Label + value block, 540 wide |
| Button | `Button` | `43:1161` | 105 "Details >" (nested in Account Type) | About 110x36; built in task 019 from PNG 105 as a link (it navigates), 36 high, 20 to each edge and 8 to the chevron |
| Category icons (Housing, Food, Trasnport, Movie, Shopping, Others, gamepad-2) | `Housing`, `Food`, `Transport`, `Movie`, `Shopping`, `Others`, `Gamepad2` | see table below | 104, 107, 109, 110 | Same glyphs |

The 110.2 popup (Target Amounts only) has no matching component size. In code it is `GoalPopupInput` with one `PopupInputSmall` field, 280 high (task 005).

## Possible detached components

Layers that look like components but are not instances of a component on the Components page.

| Layer | Node IDs | Screens | Note |
|-------|----------|---------|------|
| `chevron-down` (instance) | `66:4939`, `416:7413` | 104, 104.1 | No component with this name. Candidate: `Down arrow` `2:44` (24x24) |
| `Frame 40276` (instance) | `405:5479`, `416:7509` | 104, 104.1 | 24x24 round arrow on the balance card. No matching component. `arrow-up-right` `18:416` is 16x16 |
| `Figma` (frame) | `405:5544`, `416:7569` | 104, 104.1 | Redrawn logo, 45x16. Component `Figma` `411:5839` is 120x40 |
| `Adobe` (frame) | `405:5560`, `416:7585` | 104, 104.1 | Redrawn logo, 60x16. Component `Adobe` `411:6038` is 120x31 |
| `Bill one` (frame, x2) | `405:5538`, `405:5554` | 104, 104.1 | Bill row in the Upcoming Bill widget. No component. `Bill item` is the 1046-wide table row |
| `Menu Tab` (frame) | `66:4755` | 104, 104.1 (also visible in 107, 111, 112) | All / Revenue / Expenses tabs. No Tab component exists |
| `Slider option` (frame) | `405:5480` | 104, 104.1 | Previous / dots / Next control |
| `Target vs Achievement Meter` (frame) | `407:5628` | 104, 104.1 (also visible in 110) | Gauge chart, built from vectors |
| `Account type` card (frame) | `405:5469` | 104, 104.1 | Teal card inside Total Balance. Not the `Account Type` component |
| `Graph bar 01` / `Bar` (frames, x7) | `411:7368` and siblings | 104, 104.1 | Chart bars. Charts have no components |
| `Frame 40640` (frame) | `405:5498` | 104, 104.1 | 32x32 icon button around `edit` |
| `Amount` (frame) | `405:5552`, `405:5571` | 104, 104.1 | Bordered amount box in bill rows |
| `Edit Accounts` (frame) | `410:5545` | 105 | Text button, 208x48. No instance |

## Components with no direct use found

Many are likely nested inside other components (see "Limits" above) or used only in flattened screens.

### Component sets

| Component | Code name | Node ID | Variants |
|-----------|-----------|---------|----------|
| Menu | `NavMenu` | `2:112` | Type=Overview, Balances, Transactions, Bills, Expenses, Goals, Settings x Status=Active, Inactive, Hover (21) |

### UI components

| Component | Code name | Node ID | Size |
|-----------|-----------|---------|------|
| Search (field) | `HeaderSearch` | `404:5262` | 352x48 |
| Settings Input | `SettingsInput` | `54:2202` | 540x88 |
| Popup Input (small) | `PopupInputSmall` | `416:6338` | 360x88 |
| Transaction item | `TransactionItem` | `411:5582` | 1048x72 |
| Goal Item | `GoalItem` | `413:8749` | 352x104 |
| Bill item | `BillItem` | `411:5746` | 1046x162 |
| Expenses Breakdown | `ExpensesBreakdown` | `50:3852` | 352x238 |
| Button | `Button` | `43:1161` | 110x36 |
| Button Big (small) | `ButtonBigCompact` | `2:40` | 121x48 |
| Button small | `ButtonSmall` | `2:42` | 84x32 |
| Profile | `Profile` | `403:5389` | 224x104 |
| Menu (single) | `MenuSingle` | `13:641` | 224x48 |
| Logout | `Logout` | `13:612` | 192x48 |

### Brand logos

| Component | Code name | Node ID |
|-----------|-----------|---------|
| Figma | `Figma` | `411:5839` |
| Adobe | `Adobe` | `411:6038` |
| Visacard | `Visacard` | `410:5467` |

### Icons (24x24 unless noted)

| Component | Code name | Node ID | | Component | Code name | Node ID |
|-----------|-----------|---------|-|-----------|-----------|---------|
| Menu/Overview | `MenuOverview` | `2:101` | | Clock | `Clock` | `2:67` |
| Menu/Car | `MenuCar` | `2:97` | | Search (icon) | `SearchIcon` § | `2:110` |
| Icon/eye | `IconEye` | `402:5244` | | Down arrow | `DownArrow24` | `2:44` |
| Menu/Settings | `MenuSettings` | `2:87` | | Notification icon | `NotificationIcon` | `2:621` |
| Icon/eyeoff | `IconEyeOff` | `402:5247` | | Search (icon) | `SearchIcon` § | `43:614` |
| Menu/Bell | `MenuBell` | `2:90` | | x (32x32) | `X32` | `63:1960` |
| Menu/Payment | `MenuPayment` | `2:85` | | mdi:achievement-award | `MdiAchievementAward` | `38:534` |
| Menu/Transaction | `MenuTransaction` | `2:83` | | Down arrow (16) | `DownArrow16` | `28:470` |
| Menu/Report | `MenuReport` | `2:76` | | Up arrow (16) | `UpArrow` | `28:469` |
| wallet | `Wallet` | `12:335` | | Housing | `Housing` | `42:903` |
| Frame 39997 (20x20) | `LogoutIcon` | `13:630` | | Icon/separator (12x24) | `IconSeparator` | `402:5296` |
| Expencces | `Expenses` | `12:369` | | x | `X24` | `106:6851` |
| Transaction | `Transaction` | `12:334` | | Movie | `Movie` | `42:748` |
| Target | `Target` | `12:332` | | gamepad-2 | `Gamepad2` | `14:764` |
| Goal | `Goal` | `12:333` | | Others | `Others` | `42:747` |
| Bill | `Bill` | `12:370` | | Food | `Food` | `42:751` |
| arrow-right (16) | `ArrowRight16` | `18:454` | | Trasnport | `Transport` | `42:749` |
| arrow-right | `ArrowRight24` | `42:642` | | Shopping | `Shopping` | `42:750` |
| Back arrow | `BackArrow` | `70:6239` | | arrow-up-right (16) | `ArrowUpRight` | `18:416` |
| Leftarrow | `LeftArrow` | `402:5252` | | Arrow down 2 | `ArrowDown2` | `413:8604` |

§ The two `Search` icons export to identical SVGs (`docs/figma/assets/icon/Search.svg` and `Search-1.svg`), so one code component, `SearchIcon`, covers both.

The Components page also holds one instance, `chevron-right` `418:6456`, which is not a component.

## Code-only components

Code components with no Figma component. They are built from tokens, and their names are code names like the ones above (#36). Added in task 002; task 003 added `Avatar`, `AppLayout`, `ChevronsRight` and `EllipsisVertical`; task 004 added `Section`, `Card`, `MenuTab`, `CategoryIcon`, `DateBox`, `AmountBox`, `Skeleton` and `DataState`; task 005 added `Popup` and `Dropdown`; task 006 added `ComparisonBarChart`, `ComparisonBarChartSkeleton`, `ChartLegend` and `TargetVsAchievementMeter`; task 013 added `TotalBalance`, `AccountTypeSlide`, `SliderOption` and `TotalBalanceSkeleton`; task 014 added `Goals`, `GoalsSkeleton` and `SavingsGoalPopup`; task 015 added `UpcomingBill`, `UpcomingBillLogo` and `UpcomingBillSkeleton`; task 016 added `RecentTransaction` and `RecentTransactionSkeleton` (`RecentTransactionItem` has its Figma row above); task 017 added `Statistics`; task 018 added `OverviewExpensesBreakdown` and `OverviewExpensesBreakdownSkeleton` (`ExpensesItem` has its Figma row above); task 019 added `AddAccountsCell` and `AccountTypeSkeleton` (`AccountType`, `Button` and `AddAccountsButtonBig` have their Figma rows above).

| Code name | Purpose | Decision |
|-----------|---------|----------|
| `FieldError` | The inline message under a form field, linked to it with `aria-describedby` | #6 |
| `FormError` | The server error above a form's submit button, `role="alert"` | #6 |
| `Spinner` | The loading indicator inside buttons while a form is saving | #6 |
| `AuthLayout` | The Login, Sign up and Forgot Password frame: light gray page, centered 400px column, teal logo at the top | #66, #70 |
| `TextDivider` | Centered gray text with a line on each side ("or sign in with", "or sign up with") | US-01, US-02 |
| `IconCheck` | Icon: the white check mark in `RemindMe`. Not in the Figma export, so the Lucide `check` SVG is copied as a file. License notices (Lucide ISC; `check` is derived from Feather, MIT) in `frontend/src/assets/icons/LICENSE-lucide.txt` | #66 |
| `Avatar` | The user's photo in a 32px circle, or without a photo a circle with the initials (`initials()` from task 001). The initials circle is not designed: Gray/01 with white Semibold 14/20 letters, chosen in task 003 | #38, #62 |
| `AppLayout` | The frame of every app screen: `NavBar` on the left, sticky so it stays in place while the page scrolls, and a main column with `Header` and then the content, which scroll together | #5, #83 |
| `ChevronsRight` | Icon: the "»" before the header date. Not in the Figma export, so the Lucide `chevrons-right` SVG is copied as a file (derived from Feather, MIT; notices in `LICENSE-lucide.txt`) | #10, #66 |
| `EllipsisVertical` | Icon: the three dots in `Profile`. Not in the Figma export, so the Lucide `ellipsis-vertical` SVG is copied as a file (Feather `more-vertical`, MIT; notices in `LICENSE-lucide.txt`) | #9, #66 |
| `Section` | A titled block of an app screen: the `<h2>` in the section title style (104 "Total Balance") with, on the right, "View All" with the chevron (described by the title) or a note; the content follows at the gap the screen shows (8 on Overview, 16 elsewhere) | #6, #87 |
| `Card` | The white content card: card radius, card shadow and 24px padding, or no padding for content that sets its own insets (tables, Settings) | #65 |
| `MenuTab` | The All / Revenue / Expenses tabs of 104 and 107 (Figma frame `Menu Tab` `66:4755`, no component): an ARIA tablist with one tab stop; the selected tab has the designed Active style. The widget renders the tabpanel and labels it with `menuTabId`, imported from `components/MenuTab/MenuTab` (not the index, which holds components only) | #19, #87 |
| `CategoryIcon` | The icon of an expense category, or the wallet for income, plain or on a gray tile sized and colored per context (104 Recent Transaction and Expenses Breakdown, 109 card header, 110 Goals, 107 rows) | #56, #61 |
| `DateBox` | The gray date box of the bill rows, the 3-letter month over the two-digit day, compact (104) and large (108) | #11, #88 |
| `AmountBox` | The bordered amount box of the bill rows, compact (104) and large (108); the Figma width is the minimum | #11 |
| `Skeleton` | One placeholder shape of a widget loading skeleton (text line, block or circle), Gray/05 with a pulse that stops under reduced motion | #6 |
| `DataState` | The shared states of one widget, list, table or chart: skeleton while loading, empty message, error state ("Something went wrong." above Retry) when there is no data to show, with a per-widget error boundary around the content. A failed background refetch keeps the data on screen. Every state renders inside one root, a flex column that takes its parent's room (its content is a flex item). Whenever the focused Retry leaves the page, for any reason (a press, a refetch on window focus, any other refetch), focus moves to that root before the button goes (`tabindex="-1"` while it holds that focus, never a Tab stop, the #87 ring on keyboard focus only); a press focuses Retry first, for browsers that don't focus a clicked button; when the error state comes back, its new Retry takes the focus and the root drops its tabindex. No focus move scrolls the page (task 017, follow-up 2 of the task 016 gate, #114) | #6, #87, #88, #89, #114 |
| `Popup` | The modal shell of every popup, on Radix Dialog: the white 488px panel with its top edge at y 276, centered on the content area, and the X. The overlay dims the content area only (right of the sidebar, below the header), but the whole page is blocked: focus stays inside, the page does not scroll and the rest is hidden from assistive technology. Closes with the X, Esc or a click on the dimmed area; focus returns to the opener. Rendered inside `AppLayout`, which gives it the content area to dim. `GoalPopupInput` is built on it | #35, #87, #90 |
| `Dropdown` | The one shared select, on Radix Select. Closed looks: `box` (110 Savings Goal period), `plain` (110 Saving Summary period), `inline` (111 country code, the label only), `input` (Account Type in 106 edit mode, styled like `Input`) and `comparison` (104 "Weekly Comparison" and 109 "Monthly Comparison": the label Semibold 16/24 in Default Black, then `DownArrow24` in Secondary, 12 apart; added in task 017). One open list for all: Popup radius, card shadow, 1px Gray/05 border | #20, #26, #30, #33, #43, #60, #87, #90 |
| `ComparisonBarChart` | The bar chart of 104 Statistics and 109 Monthly Comparison (Figma bars `Graph bar 01` / `Bar`, no component): per label a Gray/05 bar for the earlier period and a Primary bar for the current one, 16 wide and 8 apart with rounded tops, on 5 Gray/06 grid lines with compact y labels. It draws the values and ticks it is given (ticks from the backend's `axisTicks`); `null` draws no bar. No interaction. The SVG is hidden; a visually hidden table carries the data. Its colors, typography and height are tokens, its drawing named constants | #11, #20, #29, #55, #82, #91, #92 |
| `ComparisonBarChartSkeleton` | The loading skeleton of `ComparisonBarChart` for `DataState`, in the chart's box: y label lines and per group two bar blocks over a label line, no text. Not designed | #6 |
| `ChartLegend` | The legend at the right of a chart card's header row (104, 109, later 110 Saving Summary): the current period first with a Primary swatch, then the earlier one with a Gray/05 swatch, labels in Secondary | #29, #92 |
| `TargetVsAchievementMeter` | The gauge of 104 Goals and 110 Savings Goal (Figma frame `Target vs Achievement Meter` `407:5628`, no component): a Gray/05 half circle with a Primary arc and needle at the progress it is given (from the backend's `goalProgress`), `$0` and the Target under the ends and the Present between them in the compact format, the caption under them. A `meter` named by the caption | #11, #18, #31, #92 |
| `TotalBalance` | The content of the Overview Total Balance card (Figma `405:5461`, no component): the total with "All Accounts" to Balances over the Gray/06 divider, then one account at a time in `AccountTypeSlide`, inside a polite live region, with `SliderOption` at the bottom. Every account's card is laid out in one grid cell (the others hidden and `aria-hidden`), so the tallest sets the height and paging never moves the page. Starts at the first account on every visit; with fewer accounts in new data, at the last one. Shows the amounts it is given | #11, #17, #87, #107 |
| `AccountTypeSlide` | The teal account card in Total Balance (Figma frame `Account type` `405:5469`; not the Balances card `AccountType`): "Account Type", the type, the masked number, the card network logo when set (Mastercard as drawn, VISA in the same 48x32 box), the balance and the round arrow (Figma `Frame 40276`, visual only). A group named by its position ("Account 1 of 5"). 96 high where the number and the balance fit on one line; otherwise the balance and the arrow wrap under the number and the card grows. The bottom line stays at the card's bottom in a taller cell | #17, #24, #25, #106, #107 |
| `SliderOption` | Previous, one dot per account and Next under the Total Balance account card (Figma frame `Slider option` `405:5480`): buttons that are `aria-disabled` (focus kept) and muted at the ends, the dots visual only | #17, #87 |
| `TotalBalanceSkeleton` | The loading skeleton of the Total Balance card for `DataState`: lines for the total and "All Accounts" over the divider, a block in the account card's box and lines for Previous and Next, at the card's 232 minimum. Not designed | #6, #105 |
| `Goals` | The content of the Overview Goals card (Figma frame `Goals` `405:5491`, no component): the Target (Exbold 22), the pencil button "Edit savings goal" (Figma `Frame 40640` `405:5498`: the `Edit` icon in a 32px Gray/06 box, the teal ring on keyboard focus) and the month over the Gray/06 divider; "Target Achieved" (the Present) with `Award` and "This month Target" with `OcticonGoal16` as terms and amounts on the left, `TargetVsAchievementMeter` at the backend's progress on the right. Without a goal the pencil and the month stay and "No goal for this month" fills the rest. Where a line does not fit, the month or the gauge moves under it, right-aligned. Opens `SavingsGoalPopup`, a fresh form on every opening. Shows the amounts it is given | #11, #18, #31, #58, #87, #94, #108 |
| `GoalsSkeleton` | The loading skeleton of the Goals card for `DataState`: lines for the Target and the month and a block for the pencil over the divider, two icon-and-two-line groups on the left, the gauge's half circle with three label lines on the right, at the card's 232 minimum. Not designed | #6, #105 |
| `SavingsGoalPopup` | Popup 104.1 on Overview: a `GoalPopupInput` named "Edit savings goal" with "Target Amounts" and "Present Amounts" (`PopupInputSmall`, the Present placeholder "Write present amount here"), prefilled from the card's goal or empty without one. A react-hook-form form on the shared `savingsGoalFormSchema`; Save sends `PUT /api/savings-goals` for the card's month, disabled with its spinner while it runs; field errors under the fields, other failures above Save. X, Esc and the dimmed area discard the typing | #6, #18, #31, #35, #58, #64, #69, #71, #84, #97, #108 |
| `UpcomingBill` | The content of the Overview Upcoming Bill card (Figma section `Upcoming Bill` `405:5530`; the rows `Bill one` `405:5538` and `405:5554`, no component): a list of the first 2 bills it is given, each `DateBox` (compact) of the due date, then the text column (`UpcomingBillLogo`, the title Semibold 16, "Last Charge - <date>" Regular 12 in Gray/03), then `AmountBox` (compact) at the right, centered on the date box; the Gray/06 divider between two rows. Where the text and the amount box do not fit side by side, the amount box moves under the text, right-aligned, and a long title or date wraps; the row grows. No action in the rows. Formats the dates and amounts it is given | #11, #28, #41, #88, #94, #106, #111 |
| `UpcomingBillLogo` | The biller logo of an Upcoming Bill row (Figma frames `Figma` `405:5544` and `Adobe` `405:5560`, no component), 16 high, an image named by the biller: Figma the wordmark alone in Gray/01 (`FigmaWordmark` in `frontend/src/assets/brand/`, the wordmark paths of the exported `Figma` component), Adobe the exported component (60x16) | #28, #111 c |
| `UpcomingBillSkeleton` | The loading skeleton of the Upcoming Bill card for `DataState`: two rows of a block in the date box's place, lines for the logo, the title and the last charge, and a block in the amount box's place, the divider between them, at the card's 232 minimum. Not designed | #6, #105 |
| `RecentTransaction` | The content of the Overview Recent Transaction card (Figma section `Recent Transaction` `66:4747`, no component): `MenuTab` labelled "Recent Transaction" with All, Revenue and Expenses (the response's keys `all`, `revenue`, `expenses`), All selected on every visit, shown in every state; under it, 12 below, the tab panel, a Tab stop with the #87 ring on keyboard focus, with `DataState` over the panel (`RecentTransactionSkeleton`, the error state, "No transactions yet" when every list is empty). The three lists of `RecentTransactionItem` share one grid cell, so the card takes the tallest tab's height and switching tabs moves nothing; the hidden ones are `visibility: hidden` and `aria-hidden`. A tab whose own list is empty shows "No transactions yet". Selects the tab's list as sent; filters, sorts and calculates nothing | #6, #19, #40, #87, #105 a, #107, #112 |
| `RecentTransactionSkeleton` | The loading skeleton of the Recent Transaction panel for `DataState`: five rows on the rows' grid, each a block in the tile's place, two lines on the left and two right-aligned lines, the divider between them. Not designed | #6, #105 a |
| `Statistics` | The content of the Overview Statistics card (Figma section `Statistics` `66:4933`, no component): the 24px header row (#93 a) with `Dropdown` `comparison` named "Statistics" at the left ("Weekly Comparison", the one option, #20) and `ChartLegend` "This week" and "Last week" at the right, in every state; under it the chart's 188 box with `DataState` (`ComparisonBarChartSkeleton` of 7 groups, the error state, "No expenses this week or last week" when the backend sends no ticks) and `ComparisonBarChart` of the 7 days as sent, the labels from `formatDayLabel`. Both keep their size and place at the top of a taller card (#113 a). Maps and formats; calculates nothing | #6, #20, #55, #91, #93, #105 a, #113 |
| `OverviewExpensesBreakdown` | The content of the Overview Expenses Breakdown card (Figma section `Expenses Breakdown` `66:4999`, no component; `ExpensesBreakdown` is the 109 card, task 024): `DataState` with `OverviewExpensesBreakdownSkeleton`, the error state and no empty state (the six always show), then the six `ExpensesItem` in the order sent, a list on 104's 3x2 grid (three columns sharing the width, 40 and 24 apart) with a `#F6F6F6` line in the middle of each gap, drawn by the items so it follows the rows' heights. The grid keeps its size and place at the top of a taller card (#113 a). Maps; calculates, sorts and filters nothing | #6, #21, #56, #61, #94, #112, #113 |
| `OverviewExpensesBreakdownSkeleton` | The loading skeleton of the Expenses Breakdown card for `DataState`: six items on the same grid and lines, each a block in the tile's place, three lines for the name, the total and the percentage, and a block in the right arrow's place. Not designed | #6, #105 a |
| `AddAccountsCell` | The last cell of the Balances grid (Figma frame `410:5516`, no component): a white `Card`, 288 high at least, with `AddAccountsButtonBig` and "Edit Accounts" (Medium 16/24, Gray/03) 16 under it, centred both ways; it stretches with its row. Visual only: no button or link, no Tab stop, the default cursor, nothing on a click, the whole cell hidden from assistive technology | #22, #24 |
| `AccountTypeSkeleton` | The loading skeleton of one Balances card for `DataState`, on `AccountType`'s layout at its 288: lines for the type and the Bank Name over the divider, two lines each for the number and the balance with their labels, a line for "Remove" and a block in the "Details" box. Three of them fill the grid's first row while the accounts load. Not designed | #6, #105 |

## Totals

- Component sets: 5 (Menu, Input, Remind me, Button/primary, Button/secondary), 35 variants.
- Standalone components: 68 (17 UI components, 3 nav parts, 4 brand logos, 44 icons).
- Total: 73 component definitions.
- Used in screens (metadata verified): 16. Used in 2+ screens: 9.

## Naming issues

| Issue | Components |
|-------|-----------|
| Same name, different component | Search (`2:110`, `43:614`, `404:5262`), Popup Input (`416:6338`, `416:6381`), Button Big (`410:5537`, `2:40`), arrow-right (`18:454`, `42:642`), Down arrow (`2:44`, `28:470`), x (`63:1960`, `106:6851`), Menu (set `2:112`, single `13:641`) |
| Misspelled | Expencces (`12:369`), Expences Item (`42:777`), Trasnport (`42:749`) |
| Generic name | Frame 39997 (`13:630`), Item (`407:5649`) |

## Design tokens shown on the Components page (frame `418:6459`)

These are text labels next to swatches and samples. Whether they also exist as Figma variables or styles was not checked.

- Font weights: Regular, Medium, Semi Bold, Bold, Extra Bold.
- Type scale (size / line height, px): 12/16, 14/20, 16/24, 18/24, 20/28, 22/32, 24/28.
- Colors: `299D91` (primary teal), `191919`, `525256`, `666666`, `878787`, `9F9F9F`, `E8E8E8`, `F3F3F3`.
- Special colors: `E73D1C` (red), `4DAF6E` (green), `D2D2D2` at 25% opacity, `FFFFFF` at 70% opacity, `FFFFFF` at 8% opacity.
- Font family: not in the metadata (see decisions #13).
