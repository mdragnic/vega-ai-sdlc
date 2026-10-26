# Task 011: App shell slice: signed-in user, date, greeting, navigation, logout, unknown URLs

- Status: done
- Gate: human
- Depends on: 003, 009
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (sessions and user scoping: Logout ends the server session and removes cached data, a failed Logout tells the user they are still signed in, a new signed-in endpoint, the time zone header as input: run it on the task's changes and fix every finding before the gate), `frontend-design:frontend-design` (undesigned states only: the header before its date arrives and after a failed request, the "Couldn't log out" message near Logout, the focus rings on the real routes)

## Goal
Every app page (104 to 112) opens inside the task 003 shell, wired to the signed-in user. The sidebar shows their name and initials and highlights the page's section. The header shows the backend's "today" in the browser's time zone, and the greeting on Overview. The sidebar links and "View profile" move between pages. Logout ends the session and opens Login, or says so when it fails. `/` and unknown URLs go to Overview (or Login when signed out), and `/settings` opens the Account tab. The layout fills any screen from 1280px wide (#94). The screens' content stays empty until task 013.

## References
- Spec: `docs/spec/stories.md` US-04 (all 15 criteria; criteria 3, 10, 11 and 13 were built in task 003 and are re-checked on the real routes); `docs/spec/brief.md` Layout (app screens, auth screens), Screen flow
- Figma: the shell on every app frame. Nav bar `411:6442` (instances `411:6510` in 104, `413:7727` in 105), Header `411:6067` (instances `411:6089` in 104, `411:6111` in 105). PNGs, sidebar and header only: `docs/figma/104. Overview.png` (greeting, Overview active), `105. Balances.png`, `106. Account Details.png` (Balances active, #47), `107. Transactions.png`, `108. Bills.png`, `109. Expenses.png`, `110. Goals.png`, `111. Settings.png`, `112. Settings.png`. 106 to 112 are flattened (#37). Budget 0, no MCP calls.
- Components (task 003, `docs/figma/components.md`): `AppLayout`, `NavBar`, `NavMenu` (`navSections`, `NavSection`), `Logout`, `Profile`, `Avatar`, `Header`, `HeaderSearch`. Routes: `paths.ts` (task 003), `RequireAuth`, `GuestOnly`, `return-to.ts` (task 009). Session: `useSession`, `setSessionUser`, `createQueryClient` in `frontend/src/api/session.ts` (tasks 009, 010). Client: `apiRequest` with `X-Time-Zone` (task 000). Contract: `authContract.logout`, `authContract.me` (task 007). Backend: `POST /api/auth/logout` (204, also without a valid session; clears the cookie, task 007), `Clock` and `CLOCK`, `TimeZone` and `parseTimeZone`, `startOfNextDay` (tasks 000, 008). Shared: `firstName`, `initials`, `formatDate` (task 001).
- Decisions: `docs/decisions.md` #3 (Logout without confirm, to Login; app pages need a session; return target), #5 (sidebar fixed, content scrolls, 1440x1024 reference), #9 ("View profile" to Settings Account; three dots visual only), #10 (greeting on Overview only, first name; date is today; "»" visual only), #11 (date format), #38 (initials avatar, no demo photo), #39 (unknown URLs to Overview, or Login when signed out; no 404 page; no other user's data), #47 (Balances active on Account Details), #54 (today in the browser's zone, sent as `X-Time-Zone`), #62 (first name and initials), #74 (contract in `shared` only), #75 (session cookie), #80 (backend "now" only from `Clock`), #83 (header scrolls with the content), #87 (teal `:focus-visible` ring), #94 (full width, minimum 1280px), #97 (c) (only the page background while the session check runs), #98 (only a 401 ends a known session), #100 (the header date while loading or failed and after midnight; Logout while running and when it fails; scroll position between pages; `/settings`; the separate today endpoint; the gutter on app pages only), #101 (the 1280 minimum includes the scrollbar gutter; the header's right side 15px left of the PNGs with a classic scrollbar, measured from the page's right edge; the white Logout failure message)

## Scope
- **Layout by #94** (tokens only):
  - `--size-page-min-width` 1280px in `docs/figma/tokens.md` and `tokens.css` (source: #94), as `min-width` on `body` in `global.css`. Every page, app and auth, is at least 1280px wide; below that the page scrolls horizontally.
  - App pages: `AppLayout` keeps its structure from task 003. The sidebar stays 280px; the main column (header and content) fills the rest at any width. No fixed or maximum width anywhere in the shell. The header's search stays at the right edge, 32px in (`--space-page-right`).
  - Auth pages: unchanged. `AuthLayout` keeps the full-window background and the 400px column centered.
  - `scrollbar-gutter: stable` on the document root while an app page shows (the document is the app's scroll container, task 003), so a classic (Windows) scrollbar takes the same 15px on every app page and the header does not move between a page that scrolls and one that does not (row 011 note). Auth pages do not get it, so their column stays centered in the window (#100).
  - Card grids are not built here: the screen tasks from 013 apply #94 to them.
- **Backend: today** (#54, #80, #100):
  - `shared/src/contract/calendar.ts`: `todayResponseSchema` `{ today }`, a plain date `YYYY-MM-DD` (`z.iso.date()`), and `calendarContract.today`, `GET /calendar/today` with no body. Exported from the contract index (#74).
  - `todayIn(now, timeZone)` in `backend/src/common/time-zone/`, next to `startOfNextDay` and sharing its wall-clock helper: the date of an instant in an IANA zone, as `YYYY-MM-DD`. Rows 015 and 023 compare `due_date` with it.
  - `backend/src/calendar/`: a `CalendarController` (in its own module, registered in `AppModule`) answering `GET /api/calendar/today` with `{ today: todayIn(clock.now(), timeZone) }`. "Now" from the injected `Clock` (`@Inject(CLOCK)`), the zone from `@TimeZone()` (400 when the header is missing or not a zone). Behind the global `SessionGuard` (not `@Public`): signed out, 401. It reads no user data.
- **Frontend: the shell route**:
  - `frontend/src/app/AppShell.tsx`, a layout route inside `RequireAuth` around every app path. It renders `AppLayout` once for all app pages, so it stays mounted while the user moves between them, with:
    - `NavBar`:
      - `activeSection` from the matched route's `handle`: Overview, Balances, Transactions, Bills, Expenses, Goals; Account Details is Balances (#47); both Settings tabs are Settings;
      - `fullName` from the session user;
      - no `photoUrl`, so the initials avatar (#38; the photo is task 029);
      - `onLogout`, the Logout state and its failure message (below).
    - `Header`: `greetingName` is `firstName(user.fullName)` on Overview only (#10, #62); `today` from the date query (below).
    - `<Outlet />`: the page content, empty until task 013 and the later screen tasks.
    - React Router's `ScrollRestoration` (#100 d): another page opens at the top; Back and Forward restore the earlier position.
  - `frontend/src/routes/paths.ts`: `settings: '/settings'`, the Settings path without a tab, used only by its redirect.
  - `frontend/src/app/routes.tsx`:
    - The nine app paths become children of `RequireAuth` > `AppShell`, each with its `handle` (section, and the greeting on Overview) and no element yet.
    - `paths.settings` renders `<Navigate replace to={paths.settingsAccount} />` (#100). Signed out, the Account tab's guard then opens Login with `returnTo=/settings/account`.
    - `/` and every other unknown path (`*`) render `<Navigate replace to={paths.overview} />`. Signed in, Overview opens. Signed out, Overview's guard opens Login with `returnTo=/overview` (#3, #39), so after login Overview opens. No not-found page.
    - The dev routes stay as they are (development only; in a production build `/dev/...` is an unknown path).
    - `RootPage` (the empty frame from tasks 000 and 009) is deleted. Its test in `frontend/test/app/router.test.tsx` changes from "renders the root page at /" to the `/` redirect (#39); the no-console-error check stays.
  - `Header`: `today` becomes optional. Without it, the date (`<time>`) is not rendered; the greeting, the "»" icon, the bell and the search show where they always are, so nothing moves when the date arrives (#100 a). Task 003's review note: `formatDate` throws on an empty date, so it is never called without one.
  - `frontend/src/api/calendar.ts`: `useToday()`, a query on `calendarContract.today` under its own key (#100 a, b):
    - asked for when the shell opens, again when the window gets focus back, and again on every move to another app page (a change of path); no timer;
    - a failure leaves the date empty with no message; the request is retried 3 times (the app's query default) and again on the next focus or move. A later failed request keeps the date already shown, as #89 does for widgets;
    - removed with every other cached query when a session starts or ends (`setSessionUser`, #39).
  - `frontend/src/api/session.ts`: `useLogout()`, a mutation on `authContract.logout`, beside `useLogin` and `useSignUp` (#3, #100 c):
    - one request at a time: while it runs, further clicks on Logout send nothing;
    - on the 204: the session becomes signed out and every other cached query is removed (`setSessionUser(queryClient, null)`, #39). Login opens at exactly `/login`, with no return target, replacing the page in the history. `RequireAuth`'s own redirect (Login with the page as `returnTo`) must not win the race;
    - on any failure (a 5xx, a network failure, any other error): the session and the cached data stay, the page stays, and the failure message shows (below). Only the backend can end the session (the cookie is `httpOnly`), so the user must know they are still signed in.
  - `Logout`: takes an optional `pending` prop. While pending it sets `aria-disabled` and cancels its clicks, keeping keyboard focus, as `ButtonPrimary` does (task 009). It looks the same (no pending state is designed).
  - The failure message "Couldn't log out. Please try again." (#100 c):
    - shows in the sidebar next to Logout, as text with `role="alert"`, so a screen reader announces it while focus stays on Logout;
    - not designed: built with `frontend-design` from existing tokens only (text legible on the dark sidebar, type and spacing tokens), the exact place chosen in the build and reviewed at the gate. Logout and the profile block stay where 104 draws them while no message shows;
    - stays until the next Logout click, which removes it while that request runs; a new failure shows it again; a success opens Login.
    - The text lives in the frontend (no server text, #74).
- **Tests** in `shared/test/`, `backend/test/` (Vitest), `frontend/test/` (Vitest, Testing Library, MSW, `test/support/app.tsx`) and `e2e/tests/app-shell-slice.spec.ts` (Playwright, real stack, fixed clock and zone from `e2e/constants.ts`, users from `e2e/helpers.ts`). `e2e/tests/app-shell.spec.ts` (the task 003 gallery checks) stays.

## Out of scope
- Any screen content: Overview widgets (task 013 onward), the Settings tabs and their fields (tasks 028, 030), the profile photo and its upload (task 029), card grids (#94 applies in the screen tasks).
- The Account Details redirect to Balances for an account that does not exist or belongs to another user (#39, task 021).
- Google sign-in (task 012). Login, Sign up and Forgot Password behave as built in tasks 009 and 010.
- Search, notifications, a three-dot menu, any action on the "»" icon (#7, #8, #9, #10). A sticky header (#83). A not-found page (#39). Mobile (#4).
- Clearing the mutation cache when a session ends, and clearing cached data when the user changes in another tab (row 014 note).
- Changes to the session check (#97, #98) or to the task 007 logout endpoint.

## Acceptance criteria
1. Given I am signed in as "Tanzir Rahman", when I open each app path at 1440x1024 (`/overview`, `/balances`, `/balances/<id>`, `/transactions`, `/bills`, `/expenses`, `/goals`, `/settings/account`, `/settings/security`), then the shell shows: the sidebar with "Tanzir Rahman" and the initials avatar "TR" (no photo), and the header with today's date. The content area is empty (US-04 criteria 1, 6 and 14; #38, #62).
2. Given an app page, then exactly one sidebar item has the Active style and `aria-current="page"`: Overview on `/overview`, Balances on `/balances` and on `/balances/<id>`, Transactions, Bills, Expenses and Goals on theirs, Settings on both Settings tabs (US-04 criteria 2 and 5; #47).
3. Given I click a sidebar item, then its page opens without a full page load (Settings opens `/settings/account`), its item becomes Active, and the shell is not mounted again (US-04 criterion 4).
4. Given I am on Overview, then the header shows "Hello Tanzir", the first word of my Full Name, before the "»" icon and the date. On every other app page no greeting shows (US-04 criterion 7; #10, #62).
5. Given the backend clock at 2026-10-22T22:30:00Z, when I open an app page with the browser in Europe/Belgrade, then the date reads "23 Oct, 2026"; in America/New_York it reads "22 Oct, 2026". The date comes from `GET /api/calendar/today` sent with the browser's zone in `X-Time-Zone`, never from the browser's clock (US-04 criterion 6; #11, #54, #80).
6. Given the date request is still running, then the shell shows without the date: the greeting (on Overview), the "»" icon, the bell and the search are in place, and none of them moves when the date appears after the "»". Given the request fails (after its retries), then the date stays empty, no message shows, and everything else works. Given a date is shown and a later request fails, then that date stays (#100 a).
7. Given an app page is open and the backend clock moves past midnight in my zone, when the window gets focus back, or when I open another app page, then the header shows the new date. No timer asks for it (#100 b).
8. Given I click "Logout", then no confirm dialog shows, one `POST /api/auth/logout` is sent, and on its 204 Login opens at `/login` with no `returnTo`. The session cookie is gone, the cached data of the session is gone, and opening an app URL or pressing Back opens Login, never an app page. After the next login Overview opens (US-04 criterion 8; #3, #39).
9. Given I click "Logout" while its request runs, then no second request is sent (also by a second click or Enter), and Logout keeps keyboard focus and looks the same (#100 c).
10. Given the Logout request fails (a 500, a network failure), then I stay signed in on the same page with its cached data, and "Couldn't log out. Please try again." shows next to Logout, announced by a screen reader (`role="alert"`), while focus stays on Logout. When I click Logout again, the message goes while that request runs; a new failure shows it again, and a 204 opens Login (#100 c).
11. Given I am signed in in two tabs, when I log out in one and the other gets focus back, then the other opens Login (#3, the task 009 session check).
12. Given I click "View profile", then `/settings/account` opens and Settings is Active (US-04 criterion 9; #9).
13. Given I am signed out, when I open any app path (including `/balances/<id>` and `/settings/security`), then Login opens with that page as the return target, and after login that page opens in the shell. While the session check runs, only the page background shows, never the shell (US-04 criterion 12; #3, #97 c).
14. Given I am signed in, when I open `/settings`, then `/settings/account` opens with Settings Active, replacing `/settings` in the history. Signed out, Login opens with `returnTo=/settings/account`, and after login the Account tab opens (#100).
15. Given I am signed in, when I open `/` or a URL that does not exist (`/foo`, `/overview/extra`, `/settings/foo`), then Overview opens, replacing that URL in the history. Given I am signed out, then Login opens (`/login?returnTo=%2Foverview`), and after login Overview opens. No not-found page shows (US-04 criterion 15; #3, #39).
16. Given an app page at 1920x1080 and at 2560x1440, then the sidebar is 280px wide at x 0 and full height, and the header and the content area run from x 280 to the right edge of the window: the search ends 32px from it and the header's bottom line spans the whole column. No maximum width, no horizontal scroll. At 1280x1024 the same, with no horizontal scroll. At 1100x800 the page is 1280px wide and scrolls horizontally, and the sidebar stays 280px (#94). Refined by #101: with a classic scrollbar (15px, Windows) the app page is the window minus 15px at every width, the search ends 32px from the page's right edge, a 1280-wide window has no horizontal scroll, and below 1280 the page is 1265px wide plus the scrollbar.
17. Given Login at 1920x1080 and at 1100x800, then the background fills the page and the 400px column is centered: x 760 to 1160 at 1920; at 1100 the page is 1280px wide and the column runs from x 440 to 840 (#94). Refined by #101: below 1280 the page is 1265px wide plus the scrollbar, so at 1100 the column runs from x 432.5 to 832.5.
18. Given an app page whose content is taller than the viewport, when I scroll, then the header and the content scroll and the sidebar stays in place (#5, #83). The document root has `scrollbar-gutter: stable` on every app page and not on Login, Sign up or Forgot Password. In a browser with classic scrollbars, the search ends at the same x on a page that scrolls and on one that does not (row 011 note, #100).
19. Given I scrolled an app page down, when I open another app page from the sidebar, then it opens at the top; when I press Back, the first page shows at the position I left it; Forward restores the second page's position (#100 d).
20. Given keyboard use on an app page, then Tab goes through the 7 sidebar links, Logout, "View profile" and the search field, each with the teal 2px ring and 2px offset (the field on its box); a mouse click shows no ring. Given I press Enter on a sidebar link, then its page opens and focus stays on that link with its ring (#87).
21. Given each app page at 1440x1024, then its sidebar and header match the PNG of that screen (104 to 112), with the content area ignored and the differences listed in Validation step 4. With a classic scrollbar the header's right side sits 15px left of the PNGs (#101 b).
22. Given `GET /api/calendar/today`, then: with a session and a valid `X-Time-Zone` it answers 200 `{ today }`, the date of the `Clock`'s instant in that zone; without a session, 401; with the header missing or not a zone, 400 in the shared error shape. The schema and the path exist once, in `shared/src/contract/calendar.ts` (#54, #74, #80).

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | `todayIn` for 2026-10-22T22:30:00Z in Europe/Belgrade, America/New_York, UTC, Pacific/Kiritimati; the instants on either side of midnight in Belgrade; a DST change day (2026-03-29 and 2026-10-25 in Belgrade) | `2026-10-23`, `2026-10-22`, `2026-10-22`, `2026-10-23`; the date changes exactly at local midnight; correct dates on both DST days | 5, 22 |
| T2 | unit | `GET /api/calendar/today` with a fixed `Clock`: with a session and `X-Time-Zone` Belgrade and New York; without a session; without the header; with `+01:00` and `Mars/Base` | 200 `{ today: "2026-10-23" }` and `{ today: "2026-10-22" }`, both parsing with `todayResponseSchema`; 401; 400 twice in the shared error shape | 5, 22 |
| T3 | unit | `no-direct-time.test.ts` over `backend/src`, now with `calendar/`; the controller's route path read from `calendarContract.today` | Passes: no system time outside the clock files; the path is not redeclared | 22 |
| T4 | unit | Render each app path signed in (MSW `me` 200, `today` 200 `2026-10-22`) | `NavBar` with "Tanzir Rahman" and the "TR" avatar, no `img`; the date "22 Oct, 2026"; the one `aria-current="page"` link per AC2; the greeting only on `/overview` | 1, 2, 4 |
| T5 | unit | Click each sidebar link, then "View profile", with a render counter on `AppShell`'s layout | URL per `paths.ts` (Settings `/settings/account`); the matching item Active; `AppLayout` mounted once | 2, 3, 12 |
| T6 | unit | `today` pending, then answered; `today` 500 on every try; `today` answered, then 500 on the next focus | No `time` element while pending, with the greeting, "»", bell and search present and their boxes unchanged when the date appears; after the retries fail no date and no `role="alert"`; a shown date stays after a failed refetch | 6 |
| T7 | unit | `today` answers `2026-10-22`, then `2026-10-23`: fire window focus; then navigate to another app page; with fake timers, advance 24 hours with no focus or navigation | "23 Oct, 2026" after the focus and after the move; no request from time passing alone | 7 |
| T8 | unit | Click Logout with MSW logout 204 and an earlier query in the cache | One `POST /api/auth/logout`; URL exactly `/login`; Login renders; the earlier query and `today` are gone from the cache; the session is signed out | 8 |
| T9 | unit | Logout held open: click twice and press Enter | One request; Logout has focus and `aria-disabled`, no native `disabled`, no class change | 9 |
| T10 | unit | Logout answered 500, then a network error, then 204 on the third click | After each failure: URL unchanged, the session and the earlier query still cached, the `role="alert"` text "Couldn't log out. Please try again." next to Logout, focus on Logout; the text gone while the next request is pending; after the 204 `/login` | 10 |
| T11 | unit | Signed out (MSW `me` 401): each app path; `me` pending: `/overview` | Login with that path as `returnTo`; nothing but the page background while pending, no `navigation` landmark | 13 |
| T12 | unit | Signed in: `/settings`; signed out: `/settings` | `/settings/account` with Settings Active, history entry replaced; signed out `/login?returnTo=%2Fsettings%2Faccount` | 14 |
| T13 | unit | Signed in: `/`, `/foo`, `/overview/extra`, `/settings/foo`; signed out: `/`, `/foo` | `/overview` (history entry replaced); signed out `/login?returnTo=%2Foverview`; no console errors (the changed router test) | 15 |
| T14 | unit | Token guards: `tokens.test.ts` with `--size-page-min-width`; Stylelint over the changed CSS; the component name guard | Pass | 10, 16, 18 |
| T15 | e2e | Sign up a user "Tanzir Rahman" (`e2e/helpers.ts`), log in, open the nine app paths | Name, "TR" avatar, the active item per AC2, the greeting only on Overview, the date "22 Oct, 2026" (fixed clock, Belgrade) | 1, 2, 4 |
| T16 | e2e | Move the backend clock to 2026-10-22T22:30:00Z (`/api/test/clock`); open Overview with `timezoneId` Belgrade, then New York; record requests | "23 Oct, 2026", then "22 Oct, 2026"; each `GET /api/calendar/today` carries the page's zone in `X-Time-Zone` | 5 |
| T17 | e2e | Overview open at 2026-10-22T21:59:00Z (23:59 in Belgrade); move the clock to 22:01; dispatch window focus; set it back, reload, move it again, then click "Balances" | "22 Oct, 2026", then "23 Oct, 2026" after the focus; the same after the move to Balances | 7 |
| T18 | e2e | `page.route` holds `/api/calendar/today`, then fails it with 500 | The shell shows with no date and the search box at the same x and y as with a date; after the failures no date and no message | 6 |
| T19 | e2e | Click every sidebar item, then "View profile", recording full page loads | URLs per `paths.ts`; no `load` event after the first; Active item follows | 3, 12 |
| T20 | e2e | Logout with a request recorder; then Back; then open `/goals`; then log in | No dialog; one `POST /api/auth/logout` answered 204; `/login` without `returnTo`; no `finebank_session` cookie; Back and `/goals` show Login; after login `/overview` | 8 |
| T21 | e2e | Logout with `page.route` holding the request: click again and press Enter; fail it with 500; then abort the next one; then let the next one through | One request while held, focus on Logout; after each failure the page and URL unchanged, `finebank_session` still present, `GET /api/auth/me` 200, the message visible next to Logout; after the last click `/login` | 9, 10 |
| T22 | e2e | Two pages in one context, both on app pages; Logout in the first; focus the second | The second opens Login | 11 |
| T23 | e2e | Signed out: `/balances/abc`, `/settings/security`, `/settings`, `/`, `/nope`; log in from each | Login with `returnTo` `/balances/abc`, `/settings/security`, `/settings/account`, `/overview`, `/overview`; after login that page in the shell | 13, 14, 15 |
| T24 | e2e | Signed in: `/settings`, `/`, `/nope/deeper`; then Back after each | `/settings/account`, `/overview`, `/overview`; Back never returns to the redirected URL | 14, 15 |
| T25 | e2e | Viewports 2560x1440, 1920x1080, 1280x1024, 1100x800 on `/overview`, and Login at 1920x1080 and 1100x800 | Sidebar x 0 to 280 and full height; the page (`body`) as wide as the viewport (the window less the gutter), at least 1265 (#101); header and main from x 280 to the page's right edge; search right edge = page width − 32; horizontal scroll only below 1280; the same gutter at every size; Login column x 760 to 1160 at 1920, from x 432.5 at 1100 (page 1265) | 16, 17 |
| T26 | e2e | Inject a 3000px block into the content of `/transactions` and scroll 800px; read `scrollbar-gutter` on the root on `/overview`, `/login`, `/sign-up`, `/forgot-password` | Sidebar box unchanged, header moved up 800px; `stable` on the app page, `auto` on the three auth pages | 18 |
| T27 | e2e | On `/transactions` and `/bills`, inject a 3000px block on each route change (`page.evaluate` after each navigation); scroll `/transactions` to 800; click "Bills"; scroll to 300; Back; Forward | `/bills` opens at 0; Back shows `/transactions` at 800; Forward shows `/bills` at 300 | 19 |
| T28 | e2e | Tab through `/balances`; Enter on "Bills"; mouse click on "Goals" | Focus order and the teal ring per AC20; after Enter `/bills` with focus and the ring on "Bills"; no ring after the mouse click | 20 |
| T29 | e2e | Task 003's sidebar and header position checks, run on `/overview` and `/balances` instead of the gallery | The sidebar and the header's left side at task 003's positions; the header's right side (bell, search, search icon) at the same distances from the page's right edge, which a classic scrollbar's gutter moves 15px in (#101 b) | 21 |
| T30 | unit | Logout answered 204 while Login takes time to load (a lazy Login route) | URL exactly `/login`: the guard keeps the Login path it chose when the session ended (found in the manual check) | 8 |
| T31 | unit, e2e | Logout with the browser offline (`onlineManager.setOnline(false)` with a network error; `context.setOffline(true)`), then online again | The message at once, Logout not disabled, the page kept; back online the next click logs out to `/login` (code review) | 10 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`). Ports 3000 and 5173 free first.
4. Visual: Playwright MCP screenshots at 1440x1024 (device scale 2, scrollbars hidden, as in task 003), signed in as "Tanzir Rahman" on the demo data, of `/overview`, `/balances`, `/balances/<a demo account id>`, `/transactions`, `/bills`, `/expenses`, `/goals`, `/settings/account` and `/settings/security`, each compared with the sidebar and header of its PNG (104 to 112; 111 for the Account tab, 112 for the Security tab), the content area ignored. Positions from task 003 (104: active item x 28–252, y 120 + 64n; Logout y 780–828; avatar x 28–60, y 908–940; header line y 87–88; greeting x 304; search x 1056–1408, y 20–68). Expected differences: the date ("22 Oct, 2026" on the fixed clock against "May 19, 2023", and the #11 format), the initials avatar instead of the photo (#38), and those listed in task 003. Also, as evidence only (no PNG at those sizes): `/overview` at 1920x1080 and at 1280x1024, Login at 1920x1080 (#94), and the "Couldn't log out" message. Save to `.claude/tasks/evidence/011/` and list every difference.
5. Manual browser checks with Playwright MCP on `npm run dev` (headed Chromium on Windows, with classic scrollbars):
   - Sign up, land on Overview; click through the sidebar and "View profile"; open `/settings`; Back and Forward.
   - Tab through the shell; Enter on a sidebar link.
   - With a tall block injected into one page: the header's search ends at the same x on that page and on an empty one (`scrollbar-gutter`); scroll, move to another page, Back.
   - Resize to 1920, 1280 and 1100 wide on Overview and on Login.
   - Logout; Back; open an app URL; log in again.
   - `/`, an unknown URL, signed in and signed out.
   - Stop the backend: the header without its date (#100 a); Logout failing shows "Couldn't log out. Please try again." and keeps the page (#100 c); start the backend and log out. Save screenshots of these undesigned states to `.claude/tasks/evidence/011/`.

## Human checkpoint (only if Gate: human)
- Each app page's sidebar and header match 104 to 112 at 1440x1024 (active item, name, initials avatar, greeting on Overview only, date), with the listed differences.
- #94 as built: the shell at 1920 and 1280 wide, the page scrolling sideways below 1280, Login centered at 1920.
- The `scrollbar-gutter` check in a browser with classic scrollbars.
- Logout, `/`, `/settings`, unknown URLs and the signed-out redirects in the browser.
- #100 as applied: the header before its date and after a failure, the date after a move past midnight, Logout while running, the "Couldn't log out. Please try again." message (its place, style and when it goes), the scroll position between pages.
- Choices made at detailing (accepted by Marko, 2026-10-26, in #100 or as listed):
  - "today" from its own endpoint, `GET /api/calendar/today` `{ today }`, not a field of `GET /api/auth/me` (#100);
  - `scrollbar-gutter` on app pages only; `--size-page-min-width` on `body` for every page (#94, #100);
  - `/settings` opens the Account tab (#100);
  - the active section and the greeting from the routes' `handle`;
  - `/` and unknown URLs redirect to Overview first, so a signed-out user lands on `/login?returnTo=%2Foverview`;
  - after Logout, Login has no return target (#3);
  - `RootPage` deleted and its router test changed to the `/` redirect.
- The security review findings and their fixes.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-25, detailing (`/next-task 011`)
- First, on Marko's instruction: **#94 closed** in `docs/decisions.md` (Marko, 2026-10-25): every page full width, never fixed or maximum width; app pages with the sidebar fixed at 280px and the content area filling the rest; card grids grow proportionally, gaps and paddings stay tokens, card content stretches, fixed-size parts keep their size; auth pages keep the full-screen background with the 400px column centered; minimum width 1280px, below it the page scrolls horizontally; visual checks stay at 1440x1024 against the PNGs.
- Detailed from the outline row with Marko's notes: wire the task 003 shell to the signed-in user (US-04): #3 (Logout without confirm, to Login), #9 ("View profile" to Settings Account), #10 (greeting with the first name on Overview only), #38 (initials avatar; photos in task 029), #39 (unknown URLs and `/` to Overview, or Login when signed out), #47 (Balances on Account Details), #54 (the header date is the backend's "today" in the user's zone via `X-Time-Zone`), #83 (header scrolls with the content), #87 focus, #94 layout, and the row 011 note (`scrollbar-gutter: stable`). Screens stay empty until task 013.
- Read before detailing: US-04, the brief's Layout, the task 003 file and its forward notes, `routes.tsx`, `RequireAuth`, `GuestOnly`, `return-to.ts`, `session.ts`, `client.ts`, the shell components, the auth controller (logout answers 204 even without a valid session), the time zone helpers. No endpoint gives "today" yet, so the task adds one. React Router 8.5.0 exports `ScrollRestoration` and `useMatches` (checked).
- Task 003 forward notes applied: the e2e re-runs the gallery's position checks on the real routes (the sticky sidebar breaks under an `overflow: hidden` ancestor); `Header` never formats an empty date; the section mapping imports from `NavMenu`, not the barrel.
- Raised **#100 (open)** in `docs/decisions.md`: (a) the header before its date arrives and after a failed request; (b) when the date is asked for again (a page open past midnight); (c) Logout while its request runs and when it fails; (d) the scroll position when another app page opens.
- INDEX: row 011 cites the decisions this file uses; the open questions line listed #100. The INDEX intro now says the screen tasks apply #94 to their card grids.
- Not started. No Figma calls.

### 2026-10-26, #100 closed
- Marko's answers, recorded in `docs/decisions.md` #100 (closed, Marko, 2026-10-26):
  - (a) As proposed: the shell shows at once without the date; on a failure the date stays empty, with no message, and the request is retried.
  - (b) As proposed: asked again on window focus and on every move to another app page, no timer.
  - (c) Changed: while the request runs, extra clicks send nothing and Logout keeps focus, as proposed. On a failure (a 500, a network failure) the user stays signed in on the page and "Couldn't log out. Please try again." shows near Logout, so the user knows they are still signed in (security).
  - (d) As proposed: `ScrollRestoration`.
  - Also changed: `/settings` without a tab opens the Settings Account tab, not Overview.
  - Accepted: the separate `GET /api/calendar/today` endpoint; `scrollbar-gutter` on app pages only.
- Updated:
  - Skills: the failure message added to the undesigned states;
  - References: #100 closed;
  - Scope: `paths.settings` and its redirect, `ScrollRestoration`, `useToday` refresh and failure, Logout failure and its message;
  - AC: 6, 7 and 9 made concrete, 10 (the failure message), 14 (`/settings`) and 19 (scroll position) added, the rest renumbered (now 22);
  - Tests: T6, T7, T9, T12, T13, T17, T23, T24 and T27 made concrete, T10 (the failure message, unit), T18 (the date failing, e2e) and T21 (Logout failing, e2e) added, renumbered (now 29);
  - Validation steps 4 and 5, Human checkpoint.
- INDEX: row 011 cites #100 as closed; no open questions remain.
- Not started: Marko asked for the detailing commit only. No Figma calls.

### 2026-10-26, build (`/next-task 011`), stopped on #101
- Checked: every decision the task cites is closed. Status in-progress, started 09:08.
- Built with TDD (each test watched failing first; the router test and the changed tests checked by mutation):
  - shared: `calendar.ts` (`todayResponseSchema`, `calendarContract.today`), exported from the contract index; `test/calendar-contract.test.ts`.
  - backend: `wallClock` moved from `start-of-next-day.ts` to `common/time-zone/wall-clock.ts` (shared, as Scope asks); `todayIn` in `today-in.ts`; `calendar/` (`CalendarController`, `CalendarModule`, in `AppModule`), behind the session guard, `Clock` and `@TimeZone()`. Tests `today-in.test.ts` (T1), `calendar.test.ts` (T2, T3: path only from the contract).
  - frontend: `AppShell` (layout route: `NavBar`, `Header`, `Outlet`, `ScrollRestoration`; section and greeting from the routes' `handle`), `api/calendar.ts` `useToday` (refetch on focus and on a change of path, no timer), `useLogout` and `useLogoutInProgress` in `session.ts` (one request at a time through the cache's `isMutating`; on the 204 the session check is cancelled, then `setSessionUser(null)`; `gcTime: 0`), `RequireAuth` opens `/login` without a return target while a logout runs or succeeded, `paths.settings`, `routes.tsx` (app pages under `RequireAuth` > `AppShell` with `element: null`, which avoids React Router's empty-leaf warning; `/settings`, `/` and `*` redirects), `Header` `today` optional, `Logout` `pending` (aria-disabled, clicks cancelled, same look), `NavBar` `logoutPending` and `logoutError`. `RootPage` deleted.
  - CSS: `--size-page-min-width` 1280px (tokens.md and tokens.css, source #94) as `min-width` on `body`; `scrollbar-gutter: stable` on `html:has(.layout)` in `AppLayout.module.css`, so only pages with the app layout get it.
  - "Couldn't log out" message (frontend-design, tokens only): right above Logout in a group with it, so Logout and the profile block never move; `--font-regular-14-20` (FormError's style) in `--color-white`, since the error red measures about 4.25:1 on Default Black, under the 4.5:1 AA floor; left inset `--space-nav-padding-x` (aligned with the icons), 16px gap (`--space-nav-item-gap`, as Login's error to its button), `text-wrap: balance`.
  - Tests: `frontend/test/app/app-shell.test.tsx` (T4 to T12, 26 tests), `router.test.tsx` (T13, the `/` redirect replaces "renders the root page"), `Header.test.tsx` and `NavBar.test.tsx` (T6, T9, T10 at component level), `support/app.tsx` (`today` handler); `e2e/tests/app-shell-slice.spec.ts` (T15 to T29, 24 tests).
- Existing tests changed by this task's Scope (none weakened): `paths.test.ts` lists `settings`; `route-protection.test.tsx` "renders / signed out" now expects Login for Overview (#39); `login.test.tsx` and `sign-up.test.tsx` use `/goals` as the page before Login or Sign up (`/` now redirects), and wait for the shell's sidebar instead of any `main` (Login's own `main` raced it); the sign-up cache check expects exactly `[session]` and `[calendar, today]` (the new session's date). `test/setup.ts` stubs `window.scrollTo` (jsdom has none; `ScrollRestoration` calls it).
- Issues found while building, root-caused (systematic-debugging), all in the new e2e tests: Playwright waits for an aria-disabled button to be enabled, so the click on Logout while pending is `force: true`; the scroll test's tall block went in `body`, outside the layout, so the sticky sidebar scrolled away and Playwright scrolled to reach "Bills" (now in `main`, which React leaves alone between pages); the Tab test started from `main`, after the sidebar in DOM order (now from the sidebar's corner); the Back-after-Logout test pressed Back when the URL changed, before Login rendered (one failure in one full run, not reproduced in 30 more runs; now waits for Login, as a person would).
- **Stopped: #101 (open).** With a classic scrollbar (Windows; the e2e Chromium reserves the same 15px gutter), `scrollbar-gutter: stable` (#100) makes every app page 15px narrower than the window. At a 1280-wide window the page is 1265 inside a 1280-wide body and scrolls 15px sideways, against AC16 (measured: 2545 at 2560, 1425 at 1440, 1280 at 1295 with no sideways scroll, 1265 at 1280 with). And the header's right side sits 15px left of the PNGs and of task 003's positions (bell x 977, search x 1041 to 1393 at 1440), against T29 and AC21 as written. Two e2e tests fail on it: "fills the window from 1280 wide" (T25) and "the header matches the positions measured on 104 and 105" (T29); their expectations wait for #101.
- State at the stop: `npm run typecheck` passes; `npm run lint` passes (after fixing 4 oxlint findings in the new tests); unit tests pass (frontend 41 files, 691 tests; backend 29 files, 355; shared 17 files, 514); `app-shell-slice.spec.ts` 22 of 24 pass, the 2 above fail. The rest of the e2e suite, the visual check, the manual checks, the security review and the code review are not run yet. No Figma calls.

### 2026-10-26, #101 closed, build finished, gate (`/next-task 011`)
- **#101 closed** (Marko, 2026-10-26): (a) option 1, the 1280 minimum includes the scrollbar, a gutter-width token subtracted on `body`; (b) as proposed, the header's right side 15px left of the PNGs with a classic scrollbar, e2e measures it from the page's right edge; the white Logout failure message accepted. Status back to in-progress; AC16, AC17 and AC21 refined in place ("Refined by #101"), References cite #101.
- **Gutter token**: first `--size-scrollbar-gutter: calc(100vw - 100%)` (as proposed in #101). The e2e passed, but the visual step in headed Chromium (classic scrollbars) measured `100vw` without the gutter (1905 at 1920), so the token was 0 and a 1280 window still scrolled 15px sideways. Headless Chromium hides scrollbars yet reserves the gutter and counts it in `100vw`, which hid the problem. No CSS length gives the window width with its scrollbar, so the token is now the measured constant **15px** (source in tokens.md: decision #101). Consequence for the gate: where no scrollbar takes space (macOS overlay scrollbars; an auth page that fits the window) the minimum page width is 1265, not 1280.
- **Gutter scope**: the rule moved from `html:has(.layout)` in `AppLayout.module.css` to `html:has(.shell)` in a new `AppShell.module.css` (a `display: contents` wrapper in `AppShell`). Found by the full e2e: the dev gallery and popup pages render `AppLayout` too and got the gutter, moving the task 003 and 005 position checks 15px; #100 says app pages only. The gutter test now also asserts `auto` on `/dev/components`.
- **Logout race** (found in manual check 5, headed): Overview > Goals > Logout opened `/login?returnTo=%2Fgoals`. Cause: `RequireAuth` re-rendered after the logout mutation (`gcTime: 0`) was collected, once the shell had unmounted but before Login had opened; `<Navigate>` re-ran with the new target. Reproduced deterministically with a slow (lazy) Login route (T30, red first); fixed in `RequireAuth`, which now keeps the Login path it chose when the session ended (React's adjust-state-during-render pattern). Headed re-check: 5 of 5 runs to exactly `/login`.
- **Older tests changed by this task** (none weakened, the reviewer agreed): `e2e/tests/login.spec.ts` and `sign-up.spec.ts` expect Back to land on `/overview` (`/` redirects, #39); `forgot-password.spec.ts` and `sign-up.spec.ts`: the "form never shows" observer ignores `input[type="search"]` (the header search of the Overview they open); `foundation.spec.ts` opens `/` signed in, so no 401 console error, and checks it lands on Overview.
- **Validation** (final run after all fixes):
  1. `npm run lint` exit 0, `npm run typecheck` exit 0.
  2. `npm test`: shared 17 files 514 tests, backend 29 files 355, frontend 41 files 693, all passed.
  3. `npm run e2e`: 104 passed (2.2m).
  4. Visual: `.claude/tasks/evidence/011/visual-differences.txt` and `compare-1xx-*.png`: sidebar mean difference 0.6 on all nine screens (avatar excluded), Active item ink identical to each PNG, header right side 2.1 when shifted 15px (5.3 unshifted). Differences: the 15px gutter shift (#101 b), the date (#11), the initials avatar (#38), the page tone (#F3F3F3 vs #F4F5F7), on 104 the "»" 1px left and the greeting 1px higher (Inter Variable, task 003), text anti-aliasing, the empty content area.
  5. Manual: `manual-checks.txt` (sign up and navigation, `/settings`, Back and Forward, keyboard, gutter and scroll restoration, sizes, Logout, `/` and unknown URLs, backend stopped: date kept, Logout failure message, restart and logout).
- **Security review** (`evidence/011/security-review.md`): no findings at or above the bar. Checked: the endpoint behind `SessionGuard` with no user data; `X-Time-Zone` validated and canonicalised, never echoed, used only in `Intl`; logout on client and server; redirects to fixed paths only; no unsafe HTML sinks, logging or storage.
- **Code review** (requesting-code-review): "With fixes"; no Critical.
  - Important, fixed: Logout while the browser is offline paused silently (TanStack's default `networkMode: 'online'`): no message, Logout stayed disabled, against #100 (c). Now `networkMode: 'always'`; T31 unit and e2e tests, each watched failing without the fix.
  - Minor, fixed: T25 expectations exact also without a gutter (page = max(viewport, 1265)); the Login test comment; `type Logout` renamed `LogoutState`; the e2e spec uses `signUp(page.request)` from `helpers.ts` instead of its own copy; this Log, the T25 and T29 rows (T30, T31 added) and Metrics updated.
  - Minor, declined: an e2e assertion that the search ends at the same x on a scrolling and a non-scrolling page (AC18's last sentence). The e2e browser's real scrollbars take 0px, so it would pass with or without the gutter and catch nothing; `scrollbar-gutter: stable` is asserted, and manual check 3 measured 1393 on both pages with classic scrollbars.
  - Raised for the gate: the 1265 minimum where scrollbars take no space, which also matters to the screen tasks from 013 (content area at least 985px).
- Status `awaiting-human`. No Figma calls.

### 2026-10-26, gate
- Approved by human (Marko, `/approve-task 011 approve`), with the constant 15px gutter token and its 1265 minimum where scrollbars take no space as reported.

## Metrics
- Started: 2026-10-26 09:08
- Finished: 2026-10-26 10:37
- Human interventions: 2 (#101 raised and stopped the build, answered by Marko the same day; approval at the gate)
- Rework loops: 3 (validation step 3: 11 older e2e tests, the gutter on dev pages and `/` as a page; step 4: the gutter token computed 0 in headed Chromium; step 5: Logout opened Login with a return target)
- Notes on prompts that failed: the #101 proposal's formula, `calc(100vw - 100%)`, works only where `100vw` counts the gutter (the headless e2e browser); headed Chromium leaves it out. Measure in a headed browser with classic scrollbars before proposing CSS that depends on scrollbar width.
