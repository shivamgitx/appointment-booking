'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  await initPage();
  enhancePage();

  const form = document.getElementById('login-form');
  const submit = document.getElementById('submit-btn');

  clearFieldErrors(['email-error', 'password-error', 'form-error']);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(['email-error', 'password-error', 'form-error']);

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    let valid = true;
    if (!email) {
      showFieldError('email-error', 'Email is required.');
      valid = false;
    }
    if (!password) {
      showFieldError('password-error', 'Password is required.');
      valid = false;
    }
    if (!valid) {
      toast('Please fill in both fields', 'error', 2400);
      return;
    }

    setButtonLoading(submit, true, 'Logging in…');
    try {
      await api('/api/auth/login', { method: 'POST', body: { email, password } });
      toast('Welcome back!', 'success', 2000);
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
      toast(err.message, 'error');
    }
  });
});
