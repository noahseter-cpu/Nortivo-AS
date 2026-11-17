(() => {
  const stage = document.querySelector('.chapter-stage');
  if (!stage || !window.Nortivo) return;

  const controls = stage.querySelector('.chapter-controls');
  const buttons = Array.from(controls.querySelectorAll('[data-chapter]'));
  const photos = Array.from(stage.querySelectorAll('[data-chapter-photo]'));
  const copy = stage.querySelector('.editorial-stage-copy');
  const panel = stage.querySelector('.flight-console');
  const ledger = stage.querySelector('.flight-ledger');
  const heading = copy.querySelector('h1');
  const lead = copy.querySelector('p');
  const action = copy.querySelector('a');
  const announcement = stage.querySelector('.chapter-announcement');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
  const scenes = {
    strategy: { heading: 'editorial.heading', lead: 'editorial.lead', action: 'editorial.explore', url: '#offer' },
    replay: { heading: 'chapter.replayHeadline', lead: 'chapter.replayLead', action: 'chapter.replayAction', url: '#replay' },
    report: { heading: 'chapter.reportHeadline', lead: 'chapter.reportLead', action: 'chapter.reportAction' },
  };
  let current = 'strategy';
  let animations = [];

  function stopMotion() {
    for (const animation of animations) animation.cancel();
    animations = [];
  }

  function updateCopy() {
    const scene = scenes[current];
    const locale = window.Nortivo.getLanguage();
    for (const [element, key] of [[heading, scene.heading], [lead, scene.lead], [action, scene.action]]) {
      element.dataset.i18n = key;
      element.textContent = window.Nortivo.translate(key);
    }
    action.href = scene.url || '/' + locale + '/report-2026/';
    const localizedChart = '/report-2026/equity-' + locale + '.png';
    panel.hidden = current === 'report';
    ledger.hidden = current !== 'report';
    const reportPhoto = ledger.querySelector('img');
    const reportPreview = document.querySelector('.resource-report img');
    for (const image of [reportPhoto, reportPreview]) {
      if (image && image.getAttribute('src') !== localizedChart) image.src = localizedChart;
    }
  }

  function select(key, withMotion) {
    if (!scenes[key] || key === current) return;
    const transition = withMotion && !reducedMotion.matches && typeof copy.animate === 'function';
    const starting = transition ? photos.map(photo => Number(getComputedStyle(photo).opacity)) : [];

    stopMotion();
    current = key;
    stage.dataset.currentChapter = key;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.chapter === key));
    for (const photo of photos) photo.dataset.active = String(photo.dataset.chapterPhoto === key);
    updateCopy();
    announcement.textContent = buttons.find(button => button.dataset.chapter === key).textContent;

    if (!transition) return;
    photos.forEach((photo, index) => {
      const target = photo.dataset.active === 'true' ? 1 : 0;
      if (Math.abs(starting[index] - target) < .001) return;
      animations.push(photo.animate([{ opacity: starting[index] }, { opacity: target }], { duration: 280, easing }));
    });
    animations.push(copy.animate(
      [{ opacity: .52, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 200, easing },
    ));
  }

  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-chapter]');
    if (button) select(button.dataset.chapter, event.detail > 0);
  });
  reducedMotion.addEventListener('change', event => { if (event.matches) stopMotion(); });
  document.addEventListener('nortivo:language', updateCopy);
  updateCopy();
  controls.hidden = false;
  function matchFragment() { if (location.hash === '#replay') select('replay', false); }
  document.addEventListener('click', event => {
    if (event.target.closest('a[href="#replay"]')) select('replay', false);
  });
  window.addEventListener('hashchange', matchFragment);
  matchFragment();

})();
