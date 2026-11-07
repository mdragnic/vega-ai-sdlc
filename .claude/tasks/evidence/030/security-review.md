# Task 030: security review

`security-review` run on the task's uncommitted changes (`git diff HEAD`, new files intent-to-add), 2026-11-07, after lint, typecheck and `npm test` passed. One review sub-task read the diff and the code around it (read-only). Its findings were to go through a false-positive filter at a confidence bar of 8 of 10; it reported none at or above 0.7, so there was nothing to filter.

## Findings

No findings.

## What was checked

**The way into `PUT /api/auth/password`**
- CSRF: `app.enableCsrfProtection()` (`backend/src/app.setup.ts`) covers PUT; a cross-origin PUT also needs a CORS preflight, and the API enables no CORS.
- The global `SessionGuard`: the route is not `@Public()`, so a valid, unexpired session is required (401), and PUT is a write, so the `X-Expected-User` guard runs (400 or 409).
- Guards run before the global `StandardSchemaValidationPipe`, so the body is not parsed before authentication.
- `passwordChangeRequestSchema`: strings only, both at most 128 characters, unknown keys dropped. Nothing in the body names a user; the user ID comes only from `@CurrentUser()`.

**The session kept**
- The controller reads `@Headers('cookie')`, the same `req.headers.cookie` the guard reads, with the same `readSessionToken`, so the kept token is the one the guard validated for that user.
- `deleteOthersOf` filters on the user's ID and `token_hash <> sha256(kept)`: no other user's sessions can be deleted, and the `Not()` value is a bound parameter (no injection).

**The check and the write** (`backend/src/auth/auth.service.ts`)
- A Google-only user's NULL hash is verified against the dummy hash and always fails; an explicit `verifiedHash === null` check refuses it too, so no password can be set through this route.
- Compare and set: the `UPDATE` matches the ID and the verified hash, and the other sessions are deleted in the same transaction.
- Races: two changes at once (the second updates 0 rows, 400); a change against a Google takeover (#104; either order ends consistent); a change against a login with the old password (login's own check in its transaction refuses it, or the change's delete removes the new session). In no order does a session made with the old password survive.

**Data exposure**
- Neither password is logged, echoed or put in an error; the wrong-password 400 carries a fixed message only.
- `ApiExceptionFilter` logs only the message and stack of unexpected errors.
- `profile()` answers a `hasPassword` boolean for the session user's own row; the hash never leaves the backend (`updateProfile` answers through `profile()`).

**Frontend**
- No `dangerouslySetInnerHTML`, console logging or browser storage.
- `useChangePassword` sends only `{ currentPassword, newPassword }` through `useUserWrite` (the write guard's header, `gcTime: 0`, so the passwords leave the mutation cache).
- The password inputs: `type="password"`, the right `autocomplete` values, spell check, autocorrect and autocapitalize off. The read-only phone renders stored values as React-escaped `value` attributes.
- The gallery's sample passwords are placeholder text on a dev page, not credentials.

**Left out by decision**
- Brute-force limits (#14; recorded in `docs/architecture.md`'s accepted constraints).
- Keeping the current session rather than rotating it (#129 a). Session fixation is not possible: login and sign up always issue a fresh random token.

Fixes needed before the gate: none.
