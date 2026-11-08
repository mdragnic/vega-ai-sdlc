# Task 031 security review (decision #131)

Run 2026-11-07 with `/security-review` on the pending changes (uncommitted on 5bd6574, new files intent-to-add, read with `git diff HEAD`). Focus: `backend/src/users/profile-guard-answer.filter.ts` (new), its `@UseFilters` on `PATCH /api/profile` in `profile.controller.ts`, and `profileBodyLimits` exported from `profile-body.interceptor.ts`. Step 1 (finding vulnerabilities) reported none at or above the bar, so step 2 (false-positive filtering per finding) had nothing to filter.

## Result: no HIGH or MEDIUM findings

## What was checked

- The guards' decisions cannot be bypassed or reordered: in Nest 12.2.0 the route's filters run inside the catch that wraps the guards, interceptors, pipes and handler, after an exception ended that chain; the filter never calls `next`, re-enters the interceptor or handler, or sets a user. `SessionGuard` still answers 401 or 409 before `ProfileBodyInterceptor` (multer) can run.
- The discarded body reaches no parser, log, buffer or disk: `discardBody` only adds up `chunk.length`; no other consumer is attached (multer never ran; Nest's JSON and urlencoded parsers skip a multipart body, and for those encodings the body was already read, so `readableEnded` is true and nothing is drained).
- The answer is the same as before: every path ends in the unchanged `ApiExceptionFilter.catch` (the same status and body; nothing of the request echoed; other exceptions logged as before).
- The scope is this route's guard answers: `@UseFilters` on the one method; only 401 and 409 wait; the interceptor's 415 and 400 and the pipe's 400 do not; the handler's own 409 (username taken) comes after multer read the body, so it answers at once.
- No request smuggling or desync: draining at the application layer does not change HTTP framing (llhttp frames by `Content-Length` or chunked encoding); past the limit the listeners go and the stream keeps flowing, so a kept-alive connection's next request is framed correctly.
- `profile-body.interceptor.ts`: the multer limits exported as `profileBodyLimits`, same values, `as const`; behaviour unchanged.
- Other changes: `.mcp.json` pinned to `@playwright/mcp@0.0.84` (less supply-chain risk); `recharts` and its tree removed, nothing added to the lockfile; the frontend diff scanned for `dangerouslySetInnerHTML`, `innerHTML`, `eval` / `new Function`, `href` / `src` sinks, `window.open`, `location`, storage, `postMessage` and `fetch`: none added; tests, e2e helpers and docs add no runtime surface.

## Below the bar or excluded (for awareness)

- Resource use (excluded as denial of service): an unauthenticated client can make the backend read and drop up to about 2.1 MB per refused `PATCH /api/profile` (`PROFILE_DISCARD_LIMIT`, the photo limit plus 10 x 1,636 bytes); a client that sends slowly holds the answer until its body ends, it goes, or Node's request timeout fires. The backend listens on 127.0.0.1 only.
- `void discardBody(...).then(() => super.catch(...))` has no `.catch`: if `super.catch` threw, the rejection would go unhandled. No client-triggerable throw was found (no headers are sent before this point; writes to a destroyed socket report through a callback); at most a crash.
