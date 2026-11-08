'use strict';

const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    mon: MO_SHORT[m - 1],
    num: String(d),
    dow: WD_SHORT[dt.getDay()],
    long: `${WD_SHORT[dt.getDay()]}, ${MO_SHORT[m - 1]} ${d}, ${y}`,
  };
}

function bookingItem(booking, { cancellable }) {
  const li = document.createElement('li');
  li.className = 'booking-item';
  li.dataset.id = String(booking.id);

  const p = parts(booking.date);

  const chip = document.createElement('div');
  chip.className = 'date-chip';
  chip.setAttribute('aria-hidden', 'true');
  const mon = document.createElement('span');
  mon.className = 'mon';
  mon.textContent = p.mon;
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = p.num;
  const dow = document.createElement('span');
  dow.className = 'dow';
  dow.textContent = p.dow;
  chip.appendChild(mon);
  chip.appendChild(num);
  chip.appendChild(dow);
  li.appendChild(chip);

  const main = document.createElement('div');
  main.className = 'booking-main';

  const title = document.createElement('div');
  title.className = 'booking-title';
  const when = document.createElement('time');
  when.setAttribute('datetime', `${booking.date}T${booking.time}:00`);
  when.textContent = `${p.long} · ${booking.time}`;
  title.appendChild(when);

  const badge = document.createElement('span');
  badge.className = booking.past ? 'badge badge-past' : 'badge badge-ok';
  badge.textContent = booking.past ? 'Completed' : 'Confirmed';
  title.appendChild(badge);

  if (!booking.past) {
    const soon = document.createElement('span');
    soon.className = 'badge badge-time';
    soon.textContent = 'Upcoming';
    title.appendChild(soon);
  }

  const meta = document.createElement('div');
  meta.className = 'booking-meta';
  meta.textContent = booking.note ? booking.note : 'No note added';

  main.appendChild(title);
  main.appendChild(meta);
  li.appendChild(main);

  if (cancellable) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-danger btn-small';
    btn.textContent = 'Cancel';
    btn.addEventListener('click', async () => {
      if (!window.confirm(`Cancel your booking on ${booking.date} at ${booking.time}?`)) return;
      btn.disabled = true;
      btn.textContent = 'Cancelling…';
      try {
        await api(`/api/bookings/${booking.id}`, { method: 'DELETE' });
        toast(`Booking on ${booking.date} cancelled`, 'success');
        await load();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Cancel';
        toast(err.message, 'error');
      }
    });
    li.appendChild(btn);
  }

  return li;
}

function fillList(listId, emptyId, titleId, items) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  const title = document.getElementById(titleId);
  list.textContent = '';
  const has = items.length > 0;
  title.hidden = !has;
  empty.hidden = has;
  items.forEach((b) => list.appendChild(b));
}

async function load() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const errorBox = document.getElementById('load-error');
  errorBox.hidden = true;
  loading.hidden = false;
  content.hidden = true;

  try {
    const data = await api('/api/bookings');
    const upcoming = data.bookings.filter((b) => !b.past).map((b) => bookingItem(b, { cancellable: true }));
    const past = data.bookings.filter((b) => b.past).map((b) => bookingItem(b, { cancellable: false }));
    fillList('upcoming-list', 'upcoming-empty', 'upcoming-title', upcoming);
    fillList('past-list', 'past-empty', 'past-title', past);
    loading.hidden = true;
    content.hidden = false;
    tiltAll('.booking-item', 7);
  } catch (err) {
    loading.hidden = true;
    if (err.status === 401) {
      window.location.href = '/login.html?next=%2Fbookings.html';
      return;
    }
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await initPage({ requireLogin: true });
  if (!user) return;
  enhancePage();
  await load();
});
