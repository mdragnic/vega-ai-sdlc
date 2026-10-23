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

## Totals
- Total time:
- Total human interventions:
- Total rework loops:
- Biggest time sinks:
- What I would change in version 2:
