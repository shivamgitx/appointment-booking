'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function validateName(value) {
  if (typeof value !== 'string' || value.trim().length < 2) return 'Name must be at least 2 characters.';
  if (value.trim().length > 100) return 'Name must be at most 100 characters.';
  return null;
}

function validateEmail(value) {
  if (typeof value !== 'string' || value.trim() === '') return 'Email is required.';
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'Enter a valid email address.';
  return null;
}

function normalizeEmail(value) {
  return String(value).trim().toLowerCase();
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > 200) return 'Password must be at most 200 characters.';
  return null;
}

function validateDate(value) {
  if (typeof value !== 'string') return 'Date is required.';
  const m = DATE_RE.exec(value);
  if (!m) return 'Date must use YYYY-MM-DD format.';
  const [, y, mo, d] = m.map(Number);
  if (!isCalendarDate(y, mo, d)) return 'Date is not a valid calendar date.';
  return null;
}

function validateTime(value) {
  if (typeof value !== 'string') return 'Time is required.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return 'Time must use HH:MM format.';
  return null;
}

function validateNote(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return 'Note must be text.';
  if (value.length > 500) return 'Note must be at most 500 characters.';
  return null;
}

module.exports = {
  EMAIL_RE,
  DATE_RE,
  validateName,
  validateEmail,
  validatePassword,
  validateDate,
  validateTime,
  validateNote,
  normalizeEmail,
};
