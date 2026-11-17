(() => {
  const header = document.querySelector('.nt-header');
  const hero = document.querySelector('.nt-hero');
  if (!header || !hero) return;

  function syncSurface() {
    const solid = String(window.scrollY > 8);
    if (header.dataset.solid !== solid) header.dataset.solid = solid;
  }

  // Restore the correct surface on deep links and browser-history returns too.
  syncSurface();
  window.addEventListener('scroll', syncSurface, { passive: true });
  window.addEventListener('pageshow', syncSurface);
})();
