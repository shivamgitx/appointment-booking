'use strict';

const express = require('express');
const { requireAuth, optionalAuth } = require('../auth');
const { validateDate, validateTime, validateNote, DATE_RE } = require('../validate');

const SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const OPEN_WEEKDAYS = new Set([1, 2, 3, 4, 5, 6]); // Mon–Sat (closed Sunday)
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function badRequest(message, code = 'validation_error') {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function localDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekdayOf(dateStr) {
  const m = DATE_RE.exec(dateStr);
  const [, y, mo, d] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

function slotDateTime(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

function serializeBooking(row) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  };
}

function createBookingsRouter({ db, now }) {
  const router = express.Router();
  const auth = requireAuth(db, now);
  const optional = optionalAuth(db, now);

  // GET /api/slots?date=YYYY-MM-DD
  router.get('/slots', optional, (req, res, next) => {
    try {
      const date = req.query.date;
      const dateErr = validateDate(date);
      if (dateErr) throw badRequest(dateErr);

      const nowDate = now();
      const today = localDateStr(nowDate);
      const weekday = weekdayOf(date);
      const isOpenDay = OPEN_WEEKDAYS.has(weekday);
      const isPastDate = date < today;

      const booked = new Map();
      if (isOpenDay && !isPastDate) {
        const rows = db
          .prepare("SELECT time, user_id FROM bookings WHERE date = ? AND status = 'confirmed'")
          .all(date);
        for (const r of rows) booked.set(r.time, r.user_id);
      }

      const slots = SLOT_TIMES.map((time) => {
        const ownerId = booked.get(time);
        let available = isOpenDay && !isPastDate && ownerId === undefined;
        let reason = null;
        if (isPastDate) reason = 'past_date';
        else if (!isOpenDay) reason = 'closed';
        else if (ownerId !== undefined) reason = 'taken';
        else if (slotDateTime(date, time).getTime() <= nowDate.getTime()) {
          available = false;
          reason = 'past_time';
        }
        return {
          time,
          available,
          reason,
          mine: ownerId !== undefined && req.user ? ownerId === req.user.id : false,
        };
      });

      res.json({
        date,
        weekday: WEEKDAY_NAMES[weekday],
        open: isOpenDay && !isPastDate,
        slots,
      });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/bookings
  router.get('/bookings', auth, (req, res, next) => {
    try {
      const rows = db
        .prepare(
          'SELECT id, date, time, note, status, created_at FROM bookings WHERE user_id = ? ORDER BY date ASC, time ASC'
        )
        .all(req.user.id);
      const nowTs = now().getTime();
      const bookings = rows.map((r) => {
        const item = serializeBooking(r);
        item.past = slotDateTime(r.date, r.time).getTime() <= nowTs;
        return item;
      });
      res.json({ bookings });
    } catch (e) {
      next(e);
    }
  });

  // POST /api/bookings
  router.post('/bookings', auth, (req, res, next) => {
    try {
      const { date, time, note } = req.body || {};
      const errors = {};
      const dateErr = validateDate(date);
      const timeErr = validateTime(time);
      const noteErr = validateNote(note);
      if (dateErr) errors.date = dateErr;
      if (timeErr) errors.time = timeErr;
      if (noteErr) errors.note = noteErr;
      if (Object.keys(errors).length) {
        const e = new Error('Validation failed');
        e.status = 400;
        e.code = 'validation_error';
        e.fields = errors;
        throw e;
      }

      if (!SLOT_TIMES.includes(time)) throw badRequest('That time is not a bookable slot.');
      const weekday = weekdayOf(date);
      if (!OPEN_WEEKDAYS.has(weekday)) throw badRequest('We are closed on Sundays.', 'closed');

      const nowDate = now();
      const today = localDateStr(nowDate);
      if (date < today) throw badRequest('Cannot book a date in the past.');
      if (slotDateTime(date, time).getTime() <= nowDate.getTime()) {
        throw badRequest('That time slot has already passed.');
      }

      let result;
      try {
        result = db
          .prepare(
            "INSERT INTO bookings (user_id, date, time, note, status) VALUES (?, ?, ?, ?, 'confirmed')"
          )
          .run(req.user.id, date, time, typeof note === 'string' ? note.trim() : '');
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) {
          const mine = db
            .prepare("SELECT id FROM bookings WHERE date = ? AND time = ? AND user_id = ? AND status = 'confirmed'")
            .get(date, time, req.user.id);
          const err = new Error(
            mine ? 'You already booked this slot.' : 'Sorry, that slot was just taken.'
          );
          err.status = 409;
          err.code = mine ? 'duplicate_booking' : 'slot_taken';
          throw err;
        }
        throw e;
      }

      const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ booking: serializeBooking(row) });
    } catch (e) {
      next(e);
    }
  });

  // DELETE /api/bookings/:id
  router.delete('/bookings/:id', auth, (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid booking id.');

      const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
      if (!row) {
        const e = new Error('Booking not found.');
        e.status = 404;
        e.code = 'not_found';
        throw e;
      }
      if (row.user_id !== req.user.id) {
        const e = new Error('You can only manage your own bookings.');
        e.status = 403;
        e.code = 'forbidden';
        throw e;
      }
      if (slotDateTime(row.date, row.time).getTime() <= now().getTime()) {
        throw badRequest('Past bookings cannot be cancelled.', 'past_booking');
      }
      db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
      res.json({ ok: true, id });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

module.exports = { createBookingsRouter, SLOT_TIMES, OPEN_WEEKDAYS };
