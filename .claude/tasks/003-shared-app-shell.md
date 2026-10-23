# Task 003: Shared components: app shell (sidebar, header, layout)

- Status: done
- Gate: human
- Depends on: 001, 002
- Size: M
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `frontend-design:frontend-design` (undesigned states only: initials avatar, focus styles, and the nav Hover variant if no visual reference exists)

## Goal
The sidebar, header and page layout shared by every app screen (104 to 112) exist as presentational components that take data as props, and the dev gallery shows them. Wiring them to the signed-in user and the routes is task 011.

## References
- Spec: `docs/spec/stories.md` US-04 (criteria 1 to 3, 6, 7, 10, 11, 13 and 14 as visuals and props; navigation, logout and redirects are task 011); `docs/spec/brief.md` Layout (app screens)
- Figma: Nav bar `411:6442` (instance `411:6510` in 104, `413:7727` in 105), Menu set `2:112` (Type x Status Active/Inactive/Hover), Logout `13:612`, Profile `403:5389`, Header `411:6067` (instance `411:6089` in 104, `411:6111` in 105), Search `404:5262`. PNGs: `docs/figma/104. Overview.png` (greeting, Overview active), `docs/figma/105. Balances.png` (no greeting, Balances active)
- Names: `docs/figma/components.md` (`NavBar`, `NavMenu`, `Logout`, `LogoutIcon`, `Profile`, `Header`, `HeaderSearch`, `SearchIcon`, `NotificationIcon`, `Menu*` icons)
- Decisions: `docs/decisions.md` #5, #7, #8, #9, #10, #11, #38, #47, #54, #62, #66, #70, **#83 (open: this task waits for it)**

## Scope
- Route path constants in `frontend/src/routes/paths.ts`: login, sign up, forgot password, overview, balances, account details (with the account id), transactions, bills, expenses, goals, settings Account tab and settings Security tab. Later tasks use only these.
- Components, tokens only:
  - `NavBar`: the dark sidebar, 280px wide and full viewport height. From top to bottom:
    - `Logo` in white (CSS `color`, #66, #70).
    - Seven `NavMenu` items in order: Overview, Balances, Transactions, Bills, Expenses, Goals, Settings.
    - `Logout` with `LogoutIcon`, a divider, then `Profile`.
  - `NavMenu`: one item per section, with its icon and label, as a link to its section path.
    - Status Active (teal background, white text) for the section given by the `activeSection` prop; Inactive for the rest; Hover on an inactive item under the pointer. Hovering the active item keeps it Active.
    - Choose each item's icon by rendering the candidates (`MenuOverview`, `Wallet`, `Transaction`, `MenuTransaction`, `Bill`, `Expenses`, `Goal`, `Target`, `MenuSettings`, ...) and matching them to the PNG. Record the mapping in the Log.
  - `Logout`: a button that calls `onLogout`.
  - `Profile`:
    - An `Avatar`: the photo when `photoUrl` is given, otherwise a circle with `initials(fullName)` from task 001 (#38, #62).
    - The full name.
    - "View profile" as a link to the Settings Account tab path (#9).
    - The vertical three-dot icon, visual only: no button, no link, no handler (#9).
  - `Header`:
    - "Hello <greetingName>", only when `greetingName` is given (Overview, #10).
    - The "»" icon, visual only (#10).
    - The date from a plain-date prop `today` (`YYYY-MM-DD`, the backend's "today" in the browser's zone, wired in task 011, #54), shown with `formatDate` (`19 May, 2023`, #11).
    - `NotificationIcon` with its teal dot, always shown, visual only (#8).
    - `HeaderSearch`: 352x48, placeholder "Search here" and `SearchIcon`. Text can be typed, but nothing searches, submits or calls the API (#7).
  - Code-only, added to the Code-only table in `docs/figma/components.md`:
    - `Avatar`: the photo, or the initials circle.
    - `AppLayout`: `NavBar` fixed on the left, staying in place when the page scrolls (#5); a main column with `Header` and then the content, which scrolls. The header follows #83. No horizontal scroll at 1440x1024.
- Icons missing from the export: the "»" double chevron and the vertical three dots. First check that no exported icon matches. If none does, copy the Lucide SVGs `chevrons-right` and `ellipsis-vertical` as files into `frontend/src/assets/icons/` (no package; #66 allows Lucide for missing icons; ISC license noted in the Log), converted to `currentColor`.
- `NavMenu` Status=Hover appears in no PNG. Use the first reference available:
  1. A manual 2x PNG export of frame `66:1754` in `docs/figma/components/`, if I added one.
  2. One `get_screenshot` of `66:1754`, only after I approve it. Log the call in `docs/figma/inventory.md` and `docs/metrics.md`.
  3. Otherwise, build it from tokens with `frontend-design:frontend-design` and list it in the Log as "not verified against Figma".
- Dev gallery sections:
  - `NavMenu` in every status.
  - `Profile` with a photo (any local image) and with initials ("Tanzir Rahman", "Marko").
  - `Header` with and without a greeting.
  - Two full `AppLayout` frames at 1440x1024 with a content block taller than the viewport: one like 104 (Overview active, greeting "Tanzir", today `2023-05-19`, name "Tanzir Rahman") and one like 105 (Balances active, no greeting).

## Out of scope
- Real routes, the signed-in user, `/api` calls, logout behavior, `activeSection` from the URL (including Account Details showing Balances, #47), and redirects for unknown URLs. All of these are task 011.
- Any screen content (Overview widgets and the rest).
- Search behavior, a notifications panel, a three-dot menu, collapsing the sidebar (#7, #8, #9, #10).
- Photo upload (task 029).

## Acceptance criteria
1. Given `NavBar`, then it shows the dark 280px sidebar at full viewport height, with the white logo, the seven items in order with their icons, `Logout`, the divider and the profile block at the bottom, matching the sidebar in 104 (US-04 criterion 1).
2. Given `activeSection="balances"`, then Balances has the Active style and `aria-current="page"`, and every other item has the Inactive style (US-04 criterion 2).
3. Given I hover an inactive item, then it shows the Hover style. Hovering the active item keeps it Active (US-04 criterion 3).
4. Given the items, then each is a keyboard-focusable link to its section path from `paths.ts`.
5. Given I click `Logout`, then `onLogout` is called once.
6. Given `Profile` with `photoUrl`, then the avatar shows the photo, with the full name as alt text. Given no `photoUrl`, it shows a token-styled circle with the initials: "TR" for "Tanzir Rahman", "M" for "Marko" (#38, #62). "View profile" links to the Settings Account tab path (#9).
7. Given `Header` with `greetingName="Tanzir"` and `today="2023-05-19"`, then it shows "Hello Tanzir", then the "»" icon and "19 May, 2023". Given no `greetingName`, then only the "»" icon and the date show (#10, #11).
8. Given the three-dot icon, the "»" icon or the bell, then none is a button or link, clicking does nothing, and the bell always shows its teal dot (#8, #9, #10).
9. Given `HeaderSearch`, then it shows "Search here" and `SearchIcon`. Typed text shows in the field, and pressing Enter submits nothing and sends no request (#7).
10. Given `AppLayout` with content taller than 1024 at 1440x1024, when I scroll, then the content scrolls and `NavBar` stays in place. The header behaves as #83 decides, and there is no horizontal scroll (#5).
11. Given the icons, then every nav and header icon renders as inline SVG in `currentColor`, including any copied Lucide file.
12. Given the component folder, then `Avatar` and `AppLayout` are in the Code-only table, every other name is in the Code name column of `components.md`, and all CSS uses tokens only.
13. Given `npm run dev`, then the gallery shows every section listed in Scope.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | Render `NavBar` with sample props | Logo, seven links in the given order with accessible names and `paths.ts` hrefs, Logout button, profile block | 1, 4 |
| T2 | unit | `activeSection="balances"`, then `"overview"` | Only the matching link has `aria-current="page"` and the Active style | 2 |
| T3 | e2e | Gallery: hover an inactive item, then the active one | Inactive item computed colors equal the Hover tokens; active item keeps the Active tokens | 3 |
| T4 | unit | Click `Logout` | `onLogout` called exactly once | 5 |
| T5 | unit | `Avatar` with `photoUrl`; without, for "Tanzir Rahman", "Marko" and "  ana   maria  lopez " | `img` with alt "Tanzir Rahman"; text "TR", "M", "AL" | 6 |
| T6 | unit | `Profile` links and icons | "View profile" href is the Settings Account path; three-dot icon has no button or link role and is `aria-hidden` | 6, 8 |
| T7 | unit | `Header` with `greetingName="Tanzir"`, `today="2023-05-19"`; then without `greetingName` | "Hello Tanzir" and "19 May, 2023"; then the date only | 7 |
| T8 | unit | Click the "»" icon and the bell | No button or link roles, no handler errors; the dot element is present | 8 |
| T9 | unit | Type "rent" in `HeaderSearch` and press Enter inside a page with a `fetch` spy and a form `onSubmit` spy | Field shows "rent"; neither spy is called | 9 |
| T10 | e2e | Gallery `AppLayout` like 104 with tall content: scroll the content by 800px | `NavBar` bounding box unchanged; header position as #83 decides; `document.documentElement.scrollWidth` is 1440 or less | 10 |
| T11 | unit | Icon test from task 000 run over the icon folder, including new files | Every icon has no raw color and uses `currentColor` | 11 |
| T12 | unit | Component name guard from task 002 | Passes with the new components | 12 |
| T13 | e2e | Dev server `/dev/components` shell sections | Render with no console errors | 13 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass.
2. Unit tests pass.
3. E2E tests pass.
4. Visual: Playwright MCP screenshots of the two gallery `AppLayout` frames at 1440x1024, compared with the sidebar and header of the PNGs (content area ignored). Positions are CSS px after halving, approximate; measure them exactly:
   - `104. Overview.png`: sidebar x 0–280; logo x 58–222, y about 63; Overview active item x 28–252, y 120–168, with the next items every 64px down to Settings (y about 528); Logout x 28–252, y 780–828; divider y about 873; avatar center (44, 924), name y about 916, "View profile" y about 935; greeting x about 305, y about 44; "»" x about 479; date x about 497; bell center (1004, 44); search x 1056–1408, y 20–68; header bottom line y 88.
   - `105. Balances.png`: the same sidebar with Balances active; header without greeting.
   Save the screenshots to `.claude/tasks/evidence/003/` and list every difference. The avatar differs from Figma (initials instead of a photo, #38), which is expected.
5. Manual browser checks with Playwright MCP in the gallery: hover each nav item, tab through the sidebar and header, type in the search field and press Enter, scroll the tall content.

## Human checkpoint (only if Gate: human)
- Sidebar and header match 104 and 105 (positions, colors, type, icons).
- Nav icon mapping and the source of the "»" and three-dot icons.
- Undesigned visuals: the initials avatar, focus styles, and the Hover style if it was built without a reference.
- Scroll behavior as decided in #83.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-23, before building
- All cited decisions are closed. #83 is closed (the header scrolls with the content, only the sidebar is fixed); the "open: this task waits for it" text above is stale, as Marko noted when starting the task. Focus follows #87 (teal `:focus-visible` ring, links included).
- Hover reference: option 1, the manual export `docs/figma/components/66-1754.png` (2x). **No Figma MCP calls in this task.**

### 2026-10-23, build (TDD)
- **Measurements.** Node scripts with built-ins only, in the session scratchpad, on the 2x PNGs 104 and 105 and the export. CSS px are halved.
  - Sidebar #191919, x 0–280. Logo glyphs x 58.5–221.5, y 54–72. Items x 28–252, y 120 + 64n, 48 high. Logout y 780–828, #262626. Divider y 872, #2B2B2B (white 8%). Avatar x 28–60, y 908–940. Name x 76.5. "View profile" 12px, #BABABA. Dots glyph x 248–252, y 914–934, white.
  - Header: line y 87–88, Gray/05. Greeting x 304, Default Black 24px. "»" box x 468 (304 in 105), glyph 14x12, Gray/03. Date 14px Gray/03, 4px after the "»" box. Bell box x 992, y 32, Gray/01. Search x 1056–1408, y 20–68; placeholder 16px Gray/03 at x 1088; icon #525256 (Secondary).
  - Weights were chosen by rendering Inter Variable at 400 to 800 at 2x and diffing each against the PNG text (mean abs diff per channel, lower is better):
    - "Hello Tanzir": 700 5.1, 600 14.6, 800 16.9. Bold 24/28 (`--font-bold-24-28`).
    - Active "Overview": 600 6.4, 500 9.2, 700 12.9. Semibold.
    - "Logout": 600 4.5. Semibold.
    - "Tanzir Rahman": 600 9.7. Semibold.
    - "View profile": 400 10.3. Inactive labels: 400 7.4.
- **Nav icon mapping.** Every candidate icon was rendered at 24px and 2x and diffed against each PNG nav icon (mean abs diff, 0 to 255; next best in brackets):
  - Overview: `MenuOverview` 0.2 (`Bill` 55.9)
  - Balances: `Wallet` 1.7 (`Bill` 40.8)
  - Transactions: `Transaction` 1.4 (`MenuBell` 41.3; `MenuTransaction` 52.4)
  - Bills: `Bill` 0.6 (`Wallet` 39.6)
  - Expenses: `Expenses` 1.9 (`Bill` 42.6)
  - Goals: `Goal` 2.8 (`MenuPayment` 56.0; `Target` was not close)
  - Settings: `MenuSettings` 1.8 (`MenuTransaction` 46.6)
- **"»" and three dots.** No exported icon matches: all 44 exported icons plus the Lucide candidates were rendered and diffed against the PNG.
  - "»": Lucide `chevrons-right` 0.2; best exported `ArrowDown2` 11.4.
  - Dots: Lucide `ellipsis-vertical` 9.4; best exported `IconSeparator` 18.9.
  - Copied from `lucide-icons/lucide` main `icons/chevrons-right.svg` and `icons/ellipsis-vertical.svg`, checked by fetching the raw files. They are converted to the project's SVG style (stroke `currentColor` on each element), with the paths unchanged.
  - Code names `ChevronsRight` and `EllipsisVertical`, in the Code-only table.
  - License: Lucide is ISC. Both icons are on the Feather-derived list in `LICENSE-lucide.txt` (`chevrons-right`, and `more-vertical`, the old name of `ellipsis-vertical`), so the existing ISC and MIT notices cover them. That file is unchanged.
- **Hover (from the export, so verified against Figma).** Status=Hover is the Inactive item on white at 8%: #2C2B2B on the export's #1A1919 canvas. Text and icons stay white 70% (#BFBFBF over it). The weight is the same: the label pixel counts equal Inactive. Hovering the active item keeps Active.
- **Tokens added** to `tokens.md` and `tokens.css`, each with its measured source:
  - spacing: `--space-sidebar-logo-gap` 48, `--space-sidebar-logout-gap` 44, `--space-sidebar-bottom` 48, `--space-logout-icon-gap` 16, `--space-profile-gap` 16, `--space-header-greeting-gap` 24, `--space-header-date-gap` 4, `--space-header-actions-gap` 40, `--space-search-padding-left` 32, `--space-search-padding-right` 24 (23 measured);
  - size: `--size-sidebar-logo-width` 164 (163.5 measured), `--size-sidebar-brand-height` 72, `--size-profile-height` 104, `--size-profile-menu-icon-width` 4;
  - radius: `--radius-avatar` 50% (circle).
- **Reused tokens:**
  - `--space-page-left` and `--space-page-right` for the header insets (the same 24 and 32 as their sources);
  - `--space-page-top`, `-left` and `-right` for the content inset in `AppLayout`;
  - `--color-white-70` for the Logout text and icon (see Differences).
- **Components** in `frontend/src/components/`, exported through `index.ts` (and the `NavSection` type):
  - `NavMenu`: a React Router `Link` with `aria-current="page"` when active. Its section, label, icon and path come from one table; `navSections` gives the order.
  - `NavBar`: the logo, then `<nav aria-label="Main">` with the 7 items in a list, then `Logout` and `Profile` pushed to the bottom.
  - `Logout`: `type="button"`, calls `onLogout`.
  - `Avatar`: `<img alt={fullName}>`, or `role="img"` with `aria-label={fullName}` and the initials inside. An empty `photoUrl` counts as no photo.
  - `Profile`: avatar, name (ellipsis if too long), "View profile" `Link` to `paths.settingsAccount`, and the dots, `aria-hidden` with no handler.
  - `Header`: an optional greeting, the "»" (`aria-hidden`), `<time dateTime>` with `formatDate(today)`, the bell (`aria-hidden`, its teal dot in the SVG) and `HeaderSearch`.
  - `HeaderSearch`: `role="search"` with `type="search"`, `aria-label="Search"`, `autoComplete="off"`. Enter is prevented on keydown, so an enclosing form is never submitted. The WebKit clear button is hidden (not designed).
  - `AppLayout`: `navBar`, `header` and `children` slots.
- **Layout choices:**
  - `AppLayout` keeps the sidebar `position: sticky; top: 0; height: 100vh` in a flex row. The document scrolls; the sidebar stays in place (#5), and the header scrolls with the content (#83). Sticky instead of fixed keeps the sidebar in the flow (no 280px offset) and lets two frames stack in the gallery. As the page root (task 011), it behaves like fixed.
  - The logo sits at the bottom of a 72px block, so its top lands at 54 without an off-grid token.
  - The divider is an `<hr>` inside `Profile`, laid over the top of the 104px block, as in the Figma `Profile` component (`66-1754.png` shows the line at its top). The content centers on the whole block, which puts the avatar at y 908 exactly.
  - The header line is a `::after` over the bottom edge, so the content centers on the full 88px (search at y 20–68).
  - Dots: the Lucide file's glyph column (`viewBox="10 0 4 24"` at the use site) in a 4x24 box, so the glyph's right edge is the block's right edge (x 252), as measured.
- **Undesigned visuals** (`frontend-design`, tokens only):
  - initials avatar: Gray/01 circle with white Semibold 14/20 letters. It has about the weight of the gray photo in 104; teal would compete with the active item;
  - typed search text: Default Black;
  - focus (#87): the teal 2px ring with a 2px offset on the nav links, Logout and "View profile", and on the whole search field via `:has(.input:focus-visible)`;
  - no hover on Logout (not designed).
- **Route paths** (`frontend/src/routes/paths.ts`): `/login`, `/sign-up`, `/forgot-password`, `/overview`, `/balances`, `/balances/:accountId` (with `accountDetailsPath(id)`, the id URI-encoded; under Balances, #47), `/transactions`, `/bills`, `/expenses`, `/goals`, `/settings/account`, `/settings/security`.
- **Gallery** sections: NavMenu (Active, Inactive, Hover), Logout, Avatar, Profile (photo, "Tanzir Rahman", "Marko"), NavBar, HeaderSearch, Header (with and without greeting), AppLayout (like 104 and like 105, with content of two viewport-high blocks).
  - The photo is `frontend/src/app/dev/sample-avatar.png`, the 64x64 profile photo cropped from PNG 104 (dev only; not in `dist`).
  - The Hover example needs the pointer: no prop was added to production code just to force it.
- **Red before green.**
  - Every new unit test file failed first on the missing module or export. The icon list test failed (42 against 44), the gallery test on the missing NavMenu region, and the name guard on `Avatar` and `AppLayout` until their Code-only rows existed.
  - Mutation check: removing the Enter guard from `HeaderSearch` made T9 fail (the form `onSubmit` was called once).

### 2026-10-23, validation
1. **Lint and typecheck.**
   - The first `npm run lint` failed on oxlint test rules: `consistent-function-scoping` twice, plus `no-conditional-expect` and `expect-expect` (rework loop 1). Fixed by moving two helpers to module scope and replacing a conditional `expect` with one array assertion.
   - Final: `npm run lint` exit 0 (oxlint, Stylelint, Prettier); `npm run typecheck` exit 0 in all 4 workspaces.
2. **Unit tests.** `npm test`: shared 187/187, backend 43/43, frontend 275/275 (238 before this task).
3. **E2E.**
   - The first run had 16/17 passing. The header test expected the "»" box at exactly x 468 and got 466.8125 (rework loop 2).
   - Root cause: the layout is right (greeting end + 24). The greeting's advance in Inter Variable is 138.8px against about 140 in Figma's Inter, with equal ink widths (274 at 2x). A 28px gap would land 2.8px off, so 24 stays.
   - The test now asserts the token layout exactly (greeting end + 24, then + 24 + 4 to the date) and 104's x 468 within 1.5px. 105's x 304 is asserted exactly.
   - Then `npm run e2e` 17/17, 7 new in `app-shell.spec.ts`: T3 hover, T10 scroll, sidebar and header positions, focus order and rings, search Enter, colors. The gallery spec now checks the 8 new sections too, with no console errors or warnings (T13). After the review fixes: 19/19 (see below).
4. **Visual.** Playwright MCP at 1440x1024, device scale 2, scrollbars hidden, so renders share the PNGs' pixel grid. Evidence in `.claude/tasks/evidence/003/`:
   - `render-104-2x.png`, `render-105-2x.png`: the two gallery frames, scrolled to the top of the viewport;
   - `compare-10x-sidebar.png` and `compare-10x-header.png`: design, render and difference ×4. Mean abs diff per channel: sidebar 0.82 (104) and 0.81 (105); header 3.26 and 2.47, mostly the page tone and the date text;
   - `render-navmenu-*.png`: Active, Inactive, and Hover on each item. Against the export's Hover column: same icon positions, labels within 1px at 2x, mean diff 1.7 to 2.6;
   - `render-profile-*.png`: with the sample photo, the avatar box equals 104's exactly (x 56–119, y 1816–1879 at 2x), mean diff 1.41. Also initials "TR" and "M";
   - `render-logout.png`, `render-header-no-greeting.png`, `render-search-typed.png`, `focus-*.png` (8px margin), `gallery-full-1440.png` (1x, headed, with a scrollbar).

   Measured the same features in render and PNG. Equal at 2x: sidebar edge and color, all icon boxes, the Overview and Balances active items, Logout box and icon, divider, avatar, header line, bell, the "»" in 105. Differences:
   - Page and header background: `#F3F3F3` (Gray/06) against `#F4F5F7` (known since task 000).
   - Avatar: initials instead of the photo (#38, expected).
   - Date: "19 May, 2023" against "May 19, 2023" (#11). In 104 it starts 1.5 CSS px further left, following the "»".
   - "»" in 104: 1.2 CSS px further left (x 466.8 against 468), from the greeting's advance (see E2E).
   - Greeting: 1 CSS px higher (glyphs y 67–104 against 69–106 at 2x), from Chromium's baseline rounding of 24/28 text. Date, "»", bell and search are at the measured y.
   - Logout text and icon: `#BBBBBB` against `#C5C5C5`. White 70% is the nearest token; no token matches.
   - Three dots: the Lucide glyph is 18px tall against 20 (y 1830–1865 against 1828–1867 at 2x). Same center and x.
   - Search icon: about 1 CSS px further left and up (glyph x 2722–2762, y 66–106 against 2724–2763, 68–107 at 2x). In Figma the icon box sits at y 33, off center, and the 23px right inset rounds to 24.
   - Logo: half a pixel wider and higher (glyphs x 116–443, bottom 143 against 117–443 and 144 at 2x): 164 wide against 163.5.
   - Text: labels within 1px at 2x; Inter Variable against Figma's Inter (as in task 002).
   - Hover against the export: `#2B2B2B` and `#BCBCBC` against `#2C2B2B` and `#BFBFBF`, because the export canvas is `#1A1919`, not `#191919`.
   - In a browser with classic scrollbars (headed Chromium on Windows), the page is 15px narrower (1425), so the header's right side moves 15px left. Figma shows no scrollbar; the E2E and the evidence run without one. No horizontal scroll either way.
5. **Manual checks** (Playwright MCP, gallery frame like 104):
   - Hover on each of the 7 items: Overview stays teal and white; the other 6 show `rgba(255, 255, 255, 0.08)` with white 70% text.
   - Tab order: the 7 links, Logout, "View profile", then the search field, each with the solid teal ring; the field shows its ring on the box.
   - Typing "rent" and Enter: the value stays, no request, the URL is unchanged.
   - Wheel-scrolling 800px: the header moved from y 0 to -800; the nav (y 120) and the avatar (y 908) stayed. No horizontal scroll.
   - No console errors or warnings.
- **Build.** `npm run build` exit 0. `frontend/dist` contains none of "Component gallery", "/dev/components", "sample-avatar" or "Like 104".
- No `security-review` (not on the Skills line).

### 2026-10-23, code review (`superpowers:requesting-code-review`)
- No critical findings; 1 important, 7 minor. Verdict: "With fixes". The reviewer re-sampled the hover, divider, header line and Logout colors in the PNGs and the export and confirmed them.
- Fixed (test first; both new e2e tests failed before the fix: "View profile" ended at y 716 in a 640px window; a long name made the page 2082px wide):
  1. Important: on a window shorter than the sidebar (796px), the profile block and then Logout could not be reached. `AppLayout`'s sidebar now scrolls on its own (`overflow-y: auto`), and `NavBar` has `min-height: 100vh` instead of `height`, so the dark background covers it. Nothing changes at 1440x1024 (renders retaken, same measurements). On such a window the sidebar shows its own scrollbar: `render-short-window-640.png`. While writing that test I found it located the greeting by the text it then replaced, which timed out; it now locates the element.
  2. Minor: a first name too long for the header row pushed the page sideways (AC10). The greeting is cut with an ellipsis, like the profile name.
  3. Minor: the e2e Enter test cannot fail in the gallery (no form there). Retitled; the form case is the unit test T9, which the mutation check covers.
- Kept, with reasons:
  - A photo that fails to load shows the browser's broken image instead of the initials. Photos and their URL are task 029 (#44, #76); a fallback is noted for it.
  - Logo, Logout and the profile are outside a landmark (only the section list is in `<nav>`). They are reachable in tab order; `<aside>` would label the primary navigation as complementary content. Not changed.
  - `ChevronRight` and `ChevronsRight` differ by one letter: the names follow Lucide's own (`chevron-right`, `chevrons-right`), as the Figma names do. `IconCheck` took the `Icon` prefix to match Figma's `Icon/eye` family. Not renamed.
  - No bottom inset under the content: no frame is taller than 1024, so it is not designed (general rule). The first screen whose content scrolls owns it.
  - The gallery Hover example only shows Hover under the pointer. The evidence `render-navmenu-hover-*.png` shows each item hovered.
- Forward notes for task 011, from the review:
  - the sticky sidebar breaks if an ancestor of `AppLayout` gets `overflow: hidden`, so re-run the T10 checks on a real route;
  - `formatDate(today)` throws on an empty date, so render `Header` once `today` is known;
  - `navSections` and the URL-to-section mapping for #47 come from `components/NavMenu/NavMenu`, not the barrel (the name guard counts barrel exports).
- The reviewer's "Declined to judge" list:
  - avatar alt repeating the visible name (AC6 requires it);
  - Gray/03 contrast on the date and placeholder (designed colors);
  - page background (task 000) and the date format (#11);
  - duplicate SVG ids when several headers render (gallery only, task 000 asset);
  - whether the boxed Logout in 104 is Figma `Menu (single)` rather than `Logout` (needs a Figma call; built as the task names it, and it matches the PNG);
  - no skip link (not designed);
  - Logout pending state (task 011);
  - the search field's ring on a mouse click (`:focus-visible` on text inputs, by browser design);
  - Escape clearing a `type="search"` field (native);
  - the 15px scrollbar shift (in Differences above);
  - task bookkeeping and the license wording (task 002 file).

  All are outside this task or already decided, so none is acted on.
- **Re-validation after the fixes:**
  - `npm run lint` exit 0;
  - `npm run typecheck` exit 0;
  - `npm test`: shared 187/187, backend 43/43, frontend 275/275;
  - `npm run e2e` 19/19;
  - `npm run build` exit 0, no gallery markers in `dist`;
  - visual frames retaken: sidebar mean diff 0.82 and 0.81, header 3.26 and 2.47, the same feature measurements as above.

### 2026-10-23 17:36, human gate: approved
- Approved by human (Marko). Status `done`. Human interventions +1.
- On Marko's request, row 011 in `INDEX.md` now also covers "scrollbar-gutter: stable on the scroll container, so classic (Windows) scrollbars do not shift the header by 15px".

## Metrics
- Started: 2026-10-23 16:52
- Finished: 2026-10-23 17:36
- Human interventions: 1
- Rework loops: 2
- Notes on prompts that failed: none. Rework: 1 lint failure (oxlint test rules), 1 e2e failure (a position assertion that assumed Figma's text metrics). No Figma calls.
