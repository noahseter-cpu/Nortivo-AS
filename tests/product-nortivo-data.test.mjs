import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createNortivoDataProviders } from '../netlify/product/providers-nortivo.mjs';
import { rightsFor } from '../netlify/product/providers-core.mjs';

// Explicit normalization fixtures, not real account records or current market observations.
const NOW = Date.parse('2026-11-18T19:00:00Z');
const ENV = { APCA_API_KEY_ID: 'fixture-paper-key', APCA_API_SECRET_KEY: 'fixture-paper-secret' };
const asset = extra => ({ id: 'fixture-asset', class: 'us_equity', exchange: 'NASDAQ', symbol: 'AAPL', name: 'Apple Inc.', status: 'active', ...extra });
const trade = extra => ({ symbol: 'AAPL', trade: { p: 100.25, s: 10, t: '2026-11-18T18:59:58.123456789Z', i: 42 }, ...extra });
const bar = extra => ({ t: '2026-11-18T18:50:00Z', o: 100, h: 102, l: 99, c: 101, v: 20, n: 10, vw: 100.5, ...extra });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function fixture(t, { env = ENV, assets = [asset()], quote = trade(), bars = [bar()], respond } = {}) {
  const legacy = await createLocalStore(':memory:'); t.after(() => legacy.close());
  const calls = [];
  const fetcher = async (value, options) => {
    const url = new URL(value); calls.push({ url, options });
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['APCA-API-KEY-ID'], 'fixture-paper-key');
    assert.equal(options.headers['APCA-API-SECRET-KEY'], 'fixture-paper-secret');
    if (respond) return respond(url, options);
    if (url.pathname === '/v2/assets') return json(assets);
    if (url.pathname.startsWith('/v2/assets/')) return json(assets.find(row => row.symbol === decodeURIComponent(url.pathname.split('/').at(-1))) || asset());
    if (url.pathname.endsWith('/trades/latest')) return json(quote);
    if (url.pathname.endsWith('/bars')) return json({ symbol: 'AAPL', bars, next_page_token: null });
    throw new Error('Unexpected source destination.');
  };
  const providers = createNortivoDataProviders({ env, fetcher, store: legacy.product, clock: () => NOW });
  return { providers, store: legacy.product, calls };
}

test('private Nortivo catalog uses exact provider listing MIC and preserves unknown stock/ETF subtype', async t => {
  const ctx = await fixture(t, { assets: [
    asset(), asset({ symbol: 'AAPLX', name: 'Apple Example ETF' }),
    asset({ symbol: 'BAD', exchange: 'OTC' }), asset({ symbol: 'OLD', status: 'inactive' }),
    asset({ symbol: 'COIN', class: 'crypto' }), asset({ symbol: 'GBP', currency: 'GBP' }),
  ] });
  const result = await ctx.providers.catalog({ q: 'Apple' });
  assert.deepEqual(result.instruments.map(row => row.id), ['XNAS:AAPL:USD', 'XNAS:AAPLX:USD']);
  assert(result.instruments.every(row => row.assetType === 'stock_or_etf'));
  assert.equal(result.privateOwnerUse, true); assert.match(result.source, /IEX.*single venue/);
  assert.equal(ctx.calls[0].url.origin, 'https://paper-api.alpaca.markets');
  assert.equal(ctx.calls[0].url.pathname, '/v2/assets');
  assert.equal(ctx.calls[0].url.searchParams.get('asset_class'), 'us_equity');
  assert.equal(rightsFor(ENV, 'market', 'twelve').ready, false);
});

test('exact ticker matches rank first and malformed catalog searches never reach the source', async t => {
  const ctx = await fixture(t, { assets: [asset({ symbol: 'AA' }), asset(), asset({ symbol: 'AAPLX' })] });
  const result = await ctx.providers.catalog({ q: 'AAPL' });
  assert.equal(result.instruments[0].symbol, 'AAPL');
  const before = ctx.calls.length;
  for (const q of ['', 'https://evil.test', '<script>']) await assert.rejects(ctx.providers.catalog({ q }), { code: 'INVALID_SEARCH' });
  assert.equal(ctx.calls.length, before);
});

test('Nortivo quote keeps listing venue separate from IEX feed and preserves original event time', async t => {
  const ctx = await fixture(t);
  const result = await ctx.providers.quotes({ instrumentId: 'XNAS:AAPL:USD', resolution: '5min' });
  assert.equal(result.quote.venue, 'XNAS'); assert.equal(result.quote.feedVenue, 'IEX');
  assert.equal(result.quote.price, '100.25'); assert.equal(result.quote.currency, 'USD');
  assert.equal(result.quote.asOf, '2026-11-18T18:59:58.123Z');
  assert.equal(result.quote.sourceTimestamp, '2026-11-18T18:59:58.123456789Z');
  assert.equal(result.quote.receivedAt, new Date(NOW).toISOString());
  assert.equal(result.quote.freshness, 'current'); assert.equal(result.quote.marketOpen, null);
  assert.equal(result.quote.executionEligible, false);
  assert.match(result.quote.coverage, /not consolidated.*NBBO/);
  assert.equal(result.bars[0].volume, '20'); assert.equal(result.bars[0].close, '101');
  assert.equal(result.bars[0].complete, true); assert.match(result.adjustment, /Raw IEX/);
  assert.equal(JSON.stringify(result).includes('fixture-paper-secret'), false);
  for (const call of ctx.calls.filter(call => call.url.hostname === 'data.alpaca.markets')) assert.equal(call.url.searchParams.get('feed'), 'iex');
  assert(ctx.calls.every(call => !/\/orders|\/account(?:\/|$)/.test(call.url.pathname)));
  const health = await ctx.store.get('provider_health', 'owner_market');
  assert.equal(health.value.quoteSuccessAt, NOW); assert.equal(health.value.provider, 'alpaca');
  assert.equal(await ctx.store.get('provider_health', 'market'), null);
});

test('wrong listing or unsupported resolution fails before a mismatched quote can be returned', async t => {
  const ctx = await fixture(t);
  await assert.rejects(ctx.providers.quotes({ instrumentId: 'XNYS:AAPL:USD' }), { code: 'UNSUPPORTED_INSTRUMENT' });
  assert.equal(ctx.calls.length, 1); assert.equal(ctx.calls[0].url.pathname, '/v2/assets/AAPL');
  await assert.rejects(ctx.providers.quotes({ instrumentId: 'XNAS:AAPL:USD', resolution: '30min' }), { code: 'INVALID_TIMEFRAME' });
  assert.equal(ctx.calls.length, 1);
});

test('stale IEX last trades stay stale despite successful authentication and a fresh retrieval', async t => {
  const ctx = await fixture(t, { quote: trade({ trade: { p: 100.25, s: 10, t: '2026-11-18T18:00:00Z' } }) });
  const result = await ctx.providers.quotes({ instrumentId: 'XNAS:AAPL:USD' });
  assert.equal(result.quote.freshness, 'stale'); assert.equal(result.quote.asOf, '2026-11-18T18:00:00.000Z');
});

test('private history requests actual adjusted daily IEX data and excludes provisional candles', async t => {
  const midnight = Date.parse('2026-11-18T05:00:00Z');
  const bars = Array.from({ length: 55 }, (_, i) => bar({ t: new Date(midnight - i * 86400000).toISOString() }));
  const ctx = await fixture(t, { bars });
  const result = await ctx.providers.history({ instrumentId: 'XNAS:AAPL:USD' });
  assert.equal(result.historyType, 'adjusted_daily'); assert.equal(result.bars.length, 54);
  assert(result.bars.every(row => row.complete)); assert.equal(result.volumeScope, 'IEX only');
  assert.equal(result.privateOwnerUse, true); assert.match(result.historyScope, /at most 1000/);
  const request = ctx.calls.find(call => call.url.pathname.endsWith('/bars'));
  assert.equal(request.url.searchParams.get('adjustment'), 'all'); assert.equal(request.url.searchParams.get('feed'), 'iex');
  assert.equal(request.url.searchParams.get('timeframe'), '1Day');
  assert.equal((await ctx.store.get('provider_health', 'owner_market')).value.historyBars, 54);
});

test('genuinely empty IEX history stays empty rather than manufacturing a chart', async t => {
  const ctx = await fixture(t, { bars: [] });
  const result = await ctx.providers.quotes({ instrumentId: 'XNAS:AAPL:USD', resolution: '1min' });
  assert.equal(result.quote.price, '100.25'); assert.deepEqual(result.bars, []);
});

test('source errors and malformed data remain safe product errors with no credential disclosure', async t => {
  const rejected = await fixture(t, { respond: () => json({ message: 'fixture-paper-secret must never be echoed' }, 401) });
  await assert.rejects(rejected.providers.quotes({ instrumentId: 'XNAS:AAPL:USD' }), error => error.code === 'PROVIDER_AUTHORIZATION' && !error.message.includes('fixture-paper-secret'));
  const invalid = await fixture(t, { quote: trade({ symbol: 'MSFT' }) });
  await assert.rejects(invalid.providers.quotes({ instrumentId: 'XNAS:AAPL:USD' }), { code: 'PROVIDER_INVALID_DATA' });
  assert.equal((await invalid.store.get('provider_health', 'owner_market')).value.reachable, false);
});

test('owner subscription bypass does not bypass the persistent upstream request budget', async t => {
  const ctx = await fixture(t, { env: { ...ENV, PRODUCT_ALPACA_CREDITS_PER_MINUTE: '1' } });
  await ctx.providers.catalog({ q: 'AAPL' });
  await assert.rejects(ctx.providers.quotes({ instrumentId: 'XNAS:AAPL:USD' }), { code: 'PROVIDER_RATE_LIMIT' });
  assert.equal(ctx.calls.length, 1);
  const meter = await ctx.store.get('provider_meter', 'alpaca'); assert.equal(meter.value.upstreamRequests, 1);
});

test('missing keys and invalid free-feed budgets never make an unauthenticated upstream attempt', async t => {
  const ctx = await fixture(t, { env: {} });
  await assert.rejects(ctx.providers.quotes({ instrumentId: 'XNAS:AAPL:USD' }), { code: 'INTEGRATION_NOT_CONFIGURED' });
  assert.equal(ctx.calls.length, 0);
  assert.throws(() => createNortivoDataProviders({ env: { ...ENV, PRODUCT_ALPACA_CREDITS_PER_MINUTE: '201' }, store: ctx.store }), { code: 'INTEGRATION_NOT_CONFIGURED' });
});

test('same-currency identity is exact and cross-currency values remain explicitly unavailable', async t => {
  const ctx = await fixture(t);
  assert.equal((await ctx.providers.fx('USD', 'USD')).rate, '1');
  await assert.rejects(ctx.providers.fx('USD', 'NOK'), { code: 'INTEGRATION_NOT_CONFIGURED' });
  assert.equal(ctx.calls.length, 0);
});
