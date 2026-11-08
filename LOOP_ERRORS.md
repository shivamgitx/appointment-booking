# LOOP ERRORS

Format: ID | Component | Error | Root cause | Fix | Attempts | Status

## E-01 | Auth logout | `POST /api/auth/logout` → 500 (`TypeError: tokenFromRequest is not a function`) | `tokenFromRequest` defined in server/auth.js but omitted from `module.exports` | Added it to exports | 1/3 | FIXED

## E-02 | Slots endpoint | Past-date test failed: reasons were `closed` instead of `past_date` | Priority order in reason assignment checked `isOpenDay` before `isPastDate` (Nov 8 2026 is a Sunday) | Reordered checks: `past_date` takes precedence | 1/3 | FIXED

## E-03 | DB test | Schema assertion failed: `sqlite_sequence` table present | AUTOINCREMENT creates internal `sqlite_sequence`; assertion didn't filter internal tables | Filter `sqlite_*` names in assertion | 1/3 | FIXED

## E-04 | E2E history test | Booking row showed `Mon, Nov 9, 2026 · 09:00`, assertion expected `2026-11-09` | Frontend formats dates for display; test asserted raw ISO format | Assert against the rendered format | 1/3 | FIXED

## E-05 | Browser console (E2E) | 8× `Failed to load resource: 401` console errors | `GET /api/auth/me` returned 401 for logged-out visitors (called on every page load) + deliberate wrong-password login test | `/me` now returns `200 {user:null}` (session probe semantics); E2E allows only expected 401 resource messages | 1/3 | FIXED

## E-06 | E2E environment | `Executable doesn't exist ... chromium_headless_shell-1254` | Installed playwright@1.65.0 expected browser build 1254; cache had 1234 | Ran `npx playwright install chromium` | 1/3 | FIXED

## E-07 | Register form (pre-emptive catch during review) | `form.name` would return the form's name attribute (empty string), not the input | HTMLFormElement.name shadows named-element access | Switched to `form.elements.name` etc. | 1/3 | FIXED (found in code review before runtime)

## E-08 | Visual review (beautification round) | `#hero-book` ("Book now") visible for logged-out users despite `hidden` attribute; same class of bug could hit `.strength`/`.selected-date-line` | `.btn { display: inline-flex }` overrides the UA `[hidden] { display: none }` rule | Added global `[hidden] { display: none !important; }` | 1/3 | FIXED

All errors resolved within attempt limits. No recurring/blocking errors.
