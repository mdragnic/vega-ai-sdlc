# Task 001: Shared display rules: money, dates, percentages, names, amount input

- Status: done
- Gate: auto
- Depends on: 000
- Size: S
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `security-review`

## Goal
`@finebank/shared` exports the money schema and every display and input rule from the decisions as pure, tested functions. Every later task formats with these instead of by hand.

## References
- Spec: `docs/spec/brief.md` "Money and dates" and "Data" (profile names); `docs/spec/stories.md` US-04 criteria 6, 7 and 14; US-06 criteria 3, 13 and 14; the sample values in US-05 to US-17
- Figma: none (no visual output)
- Decisions: `docs/decisions.md` #11, #19, #54, #61, #62, #64, #74, **#82 (open: this task waits for it)**

## Scope
- `shared/src/contract/money.ts`: a Zod schema `Money = { cents: integer, currency: "USD" }` (#74, #11), with `cents` a safe integer. Its type comes from `z.infer`.
- `shared/src/format/`, all pure, with integer arithmetic only. No float division of cents, no `toFixed` on floats, no `parseFloat`.
  - `formatMoney(money)`: `$25,056.00`, with en-US separators and 2 decimals, and `-$1,234.00` for negatives (#11).
  - `formatSignedMoney(money, direction)`: `+$160.00` for income, `-$160.00` for expense (#19).
  - `formatCompactMoney(money)`: for chart axes and gauges (#11). Thousands with one decimal, rounded down, `.0` dropped (`$12.5k`, `$20k`); under 1,000 shown exactly (`$999`). Values of $1,000,000 and more, cents under $1,000, and negatives follow #82 once it is closed.
  - `formatPercent(n)`: a whole number from the backend shown without a leading zero (`8%`, `15%`, `120%`, `0%`) (#61).
  - `formatDate(value, timeZone?)`: `17 May, 2023` (#11). It takes a plain date `YYYY-MM-DD` (no zone), or a UTC ISO timestamp plus an IANA zone, read in that zone (#54).
  - `formatMonthLabel(year, month)`: `May, 2023` (#11).
  - `firstName(fullName)` is the first word; `initials(fullName)` is the first letter of the first and last word, uppercase, and one word gives one letter (#62). Extra spaces are ignored and letters outside ASCII are kept (`Šime Đurić` gives `ŠĐ`).
- `shared/src/amount-input/`: the amount field rules (#31, #64), with no `$` handling (the input shows it).
  - `isAllowedAmountInput(text)`: whether a value being typed may stand. Allowed: digits with an optional decimal point and at most 2 decimals. Commas, `$`, letters, spaces and a second point are rejected.
  - `parseAmountInput(text)`: integer cents, or `null` for an empty field.
  - `formatAmountInput(cents)`: the prefill text, with decimals only when they are not zero (`500000`, `1250.50`).
- Everything is exported from the package root and used in the frontend only for display. Totals, sums and percentages stay in the backend (#11).

## Out of scope
- Chart-specific labels: weekday labels (task 017), short day `01 May` (task 026) and 3-letter month labels (task 024). Y-axis tick calculation is backend work (task 017).
- Goal amount limits (Target greater than 0, maximum 1,000,000,000): these go in the goal contract schemas (task 014).
- Any component or screen.

## Acceptance criteria
1. Given a Money value, `Money` parses `{cents: 2505600, currency: "USD"}` and rejects non-integer cents, unsafe integers, a missing currency and any currency other than USD.
2. Given cents, `formatMoney` returns `$25,056.00` for 2505600, `$0.00` for 0, `$1,000,000,000.00` for 100000000000 and `-$1,234.00` for -123400.
3. Given a direction, `formatSignedMoney` returns `+$160.00` for income and `-$160.00` for expense with the same cents.
4. Given an amount for an axis or gauge, `formatCompactMoney` returns `$12.5k` for $12,500 and for $12,580, `$20k` for $20,000, `$1k` for $1,000, `$999` for $999 and `$0` for 0. Cases decided in #82 are covered once it is closed.
5. Given a whole-number percentage, `formatPercent` returns `8%`, `15%`, `120%` and `0%`.
6. Given a plain date `2023-05-17`, `formatDate` returns `17 May, 2023` in any zone. Given `2026-10-21T22:30:00Z`, it returns `22 Oct, 2026` in `Europe/Belgrade` and `21 Oct, 2026` in `UTC`.
7. Given 2023 and May, `formatMonthLabel` returns `May, 2023`.
8. Given `Tanzir Rahman`, `firstName` returns `Tanzir` and `initials` returns `TR`. `Marko` gives `M`. `  marko   van   dragnic ` gives `marko` and `MD`.
9. Given typed text, `isAllowedAmountInput` accepts ``, `0`, `12`, `12.`, `.5`, `12.5`, `12.50` and `500000`, and rejects `12.505`, `1,250`, `$12`, `12a`, `1.2.3`, `-5` and ` 12`.
10. Given allowed text, `parseAmountInput` returns `null` for ``, 0 for `0`, 125050 for `1250.5`, 29 for `0.29` (no float error), 50 for `.5` and 1200 for `12.`.
11. Given cents, `formatAmountInput` returns `500000` for 50000000, `1250.50` for 125050, `0` for 0 and `0.05` for 5.
12. No function in `shared/src/format/` or `shared/src/amount-input/` divides cents into a float. A unit test checks the source for `parseFloat`, `toFixed` and `/ 100`.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | `Money` parse: valid USD value; 12.5 cents; 2^53 cents; no currency; `EUR` | Valid passes; the other four are rejected | 1 |
| T2 | unit | `formatMoney`, table of cases incl. 0, 1 cent, negative, $1,000,000,000.00 | Exact strings as in AC 2 | 2 |
| T3 | unit | `formatSignedMoney` income and expense | `+$160.00`, `-$160.00` | 3 |
| T4 | unit | `formatCompactMoney`, table from #11 (`$12,500`, `$12,580`, `$20,000`, `$999`, `$1,000`, `$0`, `$1,099`) | `$12.5k`, `$12.5k`, `$20k`, `$999`, `$1k`, `$0`, `$1k` | 4 |
| T5 | unit | `formatCompactMoney`, #82 cases (millions, cents under $1,000, negatives) | As decided in #82 | 4 |
| T6 | unit | `formatPercent` 8, 15, 120, 0 | `8%`, `15%`, `120%`, `0%` | 5 |
| T7 | unit | `formatDate` plain date in 3 zones; UTC instant near midnight in `Europe/Belgrade`, `UTC` and `Pacific/Kiritimati` | Plain date is the same in all zones; the instant reads its local date | 6 |
| T8 | unit | `formatMonthLabel` | `May, 2023`, `Oct, 2026`, `Jan, 2022` | 7 |
| T9 | unit | `firstName` / `initials`: two words, one word, three words, extra spaces, non-ASCII letters | As in AC 8; `ŠĐ` for `Šime Đurić` | 8 |
| T10 | unit | `isAllowedAmountInput` table (allowed and rejected lists from AC 9) | Exact allow or reject per input | 9 |
| T11 | unit | `parseAmountInput` table incl. `0.29`, `999999999.99` | Exact integer cents, never off by one | 10 |
| T12 | unit | `formatAmountInput` table; round trip `parseAmountInput(formatAmountInput(c)) === c` for 0, 5, 125050, 50000000, 100000000000 | Exact strings; round trip holds | 11 |
| T13 | unit | Source check on `shared/src/format/` and `shared/src/amount-input/` | No `parseFloat`, `toFixed` or `/ 100` | 12 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass.
2. Unit tests pass.
3. E2E tests pass (the existing suite still passes; no new e2e test, since there is no UI).
4. Visual: none (no UI).
5. Manual browser checks: none.
6. `security-review` on the changes: money parsing and formatting are integer-only and reject malformed input.

## Human checkpoint (only if Gate: human)
- None (Gate: auto). Before the gate, #82 must be closed and its cases covered by T5.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-23, decisions before building
- #82 was closed before the task started; its cases are in T5. All other cited decisions (#11 #19 #31 #54 #61 #62 #64 #74) are closed.
- Raised #84 and stopped: (a) a full date with a day under 10; (b) a lone `.` in an amount field, which AC 9 lists neither as allowed nor rejected, but which must stand while typing `.5`. Human interventions +1.
- Marko answered: (b) a lone `.` is allowed while typing and counts as empty (no value); Target shows its required error, and an empty Present Amount saves 0 and then displays `$0`. (a) was first answered `01 May, 2023`, then corrected: full dates have no leading zero (`1 May, 2026`), month labels `May, 2026`, and only the chart short day (#42) has two digits (`01 May`). Human interventions +1. #84 is closed with both answers.
- For Marko: `docs/spec/brief.md` "Money and dates" does not mention #84 yet. That is spec text, so it is left unchanged (as in task 000). The rule "an empty Present Amount saves 0" belongs to the goal form and contract (task 014).

### 2026-10-23, build (TDD)
- Each unit followed red, then green. Every new test file failed first because its function did not exist yet.
- `shared/src/contract/money.ts`: `moneySchema` `{ cents: z.number().int(), currency: z.literal('USD') }`, with type `Money`. Zod 4's `int()` already accepts only safe integers (checked), so it has no extra bounds.
- `shared/src/format/`:
  - `cents.ts` is internal (not exported from the root). It checks for a safe integer and splits cents into dollar and cent digits as strings, so nothing is ever divided.
  - `money.ts`: `formatMoney`, `formatSignedMoney`, `formatCompactMoney`. The k/M unit keeps the first dropped digit and ignores the rest, which rounds toward zero, so negatives behave like positives (#82).
  - `percent.ts`: `formatPercent`.
  - `date.ts`: `formatDate` and `formatMonthLabel`, using date-fns and @date-fns/tz (#79). Inputs are checked with `z.iso.date()` and `z.iso.datetime()`, the same shapes as the contract (#74).
  - `name.ts`: `firstName` and `initials`. Names are NFC-normalized, so a letter typed with a combining mark still gives one initial (`Š`).
- `shared/src/amount-input/index.ts`: `isAllowedAmountInput`, `parseAmountInput` (cents built from the digit string with one `Number()` call), `formatAmountInput`. Allowed text too long for exact cents parses to a value above the safe integer range, which every money schema rejects.
- Choices beyond the AC text, all toward rejecting malformed input (the security focus in validation step 6):
  - Formatters throw `RangeError` on cents or percentages that are not safe integers.
  - `formatSignedMoney` rejects negative cents, because the direction gives the sign.
  - `formatAmountInput` rejects negative cents, which the field could not show.
  - `formatDate` throws on a timestamp without a zone, on an unknown zone, and on any other shape.
  - `parseAmountInput` throws on text the field does not allow.
- `formatMonthLabel(year, month)` takes month 1 to 12.
- `formatDate` was also tested with the process time zone switched at runtime (`Pacific/Pago_Pago`, `Pacific/Kiritimati`). Setting `TZ` before Node starts has no effect on this Windows machine, so a startup-only check would prove nothing. Mutation check: with `new Date(value)` in place of `parseISO`, the Pago_Pago plain-date test fails.
- T13 follows the `exact-versions` pattern: its detector is also tested against sample lines. Mutation check: adding `c / 100` to `format/money.ts` fails T13.

### 2026-10-23, validation
1. Lint: the first run failed on Prettier formatting in 3 new files (rework loop 1). Ran `prettier --write` on those 3 files. Re-run: `npm run lint` exit 0. `npm run typecheck` exit 0 in all 4 workspaces.
2. `npm test`: shared 187/187 (177 new: T1 8, T2 to T5 49, T6 6, T7 and T8 37, T9 8, T10 to T12 54, T13 15), backend 43/43, frontend 183/183. No warnings.
3. `npm run e2e`: 4/4 passed. No new e2e test, since there is no UI.
4. and 5. Visual and manual checks: none (no UI). `npm run build` exit 0. A node import of the built `@finebank/shared` finds all 12 functions at the root, and none of the internal helpers.
6. `security-review`: no findings, at any severity. The probes confirmed the following:
   - `parseAmountInput` refuses signs, exponents, hex, separators, whitespace and non-ASCII digits.
   - Overflow can never come back as a smaller safe value.
   - `moneySchema` rejects 2^53, NaN, Infinity, 1e21 and numeric strings.
   - Forward note for task 014: `moneySchema` allows negative cents on purpose (balances), so goal request schemas need their own non-negative and positive rules.

## Metrics
- Started: 2026-10-23 14:14
- Finished: 2026-10-23 14:33
- Human interventions: 2
- Rework loops: 1
- Notes on prompts that failed: none. #84 stopped the task once; its date answer was corrected mid-build, so 1 date test changed before any implementation existed.
