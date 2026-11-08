'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await initPage();
  if (!user) return;
  document.getElementById('hero-register').hidden = true;
  document.getElementById('hero-login').hidden = true;
  document.getElementById('hero-book').hidden = false;
  document.getElementById('hero-book').textContent = 'Book now';
});
