---
description: Turn the clarified spec into a task outline and fully detail the next tasks
---
Preconditions:
- `docs/stack.md` exists and lists the locked stack. If it does not, tell me to run `/set-stack` and STOP.
- `docs/decisions.md` has no open questions that affect planning. If it does, list them and STOP.

1. Create the full task outline in `.claude/tasks/INDEX.md`: one row per task, vertical slices (one feature end to end per task), with gate and dependencies. Task 000 already exists, start features at 001.
2. Gate rule: `human` for anything visual, UX, layout or architecture. `auto` only for pure logic fully covered by tests.
2b. If `docs/figma/components.md` exists: components used in 2 or more screens become their own tasks right after 000 (e.g. "Shared components: sidebar, header, card"), grouped so each task stays small. Screen tasks depend on them and must reuse them, never rebuild them. Gate for component tasks: human (visual).
3. Fully detail ONLY the next 2 to 3 tasks using `.claude/tasks/_TEMPLATE.md`, with real Figma node IDs and PNG file names from `docs/figma/inventory.md`, numbered acceptance criteria and test scenarios covering happy path, edge cases and error states.
4. Fill each detailed task's Skills line from this list, only what applies:
   - Always: `superpowers:test-driven-development`, `superpowers:verification-before-completion`
   - Gate human: `superpowers:requesting-code-review`
   - Touches auth, sessions, uploads, money or user scoping: `security-review`
   - Contains a chart or gauge: `dataviz`
   - Has states Figma does not design (loading, empty, error, focus, hover, open dropdown): `frontend-design:frontend-design` (undesigned states only)
5. Leave other tasks as outline rows only.

Do not use `superpowers:brainstorming` or `superpowers:writing-plans`: this command is the planning step.

Show me the outline and the detailed tasks, then STOP for review.
$ARGUMENTS
