import test from 'node:test';
import assert from 'node:assert/strict';
import { createSec } from '../providers/sec.mjs';
import { createFred } from '../providers/fred.mjs';

// Deliberately synthetic fixtures. No upstream request is made by this file.
const NOW = Date.parse('2026-11-18T18:00:00Z');
const USER_AGENT = 'Nortivo automated fixture tests qa@example.test';
const KEY = 'a'.repeat(32);
const CIK = '0000000123';
const cache = { hit: false, stale: false, ageMs: 0 };
const catalogFixture = {
  fields: ['cik', 'name', 'ticker', 'exchange'],
  data: [[123, 'Synthetic Sample Issuer', 'TEST', 'Nasdaq'], [123, 'Synthetic Preferred Class', 'TEST-A', 'NYSE'], [456, 'Synthetic Other Issuer', 'OTHER', 'NYSE']],
};
const filingsFixture = {
  cik: '123', name: 'Synthetic Sample Issuer', tickers: ['TEST', 'TEST-A'], exchanges: ['Nasdaq', 'NYSE'],
  sic: '1234', sicDescription: 'Synthetic industry', entityType: 'operating', fiscalYearEnd: '1231',
  filings: {
    recent: {
      accessionNumber: ['0000000123-26-000003', '0000000123-26-000002', '0000000123-26-000001', '0000000123-26-000004'],
      form: ['10-Q/A', '10-Q', '4', '13F-HR'],
      filingDate: ['2026-11-17', '2026-11-16', '2026-11-15', '2026-11-17'],
      acceptanceDateTime: ['2026-11-17T20:00:00.000Z', '2026-11-16T16:00:00Z', '2026-11-15T16:00:00Z', '2026-11-17T21:00:00Z'],
      reportDate: ['2026-09-30', '2026-09-30', '2026-11-14', '2026-09-30'],
      primaryDocument: ['report-amended.htm', 'report.htm', 'ownership.xml', 'holdings.xml'],
      primaryDocDescription: ['Synthetic amended report', 'Synthetic report', 'Synthetic ownership form', 'Synthetic holdings form'],
    },
    files: [{ name: 'CIK0000000123-submissions-001.json', filingFrom: '2010-01-01', filingTo: '2020-01-01' }],
  },
};
const factsFixture = {
  cik: 123, entityName: 'Synthetic Sample Issuer', facts: { 'us-gaap': {
    NetCashProvidedByUsedInOperatingActivities: { label: 'Synthetic operating cash flow', units: { USD: [
      { start: '2026-01-01', end: '2026-09-30', val: 900, filed: '2026-11-16', form: '10-Q', accn: '0000000123-26-000002', fy: 2026, fp: 'Q3' },
      { start: '2026-01-01', end: '2026-09-30', val: 950, filed: '2026-11-17', form: '10-Q/A', accn: '0000000123-26-000003', fy: 2026, fp: 'Q3' },
    ] } },
    EarningsPerShareDiluted: { label: 'Synthetic EPS', units: { 'USD/shares': [
      { start: '2026-07-01', end: '2026-09-30', val: 1.23, filed: '2026-11-16', form: '10-Q', accn: '0000000123-26-000002', fy: 2026, fp: 'Q3', frame: 'CY2026Q3' },
    ] } },
    Assets: { label: 'Synthetic assets', units: { USD: [
      { end: '2026-09-30', val: 5000, filed: '2026-11-16', form: '10-Q', accn: '0000000123-26-000002', fy: 2026, fp: 'Q3' },
      { end: '2026-09-30', val: Infinity, filed: '2026-11-16', form: '10-Q', accn: '0000000123-26-000002' },
      { end: '2026-09-30', val: '6000', filed: '2026-11-16', form: '10-Q', accn: '0000000123-26-000002' },
      { end: '2026-09-30', val: Number.MAX_SAFE_INTEGER + 10, filed: '2026-11-16', form: '10-Q', accn: '0000000123-26-000002' },
    ] } },
  }, 'custom-company': { FictionalCustomTag: { units: { USD: [{ val: 999 }] } } } },
};
function secHarness(overrides = {}, options = {}) {
  const calls = [];
  const transport = { request: async input => {
    calls.push(input);
    let body;
    if (input.url.includes('company_tickers_exchange')) body = overrides.catalog ?? catalogFixture;
    else if (input.url.includes('companyfacts')) body = overrides.facts ?? factsFixture;
    else body = overrides.submissions ?? filingsFixture;
    return { body: structuredClone(body), fetchedAt: new Date(NOW).toISOString(), cache, sourceUrl: input.url };
  } };
  return { calls, sec: createSec({ transport, clock: () => NOW, userAgent: USER_AGENT, ...options }) };
}
function fredHarness(bodyOverride = null, options = {}) {
  const calls = [];
  const transport = { request: async input => {
    calls.push(input);
    const body = bodyOverride ?? {
      realtime_start: '2026-11-18', realtime_end: '2026-11-18', units: 'lin', count: 3,
      observations: [
        { date: '2026-11-17', value: '-1.5', realtime_start: '2026-11-18', realtime_end: '2026-11-18' },
        { date: '2026-11-16', value: '.', realtime_start: '2026-11-18', realtime_end: '2026-11-18' },
      ],
    };
    return { body: structuredClone(body), fetchedAt: new Date(NOW).toISOString(), cache, sourceUrl: input.url };
  } };
  return { calls, fred: createFred({ transport, clock: () => NOW, apiKey: KEY, ...options }) };
}

test('SEC requires an operator contact before any upstream call', async () => {
  for (const userAgent of [undefined, '', 'Nortivo no contact', 'Nortivo\r\nqa@example.test']) {
    const { sec, calls } = secHarness({}, { userAgent });
    await assert.rejects(sec.company({ cik: CIK }), error => error.code === 'requires_configuration');
    assert.equal(calls.length, 0);
  }
});

test('SEC catalog preserves issuer/security distinction and exact matches rank first', async () => {
  const { sec, calls } = secHarness();
  const result = await sec.instruments({ q: 'test', limit: 2 });
  assert.equal(result.data[0].symbol, 'TEST');
  assert.equal(result.data[0].cik, CIK);
  assert.notEqual(result.data[0].id, result.data[1].id);
  assert.equal(result.data[0].assetType, 'security');
  assert.equal(result.data[0].pricingAvailable, false);
  assert.equal(result.meta.pointInTimeDirectory, false);
  assert.equal(calls[0].headers['User-Agent'], USER_AGENT);
});

test('SEC company confirms the exact symbol/CIK combination without fuzzy lookup', async () => {
  const { sec } = secHarness();
  assert.equal((await sec.company({ symbol: 'test' })).data.cik, CIK);
  await assert.rejects(sec.company({ symbol: 'TES' }), error => error.code === 'not_found');
  await assert.rejects(sec.company({ symbol: 'TEST', cik: '456' }), error => error.code === 'not_found');
  await assert.rejects(sec.company({ symbol: 'TEST/../../' }), error => error.code === 'invalid_request');
  await assert.rejects(sec.company({ cik: 0 }), error => error.code === 'invalid_request');
});

test('SEC issuer metadata leaves unsupported values null and verifies CIK', async () => {
  const { sec } = secHarness();
  const result = await sec.company({ cik: CIK });
  assert.equal(result.data.employees, null);
  assert.equal(result.data.marketCapitalization, null);
  assert.equal(result.meta.pointInTimeProfile, false);
  const wrong = secHarness({ submissions: { ...filingsFixture, cik: 456 } });
  await assert.rejects(wrong.sec.company({ cik: CIK }), error => error.code === 'invalid_provider_data');
});

test('SEC filing cutoff uses acceptance timestamps and retains amendments', async () => {
  const { sec } = secHarness();
  const beforeAmendment = await sec.filings({ cik: CIK, asOf: '2026-11-17T19:59:59Z' });
  assert.equal(beforeAmendment.data.length, 2);
  assert.ok(beforeAmendment.data.every(row => !row.isAmendment));
  const afterAmendment = await sec.filings({ cik: CIK, asOf: '2026-11-17T20:00:00Z' });
  assert.equal(afterAmendment.data[0].form, '10-Q/A');
  assert.equal(afterAmendment.data[0].isAmendment, true);
  assert.equal(afterAmendment.meta.additionalHistoricalFilesAvailable, true);
  assert.match(afterAmendment.data[0].sourceUrl, /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/123\/000000012326000003\//);
});

test('SEC date-only cutoff is Eastern midnight with winter and summer offsets', async () => {
  const { sec } = secHarness();
  const winter = await sec.filings({ cik: CIK, asOf: '2026-11-17' });
  assert.equal(winter.meta.asOf, '2026-11-17T05:00:00.000Z');
  assert.equal(winter.data.length, 2);
  const summer = await sec.filings({ cik: CIK, asOf: '2026-07-01' });
  assert.equal(summer.meta.asOf, '2026-07-01T04:00:00.000Z');
  assert.equal(summer.data.length, 0);
  await assert.rejects(sec.filings({ cik: CIK, asOf: '2026-02-30' }), error => error.code === 'invalid_request');
});

test('SEC ownership endpoints provide source filings rather than invented trades', async () => {
  const { sec } = secHarness();
  const insiders = await sec.filings({ cik: CIK, form: '4' });
  const institutions = await sec.filings({ cik: CIK, form: '13F-HR' });
  assert.equal(insiders.data.length, 1);
  assert.equal(institutions.data.length, 1);
  assert.equal(institutions.data[0].reportDate, '2026-09-30');
  assert.equal('tradePrice' in insiders.data[0], false);
  assert.match(institutions.meta.coverage, /not parsed transactions or holdings/);
});

test('SEC excludes filings without exact acceptance times on the cutoff day', async () => {
  const fixture = structuredClone(filingsFixture);
  fixture.filings.recent.acceptanceDateTime[0] = '2026-11-17T12:00:00';
  const { sec } = secHarness({ submissions: fixture });
  const result = await sec.filings({ cik: CIK, asOf: '2026-11-17T23:59:59Z' });
  assert.equal(result.data.some(row => row.form === '10-Q/A'), false);
});

test('SEC raw facts preserve YTD duration, units, frames, revisions and original zero values', async () => {
  const fixture = structuredClone(factsFixture);
  fixture.facts['us-gaap'].Assets.units.USD.push({ end: '2025-12-31', val: 0, filed: '2026-02-15', form: '10-K', accn: '0000000123-26-000001' });
  const { sec } = secHarness({ facts: fixture });
  const result = await sec.fundamentals({ cik: CIK, limit: 100 });
  assert.equal(result.data.facts.length, 5);
  const cashFlows = result.data.facts.filter(row => row.tag === 'NetCashProvidedByUsedInOperatingActivities');
  assert.equal(cashFlows.length, 2);
  assert.equal(cashFlows[0].durationDays, 273);
  assert.equal(cashFlows[0].isAmendment, true);
  assert.equal(cashFlows[0].fiscalPeriod, 'Q3');
  assert.equal(cashFlows[0].start, '2026-01-01');
  const eps = result.data.facts.find(row => row.tag === 'EarningsPerShareDiluted');
  assert.equal(eps.unit, 'USD/shares');
  assert.equal(eps.frame, 'CY2026Q3');
  assert.ok(result.data.facts.some(row => row.value === 0));
  assert.ok(result.data.facts.every(row => Number.isFinite(row.value)));
  assert.match(result.meta.normalization, /No YTD cash flow is relabeled/);
});

test('SEC fundamentals excludes later restatements and the entire cutoff date', async () => {
  const { sec } = secHarness();
  const result = await sec.fundamentals({ cik: CIK, asOf: '2026-11-17T23:00:00Z' });
  assert.equal(result.data.facts.length, 3);
  assert.equal(result.data.facts.some(row => row.isAmendment), false);
  const midnight = await sec.fundamentals({ cik: CIK, asOf: '2026-11-17T01:00:00Z' });
  assert.equal(midnight.data.facts.length, 0); // Still November 16 in New York.
  const limited = await sec.fundamentals({ cik: CIK, limit: 1 });
  assert.equal(limited.data.facts.length, 1);
  assert.equal(limited.meta.hasMore, true);
});

test('SEC rejects malformed catalogs and bounds expensive parameters', async () => {
  const { sec } = secHarness({ catalog: { fields: [], data: [] } });
  await assert.rejects(sec.instruments(), error => error.code === 'invalid_provider_data');
  const normal = secHarness().sec;
  await assert.rejects(normal.instruments({ limit: 100000 }), error => error.code === 'invalid_request');
  await assert.rejects(normal.fundamentals({ cik: CIK, limit: 5001 }), error => error.code === 'invalid_request');
  await assert.rejects(normal.filings({ cik: CIK, form: '4?url=bad' }), error => error.code === 'invalid_request');
});

test('FRED requires a real configured key and validates ranges before fetching', async () => {
  const { fred, calls } = fredHarness(null, { apiKey: undefined });
  await assert.rejects(fred.series({ seriesId: 'SYNTHETIC' }), error => error.code === 'requires_key');
  assert.equal(calls.length, 0);
  await assert.rejects(fred.series({ seriesId: '../secret' }), error => error.code === 'invalid_request');
  await assert.rejects(fred.series({ seriesId: 'TEST', start: '2026-11-20', end: '2026-11-18' }), error => error.code === 'invalid_request');
  await assert.rejects(fred.series({ seriesId: 'TEST', asOf: '2026-02-30' }), error => error.code === 'invalid_request');
});

test('FRED preserves missing observations as null, negative values and actual dates', async () => {
  const { fred, calls } = fredHarness();
  const result = await fred.series({ seriesId: 'SYNTHETIC', limit: 2 });
  assert.deepEqual(result.data.observations.map(row => row.value), [null, -1.5]);
  assert.equal(result.data.observations[0].missing, true);
  assert.equal(result.data.observations[1].date, '2026-11-17');
  assert.equal(result.meta.frequency, null);
  assert.equal(result.meta.units, null);
  assert.equal(result.meta.hasMore, true);
  assert.equal(new URL(calls[0].url).searchParams.get('sort_order'), 'desc');
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.equal(new URL(result.meta.sourceUrl).searchParams.has('api_key'), false);
});

test('FRED historical requests set vintage parameters and reject a different returned vintage', async () => {
  const { fred, calls } = fredHarness();
  await fred.series({ seriesId: 'SYNTHETIC', asOf: '2026-11-18', start: '2026-01-01', end: '2026-11-18' });
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('realtime_start'), '2026-11-18');
  assert.equal(url.searchParams.get('realtime_end'), '2026-11-18');
  assert.equal(url.searchParams.get('observation_start'), '2026-01-01');
  await assert.rejects(fred.series({ seriesId: 'SYNTHETIC', asOf: '2026-11-17' }), error => error.code === 'invalid_provider_data');
});

test('FRED rejects malformed numeric data rather than producing zero or NaN', async () => {
  for (const value of ['', 'NaN', 'Infinity', '1,000', '3evil', null]) {
    const body = { realtime_start: '2026-11-18', realtime_end: '2026-11-18', observations: [
      { date: '2026-11-17', value, realtime_start: '2026-11-18', realtime_end: '2026-11-18' },
    ] };
    const { fred } = fredHarness(body);
    await assert.rejects(fred.series({ seriesId: 'SYNTHETIC' }), error => error.code === 'invalid_provider_data');
  }
});

test('FRED rejects observations outside requested windows and invalid observation dates', async () => {
  const { fred } = fredHarness();
  await assert.rejects(fred.series({ seriesId: 'SYNTHETIC', start: '2026-11-17' }), error => error.code === 'invalid_provider_data');
  const bad = fredHarness({ realtime_start: '2026-11-18', realtime_end: '2026-11-18', observations: [
    { date: '2026-02-30', value: '1', realtime_start: '2026-11-18', realtime_end: '2026-11-18' },
  ] });
  await assert.rejects(bad.fred.series({ seriesId: 'SYNTHETIC' }), error => error.code === 'invalid_provider_data');
});

test('FRED malformed vintage dates are provider errors and duplicate observations are rejected', async () => {
  const malformed = fredHarness({ realtime_start: '2026-02-30', realtime_end: '2026-11-18', observations: [] });
  await assert.rejects(malformed.fred.series({ seriesId: 'SYNTHETIC' }), error => error.code === 'invalid_provider_data' && error.status === 502);
  const row = { date: '2026-11-17', value: '1', realtime_start: '2026-11-18', realtime_end: '2026-11-18' };
  const duplicate = fredHarness({ realtime_start: '2026-11-18', realtime_end: '2026-11-18', observations: [row, row] });
  await assert.rejects(duplicate.fred.series({ seriesId: 'SYNTHETIC' }), error => error.code === 'invalid_provider_data');
});
