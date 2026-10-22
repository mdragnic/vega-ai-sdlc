# Stack with exact versions

Locked by `/set-stack` on 2026-10-22 (decisions #79). Pin exact versions. After task 000, `package.json` files are the source of truth; keep this file in sync when a version changes.

- Runtime: Node.js 24.22.1 LTS, npm 11.19.1 workspaces
- Language: TypeScript 6.0.3 (not 7.x: the Nest CLI and lint tooling pin 6.0)
- Frontend: React 19.3.1, Vite 8.3.5 with @vitejs/plugin-react 6.1.2, React Router 8.5.0 (data mode)
- Styling: CSS Modules + CSS custom properties in `tokens.css`, generated from `docs/figma/tokens.md`, one variable per Figma variable
- UI primitives: radix-ui 1.8.1 (Dialog, Select, Tabs, Checkbox) under custom components named after Figma
- Icons and logo: vite-plugin-svgr 5.2.0, inline SVG with `currentColor`
- Font: Inter via @fontsource-variable/inter 5.3.0
- Data fetching: @tanstack/react-query 5.104.5
- Forms: react-hook-form 7.90.0, @hookform/resolvers 6.0.0
- Validation and API contract: zod 4.6.7, in `shared/`
- Charts: recharts 3.10.1; the goal gauge is a custom SVG component
- Dates and time zones: date-fns 4.4.0, @date-fns/tz 1.5.0
- Backend: NestJS 12.2.0 (ESM project, Express adapter), @nestjs/cli 12.0.10
- Database: SQLite via better-sqlite3 12.11.1 (TypeORM 1.1.2 accepts only ^12)
- ORM and migrations: typeorm 1.1.2, @nestjs/typeorm 12.0.2
- Auth: own sessions, scrypt from `node:crypto`, google-auth-library 11.3.1
- File upload: Multer through @nestjs/platform-express 12.2.0
- Unit tests: vitest 5.0.5; frontend @testing-library/react 16.3.3, @testing-library/user-event 14.6.8, @testing-library/jest-dom 7.0.1, jsdom 30.1.3, msw 3.0.3; backend @nestjs/testing 12.2.0, supertest 7.3.1
- E2E tests: @playwright/test 1.64.1, Chromium only
- Lint and format: oxlint 1.89.0 (type-aware, oxlint-tsgolint 7.0.2004), prettier 3.9.10, stylelint 17.16.0 with stylelint-declaration-strict-value 1.12.1
- Dev runner: concurrently 10.0.6

## TypeORM on ESM, for task 000
- Entity relations use TypeORM's `Relation<T>` wrapper to avoid circular-import errors.
- Run the migration CLI against the compiled data source in `backend/dist`, not through ts-node.
- Backend Vitest config needs decorator metadata (SWC plugin).
