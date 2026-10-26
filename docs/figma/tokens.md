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
| `--space-chart-legend-swatch-gap` | `8px` | measured: PNG 104, legend swatch right edge (x 2420) to the "This week" glyphs (x 2437), 17 px including the side bearing of the "T", halved 8.5, rounded; PNG 109 the same (x 2408 to 2425). Added in task 006 |
| `--space-chart-legend-item-gap` | `24px` | measured: PNG 104, end of the "This week" text (glyphs to x 2551) to the "Last week" swatch (x 2602), 50 px including the side bearing of the "k", halved 25, rounded. Added in task 006 |
| `--space-gauge-caption-gap` | `16px` | measured: PNG 104, bottom of the gauge drawing (y 640, see --size-gauge-height) to the "Target vs Achievement" line box (y 671: glyphs from y 678 in a 12/16 line), 31 px, halved 15.5, rounded. PNG 110 the same. Added in task 006 |

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
