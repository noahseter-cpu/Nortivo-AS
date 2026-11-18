(() => {
  const site = window.Nortivo;
  if (!site) return;
  const reviewNote = document.querySelector('[data-local-support-note]');
  if (reviewNote && /^(?:localhost|127\.0\.0\.1|[a-z0-9.-]+\.localhost)$/.test(location.hostname)) reviewNote.hidden=false;
  function localizeDestinations() {
    const locale = site.getLanguage() === 'nb' ? 'nb' : 'en';
    for (const anchor of document.querySelectorAll('[data-brand-destination]')) {
      const service = anchor.dataset.brandDestination;
      const url = new URL(anchor.href);
      const configured = document.querySelector('meta[name="nortivo-' + service + '-origin"]')?.content;
      if (configured) url.href = new URL(configured).origin;
      else if (url.origin === location.origin) url.href = service === 'security' ? 'https://korvnt.no/' : 'https://invest.nortivo.no/';
      url.pathname = '/' + locale + '/' + (anchor.dataset.brandPath || '').replace(/^\/+/, '');
      anchor.href = url.href;
    }
  }
  localizeDestinations();
  document.addEventListener('nortivo:language', localizeDestinations);
  // The same entries drive the static locale build and the in-page switcher.
  fetch('/assets/portal-copy.json', {credentials:'omit'}).then(res => res.ok ? res.json() : null).then(copy => {
    if (!copy) return;
    const subset = {};
    for (const locale of ['en','nb']) {
      subset[locale] = Object.fromEntries(Object.entries(copy[locale] || {}).filter(([key]) => key.startsWith('publicMaster.')));
    }
    site.register(subset);
    localizeDestinations();
  }).catch(() => {});
})();
