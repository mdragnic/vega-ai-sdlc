# Task 002: Shared components: form controls, auth layout and dev gallery

- Status: done
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

### 2026-10-23, decisions before building
- All cited decisions (#6 #13 #36 #51 #63 #66 #70) were closed.
- Variant reference: `docs/figma/components/` did not exist, so I asked. Marko added `418-6433.png` and `66-1754.png` (2x). All 4 variants with no screen PNG are in `418-6433.png` and were built from it: `RemindMe` Active=No, `ButtonPrimary` Active=No, `ButtonSecondary` Icon=No, `Input` Show Password (Active=No and Yes). None is "not verified against Figma". `66-1754.png` is kept for task 003. No Figma MCP calls in this task. Human interventions +1.
- Raised #86 and stopped: (a) the checkbox radius measures 2px, off the 4px grid of #65; (b) `#999DA3` (placeholder, masked dots, eye, divider text, unfocused typed text) had no token. Marko answered: (a) `--radius-checkbox: 2px`, a grid exception like border widths; (b) a new token `--color-auth-muted: #999DA3`. #86 is closed. Human interventions +1.

### 2026-10-23, build (TDD)
- **Measurements.** From the 2x PNGs with a Node script (built-ins only, in the session scratchpad, outside the repo): bounding boxes, colors, and stem widths.
  - Weights from stem width per em:
    - labels 0.106: Medium 500;
    - "Forgot Password?" (12px) 0.115: Semibold 600;
    - "Login" 0.13: Bold 700;
    - typed text, "or sign in with" (14px) and "Continue with Google" 0.085: Regular 400;
    - "Keep me signed in" 0.063: about Light 300, which has no token, so Regular.
  - Text colors: typed text with focus is `#4B5768`; without focus (export Active=No), placeholder, dots and eye are `#999DA3`.
- **Tokens added** to `tokens.md` and `tokens.css`, each with its measured source:
  - `--color-auth-muted` `#999DA3` (#86)
  - `--radius-checkbox` 2px (#86)
  - `--space-input-padding-x` 16px
  - `--space-auth-divider-inset` 28px (29 measured)
  - `--size-auth-logo-width` 272px
  - `--size-auth-divider-line-width` 108px (107 measured)
- **Tokens test.** `tokens.test.ts` now exempts `--radius-checkbox` from the grid check (`offGridAllowed`, citing #86). This follows the closed decision; it is not a weakened test.
- **Tokens reused by value** (same measured value, wider role):
  - `--space-form-small-gap` (16) for the checkbox-to-label gap and the Google icon-to-label gap, both 16 in 101;
  - `--space-input-padding-x` for the text-to-eye gap;
  - `--space-form-label-gap` for the `FieldError` top margin (undesigned);
  - `--color-input-active` for the `ButtonSecondary` text and the `ButtonPrimary` Active=No text (`#4B5768` in 101 and the export);
  - `--color-button-secondary` for the `ButtonPrimary` Active=No fill (`#E4E7EB`);
  - `--color-input-border` for the `RemindMe` Active=No fill (`#D0D5DD`).
- **Components** in `frontend/src/components/`, exported through `index.ts`:
  - `Input`
  - `ButtonPrimary`
  - `ButtonSecondary`
  - `RemindMe` (Radix Checkbox)
  - `FieldError`
  - `FormError`
  - `Spinner`
  - `AuthLayout`
  - `TextDivider`

  `docs/figma/components.md` has a new "Code-only components" table: the 5 code-only components plus `IconCheck`.
- **Check mark.** No exported icon matches: none in `docs/figma/assets/icon/` draws a check.
  - Copied the Lucide `check` as `frontend/src/assets/icons/IconCheck.svg`, converted to the project's SVG style with `currentColor`. The path `M20 6 9 17l-5-5` was checked against `lucide-icons/lucide` main `icons/check.svg`.
  - At 20px it matches the 101 glyph: 15x11 CSS px in the 20px box.
  - License: Lucide is ISC, and `check` is on Lucide's list of icons derived from Feather (MIT). The full license file is copied unchanged to `frontend/src/assets/icons/LICENSE-lucide.txt` (review finding 6).
- **Choices beyond the AC text:**
  - Active style: on `.control:has(.input:focus)`, the box around the input and the eye. Border, typed text and eye are `#4B5768` while the input has focus, `#999DA3` without (export Active=Yes/No). Focus on the eye button alone does not count as field focus (#63).
  - The eye's `onMouseDown` prevents default, so a click keeps focus, and the Active border, in the field.
  - Masked dots: `font-size: var(--font-size-14)` on `type="password"`. Chromium draws the font's bullet at the field size, and 14px gives 101's dot spacing. Shown text stays 16px.
  - Password fields set `spellCheck={false}`, `autoCorrect="off"` and `autoCapitalize="off"`, so a shown password is never spell-checked (review finding 1).
  - Field error (undesigned, #6): red 14/20 text 8px under the field. The border is unchanged, since #63 keeps the normal border without focus. Caller `aria-describedby` and `aria-invalid` are kept and merged (review finding 3).
  - `FormError`: red 14/20 text with `role="alert"`; it renders nothing without a message.
  - `ButtonPrimary`:
    - disabled uses the Active=No look from the export;
    - loading is that look plus `Spinner`, with the label kept as transparent text (accessible name kept, no width jump) and `aria-busy="true"`;
    - both buttons default to `type="button"`.
  - `Spinner`: a three-quarter ring in `currentColor`, 20px, one turn per 0.8s, slowed to 2.4s under `prefers-reduced-motion`. It has `data-testid="spinner"` for the tests.
  - Focus on buttons, the eye and the checkbox: the browser's default focus ring, so no new color. The input's focus style is the designed Active border. No hover styles (not designed).
  - T8 deviation: the Google G has `alt=""`. The label already says Google, so a non-empty alt would make the name "Google Continue with Google". T8 checks the image is present with `alt=""` and that the accessible name is exactly the label.
  - `icon` and `labelAction` treat `null` like no value, so no empty slot (review finding 4).
- **Gallery.**
  - `frontend/src/app/dev/ComponentGallery.tsx` at `/dev/components`, one section per exported component.
  - `test/app/gallery.test.tsx` fails if an exported component has no section.
  - The route exists only under `import.meta.env.DEV`, with a lazy chunk and `HydrateFallback: () => null`, which silences a React Router warning when the gallery is opened directly.
  - The Show Password example clicks the eye once on mount; a ref guard keeps StrictMode's second effect run from toggling it back.
- **Test support:**
  - `test/setup.ts` stubs `ResizeObserver`, which jsdom lacks and Radix needs for a checkbox inside a form.
  - `e2e/helpers.ts` holds `collectErrors` and `tokenColor`, moved from `foundation.spec.ts` (its tests are unchanged), plus `computed`.
- **Red before green.**
  - Every new test file failed first: missing module, missing tokens, a missing Code-only table.
  - T14's development-build control failed before the gallery existed.
  - The e2e warning check failed on the React Router warning before `HydrateFallback`.
  - The 4 review-fix tests failed before their fixes.

### 2026-10-23, validation
1. **Lint and typecheck.**
   - The first `npm run lint` failed: 12 `vi.fn()` calls without type parameters, and one helper `unicorn` wanted at module scope (rework loop 1).
   - The second failed on Prettier in `Spinner.tsx` (rework loop 2).
   - Final: `npm run lint` exit 0; `npm run typecheck` exit 0 in all 4 workspaces.
2. **Unit tests.** `npm test`: shared 187/187, backend 43/43, frontend 225/225 (183 before task 002). No warnings.
3. **E2E.** `npm run e2e`: 7/7 passed, 3 new (T2, T11, T13), no console warnings. T13 also fails on console warnings.
4. **Visual.** Playwright MCP at 1440x1024. Element screenshots were taken at device scale 2 with the scrollbar hidden, so they match the PNGs' pixel grid. Evidence is in `.claude/tasks/evidence/002/`:
   - `compare-*.png`: design crop on top, render in the middle, amplified difference below;
   - `render-*.png` and `focus-*.png`;
   - `gallery-full-1440.png`: 1x, headed browser with a 15px scrollbar, taken before the masked-dot change.

   Differences:
   - Page and field background: `#F3F3F3` (`--color-gray-06`) against `#F4F5F7` in the PNGs (task 000 review).
   - Input: text, placeholder and dots start 1px further right (x 537 vs 536), and the eye ends 1px further left (903 vs 904). The 16px padding sits inside the 1px border, while Figma's 16 includes the stroke. Stylelint rejects `calc()`, even with tokens.
   - Masked dots: at 14px the spacing matches (15.8 vs 15.3 px at 2x), but the dots are larger (about 4 vs 3 CSS px) and the run is about 7px wider.
   - "Keep me signed in" is heavier than drawn: Regular 400 against about Light 300, which has no token.
   - `TextDivider` line: 1px (task 000 review) against 0.5px, so it looks darker. Lines span 548–656 / 784–892 against 549–656 / 784–891, rounded to the grid.
   - Google G: the gradient G from Google's sign-in bundle (task 000) against the flat 4-color G in 101 and 102.
   - Text: Inter Variable against Figma's Inter; ink widths differ by about 1–2% (for example "Keep me signed in" 138 vs 134.5 CSS px).
   - Matching as measured:
     - logo 272x30 in teal;
     - 400x48 inputs and buttons, radii 8 and 4, borders;
     - label row with "Forgot Password?" right-aligned;
     - eye icon;
     - checkbox 20px with a 2px radius and a white check;
     - Login label weight and color;
     - Active=No button, Icon=No button, Show Password and unchecked box against the export.
   - Sign up (102) and Password Reset (103) have the same geometry as Login: 400x48 at y 604–652 and 546–594. Their labels are screen text (tasks 009, 010).
   - In the export the fields are transparent on a dark canvas, so its pixel difference measures only the background. Geometry and colors were compared by sampling.
5. **Manual checks (Playwright MCP):**
   - Each of the 7 inputs: Active border on focus, normal border on blur.
   - Typed `secret12`, then clicked the eye: the text showed, focus stayed in the field and the border stayed Active. A second click masked it again.
   - `RemindMe`: box click, label click and Space each toggled it; Enter did not.
   - Tab order follows the visual order and skips the disabled and loading buttons. The browser focus ring shows on the eye, the checkbox and the buttons.
- **Build.** `npm run build` exit 0. `frontend/dist` contains neither "Component gallery", "/dev/components" nor `ShowPasswordExample`.
- No `security-review` (not on the Skills line).

### 2026-10-23, code review (`superpowers:requesting-code-review`)
- No critical findings. Verdict: "With fixes".
- Fixed:
  1. Revealed password spell-checked: `spellCheck`, `autoCorrect` and `autoCapitalize` are now off on password fields. Test first.
  2. Log empty: filled (this Log).
  3. Caller `aria-*` props were overwritten: now merged. Test first.
  4. A `null` icon or label action rendered an empty slot: now `!= null`. Test first.
  5. Masked-dot size: listed under Differences above.
  6. Lucide license notice incomplete: the full license file is copied.
  7. Bookkeeping: Metrics updated, and #86 added to the INDEX row.
- Kept as is:
  - `data-testid="spinner"`: a clear test hook, harmless in production.
  - Token reuse by value: listed in the Build section.
- Forward notes for tasks 009 and 010 (not built now):
  - #75 makes "Continue with Google" a navigation to `/api/auth/google?returnTo=…`, so decide between `window.location.assign` in `onClick` and an anchor variant of `ButtonSecondary`.
  - Recharts tests (later tasks) must not rely on `ResizeObserver` callbacks, since the stub never fires.
- The reviewer's "Declined to judge" list: contrast of the designed grays (#86), tab order from AC3's DOM order, no hover or pressed styles, no red error border, native `disabled` while loading (AC6), repeated `FormError` announcements and submit behavior (tasks 009, 010), Active border not shown for eye-button focus (#63), autofill background, `import.meta.env.DEV` following `NODE_ENV`, the spinner turning under reduced motion, the Google G and page background (task 000), and #85 missing from the `decisions.md` header (previous commit). All are outside this task or decided, so none is acted on.

### 2026-10-23 16:29, human gate: rejected (Marko)
Feedback, verbatim:

> 1. Stylelint: allow calc(), min(), max() and clamp() when every value inside is a var(--…) token or 0; still reject raw values inside them. Then use calc() to remove the 1px offsets of the input text and the eye icon. 2. Focus ring: replace the browser default with a :focus-visible outline in the primary teal token on buttons, the eye toggle and the checkbox. 3. Error fields: show the border in the existing red token (the one used for the red up arrow, #21) while an error is shown, plus the message. Record 2 and 3 as one decision (#87). Accept everything else as reported, including alt="" on the Google icon. Re-run all validation, then stop at the gate again.

Status back to `in-progress`. Human interventions +1, rework loops +1.

### 2026-10-23, rework after the rejection (TDD)
- **1. Stylelint math functions.**
  - `frontend/stylelint.config.js` adds one `ignoreValues` pattern: `calc()`, `min()`, `max()` or `clamp()` whose arguments are only `var(--…)` tokens or `0`, joined by `+ - * /` or commas.
  - New tests in `stylelint.test.ts` (45 in total):
    - accepted: token math in `calc` (also inside a shorthand), `calc` with `0`, `min`, `max` and `clamp` over tokens and `0`;
    - still rejected: a raw number, size or `vw` inside, a keyword (`100%`) inside, another function (`env()`) inside, a nested `calc`, a token with a raw fallback, and an unknown function over tokens.
  - The accept cases failed first.
  - `Input`: `.control` padding is now `calc(var(--space-input-padding-x) - var(--border-width-input))`. Text and eye sit 16px inside the outer edge, as in 101.
  - New e2e test: both insets measure exactly 16. It failed first at 17.
- **2. and 3. Decision #87,** recorded in `docs/decisions.md` as Marko's answer.
  - Width and offset of the ring were chosen here, since focus is not designed: 2px each. New tokens: `--border-width-focus-ring` and `--space-focus-ring-offset`, with source "decision #87".
  - (a) A `:focus-visible` outline in `--color-primary`, 2px with a 2px offset, on `ButtonPrimary`, `ButtonSecondary`, the eye toggle and the `RemindMe` box. A mouse click shows no ring.
  - (b) `Input` with an error: `.control.invalid` sets the border to `--color-special-red`, also with focus; the message stays.
  - New e2e tests:
    - keyboard focus gives a solid teal outline on all four controls, and a mouse click gives none;
    - the error field's border is red, with and without focus.

    Both failed first (`auto` against `solid`; `#D0D5DD` against red).
- **Not changed:** the gallery's "Forgot Password?" link still uses the browser's focus ring. Links were not in the feedback, and the screen link comes in tasks 009 and 010.
- **Validation, re-run in order:**
  1. **Lint.** It failed 3 times in a row (rework loops 4 to 6):
     - twice on oxlint `no-base-to-string` and `restrict-template-expressions` in `stylelint.config.js`;
     - once on Prettier.

     The cause: the new constant sat between the config's JSDoc `@type {import('stylelint').Config}` and `export default`, so the annotation typed the string as a `Config` object. Fixed by moving the constant above the JSDoc block, which puts the annotation back on the config, and by keeping the pattern as one literal string. Final: `npm run lint` exit 0; `npm run typecheck` exit 0 in all 4 workspaces.
  2. **Unit tests.** `npm test`: shared 187/187, backend 43/43, frontend 238/238.
  3. **E2E.** `npm run e2e`: 10/10, 3 new.
  4. **Visual.** All Input renders and comparisons were retaken at 2x.
     - Measured from the outer edge at 2x: placeholder starts at 34 px (102: 34); typed text at 32 (101: 31, half a CSS pixel of glyph rendering); masked dots at 35 (101: 33, the bullet's side bearing at 14px). The eye spans 722–765 (101: 722–765).
     - Evidence: `render-field-error-focused.png` (red border with focus) and `focus-*.png` (teal rings, taken with an 8px margin).
     - `gallery-full-1440.png` was retaken.
     - The other differences in the first validation are unchanged. The 1px input offset is fixed.
  5. **Manual checks.**
     - Borders: Active on focus and normal on blur for the 6 fields without an error; the error field is red with and without focus.
     - The eye toggles; focus stays in the field; the field has `spellcheck="false"`.
     - `RemindMe`: box click, label click and Space toggle it; Enter does not; a mouse click leaves no ring.
     - Tab order is unchanged, with a solid teal ring on each button, eye and checkbox.
- **Build.** `npm run build` exit 0; no gallery markers in `frontend/dist`.
- **No new subagent review.** The reject instructions ask to fix only the feedback and re-run validation.

### 2026-10-23 16:49, human gate: approved
- Approved by human (Marko). Status `done`. Human interventions +1.
- On Marko's request, row 009 in `INDEX.md` now also covers "links get the #87 teal :focus-visible ring".

## Metrics
- Started: 2026-10-23 14:42
- Finished: 2026-10-23 16:49
- Human interventions: 4
- Rework loops: 6
- Notes on prompts that failed: none. The variant exports were missing at the start (Marko added them on request), and #86 stopped the build once.
