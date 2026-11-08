'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { openDatabase } = require('../server/db');
const { createApp } = require('../server/app');

// Fixed clock: Monday, 2026-11-09 10:00 local time (server-side "now").
const BASE_NOW = new Date(2026, 10, 9, 10, 0, 0);
let NOW = BASE_NOW;
const now = () => NOW;

const TUESDAY = '2026-11-10';
const WEDNESDAY = '2026-11-11';
const SUNDAY = '2026-11-15';
const PAST_DATE = '2026-11-06'; // Friday before the fixed clock

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

class Client {
  constructor(base) {
    this.base = base;
    this.cookie = null;
  }

  async request(path, { method = 'GET', body, headers = {}, rawBody } = {}) {
    const h = { Accept: 'application/json', ...headers };
    if (this.cookie) h.Cookie = this.cookie;
    let payload;
    if (method !== 'GET' && method !== 'HEAD') {
      if (!('Content-Type' in h)) h['Content-Type'] = 'application/json';
      payload = rawBody !== undefined ? rawBody : JSON.stringify(body === undefined ? {} : body);
    }
    const res = await fetch(this.base + path, { method, headers: h, body: payload });
    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const c of setCookies) {
      if (!c.startsWith('sid=')) continue;
      const value = c.split(';')[0];
      this.cookie = value === 'sid=' ? null : value;
    }
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    return { status: res.status, data, headers: res.headers, text };
  }
}

let server;
let base;
let anon;
let alice;
let bob;

before(async () => {
  const db = openDatabase(':memory:');
  const app = createApp({ db, now, authRateLimit: { windowMs: 60000, max: 500 } });
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  anon = new Client(base);
  alice = new Client(base);
  bob = new Client(base);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('static frontend', () => {
  it('serves the landing page', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /BookEase/);
    assert.match(html, /Get started/);
  });

  it('serves auth and booking pages', async () => {
    for (const p of ['/login.html', '/register.html', '/book.html', '/bookings.html']) {
      const res = await fetch(base + p);
      assert.equal(res.status, 200, `${p} should be 200`);
    }
    const clean = await fetch(`${base}/login`);
    assert.equal(clean.status, 200, 'extensionless URL should resolve');
  });

  it('sets security headers and hides framework fingerprint', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.match(res.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('authentication', () => {
  it('registers a new user and sets an httpOnly session cookie', async () => {
    const res = await alice.request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Alice Doe', email: 'Alice@Example.com', password: 'password123' },
    });
    assert.equal(res.status, 201);
    assert.deepEqual(res.data.user, { id: 1, name: 'Alice Doe', email: 'alice@example.com' });
    assert.ok(alice.cookie, 'session cookie should be set');
    assert.match(alice.cookie, /^sid=[0-9a-f]{64}$/);
  });

  it('rejects duplicate registration', async () => {
    const res = await anon.request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Impostor', email: 'alice@example.com', password: 'password123' },
    });
    assert.equal(res.status, 409);
    assert.equal(res.data.error.code, 'email_taken');
  });

  it('validates registration input', async () => {
    const res = await anon.request('/api/auth/register', {
      method: 'POST',
      body: { name: 'X', email: 'not-an-email', password: 'short' },
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.error.code, 'validation_error');
    assert.ok(res.data.error.fields.name);
    assert.ok(res.data.error.fields.email);
    assert.ok(res.data.error.fields.password);
  });

  it('returns current user via /api/auth/me', async () => {
    const res = await alice.request('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, 'alice@example.com');
  });

  it('returns user:null from the session probe when logged out', async () => {
    const res = await anon.request('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.data.user, null);
  });

  it('logs in with correct credentials', async () => {
    const res = await alice.request('/api/auth/login', {
      method: 'POST',
      body: { email: 'ALICE@example.com', password: 'password123' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, 'alice@example.com');
  });

  it('rejects wrong password with a generic error', async () => {
    const res = await anon.request('/api/auth/login', {
      method: 'POST',
      body: { email: 'alice@example.com', password: 'wrong-password' },
    });
    assert.equal(res.status, 401);
    assert.equal(res.data.error.code, 'invalid_credentials');
    assert.match(res.data.error.message, /Invalid email or password/);
  });

  it('registers a second user (bob)', async () => {
    const res = await bob.request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Bob Ray', email: 'bob@example.com', password: 'password456' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.email, 'bob@example.com');
  });

  it('logs out and invalidates the session', async () => {
    const res = await alice.request('/api/auth/logout', { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal(alice.cookie, null);
    const me = await alice.request('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.user, null);
    // log back in for later suites
    const login = await alice.request('/api/auth/login', {
      method: 'POST',
      body: { email: 'alice@example.com', password: 'password123' },
    });
    assert.equal(login.status, 200);
  });
});

describe('slots endpoint', () => {
  it('returns 400 for a malformed date', async () => {
    const res = await anon.request('/api/slots?date=2026-13-45');
    assert.equal(res.status, 400);
    assert.ok(res.data.error.message);
  });

  it('lists hourly slots for an open day', async () => {
    const res = await anon.request(`/api/slots?date=${TUESDAY}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.open, true);
    assert.equal(res.data.weekday, 'Tuesday');
    assert.equal(res.data.slots.length, 8);
    assert.deepEqual(
      res.data.slots.map((s) => s.time),
      ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']
    );
    assert.ok(res.data.slots.every((s) => s.available && s.reason === null));
  });

  it('marks Sunday as closed', async () => {
    const res = await anon.request(`/api/slots?date=${SUNDAY}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.open, false);
    assert.equal(res.data.weekday, 'Sunday');
    assert.ok(res.data.slots.every((s) => s.reason === 'closed'));
  });

  it('marks past dates and passed times today', async () => {
    const past = await anon.request(`/api/slots?date=${PAST_DATE}`);
    assert.equal(past.data.open, false);
    assert.ok(past.data.slots.every((s) => s.reason === 'past_date'));

    const today = await anon.request(`/api/slots?date=${dateStr(BASE_NOW)}`);
    const nine = today.data.slots.find((s) => s.time === '09:00');
    const ten = today.data.slots.find((s) => s.time === '10:00');
    const eleven = today.data.slots.find((s) => s.time === '11:00');
    assert.equal(nine.available, false);
    assert.equal(ten.available, false);
    assert.equal(eleven.available, true);
  });

  it('does not leak booking ownership to anonymous users', async () => {
    const res = await anon.request(`/api/slots?date=${TUESDAY}`);
    assert.ok(res.data.slots.every((s) => s.mine === false));
  });
});

describe('booking flow', () => {
  it('requires authentication to book', async () => {
    const res = await anon.request('/api/bookings', {
      method: 'POST',
      body: { date: TUESDAY, time: '11:00' },
    });
    assert.equal(res.status, 401);
  });

  it('creates a booking for alice', async () => {
    const res = await alice.request('/api/bookings', {
      method: 'POST',
      body: { date: TUESDAY, time: '11:00', note: 'Consultation' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.booking.date, TUESDAY);
    assert.equal(res.data.booking.time, '11:00');
    assert.equal(res.data.booking.note, 'Consultation');
    assert.equal(res.data.booking.status, 'confirmed');
  });

  it('marks the slot as taken (and owned by alice when authenticated)', async () => {
    const asAlice = await alice.request(`/api/slots?date=${TUESDAY}`);
    const slot = asAlice.data.slots.find((s) => s.time === '11:00');
    assert.equal(slot.available, false);
    assert.equal(slot.reason, 'taken');
    assert.equal(slot.mine, true);

    const asBob = await bob.request(`/api/slots?date=${TUESDAY}`);
    assert.equal(asBob.data.slots.find((s) => s.time === '11:00').mine, false);
  });

  it('rejects double booking of the same slot by another user', async () => {
    const res = await bob.request('/api/bookings', {
      method: 'POST',
      body: { date: TUESDAY, time: '11:00' },
    });
    assert.equal(res.status, 409);
    assert.equal(res.data.error.code, 'slot_taken');
  });

  it('rejects duplicate booking by the same user', async () => {
    const res = await alice.request('/api/bookings', {
      method: 'POST',
      body: { date: TUESDAY, time: '11:00' },
    });
    assert.equal(res.status, 409);
    assert.equal(res.data.error.code, 'duplicate_booking');
  });

  it('rejects past dates, Sundays, invalid times and long notes', async () => {
    const past = await alice.request('/api/bookings', {
      method: 'POST',
      body: { date: PAST_DATE, time: '11:00' },
    });
    assert.equal(past.status, 400);

    const sunday = await alice.request('/api/bookings', {
      method: 'POST',
      body: { date: SUNDAY, time: '11:00' },
    });
    assert.equal(sunday.status, 400);

    const badTime = await alice.request('/api/bookings', {
      method: 'POST',
      body: { date: TUESDAY, time: '17:00' },
    });
    assert.equal(badTime.status, 400);

    const longNote = await alice.request('/api/bookings', {
      method: 'POST',
      body: { date: WEDNESDAY, time: '09:00', note: 'x'.repeat(501) },
    });
    assert.equal(longNote.status, 400);
    assert.ok(longNote.data.error.fields.note);
  });

  it('rejects a time slot that has already passed today', async () => {
    const res = await alice.request('/api/bookings', {
      method: 'POST',
      body: { date: dateStr(BASE_NOW), time: '10:00' },
    });
    assert.equal(res.status, 400);
  });

  it('lists bookings per user (only their own)', async () => {
    const bobRes = await bob.request('/api/bookings', { method: 'POST', body: { date: WEDNESDAY, time: '14:00' } });
    assert.equal(bobRes.status, 201);

    const aliceList = await alice.request('/api/bookings');
    assert.equal(aliceList.status, 200);
    assert.equal(aliceList.data.bookings.length, 1);
    assert.equal(aliceList.data.bookings[0].date, TUESDAY);
    assert.equal(aliceList.data.bookings[0].past, false);

    const bobList = await bob.request('/api/bookings');
    assert.equal(bobList.data.bookings.length, 1);
    assert.equal(bobList.data.bookings[0].date, WEDNESDAY);
  });

  it('prevents cancelling another user\'s booking', async () => {
    const aliceList = await alice.request('/api/bookings');
    const id = aliceList.data.bookings[0].id;
    const res = await bob.request(`/api/bookings/${id}`, { method: 'DELETE' });
    assert.equal(res.status, 403);
  });

  it('returns 404 for unknown booking ids', async () => {
    const res = await alice.request('/api/bookings/99999', { method: 'DELETE' });
    assert.equal(res.status, 404);
  });

  it('cancels own booking and frees the slot', async () => {
    const list = await alice.request('/api/bookings');
    const id = list.data.bookings[0].id;
    const res = await alice.request(`/api/bookings/${id}`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);

    const after = await alice.request('/api/bookings');
    assert.equal(after.data.bookings.length, 0);

    const slots = await anon.request(`/api/slots?date=${TUESDAY}`);
    assert.equal(slots.data.slots.find((s) => s.time === '11:00').available, true);

    // slot can be rebooked
    const rebook = await bob.request('/api/bookings', {
      method: 'POST',
      body: { date: TUESDAY, time: '11:00' },
    });
    assert.equal(rebook.status, 201);
  });

  it('refuses to cancel a booking whose time has passed', async () => {
    // book 11:00 on a future day, then advance the clock past it
    const res = await alice.request('/api/bookings', {
      method: 'POST',
      body: { date: TUESDAY, time: '13:00' },
    });
    assert.equal(res.status, 201);
    const id = res.data.booking.id;

    const realNow = NOW;
    NOW = new Date(2026, 10, 10, 14, 0, 0); // Tuesday 14:00
    try {
      const cancel = await alice.request(`/api/bookings/${id}`, { method: 'DELETE' });
      assert.equal(cancel.status, 400);
      assert.equal(cancel.data.error.code, 'past_booking');

      const list = await alice.request('/api/bookings');
      assert.equal(list.data.bookings.length, 1);
      assert.equal(list.data.bookings[0].past, true);
    } finally {
      NOW = realNow;
    }
  });
});

describe('API hygiene', () => {
  it('rejects mutating requests without JSON content type (CSRF guard)', async () => {
    const res = await alice.request('/api/bookings', {
      method: 'POST',
      rawBody: JSON.stringify({ date: TUESDAY, time: '12:00' }),
      headers: { 'Content-Type': 'text/plain' },
    });
    assert.equal(res.status, 415);
    assert.equal(res.data.error.code, 'unsupported_media_type');
  });

  it('rejects malformed JSON bodies', async () => {
    const res = await alice.request('/api/auth/login', {
      method: 'POST',
      rawBody: '{"email":',
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.error.code, 'invalid_json');
  });

  it('returns JSON 404 for unknown API endpoints', async () => {
    const res = await anon.request('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.data.error.code, 'not_found');
  });

  it('rate limits repeated failed logins', async () => {
    const db = openDatabase(':memory:');
    const app = createApp({ db, now, authRateLimit: { windowMs: 60000, max: 2 } });
    const s = await new Promise((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    try {
      const limitedBase = `http://127.0.0.1:${s.address().port}`;
      const client = new Client(limitedBase);
      await client.request('/api/auth/login', {
        method: 'POST',
        body: { email: 'x@y.zz', password: 'wrongwrong' },
      });
      await client.request('/api/auth/login', {
        method: 'POST',
        body: { email: 'x@y.zz', password: 'wrongwrong' },
      });
      const third = await client.request('/api/auth/login', {
        method: 'POST',
        body: { email: 'x@y.zz', password: 'wrongwrong' },
      });
      assert.equal(third.status, 429);
      assert.equal(third.data.error.code, 'rate_limited');
    } finally {
      await new Promise((resolve) => s.close(resolve));
      db.close();
    }
  });
});
