# Task 027: security review

2026-11-04, `security-review` on the task's uncommitted changes (`git diff HEAD`, the new files intent-to-add, `.claude/` and `docs/` left out). One review sub-task read the diff and the codebase's security model. Its findings would then go through the false-positive filter, which keeps only findings at confidence 8 or more. The review found nothing, so nothing reached the filter. The wiring citations (the guard, the pipe, CSRF) were checked again by hand afterwards.

## Findings

None. No HIGH or MEDIUM finding had a concrete exploit path, and nothing needed fixing.

## What was checked

1. **The user comes from the session only.**
   - Both handlers take the user from `@CurrentUser()` (`backend/src/goals/category-limits.controller.ts`, `list` and `save`), which only `SessionGuard` fills.
   - The request schema has no user field, and `z.object` drops unknown keys (`shared/src/contract/category-limit.ts`, `categoryLimitRequestSchema`).
   - The service never reads a user from a request.
   - Tested: a `userId` in the body or the query changes or reads nothing of another user (`backend/test/category-limits.test.ts`). Break 2 proves that test catches it.
2. **The session guard and the write guard cover both routes.**
   - `SessionGuard` is the global `APP_GUARD` (`backend/src/auth/auth.module.ts:32`). The controller is not `@Public()`; only the auth, Google and test-clock controllers are.
   - The PUT is not a read method, so the #119 expected-user check runs before the handler (`backend/src/auth/session.guard.ts:44-45`).
   - Tested in `write-guard.test.ts` (400 without the header, 409 for another user, the stale tab). Break 4 proves those tests catch a skipped guard.
3. **CSRF covers the PUT.** Nest's protection is app-wide (`backend/src/app.setup.ts:15`). The cross-site cases are in `csrf.test.ts` (403, nothing stored).
4. **Validation runs before the service, so a refused body stores nothing.**
   - The global `APP_PIPE` is `StandardSchemaValidationPipe` (`backend/src/app.module.ts:41-42`), and the PUT reads `@Body({ schema: categoryLimitsContract.save.request })`, as the goal PUT does.
   - Tested: every broken limit and every category outside the six answers 400 with no row changed or added for any user (T6, T7).
5. **No unexpected category reaches SQL.**
   - The category is `z.enum(expenseCategorySchema.options)`, so only the six values pass. The entity column is a `simple-enum` of the same values.
   - Every query goes through TypeORM's parameterized `findBy`, `upsert` and `findOneByOrFail`. There is no raw SQL.
6. **The amounts.** The limit goes through `goalTargetSchema`: integer cents in USD, above 0, at most 100,000,000,000, its keys re-picked. The table's `CHECK ("limit_cents" > 0)` is a second layer (task 008). Break 3 proves the tests catch a loosened rule.
7. **No cross-user read or write.**
   - The list is one `findBy({ userId })`.
   - The upsert's conflict target is (`userId`, `category`), the table's unique key, with the session user inserted, so a conflict can only hit that user's own row. The read-back is keyed on the user and the category.
   - No route takes an ID or a path parameter, and the 404 cases are tested.
   - Break 1 proves the tests catch a read that drops the user condition.
8. **The responses carry only the contract's keys.** The list sends `{ limits: [{ category, limit }] }` and the save sends `{ category, limit }`: no row ID, no user ID, no entity. Tested on the raw body (T5, T6).
9. **No XSS.** The frontend diff has no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or dynamic `href` or `src`. The cards and the popup render text through React.
10. **The frontend writes through the shared write path.**
    - `useSaveCategoryLimit` uses `useUserWrite` (`frontend/src/api/category-limits.ts`), which sends `X-Expected-User` through `sendWrite` and drops a late answer after a session end (`sessionEpoch`).
    - Tested: a logout, a 401 and a user switch while a save is held (T17). Checked manually with two tabs (manual-checks.txt, item 4).
    - The shared `useGoalPopupSubmit` hook and the `SavingsGoalPopup` refactor move submit logic only; they add no request path.
11. **The shared refactor is behavior-neutral.** `goalTargetTextSchema` is the same expression `savingsGoalFormSchema.target` used before, and the goal form's tests are unchanged and pass.
