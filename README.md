# Finebank

Started from my spec-driven Claude Code template: https://github.com/MarkoDragnic/claude-sdd-template

A personal finance dashboard: accounts and balances, transactions, bills, expenses and savings goals. Every new user gets their own copy of a demo dataset on sign up.

Desktop only, full width. The design is drawn at 1440x1024; pages fill the whole screen, with a minimum width of 1280px. There is no mobile or tablet layout.

## What this project is

This is the baseline run of an AI-assisted software development lifecycle (AI SDLC) exercise. The whole app is built end to end with Claude Code, starting from nothing but a Figma file, and every step is recorded so a second run can be compared against it.

The process, all inside this repo:

| Phase | What happens | Where it lives |
|-------|--------------|----------------|
| Requirements | Claude drafts a product brief and user stories from the Figma screens; a human reviews and edits them | `docs/spec/` |
| Clarification | Every gap, contradiction and undesigned state becomes a numbered question, answered and closed by a human | `docs/decisions.md` |
| Stack and architecture | The stack is proposed, confirmed and locked; architecture choices are recorded as decisions | `package.json` files, `docs/decisions.md` |
| Planning | The work is split into small vertical slices with dependencies and gates | `.claude/tasks/INDEX.md` |
| Build | One task per session: tests first, then code, then validation, security review and code review | `.claude/tasks/NNN-*.md` |
| Gates | Logic-only tasks pass on green checks; anything visual, security-related or architectural stops for a human | the task's Human checkpoint |
| Evidence and metrics | Screenshots, comparisons and review reports per task; time, human interventions and rework per task | `.claude/tasks/evidence/`, `docs/metrics.md` |

Three rules run through everything:

- **Spec wins over code.** Unclear means a question in `docs/decisions.md`, never a guess.
- **No design, no feature.** Anything Figma does not draw is built visually only, unless a decision says otherwise.
- **Money is exact.** Integer cents everywhere, calculated only in the backend.

`CLAUDE.md` holds the short set of rules Claude reads in every session. The slash commands in `.claude/commands/` drive the workflow: `/write-spec`, `/clarify-spec`, `/set-stack`, `/plan-tasks`, `/next-task`, `/approve-task`.

## Status

Task progress is tracked in `.claude/tasks/INDEX.md`: the foundation, shared components, backend auth, data model and seeding, and the auth screens and app shell are done; the screen tasks follow.

## Repository layout

The repo holds a React single-page app, a NestJS API and an SQLite database, as npm workspaces:

| Folder | What it is |
|--------|------------|
| `frontend/` | React 19 SPA (Vite) on http://localhost:5173 |
| `backend/` | NestJS API on http://localhost:3000, under `/api` |
| `shared/` | `@finebank/shared`: the API contract (Zod schemas) and shared rules used by both |
| `e2e/` | Playwright end-to-end tests |
| `docs/` | Spec, decisions, Figma exports and tokens, metrics |
| `.claude/` | Claude Code commands, tasks, templates and settings |

In development the browser only talks to http://localhost:5173. Vite forwards `/api` to the backend, so there is one origin.

## Prerequisites

- Node.js 24, from 24.20.0
- npm 11.19.0

## Install

```sh
npm install
npx playwright install chromium   # once, for the end-to-end tests
```

## Configure the backend

```sh
cp backend/.env.example backend/.env
```

`backend/.env` is gitignored. `backend/.env.example` lists every variable the backend reads. Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; while they are empty, "Continue with Google" returns to Login with an error.

## Run

```sh
npm run migrate   # create or update the database: backend/data/finebank.sqlite
npm run dev       # shared (watch), backend :3000, frontend :5173
```

Open http://localhost:5173 and sign up. The development component gallery is at http://localhost:5173/dev/components.

Database changes go through TypeORM migrations only. To create one from entity changes:

```sh
npm run migration:generate -- CreateSomething
```

Every new migration must also be added to `backend/src/database/migrations/index.ts`.

## Test

```sh
npm test       # unit tests (Vitest) in shared, backend and frontend
npm run e2e    # end-to-end tests (Playwright, Chromium at 1440x1024)
```

The end-to-end run starts its own backend and frontend with `NODE_ENV=test`. It uses a fresh test database (`backend/data/finebank.test.sqlite`) with all migrations applied, and fixes the time and time zone (`e2e/constants.ts`). Stop `npm run dev` first, because both use ports 3000 and 5173.

## Check and build

```sh
npm run lint       # oxlint (type-aware), Stylelint (design tokens only), Prettier check
npm run typecheck
npm run build      # shared, backend (backend/dist) and frontend (frontend/dist)
```