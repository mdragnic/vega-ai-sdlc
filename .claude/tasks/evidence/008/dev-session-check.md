# Task 008: manual check on the development stack

2026-10-25, `npm run dev` (development settings: NODE_ENV unset, scrypt N 2^17, system clock), Playwright MCP at 1440x1024 on http://localhost:5173/. No Figma calls.

## Sign up with fetch from the page (through the Vite proxy)

```js
const started = performance.now();
const response = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fullName: 'Manual Check', email, password: 'abcdef12' }) });
const ms = Math.round(performance.now() - started);
```

Result:

- email `manual-check-008-1792931396919@example.com`
- status 201, body `{ fullName: "Manual Check", email: "manual-check-008-1792931396919@example.com", username: "manualcheck008179293139691" }`
- **273 ms** for the whole sign up: scrypt N 2^17 hash, the user insert, the demo seeding and the session, in one transaction
- `GET /api/auth/me` afterwards: 200 with the same user

## Rows of the new user (read-only query)

See `dev-row-counts.txt`: accounts 5 (IDs 1 to 5 in the order credit-card, checking, savings, investment, loan), transactions 3,411, bills 14, savings_goals 84, category_limits 6, sessions 1.

The development database's older user (from the task 007 check) has no demo data: backfilling is out of scope.
