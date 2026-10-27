# Security review, task 015 (2026-10-27)

Run with the `security-review` skill on the uncommitted changes. The skill's own diff was empty for uncommitted work, so
the new files were marked intent-to-add (`git add -N`, nothing staged) and the identification sub-task read
`git diff HEAD` (40 files). Step 2 (false-positive filtering) had nothing to filter.

## Result: no findings

No vulnerability at the HIGH or MEDIUM bar (confidence 8 or more). What was checked:

1. **Guard coverage of `GET /api/bills/upcoming`**: `SessionGuard` is global (`APP_GUARD` in
   `backend/src/auth/auth.module.ts:32`). It skips only handlers or classes marked `@Public()`
   (`session.guard.ts:22`), and `BillsController` has none. Without a valid session it answers 401.
2. **User scoping and IDOR**: the controller takes no `@Param`, `@Query` or `@Body`. The user comes only from
   `@CurrentUser()`, which reads what the guard stored (`current-user.decorator.ts:4-21`). The query is
   `where: { userId, dueDate: MoreThanOrEqual(today) }` (`bills.service.ts`), so a `userId` in the URL changes
   nothing, and there is no route that takes an ID (T5 tests both).
3. **SQL injection**: the query is TypeORM `find` with bound parameters. `today` is built by `todayIn` from numbers
   (`toISOString().slice(0, 10)`), never header text. The order is constant, and there is no raw SQL.
4. **`X-Time-Zone` header**: `parseTimeZone` rejects a missing header, a value outside its regex, or a zone that
   `Intl.DateTimeFormat` does not accept, with 400. The value is used only as an Intl `timeZone`. The most it can do is
   move "today" by about a day within real zones, which is the intended behavior (#54).
5. **Response shape**: each row is mapped explicitly to `{ title, logo, dueDate, lastChargeDate, amount }`. `id`,
   `userId`, `user` and `description` are never sent, and no relation is loaded. The contract schema has the same
   keys, and T4 checks the keys.
6. **XSS**: the title and the dates are React text and attributes, so React escapes them. There is no
   `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `frontend/src` or `shared/src`. The logo comes from a fixed
   `Record<BillLogo, ReactNode>`, and the `<img src>` is the bundled URL, never server data.
7. **`FigmaWordmark.svg`**: four `<path>` elements only, with no script, event handler, `foreignObject` or external
   reference. It is static, inlined at build time by the existing SVGR plugin, and adds no dependency.
8. **Frontend client**: the existing `apiRequest`, same origin, on the contract's fixed path.

Test-only files (`backend/test`, `frontend/test`, `shared/test`, `e2e`), CSS, tokens and docs were excluded by the
skill's rules.
