# Finebank

Personal finance dashboard, desktop only (1440x1024). React SPA, NestJS API, SQLite. Requirements are final: build what the spec says, nothing more.

## Where things are
- Spec: `docs/spec/` (brief, stories US-NN, demo data). Spec wins over code.
- Decisions: `docs/decisions.md`, cited as `#N`. Read the ones a story cites before building it.
- Design: `docs/figma/`: screen PNGs (the visual reference), `components.md` (Figma name to code name), `tokens.md`, `assets/`. Figma file: https://www.figma.com/design/wZQT9xEAtFjkZtlxvVtpPu (screens 66:4728, components 56:1396).
- Stack and versions: the `package.json` files (root, `frontend/`, `backend/`, `shared/`, `e2e/`).

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
- TypeORM entity relations use `Relation<T>` (ESM circular imports).
- Migrations run from the compiled data source in `backend/dist` (`npm run migrate`, `npm run migration:generate -- <Name>`), never through ts-node.
- The backend reads "now" only from `Clock` (`@Inject(CLOCK)`). The test-only clock route `/api/test/clock` exists only with `NODE_ENV=test`.

## Commands
- Install: `npm install`, then once `npx playwright install chromium` (Node 24 from 24.20.0, npm 11.19.0).
- Dev: `npm run dev` (shared in watch mode, backend on :3000, frontend on :5173). Open http://localhost:5173; `/api` is proxied to the backend.
- Test: `npm test` (Vitest in shared, backend and frontend).
- E2E: `npm run e2e` (Playwright, Chromium at 1440x1024, `NODE_ENV=test`, fresh test database, fixed clock and zone from `e2e/constants.ts`).
- Lint: `npm run lint` (oxlint type-aware, Stylelint, Prettier check). `npm run format` applies Prettier.
- Typecheck: `npm run typecheck`. Build: `npm run build`.
- Migrate: `npm run migrate`. New migration: `npm run migration:generate -- <Name>`.

## Structure
- `shared/` (`@finebank/shared`): `src/contract/` holds the API contract (Zod schemas, `ContractEntry`, the error shape). Built to `dist/` with tsc.
- `backend/` (NestJS, ESM): `src/config/` (env and data paths), `src/common/` (clock, error filter, `TimeZone` decorator), `src/database/` (data source, migrations). Tests in `backend/test/`. `backend/data/` holds the SQLite files and uploads (gitignored).
- `frontend/` (Vite, React): `src/app/` (providers, routes, pages), `src/api/client.ts`, `src/assets/` (`Logo`, icons by code name, brand logos), `src/styles/` (`tokens.css` generated from `docs/figma/tokens.md`, `global.css`). Tests in `frontend/test/`.
- `e2e/` (Playwright): `constants.ts` (fixed instant and zone), `fixtures.ts`, `tests/`.

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
