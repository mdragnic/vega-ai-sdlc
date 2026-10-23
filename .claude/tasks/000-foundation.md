# Task 000: Foundation

- Status: done
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

### 2026-10-23, step 1 (stop for approval)
- All decisions the task cites (#4 #5 #13 #45 #54 #65 #66 #70 #73 #74 #79 #80) are closed. Every package in `docs/stack.md` exists on npm at its listed version.
- Approved by Marko: `unplugin-swc` 2.0.0 and `@swc/core` 1.16.18 (backend, dev; the SWC plugin for backend Vitest). Companions: `react-dom` 19.3.1, `react-is` 19.3.1 (Recharts peer), `@nestjs/common` and `@nestjs/core` 12.2.0, `reflect-metadata` 0.2.2, `rxjs` 7.8.2, `@testing-library/dom` 10.4.2, `@types/node` 24.19.2, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@types/express` 5.0.6, `@types/supertest` 7.2.1, `@types/better-sqlite3` 9.6.0. Also approved: the Chromium download and the Google sign-in assets zip.
- Approved: the single `get_variable_defs` call on `56:1396`. If the server requires `create_session` first, stop and report.
- Change by Marko: the machine has Node 24.20.0 and npm 11.19.0, not 24.22.1 and 11.19.1. Stay on them: `engines` `>=24.20.0 <25`, `packageManager` `npm@11.19.0`, the same in README. Updated `docs/stack.md` (Runtime) and decision #79 to match. Scope step 2 and step 23 of this task still name 24.22.1 and 11.19.1; this entry overrides them.
- Not added: `cross-env` (NODE_ENV comes from Playwright `webServer.env` and the Vitest config), `wait-on` (Playwright waits on the ports), `dotenv` (`process.loadEnvFile`).

### 2026-10-23, steps 2 to 6 (scaffold)
- Workspaces `shared`, `backend`, `frontend`, `e2e`, all ESM, every version exact. Written by hand, no scaffolders.
- Install issues and decisions:
  - `npm install` failed with ERESOLVE inside the optional peers of `@hookform/resolvers` 6.0.0 (`effect` ^4 against ^3 through `@typeschema/main`; none of them is installed). Added `legacy-peer-deps=true` to `.npmrc`, with a comment. Every peer the repo needs is a direct dependency.
  - npm 11 `allowScripts` blocked the install scripts of `better-sqlite3` (native binary) and `@swc/core`. Approved both with `npm install-scripts approve`, which wrote `allowScripts` into the root `package.json`. Both native modules load.
  - `zod` 4.6.7 (named in `docs/stack.md`) is also a dev dependency of `backend` and `frontend`, for schemas defined inside tests.
  - `npm audit`: 5 high, all `braces` (stack-exhaustion DoS on crafted glob patterns) through `stylelint` 17.16.0's `globby`. Dev tool on our own files; the only fix npm offers is downgrading stylelint to 7.7.0. Left as is.
- shared: error schema `{ message, fieldErrors? }` (field errors one message per field) and the `ContractEntry` type; `path` is relative to `/api`. Built with `tsc`, watch under `dev`. T1 (exact versions) lives in `shared/test` because it covers every workspace.
- backend: Nest 12 ESM, Express, `/api` prefix, `StandardSchemaValidationPipe` as `APP_PIPE` (issues mapped to `fieldErrors`), `ApiExceptionFilter` as `APP_FILTER` (500 is a generic message, details only in the log). TypeORM over better-sqlite3, `synchronize: false`, entity and migration globs from `dist/`. `readConfig` is the only reader of env vars; `backend/.env` through `process.loadEnvFile`. `npm run migrate` passed on a fresh database ("No migrations are pending"). `start:e2e` resets `finebank.test.sqlite` and applies the migrations before starting.
- T9 note: Vite 8's Oxc transformer also emits decorator metadata from the tsconfig, so T9 passes without SWC too; it fails with Oxc metadata switched off, so it does test metadata. SWC stays as the task and `docs/stack.md` require.
- frontend: Vite on :5173 with the `/api` proxy, React Router data mode, TanStack Query provider, SVGR (`dimensions: false`), Inter imported once, typed client (`apiRequest`, throws `ApiError` with the parsed error shape). Root page styling waits for tokens (step 10).
- e2e: Chromium only at 1440x1024, `constants.ts`, fixture with `timezoneId` and `page.clock`, `webServer` for backend and frontend with `NODE_ENV=test`. First run: servers start, T13 fails only because the unstyled `<main>` has no height (expected until step 10).
- Tests so far: shared 10, backend 12, frontend 4, all passing.

### 2026-10-23, step 7 (Figma call): STOPPED
- Made the single `get_variable_defs` call on `56:1396` (no `create_session`, no `whoami`). It failed: "You currently have nothing selected. You need to select a layer first before using this tool." (Figma Debug UUID `7bba5c54-be9b-4028-b2c4-e9ccca29bf6f`). Not retried, as step 7 says. Logged in `docs/figma/inventory.md` (call 4) and `docs/metrics.md`.
- Likely cause: `56:1396` is a page (canvas), not a layer, and the tool resolves variables for a layer subtree. Waiting for Marko's decision.

### 2026-10-23, steps 7 to 9 (tokens): STOPPED for review
- Marko chose option 1: one `get_variable_defs` call on frame `418:6459` (Typography & Color); if it returns no effects, measure shadows from the PNGs; if it fails, stop. Decision #65 updated with the retarget. Human interventions +1.
- Call 5 succeeded: 12 color variables, 10 text styles (Inter), no effects. Logged in `docs/figma/inventory.md` and `docs/metrics.md` (5 calls used this month).
- Measured from the PNGs with a scratch Node script (built-ins only, outside the repo): color runs along rows and columns, a circle fit for corner radii, and a least-squares Gaussian fit for shadows.
- `docs/figma/tokens.md` written: 95 tokens (15 color, 25 typography, 17 spacing, 21 size, 9 radius, 5 border, 3 shadow), plus a list of colors seen in the PNGs that have no Figma source, kept out of the tokens until decided.

### 2026-10-23, token review by Marko (before step 10)
- Approved with corrections, applied to `docs/figma/tokens.md` (now 104 tokens). Human interventions +1.
  - `--border-width-auth-divider` 1px, not 0.5px.
  - Section title gap: both kept, `--space-section-title-gap` 8 (104) and new `--space-section-title-gap-lg` 16 (105).
  - Page background: Gray/06 (the PNGs show `#F4F5F7`). Popup input border: Special/BG.
  - New measured color tokens: `--color-form-label` `#191D23`, `--color-input-active` `#4B5768`, `--color-input-border` `#D0D5DD`, `--color-button-secondary` `#E4E7EB`, `--color-auth-divider` `#CACED3`, `--color-default-black-15`, `--color-logout-bg` `#262626`, `--color-chart-grid` `#F6F6F6`.
- Note for the gate: `#F6F6F6` was measured on the Expenses Breakdown cell dividers, not on a chart. The Statistics chart grid lines are Gray/06 `#F3F3F3` (PNG 104, x 2200, y 1022 to 1311). The token keeps the approved name `--color-chart-grid`, and its source says where it was measured.

### 2026-10-23, steps 10 to 23
- Step 10: `frontend/src/styles/tokens.css` generated from `tokens.md` (104 tokens, one `:root` rule; scratch generator, not in the repo). T3 keeps both equal. `global.css` and the root page use Gray/06 and Inter. `tokens.css` is excluded from Prettier, which would lowercase the Figma hex values.
- Step 11: `frontend/stylelint.config.js` with `stylelint-declaration-strict-value`, covering every property the step lists plus `letter-spacing`, `flex-basis` and `text-shadow`.
  - `ignoreFunctions: false`, so raw `rgb()` and `calc()` are rejected; only `var()` and the listed keywords pass.
  - `font` takes only a `var(--font-…)` text style token (core `declaration-property-value-allowed-list`), because the plugin cannot expand `size/line-height`.
  - `var()` fallbacks are rejected.
  - Outline is checked as `outline-width` and `outline-offset` (color through `/color$/`), because `outline-style` keywords like `solid` cannot be tokens.
  - Not covered yet (decide when a screen needs them): `grid-template-*`, `flex` sizes inside `calc()`, `transform`, `filter`, `background-image`.
- Step 12: `frontend/src/assets/logo.svg`, `fill="white"` becomes `currentColor`, exported as `Logo` (SVGR) from `src/assets/index.ts`.
- Step 13: 43 icons in `frontend/src/assets/icons/<CodeName>.svg`, exported by code name from `icons/index.ts`.
  - Every `fill` and `stroke` outside `<mask>` is `currentColor`; `Menu/Payment` keeps its mask values.
  - `NotificationIcon`: both bell paths `currentColor`, dot `style="fill: var(--color-primary)"`. The export has no ring element; its white fill was a `<clipPath>` rect, which also became `currentColor` (it is never painted).
  - `chevron-right-1` and `Search-1` are byte-identical to `chevron-right` and `Search`.
  - Icons in `components.md` without an exported file: none. All 44 Figma icons have a file; the two Search icons share `SearchIcon`.
  - Original colors replaced, for later screen tasks: Up arrow was `#FA0F00` and Down arrow 16 `#71EF9C` (not Special/Red and Special/Green). Both now take their color from CSS.
- Step 14: Mastercard, Visacard, Figma and Adobe copied unchanged to `frontend/src/assets/brand/` and exported as image URLs. Vite inlines the small ones as `data:` URLs.
  - Google G source: https://developers.google.com/static/identity/images/signin-assets.zip, linked from https://developers.google.com/identity/branding-guidelines. File used: `Android + Web/SVG/Neutral/Theme=Neutral, Show text=No, Shape=Square, Platform=Android+Web.svg`, with the `#F2F2F2` button background path removed and the viewBox cropped to the 20x20 G (`10 10 20 20`).
  - The guidelines now require "the standard color gradient super G logo", and the bundle has no classic four-color G. So `Google.svg` is the gradient G, while PNG 101 shows the classic G. This is a visual difference from Figma, for the gate.
- Steps 15 to 17: CLAUDE.md rule for `Relation<T>`. `npm run migrate` and `npm run migration:generate -- <Name>` build first and run the TypeORM CLI on `dist/database/data-source.js`.
  - Checked with a throwaway entity: it generated `src/database/migrations/<ts>-ProbeTable.ts`, and `migrate` applied it on a fresh database. Without entities, TypeORM reports "No changes in database schema were found". The probe entity, migration and database were removed afterwards.
  - Generated migrations are excluded from Prettier (TypeORM's own formatting).
  - Backend Vitest uses `unplugin-swc`.
- Step 18: `CLOCK` token, `SystemClock`, and with `NODE_ENV=test` a `FixedClock` from `TEST_NOW`. `TEST_NOW` must be ISO UTC with `Z`; it defaults to the e2e `FIXED_NOW`, and a test keeps the two equal. `TestClockController` (GET and PUT `/api/test/clock`, contract in `shared/src/contract/test-clock.ts`) is registered only in test mode.
- Step 19: `@TimeZone()` decorator. Only IANA names pass (canonicalized through `Intl`); a missing value, an offset or an unknown zone gives 400 with the shared shape.
- Steps 20 to 23: `.gitignore` stack section appended (base kept). Root scripts `dev`, `build`, `lint`, `format`, `typecheck`, `test`, `e2e`, `migrate`, `migration:generate`. CLAUDE.md Commands, Structure and the three rules. New README.
- Changes outside the listed files, needed by the tooling: root `.oxlintrc.json`, `.prettierrc.json` (`endOfLine: auto`), `.prettierignore`, `tsconfig.base.json`.
- Other fixes during the build:
  - Vite's optimizer reloaded the page when the client module first pulled in `zod`, which broke T15. Fixed with `optimizeDeps.entries` over all sources; the cause was confirmed in the Vite log.
  - Under jsdom, Node's `readFileSync` rejects jsdom's `URL` class, so tests use `import.meta.dirname`.
  - MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`.

### 2026-10-23, code review (superpowers:requesting-code-review)
Verdict "with fixes". Fixed, each test-first:
- Critical: `core.autocrlf=true` would check the new files out as CRLF, which breaks `prettier --check` and T3. Fixed with Prettier `endOfLine: auto` and a T3 parser that accepts CRLF, both with tests. A root `.gitattributes` (`* text=auto eol=lf`) would be the cleaner fix, but the task does not list it: for the gate.
- Important: the Stylelint `font` shorthand and `var()` fallbacks let raw values through. Fixed, with new T2 fixtures (step 11 above).
- The exception filter answered body-parser 413 with 500. It now passes 4xx `http-errors` through (413 and 400 tests).
- `TEST_NOW` without a zone was read in local time; it is now rejected.
- T8 now also catches `new Date` without parentheses and a bare `Date()`.
- T3 rejects anything besides the `:root` rule.
- A new test fails on unknown tokens used in frontend CSS.
- The e2e fixture resets the backend clock before every test; a new test proves a moved clock does not leak.
- The backend listens on 127.0.0.1 only, and the Vite proxy targets 127.0.0.1:3000.
- Stale line in `docs/figma/inventory.md` updated.
Not changed, for the gate or later tasks:
- `legacy-peer-deps=true` needs Marko's sign-off. `npm ls --all` shows `ajv-formats@3.0.1 invalid` against an unused optional peer of `@hookform/resolvers`.
- Entity and migration globs load only compiled `.js` from `dist/`. Under Vitest none load, so `reset-database.test.ts` will not run real migrations once they exist. For task 007: list entity and migration classes explicitly.
- SVG ids are not prefixed. They are unique per icon; a repeated icon repeats its ids (same content). Prefixing needs `@svgr/plugin-svgo`, a new dependency.
- `docs/spec/brief.md:124` still names `56:1396` for the token call. It is spec text, so Marko's call.
- Added tests so every acceptance criterion maps to a test: AC6 (every token has a source; measured sizes are on the 4px grid, borders excepted) and AC13 (`backend/data/` ignored with the base `.gitignore` kept; `.env.example` lists every variable the backend reads). Both were checked to fail when their input is broken.

### 2026-10-23, validation (final run on the finished tree)
- Rework loop 1, step 1: `npm run lint` failed on `unicorn(consistent-function-scoping)` in `frontend/test/styles/tokens.test.ts` (a helper added in the review round). Moved to module scope.
- Step 1: `npm run lint` exit 0 (oxlint type-aware 0 warnings, Stylelint, Prettier). `npm run typecheck` exit 0 in all four workspaces.
- Step 2: `npm test` exit 0: shared 10, backend 43, frontend 183 (236 tests), no warnings in the output.
- Step 3: `npm run e2e` exit 0, 4 of 4 (T13, clock reset, T14, T15) with a cleared Vite cache.
- Step 4: `npm run build` exit 0. `npm run migrate` exit 0 on a fresh `backend/data/finebank.sqlite` ("No migrations are pending").
- Step 5: all 38 packages in `docs/stack.md` at their listed versions, plus `unplugin-swc` 2.0.0 and `@swc/core` 1.16.18. `npm ls` exit 0. Runtime Node 24.20.0, npm 11.19.0. Evidence: `evidence/000/stack-versions.txt`, `evidence/000/versions.txt`.
- Step 6, visual:
  - `evidence/000/root-1440x1024.png`: Gray/06 page, Inter, no other content. No designed screen to compare with.
  - `evidence/000/icon-sheet-1440x1024.png`: all icons and the logo in two token colors; brand logos in their own colors.
  - Differences from the PNGs: the page background is `#F3F3F3`, where the PNGs show `#F4F5F7` (decided in review); the Google G is the gradient G, where 101 shows the classic G.
- Step 7, manual (Playwright MCP under `npm run dev`):
  - `/` loads with 0 console errors and 0 warnings.
  - An API call through the client goes to `localhost:5173/api/test/clock` with `x-time-zone: Europe/Belgrade`. It returns 404 `{ message }` because the test route does not exist in development, as intended; the only console error is Chrome logging that 404.
  - After the review, rechecked with `npm run dev`: the backend listens on `127.0.0.1:3000`, and the proxy returns the backend's JSON 404.
- `npm run format` changes no files. Every command in CLAUDE.md was run in this task.

### 2026-10-23 12:14, rejected by Marko (`/approve-task 000 reject`)
Human interventions +1, Rework loops +1. Feedback, verbatim:

> 1. Add root .gitattributes with "* text=auto eol=lf" and renormalize line endings (git add --renormalize .). 2. Keep legacy-peer-deps=true. 3. Rename --color-chart-grid to --color-divider-light in tokens.md, tokens.css and every use. 4. Accept the official gradient Google G; note in the Log that it differs from 101 by Google's brand rules. 5. Update docs/spec/brief.md line 124 to name frame 418:6459, per the update to #65. Re-run all validation, then stop at the gate again.

Done, only what the feedback asks:
1. Root `.gitattributes` contains `* text=auto eol=lf`, and `git add --renormalize .` ran (exit 0).
   - Every tracked text file is LF in the index (`git ls-files --eol`: `i/lf`).
   - The command staged the 10 modified tracked files. Untracked files are not staged; nothing is committed.
   - Older checkouts keep CRLF working copies until the next checkout, which Git compares as equal. `.gitignore`, mixed after the earlier append, was made LF in the working tree.
   - The CRLF tolerance in Prettier (`endOfLine: auto`) and in T3 stays as it was.
2. `legacy-peer-deps=true` stays in `.npmrc`, approved by Marko.
3. `--color-chart-grid` renamed to `--color-divider-light` in `docs/figma/tokens.md` (token row and review list) and `frontend/src/styles/tokens.css`. No CSS used the token yet. Earlier Log entries keep the old name as history.
4. The official gradient Google G is accepted. It differs from the classic four-color G in PNG 101 because Google's sign-in brand rules require "the standard color gradient super G logo" (https://developers.google.com/identity/branding-guidelines).
5. `docs/spec/brief.md` line 124 names the Typography & Color frame `418:6459` instead of the components node `56:1396` (decision #65).

Validation, re-run in full after the fixes:
- Step 1: `npm run lint` exit 0, `npm run typecheck` exit 0.
- Step 2: `npm test` exit 0: shared 10, backend 43, frontend 183 (236).
- Step 3: `npm run e2e` exit 0, 4 of 4, cleared Vite cache.
- Step 4: `npm run build` exit 0. `npm run migrate` exit 0 on a fresh database ("No migrations are pending").
- Step 5: all 38 packages in `docs/stack.md` match, plus the two approved extras; `npm ls` exit 0. Evidence refreshed.
- Step 6: `evidence/000/root-1440x1024.png` and `evidence/000/icon-sheet-1440x1024.png` re-taken, unchanged. In the page, `--color-divider-light` resolves to `#F6F6F6` and `--color-chart-grid` no longer exists.
- Step 7: under `npm run dev`, `/` loads with 0 errors and 0 warnings. A client call goes through `localhost:5173/api/test/clock` with `x-time-zone: Europe/Belgrade` and gets the backend's 404 `{ message }` (no test route in development). The backend listens on `127.0.0.1:3000`.

### 2026-10-23 14:02, approved by human
- Approved by human (Marko, `/approve-task 000 approve`). Human interventions +1.
- On approval steps:
  - `docs/stack.md` deleted.
  - The CLAUDE.md "Stack and versions" line now points to the `package.json` files (root, `frontend/`, `backend/`, `shared/`, `e2e/`).
- Acceptance criteria 15 of 15. AC8 is met through the approved retarget: the call on `56:1396` failed, and the one successful call was on `418:6459` (decision #65 updated); both are logged.
- Left as is: `.claude/commands/plan-tasks.md` still mentions `docs/stack.md`. The On approval steps do not cover command files.

## Metrics
- Started: 2026-10-23 10:23 CEST
- Finished: 2026-10-23 14:02 CEST
- Human interventions: 5
- Rework loops: 2
- Notes on prompts that failed: step 7 call on page `56:1396` failed (get_variable_defs needs a layer); retargeted to frame `418:6459` after approval.
