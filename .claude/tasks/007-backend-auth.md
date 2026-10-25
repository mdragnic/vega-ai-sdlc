# Task 007: Backend: users, sessions and auth API (sign up, login, logout, me, guard, CSRF)

- Status: todo
- Gate: human
- Depends on: 000
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (auth, sessions, password hashing, CSRF, user scoping: run it on the task's changes and fix every finding before the gate)

## Goal
The backend has users and sessions: sign up, login, logout and "me" endpoints under `/api/auth`, defined once in the shared Zod contract. Passwords are hashed with scrypt, sessions are random tokens stored only as hashes and sent in an httpOnly SameSite=Lax cookie with a fixed expiry from the Clock. A global guard protects every other route and gives controllers the signed-in user, and Nest's built-in CSRF protection rejects cross-site requests that change data. No frontend.

## References
- Spec: `docs/spec/stories.md` US-01 criteria 8 to 10 and 12 (the API side of login and session length), US-02 criteria 4 to 7 and 12 (the API side of sign up and the generated username); `docs/spec/brief.md` Feature list 1 (Authentication), Data (Profile: username, first name), Not designed (Auth, Session)
- Figma: none, no UI in this task. For field names only: Login `137:7477` (`docs/figma/101. Login.png`), Sign up `137:8071` (`docs/figma/102. Signup.png`). Budget 0, no MCP calls.
- Decisions: `docs/decisions.md` #3 (logout ends the session), #14 (login rules, generic error, 30 days or browser session, no lockout), #15 (sign up rules, lowercase email, already registered), #39 (never another user's data), #46 (one user type, own data only), #62 (username rules), #63 (sign up session 30 days), #67 (username generation), #74 (shared Zod contract, error shape), #75 (sessions, scrypt, guard, CSRF), #78 (sign up transaction that task 008 extends), #79 (migrations only), #80 (Clock), #95 (field texts, password max 128, username digits, trimming, character classes, scrypt cost in tests)

## Scope
- **Shared contract** in `shared/src/contract/` (#74), exported from the package root, one file per resource:
  - `user.ts`:
    - `usernameSchema`: the #62 rule, 3 to 30 characters of `a`–`z`, `0`–`9`, `.` and `_` (#95 d). Generated usernames are checked against it; task 028 reuses it for edits.
    - `currentUserSchema`: `{ fullName, email, username }`, the signed-in user. Later tasks add fields (phone, photo, password section).
  - `auth.ts`:
    - One message per field: the first failing rule, in the order listed (#95 a). Lengths are Zod string lengths.
    - `fullNameSchema` (#15, #95): trimmed at both ends first (#95 c), then "Name is required" (empty, so only spaces is empty) and "Name must be at most 100 characters" (counted on the trimmed name). Inner spaces stay as typed.
    - `emailSchema` (#14, #15, #95): trimmed at both ends first, then "Email is required" and "Enter a valid email address" (Zod's `z.email()` format), then lowercased.
    - `newPasswordSchema` (sign up, #15, #95): never trimmed or changed; "Password is required", "Password must be at least 8 characters", "Password must be at most 128 characters" (a DoS guard on every password that gets hashed, #95 a), "Password must contain at least one letter and one number". A letter is any Unicode letter (`\p{L}`: `š` and `ć` count); a number is a digit `0` to `9` (#95 d).
    - Login password: never trimmed; "Password is required" and "Password must be at most 128 characters" only (#14: the sign up rules do not apply to login; #95 a: the maximum applies to every password that gets hashed).
    - `signUpRequestSchema` `{ fullName, email, password: newPasswordSchema }`; `loginRequestSchema` `{ email, password, keepSignedIn: boolean }`.
    - `authMessages`: the server-side texts, `"Email or password is incorrect"` (#14) and `"An account with this email already exists"` (#15), exported so tasks 009 and 010 test against the same strings.
    - `authContract`:
      - `signUp`: `POST /auth/signup`, request `signUpRequestSchema`, response `currentUserSchema`, 201.
      - `login`: `POST /auth/login`, request `loginRequestSchema`, response `currentUserSchema`, 200.
      - `logout`: `POST /auth/logout`, no request body, 204 with no body (response `z.undefined()`, which the API client already reads as `undefined`).
      - `me`: `GET /auth/me`, response `currentUserSchema`, 200.
  - Tests in `shared/test/` for every schema: each rule, each message, trimming and lowercasing.
- **Database** (#79): one migration, `npm run migration:generate -- CreateUsersAndSessions`, from the entities:
  - `users`: integer `id`; `email` unique, stored lowercase; `full_name`; `username` unique; `password_hash` nullable (Google-only users have none, #2, #75; task 012 creates them).
  - `sessions`: integer `id`; `token_hash` unique (SHA-256 hex of the token); `user_id` foreign key to `users` with `ON DELETE CASCADE`, indexed; `expires_at` (UTC). Nothing else: no raw token, no sliding fields (#75).
  - Entities in `backend/src/users/user.entity.ts` and `backend/src/auth/session.entity.ts`, relations with `Relation<T>` (CLAUDE.md).
  - The unit-test app applies the real migrations to its in-memory database, so tests run on the schema the app runs on. A drift test checks that after the migrations TypeORM finds no pending schema change for the entities.
  - `backend/test/reset-database.test.ts` now expects the tables the migration creates (`migrations`, `sessions`, `users`) instead of `migrations` alone. That is the new correct outcome, not a weaker test.
- **Backend** (NestJS, ESM), modules `backend/src/users/` and `backend/src/auth/`:
  - **Passwords** (`auth/password.ts`): `scrypt` from `node:crypto`, async (never `scryptSync`), r = 8, p = 1, a 64-byte key and a 16-byte random salt, `maxmem` raised to fit.
    - Cost N = 2^17 (the OWASP minimum) in development and production, N = 2^14 with `NODE_ENV=test` so the test suites stay fast (#95). `readConfig` sets it from `NODE_ENV`, like every other environment-dependent value; no new variable.
    - Stored as one string with its parameters and salt. Verification reads N, r and p from the stored string, never from the config, so a hash keeps working when the cost changes.
    - Verified with `timingSafeEqual`. The password and the hash are never returned, logged or put in an error.
  - **Session tokens**: 32 random bytes (`randomBytes`, 256 bits) as base64url in the cookie; the database stores only the SHA-256 hash, the user ID and the expiry (#75). A request's session is found by the hash of its cookie.
  - **Cookie** `finebank_session`, set and cleared with Nest 12's built-in cookie support (the HTTP adapter's `setCookie` and `clearCookie`, `@Cookies()`), no new dependency:
    - `HttpOnly`, `SameSite=Lax` (#75), `Path=/api` (only the API needs it), no `Domain` (host-only).
    - No `Secure`: the app runs over plain HTTP on localhost only (#73). Noted for the human checkpoint.
    - "Keep me signed in" checked, and every sign up: `Max-Age` 2,592,000 (30 days, #14, #63). Unchecked: no `Max-Age` or `Expires`, so the browser drops it on close (#14, #75).
  - **Expiry** from the injected Clock (#80): the session row expires at now + 30 days in both cases, fixed, never extended by use (#75). A request with an expired session gets 401 and the row is deleted.
  - **Global guard** (`APP_GUARD`): every route needs a valid session unless it is marked `@Public()`. Public: sign up, login, logout, and the test-only clock routes (they exist only with `NODE_ENV=test`). Without a cookie, with an unknown token or with an expired session: 401 `{ "message": "Authentication required" }` (not shown in the UI: task 009 redirects to Login). Unknown routes keep their 404.
  - **`@CurrentUser()`** parameter decorator: the signed-in user's ID for the controller. Every later query is scoped with it (#39, #46, #75).
  - **CSRF** (#75): `app.enableCsrfProtection()` in `configureApp`, so it covers the app and the tests. It is Nest 12's built-in protection: Fetch Metadata (`Sec-Fetch-Site`) with an `Origin` to `Host` fallback, not a token scheme. `GET`, `HEAD` and `OPTIONS` always pass; any other method from another site gets 403 in the shared error shape, before the route runs. No trusted origins and no exclusions. With the Vite proxy (#73) the browser's requests are same-origin and pass.
  - **Sign up** (`POST /api/auth/signup`): validates with the shared schema (400 with field errors). Inside one `dataSource.transaction` it inserts the user (email lowercased, username generated, password hashed) and the session; task 008 adds the demo data to this same transaction (#78). Then 201 with the current user and the 30-day cookie (#15, #63). An email already registered, in any case, gives 409 with `fieldErrors.email` and the message both `"An account with this email already exists"`; nothing is stored and no cookie is set (#15). A unique-constraint race on email gives the same 409; one on username takes the next number. A database error never reaches the log with the row's values.
  - **Username** (`users/username.ts`, #62, #67, #95 b): the part of the email before `@`, lowercased; characters outside `a`–`z`, `0`–`9`, `.` and `_` removed; cut to 26 characters; digits counted up from 1 added until it has at least 3 characters (`jo` gives `jo1`, `j` gives `j12`, an empty result gives `123`); then, if taken, the uniqueness number from 2 (`marko`, `marko2`, `marko3`; `jo1`, `jo12`, `jo13`). The result always passes `usernameSchema`.
  - **Login** (`POST /api/auth/login`): validates with the shared schema (400 with field errors). Finds the user by the lowercased email. An unknown email, a user without a password (Google-only, #2) and a wrong password all give 401 with only the message `"Email or password is incorrect"`, no field errors and no cookie (#14). All three run one scrypt verification (an unknown email against a fixed dummy hash made at the configured cost), so the response time does not tell them apart. No lockout or rate limit (#14). Success: 200 with the current user, a new session and the cookie per `keepSignedIn`.
  - **Replacing a session**: a sign up or login that presents a valid session cookie deletes that session's row; the browser keeps only the new one.
  - **Logout** (`POST /api/auth/logout`, public): deletes the presented session's row if there is one, clears the cookie (same name and path) and returns 204. Without a session it still returns 204 and clears the cookie (#3).
  - **Me** (`GET /api/auth/me`, guarded): 200 with `{ fullName, email, username }` of the session's user only (#39, #46).
  - Every handler takes its types and schemas from `@finebank/shared`; nothing is redeclared (#74).
  - `backend/test/app.test.ts`: its probe controller gets `@Public()` so the existing assertions keep testing the pipe and the error filter behind the new guard. The assertions do not change.
- **E2E** (`e2e/tests/auth-api.spec.ts`), through the real stack and the Vite proxy (#73), with a unique email per test (the test database is shared by the run):
  - Playwright's `request` fixture: sign up, me, logout and login with the cookie jar.
  - In Chromium, `fetch` from a page on `http://localhost:5173`: the browser sends its real `Sec-Fetch-Site` and stores the cookie; `document.cookie` does not show it.

## Out of scope
- Google sign-in: the `/api/auth/google` routes, the Google client interface and its fake, the Google variables in `.env` (task 012). The nullable `password_hash` is the only part built now.
- Demo data seeding on sign up and the data model for accounts, transactions, bills and goals (task 008).
- Any frontend: the Login and Sign up screens, route protection, redirects after login and logout, the app shell's user, API client changes (tasks 009, 010, 011).
- Forgot password and a reset flow (none, #16). Change password (task 030). Profile edits, the username change and its "This username is already taken" error (task 028). Profile photo (task 029). Phone and country code columns (task 028).
- Brute-force protection: lockout, rate limits, captchas (#14). Email verification (#15).
- A scheduled cleanup of expired session rows, sessions per device, "log out everywhere": nothing asks for them.

## Acceptance criteria
1. Given valid sign up fields, when I `POST /api/auth/signup`, then the response is 201 with `{ fullName, email, username }`, the email in lowercase; the user is stored with that email and a scrypt hash, never the password; a session row holds the SHA-256 hash of the cookie's token, the user ID and an expiry 30 days after the Clock's now; and `Set-Cookie` sets `finebank_session` with `HttpOnly`, `SameSite=Lax`, `Path=/api` and `Max-Age=2592000` (#15, #63, #75; US-02 criteria 4 and 7).
2. Given sign up fields that break a rule, then the response is 400 with one message per failing field under `fieldErrors` (`fullName`, `email`, `password`), the first failing rule in this order, and no user, session or cookie is created (#15, #95; US-02 criterion 5):
   - Name, after trimming: empty or only spaces gives "Name is required"; over 100 characters gives "Name must be at most 100 characters".
   - Email, after trimming: empty gives "Email is required"; a bad format gives "Enter a valid email address".
   - Password, as typed: empty gives "Password is required"; under 8 characters gives "Password must be at least 8 characters"; over 128 gives "Password must be at most 128 characters"; no letter or no digit `0` to `9` gives "Password must contain at least one letter and one number". `ššššššš1` passes; `abcdefg١` (an Arabic-Indic digit) does not.
   - A Name and Email with spaces around them are stored trimmed, the email in lowercase; a password with spaces around it is stored as typed.
3. Given an email that is already registered, in any mix of upper and lower case, when I sign up with it, then the response is 409 with the message and `fieldErrors.email` both `"An account with this email already exists"`, and no user, session or cookie is created (#15; US-02 criterion 6).
4. Given a new account, then its username follows #62, #67 and #95 (b): `Marko@x.com` gives `marko`; `marko-d@x.com` gives `markod`; `first.last_1@x.com` gives `first.last_1`; `a+tag@x.com` gives `atag`; `jo@x.com` gives `jo1`; `j@x.com` gives `j12`; `-@example.com` gives `123`; a local part of 40 letters gives its first 26; with `marko` taken, `marko2`, then `marko3`; with `jo1` taken, `jo12`. Every result passes `usernameSchema` (#95 b; US-02 criterion 12).
5. Given a stored password hash, then it holds its scrypt parameters (N, r 8, p 1), a 16-byte salt and a 64-byte key; it verifies the right password and rejects any other; two users with the same password get different hashes; no response body or log line contains a password or a hash (#75). N is 2^17 in development and production and 2^14 with `NODE_ENV=test`, and a hash stored with N 2^17 still verifies in a test app whose cost is 2^14, because verification reads the stored parameters (#95).
6. Given a registered email in any case and its password, when I `POST /api/auth/login`, then the response is 200 with the current user and a new session row expiring 30 days after the Clock's now. With `keepSignedIn: true` the cookie has `Max-Age=2592000`; with `false` it has neither `Max-Age` nor `Expires` (#14, #75; US-01 criteria 8 and 12).
7. Given a wrong password, an unknown email, or the email of a user without a password (Google-only), when I log in, then the response is 401 with only `{ "message": "Email or password is incorrect" }`, no session and no cookie, the same body and status in all three cases. After 20 failed attempts the right password still logs in (#2, #14; US-01 criterion 10).
8. Given login fields that break a rule, then the response is 400 with field errors: "Email is required", "Enter a valid email address", "Password is required", and "Password must be at most 128 characters" for a password over 128 characters, which is never hashed. A short password with no number is not rejected by the sign up rules on login; it just fails as wrong credentials (#14, #95; US-01 criterion 9).
9. Given I am signed in, when I `GET /api/auth/me`, then the response is 200 with my `fullName`, `email` and `username`. Given two users, each one's cookie returns only that user (#39, #46).
10. Given any route not marked public, when the request has no session cookie, an unknown token, or the token of an expired or deleted session, then the response is 401 `{ "message": "Authentication required" }`. Sign up, login, logout and (with `NODE_ENV=test`) the test clock routes work without a session; an unknown `/api` route still returns 404 (#75).
11. Given a session created at the Clock's now, then it is valid 1 ms before now + 30 days, also after being used every day, and at now + 30 days it gives 401 and its row is deleted. With `keepSignedIn: false` the server row has the same 30-day cap (#75, #80).
12. Given I am signed in, when I `POST /api/auth/logout`, then the response is 204, my session row is deleted and `Set-Cookie` clears `finebank_session` on `Path=/api`; the old token then gets 401 from `me`. Logout without a session also returns 204 and clears the cookie (#3, #75).
13. Given a request that presents a valid session cookie, when it signs up or logs in, then the old session's row is deleted and only the new session works.
14. Given a `POST` to any route with `Sec-Fetch-Site: cross-site` or `same-site`, or without `Sec-Fetch-Site` but with an `Origin` that does not match `Host`, then the response is 403 in the shared error shape and nothing changes (no user, session or cookie). `Sec-Fetch-Site: same-origin`, a matching `Origin`, or no browser headers pass; a `GET` always passes the CSRF check (#75).
15. Given the shared contract, then the four entries and their schemas exist once in `shared/src/contract/`, the backend uses them for validation and types, and every response in the tests parses with its shared response schema (#74).
16. Given the migration, then `users` and `sessions` exist with the unique, nullable and foreign key constraints in Scope, the database holds no raw token and no password, TypeORM finds no drift between the entities and the migrations, and `synchronize` stays off outside tests (#79).
17. Given the real stack in Chromium through the Vite proxy, when a page on `http://localhost:5173` signs up with `fetch`, then the cookie is stored with `HttpOnly`, `SameSite=Lax` and `Path=/api`, `document.cookie` does not contain it, `me` returns the user, logout ends the session, and a cross-site `POST` is rejected with 403 (#73, #75).

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | Shared schemas: `fullName` (empty, spaces only, 100 and 101 characters after trimming, padded); `email` (empty, spaces only, bad format, padded, upper case); sign up `password` (empty, 7 characters, 8 and 128 valid, 129, no letter, no digit, `ššššššš1`, `abcdefg١`, padded kept as is); login `password` (empty, 3 characters, 128, 129); `keepSignedIn` missing; `usernameSchema` (2, 3, 30, 31 characters, upper case, `-`, `š`) | The AC2 and AC8 message per failing field, the first failing rule only; trimmed name and email; lowercased email; password unchanged; username rule as in #62 and #95 (d) | 2, 8, 15 |
| T2 | unit | Sign up through supertest on the test app: valid fields with a mixed-case email | 201, body parses with `currentUserSchema`, lowercase email; user row with a hash; session row with `sha256(token)`, the user ID and Clock now + 30 days; cookie attributes as in AC1 | 1, 15 |
| T3 | unit | Sign up with each invalid field, and with all three | 400 with the right `fieldErrors` keys and texts; users and sessions tables unchanged; no `Set-Cookie` | 2 |
| T4 | unit | Sign up twice with the same email, the second time in upper case | 409 with the message and `fieldErrors.email`; one user; no new session; no cookie | 3 |
| T5 | unit | Username generator on the AC4 emails, including `j@x.com` and `-@example.com`, with and without taken names (`marko`, `marko2` taken; `jo1` taken) | The AC4 results; every result passes `usernameSchema`; the uniqueness number keeps it within 30 characters | 4 |
| T6 | unit | Password hashing: hash and verify; wrong password; same password twice; the stored string's parameters, salt and key lengths; a hash made with N 2^17 verified by the test app; `readConfig` with `NODE_ENV` `development`, `production` and `test` | Verify true only for the right password; two different strings; r 8, p 1, 16-byte salt, 64-byte key; the 2^17 hash verifies; the cost is 2^17, 2^17 and 2^14 | 5 |
| T7 | unit | Login with the right password (email in upper case), `keepSignedIn` true and false | 200 with the user; new session row with now + 30 days; `Max-Age=2592000` only when true, no `Expires` when false | 6 |
| T8 | unit | Login with a wrong password, an unknown email, and a user row inserted without a password; 20 failures then the right password | 401 with the identical body `{ message: "Email or password is incorrect" }` in all three; no session; no cookie; the 21st attempt succeeds | 7 |
| T9 | unit | Login with an empty and a malformed email, an empty password, a 129-character password; a 3-character password for a registered email | 400 with the AC8 field errors; the short password gives 401, not 400 | 8 |
| T10 | unit | `me` with each of two users' cookies | Each gets only their own `fullName`, `email`, `username`; the body parses with `currentUserSchema` | 9, 15 |
| T11 | unit | A guarded probe route and `me` with no cookie, a random token, a deleted session; the public routes without a cookie; an unknown `/api` route | 401 `Authentication required` for the first group; the public routes reach their handlers; 404 | 10 |
| T12 | unit | Move the `FixedClock`: 1 ms before 30 days with a `me` call every day, then exactly 30 days; the same for a `keepSignedIn: false` session | 200 until the cap, then 401 and the row is gone | 11 |
| T13 | unit | Logout with a session, then `me` with the old token; logout without a cookie | 204 and a clearing `Set-Cookie` on `Path=/api` both times; the row is gone; `me` gives 401 | 12 |
| T14 | unit | Log in while presenting a valid cookie; sign up while presenting one | The old row is deleted and its token gets 401; the new token works | 13 |
| T15 | unit | `POST` login, sign up and logout with `Sec-Fetch-Site: cross-site` and `same-site`; with `Origin: http://evil.example` and no `Sec-Fetch-Site`; with `Sec-Fetch-Site: same-origin`; a cross-site `GET /api/auth/me` with a valid cookie | 403 with the shared error shape and no change for the first two groups; the others pass the check | 14 |
| T16 | unit | Migrations on an empty database: table and index list, `PRAGMA foreign_key_list(sessions)`, the nullable `password_hash`; schema drift after the migrations; database options outside tests; the stored rows after T2 | The constraints in Scope; no pending schema change; `synchronize` false; no raw token or password anywhere in the database file | 16 |
| T17 | unit | Source guards: no `scryptSync`, no `Math.random` in `src/auth`; no time read outside the Clock (existing guard) | No match | 5, 11 |
| T18 | e2e | `request` fixture through the Vite proxy: sign up, `me`, logout, `me`, login, `me` | 201, 200, 204, 401, 200, 200; the cookie works through the proxy | 1, 6, 9, 12 |
| T19 | e2e | Chromium page on `http://localhost:5173`: `fetch` sign up, read `document.cookie` and `context.cookies()`, `fetch` `me`, `fetch` logout, `fetch` `me`; a `POST` with a cross-site `Origin` from the `request` fixture | Cookie `HttpOnly`, `SameSite=Lax`, `Path=/api`, an expiry 30 days out, absent from `document.cookie`; 200, 204, 401; the cross-site `POST` gets 403 | 14, 17 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`).
4. Visual: none. This task has no UI, so there is nothing to compare with `docs/figma/`; the Log says so.
5. Manual checks:
   - `npm run migrate` applies `CreateUsersAndSessions` to the development database, and a second run applies nothing.
   - With `npm run dev` and Playwright MCP on `http://localhost:5173`: sign up, `me` and logout with `fetch` from the page; read the cookie's attributes from the browser context; confirm `document.cookie` does not show it. Save the outputs to `.claude/tasks/evidence/007/`.

## Human checkpoint (only if Gate: human)
- #95 as applied: the field error texts, the 128-character password maximum on sign up and login, the username digits, trimming, the character classes, and N 2^14 only with `NODE_ENV=test`.
- The cookie: `finebank_session`, `HttpOnly`, `SameSite=Lax`, `Path=/api`, host-only, no `Secure` while the app is local HTTP only (#73; confirmed at detailing).
- scrypt at the OWASP minimum (N 2^17, r 8, p 1) outside tests, stored with its parameters, async; the dummy verification for unknown emails and users without a password, so login timing does not reveal which emails exist (sign up still tells, by design, #15).
- CSRF: Nest 12's built-in `enableCsrfProtection()` (Fetch Metadata and Origin check, as #75 means; confirmed at detailing), on every route that changes data.
- The API choices accepted at detailing, as built: status codes (201, 200, 204, 400, 401, 403, 409), the 401 text "Authentication required", logout public and idempotent, a login or sign up replacing the session the browser presented.
- The public routes (sign up, login, logout, test clock) and `@CurrentUser()` as the scoping hook for tasks 008 and later.
- The two existing tests changed for the new guard and migration: the probe controller made public in `app.test.ts`, and the expected table list in `reset-database.test.ts`.
- The security review findings and their fixes.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-25, detailing (`/next-task 007`)
- Detailed from the outline row with Marko's notes: security-critical, `security-review` in Skills; #14, #15, #46, #62, #67, #75, #63, #3, #74, #79, #80, #39; Google sign-in (task 012) and demo seeding (task 008) out of scope; no frontend.
- Checked in `node_modules` (no Figma calls):
  - Nest 12.2.0 has built-in cookies (`setCookie`, `clearCookie`, `@Cookies()`), so no cookie parser dependency is needed.
  - `app.enableCsrfProtection()` is built in: Fetch Metadata (`Sec-Fetch-Site`) with an `Origin`/`Host` fallback, following Go's `CrossOriginProtection`; safe methods always pass. Browsers send `Sec-Fetch-Site` to `localhost`, so requests through the Vite proxy pass as same-origin. Playwright's `request` fixture and supertest send no browser headers and pass as well.
  - Zod 4's default `z.email()` accepts only ASCII in the local part (`A-Z a-z 0-9 _ ' + -` and dots), so after lowercasing and removing `'`, `+` and `-` a generated username holds only `a`–`z`, `0`–`9`, `.` and `_`. A local part like `-` or `+` leaves nothing.
- Scope choices:
  - The users table gets a nullable `password_hash` now (#2, #75), so task 012 needs no migration for Google-only users; login treats them like a wrong password.
  - Sign up runs in one `dataSource.transaction`, the one task 008 extends with the demo data (#78).
  - `usernameSchema` lives in the shared contract, because the generated username must pass the rule users edit against in task 028.
  - The cookie path is `/api`, since only the API reads it.
  - The two existing tests that the guard and the migration affect are listed in Scope, so the change is visible.
- Raised **#95 (open)** in `docs/decisions.md`. A test needs an exact answer and the spec does not give one:
  - (a) the inline error texts for Name, Email and Password on login and sign up (the spec gives only the two server messages);
  - (b) which digits pad a short username (#67 gives only `jo` to `jo1`), including an empty result;
  - (c) whether Name and Email are trimmed;
  - (d) what "letters" and "number" mean in the username and password rules.
  This task waits for #95.
- INDEX: row 007 now cites #3, #39, #74, #78 to #80 and #95; open questions list #95.
- Not started. No Figma calls.

### 2026-10-25, #95 closed
- Marko's answers, recorded in `docs/decisions.md` #95 (closed, Marko, 2026-10-25):
  - (a) The proposed texts, plus "Password must be at most 128 characters": a maximum of 128, a DoS guard because scrypt uses about 128 MB per hash.
  - (b), (c) and (d) as proposed.
  - With `NODE_ENV=test` scrypt uses N 2^14 (the cost is stored with each hash); one unit test asserts N 2^17 outside tests.
- Also confirmed by Marko:
  - CSRF is Nest 12's built-in Fetch Metadata and Origin check, as #75 means.
  - No `Secure` flag while the app is local HTTP only.
  - "Authentication required", the public logout and replacing the old session are accepted.
- Reading of (a): the maximum is a guard on hashing, so it applies to the login password too (400 before any hashing), not only to sign up. The sign up order is required, at least 8, at most 128, then letter and number.
- Updated: References, Scope (shared schemas with the texts, passwords and their cost per environment, username digits, the dummy hash cost), AC2, AC4, AC5, AC8, T1, T5, T6, T9 and the human checkpoint.
- INDEX: open questions #94 only.
- Not started, as Marko asked. No Figma calls.

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
