# Baseline metrics (version 1)

## Figma MCP calls (limit 20 per month)
| Date | Command | Calls | Total used |
|------|---------|-------|------------|
| 2026-10-23 | `/next-task 000` (step 7, `get_variable_defs` on `56:1396`, failed: nothing selected) | 1 | 4 (3 by `/write-spec` on 2026-10-22, see `docs/figma/inventory.md`) |
| 2026-10-23 | `/next-task 000` (step 7, `get_variable_defs` on frame `418:6459`, approved retarget) | 1 | 5 |

## Tasks
Fill per task. This is the comparison point for version 2.

| Task | Time spent | Human interventions | Rework loops | Gate | Failed prompts / notes |
|------|-----------|---------------------|--------------|------|------------------------|
| 000  | 3h 39m (10:23 to 14:02, wall clock including human reviews) | 5 | 2 | human, approved after 1 rejection | Step 7 call on page `56:1396` failed (get_variable_defs needs a layer), retargeted to frame `418:6459`. Rework: 1 lint failure in validation, 1 rejection (`.gitattributes`, token rename, brief line) |
| 001  | 19m (14:14 to 14:33, wall clock including the #84 answers) | 2 | 1 | auto | #84 raised and answered (date day, lone `.`), date answer corrected mid-build. Rework: 1 Prettier failure in lint |
| 002  | 2h 7m (14:42 to 16:49, wall clock including human reviews) | 4 | 6 | human, approved after 1 rejection | Variant exports added by Marko on request; #86 raised and answered (checkbox radius, muted color). No Figma calls. Rework: 2 lint failures (mock type parameters, Prettier), 1 rejection (`calc()` in Stylelint, teal focus ring and red error border as #87), 3 lint failures while re-validating (JSDoc type on the wrong constant, Prettier) |
| 003  | 44m (16:52 to 17:36, wall clock including the human review) | 1 | 2 | human, approved | No Figma calls (Hover from the `66-1754.png` export). Rework: 1 lint failure (oxlint test rules), 1 e2e failure (a position assertion that assumed Figma's text metrics). Code review: 2 fixes (short-window sidebar, long greeting) |
| 004  | 1h 14m (17:52 to 19:06, wall clock including human reviews) | 2 | 4 | human, approved after 1 rejection | No Figma calls. #89 raised in code review and answered at the gate (keep the data on a failed background refetch). Rework: 2 lint and typecheck failures (oxlint rules, type narrowing), 1 e2e failure (a layout check compared viewport positions across a scroll), 1 rejection (#89). Code review: 2 important, 6 minor; fixed the weak Retry tests, the untested boundary reset, MenuTab modifier keys |
| 005  | 2h 21m (08:54 to 11:15, wall clock including two interruptions and the human review) | 1 | 1 | human, approved | No Figma calls. #90 raised in detailing and answered before the start, (c) corrected once. Session interrupted twice (connection drop, one false-positive safety stop); the cut-off task file was repaired and every validation step re-run with no failures. Rework: 1 (at least; renders retaken after fixes in the interrupted build, count not recorded). Code review: 2 important, 9 minor; fixed the spreadsheet paste (trailing line break), the numeric amount value type, the Dropdown ring after a click outside, the input trigger's open border, the discard-on-close docs; AC4 and T4 reworded at the gate; follow-ups added to rows 009 and 022 |

## Totals
- Total time:
- Total human interventions:
- Total rework loops:
- Biggest time sinks:
- What I would change in version 2:
