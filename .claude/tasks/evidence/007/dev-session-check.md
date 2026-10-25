# Task 007, manual check: session through the dev stack

- Date: 2026-10-25, `npm run dev` (shared watch, backend :3000, Vite :5173 with the `/api` proxy), development database migrated with `npm run migrate` (see `migrate.txt`).
- Browser: Chromium through Playwright MCP, viewport 1440x1024, page `http://localhost:5173/`.
- Steps, all with `fetch` from the page (same origin, so the browser sends `Sec-Fetch-Site: same-origin`):
  1. `POST /api/auth/signup` with `{ fullName: "  Manual Check ", email: "MANUAL-<n>@EXAMPLE.COM", password: "abcdef12" }`.
  2. Read the cookie from the browser context (`context.cookies('http://localhost:5173/api/auth/me')`).
  3. `GET /api/auth/me`.
  4. Open `http://localhost:5173/api/auth/me` as a document (its path is under `/api`, so only `HttpOnly` can hide the cookie) and read `document.cookie`.
  5. `POST /api/auth/logout`, read the context cookies again, then `GET /api/auth/me`.

## Output

```json
{
  "signup": {
    "status": 201,
    "body": {
      "fullName": "Manual Check",
      "email": "manual-1792922231017@example.com",
      "username": "manual1792922231017"
    },
    "setCookieVisibleToJs": null
  },
  "cookie": {
    "name": "finebank_session",
    "valueLength": 43,
    "domain": "localhost",
    "path": "/api",
    "httpOnly": true,
    "secure": false,
    "sameSite": "Lax",
    "expiresInDays": 30
  },
  "me": {
    "status": 200,
    "body": {
      "fullName": "Manual Check",
      "email": "manual-1792922231017@example.com",
      "username": "manual1792922231017"
    },
    "setCookieVisibleToJs": null
  },
  "documentCookieUnderApi": "",
  "logout": {
    "status": 204,
    "body": null,
    "setCookieVisibleToJs": null
  },
  "cookiesAfterLogout": [],
  "meAfterLogout": {
    "status": 401,
    "body": {
      "message": "Authentication required"
    },
    "setCookieVisibleToJs": null
  }
}
```

## Reading

- Sign up: 201, name and email trimmed, email lowercased, username from the email's local part with `-` removed.
- Cookie: `finebank_session`, 43 base64url characters (32 bytes), host-only `localhost`, `Path=/api`, `HttpOnly`, `SameSite=Lax`, not `Secure` (local HTTP, #73), expiring 30 days out.
- `document.cookie` on a page under `/api` is empty: the session cookie is invisible to scripts.
- Logout: 204, the browser dropped the cookie, and `me` then gives 401 `Authentication required`.
- Console: two expected errors, the 401 of the last `me` call and a 404 for `/favicon.ico` when the raw `/api/auth/me` document was opened (the app has no favicon; not part of this task).
