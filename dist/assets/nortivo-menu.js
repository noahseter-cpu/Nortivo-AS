(() => {
  const header = document.querySelector('.editorial-masthead');
  const menu = document.querySelector('#editorial-menu');
  if (!header || typeof menu?.showModal !== 'function') return;

  const trigger = header.querySelector('.editorial-menu-trigger');
  const close = menu.querySelector('.editorial-menu-close');
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
  let opening;

  trigger.addEventListener('click', event => {
    menu.showModal();
    document.body.classList.add('editorial-menu-open');
    if (event.detail && !prefersReducedMotion.matches && menu.animate) {
      opening = menu.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 190, easing });
    }
  });
  close.addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => {
    opening?.cancel();
    document.body.classList.remove('editorial-menu-open');
    trigger.focus({ preventScroll: true });
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) menu.close();
  });
  prefersReducedMotion.addEventListener('change', event => { if (event.matches) opening?.cancel(); });
  document.addEventListener('nortivo:language', event => {
    menu.querySelector('.editorial-menu-teaser img').src = '/report-2026/equity-' + event.detail.language + '.png';
  });

  header.dataset.dialogReady = 'true';
  trigger.hidden = false;
})();
