'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const { openDatabase } = require('../server/db');
const { createApp } = require('../server/app');

let server;
let base;
let browser;
let context;
let page;
let dbFile;
let consoleErrors = [];

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextOpenDay(fromStr) {
  const [y, m, d] = fromStr.split('-').map(Number);
  let dt = new Date(y, m - 1, d);
  for (let i = 0; i < 14; i++) {
    if (dt.getDay() !== 0) return toDateStr(dt);
    dt.setDate(dt.getDate() + 1);
  }
  return fromStr;
}

function trackErrors(p) {
  p.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  p.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('favicon')) return;
    consoleErrors.push(`console: ${text}`);
  });
  p.on('requestfailed', (req) => {
    consoleErrors.push(`requestfailed: ${req.url()} ${req.failure() ? req.failure().errorText : ''}`);
  });
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookease-e2e-'));
  dbFile = path.join(dir, 'app.db');
  const db = openDatabase(dbFile);
  const app = createApp({ db, authRateLimit: { windowMs: 60000, max: 500 } });
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;

  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await context.newPage();
  trackErrors(page);
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (dbFile) {
    try {
      fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
    } catch {}
  }
});

describe('end-to-end user journeys', () => {
  const email = `e2e-${Date.now()}@test.dev`;
  const password = 'e2e-password-1';
  const name = 'E2E Tester';
  let expectedDate;

  it('loads the landing page with no console errors', async () => {
    const res = await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    assert.equal(res.status(), 200);
    assert.match(await page.title(), /BookEase/);
    await assert.doesNotReject(() => page.waitForSelector('text=Get started'));
    assert.ok(await page.isVisible('#hero-register'));
  });

  it('shows client-side validation on the register form', async () => {
    await page.goto(`${base}/register.html`);
    await page.click('#submit-btn');
    assert.ok(await page.isVisible('#name-error'));
    assert.ok(await page.isVisible('#email-error'));
    assert.ok(await page.isVisible('#password-error'));
    // still on the same page — nothing was submitted
    assert.ok(page.url().endsWith('/register.html'));

    await page.fill('#password', 'short');
    await page.click('#submit-btn');
    assert.match(await page.textContent('#password-error'), /at least 8 characters/);
  });

  it('registers a new account and lands on the booking page', async () => {
    await page.goto(`${base}/register.html`);
    await page.fill('#name', name);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#confirm', password);
    await page.click('#submit-btn');
    await page.waitForURL('**/book.html');
    assert.ok(await page.isVisible('text=Book an appointment'));
    assert.ok(await page.isVisible('text=E2E Tester'), 'nav should show the user name');
    assert.ok(await page.isVisible('#logout-btn'));
  });

  it('shows available slots and books an appointment', async () => {
    assert.ok(page.url().endsWith('/book.html'));
    await page.waitForSelector('.slot', { state: 'attached' });

    expectedDate = await page.inputValue('#date');
    assert.ok(expectedDate, 'date input should be prefilled');
    assert.equal(expectedDate, nextOpenDay(toDateStr(new Date())));

    const enabled = page.locator('.slot:not([disabled])');
    const count = await enabled.count();
    assert.ok(count > 0, 'at least one slot should be bookable');
    const chosen = await enabled.first().textContent();

    await enabled.first().click();
    assert.ok(await page.isVisible('.slot-selected'));

    await page.fill('#note', 'E2E test visit');
    await page.click('#submit-btn');
    await page.waitForSelector('#form-success:not([hidden])');
    const success = await page.textContent('#form-success');
    assert.match(success, new RegExp(`Booked ${expectedDate} at ${chosen}`));
    // the booked slot is no longer bookable
    const stillBooked = page.locator(`.slot[data-time="${chosen}"]`);
    assert.equal(await stillBooked.isDisabled(), true);
  });

  it('shows the booking under Upcoming in booking history', async () => {
    await page.click('nav a[href="/bookings.html"], .nav-links a[href="/bookings.html"]');
    await page.waitForURL('**/bookings.html');
    await page.waitForSelector('#content:not([hidden])');
    const item = page.locator('.booking-item').first();
    assert.ok(await item.isVisible(), 'a booking row should be visible');
    const text = await item.textContent();
    assert.match(text, /Confirmed/);
    assert.match(text, /E2E test visit/);
    assert.match(text, /\w{3}, \w{3} \d{1,2}, 2026 · \d{2}:\d{2}/);
    assert.ok(await page.isVisible('#upcoming-title'));
    assert.ok(await item.locator('button:has-text("Cancel")').isVisible());
  });

  it('logs out and protects the booking pages', async () => {
    await page.click('#logout-btn');
    await page.waitForURL(`${base}/`);
    assert.ok(await page.isVisible('text=Get started'), 'landing page shows logged-out hero');

    await page.goto(`${base}/bookings.html`);
    await page.waitForURL('**/login.html**');
    assert.ok(await page.isVisible('#login-form'));
  });

  it('rejects a wrong password, then logs in with the right one', async () => {
    await page.goto(`${base}/login.html`);
    await page.fill('#email', email);
    await page.fill('#password', 'definitely-wrong');
    await page.click('#submit-btn');
    await page.waitForSelector('#form-error:not([hidden])');
    assert.match(await page.textContent('#form-error'), /Invalid email or password/);
    assert.ok(page.url().includes('/login.html'));

    await page.fill('#password', password);
    await page.click('#submit-btn');
    await page.waitForURL('**/book.html');
    assert.ok(await page.isVisible('#logout-btn'));
  });

  it('still shows the booking after re-login (persistence)', async () => {
    await page.goto(`${base}/bookings.html`);
    await page.waitForSelector('#content:not([hidden])');
    const rows = await page.locator('.booking-item').count();
    assert.equal(rows, 1);
    // browser renders the date as e.g. "Mon, Nov 9, 2026 · 09:00"
    const text = await page.locator('.booking-item').first().textContent();
    assert.match(text, /\d{2}:\d{2}/);
    assert.match(text, /Confirmed/);
  });

  it('cancels the booking and returns to an empty history', async () => {
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('.booking-item button:has-text("Cancel")');
    await page.waitForSelector('#upcoming-empty:not([hidden])');
    assert.equal(await page.locator('.booking-item').count(), 0);
    assert.match(await page.textContent('#upcoming-empty'), /No upcoming bookings/);
  });

  it('works on a mobile viewport', async () => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(`${base}/book.html`);
    await page.waitForSelector('.slot, .hint', { state: 'attached' });
    assert.ok(await page.isVisible('.brand'));
    assert.ok(await page.isVisible('#book-form'));
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  it('produced no unexpected console or page errors', async () => {
    // Browsers always log failed fetches; the deliberate wrong-password login
    // (and any auth probes) surface as 401 resource messages. Everything else
    // — page errors, failed requests, non-401 console errors — must be empty.
    const unexpected = consoleErrors.filter((e) => !/status of 401/.test(e));
    assert.deepEqual(unexpected, []);
  });
});
