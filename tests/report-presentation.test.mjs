import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateReport, formatMetric, renderReportValues, monthlyEquityChanges } from '../scripts/report-presentation.mjs';

const dist = new URL('../dist/', import.meta.url);
const summary = JSON.parse(await readFile(new URL('report-2026/summary.json', dist), 'utf8'));
const rows = JSON.parse(await readFile(new URL('report-2026/equity-series.json', dist), 'utf8'));

test('reported 2026 summary reconciles to the retained historical series', () => {
  assert.doesNotThrow(() => validateReport(summary, rows));
  assert.equal(summary.profitOre, 14553819);
  assert.equal(summary.sessions, 222);
  assert.equal(summary.trades, 1152);
  assert.equal(summary.returnOnOpeningEquityPercent, 58.22);
  assert.equal(summary.maxDrawdownPercent, -26.65);
});

test('changed report data fails publication when dates, equity or risk no longer reconcile', () => {
  for (const altered of [
    { ...summary, profitOre: 14553820 },
    { ...summary, end: '2026-11-18' },
    { ...summary, sessions: 221 },
    { ...summary, maxDrawdownPercent: -2.5 },
  ]) assert.throws(() => validateReport(altered, rows));
});

test('homepage previews and dedicated report use the same localized reported values', async () => {
  for (const locale of ['en', 'nb']) {
    const home = await readFile(new URL(`${locale}/index.html`, dist), 'utf8');
    const report = await readFile(new URL(`${locale}/report-2026/index.html`, dist), 'utf8');
    const expected = formatMetric(summary, 'profit', locale);
    assert.equal((home.match(/data-report-metric="profit"/g) || []).length, 1);
    for (const html of [home, report]) {
      assert.ok(html.includes(expected));
      assert.equal(renderReportValues(html, summary, rows, locale), html);
    }
  }
});

test('monthly equity context includes every source month, preserves losing months and reconciles exactly in øre', () => {
  const months = monthlyEquityChanges(summary, rows);
  assert.equal(months.length, 11);
  assert.equal(months.reduce((sum, month) => sum + month.changeOre, 0), summary.profitOre);
  assert.equal(months.reduce((sum, month) => sum + month.sessions, 0), summary.sessions);
  assert.deepEqual(months.filter(month => month.changeOre < 0).map(month => month.month), ['2026-02', '2026-10']);
  assert.equal(months.find(month => month.month === '2026-05').changeOre, 1529137);
  assert.equal(months.find(month => month.month === '2026-07').changeOre, 2890959);
});

test('homepage session average retains its deployed-capital basis while the report keeps drawdown', async () => {
  for (const locale of ['en', 'nb']) {
    const home = await readFile(new URL(`${locale}/index.html`, dist), 'utf8');
    const report = await readFile(new URL(`${locale}/report-2026/index.html`, dist), 'utf8');
    assert.ok(home.includes(`data-report-metric="deployedDaily">${formatMetric(summary, 'deployedDaily', locale)}`));
    assert.ok(home.includes('data-i18n="platform.averageBasis"'));
    assert.ok(home.includes('data-i18n="platform.fullReport"'));
    assert.ok(report.includes(`data-report-metric="drawdown">${formatMetric(summary, 'drawdown', locale)}`));
    assert.equal(summary.averageDeployedDailyPercent, 2.4);
    assert.equal(summary.averageAccountDailyPercent, 0.2256);
  }
});
