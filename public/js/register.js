'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  await initPage();
  enhancePage();

  const form = document.getElementById('register-form');
  const submit = document.getElementById('submit-btn');
  const fields = ['name', 'email', 'password', 'confirm'];

  clearFieldErrors([...fields.map((f) => `${f}-error`), 'form-error']);

  /* ---- password strength meter ---- */
  const strengthBox = document.getElementById('strength');
  const strengthText = document.getElementById('strength-text');
  const passwordInput = document.getElementById('password');

  const scorePassword = (value) => {
    if (!value) return 0;
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(4, score);
  };

  const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

  passwordInput.addEventListener('input', () => {
    const value = passwordInput.value;
    if (!value) {
      strengthBox.hidden = true;
      strengthText.hidden = true;
      strengthBox.className = 'strength';
      return;
    }
    const score = scorePassword(value);
    strengthBox.hidden = false;
    strengthText.hidden = false;
    strengthBox.className = `strength s${score}`;
    strengthText.textContent = STRENGTH_LABELS[score];
  });

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
    if (!valid) {
      toast('Please fix the highlighted fields', 'error', 2600);
      return;
    }

    setButtonLoading(submit, true, 'Creating account…');
    try {
      await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
      toast(`Welcome, ${name.split(' ')[0]}! Your account is ready.`, 'success');
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
