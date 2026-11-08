'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  await initPage();

  const form = document.getElementById('login-form');
  const submit = document.getElementById('submit-btn');

  clearFieldErrors(['email-error', 'password-error', 'form-error']);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(['email-error', 'password-error', 'form-error']);

    const email = form.email.value.trim();
    const password = form.password.value;

    let valid = true;
    if (!email) {
      showFieldError('email-error', 'Email is required.');
      valid = false;
    }
    if (!password) {
      showFieldError('password-error', 'Password is required.');
      valid = false;
    }
    if (!valid) return;

    setButtonLoading(submit, true, 'Logging in…');
    try {
      await api('/api/auth/login', { method: 'POST', body: { email, password } });
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
