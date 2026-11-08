'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openDatabase } = require('../server/db');

const tmpDirs = [];
function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookease-test-'));
  tmpDirs.push(dir);
  return path.join(dir, 'app.db');
}

after(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
});

describe('database layer', () => {
  it('creates the expected schema', () => {
    const db = openDatabase(tmpFile());
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name)
      .filter((n) => !n.startsWith('sqlite_'));
    assert.deepEqual(tables, ['bookings', 'sessions', 'users']);
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all()
      .map((r) => r.name)
      .sort();
    assert.ok(indexes.includes('idx_bookings_slot'));
    assert.ok(indexes.includes('idx_bookings_user'));
    db.close();
  });

  it('persists data across close/reopen', () => {
    const file = tmpFile();
    const db1 = openDatabase(file);
    db1
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('Persisted Pat', 'pat@example.com', 'hash');
    db1
      .prepare("INSERT INTO bookings (user_id, date, time, note) VALUES (1, '2026-12-01', '09:00', 'note')")
      .run();
    db1.close();

    const db2 = openDatabase(file);
    const user = db2.prepare('SELECT * FROM users WHERE email = ?').get('pat@example.com');
    assert.equal(user.name, 'Persisted Pat');
    const booking = db2.prepare('SELECT * FROM bookings WHERE user_id = 1').get();
    assert.equal(booking.date, '2026-12-01');
    assert.equal(booking.time, '09:00');
    db2.close();
  });

  it('enforces unique confirmed bookings per slot', () => {
    const db = openDatabase(tmpFile());
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('A', 'a@a.aa', 'h');
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('B', 'b@b.bb', 'h');
    db.prepare("INSERT INTO bookings (user_id, date, time) VALUES (1, '2026-12-02', '10:00')").run();
    assert.throws(
      () => db.prepare("INSERT INTO bookings (user_id, date, time) VALUES (2, '2026-12-02', '10:00')").run(),
      /UNIQUE/i
    );
    // same user cannot double-book the same slot either
    assert.throws(
      () => db.prepare("INSERT INTO bookings (user_id, date, time) VALUES (1, '2026-12-02', '10:00')").run(),
      /UNIQUE/i
    );
    db.close();
  });

  it('enforces foreign keys', () => {
    const db = openDatabase(tmpFile());
    assert.throws(
      () => db.prepare("INSERT INTO bookings (user_id, date, time) VALUES (999, '2026-12-03', '11:00')").run(),
      /FOREIGN KEY/i
    );
    db.close();
  });

  it('cascades deletes from users to bookings and sessions', () => {
    const db = openDatabase(tmpFile());
    db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('C', 'c@c.cc', 'h');
    db.prepare("INSERT INTO bookings (user_id, date, time) VALUES (1, '2026-12-04', '12:00')").run();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
      'tok',
      1,
      '2030-01-01T00:00:00.000Z'
    );
    db.prepare('DELETE FROM users WHERE id = 1').run();
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM bookings').get().c, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM sessions').get().c, 0);
    db.close();
  });

  it('rejects invalid date formats at the application layer', () => {
    const { validateDate, validateTime, validateEmail } = require('../server/validate');
    assert.ok(validateDate('2026-02-30'));
    assert.ok(validateDate('09-11-2026'));
    assert.ok(validateDate('2026-11-11T00:00:00Z'));
    assert.ok(validateDate('2026-11-31')); // November has 30 days
    assert.equal(validateDate('2026-11-30'), null);
    assert.ok(validateTime('24:00'));
    assert.ok(validateTime('9:00'));
    assert.equal(validateTime('09:00'), null);
    assert.ok(validateEmail('nope'));
    assert.equal(validateEmail('user@example.com'), null);
  });
});
