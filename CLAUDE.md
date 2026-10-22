# Project: Finebank


Source of truth:
- Spec: `docs/spec/` (requirements). If code and spec disagree, the spec wins. If the spec is unclear, STOP and ask.
- No spec given: `/write-spec` drafts `docs/spec/brief.md` and `docs/spec/stories.md` from Figma. After human review they are the spec.
- Saved Figma screenshots and inventory: `docs/figma/`. Reuse them, Figma calls are rate limited.
- Design: Figma file https://www.figma.com/design/wZQT9xEAtFjkZtlxvVtpPu/Finebank---Financial-Management-Dashboard-UI-Kits--Community---Copy-
  - Screens (the app): node 66:4728
  - Components and design system (tokens source, no stories): node 56:1396
  - Ignore (cover, archive, drafts): node 450:2678
- Decisions made during clarification: `docs/decisions.md`


## Conventions
- Use design tokens only. No hardcoded colors, font sizes, spacing or radii.
- Reuse components from `{{src/components}}` before creating new ones.
- Figma component map: `docs/figma/components.md`. Code components use the same names as their Figma components.
- One component per file. Name files {{PascalCase.tsx}}.
- Every acceptance criterion in a task maps to at least one test.

## Task workflow (mandatory)
- Tasks live in `.claude/tasks/`. Index and status: `.claude/tasks/INDEX.md`.
- Work on exactly ONE task per session. Never start the next task on your own.
- Never touch anything listed under "Out of scope" in the current task.
- Execute tasks only through `/next-task`. Human approval only through `/approve-task`.
- A task is done only when every validation step passes AND its gate is satisfied.
- Gate `auto`: you may mark done when all checks pass.
- Gate `human`: stop, present evidence, set status `awaiting-human`. Do not mark done yourself.

## Visual validation rules
- Viewport: 1440x1024 desktop only. No mobile design exists.
- Get the reference with Figma MCP (screenshot of the task's node ID), render the page with Playwright MCP at the same viewport.
- Report differences in layout, spacing, typography, color and missing elements. Never claim "pixel perfect".
- Save screenshots to `docs/figma/` (reference) and `.claude/tasks/evidence/{{task}}/` (actual).

## Never
- Never call Figma MCP without asking me first. Budget is 20 calls per month. Use files in docs/figma/ (PNG exports, inventory.md, components.md) instead. Report every Figma call made.
- Never skip, weaken or delete a failing test to make it pass.
- Never mark a `human` gate task as done.
- Never invent requirements. Ambiguity goes to `docs/decisions.md` as an open question and you STOP.
- Never commit secrets or tokens.
