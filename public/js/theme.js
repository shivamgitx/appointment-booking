'use strict';

// Runs before first paint to avoid a theme flash (loaded without defer).
(function () {
  try {
    var saved = localStorage.getItem('bookease-theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
      return;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    /* storage unavailable — keep default theme */
  }
})();
