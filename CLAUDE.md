# Finebank

Personal finance dashboard, desktop only (1440x1024). React SPA, NestJS API, SQLite. Requirements are final: build what the spec says, nothing more.

## Where things are
- Spec: `docs/spec/` (brief, stories US-NN, demo data). Spec wins over code.
- Decisions: `docs/decisions.md`, cited as `#N`. Read the ones a story cites before building it.
- Design: `docs/figma/`: screen PNGs (the visual reference), `components.md` (Figma name to code name), `tokens.md`, `assets/`. Figma file: https://www.figma.com/design/wZQT9xEAtFjkZtlxvVtpPu (screens 66:4728, components 56:1396).
- Stack and versions: `docs/stack.md`, then `package.json`.

## Rules you would otherwise get wrong
- Money is integer cents everywhere, calculated only in the backend. Never decimal or float (#11).
- API request and response shapes exist once, as Zod schemas in `shared/src/contract/`. Import them; never redeclare a type or validation rule (#74).
- Every query is scoped to the signed-in user. Account and transaction data only through `BankDataProvider` (#75, #77).
- "Now" only from the injected Clock; the user's time zone only from `X-Time-Zone` (#54, #80).
- Database changes only through TypeORM migrations; `synchronize` is off outside tests (#79).
- Styles use tokens only: no raw colors, sizes, spacing, radii or shadows (Stylelint enforces it).
- Component names come from the Code name column in `docs/figma/components.md`. Reuse before creating.
- Not designed means visual only: build it as drawn, no behavior (decisions, general rule).
- No new dependency without asking.

## Commands
{{filled by task 000: install, dev, test, e2e, lint, typecheck, build, migrate}}

## Structure
{{filled by task 000}}

## Working on tasks
- One task per session, via `/next-task`. Approval only via `/approve-task`. Never touch a task's "Out of scope".
- Every acceptance criterion maps to at least one test.
- Visual checks compare against the PNGs in `docs/figma/` at 1440x1024. Demo numbers may differ from Figma (#12). Never claim "pixel perfect".

## Never
- Never call Figma MCP without asking me first. Use files in docs/figma/ (PNG exports, inventory.md, components.md) instead. Report every Figma call made.
- Never skip, weaken or delete a failing test to make it pass.
- Never mark a `human` gate task as done.
- Never invent requirements. Ambiguity goes to `docs/decisions.md` as an open question and you STOP.
- Never commit secrets or tokens.
