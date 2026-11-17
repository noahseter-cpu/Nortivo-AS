(() => {
  const header = document.querySelector('.nt-header');
  const hero = document.querySelector('.nt-hero');
  if (!header || !hero || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    header.dataset.solid = String(!entries[0].isIntersecting);
  }, { rootMargin: '-120px 0px 0px 0px', threshold: 0 });
  observer.observe(hero);
})();
