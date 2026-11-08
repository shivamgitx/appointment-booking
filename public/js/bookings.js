'use strict';

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function bookingItem(booking, { cancellable }) {
  const li = document.createElement('li');
  li.className = 'booking-item';
  li.dataset.id = String(booking.id);

  const main = document.createElement('div');
  main.className = 'booking-main';

  const title = document.createElement('span');
  title.className = 'booking-title';
  title.textContent = `${formatDate(booking.date)} · ${booking.time}`;

  const meta = document.createElement('span');
  meta.className = 'booking-meta';
  const bits = [booking.status === 'confirmed' ? 'Confirmed' : booking.status];
  if (booking.note) bits.push(booking.note);
  meta.textContent = bits.join(' — ');

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
        await load();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Cancel';
        window.alert(err.message);
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
  await load();
});
