# Task 028 security review

`security-review` on the task's changes (the working tree against HEAD, new files intent-to-add so the diff shows them), 2026-11-06. One identification pass over the whole diff (excluding `.claude/`, `docs/` and tests), the security pieces it relies on and the installed library code (`@nestjs/core` CSRF, `@nestjs/platform-express` `NoFilesInterceptor`, multer 2.4.0, append-field, `StandardSchemaValidationPipe`); `backend/test/profile.test.ts` run read-only (69 passed). The false-positive filtering step had nothing to filter.

## Result: no findings

No High or Medium finding with a confidence of 0.7 or more.

## What was checked, and why each is not a vulnerability

- **The row and the columns written.** The user ID comes only from `@CurrentUser()` (`backend/src/users/profile.controller.ts`), set by the global `SessionGuard` (`APP_GUARD`). The body passes the validation pipe with `profileUpdateRequestSchema` (`shared/src/contract/profile.ts`), whose output drops unknown parts (`id`, `userId`, `email`, `passwordHash`, `photoUrl`); the service takes only the four fields and writes them in one parameterized `update(User, { id: userId }, { fullName, username, phoneCountryCode, phoneNumber })` (`backend/src/users/users.service.ts`). No SQL is built from input.
- **Nothing read before the guards.** Middleware (CSRF, `backend/src/app.setup.ts`), then the guards (the session, then the write guard in `backend/src/auth/session.guard.ts`), then interceptors, then pipes: multer runs only inside `ProfileBodyInterceptor` (`backend/src/users/profile-body.interceptor.ts`). The global JSON and urlencoded parsers skip multipart bodies.
- **CSRF, a cross-site form post included.** Nest's `CrossOriginProtection` refuses every non-GET, HEAD or OPTIONS request whose `Sec-Fetch-Site` is not `same-origin` or `none`, or whose Origin does not match Host, whatever the content type. HTML forms cannot send PATCH (no method override), and the write guard needs the custom `X-Expected-User` header, which a form cannot set. Tested (403).
- **Files and prototype pollution.** `NoFilesInterceptor({ limits })` is built in the interceptor, so no module-wide multer options apply: no `dest`, no storage; `.none()` with `files: 0` aborts on a file part before anything is kept. multer's `req.body` and append-field's nested objects have a null prototype, so `__proto__[…]` part names cannot pollute; the pipe's output is the schema's object.
- **Error messages.** Any multer or busboy failure answers the fixed text "The profile could not be read" (no part name echoed); the try/catch wraps only multer's read, so the handler's 409 is not turned into a 400. The schema's texts are fixed strings. Any other error reaches the global filter (a generic 500; the log keeps the message and stack, never a query's parameters).
- **The taken username's 409.** Only the fixed text "This username is already taken" (#62, the designed behaviour). Login is by email, and no screen shows another user's username.
- **The responses.** `UsersService.profile` builds exactly the five keys (`fullName`, `email`, `username`, `phoneCountryCode`, `phoneNumber`): no password hash, no ID. `Cache-Control: no-store` covers `/api`.
- **The write guard's identity.** The email is never written (not in the schema, not in the `UPDATE`), so the identity the guard compares cannot be changed by the write it guards (#33, #119).
- **The frontend.** No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `frontend/src`; profile values render as React text and input values. `multipartBody` (`frontend/src/api/client.ts`) sends only the string fields, `credentials: 'same-origin'`.
- **The session user from the PATCH's answer.** It is the profile of the session's own user, which the write guard has matched to the tab's user; the answer is dropped when the session count changed (`frontend/src/api/profile.ts` and `useUserWrite`), so it cannot switch the tab to another user.
- **The migration and Google names.** Static SQL adding two columns with CHECK constraints; `newUserName` only removes control characters and cuts at 100 code points.
