(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection?.saveData);
  if (saveData) document.documentElement.dataset.saveData = 'true';
  const language = () => window.Nortivo?.getLanguage() || document.documentElement.lang || 'en';
  const style = getComputedStyle(document.body);
  const ease = style.getPropertyValue('--ease-out').trim() || 'cubic-bezier(.22,1,.36,1)';
  const animations = new Set();
  const observers = [];
  const motionAllowed = () => !reducedMotion.matches && !saveData;

  function runMotion(element, frames, duration, delay = 0) {
    if (!motionAllowed() || !element?.animate) return;
    const animation = element.animate(frames, { duration, delay, easing: ease });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
    animation.oncancel = () => animations.delete(animation);
  }
  function stopMotion() {
    for (const animation of [...animations]) animation.cancel();
    animations.clear();
  }
  document.addEventListener('keydown', stopMotion);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopMotion(); });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    stopMotion();
    for (const observer of observers) observer.disconnect();
  });

  function makeArrow() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('v2-action-arrow');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', 'M5 12h14m-6-6 6 6-6 6');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    svg.append(path);
    return svg;
  }

  for (const action of document.querySelectorAll('a.nt-button, a.invest-button, a.button, a.nt-link, a.text-link')) {
    if (action.classList.contains('v2-action')) continue;
    const face = document.createElement('span');
    face.className = 'v2-action-face';
    const clip = document.createElement('span');
    clip.className = 'v2-action-clip';
    const label = document.createElement('span');
    label.className = 'v2-action-label';
    if (action.dataset.i18n) { label.dataset.i18n = action.dataset.i18n; delete action.dataset.i18n; }
    action.querySelector('svg')?.remove();
    label.append(...action.childNodes);
    clip.append(label);
    face.append(clip, makeArrow());
    action.append(face);
    action.classList.add('v2-action');
    if (action.matches('.nt-link, .text-link') || action.closest('.systems-service')) action.classList.add('v2-text-action');
  }

  const normalizedPath = value => value.replace(/^\/(nb|en)(?=\/)/, '');
  for (const link of document.querySelectorAll('.nt-header .desktop-nav a')) {
    const target = new URL(link.href);
    if (!target.hash && normalizedPath(target.pathname) === normalizedPath(location.pathname)) link.setAttribute('aria-current', 'page');
  }

  runMotion(document.querySelector('[data-master-intro]'), [
    { opacity: .7, transform: 'translateY(12px)', clipPath: 'inset(0 0 2% 0)' },
    { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0)' },
  ], 700);
  runMotion(document.querySelector('[data-master-report]'), [
    { opacity: .75, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' },
  ], 700, 70);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (entry.target.matches('.v2-equity-line')) {
          runMotion(entry.target, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }], 700, 100);
        } else {
          const research = entry.target.dataset.masterReveal === 'research';
          runMotion(entry.target, [
            { opacity: .7, transform: `translateY(${research ? 12 : 16}px)`, clipPath: 'inset(0 0 2% 0)' },
            { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0)' },
          ], 520);
        }
      }
    }, { threshold: .15 });
    for (const element of document.querySelectorAll('[data-master-reveal], .v2-equity-line')) observer.observe(element);
    observers.push(observer);
  }

  const charts = [...document.querySelectorAll('[data-equity-chart]')];
  if (!charts.length) return;
  const formatMoney = value => new Intl.NumberFormat(language(), {
    style: 'currency', currency: 'NOK', currencyDisplay: 'code',
  }).format(value);

  async function initializeCharts() {
    let rows, summary;
    try {
      const responses = await Promise.all([fetch('/report-2026/equity-series.json'), fetch('/report-2026/summary.json')]);
      if (responses.some(response => !response.ok)) return;
      [rows, summary] = await Promise.all(responses.map(response => response.json()));
    } catch { return; }
    if (!Array.isArray(rows) || rows.length < 2 || rows.length !== summary.sessions) return;
    function updateMetrics() {
      const number = value => new Intl.NumberFormat(language()).format(value);
      const percent = value => `${value < 0 ? '−' : '+'}${new Intl.NumberFormat(language(), {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(Math.abs(value))}${language() === 'nb' ? ' ' : ''}%`;
      const values = { profit: formatMoney(summary.profitOre / 100), return: percent(summary.returnOnOpeningEquityPercent), drawdown: percent(summary.maxDrawdownPercent), sessions: number(summary.sessions), trades: number(summary.trades) };
      for (const element of document.querySelectorAll('[data-report-metric]')) if (values[element.dataset.reportMetric]) element.textContent = values[element.dataset.reportMetric];
      const monthFormat = new Intl.DateTimeFormat(language(), { month: 'short', timeZone: 'UTC' });
      for (const month of document.querySelectorAll('[data-month-period]')) {
        month.querySelector('time').textContent = monthFormat.format(new Date(month.dataset.monthPeriod + '-01T00:00:00Z'));
        const value = month.querySelector('[data-month-change-ore]');
        const amount = Number(value.dataset.monthChangeOre);
        value.textContent = (amount < 0 ? '−' : '+') + formatMoney(Math.abs(amount) / 100);
      }
    }
    updateMetrics();
    document.addEventListener('nortivo:language', updateMetrics);
    for (const chart of charts) {
      const svg = chart.querySelector('svg[data-report-equity]');
      const controls = chart.querySelector('.v2-chart-controls');
      const input = controls.querySelector('input'), output = controls.querySelector('output');
      const cursor = svg.querySelector('[data-equity-cursor]');
      const line = cursor.querySelector('line'), dot = cursor.querySelector('circle');
      const low = Number(svg.dataset.low), high = Number(svg.dataset.high);
      input.max = String(rows.length - 1); input.value = input.max;
      let bounds;
      function show(index) {
        const [date, equity] = rows[index];
        const x = 56 + index / (rows.length - 1) * 714;
        const y = 220 - (equity - low) / (high - low) * 200;
        cursor.setAttribute('transform', `translate(${x},0)`);
        dot.setAttribute('cy', String(y));
        line.setAttribute('x1', '0'); line.setAttribute('x2', '0'); cursor.removeAttribute('hidden');
        const formatted = new Intl.DateTimeFormat(language(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z')) + ' · ' + formatMoney(equity);
        output.value = formatted; input.setAttribute('aria-valuetext', formatted);
      }
      function pointerIndex(event) {
        if (!bounds) bounds = svg.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width * 800;
        return Math.max(0, Math.min(rows.length - 1, Math.round((x - 56) / 714 * (rows.length - 1))));
      }
      svg.addEventListener('pointerenter', () => { bounds = svg.getBoundingClientRect(); });
      svg.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || event.buttons) show(pointerIndex(event)); }, { passive: true });
      svg.addEventListener('pointerdown', event => { bounds = svg.getBoundingClientRect(); input.value = String(pointerIndex(event)); show(input.valueAsNumber); }, { passive: true });
      svg.addEventListener('pointerleave', () => { bounds = null; show(input.valueAsNumber); });
      window.addEventListener('resize', () => { bounds = null; }, { passive: true });
      input.addEventListener('input', () => show(input.valueAsNumber));
      document.addEventListener('nortivo:language', () => show(input.valueAsNumber));
      show(input.valueAsNumber); controls.hidden = false;
    }
  }
  initializeCharts();
})();
