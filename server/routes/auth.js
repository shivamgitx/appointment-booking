'use strict';

const express = require('express');
const {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  tokenFromRequest,
  optionalAuth,
} = require('../auth');
const {
  validateName,
  validateEmail,
  validatePassword,
  normalizeEmail,
} = require('../validate');
const { rateLimit } = require('../ratelimit');

function fieldErrors(fields) {
  const error = new Error('Validation failed');
  error.status = 400;
  error.code = 'validation_error';
  error.fields = fields;
  return error;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function createAuthRouter({ db, now, authRateLimit }) {
  const router = express.Router();
  const strictLimit = rateLimit(authRateLimit || { windowMs: 60000, max: 20 });
  const optional = optionalAuth(db, now);

  router.post('/register', strictLimit, async (req, res, next) => {
    try {
      const { name, email, password } = req.body || {};
      const errors = {};
      const nameErr = validateName(name);
      const emailErr = validateEmail(email);
      const passErr = validatePassword(password);
      if (nameErr) errors.name = nameErr;
      if (emailErr) errors.email = emailErr;
      if (passErr) errors.password = passErr;
      if (Object.keys(errors).length) throw fieldErrors(errors);

      const normalized = normalizeEmail(email);
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
      if (existing) {
        const err = new Error('An account with this email already exists.');
        err.status = 409;
        err.code = 'email_taken';
        throw err;
      }

      const passwordHash = await hashPassword(password);
      let result;
      try {
        result = db
          .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
          .run(name.trim(), normalized, passwordHash);
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) {
          const err = new Error('An account with this email already exists.');
          err.status = 409;
          err.code = 'email_taken';
          throw err;
        }
        throw e;
      }

      const user = {
        id: Number(result.lastInsertRowid),
        name: name.trim(),
        email: normalized,
      };
      const session = createSession(db, user.id, now());
      setSessionCookie(res, session.token, session.expiresAt, req);
      res.status(201).json({ user });
    } catch (e) {
      next(e);
    }
  });

  router.post('/login', strictLimit, async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        throw fieldErrors({
          ...(email ? {} : { email: 'Email is required.' }),
          ...(password ? {} : { password: 'Password is required.' }),
        });
      }
      const row = db
        .prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?')
        .get(normalizeEmail(email));
      const ok = row ? await verifyPassword(password, row.password_hash) : false;
      if (!row || !ok) {
        const err = new Error('Invalid email or password.');
        err.status = 401;
        err.code = 'invalid_credentials';
        throw err;
      }
      const session = createSession(db, row.id, now());
      setSessionCookie(res, session.token, session.expiresAt, req);
      res.status(200).json({ user: publicUser(row) });
    } catch (e) {
      next(e);
    }
  });

  router.post('/logout', (req, res, next) => {
    try {
      destroySession(db, tokenFromRequest(req));
      clearSessionCookie(res, req);
      res.status(200).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.get('/me', optional, (req, res) => {
    // Session probe: always 200, user is null when logged out (keeps consoles clean).
    res.status(200).json({ user: req.user || null });
  });

  return router;
}

module.exports = { createAuthRouter };
