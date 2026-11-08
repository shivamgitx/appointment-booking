'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  await initPage();

  const form = document.getElementById('register-form');
  const submit = document.getElementById('submit-btn');
  const fields = ['name', 'email', 'password', 'confirm'];

  clearFieldErrors([...fields.map((f) => `${f}-error`), 'form-error']);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors([...fields.map((f) => `${f}-error`), 'form-error']);

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirm = form.elements.confirm.value;

    let valid = true;
    if (name.length < 2) {
      showFieldError('name-error', 'Name must be at least 2 characters.');
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showFieldError('email-error', 'Enter a valid email address.');
      valid = false;
    }
    if (password.length < 8) {
      showFieldError('password-error', 'Password must be at least 8 characters.');
      valid = false;
    }
    if (confirm !== password) {
      showFieldError('confirm-error', 'Passwords do not match.');
      valid = false;
    }
    if (!valid) return;

    setButtonLoading(submit, true, 'Creating account…');
    try {
      await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
      window.location.href = safeNext(qs('next'));
    } catch (err) {
      setButtonLoading(submit, false);
      if (err.fields) {
        for (const [key, msg] of Object.entries(err.fields)) {
          showFieldError(`${key}-error`, msg);
        }
      } else {
        showFormError('form-error', err.message);
      }
    }
  });
});
