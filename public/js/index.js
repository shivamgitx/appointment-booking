'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await initPage();
  enhancePage();

  if (user) {
    document.getElementById('hero-register').hidden = true;
    document.getElementById('hero-login').hidden = true;
    document.getElementById('hero-book').hidden = false;
    document.getElementById('hero-book').textContent = 'Book now';
  }

  /* ---- typing headline ---- */
  const typed = document.getElementById('typed');
  const phrases = ['in seconds', 'in one click', 'the smart way'];
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typed && !reduce) {
    let p = 0;
    let len = phrases[0].length;
    let deleting = false;
    const tick = () => {
      const phrase = phrases[p];
      if (!deleting) {
        len += 1;
        typed.textContent = phrase.slice(0, len);
        if (len >= phrase.length) {
          deleting = true;
          setTimeout(tick, 1700);
          return;
        }
      } else {
        len -= 1;
        typed.textContent = phrase.slice(0, len);
        if (len <= 0) {
          deleting = false;
          p = (p + 1) % phrases.length;
        }
      }
      setTimeout(tick, deleting ? 45 : 85);
    };
    setTimeout(tick, 1900);
  }

  /* ---- animated stat counters ---- */
  const animateCount = (el) => {
    const target = Number(el.dataset.count || 0);
    const suffix = el.dataset.suffix || '';
    const dur = 1100;
    const start = performance.now();
    const frame = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = `${Math.round(target * eased)}${suffix}`;
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  if (!reduce) {
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = `0${el.dataset.suffix || ''}`;
      setTimeout(() => animateCount(el), 500);
    });
  }

  /* ---- hero parallax (3D depth on blobs + mock window) ---- */
  const hero = document.getElementById('hero');
  if (hero && !reduce) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width - 0.5;
      const my = (e.clientY - r.top) / r.height - 0.5;
      hero.style.setProperty('--mx', mx.toFixed(3));
      hero.style.setProperty('--my', my.toFixed(3));
      const mock = hero.querySelector('.mock-window');
      if (mock) {
        mock.style.transform = `rotateX(${(8 - my * 10).toFixed(2)}deg) rotateY(${(-6 + mx * 12).toFixed(2)}deg)`;
      }
    });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--mx', 0);
      hero.style.setProperty('--my', 0);
      const mock = hero.querySelector('.mock-window');
      if (mock) mock.style.transform = 'rotateX(8deg) rotateY(-6deg)';
    });
  }

  /* ---- sticky CTA after scrolling past hero ---- */
  const cta = document.getElementById('sticky-cta');
  if (cta && !user) {
    const onScroll = () => {
      const show = window.scrollY > 620;
      cta.classList.toggle('show', show);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
});
