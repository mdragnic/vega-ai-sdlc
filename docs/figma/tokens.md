# Design tokens

Written in task 000, steps 7 to 9 (decision #65). `frontend/src/styles/tokens.css` is generated from the tables below, one custom property per row, with the same name and value. It is the only frontend file with raw design values.

Sources:
- Colors and typography: one `get_variable_defs` call on the Typography & Color frame `418:6459` on 2026-10-23 (`docs/figma/inventory.md`, call 5). It returned 12 color variables and 10 text styles, and no effects.
- Components page labels (`docs/figma/components.md`, last section) for values the call lacks.
- Everything else is measured from the 2x PNGs in `docs/figma/`: pixel positions are PNG pixels (2880x2048), halved, then rounded to the nearest 4px. Border widths, and radii under 4px, are halved but not rounded (decisions #86, #92). Inside an SVG, only the colors, the typography and the outer size are tokens; the drawing inside is numeric, from named constants in the component (decision #92). Measured with a Node script using only built-ins (PNG decode, color runs, corner-curve fit, Gaussian shadow fit), kept outside the repo.

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
| `--line-height-22` | `22px` | PNG 108 Bills, kept off the 4px grid as the task 023 file sets (Marko, 2026-11-03): the description under each title (Regular 14, Gray/03) is one line every 44 px (its ink rows from y 587, 631 and 675), halved, so a row is 162 high as drawn (32 + 24 + 8 + 3 x 22 + 32). No Figma text style has 14/22 (the call returned `Regular 14-20`), and #65 puts spacing, radii and shadows on the 4px grid, not type. Added in task 023 |
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
| `--space-page-bottom` | `32px` | measured: PNG 104, the last cards' bottom (Recent Transaction and Expenses Breakdown, white to y 1979) to the frame bottom (y 2048), 68 px, halved 34, a tie on the 4px grid: 32, as decision #111 sets (the app's last cards end at y 992, #93, 32 above 1024). Under the content of every app screen, where it scrolls. Added in task 015 |
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
| `--space-login-top` | `160px` | measured: PNG 101, page top to the logo glyph top (y 320; the logo SVG has no space above its glyphs), 320 px, halved. Added in task 009 |
| `--space-login-logo-gap` | `64px` | measured: PNG 101, logo glyph bottom (y 381) to the "Email Address" line box top (y 512: the input top at y 576 less the 8px label gap and the 24px line, at 2x), 131 px, halved 65.5, rounded. Added in task 009 |
| `--space-login-link-gap` | `40px` | measured: PNG 101, "Continue with Google" bottom (y 1384) to the "Create an account" line box top (y 1464: its glyph top at y 1476 less the 6px cap offset of Inter 16/24, at 2x), 80 px, halved. Added in task 009 |
| `--space-sign-up-top` | `112px` | measured: PNG 102, page top to the logo glyph top (y 224; the logo SVG has no space above its glyphs), 224 px, halved. Added in task 010 |
| `--space-sign-up-logo-gap` | `36px` | measured: PNG 102, logo glyph bottom (y 284) to the "Create an account" line box top (y 358: its glyph top at y 370 less the 12 px cap offset of Inter Bold 24 in a 32 px line, measured on a render, at 2x), 74 px, halved 37, rounded. Added in task 010 |
| `--space-sign-up-heading-gap` | `32px` | measured: PNG 102, "Create an account" line box bottom (y 422) to the "Name" line box top (y 488: the input top at y 552 less the 8px label gap and the 24px line, at 2x), 66 px, halved 33, rounded. With the 28 px line of the Bold 24-28 style the two gaps round to 40 and 36 and put the fields 2 px low, or to 36 and 36 and put the heading 3 px high; the 32 px line keeps both within 2 px. Added in task 010 |
| `--space-sign-up-terms-gap` | `20px` | measured: PNG 102, the terms line box bottom (y 1168: 14/20 text, its glyph top at y 1136 less the 8 px offset, at 2x) to the Sign up button top (y 1208), 40 px, halved. The line box top (y 1128) is 32 below the password input (`--space-form-section-gap`). Added in task 010 |
| `--space-sign-up-link-gap` | `40px` | measured: PNG 102, "Continue with Google" bottom (y 1568) to the "Already have an account?" line box top (y 1648: its glyph top at y 1659 less the 11 px offset of Inter 16/24, at 2x), 80 px, halved. Added in task 010 |
| `--space-forgot-password-top` | `228px` | measured: PNG 103, page top to the logo glyph top (y 460), 460 px, halved 230, a tie between 228 and 232: 228 by decision #99 (b), 2 px above 103. Added in task 010 |
| `--space-forgot-password-logo-gap` | `44px` | measured: PNG 103, logo glyph bottom (y 520) to the "Forgot Password?" line box top (y 606: its glyph top at y 618 less the 12 px offset of Inter Bold 24 in a 32 px line, at 2x), 86 px, halved 43, rounded. With the logo at 228 (#99 b) the heading sits 1 px above 103. Added in task 010 |
| `--space-forgot-password-heading-gap` | `16px` | measured: PNG 103, "Forgot Password?" line box bottom (y 670) to the first text line box top (y 696: 18/24 text, its glyph top at y 705 less the 9 px offset, at 2x), 26 px, halved 13. 103 draws the two text lines 26 px apart, the built 24 px line height 2 px closer: 16 puts the second line where 103 draws it and the first 2 px low; 12 would put the first 2 px and the second 4 px high. Added in task 010 |
| `--space-forgot-password-text-gap` | `36px` | measured: PNG 103, the second text line box bottom (y 796: its glyph top at y 757 less 9, plus the 48 px line, at 2x) to the "Email Address" line box top (y 868: the input top at y 932 less the 8px label gap and the 24px line), 72 px, halved. Added in task 010 |
| `--space-forgot-password-link-gap` | `24px` | measured: PNG 103, "Password Reset" bottom (y 1188) to the "Back to login" line box top (y 1236: its glyph top at y 1247 less the 11 px offset of Inter 16/24, at 2x), 48 px, halved. Added in task 010 |
| `--space-focus-ring-offset` | `2px` | decision #87: not measured, keyboard focus is not designed. Gap between a focused control and its focus ring. Added in task 002 |
| `--space-sidebar-x` | `28px` | measured: PNG 104, sidebar left edge (x 0) to the nav item (x 56), 56 px, halved |
| `--space-nav-item-gap` | `16px` | measured: PNG 104 and 105, Overview item bottom (y 336) to the Balances item top (y 368 in 105), 32 px, halved |
| `--space-nav-padding-x` | `16px` | measured: PNG 104, nav item left edge (x 56) to the 24 px icon box (x 89; the 40 px glyph at x 94 to 133, centered in a 48 px box), 33 px, halved 16.5, rounded |
| `--space-nav-icon-gap` | `12px` | measured: PNG 104, icon box right edge (x 137) to the label (x 160), 23 px, halved 11.5, rounded |
| `--space-popup-padding-x` | `64px` | measured: PNG 104.1, popup left edge (x 1208) to the input (x 1336), 128 px, halved |
| `--space-popup-padding-bottom` | `48px` | measured: PNG 104.1, Save button bottom (y 1240) to the popup bottom (y 1336), 96 px, halved |
| `--space-sidebar-logo-gap` | `48px` | measured: PNG 104 and 105, sidebar logo glyph bottom (y 144) to the Overview item top (y 240), 96 px, halved. Added in task 003 |
| `--space-sidebar-logout-gap` | `44px` | measured: PNG 104 and 105, Logout bottom (y 1656) to the sidebar divider (y 1744), 88 px, halved. Added in task 003 |
| `--space-sidebar-bottom` | `48px` | measured: PNG 104 and 105, profile block bottom (y 1952: the divider at y 1744 plus the 208 px block) to the frame bottom (y 2048), 96 px, halved. Added in task 003 |
| `--space-logout-icon-gap` | `16px` | measured: PNG 104 and 105, Logout icon box right edge (x 128; the 34 px glyph at x 91 to 124 in a 40 px box) to the label (x 160, glyph at 162), 32 px, halved. Added in task 003 |
| `--space-profile-gap` | `16px` | measured: PNG 104 and 105, avatar right edge (x 120) to the name and "View profile" (x 152, glyphs at 153), 32 px, halved. Added in task 003 |
| `--space-header-greeting-gap` | `24px` | measured: PNG 104, end of the "Hello Tanzir" text box (x 888, glyphs to 884) to the "»" icon box (x 936; the 28 px glyph at x 946 to 973), 48 px, halved. Added in task 003 |
| `--space-header-date-gap` | `4px` | measured: PNG 104 and 105, "»" icon box right edge (x 984; 656 in 105) to the date text box (x 992; 664 in 105, glyphs 2 px later), 8 px, halved. Added in task 003 |
| `--space-header-actions-gap` | `40px` | measured: PNG 104 and 105, bell icon box right edge (x 2032; glyph x 1988 to 2030) to the search field (x 2112), 80 px, halved. Added in task 003 |
| `--space-search-padding-left` | `32px` | measured: PNG 104 and 105, search field left edge (x 2112) to the placeholder text box (x 2176, glyph at 2178), 64 px, halved. Added in task 003 |
| `--space-search-padding-right` | `24px` | measured: PNG 104 and 105, search icon box right edge (x 2770; the 40 px glyph at x 2724 to 2763) to the field right edge (x 2816), 46 px, halved 23, rounded. Added in task 003 |
| `--space-view-all-gap` | `8px` | measured: PNG 104, end of the "View All" text (glyphs to x 2741) to the 16px chevron box (x 2759; its glyph x 2770 to 2781), 17 px including the side bearing of the "l", halved 8.5, rounded. A render with 8 puts the text within 1 px of 104 at 2x; Recent Transaction (x 1261 to 1279) is the same. Added in task 004 |
| `--space-tab-padding-x` | `8px` | measured: PNG 104, the active "All" underline (x 656 to 729) reaches 16 px past the label text box (glyphs x 672 to 711) on each side, halved. PNG 107 the same (x 608 to 681). Added in task 004 |
| `--space-tab-gap` | `20px` | measured: PNG 104, end of the "All" tab (underline end x 730) to the start of the "Revenue" tab (its text box at x 786 minus the 16 px padding), 40 px, halved. Rendered with 16, 20 and 24, 20 matched 104 best (mean diff 5.7, against 9.7 and 13.0). Added in task 004 |
| `--space-date-box-gap` | `4px` | measured: PNG 108, month line box bottom (16/24 text, baseline y 907 in the Adobe box) to the day line box top (22/32 text, baseline y 977), 9.6 px, halved 4.8, rounded. PNG 104 shows 2.4 in its 66 px box. Added in task 004 |
| `--space-amount-box-padding-x` | `12px` | measured: PNG 104, the "$150" text sits about 14 px inside the 68px box on each side (glyphs x 2661 to 2737 in x 2632 to 2767, 28.5 px at 2x); 14 is between 12 and 16, rounded down to stay within what the 68px box leaves on each side. The inset kept when a longer amount widens the box, as `$150.00` (#11) does. Added in task 004 |
| `--space-amount-box-padding-x-lg` | `16px` | not measurable: in PNG 108 the "$150" text is centered in the 108px box, 31.5 px from each side, so only the upper bound shows. Chosen in task 004 as the inset kept when a longer amount widens the box; any value up to 31 keeps "$150" at 108px |
| `--space-button-small-padding-x` | `16px` | measured: export docs/figma/components/418-6433.png, Button small "Details": the text 35 and 34 px inside the box (glyphs x 2363 to 2461 in x 2328 to 2495), halved 17.5 and 17, rounded. A longer label widens the button. Added in task 004 |
| `--space-popup-top` | `276px` | measured: PNG 104.1, 110.1 and 110.2, frame top (y 0) to the popup panel top (y 552), 552 px, halved. The same top edge for the 392-high and the 280-high popup, so the panel is not centered vertically (decision #90 c). Added in task 005 |
| `--space-popup-close-inset` | `24px` | measured: PNG 104.1, the X glyph (x 2085 to 2122, y 613 to 650) is the stroke of the 32px `x` icon (path 8 to 24, 3 px round stroke, so 6.5 px inside each icon edge); the icon box then sits 48 px from the panel right edge (x 2184) and top (y 552), halved. Added in task 005 |
| `--space-popup-input-padding-x` | `24px` | measured: PNG 104.1, field left edge (x 1336) to the `$500000` glyphs (x 1386) and the placeholder glyphs (x 1385), 49 to 50 px including the side bearing of the first glyph, halved, rounded. Added in task 005 |
| `--space-dropdown-padding-x` | `16px` | measured: PNG 110, Savings Goal period box left edge (x 984) to its text glyphs (x 1018, 1 to 2 px of side bearing), 33 px, and the 16px chevron box (glyph x 1238 to 1257) to the box right edge (x 1296), 32 px, halved, rounded. Added in task 005 |
| `--space-dropdown-chevron-gap` | `8px` | measured: PNG 110, end of the period text (glyphs to x 1213) to the 16px chevron box (its 9 px glyph at x 1238 to 1257 sits 3.3 px inside the box), 17 px, halved 8.5, rounded; Saving Summary the same (text to x 1877, glyph from x 1902). Added in task 005 |
| `--space-dropdown-comparison-chevron-gap` | `12px` | measured: PNG 104 Statistics, the "Weekly Comparison" text (Semibold 16, its advance ends at x 859.5 at 1x in headless Chromium with Inter Variable; the ink ends at x 858) to the `DownArrow24` box (its 14x8 glyph ink at x 876 to 890 sits 5 px inside the 24 px box, so the box starts at x 871), 11.5 px, rounded; PNG 109 "Monthly Comparison" the same (chevron ink x 507 to 521). Added in task 017 |
| `--space-chart-legend-swatch-gap` | `8px` | measured: PNG 104, legend swatch right edge (x 2420) to the "This week" glyphs (x 2437), 17 px including the side bearing of the "T", halved 8.5, rounded; PNG 109 the same (x 2408 to 2425). Added in task 006 |
| `--space-chart-legend-item-gap` | `24px` | measured: PNG 104, end of the "This week" text (glyphs to x 2551) to the "Last week" swatch (x 2602), 50 px including the side bearing of the "k", halved 25, rounded. Added in task 006 |
| `--space-gauge-caption-gap` | `16px` | measured: PNG 104, bottom of the gauge drawing (y 640, see --size-gauge-height) to the "Target vs Achievement" line box (y 671: glyphs from y 678 in a 12/16 line), 31 px, halved 15.5, rounded. PNG 110 the same. Added in task 006 |
| `--space-overview-card-padding-y` | `20px` | measured: PNG 104, top row card top (y 288) to the Goals edit button and the Total Balance total row (y 328), 40 px, and the Previous / Next row bottom (y 712: its 14/20 line box, glyph top y 681 less 8, plus 40) to the card bottom (y 752), 40 px, halved. The top row cards are inset 20 vertically and 24 (`--space-card-padding`) horizontally. Added in task 013 |
| `--space-total-balance-gap` | `12px` | measured: PNG 104, Total Balance total row bottom (y 392) to the divider (y 414), 22 px, and the divider bottom (y 416) to the teal card (y 440), 24 px, halved 11 and 12, rounded. Added in task 013 |
| `--space-total-balance-control-gap` | `16px` | measured: PNG 104, teal card bottom (y 632) to the Previous / Next row (y 672), 40 px, halved 20: at the 232 card minimum the row sits at the card bottom as drawn (y 336, 19 below the teal card, since the divider rounds 1 px down). This is the least space kept above the row when a taller teal card (decision #106) pushes it down. Added in task 013 |
| `--space-account-slide-padding` | `16px` | measured: PNG 104, teal card left edge (x 656) to "Account Type" (glyphs from x 689, 1 px side bearing), 33 px; its right edge (x 1263) to the round arrow (x 1231) and its bottom (y 631) to the arrow (y 599), 32 px; its top (y 440) to the "Account Type" 14/20 line box (y 472: glyph top y 481 less 8), 32 px; halved, rounded. The logo box sits 4 px higher in 104 (its ink from y 476). Added in task 013 |
| `--space-account-slide-amount-gap` | `12px` | measured: PNG 104, end of "$25000" (glyphs to x 1158) to the round arrow (x 1184), 26 px including the side bearing of the "0", halved 13, rounded. Added in task 013 |
| `--space-account-slide-line-gap` | `4px` | decision #106: not measured, 104 leaves 43 px between the number and "$25000". The least space between the masked number and the balance before the balance and the round arrow wrap to their own line; on the 4px grid and small enough that the demo balances stay on one line at 1440 with a classic scrollbar (Checking needs 263 of 267 px). Added in task 013 |
| `--space-slider-dot-gap` | `8px` | measured: PNG 104, Previous / Next dots x 920 to 935, 952 to 967, 984 to 999: 16 px between them, halved. Added in task 013 |
| `--space-slider-chevron-gap` | `4px` | measured: PNG 104, the left chevron's 16 px box (x 656 to 687, glyph x 667 to 676) to "Previous" (glyphs from x 698), 10 px including the side bearing of the "P", and "Next" (glyphs to x 1221) to the right chevron's box (x 1232, glyph x 1243 to 1252), 10 px including the "t", halved 5, rounded. Added in task 013 |
| `--space-goals-edit-gap` | `12px` | measured: PNG 104 Goals, the end of the Target "$20,000" (Exbold 22, its Chromium text box to x 1600; ink to x 1599) to the pencil box (x 1620), 20 px, halved 10, a tie on the 4px grid: 12, as measured at the detailing of task 014. Added in task 014 |
| `--space-goals-divider-gap` | `12px` | measured: PNG 104 Goals, the Target row bottom (y 392) to the divider (y 414), 22 px, halved 11, rounded 12, as the Total Balance row (`--space-total-balance-gap`). Added in task 014 |
| `--space-goals-body-gap` | `20px` | measured: PNG 104 Goals, the divider bottom (y 416) to the gauge arc top (y 456), 40 px, halved. The amounts are centered on the gauge (both centered at y 580). Added in task 014 |
| `--space-goals-icon-gap` | `4px` | measured: PNG 104 Goals, the Award and goal icons' 24 px boxes (x 1408 to 1455: Award ink x 1416 to 1447) to "Target Achieved" and "This month Target" (glyphs from x 1465, 1 px side bearing), 8 px, halved. Added in task 014 |
| `--space-goals-amount-gap` | `4px` | measured: PNG 104 Goals, the "Target Achieved" 12/16 line box (glyphs y 474 to 497: in the 2x render they start 6 px below the line top, so the line is y 468 to 500) to the "$12,500" 16/24 line box (the "$" from y 517, 9 px below its line top in the render: from y 508), 8 px, halved. Added in task 014 |
| `--space-goals-group-gap` | `24px` | measured: PNG 104 Goals, the "$12,500" 16/24 line box bottom (y 556, see --space-goals-amount-gap) to the "This month Target" 12/16 line box (glyphs from y 610, line from y 604), 48 px, halved; the goal icon's box from y 604 too (ink y 610 to 645). Added in task 014 |
| `--space-goals-gauge-inset` | `8px` | measured: PNG 104 Goals, the gauge arc's right edge (x 1999, see `--size-gauge-width`) to the card content's right edge (x 2016), 17 px, halved 8.5, rounded: the room the `$20k` label takes past the arc (its ink to x 2015). Added in task 014 |
| `--space-goals-wrap-gap` | `16px` | decision #108 b: not measured, 104 leaves 35 px or more. The least space between the Target with the pencil and the month, and between the amounts and the gauge; where a line does not fit with it, the right part moves under the left, this far below. Added in task 014 |
| `--space-upcoming-bill-padding-top` | `32px` | measured: PNG 104 Upcoming Bill, the card top (y 288) to the first date box (y 352), 64 px, halved. Added in task 015 |
| `--space-upcoming-bill-padding-bottom` | `28px` | measured: PNG 104 Upcoming Bill, the second date box bottom (y 696) to the card bottom (y 752), 56 px, halved. Added in task 015 |
| `--space-upcoming-bill-date-gap` | `12px` | measured: PNG 104 Upcoming Bill, the date box right edge (x 2248) to the logo and the text (x 2272), 24 px, halved. Added in task 015 |
| `--space-upcoming-bill-row-gap` | `20px` | measured: PNG 104 Upcoming Bill, the first date box bottom (y 484) to the Gray/06 divider (y 522), 38 px, halved 19, rounded; the divider bottom (y 524) to the second date box (y 564), 40 px, halved. Added in task 015 |
| `--space-upcoming-bill-text-gap` | `4px` | chosen: the text column fills the 64 px date box (`--size-date-box-height`), its three lines 4 apart, (64 - 16 - 24 - 16) / 2. Checked: PNG 104 Upcoming Bill, the logo ink from y 356 and the "Last Charge" ink to y 477 span the drawn 66 px box (y 352 to 483); at 64 the logo and the title sit 2 px higher than drawn and "Last Charge" where drawn. Matching both would need a 2 px gap, off the 4px grid (#65). Added in task 015 |
| `--space-upcoming-bill-amount-gap` | `16px` | decision #111 a: not measured, 104 leaves 23.5 px or more between the text and the amount box ("Last Charge - 14 May, 2022" to x 2585, the box from x 2632). The least space between the text column and the amount box, as `--space-goals-wrap-gap` (#108 b); where they do not fit with it, the amount box moves under the text. Added in task 015 |
| `--space-upcoming-bill-wrap-gap` | `12px` | decision #111 a: the amount box 12 under the text where it moves under it, right-aligned. Added in task 015 |
| `--space-recent-transaction-list-gap` | `12px` | measured: PNG 104 Recent Transaction, the active "All" underline bottom (y 1007) to the first row's top (y 1032: the first tile at y 1081 less the row's 48 px inset), 24 px, halved (x 328 to 632 at 1x, rows from y 516). Added in task 016 |
| `--space-recent-transaction-row-padding-y` | `24px` | measured: PNG 104 Recent Transaction, the tiles y 1081 to 1158, 1257 to 1334 and on, one row every 176 px; the Gray/06 divider at y 1206 to 1207, the row's last 2 px: 48 px above each tile and 48 below it, the divider inside the lower 48, halved. A row is 88 high, the divider its last pixel row. Added in task 016 |
| `--space-recent-transaction-icon-gap` | `16px` | measured: PNG 104 Recent Transaction, the tile right edge (x 736) to the item and the shop (x 768), 32 px, halved. Added in task 016 |
| `--space-recent-transaction-amount-gap` | `16px` | Marko's notes for task 016, as `--space-upcoming-bill-amount-gap` (#111 a): not measured, 104 leaves 91.5 px or more between the text and the right column (rows 1 and 5: the text ink to x 934, the amount ink from x 1117). The least space between the text column and the amount column; where they do not fit with it, the amount column moves under the text. Added in task 016 |
| `--space-recent-transaction-wrap-gap` | `12px` | Marko's notes for task 016, as `--space-upcoming-bill-wrap-gap` (#111 a): the amount column 12 under the text where it moves under it, right-aligned. Added in task 016 |
| `--space-expenses-breakdown-column-gap` | `40px` | measured: PNG 104 Expenses Breakdown, the tiles at x 1440, 1920 and 2400, one column every 480 px, halved 240, less the 200 px item (Figma `Expences Item` 200x74). Added in task 018 |
| `--space-expenses-breakdown-row-gap` | `24px` | measured: PNG 104 Expenses Breakdown, the tiles at y 1612 and 1808, one row every 196 px, halved 98, less the 74 px item (`--size-expenses-item-height`). Added in task 018 |
| `--space-expenses-breakdown-line-x` | `20px` | task 018, half of `--space-expenses-breakdown-column-gap`: each vertical line starts 20 after the item on its left, in the middle of the gap. PNG 104 draws them at x 1850 to 1851 and 2330 to 2331, 21 after the items (1 to the right of the middle) and 4 longer than the two rows. Added in task 018 |
| `--space-expenses-breakdown-line-y` | `12px` | measured: PNG 104 Expenses Breakdown, the horizontal line y 1766 to 1767 ends 24 px above the second row's top (y 1792, its tiles at y 1808 less the item's 16), halved: it ends in the middle of the row gap. Added in task 018 |
| `--space-expenses-item-padding-y` | `8px` | measured: PNG 104 Expenses Breakdown, the card's top (y 1556) and its 40 px inset (`--space-overview-card-padding-y`) to the first tiles (y 1612), 16 px, halved: the tile 8 under the item's top. Added in task 018 |
| `--space-expenses-item-padding-x` | `16px` | measured: PNG 104 Expenses Breakdown, the content's left (x 1408: the card at x 1360 and its 48 px inset) to the first tile (x 1440), 32 px, halved; the hovered right arrow's ink ends at x 1773, its 24 px box (`ArrowRight24`, the ink 1 px inside) at x 1776, 32 px before the item's right edge (x 1808). Added in task 018 |
| `--space-expenses-item-icon-gap` | `16px` | measured: PNG 104 Expenses Breakdown, the tile's right edge (x 1520) to the name and the amount (ink from x 1554, 1 to 2 px of side bearing), 32 px, halved. Added in task 018 |
| `--space-expenses-item-text-gap` | `4px` | measured: PNG 104 Expenses Breakdown, the name's line box (Regular 12/16) from y 1611 to 1643, the tile's top (its cap top at y 1618, 3.6 px under the box at 1x), and the amount's line box (Semibold 16 in a 20 px line) from y 1653 (its digits from y 1661, 4.2 px under the box at 1x): 10 px, halved 5, on the 4px grid 4. The percentage line follows the amount's directly: its glyphs from y 1702, 5.6 px under a 20 px line box (1x) from y 1691, the amount's box ending at y 1693. Added in task 018 |
| `--space-expenses-item-change-gap` | `8px` | measured: PNG 104 Expenses Breakdown, "15%*" ink to x 1608 and the `UpArrow` ink from x 1633, 2.6 px inside its 16 px box (from x 1628): 20 px, halved 10, less the asterisk's side bearing (about 1 px), 9, rounded. Chromium's `%` is wider than Figma's, so the arrow sits about 3 px further right (task 018 References). Added in task 018 |
| `--space-account-card-divider-gap` | `12px` | measured: PNG 105 Credit Card, the header row's bottom (the logo box's, y 416) to the divider's bottom edge (y 440), 24 px, halved; the 1px Gray/06 line is the last pixel of the gap. Added in task 019 |
| `--space-account-card-group-gap` | `16px` | measured: PNG 105 Credit Card, the divider's bottom edge (y 440) to the number's 20/28 line box (y 472), and "Account Number"'s 14/20 line box bottom (y 576) to the balance's line box (y 608), 32 px, halved. Added in task 019 |
| `--space-transactions-tabs-gap` | `24px` | measured: PNG 107, the "Recent Transaction" title's 32 px line box bottom (y 272; its ink y 223 to 256) to the tabs' top (y 320; the label glyphs from y 332, as `--size-tab-height`), 48 px, halved. Balances (105) has 16 there (`--space-section-title-gap-lg`); the Transactions page adds the difference. Added in task 020 |
| `--space-transactions-card-gap` | `16px` | measured: PNG 107, the tabs' bottom (the active underline's bottom, y 384) to the white card (y 416), 32 px, halved. Added in task 020 |
| `--space-transaction-table-inset-x` | `28px` | measured: PNG 107, the card's left edge (x 608) to the rows and their dividers (x 664), and their right end (x 2760) to the card's right edge (x 2816), 56 px, halved: the rows 1048 wide in the 1104 card. Added in task 020 |
| `--space-transaction-cell-padding-x` | `8px` | measured: PNG 107, the rows' left end (x 664) to the Items icon and the "Items" header (x 680), 16 px, halved. Each cell has it on both sides (the Amount cell not on its right, which is the row's end, x 2760), so two columns' texts keep 16 apart at least: not measured, Marko's notes for task 020, as `--space-recent-transaction-amount-gap`. Added in task 020 |
| `--space-transaction-icon-gap` | `16px` | measured: PNG 107, the 24 px Items icon's right edge (x 728) to the item (x 760), 32 px, halved. Added in task 020 |
| `--space-transaction-header-gap` | `16px` | measured: PNG 107, the header row's 24 px line box (y 464 to 512) to the bottom edge of the Gray/06 divider under it (y 542 to 543, edge y 544), 32 px, halved; the divider is the header row's last pixel row. Added in task 020 |
| `--space-transaction-row-padding-y` | `24px` | measured: PNG 107, one row every 144 px from y 544 (the seventh y 1408 to 1551), the texts' 48 px line boxes 48 under each row's top and 48 above its end, the divider the row's last 2 px, none under the last; halved: a row is 72 high. Added in task 020 |
| `--space-transaction-load-more-gap` | `32px` | measured: PNG 107, the last row's end (y 1552) to "Load More" (y 1616), and the button's bottom (y 1712) to the card's 48 px padding (the card ends at y 1824), 64 px each, halved. Added in task 020 |
| `--space-account-card-label-gap` | `4px` | measured: PNG 105 Credit Card, the number's line box bottom (y 528) to "Account Number"'s (y 536), and the balance's (y 664) to "Total amount"'s (y 672), 8 px, halved. Added in task 019 |
| `--space-account-card-bottom-gap` | `24px` | measured: PNG 105 Credit Card, "Total amount"'s line box bottom (y 712) to the bottom row, the "Details" button's top (y 760), 48 px, halved. The least space above the bottom row; in a card stretched by a taller one in its row it grows (decision #107). Added in task 019 |
| `--space-account-card-logo-gap` | `4px` | measured: PNG 105, the Bank Name's ink ("Master Card", "AB Bank Ltd") ends 9 and 10 px before the 48x32 logo box (x 1168 in the first card), halved 4.5 and 5, less the side bearing of the final letter, 4. Added in task 019 |
| `--space-account-card-header-gap` | `16px` | task 019, the wrap rule of decisions #106, #108 b, #111 a and #115 b: not measured, 105 leaves 70 to 90 px between the type and the Bank Name. The least space between them before the Bank Name and its logo move under the type; on the 4px grid, and small enough that every demo header row (at most 211.4 px) stays on one line in a 1280 window with a classic scrollbar (246.3 px of content). Added in task 019 |
| `--space-button-details-padding-x` | `20px` | measured: PNG 105, `Button` "Details" in the first card (x 1044 to 1263): its left edge to the text, and the chevron's 16 px box to its right edge, 40 px, halved. Added in task 019 |
| `--space-button-details-icon-gap` | `8px` | measured: PNG 105, `Button` "Details": the text's end to the chevron's 16 px box, 16 px, halved. Added in task 019 |
| `--space-add-accounts-gap` | `16px` | measured: PNG 105, the Add Accounts button's bottom (y 1240) to the "Edit Accounts" 16/24 line box (y 1272), 32 px, halved. Added in task 019 |
| `--space-account-details-inset` | `32px` | measured: PNG 106, the details card's left edge (x 608) to the labels and "Edit Details" (x 672), and its top (y 304) to the "Bank Name" line box (y 368), 64 px, halved; the right side the same (the content x 672 to 2752). Added in task 021 |
| `--space-account-details-row-gap` | `40px` | measured: PNG 106, the first row's value line box bottom (y 464) to the second row's label line box (y 540; the label cap tops at y 380 and 552, 172 apart), 76 px, halved 38, off the 4 px grid (#65): 40 here and 36 above the buttons (`--space-account-details-buttons-gap`) keep the buttons and the card's height where 106 has them, the second row 2 px low. Added in task 021 |
| `--space-account-details-buttons-gap` | `36px` | measured: PNG 106, the second row's value line box bottom (y 636) to "Edit Details" (y 712), 76 px, halved 38, rounded with `--space-account-details-row-gap` (#65). Added in task 021 |
| `--space-account-details-bottom` | `40px` | measured: PNG 106, "Edit Details"' bottom (y 808) to the details card's bottom (y 888), 80 px, halved. Added in task 021 |
| `--space-account-details-remove-gap` | `40px` | measured: PNG 106, "Edit Details"' right edge (x 992) to "Remove"'s ink (x 1077), 85 px, halved 42.5, less the "R" side bearing (about 1.3 at 14 px), about 41; 40 on the 4 px grid (#65). Added in task 021 |
| `--space-history-inset-x` | `32px` | measured: PNG 106, the history card's left edge (x 608) to the table, its texts and dividers (x 672), and their right end (x 2752) to the card's right edge (x 2816), 64 px, halved: the table 1040 wide in the 1104 card. Added in task 021 |
| `--space-history-header-top` | `28px` | measured: PNG 106, the history card's top (y 1048) to the header row's line box (y 1104), 56 px, halved. Also the space under the last row at the end of the list, where "Load More" is not drawn (not designed, the header's 28 mirrored). Added in task 021 |
| `--space-history-row-padding-y` | `16px` | measured: PNG 106, one row every 112 px from y 1184 (the divider the row's last 2 px at y 1294, 1406, 1518, none under the last), the texts' 48 px line boxes 32 under each row's top and 32 above its end, halved: a row is 56 high. Added in task 021 |
| `--space-history-load-more-bottom` | `40px` | measured: PNG 106, "Load More"'s bottom (y 1792) to the history card's bottom (y 1872), 80 px, halved (107: 56). Added in task 021 |
| `--space-bill-table-header-gap` | `24px` | measured: PNG 108, the header row's 24 px line box (y 352 to 400; its ink y 363 to 394) to the bottom edge of the Gray/06 divider under it (y 446 to 447, edge y 448), 48 px, halved; the divider is the header row's last pixel row. The header's line box is 24 under the card's top (`--space-card-padding`, y 304 to 352). Added in task 023 |
| `--space-bill-row-padding-y` | `32px` | measured: PNG 108, one row every 324 px from y 448 (the second y 772 to 1095), the text block (the title's 48 px line box, 16, three 44 px description lines: 196 px) 64 under each row's top (y 512; the title ink from y 522) and 64 above its end, halved; the divider the row's last 2 px (y 770 to 771), none under the last; every other cell centred on the row (the date box y 528 to 691 and the amount box y 562 to 657 both centre on y 610). Added in task 023 |
| `--space-bill-text-gap` | `8px` | measured: PNG 108, the title's 48 px line box bottom (y 560) to the description's first 44 px line box (y 576), 16 px, halved. Added in task 023 |
| `--space-bill-column-gap` | `16px` | not measured, as task 020's `--space-transaction-cell-padding-x` (#106, #111 a): the least space between two columns' texts. The Due Date and Logo columns keep it at their end and the centred Last Charge on both sides, so every part stays where 108 draws it (the date box, the logo and the Item Description texts from their columns' left edges). Added in task 023 |
| `--space-expenses-card-header-padding-y` | `12px` | chosen, not measured (#106, #111 a): the least inset above and below a card header's content where it grows (the right block under the left, every card at 1280). Under the 15 that centres task 004's 48 tile in the 78 header (`--size-expenses-card-header-height`), which keeps 109's 78 at 1440. Added in task 024 |
| `--space-expenses-card-tile-gap` | `16px` | measured: PNG 109 Expenses Breakdown, the tile's right edge (x 736) to the name's text start (x 768; "Housing" ink from x 770), 32 px, halved. Added in task 024 |
| `--space-expenses-card-text-gap` | `4px` | measured: PNG 109, the name's cap top (y 1018, "Food") and the total's (y 1068, from the "$" ink y 1064 to 1098), 50 px apart, halved 25: with the name in a 20 line and the total in a 24 line (Extrabold 18), 4 between the lines puts the caps 24.3 apart, 4.2 and 5.5 under the line tops (the left block 48, the tile's height). Added in task 024 |
| `--space-expenses-card-change-gap` | `8px` | measured: PNG 109, "15%" (Regular 16, its advance end about x 1216) to the arrow's 16 px box (x 1232, the glyph ink x 1237 to 1259), 16 px, halved; as `--space-expenses-item-change-gap` on Overview. Added in task 024 |
| `--space-expenses-card-blocks-gap` | `8px` | the task 024 file (References, Human checkpoint, Marko, 2026-11-03): the least space between the total and "Compare to last month" while the two blocks are side by side (109 leaves 33.7 or more with the demo totals), and the right block 8 under the left where it moves under it (#106, #111 a). Added in task 024 |
| `--space-expenses-line-item-padding-y` | `16px` | measured: PNG 109, one item every 152 px (the amounts' ink tops y 1177 and 1329), its 88 px column (the amount's 48 line box, 8, the date's 32) centred, so 31 above and 31 below with the 2 px divider in the lower inset, halved 15.5, rounded; the divider takes 1 of the lower inset, so an item with its divider is 76 as drawn. Added in task 024 |
| `--space-expenses-line-item-date-gap` | `4px` | measured: PNG 109, the amount's cap top (y 1180) and the date's (y 1230), 50 px apart, halved 25: the amount's 24 line (cap 6.2 under its top), 4, the date's 16 line (cap 3.6 under its top) puts them 24.4 apart. Added in task 024 |
| `--space-expenses-line-item-gap` | `16px` | not measured, as `--space-recent-transaction-amount-gap` (#106, #111 a): the least space between an item's name and its amount and date; 109 leaves 148 or more. Added in task 024 |
| `--space-expenses-card-body-bottom` | `8px` | measured: PNG 109, the second item's end (y 1440, 76 after the first item's 76 from y 1136) to the card's end (y 1456), 16 px, halved; with two items the body is 160 as drawn (76 + 76 + 8). Added in task 024 |
| `--space-savings-goal-padding-top` | `20px` | measured: PNG 110, the Savings Goal card's top (y 304) to its header row (the period box from y 344), 40 px, halved. Its sides and its bottom are `--space-card-padding`: the title ink from x 657 with the card from x 608 (1 px of side bearing), and the Adjust Goal box's end (y 839) to the card's end (y 887). Added in task 025 |
| `--space-savings-goal-divider-gap` | `12px` | measured: PNG 110, the period box's bottom (y 407) to the Gray/06 divider (y 430 to 431), 22 px, halved 11, rounded 12, as Overview's (`--space-goals-divider-gap`). Added in task 025 |
| `--space-savings-goal-body-gap` | `20px` | measured: PNG 110, the divider's bottom (y 432) to the gauge arc's top (y 472), 40 px, halved, as Overview's (`--space-goals-body-gap`). Added in task 025 |
| `--space-savings-goal-button-gap` | `24px` | measured: PNG 110, the gauge caption (Medium 12/16, ink y 694 to 716, its line box to about y 720) to the Adjust Goal box (y 768), about 48 px, halved. The least space above the button when the body grows (#108 b); at the card's 292 minimum the button sits on the bottom inset. Added in task 025 |
| `--space-goals-category-row-gap` | `16px` | measured: PNG 110, the Expenses Goals by Category cards y 1048 to 1255 and 1288 to 1495, 32 px between the rows, halved. Added in task 025 |
| `--space-saving-summary-title-gap` | `32px` | measured: PNG 110, the "Saving Summary" title (ink to x 1702) to the period text "Mar 2022" (ink from x 1772), 70 px, halved 35; less the title's and the text's side bearings in Chromium with Inter, about 34, on the 4px grid 32. The space between the title and the `plain` selector. Added in task 026 |
| `--space-adjust-button-padding-x` | `20px` | measured: PNG 110 "Adjust Goal", the box's outer left edge (x 834, its 2 px Primary border to 835) to the text ink (x 875, about 1 px of side bearing), 40 px, and the pencil's 32 px box (ink x 1049 to 1074, centred) to the outer right edge (x 1117), 40 px; halved, the border included. Added in task 025 |
| `--space-adjust-button-icon-gap` | `8px` | measured: PNG 110 "Adjust Goal", the text's end ("Goal" ink to x 1025, its advance about 2 px after) to the pencil's 32 px box (from about x 1045), about 18 px, halved 9, rounded 8. Added in task 025 |
| `--space-adjust-button-padding-x-compact` | `16px` | measured: PNG 110, a category card's "Adjust" (Housing's box x 1066 to 1264 at 2x): the box's outer left edge to the text ink (x 1099), 33 px, and the pencil's ink end (x 1230) to the outer right edge, 34 px; halved 16.5 and 17, less about 1 px of side bearing and the pencil's 16 px box, 16, the border included. The "Adjust" box 99 wide in the PNG (98 as built: the label in Chromium's Inter 14 about 1.5 px narrower) where `--space-adjust-button-padding-x` would make it about 107. Added in task 027 |
| `--space-goal-item-tile-gap` | `16px` | measured: PNG 110, a category card's tile (x 656 to 736 at 2x, Housing) to the name's ink (from x 770, about 2 px of side bearing), 34 px, halved 17, less the bearing, 16. Added in task 027 |
| `--space-goal-item-text-gap` | `4px` | measured: PNG 110, the name's line box (Regular 16/24, y 1098 to 1146 at 2x, Housing) to the amount's (Exbold 18/24, y 1154 to 1202), 8 px, halved: the two lines 52 high, centred on the 104 card. Added in task 027 |
| `--space-goal-item-wrap-gap` | `16px` | decision #108 b: not measured, 110 leaves 74 px or more at 2x (Transportation's text to its "Adjust"), the value of `--space-goals-wrap-gap`. The least space between a category card's text and "Adjust"; where they do not fit with it, "Adjust" moves under the text, right-aligned, this far below. Added in task 027 |
| `--space-settings-padding-top` | `40px` | measured: PNG 111, the Settings card's top (y 208) to the tabs' 48 px line box (y 288; "Account" ink from y 299), 80 px, halved. Added in task 028 |
| `--space-settings-padding-x` | `32px` | measured: PNG 111, the card's left edge (x 608) to the "Account" underline, the labels and "Update Profile" (x 672), 64 px, halved; the same at the right end (the content 1040 wide in the 1104 card). Added in task 028 |
| `--space-settings-padding-bottom` | `48px` | measured: PNG 111, "Update Profile"'s bottom (y 1408) to the card's end (y 1504), 96 px, halved. Added in task 028 |
| `--space-settings-tab-padding-x` | `12px` | measured: PNG 111, the "Account" underline x 672 to 847 and its ink x 695 to 824: 23 px each side, less about 1 px of side bearing, halved 11, on the 4 px grid 12 (104's tabs: 8). Added in task 028 |
| `--space-settings-tab-gap` | `32px` | measured: PNG 111, the "Account" tab's end (x 848) to "Security"'s ink (x 936) less its 24 px padding and 1 px of bearing, 63 px, halved 31.5, rounded (104's tabs: 20). Added in task 028 |
| `--space-settings-tabs-gap` | `32px` | measured: PNG 111, the underline's bottom (y 368) to the "Full name" label's 48 px line box (y 432; its ink from y 444), 64 px, halved. Added in task 028 |
| `--space-settings-field-gap` | `16px` | measured: PNG 111, the labels' line boxes every 208 px (y 432, 640, 848, 1056), a field 176 (the label's 48, 16, the 112 value box), 32 between, halved: `SettingsInput` 88 high, 104 apart. Added in task 028 |
| `--space-settings-input-padding-x` | `24px` | measured: PNG 111, the labels (x 672) to their values' ink (x 721, about 1 px of side bearing), 48 px, halved, as `--space-popup-input-padding-x` in 104.1. Added in task 028 |
| `--space-settings-button-gap` | `40px` | measured: PNG 111, the Phone Number value box's end (y 1232: its 48 px line box y 1152 to 1200 centred in the 112 box from y 1120) to "Update Profile" (y 1312), 80 px, halved. Added in task 028 |
| `--space-phone-separator-gap` | `4px` | measured: PNG 111, "+880" (ink to x 800, its advance about x 801) to the separator's 24 px box (its 4 px line x 823 to 826 in the middle: x 812 to 836), 11 px, and the box's end to "51547" (ink from x 850, about 1 px of bearing), 13 px; halved 5.5 and 6.5, on the 4 px grid 4 (the nearer of 4 and 8 to their 6; the number about 3 px left of 111). Added in task 028 |
| `--space-profile-photo-gap` | `32px` | measured: PNG 111, "Your Profile Picture"'s 48 px line box end (y 480; its ink y 443 to 468) to the upload box (y 544), 64 px, halved. Added in task 028 |
| `--space-profile-photo-icon-gap` | `12px` | measured: PNG 111, the upload icon's ink end (y 663, its 80 px box to about y 668) to the "Upload your" 32 px line box (its ink from y 700, about 7 px under the line top), about 25 px, halved 12.5, rounded. Added in task 028 |

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
| `--size-sidebar-logo-width` | `164px` | measured: PNG 104 and 105, sidebar logo glyphs x 117 to 443, 327 px, halved 163.5, rounded. The height follows the SVG viewBox (163x18). Added in task 003 |
| `--size-sidebar-brand-height` | `72px` | measured: PNG 104 and 105, frame top (y 0) to the sidebar logo glyph bottom (y 144), 144 px, halved. The logo sits at the bottom of this block. Added in task 003 |
| `--size-profile-height` | `104px` | Figma `Profile` 224x104 (`components.md`). Checked: PNG 104 and 105, divider (y 1744) to the avatar center (y 1848), 104 px, half the block at 2x; export `docs/figma/components/66-1754.png` shows the divider at the top of the component. Added in task 003 |
| `--size-profile-menu-icon-width` | `4px` | measured: PNG 104 and 105 and export `66-1754.png`, three-dot glyph x 496 to 503 (640 to 647 in the export), 8 px, halved. Its right edge is the block right edge. Added in task 003 |
| `--size-amount-box-width` | `68px` | measured: PNG 104, Upcoming Bill amount box x 2632 to 2767, 136 px, halved. The minimum: a longer amount widens the box. Added in task 004 |
| `--size-amount-box-width-lg` | `108px` | measured: PNG 108, Bills amount box x 2532 to 2747, 216 px, halved. The minimum: a longer amount widens the box. Added in task 004 |
| `--size-amount-box-height-lg` | `48px` | measured: PNG 108, Bills amount box y 562 to 657, 96 px, halved. Added in task 004 |
| `--size-date-box-width-lg` | `72px` | measured: PNG 108, Bills date box x 656 to 799, 144 px, halved. Added in task 004 |
| `--size-date-box-height-lg` | `80px` | measured: PNG 108, Bills date box y 528 to 691, 164 px, halved 82, rounded down like --size-date-box-height (82 is between 80 and 84). Added in task 004 |
| `--size-category-tile` | `40px` | measured: PNG 104, Recent Transaction tiles x 656 to 735 and y 1080 to 1159, 80 px square, halved. Every tile in 104, 109 and 110 is 80 px wide. Added in task 004 |
| `--size-category-tile-tall` | `56px` | measured: PNG 104, Expenses Breakdown tiles y 1612 to 1723, 112 px, halved. Added in task 004 |
| `--size-category-tile-medium` | `48px` | measured: PNG 110, Goals tiles y 1104 to 1199, 96 px, halved. PNG 109, card header tiles y 1012 to 1103, 92 px, halved 46, rounded up to share this size (46 is between 44 and 48). Added in task 004 |
| `--size-tab-height` | `32px` | measured: PNG 104, label line box top (y 944, the card content top; glyphs from y 956) to the bottom of the active underline (y 1007), 64 px, halved. PNG 107 the same (y 320 to 383). Added in task 004 |
| `--size-button-small-width` | `84px` | Figma Button small 84x32 (components.md). Checked: export docs/figma/components/418-6433.png, x 2328 to 2495, 168 px, halved. The minimum: a longer label widens the button. Added in task 004 |
| `--size-button-small-height` | `32px` | Figma Button small 84x32 (components.md). Checked: export docs/figma/components/418-6433.png, y 724 to 787, 64 px, halved. Added in task 004 |
| `--size-popup-button-width` | `192px` | measured: PNG 104.1, Save x 1504 to 1887, 384 px, halved; centered in the panel (x 1208 to 2183). PNG 110.1 and 110.2 the same. Added in task 005 |
| `--size-dropdown-box-height` | `32px` | measured: PNG 110, Savings Goal period box y 344 to 407, 64 px, halved. Added in task 005 |
| `--size-chart-height` | `188px` | measured: PNG 104 Statistics and PNG 109 Monthly Comparison, the plot from the top grid line (y 1022) down to the descent of the x-axis labels (y 1369: baseline y 1362, glyphs from y 1342), placed under the card padding and a 24 px header row. That header row is assumed, not measured: 104 and 109 center the header at y 952, 16 px higher, partly inside the card padding (decision #93: kept, the header row 8 lower than in Figma). From the assumed row's end (y 992: card top 896 plus 48 and 48) to the descent, 377 px, halved 188.5, rounded; the top grid line falls 15 below its top. One height for the chart, its skeleton and its DataState box; the chart draws inside it from named constants (#92). Added in task 006 |
| `--size-chart-legend-swatch-width` | `16px` | measured: PNG 104, legend swatches x 2388 to 2419 and 2602 to 2633, 32 px, halved. PNG 109 the same (x 2376 to 2407). Added in task 006 |
| `--size-chart-legend-swatch-height` | `8px` | measured: PNG 104 and 109, legend swatches y 944 to 959 (352 to 367 in 109), 16 px, halved. Added in task 006 |
| `--size-gauge-width` | `128px` | measured: PNG 104 and 110, the gauge arc's outer edge fitted as a circle of radius 128.1 px (ink x 1744 to 1999), diameter 256.2 px, halved 128.1, rounded. The SVG's viewBox width; the arc is drawn inside it from named constants (#92). Added in task 006 |
| `--size-gauge-height` | `92px` | measured: PNG 104 and 110, the gauge arc top (y 456) to the center value's baseline (y 632) plus the descent of its 16 px text (8 px at 2x), 184 px, halved. The SVG's viewBox height, holding the arc, the needle and the three labels (#92). Added in task 006 |
| `--size-page-min-width` | `1280px` | decision #94: the narrowest page, app or auth; below it the page scrolls horizontally. `min-width` on `body`. Added in task 011 |
| `--size-scrollbar-gutter` | `15px` | decision #101: the width of a classic scrollbar, which `scrollbar-gutter: stable` keeps free on every app page (#100). Measured in task 011 in Chromium on Windows, headed and headless: the page is 1425 wide in a 1440 window. A constant, since no CSS length gives the window width with its scrollbar (headed Chromium leaves the gutter out of `100vw`). Subtracted from `--size-page-min-width` on `body`, so a window 1280 wide never scrolls sideways. Added in task 011 |
| `--size-overview-card-height` | `232px` | measured: PNG 104, Total Balance, Goals and Upcoming Bill cards y 288 to 751, 464 px, halved. The least height of the top row cards in every state (decision #105 a); the row grows with its tallest card (#106). Added in task 013 |
| `--size-statistics-card-height` | `260px` | decision #93: PNG 104 Statistics card y 896 to 1411, 516 px, halved 258, built 260 (the 188 px chart under a 24 px header row inside the 24 px card padding). The least height in every state (#105 a). Added in task 013 |
| `--size-expenses-breakdown-card-height` | `212px` | measured: PNG 104, Expenses Breakdown card y 1556 to 1979, 424 px, halved. The least height in every state (decision #105 a). Added in task 013 |
| `--size-expenses-item-height` | `74px` | Figma `Expences Item` 42:777, 200x74 (`components.md`), kept off the 4px grid: the grid as 104 draws it (200x74 items, 40 and 24 apart, 20 + 74 + 24 + 74 + 20 = 212) was accepted with the task 018 file (Marko, 2026-10-29). Checked: PNG 104 Expenses Breakdown, the card's content from y 1596 (y 1556 plus the 40 px inset) to y 1939 (y 1979 less 40) holds two rows and the 48 px row gap: (343 - 48) / 2 = 147.5 px, halved 74. The least height of an item; it grows where its right arrow moves under the text (#115 b). Added in task 018 |
| `--size-account-slide-height` | `96px` | measured: PNG 104, teal account card in Total Balance y 440 to 631, 192 px, halved. Its height wherever its bottom line fits on one line (decision #106). Added in task 013 |
| `--size-card-network-logo-width` | `48px` | Figma `Mastercard` 408:5979 and `Visacard` 410:5467, both exported 48x32 (`frontend/src/assets/brand/`). Checked: PNG 104 Mastercard ink x 1146 to 1223 and y 476 to 523, the 43x24 image area of the 48x32 box at 2x. Added in task 013 |
| `--size-card-network-logo-height` | `32px` | Figma `Mastercard` 408:5979 and `Visacard` 410:5467, both exported 48x32. Added in task 013 |
| `--size-round-arrow` | `24px` | Figma `Frame 40276` 24x24 (`components.md`, possible detached components). Checked: PNG 104, the white disc x 1184 to 1231 and y 552 to 599, 48 px, halved. Added in task 013 |
| `--size-slider-dot` | `8px` | measured: PNG 104, Previous / Next dots x 920 to 935 and y 684 to 699, 16 px, halved. Added in task 013 |
| `--size-goals-edit-button` | `32px` | measured: PNG 104 Goals, the pencil box (Figma `Frame 40640`) x 1620 to 1683, y 328 to 391, 64 px, halved; Gray/06 with a 4 px radius (`--radius-button`) around the 16 px `edit` icon. Added in task 014 |
| `--size-upcoming-bill-logo-height` | `16px` | measured: PNG 104 Upcoming Bill, the Figma wordmark y 356 to 387 (45 wide) and the Adobe logo y 568 to 599 (60 wide), 32 px, halved. Added in task 015 |
| `--size-account-card-height` | `288px` | measured: PNG 105, the account cards y 304 to 879 and 944 to 1519, 576 px, halved (24 + 32 + 12 + 16 + 28 + 4 + 20 + 16 + 28 + 4 + 20 + 24 + 36 + 24). The least height of a Balances card, the Add Accounts cell, the skeleton cards and the error and empty card; a row grows with its tallest card (decision #106). Added in task 019 |
| `--size-button-details-height` | `36px` | Figma `Button` 43:1161, 110x36 (`components.md`). Checked: PNG 105, "Details" in the first card y 760 to 831, 72 px, halved. Added in task 019 |
| `--size-add-accounts-button-width` | `208px` | Figma `Button Big` 410:5537, 208x48 (`components.md`). Checked: PNG 105, the Add Accounts button x 2256 to 2671, 416 px, halved; its height is `--size-button-height`. Added in task 019 |
| `--size-transaction-load-more-width` | `192px` | measured: PNG 107, "Load More" (the `Button/primary` look) x 1520 to 1903, 384 px, halved; its height is `--size-button-height`. Added in task 020 |
| `--size-transactions-card-min-height` | `704px` | measured: PNG 107, the white card y 416 to 1823 with its 7 rows, 1408 px, halved. The least height of the Transactions card in every state (the skeleton, the error and the empty message, a short list). Added in task 020 |
| `--size-transaction-column-items` | `23.855%` | measured: PNG 107, the centres of the Shop Name, Date and Payment Method texts at 33.0%, 54.5% and 77.1% of the 1048 px row, Amount right-aligned at its end: columns of 250, 192, 258, 216 and 132 px put them there, and 250 is the Items width that keeps every row of each tab's first page on one line from a 1280 window (task 020 References). Items 250 of 1048. Added in task 020 |
| `--size-transaction-column-shop` | `18.3206%` | measured: PNG 107, as `--size-transaction-column-items`: Shop Name 192 of 1048. Added in task 020 |
| `--size-transaction-column-date` | `24.6183%` | measured: PNG 107, as `--size-transaction-column-items`: Date 258 of 1048. Added in task 020 |
| `--size-transaction-column-method` | `20.6107%` | measured: PNG 107, as `--size-transaction-column-items`: Payment Method 216 of 1048. Added in task 020 |
| `--size-transaction-column-amount` | `12.5954%` | measured: PNG 107, as `--size-transaction-column-items`: Amount 132 of 1048. Added in task 020 |
| `--size-account-details-column` | `30.4808%` | measured: PNG 106, the label and value texts of the three columns at x 672, 1306 and 1940, 634 px apart, halved 317: 30.48% of the 1040 px content each, the last 8.56% empty (task 021 References). Added in task 021 |
| `--size-account-details-card-min-height` | `292px` | measured: PNG 106, the details card y 304 to 887, 584 px, halved (32 + 48 + 40 + 48 + 36 + 48 + 40). The least height of the details card in every state (the skeleton, the error message). Added in task 021 |
| `--size-edit-details-width` | `160px` | measured: PNG 106, "Edit Details" (the `Button/primary` look) x 672 to 991, 320 px, halved; its height is `--size-button-height`. Added in task 021 |
| `--size-history-card-min-height` | `412px` | measured: PNG 106, the history card y 1048 to 1871 with its 4 rows, 824 px, halved. The least height of the history card in every state (the error and the empty message, a short list). Added in task 021 |
| `--size-history-column-date` | `23.2692%` | measured: PNG 106, the centres of the Status, Transaction Type and Receipt texts at 32.5%, 54.1% and 76.9% of the 1040 px table, the Date at its start and the Amount right-aligned at its end: columns of 242, 192, 258, 216 and 132 px put them there, 107's widths with the first 8 narrower (task 021 References). Date 242 of 1040. Added in task 021 |
| `--size-history-column-status` | `18.4615%` | measured: PNG 106, as `--size-history-column-date`: Status 192 of 1040. Added in task 021 |
| `--size-history-column-type` | `24.8077%` | measured: PNG 106, as `--size-history-column-date`: Transaction Type 258 of 1040. Added in task 021 |
| `--size-history-column-receipt` | `20.7692%` | measured: PNG 106, as `--size-history-column-date`: Receipt 216 of 1040. Added in task 021 |
| `--size-history-column-amount` | `12.6923%` | measured: PNG 106, as `--size-history-column-date`: Amount 132 of 1040. Added in task 021 |
| `--size-bill-card-min-height` | `420px` | measured: PNG 108, the white card y 304 to 1143 with its 2 rows, 840 px, halved (24 + 48 + 2 x 162 + 24). The least height of the Bills card in every state (the skeleton, the error and the empty message, one bill). Added in task 023 |
| `--size-bill-column-due-date` | `112fr` | measured: PNG 108, from the row's left end (x 656): the Logo column's logo and header ink from 224 px (x 880 and 882), the Item Description texts from 594 px (x 1250), the Last Charge texts centred on 1512 px (x 2068 to 2266 and 2075 to 2261), the amount box from 1876 px to the row's end at 2092 px (x 2532 to 2747): halved, contiguous columns of 112, 185, 277 and 364, then the Amount column, as wide as its widest box (108 here). The four columns share what the Amount column leaves in these proportions, so the parts keep their places at any width (#94; task 023 References). Added in task 023 |
| `--size-bill-column-logo` | `185fr` | measured: PNG 108, as `--size-bill-column-due-date`: Logo 185 of the 938 left of the Amount column. Added in task 023 |
| `--size-bill-column-description` | `277fr` | measured: PNG 108, as `--size-bill-column-due-date`: Item Description 277 of 938. Added in task 023 |
| `--size-bill-column-last-charge` | `364fr` | measured: PNG 108, as `--size-bill-column-due-date`: Last Charge 364 of 938. Added in task 023 |
| `--size-bill-logo-width` | `120px` | Figma `Figma` 411:5839 (120x40) and `Adobe` 411:6038 (120x31), exported as `Figma.svg` (120x40) and `Adobe.svg` (120x32) in `frontend/src/assets/brand/`; the logos show at their own size. The width of the logo's place in the Bills skeleton. Added in task 023 |
| `--size-bill-logo-height` | `40px` | Figma `Figma` 411:5839, 120x40, the taller logo. The height of the logo's place in the Bills skeleton. Added in task 023 |
| `--size-test-scroll-fixture-height` | `3000px` | test fixture only, task 023: the height task 011's `injectTallContent` added (e2e `app-shell-slice.spec.ts` T26 and T27), now the block of the e2e-only `ScrollFixture` pages; no screen uses it. Added in task 023 |
| `--size-expenses-card-min-height` | `238px` | PNG 109 Expenses Breakdown as drawn, kept off the 4px grid as the task 024 file sets (Marko, 2026-11-03): each category card y 980 to 1455 (row 1) and 1504 to 1979 (row 2), 476 px, halved, as Figma's `Expenses Breakdown` 50:3852 (352x238). The least height of a card in every state (no item, one item, the skeleton) and of the cards' error card; the page ends at 1024 with the 260 chart card (#93) and the 32 inset (#111). Added in task 024 |
| `--size-expenses-card-header-height` | `78px` | PNG 109 as drawn, kept off the 4px grid as the task 024 file sets (Marko, 2026-11-03): the Gray/05 header y 980 to 1135, 156 px, halved; row 2's 76 with a 2 px strip under it is a Figma artifact, built as row 1. The least height: the header grows where the right block moves under the left (#106). Task 004's 48 tile (`--size-category-tile-medium`) sits centred in it, 15 above and below (109's 46 tile has 16); an 80 header would make the page scroll by 4. Added in task 024 |
| `--size-goals-column-savings-goal` | `368fr` | measured: PNG 110, the Savings Goal card x 608 to 1343, 736 px, halved: 368 of the top row's 1080 with the Saving Summary's 712 (the 24 between them `--space-card-gap`), so the columns keep 368 : 712 at any width (#94). Added in task 025 |
| `--size-goals-column-saving-summary` | `712fr` | measured: PNG 110, the Saving Summary card x 1392 to 2815, 1424 px, halved, as `--size-goals-column-savings-goal`. Added in task 025 |
| `--size-savings-goal-card-min-height` | `292px` | measured: PNG 110, the Savings Goal and Saving Summary cards y 304 to 887, 584 px, halved. The least height of the top row in every state (#105 a pattern); the row grows with its taller card (#108 b). Added in task 025 |
| `--size-goals-category-card-min-height` | `104px` | measured: PNG 110, each Expenses Goals by Category card y 1048 to 1255 (row 2: 1288 to 1495), 208 px, halved. Added in task 025 |
| `--size-adjust-button-height` | `36px` | measured: PNG 110 "Adjust Goal" box y 768 to 839, 72 px, halved. Added in task 025 |
| `--size-adjust-button-skeleton-width` | `140px` | task 025, not designed (the Savings Goal skeleton): about the Adjust Goal box, x 834 to 1117 in PNG 110, 284 px, halved 142, on the 4px grid. Added in task 025 |
| `--size-goal-item-list-min-height` | `224px` | PNG 110 as drawn: the Expenses Goals by Category grid y 1048 to 1495 at 2x, 448 px, halved, the two 104 rows (`--size-goals-category-card-min-height`) and the 16 between them. The least height of the section's content in every state: the error card across the grid keeps it (#105 a, #116). Added in task 027 |
| `--size-saving-summary-chart-height` | `216px` | measured: PNG 110, the Saving Summary chart from the header row's end (y 408: the card top 304, 40 and 64) to the x labels' descent (the card's 24 bottom inset above its end at y 887; the labels' ink y 809 to 835), 432 px, halved. One height for the chart, its skeleton, its empty message and its error state; the chart draws inside it from named constants (#92, #113 a). Added in task 026 |
| `--size-saving-summary-axis-width` | `72px` | measured: PNG 110, the card content's left edge (x 1440) to the teal line's start (x 1583, its round end from about x 1584), 144 px, halved: the y labels' column, the plot from its end. Added in task 026 |
| `--size-saving-summary-point` | `8px` | not designed (task 026): a lone point of the Saving Summary's line (the 1st, the only day so far, 1 Nov in Belgrade at midnight) drawn as a dot this wide, the stroke of a zero-length path with a round cap; the line's own 2 px cap was a barely visible speck at 1440. dataviz's end dot, 8 px at least. Added in task 026 |
| `--size-settings-tab-height` | `40px` | measured: PNG 111, the tabs' 48 px line box top (y 288) to the underline's end (y 368), 80 px, halved: the 24 line, 14, the 2 px underline (104's tabs: 32). Added in task 028 |
| `--size-settings-input-height` | `56px` | measured: PNG 111, `SettingsInput` (Figma 540x88): the label's 48 px line box, 16, then the value's 48 px line box centred in a 112 px box (y 496 to 608 for Full name), halved: 24, 8, 56, as `--size-popup-input-height`, with no border (#33). Added in task 028 |
| `--size-settings-column-fields` | `540fr` | Figma `SettingsInput` (`54:2202`), 540 wide (`docs/figma/components.md`); PNG 111, the content from x 672 to 2752 (1040 at 1x), the fields' column 540 of it. A share of the content's width, so the fields grow with the card (#94). Added in task 028 |
| `--size-settings-column-gap` | `144fr` | measured: PNG 111, the fields' end (x 672 + 1080 = 1752) to "Your Profile Picture" (ink from x 2041, about 1 px of bearing: x 2040), 288 px, halved. Added in task 028 |
| `--size-settings-column-picture` | `356fr` | measured: PNG 111, "Your Profile Picture" (x 2040) to the content's end (x 2752), 712 px, halved: the picture column from 65.8% of the content's width (#94). Added in task 028 |
| `--size-icon-separator-width` | `12px` | Figma `Icon/separator` (402:5296), 12x24 (`docs/figma/components.md`); its height is `--size-icon`. PNG 111, its 4 px line x 823 to 826 between the country code and the number. Added in task 028 |
| `--size-update-profile-width` | `192px` | measured: PNG 111, "Update Profile" x 672 to 1055, 384 px, halved. Added in task 028 |
| `--size-profile-photo-box-width` | `144px` | measured: PNG 111, the dashed upload box x 2047 to 2330 (its 2 px borders included), 284 px, halved 142, rounded 144; centred under "Your Profile Picture" (its ink x 2041 to 2335, the same centre). Added in task 028 |
| `--size-profile-photo-box-height` | `132px` | measured: PNG 111, the upload box y 544 to 805, 262 px, halved 131, rounded. Added in task 028 |
| `--size-profile-photo-icon` | `40px` | measured: PNG 111, the upload icon's ink x 2153 to 2224 and y 592 to 663, 72 px, halved 36; Lucide's `image-plus` draws 21 of its 24 px box (the stroke included), so its box is 41, rounded 40. Added in task 028 |

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
| `--radius-avatar` | `50%` | measured: PNG 104 and 105, the sidebar profile photo is a circle. Added in task 003 |
| `--radius-category-tile` | `8px` | measured: PNG 104, Recent Transaction and Expenses Breakdown tiles, corner radius 16 px; PNG 109 and 110 tiles fit about 18 px; halved and rounded. The date and amount boxes in 108 have the same radii as in 104 (--radius-date-box, --radius-amount-box). Added in task 004 |
| `--radius-dropdown` | `4px` | measured: PNG 110, Savings Goal period box corners: the straight border starts 7 px from the corner on both sides, radius about 7 to 8 px, halved and rounded. Added in task 005 |
| `--radius-chart-legend-swatch` | `2px` | measured: PNG 104 and 109, legend swatch corners: the straight top edge starts 4 px in (x 2392 in 2388 to 2419), radius 4 px, halved. Kept under 4px, off the grid (#92 b). Added in task 006 |
| `--radius-circle` | `50%` | measured: PNG 104, the round arrow's white disc (x 1184 to 1231, y 552 to 599) and the Previous / Next dots are circles. Added in task 013 |
| `--radius-settings-card` | `16px` | measured: PNG 111, the Settings card's top-left corner: the first white pixel of each row from the card's top (y 208) at x 634, 628, 624, 621, 618, 616, 615, 613, 612, 611, 610, 609 and 609 every 2 rows to y 232, with the straight left edge at x 608 below: a circle of radius 32 fits each row within a pixel (26 in at the top row, the anti-aliased edge, 13 six rows down, 7 twelve down, 1 twenty-four down), halved 16. Rounder than every other card (`--radius-card`, 8 on 104): the Settings card only (Marko at the task 028 gate). Added in task 028 |
| `--radius-profile-photo-box` | `4px` | measured: PNG 111, the upload box's top-left corner: the dashed border bends from x 2058 on its top edge (y 544) to y 553 on its left edge (x 2047), radius about 10 px, halved 5, rounded 4. Added in task 028 |

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
| `--border-width-saving-summary-line` | `2px` | measured: PNG 110, the Saving Summary teal line, 4 px of full cover across a flat stretch (x 2300 and 2500 as the line slopes, about 4.9 and 7.3), halved. Added in task 026 |
| `--border-width-saving-summary-dashed-line` | `2px` | measured: PNG 110, the dashed Gray/05 line, its cover summed down a dash (x 2028 to 2062, y 582 to 594), 4.0 px, halved. Added in task 026 |
| `--border-width-profile-photo-box` | `1px` | measured: PNG 111, the upload box's dashed Gray/03 border, x 2047 to 2048 on its left edge, 2 px, halved. CSS draws its dashes (about 13 px with 7 px gaps at 2x in 111) in the browser's own pattern. Added in task 028 |

## Shadow

Fitted as a Gaussian blur (CSS blur = 2 sigma) with x-offset 0 and spread 0, from the darkening profile below the element and beside it at mid-height, against the page background. Offset and blur are halved and rounded to 4px. Only the darkening per channel is visible, not the color and alpha separately, so the colors are estimates.

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--shadow-card` | `0 20px 24px rgb(76 103 100 / 10%)` | measured: PNG 105 (Credit Card and Add Accounts cards) and PNG 104 (Upcoming Bill), fit offset-y 20, blur 24, fit error 0.3 of 255. Darkening at full cover (17, 14, 14) per channel, matched within 1 by this color |
| `--shadow-search` | `0 28px 16px rgb(124 45 87 / 5%)` | measured: PNG 104 header search, fit offset-y 28.5 (rounded to 28), blur 16, fit error 0.6 of 255. Darkening at full cover (6, 10, 8): the tint is known, the alpha of 5% is assumed |
| `--shadow-popup` | `none` | measured: PNG 104.1, the dimmed content around the popup is a uniform `#DDDDDD` on all sides, no shadow |

## Opacity

| CSS variable | Value | Source |
|--------------|-------|--------|
| `--opacity-expenses-arrow` | `50%` | measured: PNG 104 Expenses Breakdown, the right arrows are `#CFCFCF`, Gray/03 `#9F9F9F` at 50% on white exactly ((159 + 255) / 2 = 207); Housing's, drawn hovered, is `#94CEC8`, Primary `#299D91` at 50% on white exactly. The whole icon at 50%, so its two strokes do not darken where they meet. Added in task 018 |
| `--opacity-saving-summary-fill-top` | `35%` | measured: PNG 110, the Saving Summary fill under the line: the same color at the same y in every column (a vertical gradient over the area), `#B8DDD9` at y 533 just under the highest stretch of the line (y 523), Primary `#299D91` over white at 34%, about 35% at the area's top. Added in task 026 |
| `--opacity-saving-summary-fill-middle` | `14%` | measured: PNG 110, the same fill halfway from the area's top (y 523) to the plot's end (y 768, white from there): `#E6F1F0` at y 650, Primary over white at 13 to 14%; the fade is not linear (21% a third of the way, 7% at three quarters), so this middle stop keeps it to about 1% of 110. Added in task 026 |

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
