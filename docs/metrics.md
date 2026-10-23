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

## Totals
- Total time:
- Total human interventions:
- Total rework loops:
- Biggest time sinks:
- What I would change in version 2:
