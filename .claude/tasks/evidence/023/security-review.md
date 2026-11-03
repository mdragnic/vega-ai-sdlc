# Task 023 security review (`security-review`, 2026-11-03)

Run on the task's changes (`git diff HEAD`, the new files intent-to-add so the diff sees them; .claude/ and docs/
left out), after the visual and manual checks, before the gate. One sub-task identified issues; it found none, so no
false-positive sub-tasks ran. Read only: nothing changed, the app not run.

**Result: no findings** (none at confidence 8 or higher, none lower worth reporting).

What was checked, and why each area is safe:

1. **Authentication and user scoping.** `BillsController` takes only `@CurrentUser()` and `@TimeZone()`; no route
   parameter, query or body chooses the user. The global `SessionGuard` (`APP_GUARD`) answers 401 without a valid
   session and records the session's user ID; `@CurrentUser()` reads only that. `BillsService.upcoming` still finds by
   `{ userId, dueDate: MoreThanOrEqual(today) }`; the change only adds `description` to the fields picked from rows
   already scoped to the user.
2. **Injection.** A parameterized TypeORM `find`, no raw SQL, no new input. `today` comes from the injected `Clock`
   and `todayIn`, unchanged.
3. **Data exposure.** Each bill in the response is built from an explicit field list (title, description, logo,
   dueDate, lastChargeDate, amount): no row ID or user ID, no entity spread. The contract adds only
   `description: z.string()`, unknown keys dropped. The description is the user's own seeded demo text; no route writes
   bills.
4. **XSS and code execution.** `BillItem` renders the title, the description and the dates as React text children
   (escaped); the header labels are static. No `dangerouslySetInnerHTML`, `innerHTML` or `eval(` in `frontend/src`. The
   logo `src` comes from the static `billLogos` map, keyed by `logo`, which `billLogoSchema` limits to `figma` or `adobe`
   and the client parses before use: no server URL reaches `src`. (Unit test: markup in a title or description shows as
   text, no element created.)
5. **Test-only fixture routes.** Registered only when `import.meta.env.DEV && import.meta.env.VITE_E2E_FIXTURES ===
   'true'`; a production build replaces `DEV` with `false` and drops the routes and the lazy fixture chunk
   (`gallery-build.test.ts`, also proven by breaking it on purpose, mutation 06). The variable is set only in
   `e2e/playwright.config.ts` (environment variables are trusted). The routes sit inside `RequireAuth` and the shell,
   load no data, and link only to the other hard-coded fixture path.
6. **Secrets and dependencies.** No keys, tokens or credentials added; `vite-env.d.ts` only types the flag; no
   `package.json` change.
7. **Other files.** `BillTable`, `BillTableSkeleton`, the CSS modules, the tokens and the gallery samples are static
   markup and styles; the gallery stays development only.

Fixes needed before the gate: none.
