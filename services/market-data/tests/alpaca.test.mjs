import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlpaca } from '../providers/alpaca.mjs';

// Synthetic fixtures test normalization only; no live stock credentials are used.
const NOW = Date.parse('2026-11-18T15:30:00Z');
const timestamp = '2026-11-18T15:29:59.123456789Z';
function fixture(body, options = {}) {
  const calls = [];
  const adapter = createAlpaca({
    clock: () => NOW, apiKey: 'fixture-key', apiSecret: 'fixture-secret',
    transport: { request: async request => { calls.push(request); return { body: typeof body === 'function' ? body(request) : body, fetchedAt: new Date(NOW).toISOString(), cache: { hit: false, stale: false, ageMs: 0 }, sourceUrl: request.url }; } },
    ...options,
  });
  return { adapter, calls };
}
const trade = (overrides = {}) => ({ symbol: 'AAPL', trade: { t: timestamp, p: 100.25, s: 4, i: 123, ...overrides } });
const candle = (overrides = {}) => ({ t: '2026-11-18T15:28:00Z', o: 100, h: 102, l: 99, c: 101, v: 10, n: 4, vw: 100.5, ...overrides });
const history = (bars = [candle()], overrides = {}) => ({ symbol: 'AAPL', bars, next_page_token: null, ...overrides });

test('Alpaca date-only history includes a whole past day and bounds today at current time', async () => {
  const { adapter, calls } = fixture(history([]));
  await adapter.bars({ symbol: 'AAPL', start: '2026-11-17', end: '2026-11-17' });
  assert.equal(new URL(calls[0].url).searchParams.get('start'), '2026-11-17T00:00:00.000Z');
  assert.equal(new URL(calls[0].url).searchParams.get('end'), '2026-11-17T23:59:59.999Z');
  await adapter.bars({ symbol: 'AAPL', start: '2026-11-18', end: '2026-11-18' });
  assert.equal(new URL(calls[1].url).searchParams.get('end'), new Date(NOW).toISOString());
});

test('Alpaca requires both credentials without an outbound request', async () => {
  for (const overrides of [{ apiKey: '' }, { apiSecret: undefined }]) {
    const { adapter, calls } = fixture(trade(), overrides);
    await assert.rejects(adapter.quote({ symbol: 'AAPL' }), { code: 'requires_key' });
    assert.equal(calls.length, 0);
  }
});

test('Alpaca quote preserves event time, labels IEX and never stores without permitted TTL', async () => {
  const { adapter, calls } = fixture(trade());
  const result = await adapter.quote({ symbol: 'aapl' });
  assert.equal(result.data.symbol, 'AAPL');
  assert.equal(result.data.asOf, '2026-11-18T15:29:59.123Z');
  assert.equal(result.data.sourceTimestamp, timestamp);
  assert.notEqual(result.data.asOf, result.data.receivedAt);
  assert.equal(result.data.price, 100.25);
  assert.equal(result.meta.feed, 'iex');
  assert.equal(result.meta.listingVenue, null);
  assert.equal(result.meta.freshness, 'live');
  assert.equal(result.meta.marketState, 'unknown');
  assert.match(result.meta.coverage, /not consolidated/);
  const url = new URL(calls[0].url);
  assert.equal(url.origin, 'https://data.alpaca.markets');
  assert.equal(url.pathname, '/v2/stocks/AAPL/trades/latest');
  assert.equal(url.searchParams.get('feed'), 'iex');
  assert.equal(calls[0].headers['APCA-API-KEY-ID'], 'fixture-key');
  assert.equal(calls[0].ttlMs, 0);
  assert.equal(JSON.stringify(result).includes('fixture-secret'), false);
});

test('Alpaca stale trades remain stale despite a fresh fetch', async () => {
  const { adapter } = fixture(trade({ t: '2026-11-17T15:00:00Z' }));
  const result = await adapter.quote({ symbol: 'AAPL' });
  assert.equal(result.meta.freshness, 'stale');
  assert.equal(result.data.asOf, '2026-11-17T15:00:00.000Z');
});

test('Alpaca rejects mismatched symbols, future timestamps and malformed trade fields', async () => {
  for (const body of [
    { ...trade(), symbol: 'MSFT' }, trade({ t: '2026-11-19T00:00:00Z' }),
    trade({ t: 'not-a-date' }), trade({ t: '2026-02-31T12:00:00Z' }), trade({ p: null }), trade({ p: '100.25' }),
    trade({ p: Infinity }), trade({ s: -1 }),
  ]) {
    const { adapter } = fixture(body);
    await assert.rejects(adapter.quote({ symbol: 'AAPL' }), { code: 'invalid_provider_data' });
  }
  const { adapter } = fixture({ symbol: 'AAPL', trade: null });
  await assert.rejects(adapter.quote({ symbol: 'AAPL' }), { code: 'temporarily_unavailable' });
});

test('Alpaca validates request symbols before touching the provider', async () => {
  const { adapter, calls } = fixture(trade());
  for (const symbol of ['AAPL?feed=sip', 'AAPL/MSFT', 'https://example.com', '', null]) await assert.rejects(adapter.quote({ symbol }), { code: 'invalid_symbol' });
  assert.equal(calls.length, 0);
});

test('Alpaca bars use explicit IEX, adjustments and pagination while preserving gaps', async () => {
  const { adapter, calls } = fixture(history([candle(), candle({ t: '2026-11-18T15:20:00Z', vw: null })], { next_page_token: 'NEXT_PAGE' }));
  const result = await adapter.bars({ symbol: 'AAPL', interval: '1m', limit: 5, start: '2026-11-18', end: '2026-11-18T15:30:00Z', adjustment: 'split', pageToken: 'PREVIOUS_PAGE' });
  assert.equal(result.data.bars.length, 2);
  assert.equal(result.data.bars[0].time, '2026-11-18T15:20:00.000Z');
  assert.equal(result.data.bars[0].vwap, null);
  assert.equal(result.data.bars[1].complete, true);
  assert.equal(result.meta.nextPageToken, 'NEXT_PAGE');
  assert.equal(result.meta.gapsFilled, false);
  assert.equal(result.data.adjustment, 'split');
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('feed'), 'iex');
  assert.equal(url.searchParams.get('adjustment'), 'split');
  assert.equal(url.searchParams.get('page_token'), 'PREVIOUS_PAGE');
  assert.equal(url.searchParams.get('timeframe'), '1Min');
  assert.equal(url.searchParams.get('sort'), 'desc');
  assert.equal(calls[0].ttlMs, 0);
});

test('Alpaca does not claim current or daily unelapsed candles are complete', async () => {
  const { adapter } = fixture(history([candle({ t: '2026-11-18T15:29:00Z' })]));
  const result = await adapter.bars({ symbol: 'AAPL' });
  assert.equal(result.data.bars[0].complete, false);
  const daily = fixture(history([candle({ t: '2026-11-18T05:00:00Z' })]));
  assert.equal((await daily.adapter.bars({ symbol: 'AAPL', interval: '1d' })).data.bars[0].complete, false);
});

test('Alpaca returns genuinely empty history without fabricated bars', async () => {
  const { adapter } = fixture(history([]));
  const result = await adapter.bars({ symbol: 'AAPL' });
  assert.deepEqual(result.data.bars, []);
  assert.equal(result.meta.asOf, null);
  assert.equal(result.meta.oldestAvailableInResponse, null);
});

test('Alpaca rejects invalid bars, duplicate timestamps and unexpected currency', async () => {
  for (const body of [
    history([candle({ h: 99 })]), history([candle({ l: 102 })]),
    history([candle({ v: -1 })]), history([candle({ n: 1.5 })]),
    history([candle(), candle()]), history([candle({ t: '2026-11-10T12:00:00Z' })]),
    history([candle()], { symbol: 'MSFT' }), history([candle()], { currency: 'EUR' }),
    history([candle()], { next_page_token: 123 }),
  ]) {
    const { adapter } = fixture(body);
    await assert.rejects(adapter.bars({ symbol: 'AAPL' }), { code: 'invalid_provider_data' });
  }
});

test('Alpaca rejects unbounded or invalid history requests before upstream access', async () => {
  for (const args of [
    { interval: '1s' }, { limit: 1001 }, { limit: 0 }, { limit: 1.5 },
    { adjustment: 'unadjusted' }, { start: '2026-02-31' }, { start: '2026-02-31T00:00:00Z' },
    { start: '2026-11-18', end: '2026-11-17' },
    { end: '2026-11-19' }, { pageToken: 'bad\nvalue' },
  ]) {
    const { adapter, calls } = fixture(history());
    await assert.rejects(adapter.bars({ symbol: 'AAPL', ...args }));
    assert.equal(calls.length, 0);
  }
});

test('Alpaca approved cache TTL is bounded by the configured allowance', async () => {
  const { adapter, calls } = fixture(trade(), { cacheSeconds: 0.5 });
  await adapter.quote({ symbol: 'AAPL' });
  assert.equal(calls[0].ttlMs, 500);
});
