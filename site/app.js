/**
 * EvaluaPro – Marketing Site Scripts
 * SPEC-002 · Versión 2.0.0
 * Responsabilidades: animaciones de reveal, contadores animados, nav móvil, FAQ smooth.
 */

/* ---- INTERSECTION OBSERVER: REVEAL ON SCROLL ---- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* ---- COUNTER ANIMATION ---- */
function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1400;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

const metricObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.metric[data-count]').forEach(animateCounter);
        metricObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.3 }
);

document.querySelectorAll('.hero-metrics, .stats-grid').forEach((el) => metricObserver.observe(el));

/* ---- MOBILE NAV TOGGLE ---- */
const navToggle = document.getElementById('navToggle');
const topbarNav = document.querySelector('.topbar nav');

if (navToggle && topbarNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = topbarNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close nav when clicking a link
  topbarNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      topbarNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!navToggle.contains(e.target) && !topbarNav.contains(e.target)) {
      topbarNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ---- SMOOTH SCROLL FOR ANCHOR LINKS ---- */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const topbarHeight = document.querySelector('.topbar')?.offsetHeight ?? 0;
      const top = target.getBoundingClientRect().top + window.scrollY - topbarHeight - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

/* ---- TOPBAR SCROLL EFFECT ---- */
const topbar = document.querySelector('.topbar');
if (topbar) {
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 80) {
      topbar.style.background = 'rgba(5, 12, 23, 0.96)';
    } else {
      topbar.style.background = '';
    }
    lastScroll = currentScroll;
  }, { passive: true });
}
