'use strict';

async function api(path, options = {}) {
  const method = options.method || 'GET';
  const opts = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' },
  };
  if (method !== 'GET' && method !== 'HEAD') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(options.body === undefined ? {} : options.body);
  }
  const res = await fetch(path, opts);
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data && data.error && data.error.code;
    err.fields = (data && data.error && data.error.fields) || null;
    throw err;
  }
  return data;
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function safeNext(value) {
  if (!value) return '/book.html';
  if (!value.startsWith('/') || value.startsWith('//')) return '/book.html';
  return value;
}

function showFieldError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

function showFormError(id, message) {
  showFieldError(id, message);
}

function clearFieldErrors(ids) {
  ids.forEach((id) => showFieldError(id, ''));
}

function setButtonLoading(button, loading, loadingLabel) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.textContent;
    button.textContent = loadingLabel || 'Working…';
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

async function getCurrentUser() {
  try {
    const data = await api('/api/auth/me');
    return data.user || null;
  } catch {
    return null;
  }
}

function renderNav(user) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.textContent = '';

  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = '/';
  brand.textContent = 'BookEase';
  nav.appendChild(brand);

  const links = document.createElement('nav');
  links.className = 'nav-links';

  const addLink = (href, label, cls) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (cls) a.className = cls;
    links.appendChild(a);
    return a;
  };

  if (user) {
    addLink('/book.html', 'Book');
    addLink('/bookings.html', 'My bookings');
    const info = document.createElement('span');
    info.className = 'nav-user';
    info.textContent = user.name;
    links.appendChild(info);

    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'btn btn-ghost btn-small';
    logout.id = 'logout-btn';
    logout.textContent = 'Log out';
    logout.addEventListener('click', async () => {
      try {
        await api('/api/auth/logout', { method: 'POST' });
      } finally {
        window.location.href = '/';
      }
    });
    links.appendChild(logout);
  } else {
    addLink('/login.html', 'Log in', 'btn btn-ghost btn-small');
    addLink('/register.html', 'Register', 'btn btn-primary btn-small');
  }

  nav.appendChild(links);
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return null;
  }
  return user;
}

async function initPage({ requireLogin = false } = {}) {
  const user = await getCurrentUser();
  renderNav(user);
  if (requireLogin && !user) {
    window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return null;
  }
  return user;
}
