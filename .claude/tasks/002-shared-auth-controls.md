# Task 002: Shared components: form controls, auth layout and dev gallery

- Status: todo
- Gate: human
- Depends on: 000
- Size: M
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `frontend-design:frontend-design` (undesigned states only: field error, form error, loading, disabled, and variants with no visual reference)

## Goal
The form controls and the auth page frame shared by Login, Sign up and Forgot Password (and reused by every later form) exist as tested components. A development-only gallery shows every state.

## References
- Spec: `docs/spec/stories.md` US-01 criteria 1 to 5, 11 and 15; US-02 criteria 1, 2, 8, 13 and 14; US-03 criterion 1; `docs/spec/brief.md` Layout (auth screens) and States (forms)
- Figma: Input set `402:5191`, Button/primary `402:5239`, Button/secondary `402:5233`, Remind me `402:5226`, Icon/eye `402:5244`, Icon/eyeoff `402:5247`; Login form `137:8302` (inputs `402:5484` / `402:5488`, Remind me `402:5493`, buttons `402:5499` / `402:5501`). PNGs: `docs/figma/101. Login.png`, `docs/figma/102. Signup.png`, `docs/figma/103. Forgot Password.png`
- Names: `docs/figma/components.md` (Code name column)
- Decisions: `docs/decisions.md` #6, #13, #36, #51, #63, #66, #70

## Scope
- Components in `frontend/src/components/<CodeName>/`, CSS Modules with tokens only:
  - `Input`, variants Type=Name-Email, Password and Show Password, and Active=Yes/No:
    - A label above the field, with an optional right-aligned action in the label row ("Forgot Password?" on 101).
    - A placeholder only when one is given (#63).
    - The Active (darker) border only while the field has focus; filled or empty fields without focus keep the normal border (#63).
    - The password type is masked, with `IconEye` at the right edge. Clicking it switches to the Show Password variant (visible text, `IconEyeOff`) and back, frontend only (#51).
    - An optional inline error under the field (#6).
    - Refs are forwarded and `name`, `onChange` and `onBlur` are passed through, so react-hook-form `register` works.
  - `ButtonPrimary` (Active=Yes/No): teal, label from children, width from the parent. States: default, disabled, and loading. Loading means disabled with a `Spinner` and `aria-busy` while the label stays readable to screen readers (#6). Clicks do nothing while disabled or loading.
  - `ButtonSecondary` (Icon=Yes/No): the gray button with an optional leading icon. Login and Sign up use the Google G brand image from task 000 (#70).
  - `RemindMe` (Active=Yes/No): a checkbox with its label, built on Radix Checkbox. Checked is teal with a white check, as in 101; unchecked is Active=No. A click on the box or the label, or Space, toggles it, and it works with react-hook-form `Controller`.
  - Code-only components (no Figma component), added to a new "Code-only components" table in `docs/figma/components.md` with purpose and decision:
    - `FieldError`: the inline message under a field (#6).
    - `FormError`: the server error above the submit button, `role="alert"` (#6).
    - `Spinner`: the loading indicator inside buttons (#6).
    - `AuthLayout`: the light gray full-page frame with a centered 400px column and the `Logo` in primary teal through `color` (#66, #70), at the size measured on 101, 102 and 103 (the same on all three). Each screen sets its own top offset.
    - `TextDivider`: centered gray text with a line on each side ("or sign in with", "or sign up with").
- Icons missing from the export: the white check mark in `RemindMe`. First check that no exported icon matches. If none does, copy the Lucide `check` SVG as a file into `frontend/src/assets/icons/` (no package; #66 allows Lucide for missing icons; ISC license noted in the Log), converted to `currentColor` like the others.
- Variants that no screen PNG shows: `RemindMe` Active=No, `ButtonPrimary` Active=No, `ButtonSecondary` Icon=No, and `Input` Show Password. Use the first reference available:
  1. A manual 2x PNG export of frame `418:6433` in `docs/figma/components/`, if I added one.
  2. One `get_screenshot` of `418:6433`, only after I approve it. Log the call in `docs/figma/inventory.md` and `docs/metrics.md`.
  3. Otherwise, build from tokens with `frontend-design:frontend-design` and list them in the Log as "not verified against Figma".
- Dev gallery at `/dev/components`:
  - The route is registered only when `import.meta.env.DEV` is true, so production builds do not contain it.
  - One section per component shows every designed state and every undesigned state (error, disabled, loading, unchecked, Show Password).
  - Later shared-component tasks add their own sections. Later route guards must leave this route reachable in development.
- A guard test: every component exported from `frontend/src/components/` has its name in the Code name column of `components.md` or in the Code-only table.

## Out of scope
- The Login, Sign up and Forgot Password screens, their links, texts, validation rules and submit behavior (tasks 009, 010).
- `Input` Type=Phone number and `SettingsInput` (task 028).
- `GoalPopupInput`, the amount input and `Dropdown` (task 005). The app shell (task 003).
- Any API call.

## Acceptance criteria
1. Given an `Input` with a label, then the label is linked to the field, no placeholder shows unless one is given, and the field has the normal border while it has no focus, empty or filled. Given it has focus, it shows the Active border (#63), matching the Email field in 101 and the Name field in 102.
2. Given a password `Input`, then the characters are masked and `IconEye` shows at the right edge. Given I click the icon, the text shows and `IconEyeOff` appears; clicking again masks it. The toggle is a `type="button"` with an accessible name ("Show password" / "Hide password") and does not submit the form (#51).
3. Given a label action, then it shows right-aligned in the label row, as "Forgot Password?" in 101.
4. Given an `error`, then `FieldError` shows the message under the field, and the field gets `aria-invalid="true"` and `aria-describedby` pointing to the message (#6).
5. Given a react-hook-form form with a Zod resolver, then `Input` and `RemindMe` register like native fields: typed values reach `handleSubmit`, and a failing field shows its message through `FieldError`.
6. Given `ButtonPrimary`, then it renders as in 101 ("Login"). Given `disabled`, clicks do nothing. Given `loading`, it is disabled, shows `Spinner`, sets `aria-busy="true"`, keeps its label for screen readers and ignores clicks (#6).
7. Given `ButtonSecondary` with an icon, then it renders as "Continue with Google" in 101 and 102 with the Google G (#70). Without an icon, only the label shows.
8. Given `RemindMe` checked, then it shows the teal box with a white check, as in 101. Given I click the box or the label, or press Space while it has focus, it toggles between checked and unchecked, and `aria-checked` follows.
9. Given `FormError` with a message, then it shows the message with `role="alert"` (#6).
10. Given `AuthLayout`, then the page is light gray and fills the viewport. The 400px column is centered horizontally at 1440, and the logo is centered at the top of the column in primary teal (CSS `color`, #70), at the size measured from 101.
11. Given `TextDivider` with "or sign in with", then the text is centered with a line on each side, as in 101.
12. Given `npm run dev`, then `/dev/components` shows every component in every state listed in Scope. Given `npm run build`, then `frontend/dist` contains no gallery code.
13. Given the component folder, then every exported component name is in `docs/figma/components.md` (Code name column or Code-only table), and all CSS uses tokens only (Stylelint).

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | Render `Input` with label "Email Address", no placeholder prop; then with placeholder "hello@example.com" | `getByLabelText` finds the field; no placeholder attribute, then the given one | 1 |
| T2 | e2e | Gallery: focus the Email input, then blur it after typing | Focused border color equals the Active token; blurred filled field shows the normal border token | 1 |
| T3 | unit | Password `Input`: type "secret12", click the eye, click again, inside a form with `onSubmit` spy | `type` goes password, text, password; icon and accessible name swap; `onSubmit` never called | 2 |
| T4 | unit | `Input` with label action "Forgot Password?" | Action renders in the label row, after the label | 3 |
| T5 | unit | `Input` with `error="Email is required"` | Message under the field; `aria-invalid="true"`; `aria-describedby` matches the message id | 4 |
| T6 | unit | Test form (react-hook-form, Zod resolver, test-only schema): submit empty, then fill and submit; toggle `RemindMe` | Empty submit shows `FieldError`, no submit; filled submit receives the typed value and the checkbox value | 5 |
| T7 | unit | `ButtonPrimary` default, `disabled` and `loading`, each clicked | Default calls `onClick`; disabled and loading do not; loading has `aria-busy="true"`, a `Spinner` and an accessible name equal to the label | 6 |
| T8 | unit | `ButtonSecondary` with and without the Google icon | Icon image with alt text present, then absent; label always present | 7 |
| T9 | unit | `RemindMe` `defaultChecked`: click the box, click the label, press Space | `aria-checked` goes true, false, true, false | 8 |
| T10 | unit | `FormError` with "Email or password is incorrect" | Text present with `role="alert"` | 9 |
| T11 | e2e | Gallery `AuthLayout` at 1440x1024 | Column is 400 wide and centered (x 520 to 920); logo computed `color` equals the primary token; page background equals its token | 10 |
| T12 | unit | `TextDivider` with "or sign in with" | Text present, with a line element on each side | 11 |
| T13 | e2e | Dev server `/dev/components` | Every section renders with no console errors | 12 |
| T14 | unit | After `npm run build`, search `frontend/dist` for the gallery marker | Not found | 12 |
| T15 | unit | Names in `frontend/src/components/` vs `components.md` | Every exported component name is listed | 13 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass.
2. Unit tests pass.
3. E2E tests pass.
4. Visual: Playwright MCP screenshots of the gallery at 1440x1024, compared element by element with crops of the PNGs. Positions are CSS px after halving, approximate; measure them exactly:
   - `101. Login.png`: logo x 583–857, y 158–193; Email input (Active, filled) x 520–920, y 288–336; Password row with "Forgot Password?" y 360–380, Password input (masked, normal border) y 392–440; `RemindMe` checked y 474–494; Login button y 512–560; `TextDivider` y about 602; Google button y 644–692.
   - `102. Signup.png`: Name input (Active, filled) y 276–324; Email input with placeholder y 380–428; Sign up button y 604–652.
   - `103. Forgot Password.png`: Email input with placeholder y 466–514; Password Reset button y 546–594.
   Save the screenshots to `.claude/tasks/evidence/002/` and list every difference.
5. Manual browser checks with Playwright MCP in the gallery: focus and blur each input, type in the password field and toggle the eye, toggle `RemindMe` with mouse and Space, tab through all controls.

## Human checkpoint (only if Gate: human)
- Each component matches its PNG crop: borders, radii, colors, type, sizes.
- Undesigned states (field error, form error, loading, disabled) and every variant marked "not verified against Figma" are acceptable.
- The dev gallery as the place to review shared components (development only, not in the build).
- The check mark source (exported icon or copied Lucide SVG).

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
