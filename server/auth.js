'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const SESSION_COOKIE = 'sid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function toIso(date) {
  return date.toISOString();
}

function createSession(db, userId, now = new Date()) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = toIso(new Date(now.getTime() + SESSION_TTL_MS));
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  return { token, expiresAt };
}

function destroySession(db, token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function destroyUserSessions(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

function getSessionUser(db, token, now = new Date()) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.created_at, s.token, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    destroySession(db, token);
    return null;
  }
  return row;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function setSessionCookie(res, token, expiresAt, req) {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))}`,
  ];
  if (req && req.secure) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res, req) {
  const attrs = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (req && req.secure) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

function tokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE] || null;
}

function optionalAuth(db, now) {
  return (req, res, next) => {
    const token = tokenFromRequest(req);
    const row = getSessionUser(db, token, now());
    if (row) {
      req.user = { id: row.id, name: row.name, email: row.email };
      req.sessionToken = token;
    }
    next();
  };
}

function requireAuth(db, now) {
  const optional = optionalAuth(db, now);
  return (req, res, next) => {
    optional(req, res, (err) => {
      if (err) return next(err);
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'unauthorized', message: 'You must be logged in.' },
        });
      }
      next();
    });
  };
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  destroyUserSessions,
  getSessionUser,
  parseCookies,
  tokenFromRequest,
  setSessionCookie,
  clearSessionCookie,
  optionalAuth,
  requireAuth,
};
