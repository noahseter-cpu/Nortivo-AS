import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function validateReport(summary, rows) {
  for (const key of ['openingEquityOre', 'closingEquityOre', 'profitOre', 'sessions', 'trades']) {
    if (!Number.isSafeInteger(summary[key])) throw new Error(`Report ${key} must be an exact integer.`);
  }
  if (summary.currency !== 'NOK' || summary.closingEquityOre - summary.openingEquityOre !== summary.profitOre) {
    throw new Error('Report currency or profit does not reconcile.');
  }
  if (rows.length !== summary.sessions || rows[0][0] !== summary.start || rows.at(-1)[0] !== summary.end
    || Math.round(rows.at(-1)[1] * 100) !== summary.closingEquityOre) {
    throw new Error('Report period, sessions or closing equity differs from the equity series.');
  }
  const totalReturn = Number((summary.profitOre / summary.openingEquityOre * 100).toFixed(2));
  let peak = summary.openingEquityOre / 100;
  let drawdown = 0;
  for (const [date, value] of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value) || value <= 0) throw new Error('Invalid equity row.');
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, (value / peak - 1) * 100);
  }
  if (totalReturn !== summary.returnOnOpeningEquityPercent || Number(drawdown.toFixed(2)) !== summary.maxDrawdownPercent) {
    throw new Error('Report return or drawdown differs from its source series.');
  }
}

export function formatMetric(summary, key, locale) {
  const number = (value, digits = 0) => new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
  const money = value => new Intl.NumberFormat(locale, {
    style: 'currency', currency: summary.currency, currencyDisplay: 'code',
  }).format(value / 100);
  const percent = (value, digits = 2) => `${value < 0 ? '−' : '+'}${number(Math.abs(value), digits)}${locale === 'nb' ? ' ' : ''}%`;
  const metrics = {
    profit: () => money(summary.profitOre),
    return: () => percent(summary.returnOnOpeningEquityPercent),
    drawdown: () => percent(summary.maxDrawdownPercent),
    deployedDaily: () => percent(summary.averageDeployedDailyPercent),
    accountDaily: () => percent(summary.averageAccountDailyPercent, 4),
    closing: () => money(summary.closingEquityOre),
    sessions: () => number(summary.sessions),
    trades: () => number(summary.trades),
  };
  if (!metrics[key]) throw new Error(`Unknown report metric ${key}.`);
  return metrics[key]();
}

export function equitySvg(rows) {
  const left = 56, right = 770, top = 20, bottom = 220;
  const values = rows.map(row => row[1]);
  const low = Math.floor(Math.min(...values) / 50000) * 50000;
  const high = Math.ceil(Math.max(...values) / 50000) * 50000;
  const points = rows.map((row, index) => [
    left + index / (rows.length - 1) * (right - left),
    bottom - (row[1] - low) / (high - low) * (bottom - top),
  ].map(value => value.toFixed(2)).join(',')).join(' ');
  const grid = Array.from({ length: 4 }, (_, index) => {
    const y = top + index / 3 * (bottom - top);
    const value = Math.round((high - index / 3 * (high - low)) / 1000);
    return `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" class="v2-chart-grid"/><text x="0" y="${y + 4}" class="v2-chart-axis">${value}k</text>`;
  }).join('');
  return `<svg data-report-equity viewBox="0 0 800 250" preserveAspectRatio="none" width="800" height="250" aria-hidden="true" data-low="${low}" data-high="${high}">${grid}<polygon points="${left},${bottom} ${points} ${right},${bottom}" class="v2-chart-area"/><polyline points="${points}" class="v2-equity-line"/><g data-equity-cursor hidden><line y1="${top}" y2="${bottom}" class="v2-crosshair"/><circle r="4" class="v2-chart-dot"/></g></svg>`;
}

export function monthlyEquityChanges(summary, rows) {
  let previous = summary.openingEquityOre;
  const months = new Map();
  for (const [date, equity] of rows) {
    const month = date.slice(0, 7);
    if (!months.has(month)) months.set(month, { month, openingOre: previous, closingOre: previous, sessions: 0 });
    const period = months.get(month);
    period.closingOre = Math.round(equity * 100);
    period.sessions++;
    previous = period.closingOre;
  }
  return [...months.values()].map(period => ({ ...period, changeOre: period.closingOre - period.openingOre }));
}

export function renderMonthlyChanges(summary, rows, locale) {
  const months = monthlyEquityChanges(summary, rows);
  const lower = Math.min(0, ...months.map(month => month.changeOre));
  const upper = Math.max(0, ...months.map(month => month.changeOre));
  const span = upper - lower;
  const zero = -lower / span * 400;
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: summary.currency, currencyDisplay: 'code' });
  const date = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  return '<ol class="master-months">' + months.map(month => {
    const end = (month.changeOre - lower) / span * 400;
    const sign = month.changeOre < 0 ? '−' : '+';
    return `<li class="master-month" data-month-period="${month.month}"><time datetime="${month.month}">${date.format(new Date(month.month + '-01T00:00:00Z'))}</time><svg viewBox="0 0 400 24" preserveAspectRatio="none" width="400" height="24" aria-hidden="true"><line x1="${zero.toFixed(2)}" x2="${zero.toFixed(2)}" y1="0" y2="24" class="master-month-zero"/><rect x="${Math.min(zero, end).toFixed(2)}" y="5" width="${Math.abs(end - zero).toFixed(2)}" height="14" class="${month.changeOre < 0 ? 'master-month-loss' : 'master-month-gain'}"/></svg><span class="master-month-value" data-month-change-ore="${month.changeOre}">${sign}${money.format(Math.abs(month.changeOre) / 100)}</span></li>`;
  }).join('') + '</ol>';
}

export function renderReportValues(html, summary, rows, locale) {
  return html.replace(/(<(?:strong|dd|span)\b[^>]*data-report-metric="([^"]+)"[^>]*>)[^<]*(<\/(?:strong|dd|span)>)/g,
    (_, start, metric, end) => start + formatMetric(summary, metric, locale) + end)
    .replace(/<svg data-report-equity\b[^>]*>[\s\S]*?<\/svg>/g, () => equitySvg(rows))
    .replace(/(<!-- report-monthly:start -->)[\s\S]*?(<!-- report-monthly:end -->)/g,
      (_, start, end) => start + renderMonthlyChanges(summary, rows, locale) + end);
}

export async function loadReport(distDir) {
  let summary;
  try { summary = JSON.parse(await readFile(path.join(distDir, 'report-2026/summary.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const rows = JSON.parse(await readFile(path.join(distDir, 'report-2026/equity-series.json'), 'utf8'));
  validateReport(summary, rows);
  return { summary, rows };
}

export async function syncDedicatedReports(distDir, report) {
  for (const prefix of ['', 'nb/', 'en/']) {
    const file = path.join(distDir, prefix, 'report-2026/index.html');
    const html = await readFile(file, 'utf8');
    await writeFile(file, renderReportValues(html, report.summary, report.rows, prefix === 'nb/' ? 'nb' : 'en'));
  }
}
