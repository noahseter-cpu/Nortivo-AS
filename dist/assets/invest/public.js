(() => {
  const menu = document.querySelector('.iv-menu-button');
  const mobile = document.querySelector('.iv-mobile-nav');
  const setMenu = open => {
    menu.setAttribute('aria-expanded', String(open));
    mobile.hidden = !open;
  };
  menu.addEventListener('click', () => setMenu(mobile.hidden));
  mobile.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobile.hidden) { setMenu(false); menu.focus(); }
  });
  matchMedia('(min-width: 811px)').addEventListener('change', event => { if (event.matches) setMenu(false); });

  const dialog = document.querySelector('.iv-preview-dialog');
  if (dialog && typeof dialog.showModal === 'function') {
    let trigger;
    document.querySelectorAll('[data-enlarge]').forEach(link => link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = event.currentTarget;
      dialog.showModal();
    }));
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => trigger?.focus());
    dialog.addEventListener('click', event => { if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }});
  }

  const plans = document.querySelector('#plans');
  if (!plans) return;
  // The public page is rendered in full before optional purchase-readiness checks.
  async function checkAvailability() {
    const labels = plans.querySelectorAll('[data-plan-availability]');
    const nb = document.documentElement.lang === 'nb';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch('/.netlify/functions/terminal?action=product-plans', {credentials:'omit', signal:controller.signal, cache:'no-store'});
      if (!response.ok) throw new Error('catalog');
      const catalog = await response.json();
      for (const label of labels) {
        const ready = catalog.availability?.[label.dataset.planAvailability]?.ready;
        if (typeof ready !== 'boolean') continue;
        label.textContent = ready
          ? (nb ? 'Kjøp er tilgjengelig på abonnementssiden.' : 'Purchase is available on the plans page.')
          : (nb ? 'Nye kjøp er ikke åpnet.' : 'New purchases are currently closed.');
      }
    } catch {
      for (const label of labels) label.textContent = nb ? 'Kjøpstilgjengelighet er ikke bekreftet.' : 'Purchase availability could not be confirmed.';
    } finally { clearTimeout(timer); }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {observer.disconnect(); checkAvailability();}
    }, {rootMargin:'180px'});
    observer.observe(plans);
  } else { checkAvailability(); }
})();

