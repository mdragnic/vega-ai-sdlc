# Figma component map

Source: `get_metadata` on the Components page `56:1396` (2026-10-22). Usage was counted from instances in the screen metadata of `66:4728`.

Limits of the usage count:
- Only 4 of the 15 desktop screens have layers: 101, 104, 104.1, 105. The other 11 are flattened images, so they have no instances to count (see decisions #37). Visual matches in those screens are listed separately below and are not counted.
- `get_metadata` does not expand an instance's children. Components nested inside other components (for example the Menu items inside Nav bar, or the Button inside Account Type) show 0 direct uses.
- 104 and 104.1 are the same screen (104.1 adds a popup), so every instance on 104 is counted twice.

Code components use these names (CLAUDE.md). Some names collide or are misspelled. See "Naming issues" and decisions #36.

## Components used in screens (metadata verified)

Sorted by use count, highest first.

| Component | Node ID | Variants | Used in screens | Use count |
|-----------|---------|----------|-----------------|-----------|
| Expences Item † | `42:777` | - | 104, 104.1 (Expenses Breakdown) | 12 |
| Item | `407:5649` | - | 104, 104.1 (Recent Transaction) | 10 |
| chevron-right | `14:745` | - | 104, 104.1 (View All, Previous, Next) | 8 |
| Account Type | `410:5353` | - | 105 | 5 |
| Header | `411:6067` | - | 104, 104.1, 105 | 3 |
| Nav bar | `411:6442` | - | 104, 104.1, 105 | 3 |
| Input | `402:5191` (set) | Type=Name-Email, Password, Show Password, Phone number x Active=Yes/No (8) | 101 | 2 |
| Mastercard | `408:5979` | - | 104, 104.1 (Total Balance card) | 2 |
| edit | `27:450` | - | 104, 104.1 (Goals card) | 2 |
| Award | `66:1698` | - | 104, 104.1 (Target Achieved) | 2 |
| octicon:goal-16 | `38:535` | - | 104, 104.1 (This month Target) | 2 |
| Button Big ‡ | `410:5537` | - | 105 (Add Accounts) | 1 |
| Popup Input ‡ | `416:6381` | - | 104.1 | 1 |
| Remind me | `402:5226` (set) | Active=Yes, Active=No | 101 | 1 |
| Button/primary | `402:5239` (set) | Active=Yes, Active=No | 101 | 1 |
| Button/secondary | `402:5233` (set) | Icon=Yes, Icon=No | 101 | 1 |

† The instances are named `Item` but are 200x74, the exact size of `Expences Item`. `Item` itself is 303x88. Matched by size, not by name. Verify before building.
‡ Two components share this name. Matched by exact size: Button Big 208x48 and Popup Input 488x392.

Used in 2+ screens: Expences Item, Item, chevron-right, Header, Nav bar, Mastercard, edit, Award and octicon:goal-16 (9). Only Header and Nav bar appear in 2 distinct screens (Overview and Balances) when 104 and 104.1 count as one screen.

## Visual matches in flattened screens (unverified, not counted)

Matched by look and approximate size in the PNGs (pixel size / 2). Verify with `get_design_context` before relying on them.

| Component | Node ID | Seen in screens (PNG) | Evidence |
|-----------|---------|-----------------------|----------|
| Header | `411:6067` | 106, 107, 108, 109, 110, 110.1, 110.2, 111, 112 | Same date, bell and search bar |
| Nav bar | `411:6442` | 106, 107, 108, 109, 110, 110.1, 110.2, 111, 112 | Same sidebar |
| Menu (set) | `2:112` | All app screens (inside Nav bar) | Items are 224x48, one per section, Active style on the current section |
| Search | `404:5262` | All app screens (inside Header) | Search field is about 352x48 |
| Input | `402:5191` | 102 (Name, Email, Password), 103 (Email) | Same field style, eye icon on password |
| Button/primary | `402:5239` | 102 "Sign up", 103 "Password Reset" | 400x48 teal button |
| Button/secondary | `402:5233` | 102 "Continue with Google" | 400x48 gray button with icon |
| Transaction item | `411:5582` | 107 table rows | Row is about 1048x72 |
| Bill item | `411:5746` | 108 table rows | Row is about 1046x162 |
| Expenses Breakdown | `50:3852` | 109 category cards | Card is about 352x238 |
| Goal Item | `413:8749` | 110 category cards | Card is about 352x104 |
| Popup Input | `416:6381` | 110.1 | Same popup as 104.1 (Target Amounts, Present Amounts, Save) |
| Settings Input | `54:2202` | 111, 112 fields | Label + value block, 540 wide |
| Button | `43:1161` | 105 "Details >" (nested in Account Type) | About 110x36 |
| Category icons (Housing, Food, Trasnport, Movie, Shopping, Others, gamepad-2) | see table below | 104, 107, 109, 110 | Same glyphs |

The 110.2 popup (Target Amounts only) has no matching component size. It may be an unrecorded variant.

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

| Component | Node ID | Variants |
|-----------|---------|----------|
| Menu | `2:112` | Type=Overview, Balances, Transactions, Bills, Expenses, Goals, Settings x Status=Active, Inactive, Hover (21) |

### UI components

| Component | Node ID | Size |
|-----------|---------|------|
| Search (field) | `404:5262` | 352x48 |
| Settings Input | `54:2202` | 540x88 |
| Popup Input (small) | `416:6338` | 360x88 |
| Transaction item | `411:5582` | 1048x72 |
| Goal Item | `413:8749` | 352x104 |
| Bill item | `411:5746` | 1046x162 |
| Expenses Breakdown | `50:3852` | 352x238 |
| Button | `43:1161` | 110x36 |
| Button Big (small) | `2:40` | 121x48 |
| Button small | `2:42` | 84x32 |
| Profile | `403:5389` | 224x104 |
| Menu (single) | `13:641` | 224x48 |
| Logout | `13:612` | 192x48 |

### Brand logos

| Component | Node ID |
|-----------|---------|
| Figma | `411:5839` |
| Adobe | `411:6038` |
| Visacard | `410:5467` |

### Icons (24x24 unless noted)

| Component | Node ID | | Component | Node ID |
|-----------|---------|-|-----------|---------|
| Menu/Overview | `2:101` | | Clock | `2:67` |
| Menu/Car | `2:97` | | Search (icon) | `2:110` |
| Icon/eye | `402:5244` | | Down arrow | `2:44` |
| Menu/Settings | `2:87` | | Notification icon | `2:621` |
| Icon/eyeoff | `402:5247` | | Search (icon) | `43:614` |
| Menu/Bell | `2:90` | | x (32x32) | `63:1960` |
| Menu/Payment | `2:85` | | mdi:achievement-award | `38:534` |
| Menu/Transaction | `2:83` | | Down arrow (16) | `28:470` |
| Menu/Report | `2:76` | | Up arrow (16) | `28:469` |
| wallet | `12:335` | | Housing | `42:903` |
| Frame 39997 (20x20) | `13:630` | | Icon/separator (12x24) | `402:5296` |
| Expencces | `12:369` | | x | `106:6851` |
| Transaction | `12:334` | | Movie | `42:748` |
| Target | `12:332` | | gamepad-2 | `14:764` |
| Goal | `12:333` | | Others | `42:747` |
| Bill | `12:370` | | Food | `42:751` |
| arrow-right (16) | `18:454` | | Trasnport | `42:749` |
| arrow-right | `42:642` | | Shopping | `42:750` |
| Back arrow | `70:6239` | | arrow-up-right (16) | `18:416` |
| Leftarrow | `402:5252` | | Arrow down 2 | `413:8604` |

The Components page also holds one instance, `chevron-right` `418:6456`, which is not a component.

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
