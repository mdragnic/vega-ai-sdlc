# Task 010: Sign up and Forgot Password screens

- Status: todo
- Gate: human
- Depends on: 008, 009
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (auth, sessions, sign up as a new way into the app, the password in memory and in the mutation cache, an earlier user's cached data, the email-taken message as account discovery accepted by #15: run it on the task's changes and fix every finding before the gate), `frontend-design:frontend-design` (undesigned states only: field errors, email already registered, loading, server error, the link focus rings, the blank page while the session check runs)

## Goal
The Sign up screen of 102 works end to end against the task 007 API: the shared schema checks Name, Email and Password, an email that is already registered shows its message under Email, server errors show above "Sign up", and a new account is signed in for 30 days and lands on Overview with the demo dataset seeded by task 008. The Forgot Password screen of 103 is built as drawn, sends nothing and shows nothing, and is a form a reset flow can later be added to. Both screens are reachable from Login and link back to it, and a signed-in user who opens Sign up goes to Overview.

## References
- Spec: `docs/spec/stories.md` US-02 criteria 1 to 8 and 10 to 14, US-03; `docs/spec/brief.md` Screen flow (Auth, signed out), Layout (auth screens), Not designed (Auth, Session)
- Figma: Signup `137:8071`, PNG `docs/figma/102. Signup.png`; Forgot Password `167:7873`, PNG `docs/figma/103. Forgot Password.png`. Both are flattened (#37): built from the PNGs and the task 002 components. Budget 0, no MCP calls.
- Components (task 002, `docs/figma/components.md`): `AuthLayout`, `Input`, `ButtonPrimary`, `ButtonSecondary`, `TextDivider`, `FormError`, `FieldError`, `Spinner`; `Google` brand image (task 000). Routes: `frontend/src/routes/paths.ts` (`signUp`, `forgotPassword`), `GuestOnly` (task 009). Session: `frontend/src/api/session.ts` (task 009). Client: `apiRequest`, `ApiError`, `formErrorMessage` in `frontend/src/api/client.ts` (task 009). Contract: `authContract.signUp`, `signUpRequestSchema`, `emailSchema`, `authMessages` in `shared/src/contract/auth.ts` (task 007). Backend: `POST /api/auth/signup` (201 with the user and a 30-day session cookie; 409 `{ message, fieldErrors: { email } }` with `authMessages.emailTaken`; task 007), seeding in the same transaction (task 008).
- Decisions: `docs/decisions.md` #1 (demo dataset per user), #3 (after sign up Overview; signed-in users on Sign up go to Overview), #6 (form states), #15 (sign up rules, email taken, terms visual only, no verification), #16 (Forgot Password visual only, ready for a later reset flow), #37 (flattened screens), #39 (never another user's data), #51 (eye toggle), #62 and #67 (generated username, backend), #63 (focus-only active border, placeholders only where drawn, 30-day session after sign up), #65 (measured spacing on the 4px grid), #66 and #70 (teal logo, Google G), #74 (shared schemas, error shape), #75 (session cookie), #78 (seeding on sign up), #86 (`--color-auth-muted`), #87 (teal `:focus-visible` ring, red error border), #95 (field texts, password maximum, trimming), #97 (the error text above the submit button by status; a failing first session check counts as signed out; only the page background while it runs), #98 (only a 401 ends a known session), #99 (Forgot Password under `GuestOnly`; the 103 logo top 228px)

## Scope
- **Reuse first** (row 010 note: reuse tasks 002, 007, 008 and 009, nothing redeclared):
  - The Login page's server field error helper (`serverFieldErrors` in `LoginPage.tsx`) moves to `frontend/src/api/client.ts`, next to `formErrorMessage`, and takes the screen's field names. It reads the `fieldErrors` of any 4xx in the shared shape: the 400 of #74 and the 409 of #15. Field errors go under their fields; a failure with none for the screen's fields shows its text above the submit button by #97 (a). Login uses it unchanged in behavior; its tests keep passing.
  - The #87 ring for links on the auth screens moves from `LoginPage.module.css` (`.createAccount:focus-visible`) into `AuthLayout.module.css` (`.column a:focus-visible`), so every link in the column gets it once: "Create an account", "Sign in here", "Back to login". The label action rule in `Input.module.css` stays (Input is also used outside the auth screens).
  - `session.ts`: `useSignUp` beside `useLogin`, with the same options shared, not copied: `mutationKey` `['session', 'signUp']`, `gcTime: 0` (the variables hold the password), `onMutate` cancels a running session check, `onSuccess` sets the user and removes every other cached query (`setSessionUser`, #39).
  - E2E helpers used by both specs move into `e2e/helpers.ts`: the unique-email sign up (`signUp` in `login.spec.ts`, `newUser` in `demo-seeding.spec.ts`), `box`, `within2`, `control` and `sessionCookie`. Both specs import them.
- **Sign up screen** at `paths.signUp` (`/sign-up`), `frontend/src/app/pages/SignUpPage.tsx` with `SignUpPage.module.css`, tokens only, under `GuestOnly`:
  - Inside `AuthLayout`, top to bottom as in 102 (US-02 criterion 1):
    - the heading "Create an account" (`h1`, centered);
    - "Name" (`Input` type `text`);
    - "Email Address" (`Input` type `email`, placeholder "hello@example.com");
    - "Password" (`Input` type `password`);
    - the text "By continuing, you agree to our terms of service.", with "terms of service." in teal;
    - "Sign up" (`ButtonPrimary`, submit);
    - "or sign up with" (`TextDivider`);
    - "Continue with Google" (`ButtonSecondary` with the Google G);
    - "Already have an account? Sign in here", with "Sign in here" a teal link.
  - The screen sets its top offset and the gaps measured on 102, as tokens in `tokens.md` and `tokens.css` (#65, as task 009 did for Login). Colors from existing tokens, all measured on 102: heading `--color-form-label`, terms text `--color-input-active`, "Already have an account?" `--color-auth-muted`, both teal parts `--color-primary`. Font sizes and weights from the type tokens, measured on 102. No new component.
  - Placeholders: only Email's "hello@example.com" (#63, US-02 criterion 14). `autoComplete` `name`, `email` and `new-password`; no visual change.
  - "Sign in here" is a React Router link to `paths.login`, with no `returnTo` (#3: after sign up Overview opens).
  - "terms of service." is visual only (#15, US-02 criterion 10): teal text, not a link element and not focusable, so a click does nothing and Tab skips it. Visual-only items so far are plain elements (the bell and the three-dot icon, task 003).
  - "Continue with Google" is visual only until task 012: `type="button"`, no handler, no navigation, no request.
  - The form (`noValidate`) uses react-hook-form with `zodResolver(signUpRequestSchema)` from `@finebank/shared` (#74, #95). No rule or text is redeclared in the frontend:
    - On submit, a failing field shows its first failing message under it with the red border (#87), and the request is not sent:
      - Name: "Name is required", "Name must be at most 100 characters";
      - Email: "Email is required", "Enter a valid email address";
      - Password: "Password is required", "Password must be at least 8 characters", "Password must be at most 128 characters", "Password must contain at least one letter and one number".
    - Focus moves to the first failing field; after the first submit the messages follow the typing (as on Login).
    - The request sends the parsed values: Name and Email trimmed, Email lowercased, the password as typed (#15, #95).
  - Responses (#6, #15, #74, #97 a):
    - 201: the new user goes into the session query, every other cached query is removed (#39), and Overview opens, replacing Sign up in the history. The session cookie lasts 30 days (#63, set by task 007). The demo dataset was seeded in the same request (task 008); Overview shows it from task 013.
    - 409 email taken: `authMessages.emailTaken` ("An account with this email already exists") under Email, with the red border and `aria-invalid`; nothing above "Sign up". "Sign in here" stays where it is drawn: the message is text only (#15 "with the Login link as designed": 102 draws that link at the bottom, not in the message). The typed values stay. The message goes when Email changes or the next submit starts.
    - 400 with `fieldErrors`: each message under its field (Name, Email, Password).
    - Any other 4xx in the shared shape: the server's `message` above "Sign up".
    - A 5xx, a network failure, or a response without the shared shape: "Something went wrong." above "Sign up", never the server's text.
    - Server field errors do not move focus: "Sign up" keeps it (as on Login).
  - While the request runs (US-02 criterion 8): "Sign up" shows the spinner (`ButtonPrimary` `loading`, which keeps focus, task 009), and a second click or Enter in a field sends nothing. It stays loading after the 201 until Overview opens.
- **Forgot Password screen** at `paths.forgotPassword` (`/forgot-password`), `frontend/src/app/pages/ForgotPasswordPage.tsx` with `ForgotPasswordPage.module.css`, tokens only, under `GuestOnly` (#99 a):
  - Inside `AuthLayout`, as in 103 (US-03 criterion 1):
    - the heading "Forgot Password?" (`h1`, centered);
    - the text "Enter your email address to get the password reset link.", centered in two lines broken after "the" as drawn;
    - "Email Address" (`Input` type `email`, placeholder "hello@example.com", `autoComplete` `email`);
    - "Password Reset" (`ButtonPrimary`, submit);
    - "Back to login", a gray React Router link to `paths.login`.
  - Top offset and gaps measured on 103, as tokens (#65). The logo top is 228px (#99 b: 230 measured, a tie on the grid), so the Email field and "Password Reset" sit at the y measured in task 002 (466 and 546). Colors from existing tokens, all measured on 103: heading `--color-form-label`, text `--color-gray-01`, "Back to login" `--color-gray-02`.
  - The text measures 18px with about 26px between its two lines. No text style has that line height: it uses the nearest type tokens (18px, `--line-height-24`), and the 2px difference is listed in the visual check. No new type token.
  - No behavior (#16, US-03 criterion 3): "Password Reset", by click or by Enter in the field, with or without an email, sends no request, shows no validation, confirmation or error, does not navigate, and keeps the typed email. `noValidate`, so the browser's own bubble for an invalid email never shows.
  - Built so a reset flow can be added later without reworking the screen (#16): a `<form>` with react-hook-form like Login and Sign up, the Email field registered as `email`, "Password Reset" its submit button, and one submit handler that does nothing yet. A later flow adds the shared `emailSchema` as the resolver, the request and its states in that handler; the markup stays.
  - Signed-in users (#99 a): a signed-in user who opens it goes to Overview, as on Login and Sign up, and only the page background shows while the session check runs (#97 c).
- **Routes** (`frontend/src/app/routes.tsx`): `paths.signUp` and `paths.forgotPassword` join Login under `GuestOnly` (#3, #99 a). `GuestOnly` is unchanged: after a successful sign up it sends to Overview, the same target the screen opens itself.
- **Tests** in `frontend/test/` (Vitest, Testing Library, MSW, `test/support/app.tsx`) and `e2e/tests/sign-up.spec.ts` and `e2e/tests/forgot-password.spec.ts` (Playwright, real stack). E2E sign ups use a unique email per test, from `e2e/helpers.ts`.

## Out of scope
- Google sign-in on either screen: the flow, the 30-day Google session, cancel and failure (#81) (task 012, US-02 criteria 9 and 15).
- The app shell, Logout, the greeting, unknown URLs and `/` (task 011). Overview's content, where the demo data shows (task 013).
- The reset email, the reset-password page, and any validation, loading, confirmation or error state on Forgot Password (#16). The terms of service page and email verification (#15).
- Any backend change: the task 007 sign up API, the task 008 seeding and the username generation (#62, #67) are used as they are.
- New shared components. The screens compose the task 002 components and style their own heading and text lines, as Login styles "Create an account".

## Acceptance criteria
1. Given I am signed out, when I open `/sign-up` at 1440x1024, then I see, top to bottom: the teal "FINEbank.IO" logo, "Create an account", "Name", "Email Address" with the placeholder "hello@example.com", "Password" (masked, with the eye), "By continuing, you agree to our terms of service." with "terms of service." in teal, "Sign up", "or sign up with", "Continue with Google" with the Google G, and "Already have an account? Sign in here" with "Sign in here" in teal, in the 400px column at the positions of 102. Name and Password show no placeholder (US-02 criteria 1 and 14; #63, #66, #70).
2. Given the Sign up password field, when I click the eye, then the password shows, and clicking again masks it. No request is sent and the form is not submitted (US-02 criterion 2; #51).
3. Given I click "Sign in here", then `/login` opens without a page reload. Given keyboard focus on it, then the 2px teal ring with a 2px offset shows; a mouse click shows no ring (US-02 criterion 3; #87).
4. Given a Name, an email that is not registered (in any case, with spaces around it) and a valid password, when I click "Sign up" or press Enter in a field, then one `POST /api/auth/signup` is sent with the trimmed Name, the trimmed lowercased email and the password as typed. It answers 201: I am signed in, Overview opens, and Back does not show Sign up. The session cookie expires 30 days later. The queries cached before are gone (US-02 criteria 4 and 7; #1, #3, #15, #39, #63, #78, #95).
5. Given a field breaks its rule, when I submit, then no request is sent. Each failing field shows its first failing message under it (the texts in Scope) with the red border, `aria-invalid` and `aria-describedby`, and focus moves to the first failing field. After that the messages follow my typing. A Name of only spaces is "Name is required"; a 101-character Name, a 7-character password, a password of letters only and a 129-character password each give their message (US-02 criterion 5; #15, #87, #95).
6. Given the email is already registered, when I click "Sign up", then I stay on Sign up and "An account with this email already exists" shows under Email with the red border and `aria-invalid`, and nothing shows above "Sign up". My values stay, "Sign in here" is where it is drawn, and "Sign up" keeps focus. The message goes when I change Email (US-02 criterion 6; #15).
7. Given I submitted, while the request runs, then "Sign up" shows the spinner, has `aria-busy="true"` and `aria-disabled="true"` and the disabled look, and keeps keyboard focus; clicking again or pressing Enter sends no second request. Given the request fails, then the error shows by #97 (a): a 4xx's server message above "Sign up" (a 400's field errors under their fields); for a 5xx, a network failure or a response without the shared shape "Something went wrong.", never "Internal server error". The button works again and still has focus (US-02 criterion 8; #6, #74, #97).
8. Given I click "terms of service.", then nothing happens: no navigation, no request. Tab never stops on it (US-02 criterion 10; #15).
9. Given I am signed in, when I open `/sign-up`, then Overview opens and the Sign up form never shows. While the session check runs, only the page background shows (US-02 criterion 11; #3, #97 c).
10. Given a Sign up field has focus, then it has the darker Active border, as Name in 102; a filled field without focus has the normal border (US-02 criterion 13; #63).
11. Given I click "Continue with Google" on Sign up, then nothing happens: no navigation, no request (visual only until task 012).
12. Given I am signed out, when I open `/forgot-password` at 1440x1024, then I see the teal logo, "Forgot Password?", "Enter your email address to get the password reset link." in two centered lines broken after "the", "Email Address" with the placeholder "hello@example.com", "Password Reset" and the gray "Back to login", at the positions of 103 (US-03 criterion 1; #63, #66, #70).
13. Given I click "Back to login", then `/login` opens without a page reload. Given keyboard focus on it, then the teal ring shows; a mouse click shows no ring (US-03 criterion 2; #87).
14. Given the Forgot Password screen, when I click "Password Reset" or press Enter in the field, with the field empty, with "abc", or with a valid email, then no request is sent, no message of any kind shows (no field error, no browser bubble, no confirmation), the URL stays, and the typed text stays (US-03 criterion 3; #16).
15. Given the Forgot Password source, then the Email field sits in a `form` whose submit button is "Password Reset", and the submit goes through one handler that sends nothing, ready for a reset flow (#16).
16. Given I am signed in, when I open `/forgot-password`, then Overview opens and the screen never shows. While the session check runs, only the page background shows (#99 a, #97 c).
17. Given Login, Sign up and Forgot Password, then the links between them work both ways ("Create an account", "Sign in here", "Forgot Password?", "Back to login"), and Login's behavior and tests from task 009 are unchanged by the moved helper and ring.
18. Given the frontend source, then the Sign up form takes its rules and messages from `signUpRequestSchema` and `authMessages` in `@finebank/shared`. No validation rule or server text is redeclared in `frontend/src` (#74).

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | Render `/sign-up` signed out (MSW `me` 401) | Elements in AC1 order by role and label; `placeholder` only on Email ("hello@example.com"); heading level 1; "terms of service." not a link and not focusable; "Sign in here" `href` `/login`; Google button with the G image | 1, 3, 8 |
| T2 | unit | Type a password, click the eye twice, with a request spy | `type` password, text, password; no request; no submit | 2 |
| T3 | unit | Submit `{ "  Tanzir Rahman ", " Marko@X.com ", "abcdef12" }` against MSW 201 from `/sign-up` with an earlier query in the cache | One request, body `{ fullName: "Tanzir Rahman", email: "marko@x.com", password: "abcdef12" }`; URL `/overview`; the session holds the user; the earlier query is gone; history has no Sign up entry | 4 |
| T4 | unit | Submit empty; Name of spaces; 101-character Name; `a@b`; 7-character password; `abcdefgh`; 129-character password | Each AC5 message under its field, `aria-invalid`, focus on the first failing field, no request; fixing a field clears its message | 5, 18 |
| T5 | unit | MSW 409 `{ message, fieldErrors: { email } }` with `authMessages.emailTaken`; then edit Email | Message under Email, `aria-invalid` on Email only; no alert above "Sign up"; values kept; focus on "Sign up"; editing Email to a valid one removes the message | 6 |
| T6 | unit | Delayed sign up: click, click again, Enter in Password | Spinner, `aria-busy` and `aria-disabled`, not natively disabled; focus on the button; one request; focus kept after the response | 7 |
| T7 | unit | Sign up fails with 500 `{ message: "Internal server error" }`, 502 plain text, a network error, 403 `{ message: "<server text>" }`, 400 `{ message, fieldErrors: { fullName, password } }` | "Something went wrong." for 500, 502 and the network error, never "Internal server error"; the 403's text above "Sign up"; the 400's messages under Name and Password | 7 |
| T8 | unit | Click "terms of service." and "Continue with Google", with a request spy | URL unchanged; no request | 8, 11 |
| T9 | unit | `me` 200: `/sign-up`; `me` pending: `/sign-up`; `me` 500 on the first check: `/sign-up` | Overview; nothing but the page background while pending; the form after the failed first check (#97 b) | 9 |
| T10 | unit | Render `/forgot-password` signed out | Elements in AC12 order; heading level 1; Email placeholder "hello@example.com"; "Back to login" `href` `/login`; Email inside a `form` whose submit button is "Password Reset" | 12, 13, 15 |
| T11 | unit | "Password Reset" by click and by Enter: empty, `abc`, `marko@x.com`, with a request spy | No request; no `role="alert"`, no `aria-invalid`, no message text; URL unchanged; value kept | 14 |
| T12 | unit | `me` 200: `/forgot-password`; `me` pending: `/forgot-password` | Overview, the screen never renders; nothing but the page background while pending | 16 |
| T13 | unit | `serverFieldErrors` and the form error rule in `client.ts`: 400 and 409 with `fieldErrors` for the screen's fields, a 409 with a field not on the screen, a 401, a 500 | Field errors for 400 and 409; the message above the button when no field matches; Login's tests pass unchanged | 6, 7, 17 |
| T14 | unit | Source guard over `frontend/src` (as `login-source.test.ts`, extended to `signUpRequestSchema`'s messages and `authMessages.emailTaken`) | No literal match outside `@finebank/shared` (the dev gallery excluded, as in task 009) | 18 |
| T15 | e2e | Sign up through the UI with a new email in mixed case | One `POST /api/auth/signup` answered 201; URL `/overview`; `GET /api/auth/me` gives the user with the lowercased email; `finebank_session` expires about 30 days later; Back does not show the Sign up form | 4 |
| T16 | e2e | Sign up with an email registered through `e2e/helpers.ts` | Still `/sign-up`; the message under Email; the Email box border is the red token | 6 |
| T17 | e2e | Signed in: open `/sign-up` and `/forgot-password` | `/overview` both times; neither form ever visible | 9, 16 |
| T18 | e2e | Keyboard on Sign up: Tab through; click "Sign in here" with the mouse. Delay the sign up with `page.route` and press Enter | Focus order Name, Email, Password, eye, Sign up, Google, Sign in here (never "terms of service."); teal 2px ring with 2px offset on "Sign in here"; no ring after a mouse click; "Sign up" keeps focus while loading | 3, 7, 8 |
| T19 | e2e | Keyboard on Forgot Password: Tab through; press Enter in Email with `abc`, and click "Password Reset" with a valid email, recording requests | Focus order Email, Password Reset, Back to login; ring on "Back to login"; no request to `/api` after the page load; no message; URL unchanged | 13, 14 |
| T20 | e2e | Name focused and filled, Email empty, Password filled: Active border | Only the focused field has `--color-input-active`; the others `--color-input-border` | 10 |
| T21 | e2e | `/sign-up` and `/forgot-password` at 1440x1024 | Column x 520 to 920; each element's box within 2px of the positions measured on 102 and 103 (Validation step 4) | 1, 12 |
| T22 | e2e | Login "Create an account", then "Sign in here", then "Forgot Password?", then "Back to login" | `/sign-up`, `/login`, `/forgot-password`, `/login`, with no full page load; task 009's `login.spec.ts` passes with the moved helpers | 3, 13, 17 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`). Ports 3000 and 5173 free first.
4. Visual: Playwright MCP screenshots at 1440x1024, compared element by element with the PNGs. Positions in CSS px from the PNG rows (2x, halved), approximate; measure them exactly:
   - `/sign-up` with Name focused and "Tanzir Rahman" typed, Email empty, Password 14 masked characters, vs `docs/figma/102. Signup.png`:
     - logo x 584–857, y 112–142
     - "Create an account" glyphs x 613–827, y 185–204
     - Name input y 276–324 (label glyphs y 250–263)
     - Email input y 380–428, Password input y 484–532
     - terms text glyphs x 521–838, y 568–582
     - Sign up y 604–652
     - "or sign up with" glyphs y 688–702, lines x 549–891
     - Google y 736–784
     - "Already have an account? Sign in here" glyphs x 575–865, y 829–846
   - `/forgot-password` empty, vs `docs/figma/103. Forgot Password.png`:
     - logo y 230–260 (built at 228, #99 b: a 2px difference expected)
     - "Forgot Password?" glyphs x 616–825, y 309–333
     - text line 1 glyphs x 572–869, y 352–370; line 2 x 636–804, y 378–396
     - Email input y 466–514 (label glyphs y 439–453)
     - Password Reset y 546–594
     - "Back to login" glyphs x 671–769, y 623–640

   Save to `.claude/tasks/evidence/010/` and list every difference.
5. Manual browser checks with Playwright MCP on `npm run dev`:
   - From Login, "Create an account"; sign up a new user; land on Overview; Back; reload (still signed in).
   - Sign up again with that email; field errors; loading with a held request (focus stays on "Sign up"); a 500 and a refused connection.
   - Tab through both screens and check the rings; click "terms of service." and "Continue with Google".
   - Forgot Password: "Password Reset" empty, with `abc`, with a valid email; check the network log; "Back to login".
   - Signed in, open `/sign-up` and `/forgot-password`.
   - Save screenshots of the undesigned states (field errors, email taken, loading, server error, link rings) to `.claude/tasks/evidence/010/`.

## Human checkpoint (only if Gate: human)
- Sign up matches 102 and Forgot Password matches 103 at 1440x1024: logo, heading, text lines, fields, placeholders, buttons, divider, the teal and gray links (color, size, weight, position), and the listed differences, including the 2px line pitch of the Forgot Password text.
- Undesigned states: field errors with the red border, "An account with this email already exists" under Email, the server error above "Sign up", the loading button, the teal ring on "Sign in here" and "Back to login".
- A new account lands on Overview, signed in for 30 days, with the demo dataset (seen on Overview from task 013).
- #99 as applied: a signed-in user on Forgot Password goes to Overview (`GuestOnly`); the 103 logo top is 228px, 2px above the PNG.
- Choices accepted at detailing (Marko, 2026-10-25), as built:
  - "terms of service." is plain teal text, not focusable, as the other visual-only items;
  - the email-taken message is text only, and the designed "Sign in here" at the bottom is the link #15 means;
  - "Sign in here" carries no `returnTo` (after sign up always Overview, #3);
  - Forgot Password is a react-hook-form form whose submit does nothing, with `noValidate`;
  - the moved helpers: `serverFieldErrors` in `client.ts` (now also for a 409), the link ring in `AuthLayout`, the E2E helpers in `e2e/helpers.ts`.
- The security review findings and their fixes.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-25, detailing (`/next-task 010`)
- Detailed from the outline row with Marko's notes:
  - reuse tasks 002, 007, 008 and 009, nothing redeclared;
  - Sign up by US-02, #15, #95 (`signUpRequestSchema` and its messages), #63, #51 and #97 (a 4xx's message; "Something went wrong." for a 5xx or a network failure), under `GuestOnly` (#3);
  - after sign up Overview, with the seeded demo data (#78);
  - Forgot Password by US-03 and #16: visual only, no request, ready for a later reset flow;
  - the Google button visual only until task 012; focus #87;
  - the visual checks against `102. Signup.png` and `103. Forgot Password.png` (flattened, #37) at 1440x1024.
- Measured on the PNGs with a Node script (built-ins only, outside the repo), no Figma calls:
  - every text color on 102 and 103 is an existing token (`--color-form-label`, `--color-input-active`, `--color-auth-muted`, `--color-primary`, `--color-gray-01`, `--color-gray-02`), so no color question;
  - the approximate positions in Validation step 4.
- Scope choices (for review with the task): the four "Choices made at detailing" in the Human checkpoint, and the moved helpers in Scope "Reuse first".
- Raised **#99 (open)** in `docs/decisions.md`:
  - (a) what a signed-in user who opens Forgot Password sees: #3 names only Login and Sign up;
  - (b) the 103 logo top measures 230px, exactly between two 4px steps (#65).

  This task waits for #99.
- INDEX: row 010 cites the decisions this file uses, with #99 open; the open questions line lists #94 and #99.
- Not started. No Figma calls.

### 2026-10-25, #99 closed
- Marko's answers, recorded in `docs/decisions.md` #99 (closed, Marko, 2026-10-25):
  - (a) As proposed: Forgot Password is under `GuestOnly`; a signed-in user goes to Overview.
  - (b) As proposed: the 103 logo top is 228px.
- Also accepted by Marko:
  - "terms of service." as plain teal text, not focusable;
  - the email-taken message as text only, with the drawn "Sign in here" as its link;
  - no `returnTo` on "Sign in here";
  - the Forgot Password text with the 24px line height, the 2px difference listed.
- Updated: References, Scope (Forgot Password, Routes), AC16, T12, T17, Validation step 4 (the 103 logo) and the Human checkpoint.
- INDEX: row 010 cites #99 as closed; the open questions line lists #94 only.
- Not started: Marko asked for the detailing commit only. No Figma calls.

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
