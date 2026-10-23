# Task 003: Shared components: app shell (sidebar, header, layout)

- Status: todo
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

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
