/* Navegación móvil y aparición progresiva sin ocultar contenido si falta JavaScript. */
const navToggle = document.getElementById('navToggle');
const topbarNav = document.getElementById('main-navigation');

if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('has-js');
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
  );

  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
}

if (navToggle && topbarNav) {
  const closeNavigation = () => {
    topbarNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Abrir menú');
  };

  navToggle.addEventListener('click', () => {
    const isOpen = topbarNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
  });

  topbarNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNavigation));
  document.addEventListener('click', (event) => {
    if (!navToggle.contains(event.target) && !topbarNav.contains(event.target)) closeNavigation();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNavigation();
  });
}
