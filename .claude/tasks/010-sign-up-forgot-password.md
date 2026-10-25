# Task 010: Sign up and Forgot Password screens

- Status: done
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
    - 409 email taken: `authMessages.emailTaken` ("An account with this email already exists") under Email, with the red border and `aria-invalid`; nothing above "Sign up". "Sign in here" stays where it is drawn: the message is text only (#15 "with the Login link as designed": 102 draws that link at the bottom, not in the message). The typed values stay. Focus moves to Email, the field with the error, so a screen reader reads the message through `aria-describedby` (the task 009 rule: focus goes to the first field with an error; no live region, `FieldError` unchanged; task 010 gate, Marko, 2026-10-25). The message goes when Email changes or the next submit starts.
    - 400 with `fieldErrors`: each message under its field (Name, Email, Password).
    - Any other 4xx in the shared shape: the server's `message` above "Sign up".
    - A 5xx, a network failure, or a response without the shared shape: "Something went wrong." above "Sign up", never the server's text.
    - A 400's server field errors do not move focus: "Sign up" keeps it (as on Login). After a 409 focus moves to Email (above).
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
- **Routes** (`frontend/src/app/routes.tsx`): `paths.signUp` and `paths.forgotPassword` join Login under `GuestOnly` (#3, #99 a). `GuestOnly` treats a sign up in progress like a login in progress (`useSessionStartInProgress`, both mutation keys): after a successful sign up the screen finishes and opens Overview itself, so no empty background shows if routes become lazy-loaded (task 010 gate, Marko, 2026-10-25).
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
6. Given the email is already registered, when I click "Sign up", then I stay on Sign up and "An account with this email already exists" shows under Email with the red border and `aria-invalid`, and nothing shows above "Sign up". My values stay, "Sign in here" is where it is drawn, and focus moves to Email, so a screen reader reads the message through `aria-describedby`. The message goes when I change Email (US-02 criterion 6; #15; task 010 gate).
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
| T5 | unit | MSW 409 `{ message, fieldErrors: { email } }` with `authMessages.emailTaken`; then edit Email | Message under Email, `aria-invalid` on Email only; no alert above "Sign up"; values kept; focus on Email, whose accessible description is the message; editing Email to a valid one removes the message | 6 |
| T6 | unit | Delayed sign up answered 500: click, click again, Enter in Password | Spinner, `aria-busy` and `aria-disabled`, not natively disabled; focus on the button; one request; focus kept after the response | 7 |
| T7 | unit | Sign up fails with 500 `{ message: "Internal server error" }`, 502 plain text, a network error, 403 `{ message: "<server text>" }`, 400 `{ message, fieldErrors: { fullName, password } }` | "Something went wrong." for 500, 502 and the network error, never "Internal server error"; the 403's text above "Sign up"; the 400's messages under Name and Password | 7 |
| T8 | unit | Click "terms of service." and "Continue with Google", with a request spy | URL unchanged; no request | 8, 11 |
| T9 | unit | `me` 200: `/sign-up`; `me` pending: `/sign-up`; `me` 500 on the first check: `/sign-up` | Overview; nothing but the page background while pending; the form after the failed first check (#97 b) | 9 |
| T10 | unit | Render `/forgot-password` signed out | Elements in AC12 order; heading level 1; Email placeholder "hello@example.com"; "Back to login" `href` `/login`; Email inside a `form` whose submit button is "Password Reset" | 12, 13, 15 |
| T11 | unit | "Password Reset" by click and by Enter: empty, `abc`, `marko@x.com`, with a request spy | No request; no `role="alert"`, no `aria-invalid`, no message text; URL unchanged; value kept | 14 |
| T12 | unit | `me` 200: `/forgot-password`; `me` pending: `/forgot-password` | Overview, the screen never renders; nothing but the page background while pending | 16 |
| T13 | unit | `serverFieldErrors` and the form error rule in `client.ts`: 400 and 409 with `fieldErrors` for the screen's fields, a 409 with a field not on the screen, a 401, a 500 | Field errors for 400 and 409; the message above the button when no field matches; Login's tests pass unchanged | 6, 7, 17 |
| T14 | unit | Source guard over `frontend/src` (as `login-source.test.ts`, extended to `signUpRequestSchema`'s messages and `authMessages.emailTaken`) | No literal match outside `@finebank/shared` (the dev gallery excluded, as in task 009) | 18 |
| T15 | e2e | Sign up through the UI with a new email in mixed case | One `POST /api/auth/signup` answered 201; URL `/overview`; `GET /api/auth/me` gives the user with the lowercased email; `finebank_session` expires about 30 days later; Back does not show the Sign up form | 4 |
| T16 | e2e | Sign up with an email registered through `e2e/helpers.ts` | Still `/sign-up`; the message under Email; focus on Email; the Email box border is the red token | 6 |
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
- Gate rework (Marko, 2026-10-25): after a successful sign up the screen opens Overview itself (`GuestOnly` waits for a sign up in progress, as for a login); after a 409 focus moves to Email and a screen reader reads the message.

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

### 2026-10-25, built (`/next-task 010`)
- **Reuse first**, as Scope asks:
  - `serverFieldErrors(error, fieldNames)` moved from `LoginPage.tsx` to `frontend/src/api/client.ts`. It now reads the `fieldErrors` of any 4xx in the shared shape (the 400 of #74, the 409 of #15). `formErrorFor(error, fieldNames)` beside it gives the text above the submit button only when no field error is for the screen. Login uses both; its 32 unit tests and `login.spec.ts` pass unchanged.
  - `session.ts`: `useLogin` and `useSignUp` share one `useSessionStart` (mutation key, `gcTime: 0`, `onMutate` cancels a running session check, `onSuccess` calls `setSessionUser`).
  - The link ring moved from `LoginPage.module.css` to `AuthLayout.module.css` (`.column a:focus-visible`).
  - E2E: `newUser`, `signUp`, `box`, `within2`, `control`, `sessionCookie`, plus `expectRing` and `expectNoRingOnMouseFocus` (review item 4), in `e2e/helpers.ts`; `login.spec.ts` and `demo-seeding.spec.ts` import them.
- **Screens:**
  - `SignUpPage.tsx` and `ForgotPasswordPage.tsx`, with their CSS modules, both under `GuestOnly` in `routes.tsx`. No new component. `GuestOnly`'s doc comment now names all three screens (review item 5); its code is unchanged.
  - Forgot Password: a react-hook-form `form` (`noValidate`), Email registered as `email`, one submit handler that does nothing yet (#16).
- **Tokens** (`docs/figma/tokens.md`, `tokens.css`), all measured on the 2x PNGs (Node built-ins script outside the repo, no Figma calls):
  - Sign up: `--space-sign-up-top` 112, `-logo-gap` 36, `-heading-gap` 32, `-terms-gap` 20, `-link-gap` 40.
  - Forgot Password: `--space-forgot-password-top` 228 (#99 b), `-logo-gap` 44, `-heading-gap` 16, `-text-gap` 36, `-link-gap` 24.
  - The other gaps reuse `--space-form-field-gap`, `--space-form-section-gap` and `--space-form-small-gap`.
- **Decisions made while building** (for Marko at the gate):
  - **Heading line height 32.** Both headings are Bold 24 as drawn: a render matches the glyph widths of 102 and 103 exactly. With the 28px line of the Bold 24-28 style, the gaps round either to 40 and 36 (fields 2.04px low, outside the 2px check) or to 36 and 36 (heading 3px high). The 32px line rounds them to 36 and 32: heading 1px high, fields 2px high. My first estimate of the cap offset was wrong (5.3 for 3.96); a render showed the heading 3px high and corrected it.
  - **Forgot Password text gap 16.** With the 24px line height (#99 detailing), the shorter pitch goes above the text: line 2, the field and the button sit where 103 draws them, line 1 is 2px low. With 12, line 1 would be 2px high and line 2 4px high.
- **TDD:** each test file was written first and run red (a stub page or no route; the two ring tests in E2E before the ring moved), then green.
  - Unit: `test/app/sign-up.test.tsx` (33), `test/app/forgot-password.test.tsx` (13); `test/api/client.test.ts` extended (T13); the source guard renamed `login-source.test.ts` > `auth-source.test.ts` and extended to the sign up messages (T14).
  - E2E: `e2e/tests/sign-up.spec.ts` (10), `e2e/tests/forgot-password.spec.ts` (5).
  - Every AC 1 to 18 maps to at least one test: T1 to T22 as in the table.
- **Validation** (final run after the review fixes):
  1. `npm run lint` exit 0; `npm run typecheck` exit 0.
     - Rework loop 1: oxlint `consistent-function-scoping` on a test helper inside a test (moved to module scope).
     - Rework loop 2: Prettier formatting in `sign-up.test.tsx` (applied).
  2. `npm test`: shared 503/503, backend 331/331, frontend 655/655.
  3. `npm run e2e`: 79/79 (15 new). The only console line is the gallery's expected "Money must be integer cents" demo (task 004).
  4. Visual: `/sign-up` (Name focused, "Tanzir Rahman", Password 14 masked) and `/forgot-password` at 1440x1024.
     - Files: `102-sign-up-1440x1024.png`, `103-forgot-password-1440x1024.png`, the 2x renders, `*-diff.png`, and the row table in `visual-differences.txt`.
     - Differences on 102:
       - (1) everything from the Name label down is 2px higher, the heading 1px (the measured gaps total 102, not on the grid);
       - (2) the terms line is 4px wider and heavier, same color `#4B5768` (likely a lighter weight in Figma; no type token below Regular);
       - (3) page background `#F3F3F3` against `#F4F5F7` (token review, as on Login);
       - (4) Chrome on Windows draws text slightly heavier.
     - Differences on 103:
       - (1) logo top 228 against 230 (#99 b);
       - (2) heading 1px higher;
       - (3) text line 1 2px lower, line 2 at the drawn y (24 against 26 line pitch);
       - (4) background as on 102;
       - Email, Password Reset and "Back to login" at the drawn y.
  5. Manual, Playwright MCP on `npm run dev` (`manual-checks.txt`):
     - sign up from Login, then Overview, Back and reload (still signed in); cookie 30.00 days, httpOnly, SameSite Lax;
     - the email in upper case again, field errors, loading with a held request (focus stays on Sign up), a 500 and a refused connection ("Something went wrong.");
     - tab order and rings on both screens; "terms of service." and Google do nothing;
     - Forgot Password sends no `/api` request in five tries;
     - signed in, `/sign-up` and `/forgot-password` give Overview;
     - screenshots `state-*.png`.
     - The dev-server node processes left on ports 3000 and 5173 were stopped before each E2E run.
- **Security review** (`evidence/010/security-review.md`): no findings. Checked XSS from server messages, the redirect after sign up, the cache clearing (#39), the password in the mutation cache (`gcTime: 0`), a 401 from sign up, the guards, CSRF and Forgot Password. The email-taken message is the discovery #15 accepts.
- **Code review** (`superpowers:requesting-code-review`): ready with fixes; 0 critical, 1 important, 5 minor.
  - Important 1, not changed, **for Marko**:
    - `GuestOnly` lets a login finish on its screen (`useLoginInProgress`), but not a sign up. After a 201 it sends the now signed-in user to Overview itself, so if Overview were lazy-loaded the form would give way to the empty background until Overview loads, instead of the busy "Sign up".
    - No user sees it today: all app routes are eager, and both navigations land together.
    - The fix is small (the in-progress check covers both mutation keys, and the unit test goes through `GuestOnly`), but Scope says "`GuestOnly` is unchanged", so it is not mine to change.
    - The unit test's comment now says it covers the screen alone.
  - Minor 2, not changed, **for Marko**: the email-taken message is not announced to screen readers. Focus stays on Sign up and `FieldError` is not a live region; AC6 rules out an alert above Sign up, and a live region would change the shared `FieldError`.
  - Minor 3, fixed: a unit test that the message above Sign up stays while typing and goes when the next submit starts, also when that submit stops at a field error. Mutation-checked: without `signUp.reset()` it fails.
  - Minor 4, fixed: the ring assertions are shared helpers in `e2e/helpers.ts`.
  - Minor 5, fixed: `GuestOnly`'s doc comment.
  - Minor 6, not changed: the 401 exemption names only login. A sign up 401 cannot happen, and if it did it fails safe (signed out, cache cleared).
- Also fixed after the manual check: the E2E Forgot Password test asserted an empty `validationMessage` after a valid value, which proved nothing. It now counts `invalid` events while submitting "abc"; on the live page that count is 2 without `noValidate` and 0 with it.
- Undesigned states reuse the existing #6 and #87 patterns (`FieldError`, `FormError`, `ButtonPrimary` loading, the teal ring), so no new visual decision was needed.
- No Figma calls. Gate: human, status `awaiting-human`.

### 2026-10-25, gate: rejected (`/approve-task 010`)
- Feedback, verbatim: "1. GuestOnly: treat a sign up in progress like a login in progress, so after a successful sign up the page finishes and opens Overview itself (no blank background if routes become lazy-loaded). 2. After a 409, move focus to the Email field (the task 009 rule: focus goes to the first field with an error), so screen readers announce the message through aria-describedby; no live region, no change to FieldError. Update AC6 and T5. Accept the 32px heading line height and the Forgot Password line pitch. Everything else at the gate is approved. Re-run all validation, then stop at the gate again."
- Status back to `in-progress`; Human interventions 1, Rework loops 3.

### 2026-10-25, gate feedback applied, validation and back to the gate
- **Fixed** with TDD (each changed test ran red first):
  - 1. `GuestOnly` waits for a sign up in progress as for a login. `useLoginInProgress` became `useSessionStartInProgress` (`frontend/src/api/session.ts`): it matches the login and sign up mutation keys exactly, pending or succeeded. `GuestOnly.tsx` uses it, and its comment names both. The unit test "stays busy after the 201 until Overview opens" now goes through `GuestOnly` with a slow, lazy Overview. Before the fix it failed (the form was gone after the 201); now Sign up stays busy until Overview opens.
  - 2. After a 409 focus moves to Email. `SignUpPage` calls `setError` with `shouldFocus` for the first server field error of a 409, so a screen reader reads the message through `aria-describedby`. No live region; `FieldError` is unchanged. A 400's field errors still leave focus on Sign up (AC7, T7); making the focus move apply to every status fails that test.
  - Tests:
    - T5 asserts focus on Email and the message as Email's accessible description.
    - T6 (focus kept after a failed request, AC7) now holds a 500 instead of a 409, since a 409 moves focus. Its assertions are unchanged.
    - E2E T16 asserts focus on Email, the description, and the red border with focus. T18's last assertion follows the 409: focus on Email.
- **Records**: Scope (the 409 bullet, the server field errors bullet, Routes), AC6, T5, T6 and T16 in this file, and one line in the Human checkpoint.
- **Accepted by Marko** at the gate: the 32px heading line height and the Forgot Password line pitch.
- **Validation** (all steps, in order):
  1. `npm run lint` exit 0; `npm run typecheck` exit 0.
  2. `npm test`: shared 503/503, backend 331/331, frontend 655/655.
  3. `npm run e2e`: 79/79. Ports 3000 and 5173 were free before it.
  4. Visual: `102-sign-up-2x-rerun.png` and `103-forgot-password-2x-rerun.png` have 0 differing pixels from the earlier renders, so the listed differences stand (`visual-differences.txt`).
  5. Manual, Playwright MCP on `npm run dev`, all passed (`manual-checks.txt`, rerun section):
     - after the 201 the busy form stays until Overview replaces it (a MutationObserver saw no empty page);
     - the 409 focuses Email, which reads the message, with the red border;
     - a 400 leaves focus on Sign up;
     - the other checks as before; the `state-*.png` screenshots are from this run;
     - the leftover dev-server processes were stopped afterwards.
- **Reviews**: `security-review` and the code review were not run again; the feedback asked for two changes. My own check is in `security-review.md` (gate rework section): a signed-in visitor is still redirected, and the focus change adds no markup.
- No Figma calls. Gate: human, status `awaiting-human`.

### 2026-10-25, gate: approved (`/approve-task 010`)
- Approved by human. Status `done` at 19:32.

## Metrics
- Started: 2026-10-25 17:48
- Finished: 2026-10-25 19:32
- Human interventions: 2
- Rework loops: 3
- Notes on prompts that failed: none. Rework: 2 lint loops (oxlint function scoping on a test helper, Prettier). The `security-review` skill's diff against `origin/main` was empty for uncommitted changes; the sub-task was pointed at `git diff HEAD` and the untracked files. The `security-review` skill again asks for a reply with only its report; the report went into the evidence file and the task continued to the gate. Gate rework 1: GuestOnly waits for a sign up in progress, and a 409 moves focus to Email (both from the code review findings left for Marko).
