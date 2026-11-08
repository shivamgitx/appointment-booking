'use strict';

/* ---------------- API helper ---------------- */

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

/* ---------------- URL helpers ---------------- */

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function safeNext(value) {
  if (!value) return '/book.html';
  if (!value.startsWith('/') || value.startsWith('//')) return '/book.html';
  return value;
}

/* ---------------- Form helpers ---------------- */

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

/* ---------------- Toasts ---------------- */

const TOAST_ICONS = {
  success:
    '<svg class="t-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/></svg>',
  error:
    '<svg class="t-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16.5h.01"/></svg>',
  info:
    '<svg class="t-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg>',
};

function toastHost() {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  return host;
}

function toast(message, kind = 'success', duration = 3200) {
  const host = toastHost();
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = (TOAST_ICONS[kind] || TOAST_ICONS.info) + '<span></span>';
  el.lastChild.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, duration);
  return el;
}

/* ---------------- 3D tilt ---------------- */

function attachTilt(el, max = 9) {
  if (!el) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.classList.add('tilt');
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
    el.style.setProperty('--lift', '-5px');
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--lift', '0px');
  });
}

function tiltAll(selector, max) {
  document.querySelectorAll(selector).forEach((el) => attachTilt(el, max));
}

/* ---------------- Ripple ---------------- */

function attachRipple(el) {
  el.addEventListener('pointerdown', (e) => {
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.left = `${e.clientX - r.left - size / 2}px`;
    span.style.top = `${e.clientY - r.top - size / 2}px`;
    el.appendChild(span);
    setTimeout(() => span.remove(), 600);
  });
}

function rippleAll(selector) {
  document.querySelectorAll(selector).forEach(attachRipple);
}

/* ---------------- Theme toggle ---------------- */

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('bookease-theme', theme);
  } catch (e) {
    /* ignore */
  }
}

const SUN_SVG =
  '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON_SVG =
  '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

function buildThemeToggle() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';
  btn.id = 'theme-toggle';
  btn.setAttribute('aria-label', 'Toggle dark mode');
  btn.title = 'Toggle dark mode';
  btn.innerHTML = SUN_SVG + MOON_SVG;
  btn.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    toast(currentTheme() === 'dark' ? 'Dark mode on' : 'Light mode on', 'info', 1600);
  });
  attachRipple(btn);
  return btn;
}

/* ---------------- Navigation ---------------- */

function renderNav(user) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.textContent = '';

  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = '/';
  brand.innerHTML =
    '<span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg></span><span>BookEase</span>';
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
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = (user.name || '?').trim().charAt(0).toUpperCase();
    const nameSpan = document.createElement('span');
    nameSpan.textContent = user.name;
    info.appendChild(avatar);
    info.appendChild(nameSpan);
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
    attachRipple(logout);
    links.appendChild(logout);
  } else {
    addLink('/login.html', 'Log in', 'btn btn-ghost btn-small');
    addLink('/register.html', 'Register', 'btn btn-primary btn-small');
  }

  links.appendChild(buildThemeToggle());
  nav.appendChild(links);
}

/* ---------------- Auth ---------------- */

async function getCurrentUser() {
  try {
    const data = await api('/api/auth/me');
    return data.user || null;
  } catch {
    return null;
  }
}

function goLogin() {
  window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

async function initPage({ requireLogin = false } = {}) {
  const user = await getCurrentUser();
  renderNav(user);
  if (requireLogin && !user) {
    goLogin();
    return null;
  }
  return user;
}

/* ---------------- Shared page enhancements ---------------- */

function enhancePage() {
  rippleAll('.btn');
  tiltAll('.card, .quote, .feature, .booking-item', 8);
}
