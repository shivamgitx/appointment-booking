# LOOP PLAN — Appointment Booking Website

## Goal
Complete appointment-booking website: register, log in, select date/time,
submit bookings, view booking history.

## Phase 1 Findings (Discovery)
- Working directory `/Users/shinchan/Desktop/loop engineering` was **empty** (greenfield).
- Environment: macOS, Node v26.5.0, npm 11.17.0, Python 3.14.6, sqlite3 CLI, Docker, git 2.50.1.
- Playwright 1.65.0 available via npx; Chromium browsers already cached in `~/Library/Caches/ms-playwright`.

## Architecture Overview

```
loop engineering/
├── server/
│   ├── app.js          # Express app factory (used by tests, no listen)
│   ├── index.js        # Entry point: creates DB, starts server
│   ├── db.js           # node:sqlite connection + schema migration
│   ├── auth.js         # password hashing, session create/verify, middleware
│   ├── validate.js     # shared input validation helpers
│   └── routes/
│       ├── auth.js     # POST /api/auth/register|login|logout, GET /api/auth/me
│       └── bookings.js # GET /api/slots, POST/GET/DELETE /api/bookings
├── public/             # static frontend (served by Express)
│   ├── index.html      # landing page
│   ├── login.html
│   ├── register.html
│   ├── book.html       # date/time picker + submit
│   ├── bookings.html   # booking history
│   ├── css/styles.css
│   └── js/             # per-page scripts + shared api/auth helpers
├── tests/
│   ├── api.test.js     # backend API + DB integration tests (node --test)
│   └── e2e.test.js     # Playwright end-to-end user journeys
├── data/               # SQLite db file (gitignored)
├── package.json
└── LOOP_*.md           # project memory
```

### Technology stack
- **Frontend:** vanilla HTML/CSS/JS multi-page app (no build step), fetch API.
- **Backend:** Node.js 26 + Express 5 (JSON API under `/api/*`).
- **Database:** SQLite via built-in `node:sqlite` (`DatabaseSync`) — zero native deps.
- **Auth:** email+password, bcryptjs hashing, server-side sessions in DB,
  `httpOnly`, `SameSite=Lax`, `Secure`-off in dev cookie; CSRF defense via
  `SameSite` + required `Content-Type: application/json` + custom `X-Requested-With`.
- **Testing:** `node --test` (API/DB), Playwright (browser E2E).
- **Deployment:** single process `npm start` (PORT env, default 3000).

### Data model
- `users(id, name, email UNIQUE, password_hash, created_at)`
- `sessions(token PRIMARY KEY, user_id, created_at, expires_at)`
- `bookings(id, user_id, date, time, note, status, created_at,
  UNIQUE(user_id, date, time))`

### Business rules
- Slots: hourly 09:00–17:00, Mon–Sat (17:00 excluded → last slot 16:00).
- Date must be today or future; no past bookings.
- No double-booking of a slot by different users (global slot uniqueness).
- User cannot book the same slot twice; cannot cancel past bookings.

## Execution order
1. Scaffold npm project + deps
2. Backend: db, auth, routes, app factory
3. Frontend pages
4. API + DB tests
5. Integration checks (curl against running server)
6. Playwright E2E
7. Bug fixes + regression
8. Production build/config check + final report
