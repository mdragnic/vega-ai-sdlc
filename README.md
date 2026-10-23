# Finebank

A personal finance dashboard: accounts and balances, transactions, bills, expenses and savings goals. Every new user gets their own copy of a demo dataset on sign up.

Desktop only. The layout is designed for 1440x1024, and there is no mobile or tablet layout.

The repo holds a React single-page app, a NestJS API and an SQLite database, as npm workspaces:

| Folder | What it is |
|--------|-----------|
| `frontend/` | React 19 SPA (Vite) on http://localhost:5173 |
| `backend/` | NestJS API on http://localhost:3000, under `/api` |
| `shared/` | `@finebank/shared`: the API contract (Zod schemas) used by both |
| `e2e/` | Playwright end-to-end tests |

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

`backend/.env` is gitignored. `backend/.env.example` lists every variable the backend reads.

## Run

```sh
npm run migrate   # create or update the database: backend/data/finebank.sqlite
npm run dev       # shared (watch), backend :3000, frontend :5173
```

Open http://localhost:5173.

Database changes go through TypeORM migrations only. To create one from entity changes:

```sh
npm run migration:generate -- CreateSomething
```

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
