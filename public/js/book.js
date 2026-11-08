'use strict';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DATE_INPUT = document.getElementById('date');
const SLOTS_WRAP = document.getElementById('slots');
const FORM = document.getElementById('book-form');
const SUBMIT = document.getElementById('submit-btn');

let selectedTime = null;
let slotsRequest = 0;
let viewYear;
let viewMonth; // 0-11

/* ---------------- date helpers ---------------- */

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysStr(str, days) {
  const dt = fromStr(str);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

function nextOpenDay(fromStr) {
  let candidate = fromStr;
  for (let i = 0; i < 30; i++) {
    if (fromStrToWeekday(candidate) !== 0) return candidate;
    candidate = addDaysStr(candidate, 1);
  }
  return fromStr;
}

function fromStrToWeekday(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function formatLong(str) {
  const dt = fromStr(str);
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ---------------- calendar ---------------- */

function todayStr() {
  return toDateStr(new Date());
}

function renderCalendar() {
  const title = document.getElementById('cal-title');
  const dowWrap = document.getElementById('cal-dow');
  const daysWrap = document.getElementById('cal-days');
  const prev = document.getElementById('cal-prev');
  const next = document.getElementById('cal-next');

  title.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

  if (!dowWrap.dataset.filled) {
    DOW.forEach((d) => {
      const el = document.createElement('span');
      el.className = 'cal-dow';
      el.textContent = d.charAt(0);
      el.title = d;
      dowWrap.appendChild(el);
    });
    dowWrap.dataset.filled = '1';
  }

  const first = new Date(viewYear, viewMonth, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayStr();
  const selected = DATE_INPUT.value;

  daysWrap.textContent = '';

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'day';

    let dateStr;
    if (dayNum < 1) {
      const d = new Date(viewYear, viewMonth, dayNum);
      dateStr = toDateStr(d);
      btn.classList.add('other', 'disabled');
      btn.disabled = true;
      btn.textContent = d.getDate();
    } else if (dayNum > daysInMonth) {
      const d = new Date(viewYear, viewMonth, dayNum);
      dateStr = toDateStr(d);
      btn.classList.add('other', 'disabled');
      btn.disabled = true;
      btn.textContent = d.getDate();
    } else {
      const d = new Date(viewYear, viewMonth, dayNum);
      dateStr = toDateStr(d);
      btn.textContent = String(dayNum);
      const weekday = new Date(Date.UTC(viewYear, viewMonth, dayNum)).getUTCDay();
      if (dateStr === today) btn.classList.add('today');
      if (weekday === 0) {
        btn.classList.add('closed', 'disabled');
        btn.disabled = true;
        btn.title = 'Closed on Sundays';
      } else if (dateStr < today) {
        btn.classList.add('disabled');
        btn.disabled = true;
        btn.title = 'Past date';
      }
      if (dateStr === selected) {
        btn.classList.add('sel');
        btn.setAttribute('aria-pressed', 'true');
      }
    }

    btn.setAttribute('aria-label', formatLong(dateStr));
    if (!btn.disabled) {
      btn.addEventListener('click', () => selectDate(dateStr));
    }
    daysWrap.appendChild(btn);
  }

  const minMonth = new Date();
  minMonth.setDate(1);
  prev.disabled = new Date(viewYear, viewMonth, 1) <= minMonth;
}

function selectDate(dateStr) {
  DATE_INPUT.value = dateStr;
  showFieldError('date-error', '');
  showFieldError('time-error', '');
  const line = document.getElementById('selected-date');
  line.textContent = `📅 ${formatLong(dateStr)}`;
  line.hidden = false;
  updateSteps();
  renderCalendar();
  loadSlots();
}

/* ---------------- steps ---------------- */

function updateSteps() {
  const s1 = document.getElementById('step-1');
  const s2 = document.getElementById('step-2');
  const s3 = document.getElementById('step-3');
  s1.className = DATE_INPUT.value ? 'done' : 'active';
  if (!DATE_INPUT.value) {
    s2.className = '';
    s3.className = '';
    return;
  }
  if (selectedTime) {
    s2.className = 'done';
    s3.className = 'active';
  } else {
    s2.className = 'active';
    s3.className = '';
  }
}

/* ---------------- slots ---------------- */

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
    updateSteps();
    return;
  }

  const anyAvailable = payload.slots.some((s) => s.available);
  if (!anyAvailable) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No slots available for this date.';
    SLOTS_WRAP.appendChild(p);
    updateSteps();
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
      updateSteps();
    });
    SLOTS_WRAP.appendChild(btn);
  });
  updateSteps();
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
  updateSteps();

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

/* ---------------- init ---------------- */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await initPage({ requireLogin: true });
  if (!user) return;
  enhancePage();

  const today = todayStr();
  if (!DATE_INPUT.value) {
    DATE_INPUT.value = nextOpenDay(today);
  }

  const defaultDate = fromStr(DATE_INPUT.value);
  viewYear = defaultDate.getFullYear();
  viewMonth = defaultDate.getMonth();

  const line = document.getElementById('selected-date');
  line.textContent = `📅 ${formatLong(DATE_INPUT.value)}`;
  line.hidden = false;

  document.getElementById('cal-prev').addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
  });

  renderCalendar();
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
      toast('Pick a time slot first', 'error', 2400);
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
      toast(`Booked ${data.booking.date} at ${data.booking.time} ✓`, 'success');
      document.getElementById('note').value = '';
      await loadSlots();
    } catch (err) {
      setButtonLoading(SUBMIT, false);
      if (err.code === 'slot_taken' || err.code === 'duplicate_booking') {
        showFieldError('time-error', err.message);
        toast(err.message, 'error');
        await loadSlots();
      } else if (err.fields) {
        for (const [key, msg] of Object.entries(err.fields)) {
          showFieldError(`${key}-error`, msg);
        }
        toast('Please fix the highlighted fields', 'error');
      } else if (err.status === 401) {
        window.location.href = '/login.html?next=%2Fbook.html';
      } else {
        showFormError('form-error', err.message);
        toast(err.message, 'error');
      }
    }
  });
});
