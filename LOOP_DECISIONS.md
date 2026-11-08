# LOOP DECISIONS

1. **Greenfield build** — target directory was empty; entire app built from scratch.
2. **`node:sqlite` over better-sqlite3** — avoids native compilation risk on Node 26.
3. **Server-side sessions over JWT** — revocable, httpOnly cookie, no token in localStorage (XSS safer).
4. **Multi-page vanilla JS frontend over React** — no build step → fewer failure modes,
   faster verification; requirements (register/login/book/history) don't need SPA complexity.
5. **bcryptjs over bcrypt** — pure JS, no native build.
6. **Express 5** — current major; async error handling supported.
7. **Slot model:** fixed hourly slots 09:00–16:00, Mon–Sat, globally unique per date+time
   (partial unique index on confirmed bookings so cancelled slots free up).
8. **CSRF defense:** SameSite=Lax cookies + mandatory `Content-Type: application/json`
   on all mutating API requests (415 otherwise) + same-origin static serving. No token needed.
9. **Rate limiting** on `/api/auth/register|login`: 20/min/IP (configurable via
   `authRateLimit` option for tests).
10. **`GET /api/auth/me` returns 200 `{user:null}` when logged out** (revised from 401):
    it is a session probe called on every page load; 401 polluted browser consoles for
    all anonymous visitors (found during E2E console-error audit). Route protection
    still returns 401 via `requireAuth`.
11. **Hard-delete on cancel** (no "cancelled" rows) — keeps the partial unique slot
    index simple; history keeps past bookings until cancelled.
12. **CSP with no `unsafe-inline`/`unsafe-evals`** — forced all JS into external
    files and all styling into `styles.css` (no inline handlers/styles).
13. **Tests run the app in-process on ephemeral ports with an injectable clock**
    (`now()` option) — deterministic time-dependent tests (past slots, expired
    bookings) without flakiness.
14. **No README created** — project memory lives in LOOP_*.md per instructions.
