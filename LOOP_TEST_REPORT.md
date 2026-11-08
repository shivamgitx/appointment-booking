# LOOP TEST REPORT — BookEase Appointment Booking

Labels: **PASS** = verified · **FAIL** · **NOT TESTED** · **BLOCKED**
Executed: 2026-11-08 · Tooling: `node --test` (39 API/DB tests), Playwright chromium (11 E2E tests), curl smoke, prod-mode smoke.

---

## PROJECT OVERVIEW
Greenfield full-stack appointment booking site.
- Frontend: vanilla HTML/CSS/JS multi-page app (`public/`), no build step.
- Backend: Node 26 + Express 5 JSON API (`server/`), bcryptjs hashing,
  server-side sessions in httpOnly `sid` cookie.
- Database: SQLite via built-in `node:sqlite` (`data/app.db`, WAL).
- Slots: hourly 09:00–16:00, Mon–Sat, globally unique per date+time.

## FRONTEND TESTING
| Item | Result | Evidence |
|---|---|---|
| Website loading (/, /login, /register, /book, /bookings) | PASS | E2E + curl all 200; extensionless URLs resolve |
| Page navigation (nav links, redirects) | PASS | E2E journey covers all transitions |
| Buttons/clickables (slot grid, cancel, logout, CTAs) | PASS | E2E clicks verified state changes |
| Forms + validation (register/login/book, client-side) | PASS | E2E: empty submit → field errors, no request sent |
| Dropdowns/modals/search | NOT TESTED | Not applicable — UI has none (date input + slot buttons + native confirm()) |
| Auth screens (register/login/logout) | PASS | E2E journeys 1–6 |
| Dashboard/history functionality | PASS | upcoming/past split, cancel flow |
| Responsive layout (375px mobile) | PASS | E2E mobile viewport check |
| Loading states | PASS | "Loading times/bookings…" states implemented & observed |
| Error states | PASS | inline field errors, form error banner, load-error banner |
| Browser console errors | PASS | E2E collects pageerror/console/requestfailed; only expected 401 resource log from deliberate failed login |
| Security headers on pages | PASS | CSP, nosniff, DENY framing, no X-Powered-By |

## BACKEND TESTING
API endpoints verified (39 automated tests, all pass):
| Endpoint | Cases | Result |
|---|---|---|
| `POST /api/auth/register` | success, duplicate 409, validation 400 (field-level), email normalization | PASS |
| `POST /api/auth/login` | success, wrong password 401 (generic message), missing fields 400, rate-limit 429 | PASS |
| `POST /api/auth/logout` | clears session + cookie, idempotent | PASS |
| `GET /api/auth/me` | returns user when authed; `{user:null}` 200 when logged out | PASS |
| `GET /api/slots` | 8 slots, weekday label, Sunday closed, past date, past time today, ownership not leaked anonymously, bad date 400 | PASS |
| `POST /api/bookings` | 201 create, 401 unauth, 409 slot_taken, 409 duplicate, 400 past/Sunday/invalid time/long note/past time today | PASS |
| `GET /api/bookings` | per-user isolation, `past` flag, ordering | PASS |
| `DELETE /api/bookings/:id` | 200 cancel + slot freed, 403 other user's, 404 unknown, 400 past booking, invalid id 400 | PASS |
| Cross-cutting | malformed JSON 400, non-JSON mutation 415 (CSRF guard), JSON 404 unknown endpoint | PASS |

## DATABASE TESTING
| Check | Result |
|---|---|
| Connectivity (file + in-memory) | PASS |
| Schema: users / sessions / bookings + indexes | PASS |
| Persistence across close/reopen (and server restart) | PASS |
| UNIQUE confirmed slot per date+time; per-user uniqueness | PASS (assert.throws on violation) |
| Foreign keys ON; FK violation rejected | PASS |
| Cascade delete user → bookings/sessions | PASS |
| Input format validation (dates incl. Feb 30 / Nov 31 rejected, times, emails) | PASS |

## INTEGRATION TESTING
| Check | Result |
|---|---|
| Live curl flow: register → /me → book → history → slots reflect booking | PASS |
| Frontend fetch → correct URL/method/Content-Type/JSON body | PASS (E2E observes results) |
| Session cookie round-trip (register/login sets → requests authenticated) | PASS |
| Booking appears in UI history after server accepted it | PASS |
| Slot availability updates after booking & after cancel | PASS (API + E2E) |
| CORS issues | N/A — same-origin static+API, no cross-origin calls |
| Missing env vars | PASS — defaults (PORT=3000, DATA_FILE=./data/app.db) |

## END-TO-END TESTING (Playwright, 11/11 PASS)
Successful journeys:
1. Landing page loads clean → PASS
2. Register form client validation → PASS
3. Register → redirected to /book.html, nav shows user → PASS
4. Select date + slot + note → submit → success message, slot disabled → PASS
5. Booking history shows booking under Upcoming (Confirmed, note, cancel button) → PASS
6. Logout → home shows logged-out hero → PASS
7. Visiting /bookings.html logged-out → redirected to /login.html → PASS
8. Wrong password → inline "Invalid email or password" error, stays on login → PASS
9. Correct password → login → booking history intact (persistence) → PASS
10. Cancel (dialog accepted) → empty history state → PASS
11. Mobile 375px viewport renders nav + booking form → PASS

Failed scenarios: none remaining (2 initial failures fixed — see LOOP_ERRORS E-04, E-05).

## BUG REPORT
7 issues identified, root-caused and fixed (6 runtime/test issues + 1 caught in review):
E-01 missing export → logout 500 · E-02 slot reason priority · E-03 sqlite_sequence assertion ·
E-04 date-format assertion · E-05 /me 401 console noise (API changed to probe semantics) ·
E-06 Playwright browser binary mismatch · E-07 `form.name` shadowing (code review).
Full detail in `LOOP_ERRORS.md`. Zero attempts exhausted; no recurring errors.

## DEPLOYMENT STATUS
| Check | Result |
|---|---|
| Production build | PASS — no build step; `npm start` runs `server/index.js` |
| `NODE_ENV=production` smoke: all 5 pages 200, register 201, book 201 | PASS |
| Environment config | PASS — `PORT`, `DATA_FILE` (documented in LOOP_PLAN); no secrets in repo |
| `Secure` cookie emitted behind `X-Forwarded-Proto: https` (trust proxy) | PASS |
| Database config & restart persistence | PASS |
| Server startup / build errors / logs | PASS — clean startup log, no errors |
| `npm audit` | PASS — 0 vulnerabilities |
| Production deployment (real hosting) | NOT TESTED — no deployment target/credentials provided |

## FINAL STATUS
**Overall: PASS** for all locally verifiable acceptance criteria:
register ✅ · log in ✅ · select date & time ✅ · submit booking ✅ · view booking history ✅
(+ cancel, validation, security hardening,50/50 automated tests green).

Not verified: live third-party hosting (no target given) — marked NOT TESTED, not claimed.
