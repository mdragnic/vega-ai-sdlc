# Code review, task 022 (2026-11-02)

`superpowers:requesting-code-review`: a reviewer sub-agent, read-only, on `git diff HEAD` (base e5fad36), with the task
file, `docs/decisions.md` and `CLAUDE.md`. Verdict: **with fixes**. No Critical issue.

Strengths it named: the guard in one place and in order (after the 401, the normalized header compared, never raw,
answered before any account query, proven by recorded SQL; the guarded set derived from the registered routes); the
write is the ownership check (one `UPDATE` with both IDs, no read before it, only the three fields); one name rule for
the form, the API and the responses; the cache handling of AC13 and T17's snapshot test; the Escape handling; no
existing test weakened.

## Findings and rulings

1. **Important: the label-click workaround changed how every Dropdown opens.** The trigger's `onClick` cancelled every
   click without a pointer press before it, so Radix no longer opened any variant on such a click (assistive technology,
   `element.click()`), against the Scope's "every existing use unchanged". **Fixed:** the trigger's clicks are Radix's
   again; with `id` the Dropdown cancels only its labels' own activation (a click listener on `trigger.labels`) and
   focuses the trigger. Test first: "opens the box/plain/inline/input/comparison variant on a click with no pointer
   press" and "opens the labelled one ..." failed (6 failed), then passed; the label tests still pass; checked in the
   headed browser (Account Type and Statistics open on `element.click()`, the label click only focuses).
2. **Minor: a details refetch in flight could overwrite the saved values.** **Fixed:** `onSuccess` cancels the details
   query (`cancelQueries`, exact) before `setQueryData`. Test first: "keeps the response's details when a refetch of
   them, sent before the save, answers after it" failed (`checking` came back over `loan`), then passed.
3. **Minor: a server field error on Account Type is not tied to the select** (no `aria-describedby`, `aria-invalid` or
   red border). **Not changed:** only a direct API request can produce it (the form sends one of the five types), and
   the Scope limits Dropdown's new props to `id` and `disabled`. Listed at the gate.
4. **Minor: Escape during an IME composition discarded the edit.** **Fixed:** the form ignores an Escape whose native
   event `isComposing`. Test first: "keeps edit mode and the typing on an Escape that ends an IME composition" failed,
   then passed.
5. **Minor: the plan's wording "Balance and Account Number at view mode's places"** cannot hold for the Account Number
   (the first row grows by 32). **Listed** as a visual difference (`visual-differences.txt`) and at the gate.
6. **Nit: the label look is written three times** (Input, AccountDetailsForm, the gallery). **Not changed:** the
   gallery copy is dev-only, and a shared label component is outside the Scope.

## Declined to judge (the reviewer's list), my ruling
- Invisible "letters" (U+3164, U+2800) pass, bidi controls and other Cf inside a name are kept, U+2028/U+2029 pass:
  #120 b3 defines invisible as White_Space, Cc and Cf and refuses only Cc inside a name. As decided; no change.
- A lone surrogate sent through the API is stored as U+FFFD: API-only, the result valid. No change.
- Last write wins between tabs, no prompt on leaving, no undo, the guard not per session: chosen or out of scope.
- The guard's 400 text is developer-facing: the frontend cannot trigger it (`sendWrite` throws with no user). No change.
