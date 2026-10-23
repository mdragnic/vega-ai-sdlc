# Design tokens

Written in task 000, steps 7 to 9 (decision #65). `frontend/src/styles/tokens.css` is generated from the tables below, one custom property per row, with the same name and value. It is the only frontend file with raw design values.

Sources:
- Colors and typography: one `get_variable_defs` call on the Typography & Color frame `418:6459` on 2026-10-23 (`docs/figma/inventory.md`, call 5). It returned 12 color variables and 10 text styles, and no effects.
- Components page labels (`docs/figma/components.md`, last section) for values the call lacks.
- Everything else is measured from the 2x PNGs in `docs/figma/`: pixel positions are PNG pixels (2880x2048), halved, then rounded to the nearest 4px. Border widths are halved but not rounded. Measured with a Node script using only built-ins (PNG decode, color runs, corner-curve fit, Gaussian shadow fit), kept outside the repo.

Names follow the Figma variable or style name in kebab-case. Measured tokens are named by role.

## Color

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--color-default-black` | `#191919` | Figma variable `Default Black` |
| `--color-primary` | `#299D91` | Figma variable `Primary color` |
| `--color-secondary` | `#525256` | Figma variable `Secondary` |
| `--color-gray-01` | `#666666` | Figma variable `Gray/01` |
| `--color-gray-02` | `#878787` | Figma variable `Gray/02` |
| `--color-gray-03` | `#9F9F9F` | Figma variable `Gray/03` |
| `--color-gray-05` | `#E8E8E8` | Figma variable `Gray/05` |
| `--color-gray-06` | `#F3F3F3` | Figma variable `Gray/06` |
| `--color-special-red` | `#E73D1C` | Figma variable `Special/Red` |
| `--color-special-green` | `#4DAF6E` | Figma variable `Special/Green` |
| `--color-special-bg` | `#D2D2D2` | Figma variable `Special/BG` |
| `--color-white` | `#FFFFFF` | Figma variable `White` |
| `--color-special-bg-25` | `rgb(210 210 210 / 25%)` | Components page label "D2D2D2 25%" (the variable has no opacity) |
| `--color-white-70` | `rgb(255 255 255 / 70%)` | Components page label "FFFFFF 70%". Checked: inactive nav text in 104 is `#BABABA`, which is white 70% over Default Black |
| `--color-white-8` | `rgb(255 255 255 / 8%)` | Components page label "FFFFFF 8%". Checked: the sidebar divider in 104 is `#2B2B2B`, which is white 8% over Default Black |
| `--color-default-black-15` | `rgb(25 25 25 / 15%)` | measured: PNG 104.1 popup overlay, solved from the colors under it (white `#FFFFFF` to `#DDDDDD`, primary `#299D91` to `#278A7F`, page `#F1F2F4` to `#D1D2D4`): Default Black at 15%. Added in review (Marko, 2026-10-23) |
| `--color-form-label` | `#191D23` | measured: PNG 101 "Email Address" and "Password" label glyphs (x 1043, y 525 to 547). Added in review |
| `--color-input-active` | `#4B5768` | measured: PNG 101 active email input border (y 576 to 577) and its typed text glyphs. Added in review |
| `--color-input-border` | `#D0D5DD` | measured: PNG 101 password input border (y 784 to 785). Added in review |
| `--color-button-secondary` | `#E4E7EB` | measured: PNG 101 "Continue with Google" button fill (y 1288 to 1383). Added in review |
| `--color-auth-divider` | `#CACED3` | measured: PNG 101 "or sign in with" lines (y 1203). Added in review |
| `--color-logout-bg` | `#262626` | measured: PNG 104 Logout button fill (y 1560 to 1655). Added in review |
| `--color-divider-light` | `#F6F6F6` | measured: PNG 104 Expenses Breakdown cell dividers (vertical x 1850 to 1851 and 2330 to 2331, horizontal y 1766 to 1767). The Statistics chart grid lines are Gray/06 `#F3F3F3`. Added in review |
| `--color-auth-muted` | `#999DA3` | measured: PNG 101 masked password dots (y 828 to 834), eye icon (x 1762 to 1805) and "or sign in with" text (y 1193 to 1219); PNG 102 and 103 email placeholder (y 796 to 826, 968 to 998); export `docs/figma/components/418-6433.png` typed text and icons of every Input with Active=No. Added in task 002 (decision #86) |

## Typography

Every app text style uses Inter with letter spacing 0. The styles combine one size step with one weight, while the screens use the size steps with all five weights, so sizes, line heights and weights are separate tokens. Each Figma text style is also a `font` shorthand token built from them.

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--font-family-inter` | `'Inter Variable', 'Inter', sans-serif` | Figma text styles (family Inter on all 10), decision #13. `Inter Variable` is the family `@fontsource-variable/inter` registers |
| `--font-weight-regular` | `400` | Figma text styles `Regular 12-16`, `Regular 14-20`, `Regular 16-24` |
| `--font-weight-medium` | `500` | Components page label "Medium" (no text style uses it) |
| `--font-weight-semi-bold` | `600` | Figma text style `Semibold 20-28` |
| `--font-weight-bold` | `700` | Figma text style `Bold 24-28` |
| `--font-weight-extra-bold` | `800` | Figma text styles `Exbold 18-24`, `Exbold 22-32` |
| `--font-size-12` | `12px` | Figma text style `Regular 12-16` |
| `--font-size-14` | `14px` | Figma text style `Regular 14-20` |
| `--font-size-16` | `16px` | Figma text style `Regular 16-24` |
| `--font-size-18` | `18px` | Figma text style `Exbold 18-24` |
| `--font-size-20` | `20px` | Figma text style `Semibold 20-28` |
| `--font-size-22` | `22px` | Figma text style `Exbold 22-32` |
| `--font-size-24` | `24px` | Figma text style `Bold 24-28` |
| `--line-height-16` | `16px` | Figma text style `Regular 12-16` |
| `--line-height-20` | `20px` | Figma text style `Regular 14-20` |
| `--line-height-24` | `24px` | Figma text styles `Regular 16-24`, `Exbold 18-24` |
| `--line-height-28` | `28px` | Figma text styles `Semibold 20-28`, `Bold 24-28` |
| `--line-height-32` | `32px` | Figma text style `Exbold 22-32` |
| `--font-regular-12-16` | `var(--font-weight-regular) var(--font-size-12)/var(--line-height-16) var(--font-family-inter)` | Figma text style `Regular 12-16` |
| `--font-regular-14-20` | `var(--font-weight-regular) var(--font-size-14)/var(--line-height-20) var(--font-family-inter)` | Figma text style `Regular 14-20` |
| `--font-regular-16-24` | `var(--font-weight-regular) var(--font-size-16)/var(--line-height-24) var(--font-family-inter)` | Figma text style `Regular 16-24` |
| `--font-exbold-18-24` | `var(--font-weight-extra-bold) var(--font-size-18)/var(--line-height-24) var(--font-family-inter)` | Figma text style `Exbold 18-24` |
| `--font-semibold-20-28` | `var(--font-weight-semi-bold) var(--font-size-20)/var(--line-height-28) var(--font-family-inter)` | Figma text style `Semibold 20-28` |
| `--font-exbold-22-32` | `var(--font-weight-extra-bold) var(--font-size-22)/var(--line-height-32) var(--font-family-inter)` | Figma text style `Exbold 22-32` |
| `--font-bold-24-28` | `var(--font-weight-bold) var(--font-size-24)/var(--line-height-28) var(--font-family-inter)` | Figma text style `Bold 24-28` |

## Spacing

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--space-page-top` | `16px` | measured: PNG 104 and 105, header bottom (y 176) to the section title line box (y 208; glyph top 224 minus 16 for 22/32 text), 32 px, halved |
| `--space-page-left` | `24px` | measured: PNG 104 and 105, sidebar edge (x 560) to the first card (x 608), 48 px, halved |
| `--space-page-right` | `32px` | measured: PNG 104 and 105, right edge of the cards and the search field (x 2816) to the frame edge (x 2880), 64 px, halved |
| `--space-section-title-gap` | `8px` | measured: PNG 104, section title line box bottom (y 272) to card top (y 288), 16 px, halved. Screens use the gap their PNG shows (review, Marko, 2026-10-23) |
| `--space-section-title-gap-lg` | `16px` | measured: PNG 105, "Balances" title line box bottom (y 272) to card top (y 304), 32 px, halved. Added in review |
| `--space-card-gap` | `24px` | measured: PNG 104 and 105, card right edge (x 1312) to the next card (x 1360), 48 px, halved |
| `--space-card-row-gap` | `32px` | measured: PNG 105, row 1 card bottom (y 880) to row 2 card top (y 944), 64 px, halved. PNG 104: card bottom (y 752) to the next section title line box (y 816), also 64 px |
| `--space-card-padding` | `24px` | measured: PNG 104 and 105, card left edge (x 608) to its text (x 657), 49 px, halved 24.5, rounded |
| `--space-form-label-gap` | `8px` | measured: PNG 101, "Email Address" line box bottom (y 560; glyph baseline 548, 16/24 text) to the input top (y 576), 16 px, halved |
| `--space-form-field-gap` | `24px` | measured: PNG 101, email input bottom (y 672) to the "Password" line box top (y 720), 48 px, halved |
| `--space-form-section-gap` | `32px` | measured: PNG 101, password input bottom (y 880) to the "Keep me signed in" row top (y 944), 64 px, halved. Login button bottom (y 1120) to the "or sign in with" row (y 1184), also 64 px |
| `--space-form-small-gap` | `16px` | measured: PNG 101, "Keep me signed in" row bottom (y 992) to the Login button top (y 1024), 32 px, halved |
| `--space-input-padding-x` | `16px` | measured: PNG 101, input left edge (x 1040) to the masked dots and typed text (x 1072), and the eye icon box right edge (x 1808) to the input right edge (x 1840), 32 px, halved. Added in task 002 |
| `--space-auth-divider-inset` | `28px` | measured: PNG 101 and 102, column left edge (x 1040) to the "or sign in with" left line (x 1098), and the right line end (x 1782) to the column right edge (x 1840), 58 px, halved 29, rounded. Added in task 002 |
| `--space-focus-ring-offset` | `2px` | decision #87: not measured, keyboard focus is not designed. Gap between a focused control and its focus ring. Added in task 002 |
| `--space-sidebar-x` | `28px` | measured: PNG 104, sidebar left edge (x 0) to the nav item (x 56), 56 px, halved |
| `--space-nav-item-gap` | `16px` | measured: PNG 104 and 105, Overview item bottom (y 336) to the Balances item top (y 368 in 105), 32 px, halved |
| `--space-nav-padding-x` | `16px` | measured: PNG 104, nav item left edge (x 56) to the 24 px icon box (x 89; the 40 px glyph at x 94 to 133, centered in a 48 px box), 33 px, halved 16.5, rounded |
| `--space-nav-icon-gap` | `12px` | measured: PNG 104, icon box right edge (x 137) to the label (x 160), 23 px, halved 11.5, rounded |
| `--space-popup-padding-x` | `64px` | measured: PNG 104.1, popup left edge (x 1208) to the input (x 1336), 128 px, halved |
| `--space-popup-padding-bottom` | `48px` | measured: PNG 104.1, Save button bottom (y 1240) to the popup bottom (y 1336), 96 px, halved |

## Size

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--size-sidebar-width` | `280px` | measured: PNG 104, sidebar x 0 to 559, 560 px, halved |
| `--size-header-height` | `88px` | measured: PNG 104 and 105, header y 0 to 175 including its 2 px bottom border, 176 px, halved |
| `--size-auth-column-width` | `400px` | measured: PNG 101, inputs and buttons x 1040 to 1839, 800 px, halved |
| `--size-auth-logo-width` | `272px` | measured: PNG 101, 102 and 103, logo glyphs x 1169 to 1712, 544 px, halved. The height follows the SVG viewBox (163x18): 30px. Added in task 002 |
| `--size-auth-divider-line-width` | `108px` | measured: PNG 101 and 102, "or sign in with" lines x 1098 to 1311 and 1568 to 1781, 214 px, halved 107, rounded. Added in task 002 |
| `--size-input-height` | `48px` | measured: PNG 101, email and password inputs y 576 to 671 and 784 to 879, 96 px, halved |
| `--size-popup-input-height` | `56px` | measured: PNG 104.1, popup inputs y 744 to 855, 112 px, halved |
| `--size-button-height` | `48px` | measured: PNG 101 Login (y 1024 to 1119) and Google (y 1288 to 1383), PNG 104.1 Save (y 1144 to 1239), 96 px, halved |
| `--size-nav-item-width` | `224px` | measured: PNG 104, Overview item x 56 to 503, 448 px, halved |
| `--size-nav-item-height` | `48px` | measured: PNG 104, Overview item y 240 to 335 and Logout y 1560 to 1655, 96 px, halved |
| `--size-search-width` | `352px` | measured: PNG 104, header search x 2112 to 2815, 704 px, halved |
| `--size-search-height` | `48px` | measured: PNG 104, header search y 40 to 135, 96 px, halved |
| `--size-card-width` | `352px` | measured: PNG 104 and 105, cards x 608 to 1311, 704 px, halved |
| `--size-popup-width` | `488px` | measured: PNG 104.1, popup x 1208 to 2183, 976 px, halved |
| `--size-icon-sm` | `16px` | 16x16 icon components (`components.md`: arrow-right 16, arrow-up-right, Down arrow 16, Up arrow). The PNGs show only the glyphs, not the icon box |
| `--size-icon-md` | `20px` | 20x20 icon component `Frame 39997` (Logout icon, `components.md`). The PNGs show only the glyph |
| `--size-icon` | `24px` | 24x24 icon components (`components.md`). Checked: PNG 104 nav icon glyph is 40 px wide inside a 48 px slot |
| `--size-icon-lg` | `32px` | 32x32 icon component `x` (popup close in 104.1, `components.md`). The PNGs show only the glyph |
| `--size-avatar` | `32px` | measured: PNG 104, sidebar profile photo y 1816 to 1879, 64 px, halved |
| `--size-checkbox` | `20px` | measured: PNG 101, "Keep me signed in" checkbox y 948 to 987, 40 px, halved |
| `--size-date-box-width` | `44px` | measured: PNG 104, Upcoming Bill date box x 2160 to 2247, 88 px, halved |
| `--size-date-box-height` | `64px` | measured: PNG 104, Upcoming Bill date box y 352 to 483, 132 px, halved 66, rounded down (66 is between 64 and 68) |
| `--size-amount-box-height` | `40px` | measured: PNG 104, Upcoming Bill amount box y 378 to 457, 80 px, halved |

## Radius

Each corner was fitted as a circle to the edge curve (PNG pixels, fit error under 1.2 unless noted).

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--radius-input` | `8px` | measured: PNG 101 email input and PNG 104.1 popup inputs, corner radius 16 px, halved |
| `--radius-button` | `4px` | measured: PNG 101 Login and Google buttons, PNG 104.1 Save, corner radius 8 px, halved |
| `--radius-card` | `8px` | measured: PNG 104 Total Balance card and PNG 105 Credit Card card, corner radius 16 px, halved |
| `--radius-nav-item` | `4px` | measured: PNG 104 active Overview item and Logout, corner radius 8 px, halved |
| `--radius-search` | `12px` | measured: PNG 104 header search, corner radius 24 px (fit error 2.3), halved |
| `--radius-popup` | `16px` | measured: PNG 104.1 popup bottom-right corner, radius 32 px (fit error 3.6; the top corners overlap dimmed content), halved |
| `--radius-date-box` | `8px` | measured: PNG 104 Upcoming Bill date box, corner radius 16 px, halved |
| `--radius-amount-box` | `8px` | measured: PNG 104 Upcoming Bill amount box, corner radius 16 px, halved |
| `--radius-account-card` | `4px` | measured: PNG 104 teal account card in Total Balance, corner radius 8 px, halved |
| `--radius-checkbox` | `2px` | measured: PNG 101 "Keep me signed in" checkbox and export `docs/figma/components/418-6433.png` Remind me, corner radius 4 px, halved. Kept at 2px, an exception to the 4px grid like border widths (decision #86). Added in task 002 |

## Border

Halved, not rounded.

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--border-width-input` | `1px` | measured: PNG 101 inputs (y 576 to 577), PNG 104.1 popup inputs, PNG 104 amount box, 2 px, halved |
| `--border-width-divider` | `1px` | measured: PNG 104 header bottom border (y 174 to 175), Total Balance divider (y 414 to 415), sidebar divider (y 1744 to 1745), 2 px, halved |
| `--border-width-table-line` | `1px` | measured: PNG 104 Recent Transaction row lines (y 1206 to 1207) and Expenses Breakdown grid lines (x 1850 to 1851), 2 px, halved |
| `--border-width-auth-divider` | `1px` | measured: PNG 101 "or sign in with" lines (y 1203), 1 px, halved 0.5; set to 1px in review (Marko, 2026-10-23) |
| `--border-width-tab-indicator` | `2px` | measured: PNG 104 active "All" tab underline (y 1004 to 1007), 4 px, halved |
| `--border-width-focus-ring` | `2px` | decision #87: not measured, keyboard focus is not designed. Width of the `:focus-visible` outline. Added in task 002 |

## Shadow

Fitted as a Gaussian blur (CSS blur = 2 sigma) with x-offset 0 and spread 0, from the darkening profile below the element and beside it at mid-height, against the page background. Offset and blur are halved and rounded to 4px. Only the darkening per channel is visible, not the color and alpha separately, so the colors are estimates.

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--shadow-card` | `0 20px 24px rgb(76 103 100 / 10%)` | measured: PNG 105 (Credit Card and Add Accounts cards) and PNG 104 (Upcoming Bill), fit offset-y 20, blur 24, fit error 0.3 of 255. Darkening at full cover (17, 14, 14) per channel, matched within 1 by this color |
| `--shadow-search` | `0 28px 16px rgb(124 45 87 / 5%)` | measured: PNG 104 header search, fit offset-y 28.5 (rounded to 28), blur 16, fit error 0.6 of 255. Darkening at full cover (6, 10, 8): the tint is known, the alpha of 5% is assumed |
| `--shadow-popup` | `none` | measured: PNG 104.1, the dimmed content around the popup is a uniform `#DDDDDD` on all sides, no shadow |

## Review (Marko, 2026-10-23)

Values seen in the PNGs that neither the Figma call nor the Components page labels define, and how the review settled them:

- Page background: the PNGs show `#F4F5F7` on 101, 104 and 105. Use `--color-gray-06`; no separate token.
- Auth cool grays from 101: added as measured tokens by role (`--color-form-label`, `--color-input-active`, `--color-input-border`, `--color-button-secondary`, `--color-auth-divider`).
- Popup input border (104.1, `#D1D1D1`): use `--color-special-bg`; no separate token.
- Popup overlay (104.1): `--color-default-black-15`.
- Logout button background (104, `#262626`): `--color-logout-bg`.
- Expenses Breakdown cell dividers (104, `#F6F6F6`): `--color-divider-light`.
- Section title to card gap: both kept, `--space-section-title-gap` (8, Overview) and `--space-section-title-gap-lg` (16, Balances); each screen uses what its PNG shows.
- Auth divider width: 1px instead of the halved 0.5px.
- Documentation text styles `.doc / H3` (Bold 24/32, -0.5), `.doc / H4` (Semibold 12/16, -0.5) and `.doc / Regular` (Regular 12/16) were returned by the call. They label the Components page itself and appear in no screen, so they are not tokens.
