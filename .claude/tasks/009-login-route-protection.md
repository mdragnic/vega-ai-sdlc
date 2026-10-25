# Task 009: Login screen and route protection

- Status: todo
- Gate: human
- Depends on: 002, 007
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (auth, sessions, the return target as an open-redirect risk, another user's cached data: run it on the task's changes and fix every finding before the gate), `frontend-design:frontend-design` (undesigned states only: field errors, wrong credentials, loading, server error, the link focus rings, the blank page while the session check runs)

## Goal
The Login screen of 101 works end to end against the task 007 API: the shared schema checks the fields, wrong credentials and server errors show above the Login button, and "Keep me signed in" sets the session length. Every app path needs a session: a signed-out visitor goes to Login and, after logging in, lands on the page they asked for, through a return target that can only be a path inside the app. A signed-in user who opens Login goes to Overview. A session that ends while the app is open sends the user to Login and removes their cached data. `ButtonPrimary` keeps keyboard focus while loading.

## References
- Spec: `docs/spec/stories.md` US-01 criteria 1 to 12, 14 and 15; US-04 criterion 12; `docs/spec/brief.md` Navigation (Auth, signed out), Layout (auth screens), Not designed (Auth, Session)
- Figma: Login `137:7477`, PNG `docs/figma/101. Login.png`. Form `137:8302`, Email input `402:5484`, Password input `402:5488`, Keep me signed in `402:5493`, Login button `402:5499`, Google button `402:5501`, "Create an account" `137:8301` (`docs/figma/inventory.md`). Budget 0, no MCP calls.
- Components (task 002, `docs/figma/components.md`): `AuthLayout`, `Input`, `RemindMe`, `ButtonPrimary`, `ButtonSecondary`, `TextDivider`, `FormError`, `FieldError`, `Spinner`; `Google` brand image (task 000). Routes: `frontend/src/routes/paths.ts` (task 003). Contract: `authContract`, `loginRequestSchema`, `authMessages` in `shared/src/contract/auth.ts` (task 007).
- Decisions: `docs/decisions.md` #3 (sign-in required, return to the requested page, signed-in users on Login go to Overview), #6 (form states), #14 (login rules, generic message, session length), #39 (never another user's data), #51 (eye toggle), #63 (focus-only active border, no placeholders), #66 and #70 (teal logo, Google icon), #74 (shared schemas, error shape), #75 (session cookie, 401 from the guard), #87 (teal `:focus-visible` ring, red error border), #88 ("Something went wrong."), #95 (field texts, password maximum), #97 (the error text above the Login button by status, a failing session check counts as signed out, only the page background while the check runs)

## Scope
- **Login screen** at `paths.login` (`/login`), `frontend/src/app/pages/LoginPage.tsx` with `LoginPage.module.css`, tokens only:
  - Built from the task 002 components inside `AuthLayout`, top to bottom as in 101 (US-01 criterion 1): "Email Address" (`Input` type `email`), "Password" (`Input` type `password` with the label action "Forgot Password?"), "Keep me signed in" (`RemindMe`), "Login" (`ButtonPrimary`, submit), "or sign in with" (`TextDivider`), "Continue with Google" (`ButtonSecondary` with the Google G) and "Create an account". The screen sets the column's top offset and the gaps measured on 101; no new component.
  - No placeholders (#63). `autoComplete` `email` and `current-password`, so password managers fill the fields; no visual change.
  - "Keep me signed in" is checked when the screen opens (#14).
  - "Forgot Password?" and "Create an account" are React Router links to `paths.forgotPassword` and `paths.signUp`. Their screens are task 010. "Create an account" is styled in `LoginPage.module.css` as drawn (teal, centered, size and weight measured on 101).
  - Links get the #87 ring on keyboard focus: a `:focus-visible` outline in `--color-primary` with `--border-width-focus-ring` and `--space-focus-ring-offset`. For "Forgot Password?" this goes into `Input.module.css` (`.labelAction a:focus-visible`), so every label action link gets it. A mouse click shows no ring.
  - "Continue with Google" is visual only until task 012: `type="button"`, no handler, no navigation, no request.
  - The form (`noValidate`, so the browser's own bubbles never replace the inline errors) uses react-hook-form with `zodResolver(loginRequestSchema)` from `@finebank/shared` (#74, #95). No rule or text is redeclared in the frontend:
    - On submit, a failing field shows its first failing message under it with the red border (#87) and the request is not sent: "Email is required", "Enter a valid email address", "Password is required", "Password must be at most 128 characters". Focus moves to the first field with an error (react-hook-form default). After the first submit, the messages follow the typing (react-hook-form's default re-validation).
    - The sign up password rules do not apply: a short password with no number is sent and fails as wrong credentials (#14).
    - The request sends the parsed values: the email trimmed and lowercased, the password as typed, `keepSignedIn` from the checkbox.
  - Responses (#6, #14, #74, #97 a):
    - 200: the signed-in user goes into the session query, the cached data of any earlier user is removed (#39), and the return target opens (see Return target), replacing Login in the history, so Back does not show Login again.
    - 401: `authMessages.invalidCredentials` ("Email or password is incorrect") shows in `FormError` above the Login button (`role="alert"`). The typed email and password stay. The message stays until the next submit starts.
    - 400 with `fieldErrors`: each message under its field (#74).
    - Any other 4xx in the shared shape: the server's `message` above the Login button; 4xx messages are written for users (#97 a).
    - A 5xx, a network failure, or a response without the shared shape: always "Something went wrong." above the Login button, never the server's text such as "Internal server error" (#97 a).
  - While the request runs (US-01 criterion 11): the Login button shows the spinner (`ButtonPrimary` `loading`), and a second click or Enter in a field sends nothing.
- **`ButtonPrimary` loading keeps focus** (row 009 note; task 005 review finding 7: Save moved focus to `<body>` while saving):
  - `loading` no longer sets the native `disabled`: the button stays focusable with `aria-disabled="true"` and `aria-busy="true"`, the spinner and the disabled look (the `:disabled` style also applies to `[aria-disabled='true']`).
  - While loading, its click is cancelled (`preventDefault`) and the caller's `onClick` is not called. A submit button therefore submits nothing, also on Enter in a field, because the browser's implicit submission is a click on the default button.
  - `disabled` keeps the native attribute, as now.
  - `GoalPopupInput` Save (task 005) gets the same behavior with no change of its own.
  - `frontend/test/components/buttons.test.tsx` changes its loading assertion from `toBeDisabled()` to `aria-disabled="true"`, focusable, focus kept and no submit. That is the new correct outcome this task asks for, not a weaker test.
- **Session state** (`frontend/src/api/session.ts`):
  - One TanStack query for the signed-in user (`authContract.me`): the user, or `null` on 401. A failing check (network, 500) also counts as signed out, with no retry (#97 b).
  - The default `refetchOnWindowFocus` stays on, so a session that ended while the tab was in the background is found when it comes back.
  - A login mutation on `authContract.login`.
  - `apiRequest` stays the only way to call the API (`client.ts`). `ApiError` records whether its body came from the server in the shared shape or was made up by the client, so a 4xx without a server message falls back to "Something went wrong." (#97 a). The existing client tests keep passing unchanged.
- **Route protection** (#3; US-01 criterion 14, US-04 criterion 12), in `frontend/src/routes/`:
  - `RequireAuth`: a layout route around every app path in `paths`: `overview`, `balances`, `accountDetails` (`/balances/:accountId`), `transactions`, `bills`, `expenses`, `goals`, `settingsAccount`, `settingsSecurity`.
    - Signed out: `<Navigate replace>` to `/login?returnTo=<path, query and hash of the page asked for>`.
    - Signed in: the page renders. Until task 011 adds `AppLayout` and the screen tasks add content, every app path renders the existing empty page frame (`RootPage`).
  - `GuestOnly`: a layout route around Login. Signed in: `<Navigate replace>` to Overview, whatever `returnTo` says (#3, US-01 criterion 14). Task 010 puts Sign up under it.
  - While the session check runs, both render only the page background: no form, no spinner, no skeleton (#97 c).
  - Outside both: `/` stays the empty `RootPage` (unknown URLs and `/` are task 011), and `/dev/components` and `/dev/popup` stay reachable signed out in development (task 002).
- **Return target** (`frontend/src/routes/return-to.ts`, pure functions): the target is a relative path inside the app, never an open redirect.
  - Read from `returnTo` and resolved with `new URL(value, window.location.origin)`. It is used only when:
    - the raw value starts with `/` and is not `//` or `/\`, and
    - the resolved origin is the app's own origin, and
    - the path is not an auth screen (`/login`, `/sign-up`, `/forgot-password`).
  - Then the target is the resolved path, query and hash. Anything else opens Overview: an absolute URL, `//host`, `/\host`, encoded tab or newline tricks (`/%09/host`), `javascript:`, a value without the leading `/`, an empty or missing value.
  - React Router navigation only, never `window.location`.
  - Unknown in-app paths are allowed here; task 011 sends them to Overview.
- **A session that ends while the app is open** (#3, #39, #75; task 007: "task 009 redirects to Login"):
  - A 401 from any query or mutation sets the session to signed out and removes every cached query (#39). `RequireAuth` then opens Login with the current page as the return target. No message on Login (none designed).
  - The login mutation's own 401 (wrong credentials) is excluded.
  - Wired once, on the `QueryCache` and `MutationCache` of the client in `AppProviders`.
- **Tests** in `frontend/test/` (Vitest, Testing Library, MSW) and `e2e/tests/login.spec.ts` (Playwright, real stack). E2E users are created with a unique email per test through `POST /api/auth/signup` on the `request` fixture, then log in through the UI.

## Out of scope
- The Sign up and Forgot Password screens and their routes (task 010). The links point to their paths; until task 010 those paths render no screen.
- The app shell around app pages, the signed-in user in the sidebar, Logout, the greeting, unknown URLs and `/` (task 011). Every screen's content (tasks 013 and later).
- Google sign-in: the flow, `returnTo` for Google, "Google sign-in failed. Please try again." (#81) and the Google session length (task 012, US-01 criteria 13 and 16).
- Any backend change: the task 007 API is used as it is. Brute-force protection (#14). A "session expired" message (not designed).
- New shared components: the Login page composes the task 002 components and styles "Create an account" itself.

## Acceptance criteria
1. Given I am signed out, when I open `/login` at 1440x1024, then I see, top to bottom: the teal "FINEbank.IO" logo, "Email Address", "Password" with "Forgot Password?" at the right of its label, "Keep me signed in", "Login", "or sign in with", "Continue with Google" with the Google G, and "Create an account", in the 400px column at the positions of 101. Empty fields show no placeholder (US-01 criteria 1 and 15; #63, #66, #70).
2. Given the password field, when I type, then the characters are masked and the eye shows at the right edge. Clicking the eye shows the password, and clicking again masks it. No request is sent and the form is not submitted (US-01 criteria 2 and 3; #51).
3. Given the screen opens, then "Keep me signed in" is checked. Clicking it unchecks it, and clicking again checks it (US-01 criterion 4; #14).
4. Given a field has focus, then it has the darker Active border. A filled field without focus has the normal border, as Password in 101 (US-01 criterion 5; #63).
5. Given I click "Forgot Password?" or "Create an account", then the app navigates to `/forgot-password` or `/sign-up` without a page reload. Given keyboard focus on either link, then the 2px teal ring with a 2px offset shows; a mouse click shows no ring (US-01 criteria 6 and 7; #87).
6. Given a registered email, in any case and with spaces around it, and its password, when I click "Login" or press Enter in a field, then one `POST /api/auth/login` is sent with the trimmed, lowercased email, the password as typed and `keepSignedIn` from the checkbox. The return target opens, or Overview when there is none, and Back does not open Login again (US-01 criterion 8; #3, #95).
7. Given Email is empty or not a valid email, or Password is empty or over 128 characters, when I submit, then no request is sent. Each failing field shows its first failing message under it ("Email is required", "Enter a valid email address", "Password is required", "Password must be at most 128 characters") with the red border, `aria-invalid` and `aria-describedby`, and focus moves to the first failing field. After that the messages follow my typing. A 3-character password is sent and fails as wrong credentials (US-01 criterion 9; #14, #87, #95).
8. Given a wrong password or an unknown email, when I submit, then I stay on Login and "Email or password is incorrect" shows above the Login button as an alert, the same text in both cases, with no field marked. My email and password stay in the fields. The message stays until my next submit (US-01 criterion 10; #14).
9. Given I submitted, while the request runs, then the Login button shows the spinner, has `aria-busy="true"` and `aria-disabled="true"` and the disabled look, and keeps keyboard focus. Clicking it again or pressing Enter sends no second request. Given the request fails, then the error shows above the Login button per #97 (a): for a 4xx in the shared shape the server's message (a 400's field errors under their fields); for a 5xx, a network failure or a response without the shared shape always "Something went wrong.", never "Internal server error". The button works again and still has focus (US-01 criterion 11; #6, #74, #97; row 009 note).
10. Given `ButtonPrimary` with `loading`, then it is focusable and keeps focus when `loading` turns on and off. Clicks do not call `onClick`, and a submit button submits nothing, also on Enter in a field. Given `disabled`, it is natively disabled, as before. `GoalPopupInput` Save keeps focus while saving (task 005 review finding 7).
11. Given "Keep me signed in" was checked when I logged in, then the browser keeps the session cookie for 30 days. Given it was unchecked, then the cookie has no expiry, so it ends when the browser closes (US-01 criterion 12; #14, #75).
12. Given I am signed in, when I open `/login`, with or without a `returnTo`, then Overview opens and the Login form never shows (US-01 criterion 14; #3, #97 c).
13. Given I am signed out, when I open any app path (Overview, Balances, an Account Details path, Transactions, Bills, Expenses, Goals, both Settings tabs), then Login opens with that page as the return target. After I log in, that page opens, with its query and hash. Signed in, the page renders (US-04 criterion 12; #3).
14. Given a `returnTo` that is not a path inside the app, then after login Overview opens and the browser never leaves `http://localhost:5173`. That covers an absolute URL, `//evil.example`, `/\evil.example`, `/%09/evil.example`, `javascript:alert(1)`, `balances` without the slash, an empty value, and `/login`, `/sign-up` or `/forgot-password` (row 009 note: no open redirect).
15. Given I am on an app page and my session ends (expired or deleted), when an API request gets 401 (a query, a mutation, or the session check on window focus), then Login opens with that page as the return target, and the queries cached for me are removed, so the next user who signs in in this tab never sees my data. The 401 of a failed login does not do this (#3, #39, #75).
16. Given the session check fails with something other than 401, then the app treats me as signed out, with no retry: an app path opens Login with its return target, and Login shows the form, with no error page (#97 b). While the check runs, only the page background shows, with no spinner or skeleton (#97 c).
17. Given I click "Continue with Google", then nothing happens: no navigation, no request (visual only until task 012).
18. Given development mode and no session, then `/dev/components` and `/dev/popup` still open, and `/` still renders the empty page.
19. Given the frontend source, then the Login form takes its rules and messages from `loginRequestSchema` and `authMessages` in `@finebank/shared`. No validation rule or server text is redeclared in `frontend/src` (#74).

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | Render `/login` signed out (MSW `me` 401) | Elements in AC1 order, by role and label; no `placeholder` attribute; checkbox `aria-checked="true"`; Google button with the G image; link `href`s `/forgot-password` and `/sign-up` | 1, 3, 5 |
| T2 | unit | Type in Password, click the eye twice, with a request spy | `type` password, text, password; no request; no submit | 2 |
| T3 | unit | Click the checkbox twice; then submit | `aria-checked` false, true; the request body's `keepSignedIn` follows the box (`false` after one click) | 3, 6 |
| T4 | unit | Submit empty; `a@b`; a 129-character password; a 3-character password; ` Marko@X.com ` | AC7 messages under the right fields, `aria-invalid`, focus on the first failing field, no request for the invalid cases; typing a valid email clears its message; the 3-character password is sent; the email is sent as `marko@x.com` | 6, 7, 19 |
| T5 | unit | Successful login from `/login?returnTo=%2Fbills%3Ftab%3D1%23x` and from `/login` (memory router) | One request; URL `/bills?tab=1#x`, then `/overview`; the `me` query holds the user; history has no Login entry after it | 6, 13 |
| T6 | unit | Login 401 with `authMessages.invalidCredentials`, then submit again | Alert above the Login button with that text; no field `aria-invalid`; values kept; still `/login`; the alert is gone while the second request runs | 8 |
| T7 | unit | Delayed login response: click Login, click again, press Enter in Password | Spinner, `aria-busy` and `aria-disabled` on the button, not natively disabled; `document.activeElement` is the button; one request in total; focus still on the button after the response | 9 |
| T8 | unit | Login fails with 500 `{ message: "Internal server error" }`, with 502 plain text, with a network error, with 403 `{ message: "<server text>" }`, with 404 plain text, and with 400 `{ message, fieldErrors: { email } }` | "Something went wrong." for the 500, the 502 and the network error, and "Internal server error" never shows; the 403's server text; "Something went wrong." for the plain 404; the email message under Email | 9 |
| T9 | unit | `ButtonPrimary`: `loading` on a focused button in a form, toggled on and off; click; Enter in a field; `disabled` | Focusable, focus kept, `aria-disabled="true"`, `aria-busy="true"`; no `onClick`, no submit; `disabled` is native. `GoalPopupInput` saving: Save keeps focus | 10 |
| T10 | unit | `return-to.ts` on the AC14 values plus `/balances`, `/balances/12?x=1#y`, `/settings/security` | The safe paths as given; Overview for every AC14 value | 14 |
| T11 | unit | Memory router, `me` 401: each app path. `me` 200: `/login`, `/login?returnTo=%2Fbills`, each app path. `me` pending: `/login`, `/overview` | `/login?returnTo=<path>` for each path; Overview twice; the page frame renders; no form and no page content while pending | 12, 13, 16 |
| T12 | unit | Signed in on `/bills`; a test query gets 401; then a test mutation gets 401; then a login 401 on `/login` | `/login?returnTo=%2Fbills`; the query cache holds no user data; the login 401 leaves the URL and the session alone | 15 |
| T13 | unit | `me` fails with 500 and with a network error, on `/overview` and on `/login` | `/login?returnTo=%2Foverview`; the form shows; one `me` request (no retry) | 16 |
| T14 | unit | Click "Continue with Google" with a request spy | URL unchanged; no request | 17 |
| T15 | unit | Signed out (`me` 401) in dev: `/dev/components`, `/dev/popup`, `/` | Each renders; no redirect | 18 |
| T16 | unit | Source guard over `frontend/src`: the texts of `authMessages` and the schema messages appear only through `@finebank/shared` | No literal match | 19 |
| T17 | e2e | Signed out, open `/balances/12?view=1#top`; log in through the UI; press Back | URL `/login?returnTo=…`, then `/balances/12?view=1#top`; Back does not show the Login form | 6, 13 |
| T18 | e2e | Log in with "Keep me signed in" checked; new context, log in unchecked | `finebank_session` expires about 30 days after the real time; then `expires` is -1 (session cookie) | 11 |
| T19 | e2e | Wrong password; unknown email | The alert's box is above the Login button; the same text; still `/login` | 8 |
| T20 | e2e | Signed in (cookie from the UI login): open `/login` and `/login?returnTo=%2Fbills` | `/overview` both times; the Login form is never visible | 12 |
| T21 | e2e | Log in from `/login?returnTo=` with each AC14 value | URL `http://localhost:5173/overview` every time | 14 |
| T22 | e2e | Signed in on `/overview`; move the backend clock 30 days (`PUT /api/test/clock`); fire `visibilitychange` | `/login?returnTo=%2Foverview` | 15 |
| T23 | e2e | Keyboard: Tab through the screen; click a link with the mouse. Delay the login response with `page.route` and press Enter on Login | Focus order Email, Forgot Password?, Password, eye, checkbox, Login, Google, Create an account; teal 2px ring with 2px offset on both links; no ring after the mouse click; Login keeps focus while loading | 5, 9 |
| T24 | e2e | `/login` at 1440x1024 | Column x 520 to 920; each AC1 element's box within 2px of the positions measured on 101 (Validation step 4) | 1 |
| T25 | e2e | Click "Forgot Password?", then Back, then "Create an account" | URL `/forgot-password`, then `/login`, then `/sign-up`, with no full page load | 5 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`).
4. Visual: a Playwright MCP screenshot of `/login` at 1440x1024, with the fields filled and focused as in 101 (Email "johndoe@email.com" focused, Password 14 masked characters), compared with `docs/figma/101. Login.png` element by element. Positions in CSS px from task 002, approximate; measure them exactly:
   - logo x 583–857, y 158–193
   - Email input y 288–336
   - Password label row with "Forgot Password?" y 360–380, Password input y 392–440
   - `RemindMe` y 474–494, Login button y 512–560
   - `TextDivider` y about 602, Google button y 644–692
   - "Create an account" about x 649–791, y 736–753

   Save to `.claude/tasks/evidence/009/` and list every difference.
5. Manual browser checks with Playwright MCP on `npm run dev`:
   - Sign up a user with `fetch`, log out, open `/goals`, log in, land on `/goals`.
   - Open `/login` signed in.
   - Wrong password, empty fields, and loading with a throttled request: focus stays on Login.
   - Tab through the screen and check the link rings.
   - `returnTo=//evil.example`.
   - Save screenshots of the undesigned states (field errors, wrong credentials, loading, server error, link rings) to `.claude/tasks/evidence/009/`.

## Human checkpoint (only if Gate: human)
- Login matches 101 at 1440x1024: logo, fields, label action, checkbox, buttons, divider, "Create an account" (color, size, weight, position).
- Undesigned states: the field errors with the red border, wrong credentials and the server error above the Login button, the loading button, the teal ring on both links.
- #97 as applied:
  - a 4xx shows the server's message, while a 5xx and a network failure show "Something went wrong.";
  - a failing session check counts as signed out;
  - only the page background shows while the check runs.
- `ButtonPrimary` loading now uses `aria-disabled` and stays focusable (also Save in `GoalPopupInput`). The loading assertion in `buttons.test.tsx` changed for it.
- The return target as built:
  - a `returnTo` query parameter, the same name task 012 sends to Google (#75);
  - only same-origin paths, never an auth screen, otherwise Overview;
  - a signed-in user on Login always goes to Overview, as #3 says, even with a `returnTo`.
- Choices accepted at detailing, as built:
  - after the first submit the field messages follow the typing;
  - the wrong-credentials message stays until the next submit;
  - focus goes to the first failing field;
  - redirects replace the history entry;
  - `autoComplete` on both fields;
  - any 401 ends the session in the app and clears the cached data (#39), with no "session expired" message.
- App paths render the empty page frame until tasks 011 and 013. `/` and unknown URLs are unchanged until task 011.
- The security review findings and their fixes.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-25, detailing (`/next-task 009`)
- Detailed from the outline row with Marko's notes:
  - US-01 with #14, #51, #63 and #95 through the shared schema and `authMessages`;
  - #3: return to the requested page; signed-in users on Login go to Overview;
  - #39;
  - a relative in-app return target only (no open redirect);
  - the #87 teal ring on links;
  - `ButtonPrimary` loading keeps keyboard focus (task 005 review finding 7);
  - "Continue with Google" visual only until task 012;
  - the shell is task 011, and Sign up and Forgot Password are task 010;
  - the visual check against `101. Login.png`;
  - `security-review` in Skills.
- Scope choices (for review with the task):
  - The return target travels as `?returnTo=` on `/login`, the name #75 uses for Google (task 012).
  - App paths render the existing empty `RootPage` frame until tasks 011 and 013. `/` stays as it is (task 011 owns unknown URLs).
  - Any 401 outside the login request ends the session in the app and clears the query cache. Task 007 wrote that task 009 redirects on its 401. Clearing the cache keeps a second user in the same tab from seeing the first user's cached data (#39).
  - `ButtonPrimary` loading moves from `disabled` to `aria-disabled` with a cancelled click. That also blocks Enter in a field, because implicit submission clicks the default button. `buttons.test.tsx` changes one assertion for it.
  - `ApiError` learns whether its body came from the server, for #97 (a).
- Raised **#97 (open)** in `docs/decisions.md`:
  - (a) the text above the Login button when the server sends no message;
  - (b) what a failing session check (not 401) does;
  - (c) what shows while the check runs.

  This task waits for #97.
- INDEX: row 009 now cites #39, #74, #87, #95 and #97; open questions list #94 and #97.
- Not started. No Figma calls.

### 2026-10-25, #97 closed
- Marko's answers, recorded in `docs/decisions.md` #97 (closed, Marko, 2026-10-25):
  - (a) Changed: a 4xx shows the server's `message`, which is written for users. A 5xx and a network failure always show "Something went wrong.", never "Internal server error".
    - A response without the shared shape has no server message, so it shows "Something went wrong." too. Recorded with the answer.
  - (b) As proposed: a failing session check counts as signed out, with no retry.
  - (c) As proposed: only the page background while the check runs.
- Also accepted by Marko:
  - live field errors after the first submit;
  - the wrong-credentials message until the next submit;
  - focus to the first failing field;
  - redirects that replace the history entry;
  - `autoComplete` on both fields;
  - no "session expired" message.
- Updated: References, Scope (responses, session state, `ApiError`, the page while checking), AC9, AC16, T8 and the human checkpoint.
- INDEX: open questions list #94 only.
- Not started: Marko asked for the detailing commit only. No Figma calls.

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
