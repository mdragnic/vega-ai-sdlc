---
description: Execute the next ready task, validate it, stop at its gate
---
1. Read `.claude/tasks/INDEX.md`. Pick the first task with status `todo` whose dependencies are all `done`. If `$ARGUMENTS` names a task, use that one instead.
   - If any task is `awaiting-human`, STOP and tell me which one.
   - If the picked task is still an outline row, detail it with `_TEMPLATE.md` first, show it to me and STOP.
2. Read the task file fully, including its Skills line. Check that every referenced decision in `docs/decisions.md` is closed. If not, STOP.
3. Set status `in-progress` in the task file and INDEX.md. Write the start time in Metrics.
4. List the files you will create or change. Stay inside Scope, never touch Out of scope.
5. Build with `superpowers:test-driven-development`: tests for the acceptance criteria first, then the implementation.
   - Charts: also follow `dataviz`, using design tokens and matching the PNG.
   - Only for states Figma does not design (loading, empty, error, focus, hover, open dropdowns): `frontend-design:frontend-design`, tokens only, no new colors, fonts or spacing. Never use it on anything that has a Figma design.
6. Run the validation steps in order. On failure: use `superpowers:systematic-debugging`, fix, re-run, add 1 to Rework loops. After 3 failed loops on the same step, STOP and report.
7. Visual validation: compare against the screen PNGs in `docs/figma/` (no Figma MCP calls), render with Playwright MCP at 1440x1024, save evidence to `.claude/tasks/evidence/<task>/`, list every difference you see.
8. If the Skills line includes `security-review` (auth, sessions, uploads, money, user scoping): run it and fix every finding before the gate.
9. Before any gate: `superpowers:verification-before-completion`. Every "passes" claim needs the command output that proves it.
10. Append to the task Log: what was done, decisions, validation results, review findings.
11. Gate:
   - `auto` and all checks green: set status `done`, write finish time, update INDEX.md, copy the task metrics row into `docs/metrics.md`, then commit following `.claude/templates/commit.md`.
   - `human`: first run `superpowers:requesting-code-review` on the task's changes and fix what it finds. Then set status `awaiting-human` and give me a short report: what changed, test results, review findings and fixes, visual differences, and the exact Human checkpoint list. STOP.
12. Never start the next task.

Do not use `superpowers:brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `using-git-worktrees` or `finishing-a-development-branch`: the task file is the plan and this command is the execution.
