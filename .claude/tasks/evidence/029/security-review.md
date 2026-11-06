# Task 029 security review

`security-review` skill, 2026-11-06, on the task's uncommitted changes (`git diff HEAD`, the new files intent-to-add). One sub-task read the diff and the security model (`docs/architecture.md`, `backend/src/auth/`); it reported no finding at or above the bar, so no false-positive filtering sub-task was needed.

## Findings

No findings (none at confidence 8 or above; none below it reported either).

## What was checked, and why each holds

- **Path traversal** (`backend/src/users/photo-store.ts`, `users.service.ts`): every stored name is server-made, `randomUUID()` and the extension of the detected type; the client's file name and declared type are never read. `PhotoStore.pathOf` checks the strict UUID v4 and `.jpg|.png` shape, `dirname(path) === folder` and `path === join(folder, name)` before any disk access. The migration's and the entity's `CHK_users_photo_name` keep the same shape, paired with the type. `uploadsDir` is a fixed path from the config. `photo_path` is never sent in a response; only `photoUpdatedAt` is.
- **Mass assignment**: `updateProfile` builds the update from the four named text fields and `storePhoto`'s own output; the shared schema drops unknown keys, so no request can set `photoPath` or `photoMimeType`.
- **Authorization / IDOR**: `GET /api/profile/photo` takes no parameter and reads by `@CurrentUser()` only, behind the global session guard (not `@Public()`). Every read and update in `updateProfile` and `photo` is keyed on the session user's ID. The compare on the old name (`WHERE id = <user> AND photo_path = <name read just before>`) only ever removes a file the same user's row named; names are unique random UUIDs, so no user can remove another's file.
- **Order of checks**: multer runs in the route's interceptor, after the CSRF middleware, the session guard and the write guard (`X-Expected-User`); the validation pipe after the photo is in the body. A non-multipart request answers 415 before multer runs. A file under another name, a second file or a `photo` text part is refused (multer's 400, or the schema's under `photo`).
- **CSRF**: the write is a `PATCH` with a custom header (a CORS preflight, no CORS enabled), Nest's Fetch Metadata check and the SameSite=Lax cookie.
- **XSS / polyglots**: the type comes from the first bytes, JPEG and PNG only (no SVG). Served with the stored type, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` and `Cross-Origin-Resource-Policy: same-origin` (the sub-task confirmed in the Nest 12.2 Express adapter's source that the stream's type is set with the `@Header` headers). Served only to its owner; a page on another localhost port (same site) is refused by CORP (also proven by e2e T25).
- **Frontend**: the preview's object URL is made and revoked in one effect; the photo's address is the contract's path with `photoUpdatedAt` (validated by `z.iso.datetime()`) through `URLSearchParams`; no `dangerouslySetInnerHTML`; the file part is sent under the fixed name `photo`.
- **Data exposure / logging**: one 404 body for no photo and a missing file; the global filter's generic 500 logs message and stack only; `removePhoto` logs file system error messages, at most the uploads path and a random UUID, no personal data. Photo metadata (EXIF) is kept by decision #128 b3, served only to its owner, with its condition in `docs/architecture.md`.
- **Test-only reset**: `resetDatabase`'s removal of the uploads folder runs only with `NODE_ENV=test`, on the config's fixed path.
- Not assessed (out of the review's scope by its rules): holding up to 2 MB in memory per request and the update's retry loop under concurrent saves (resource and DoS concerns).

## Noted outside this change, then fixed in this task at the gate

The sub-task noted that the Vite dev server's `/@fs/` route serves files under the repository root by Vite's default `server.fs.allow` for a workspace, which takes in `backend/data/` (the SQLite files and, since this task, the photos); the build confirmed `/@fs/` serves repository files (it fetched `e2e/fixtures/photo-baseline.jpg` that way during the visual check). This predates task 029 and is not widened by it; for photos it opens no path, as their names are random UUIDs never sent to the client. Left to Marko: a `server.fs.deny` entry for `backend/data/**` in `frontend/vite.config.ts` would close it for the database file as well, outside this task's scope.

Fixed at Marko's request at the gate (2026-11-06): `frontend/vite.config.ts` `server.fs.deny` keeps Vite's own entries and adds `**/backend/data/**`; e2e "never serves backend/data through the dev server …" (`settings-photo.spec.ts`), seen failing first (the database file answered 200), now passes: every way of reading the database file or a stored photo through `/@fs/` answers 403 or 404 with none of its bytes; an image's `?import` answers a module holding only its URL, no bytes.
