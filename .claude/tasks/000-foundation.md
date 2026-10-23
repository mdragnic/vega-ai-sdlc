# Task 000: Foundation

- Status: todo
- Gate: human
- Depends on: none
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`

## Goal
An empty app runs on the locked stack as npm workspaces (`frontend/`, `backend/`, `shared/`, `e2e/`). It has reviewed design tokens, the Figma assets as code, an injected Clock, an `X-Time-Zone` skeleton, and every command in CLAUDE.md passing.

## References
- Spec: `docs/stack.md` (versions and the TypeORM-on-ESM notes), `docs/spec/brief.md` Global rules (Viewports, Design system, Money and dates)
- Figma: Components page `56:1396` (Typography & Color `418:6459`, Components `66:1754` and `418:6433`), file key `wZQT9xEAtFjkZtlxvVtpPu`. Screen PNGs in `docs/figma/` are 2880x2048, 2x of the 1440x1024 frames. Measure from `101. Login.png`, `104. Overview.png`, `104.1. Overview.png` and `105. Balances.png` (layered frames, `docs/figma/inventory.md`).
- Assets: `docs/figma/assets/logo.svg`, `docs/figma/assets/icon/`, `docs/figma/assets/icon/Menu/`, names in `docs/figma/components.md`
- Decisions: `docs/decisions.md` #4, #5, #13, #45, #54, #65, #66, #70, #73, #74, #79, #80

## Scope
Work in this order. Two stops are built in (steps 1 and 9).

### Before installing
1. **STOP and ask me** in one message, then wait:
   - Approve every package you will install that `docs/stack.md` does not name, with its exact version and the reason. Companions of listed packages (peer dependencies, `@types/*`, `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs`, `@testing-library/dom`) are listed for information. Packages that are not companions need my approval. One is known already: `docs/stack.md` asks for an SWC plugin for backend Vitest but names no package or version. Propose them.
   - Approve the one Figma call in step 7.

### Scaffold (#73)
2. Root `package.json`: npm workspaces `shared`, `backend`, `frontend`, `e2e`; `"type": "module"` in every package (ESM); `engines` Node 24.22.1 and `packageManager` npm@11.19.1. Every version is exact (`.npmrc` `save-exact=true`), and every package named in `docs/stack.md` gets the version listed there. Scaffolders must not touch `CLAUDE.md`, `.mcp.json`, `.claude/` or `docs/`. If one refuses a non-empty folder, scaffold into a temp subfolder and move the files up. The only edits outside the workspaces are the ones this task lists.
3. `shared/` (`@finebank/shared`): `src/contract/` with the error schema `{ message, fieldErrors? }` and the contract-entry type (method, path, Zod request and response schemas) (#74). No resource contracts yet. Built with `tsc`, in watch mode under `npm run dev`.
4. `backend/`: NestJS 12 ESM with the Express adapter on :3000, global prefix `/api`. `StandardSchemaValidationPipe` is registered globally, and one exception filter turns every error into the shared error shape (#74). TypeORM with better-sqlite3:
   - The database file is `backend/data/finebank.sqlite`, or `backend/data/finebank.test.sqlite` with `NODE_ENV=test`. Uploads go to `backend/data/uploads/`, created at startup if missing.
   - `synchronize` is off outside unit tests. Migrations live in `backend/src/database/migrations/`; there are no entities yet.
   - `backend/.env` is loaded with Node's built-in `process.loadEnvFile` (no new package). `backend/.env.example` is committed and lists every variable the backend reads.
5. `frontend/`: Vite 8 and React 19 on :5173, with the Vite proxy sending `/api` to :3000 (#73). Set up:
   - React Router 8 in data mode, with a root route that renders an empty page frame (page background token and Inter). No sidebar or header.
   - CSS Modules, `@fontsource-variable/inter` imported once, and SVGR.
   - A TanStack Query provider.
   - A typed fetch client, `frontend/src/api/client.ts`. It takes a contract entry, sends `X-Time-Zone` from `Intl.DateTimeFormat().resolvedOptions().timeZone` on every request (#54), and parses the shared error shape.
6. `e2e/`: Playwright config for Chromium only at 1440x1024 (#4, #5). One constants file holds the fixed instant `2026-10-22T10:00:00Z` (the "What a first login shows" date in `docs/spec/demo-data.md`) and the zone `Europe/Belgrade`. A test fixture sets `timezoneId` and installs `page.clock` from those constants (#80). `webServer` starts shared, backend and frontend with `NODE_ENV=test` and waits on ports 3000 and 5173. Every run starts from an empty test database with all migrations applied. No other viewport or browser.

### Tokens (#65)
7. After my approval in step 1, make exactly one `get_variable_defs` call on node `56:1396`. Make no other Figma call, including `create_session` and `whoami`. If the call fails or the server requires another call first, STOP and report; do not retry. Log the call in the Figma call log of `docs/figma/inventory.md` and in the Figma MCP table of `docs/metrics.md`.
8. Colors, typography and effects come from that call. The font family is Inter (#13). A value the call lacks but the Components page labels (list at the end of `docs/figma/components.md`) uses that label, with source "Components page label". Spacing, sizes, radii and shadows not defined there are measured from the PNGs:
   - Halve every pixel measurement (the PNGs are 2x), then round it to the nearest 4px.
   - Exception, for my review: border widths are halved but not rounded, since a 1px line would round to 0.
   - Measure without adding a dependency: for example, Playwright MCP opens the PNG, draws it on a canvas and reads pixels with `browser_evaluate`, or a script in the session scratchpad uses only Node built-ins. No measuring script goes into the repo.
   - Cover at least: page and card padding, gaps between cards and between form fields, sidebar width, header height, auth column width, input and button heights, nav item size, search field size, icon sizes, avatar size; radii of inputs, buttons, cards, nav items, the search field, the popup (104.1), the date box and the amount box; shadows of cards, the search field and the popup; border widths of inputs, dividers and table lines.
9. Write `docs/figma/tokens.md`, one table per group (color, typography, spacing, size, radius, border, shadow). Columns: CSS variable name, value, source (Figma variable or style name, Components page label, or "measured: PNG, element, 2x px, halved"). Names follow the Figma variable or style name in kebab-case. Measured tokens are named by role (for example `--radius-card`). Then **STOP for my review**:
   - Report `tokens.md`, the call log entry and every measurement you are unsure of.
   - Status stays `in-progress`. Resume when I reply in this session or run `/next-task 000`, starting at step 10. Apply my corrections first, add 1 to Human interventions and log the review.
10. Generate `frontend/src/styles/tokens.css` from `tokens.md`: one custom property on `:root` per token, with the same names and values. It is the only file in `frontend/` with raw design values.
11. Stylelint with `stylelint-declaration-strict-value` on all frontend CSS. It requires `var(--…)` for at least: every color property, `fill`, `stroke`, `font-family`, `font-size`, `font-weight`, `line-height`, `margin*`, `padding*`, `gap`, `row-gap`, `column-gap`, `width`, `height`, `min-*` and `max-*` sizes, `inset` and the `top`, `right`, `bottom` and `left` offsets, `border*` widths, `border-radius`, `box-shadow` and `outline*`. Shorthands are expanded. Keywords are allowed: `0`, `auto`, `none`, `inherit`, `initial`, `unset`, `transparent`, `currentColor`, `100%`, `100vh`, `fit-content`, `min-content` and `max-content`.

### Assets (#13, #45, #66, #70)
12. Logo: copy `docs/figma/assets/logo.svg` to `frontend/src/assets/logo.svg`, with every `fill="white"` turned into `fill="currentColor"`. It is used only as an inline SVG component (`Logo`) through SVGR, never through `<img>`.
13. Icons: copy every SVG from `docs/figma/assets/icon/` and `icon/Menu/` to `frontend/src/assets/icons/<CodeName>.svg`, with SVGR components exported by code name from one index.
    - Every `fill` and `stroke` color becomes `currentColor`. Exception: values inside `<mask>` stay as they are, because black and white there are mask values (`Menu/Payment`).
    - Two-tone icons keep their main shape on `currentColor`. Each other color becomes the matching token as `style="fill: var(--…)"`, never a raw hex value (`NotificationIcon`: bell `currentColor`, teal dot and its ring by token).
    - `viewBox` is kept; width and height come from CSS (tokens).
    - Files and code names, checked by viewBox in planning:

      | File | Code name | | File | Code name |
      |------|-----------|-|------|-----------|
      | `arrow-right.svg` (16) | `ArrowRight16` | | `Housing.svg` | `Housing` |
      | `arrow-right-1.svg` (24) | `ArrowRight24` | | `Leftarrow.svg` | `LeftArrow` |
      | `arrow-up-right.svg` | `ArrowUpRight` | | `mdi_achievement-award.svg` | `MdiAchievementAward` |
      | `Arrow down 2.svg` | `ArrowDown2` | | `Movie.svg` | `Movie` |
      | `Award.svg` | `Award` | | `Notification icon.svg` | `NotificationIcon` |
      | `Back arrow.svg` | `BackArrow` | | `octicon_goal-16.svg` | `OcticonGoal16` |
      | `Bill.svg` | `Bill` | | `Others.svg` | `Others` |
      | `chevron-right.svg` (`-1` is identical) | `ChevronRight` | | `Search.svg` (`-1` is identical) | `SearchIcon` |
      | `Clock.svg` | `Clock` | | `separator.svg` | `IconSeparator` |
      | `Down arrow.svg` (24) | `DownArrow24` | | `Shopping.svg` | `Shopping` |
      | `Down arrow-1.svg` (16) | `DownArrow16` | | `Target.svg` | `Target` |
      | `edit.svg` | `Edit` | | `Transaction.svg` | `Transaction` |
      | `Expencces.svg` | `Expenses` | | `Trasnport.svg` | `Transport` |
      | `eye.svg` | `IconEye` | | `Up arrow.svg` | `UpArrow` |
      | `eyeoff.svg` | `IconEyeOff` | | `wallet.svg` | `Wallet` |
      | `Food.svg` | `Food` | | `x.svg` (32) | `X32` |
      | `Frame 39997.svg` | `LogoutIcon` | | `x-1.svg` (24) | `X24` |
      | `gamepad-2.svg` | `Gamepad2` | | `Menu/<Name>.svg` (7) | `Menu<Name>` |
      | `Goal.svg` | `Goal` | | | |

    - Icons listed in `components.md` with no exported file are reported in the Log, not replaced. No icon library is added.
14. Brand logos (`Mastercard`, `Visacard`, `Figma`, `Adobe`) are copied unchanged to `frontend/src/assets/brand/` and used as image URLs. They keep their own colors and are not recolored or inlined; Mastercard and Visacard embed PNG data. The Google icon is not exported, so use the official Google "G" logo SVG from Google's sign-in branding guidelines (#70), saved as `frontend/src/assets/brand/Google.svg`, with the source URL in the Log.

### TypeORM on ESM, from `docs/stack.md`
15. Entity relations use `Relation<T>`. No entities exist yet, so write this as a rule in CLAUDE.md.
16. `npm run migrate` builds the backend and runs the TypeORM CLI against the compiled data source in `backend/dist`, not through ts-node. `npm run migration:generate -- <Name>` works the same way.
17. Backend Vitest uses the approved SWC plugin, so decorator metadata (Nest dependency injection) works in tests.

### Clock and time zone skeleton (#54, #80)
18. `Clock` with `now(): Date` is provided under an injection token. `SystemClock` is the default. With `NODE_ENV=test`, a `FixedClock` starts at `TEST_NOW` (default: the e2e constant). The test-only `GET` and `PUT /api/test/clock` read and move it, and are registered only when `NODE_ENV=test`. Backend code reads "now" only through `Clock`.
19. A `TimeZone` parameter decorator reads `X-Time-Zone` and accepts only a valid IANA zone name. A missing or invalid value returns 400 with the shared error shape. Only endpoints that need the zone use it (the later Google callback is a browser redirect and has no header).

### Repo files
20. `.gitignore`: keep the existing content and append a stack section: `node_modules/`, `dist/`, `backend/data/`, `coverage/`, `test-results/`, `playwright-report/`, `blob-report/`, `*.tsbuildinfo` and tool caches. Merge any generated `.gitignore` into it, never replace it.
21. Root scripts (#73): `dev` (concurrently: shared watch, backend :3000, frontend :5173), `build`, `lint` (oxlint type-aware, Stylelint, Prettier check), `format`, `typecheck`, `test` (Vitest in every workspace), `e2e`, `migrate`, `migration:generate`.
22. CLAUDE.md:
    - Fill Commands and Structure with the real values.
    - Add to "Rules you would otherwise get wrong": TypeORM relations use `Relation<T>`; migrations run from the compiled data source (`npm run migrate`); the backend reads "now" only from `Clock`, and the test-only clock route exists only with `NODE_ENV=test`.
    - Change nothing else.
23. `README.md`: replace the template completely with an app README. It covers what Finebank is (desktop only, 1440x1024), prerequisites (Node 24.22.1, npm 11.19.1), install, `backend/.env` from `.env.example`, dev, migrate, test, e2e and build.

## Out of scope
- Every screen, the app shell (sidebar, header) and every shared component, tasks 002 to 006. The dev component gallery, task 002.
- Display formatters and the money schema (task 001).
- Entities, tables, auth and sessions (tasks 007, 008).
- Any Figma call besides the single `get_variable_defs` on `56:1396`.
- Mobile or tablet viewports (#4). Icon libraries (Lucide) and replacements for missing icons.

## Acceptance criteria
1. Every dependency in every `package.json` has an exact version, and every package named in `docs/stack.md` is installed at the version listed there. Packages not named there were approved in step 1.
2. `npm run dev` starts shared, the backend on :3000 and the frontend on :5173. http://localhost:5173 renders the root page, and `/api` requests from the page reach the backend through the Vite proxy (one origin).
3. `npm run lint`, `typecheck`, `test`, `e2e`, `build` and `migrate` all exit 0.
4. Stylelint rejects raw colors, sizes, spacing, radii and shadows in frontend CSS and accepts `var(--…)` and the listed keywords.
5. E2E runs only on Chromium at 1440x1024, with the browser zone and clock fixed from one constants file.
6. `docs/figma/tokens.md` gives a source for every token. Measured values are halved from the 2x PNGs and sit on a 4px grid (border widths excepted). I reviewed it before `tokens.css` was generated, and the Log says so.
7. `tokens.css` holds exactly the tokens in `tokens.md`, with the same names and values.
8. Exactly one Figma MCP call was made (`get_variable_defs` on `56:1396`), and it is logged in `inventory.md` and `metrics.md`.
9. The logo and every exported icon render as inline SVG that takes its color from CSS `color`. No raw color remains in them except mask values; two-tone icons use token variables. Brand logos, the Google G included, keep their own colors and are image assets.
10. The backend reads "now" only from the injected Clock. With `NODE_ENV=test` the time is fixed and can be read and moved through the test clock route, which does not exist without `NODE_ENV=test`.
11. Every frontend API request sends `X-Time-Zone` with the browser's IANA zone. An endpoint that reads it rejects a missing or invalid value with 400 and the shared error shape.
12. An unknown `/api` route returns 404 with the shared error shape.
13. The SQLite files and uploads live in `backend/data/`, which is gitignored. `backend/.env.example` is committed and lists every variable the backend reads. `.gitignore` keeps its base content.
14. Backend unit tests run Nest classes with decorator metadata (dependency injection by type).
15. The Commands and Structure sections in CLAUDE.md are filled and every listed command works. `README.md` describes the app.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | Every `package.json` in the repo | No version starts with `^`, `~`, `*`, `>` or is a tag | 1 |
| T2 | unit | Stylelint on fixture CSS: `#fff`, `padding: 12px`, `border-radius: 8px`, a raw `box-shadow`, `border: 1px solid red` | Each is rejected; the same rules with `var(--x)` and `0`/`auto`/`100%` pass | 4 |
| T3 | unit | Parse `tokens.md` and `tokens.css` | Same token names, same values, no extras on either side | 7 |
| T4 | unit | Shared error schema | Accepts `{message}` and `{message, fieldErrors}`; rejects a missing `message` | 11, 12 |
| T5 | unit | API client with MSW, `Intl` zone mocked to `America/New_York` | Request carries `X-Time-Zone: America/New_York`; a 400 body is returned as the parsed error shape | 11 |
| T6 | unit | `TimeZone` decorator on a test-only controller: `Europe/Belgrade`, no header, `Mars/Base` | 200; 400 with `{message}`; 400 with `{message}` | 11 |
| T7 | unit | Clock with `NODE_ENV=test` and `TEST_NOW` set; with `NODE_ENV=development` | Fixed instant; system time. The test clock route returns 404 without `NODE_ENV=test` | 10 |
| T8 | unit | Search `backend/src` for `Date.now(` and argument-less `new Date()` outside the clock files | None found | 10 |
| T9 | unit | Nest testing module injects a service into another by type | Dependency resolved (decorator metadata works) | 14 |
| T10 | unit | Supertest `GET /api/does-not-exist` | 404 with `{message}` | 12 |
| T11 | unit | Each icon component and `Logo` | Renders `<svg>` with a viewBox; no hex, `white` or `black` color outside `<mask>`; takes the parent's `color` | 9 |
| T12 | unit | Frontend smoke: render the router at `/` | Root page renders with no errors | 2 |
| T13 | e2e | Open `/` at 1440x1024 | Page loads, no console errors, body background equals the page background token | 2, 5 |
| T14 | e2e | Fixed time and zone | In the page `Date.now()` equals the constant and the zone is `Europe/Belgrade`; `GET /api/test/clock` returns the same instant | 5, 10 |
| T15 | e2e | Page calls `GET /api/test/clock` through the API client | Request goes through the Vite proxy with `X-Time-Zone: Europe/Belgrade` and returns 200 | 2, 11 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass.
2. Unit tests pass.
3. E2E tests pass.
4. `npm run build` passes, and `npm run migrate` passes on a fresh database file.
5. Version report: each package in `docs/stack.md` with its installed version (`npm ls --depth=0 --workspaces`), plus every approved extra package.
6. Visual: Playwright MCP screenshot of `/` at 1440x1024 (background and font only; no designed screen to compare). Also an icon sheet: a scratch HTML page outside the repo that renders the logo and every icon in two token colors and every brand logo, screenshot at 1440x1024. Save both to `.claude/tasks/evidence/000/`.
7. Manual checks with Playwright MCP: open http://localhost:5173 under `npm run dev`, check the network panel for `X-Time-Zone` on an API call and the console for errors.

## Human checkpoint (only if Gate: human)
- Workspace layout, scripts, and the extra packages approved in step 1 as installed.
- `tokens.css` matches the reviewed `tokens.md`.
- Icon sheet: icons and logo recolor, brand logos keep their colors, Google G is the official logo.
- Clock and `X-Time-Zone` skeleton, including the test-only clock route.
- CLAUDE.md Commands, Structure and the added rules; `README.md`.

## On approval
Before the approval commit (`/approve-task 000 approve`):
1. Delete `docs/stack.md`.
2. In CLAUDE.md, change "Stack and versions: `docs/stack.md`, then `package.json`." to point to the `package.json` files (root, `frontend/`, `backend/`, `shared/`, `e2e/`).

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
