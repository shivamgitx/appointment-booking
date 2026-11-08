'use strict';

const DATE_INPUT = document.getElementById('date');
const SLOTS_WRAP = document.getElementById('slots');
const FORM = document.getElementById('book-form');
const SUBMIT = document.getElementById('submit-btn');

let selectedTime = null;
let slotsRequest = 0;

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(str, days) {
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

function nextOpenDay(fromStr) {
  let candidate = fromStr;
  for (let i = 0; i < 30; i++) {
    const [y, m, d] = candidate.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (weekday !== 0) return candidate;
    candidate = addDays(candidate, 1);
  }
  return fromStr;
}

function renderSlots(payload) {
  SLOTS_WRAP.textContent = '';
  selectedTime = null;
  setButtonLoading(SUBMIT, false);

  if (!payload.open) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent =
      payload.weekday === 'Sunday'
        ? 'We are closed on Sundays — please pick another day.'
        : 'That date is not bookable.';
    SLOTS_WRAP.appendChild(p);
    return;
  }

  const anyAvailable = payload.slots.some((s) => s.available);
  if (!anyAvailable) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No slots available for this date.';
    SLOTS_WRAP.appendChild(p);
    return;
  }

  payload.slots.forEach((slot) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.dataset.time = slot.time;
    btn.textContent = slot.time;
    btn.disabled = !slot.available;
    if (!slot.available) {
      btn.classList.add('slot-disabled');
      const reason =
        slot.reason === 'taken'
          ? slot.mine
            ? 'You already booked this slot'
            : 'Already booked'
          : slot.reason === 'past_time'
            ? 'Time has passed'
            : 'Unavailable';
      btn.title = reason;
      btn.setAttribute('aria-disabled', 'true');
    } else if (slot.mine) {
      btn.classList.add('slot-mine');
      btn.title = 'You already booked this slot';
      btn.disabled = true;
    }
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      SLOTS_WRAP.querySelectorAll('.slot').forEach((b) => b.classList.remove('slot-selected'));
      btn.classList.add('slot-selected');
      selectedTime = slot.time;
      showFieldError('time-error', '');
    });
    SLOTS_WRAP.appendChild(btn);
  });
}

async function loadSlots() {
  const date = DATE_INPUT.value;
  selectedTime = null;
  SLOTS_WRAP.textContent = '';
  const empty = document.createElement('p');
  empty.className = 'hint';
  empty.textContent = 'Loading times…';
  SLOTS_WRAP.appendChild(empty);
  showFieldError('date-error', '');
  showFieldError('time-error', '');

  if (!date) return;

  const requestId = ++slotsRequest;
  try {
    const data = await api(`/api/slots?date=${encodeURIComponent(date)}`);
    if (requestId !== slotsRequest) return;
    renderSlots(data);
  } catch (err) {
    if (requestId !== slotsRequest) return;
    SLOTS_WRAP.textContent = '';
    showFieldError('date-error', err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await initPage({ requireLogin: true });
  if (!user) return;

  const today = toDateStr(new Date());
  DATE_INPUT.min = today;
  if (!DATE_INPUT.value) {
    DATE_INPUT.value = nextOpenDay(today);
  }

  DATE_INPUT.addEventListener('change', loadSlots);
  await loadSlots();

  FORM.addEventListener('submit', async (event) => {
    event.preventDefault();
    showFormError('form-error', '');
    showFormError('form-success', '');
    showFieldError('date-error', '');
    showFieldError('time-error', '');

    const date = DATE_INPUT.value;
    const note = document.getElementById('note').value;

    if (!date) {
      showFieldError('date-error', 'Please choose a date.');
      return;
    }
    if (!selectedTime) {
      showFieldError('time-error', 'Please select an available time slot.');
      return;
    }

    setButtonLoading(SUBMIT, true, 'Booking…');
    try {
      const data = await api('/api/bookings', {
        method: 'POST',
        body: { date, time: selectedTime, note },
      });
      const success = document.getElementById('form-success');
      success.textContent = `Booked ${data.booking.date} at ${data.booking.time}. See it in your booking history.`;
      success.hidden = false;
      document.getElementById('note').value = '';
      await loadSlots();
    } catch (err) {
      setButtonLoading(SUBMIT, false);
      if (err.code === 'slot_taken' || err.code === 'duplicate_booking') {
        showFieldError('time-error', err.message);
        await loadSlots();
      } else if (err.fields) {
        for (const [key, msg] of Object.entries(err.fields)) {
          showFieldError(`${key}-error`, msg);
        }
      } else if (err.status === 401) {
        window.location.href = '/login.html?next=%2Fbook.html';
      } else {
        showFormError('form-error', err.message);
      }
    }
  });
});
