(async () => {
  const input = document.querySelector('#report-session');
  if (!input) return;
  // Keep the reported amount intact when enlarged text wraps at the currency.
  const headline = document.querySelector('.flight-report-highlight strong[data-report-metric="profit"]');
  const headlineText = headline?.textContent;
  if (headlineText) {
    const prefix = headlineText.match(/^NOK[\s\u00a0\u202f]+/);
    const suffix = headlineText.match(/^(.*?[\s\u00a0\u202f]+)NOK$/);
    const splitAt = prefix ? prefix[0].length : suffix?.[1].length;
    if (splitAt) {
      const parts = [headlineText.slice(0, splitAt), headlineText.slice(splitAt)].map(text => {
        const part = document.createElement('span');
        part.className = 'report-money-part';
        part.textContent = text;
        return part;
      });
      headline.replaceChildren(parts[0], document.createElement('wbr'), parts[1]);
    }
  }
  const controls = input.closest('.report-explorer');
  const output = controls.querySelector('output');
  const plot = document.querySelector('.report-plot');
  const cursor = plot.querySelector('.report-cursor');

  let rows;
  try {
    const response = await fetch('/report-2026/equity-series.json');
    if (!response.ok) return;
    rows = await response.json();
  } catch {
    return;
  }
  if (!Array.isArray(rows) || rows.length < 2) return;

  const locale = document.documentElement.lang;
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const moneyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency: 'NOK', currencyDisplay: 'code' });
  // Pixel bounds of the plot inside the 1160 by 435 chart image.
  const bounds = { left: 115 / 1160, right: 1128 / 1160, top: 30 / 435, bottom: 380 / 435 };
  const values = rows.map(row => row[1]);
  const lower = Math.floor(Math.min(...values) / 50000) * 50000;
  const upper = Math.ceil(Math.max(...values) / 50000) * 50000;

  function show(index) {
    const [date, equity] = rows[index];
    const formatted = dateFormat.format(new Date(date + 'T00:00:00Z')) + ' · ' + moneyFormat.format(equity);
    output.value = formatted;
    input.setAttribute('aria-valuetext', formatted);
    const horizontal = bounds.left + index / (rows.length - 1) * (bounds.right - bounds.left);
    const vertical = 1 - (equity - lower) / (upper - lower);
    cursor.style.setProperty('--plot-x', (horizontal * 100) + '%');
    cursor.style.setProperty('--plot-y', (vertical * 100) + '%');
  }

  input.max = String(rows.length - 1);
  input.value = input.max;
  input.addEventListener('input', () => show(input.valueAsNumber));
  plot.addEventListener('click', event => {
    const frame = plot.querySelector('img').getBoundingClientRect();
    const position = (event.clientX - frame.left) / frame.width;
    const ratio = Math.max(0, Math.min(1, (position - bounds.left) / (bounds.right - bounds.left)));
    input.value = String(Math.round(ratio * (rows.length - 1)));
    show(input.valueAsNumber);
  });
  show(input.valueAsNumber);
  cursor.hidden = false;
  controls.hidden = false;
})();
