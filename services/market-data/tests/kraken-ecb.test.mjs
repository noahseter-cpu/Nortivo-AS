import test from 'node:test';
import assert from 'node:assert/strict';
import { createKraken } from '../providers/kraken.mjs';
import { createEcb, parseCsv } from '../providers/ecb.mjs';

// Synthetic provider fixtures for normalization and error tests; never production market data.
const NOW = Date.parse('2026-11-18T18:00:00Z');
const fetchedAt = new Date(NOW).toISOString();
const pairFixture = { error: [], result: {
  XXBTZUSD: { altname: 'XBTUSD', wsname: 'XBT/USD', base: 'XXBT', quote: 'ZUSD', aclass_base: 'currency', status: 'online' },
  XETHZUSD: { altname: 'ETHUSD', wsname: 'ETH/USD', base: 'XETH', quote: 'ZUSD', aclass_base: 'currency', status: 'online' },
  AAPLxUSD: { altname: 'AAPLxUSD', wsname: 'AAPLx/USD', aclass_base: 'tokenized_asset' },
  EURUSD: { altname: 'EURUSD', wsname: 'EUR/USD', aclass_base: 'currency' },
  'XXBTZUSD.d': { altname: 'XBTUSD.d', wsname: 'XBT/USD', aclass_base: 'currency' },
} };

function transportFor(resolver) {
  const calls = [];
  return { calls, async request(options) {
    calls.push(options);
    const url = new URL(options.url);
    const body = url.pathname.endsWith('AssetPairs') ? structuredClone(pairFixture) : await resolver(url, options);
    return { body, fetchedAt, sourceUrl: url.href, cache: { hit: false, stale: false, ageMs: 0 } };
  } };
}

test('Kraken directory preserves provider mappings and excludes tokenized equities, dark pools, and fiat pairs', async () => {
  const kraken = createKraken({ transport: transportFor(() => null), clock: () => NOW });
  const result = await kraken.instruments({ q: 'BTC' });
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.data[0], { id: 'KRAKEN:BTC/USD', symbol: 'BTC/USD', providerSymbol: 'XXBTZUSD', alternateSymbol: 'XBTUSD', websocketSymbol: 'XBT/USD', base: 'BTC', quote: 'USD', currency: 'USD', assetType: 'crypto', venue: 'Kraken', status: 'online' });
  assert.equal((await kraken.instruments()).data.length, 2);
  assert.equal(result.meta.asOf, null);
});

test('Kraken quote uses actual trade timestamp and supports XBT alias', async () => {
  const tradeTime = NOW / 1000 - 2.125;
  const transport = transportFor(url => {
    assert.equal(url.pathname, '/0/public/Trades');
    assert.equal(url.searchParams.get('count'), '1');
    assert.equal(url.searchParams.get('pair'), 'XXBTZUSD');
    return { error: [], result: { XXBTZUSD: [['83000.5', '0.01', tradeTime, 'b', 'm', '', 123]], last: 'not_a_quote_timestamp' } };
  });
  const result = await createKraken({ transport, clock: () => NOW }).quote({ symbol: 'XBT/USD' });
  assert.equal(result.data.price, 83000.5);
  assert.equal(result.data.asOf, new Date(tradeTime * 1000).toISOString());
  assert.notEqual(result.data.asOf, result.data.receivedAt);
  assert.equal(result.data.freshness, 'current');
  assert.equal(result.data.bid, null);
});

test('Kraken old last trade remains stale after a fresh retrieval', async () => {
  const transport = transportFor(() => ({ error: [], result: { XXBTZUSD: [['83000', '1', NOW / 1000 - 300]] } }));
  const result = await createKraken({ transport, clock: () => NOW }).quote({ symbol: 'BTC/USD' });
  assert.equal(result.meta.freshness, 'stale');
  assert.equal(result.data.asOf, '2026-11-18T17:55:00.000Z');
});

test('Kraken rejects unknown pairs, future trades, and unusable numeric fields', async () => {
  const transport = transportFor(() => ({ error: [], result: { XXBTZUSD: [['NaN', '1', NOW / 1000]] } }));
  const kraken = createKraken({ transport, clock: () => NOW });
  await assert.rejects(kraken.quote({ symbol: 'AAPL/USD' }), error => error.code === 'not_supported');
  await assert.rejects(kraken.quote({ symbol: 'BTC/USD' }), error => error.code === 'provider_invalid_data');
  const future = createKraken({ transport: transportFor(() => ({ error: [], result: { XXBTZUSD: [['1', '1', NOW / 1000 + 3600]] } })), clock: () => NOW });
  await assert.rejects(future.quote({ symbol: 'BTC/USD' }), error => error.code === 'provider_invalid_data');
});

test('Kraken validates limits and intervals before issuing upstream requests', async () => {
  const transport = transportFor(() => null), kraken = createKraken({ transport, clock: () => NOW });
  await assert.rejects(kraken.bars({ symbol: 'BTC/USD', limit: 721 }), error => error.code === 'invalid_request');
  await assert.rejects(kraken.bars({ symbol: 'BTC/USD', interval: '2m' }), error => error.code === 'not_supported');
  await assert.rejects(kraken.instruments({ limit: -1 }), error => error.code === 'invalid_request');
  assert.equal(transport.calls.length, 0);
});

const bar = (offset, overrides = []) => [NOW / 1000 + offset, '100', '103', '99', '102', '101', '5', 10].map((value, index) => overrides[index] ?? value);

test('Kraken bars preserve missing intervals and mark provider final candle provisional', async () => {
  const transport = transportFor(() => ({ error: [], result: { XXBTZUSD: [bar(-300), bar(-180), bar(-120)], last: NOW / 1000 } }));
  const result = await createKraken({ transport, clock: () => NOW }).bars({ symbol: 'BTC/USD', interval: '1m' });
  assert.equal(result.data.bars.length, 3);
  assert.equal(result.meta.missingIntervals, 1);
  assert.equal(result.data.bars[0].complete, true);
  assert.equal(result.data.bars.at(-1).complete, false);
  assert.equal(result.meta.historyComplete, false);
  assert.equal(result.meta.historyLimit, 720);
});

test('Kraken bars do not claim complete requested history and reject malformed OHLC', async () => {
  const transport = transportFor(() => ({ error: [], result: { XXBTZUSD: [bar(-300), bar(-240)] } }));
  const result = await createKraken({ transport, clock: () => NOW }).bars({ symbol: 'BTC/USD', start: '2015-01-01', limit: 1 });
  assert.equal(result.meta.requestedStartUnavailable, true);
  assert.equal(result.data.bars.length, 1);
  const invalid = createKraken({ transport: transportFor(() => ({ error: [], result: { XXBTZUSD: [bar(-60, [undefined, undefined, '98'])] } })), clock: () => NOW });
  await assert.rejects(invalid.bars({ symbol: 'BTC/USD' }), error => error.code === 'provider_invalid_data');
});

test('Kraken HTTP-200 API errors are surfaced as rate limits', async () => {
  const transport = transportFor(() => ({ error: ['EAPI:Rate limit exceeded'], result: {} }));
  await assert.rejects(createKraken({ transport, clock: () => NOW }).quote({ symbol: 'BTC/USD' }), error => error.code === 'rate_limited');
});

test('Kraken accepts 720 historical candles plus the real endpoint provisional candle', async () => {
  const transport = transportFor(() => ({ error: [], result: { XXBTZUSD: Array.from({ length: 721 }, (_, index) => bar((index - 720) * 60)), last: NOW / 1000 } }));
  const result = await createKraken({ transport, clock: () => NOW }).bars({ symbol: 'BTC/USD', interval: '1m', limit: 720 });
  assert.equal(result.data.bars.length, 720);
  assert.equal(result.data.bars.at(-1).complete, false);
  assert.equal(result.meta.historyLimit, 720);
  assert.equal(result.meta.upstreamMaximumRows, 721);
  assert.equal(result.meta.incompleteCandleIncluded, true);
  const excessive = createKraken({ transport: transportFor(() => ({ error: [], result: { XXBTZUSD: Array.from({ length: 722 }, (_, index) => bar((index - 721) * 60)) } })), clock: () => NOW });
  await assert.rejects(excessive.bars({ symbol: 'BTC/USD' }), error => error.code === 'provider_invalid_data');
});

test('Kraken date-only end includes all candles on that UTC day', async () => {
  const transport = transportFor(() => ({ error: [], result: { XXBTZUSD: [bar(-300), bar(-180), bar(-120)], last: NOW / 1000 } }));
  const result = await createKraken({ transport, clock: () => NOW }).bars({ symbol: 'BTC/USD', start: '2026-11-18', end: '2026-11-18' });
  assert.equal(result.data.bars.length, 3);
  const exact = await createKraken({ transport, clock: () => NOW }).bars({ symbol: 'BTC/USD', end: '2026-11-18T17:57:00Z' });
  assert.equal(exact.data.bars.length, 2);
});

const csvHeader = 'FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE\r\n';
const fxCsv = csvHeader + 'D,USD,EUR,SP00,2026-11-18,1.2,A,"US dollar, spot"\r\nD,USD,EUR,SP00,2026-11-17,1.25,A,USD\r\nD,NOK,EUR,SP00,2026-11-17,10.5,A,NOK\r\n';

test('ECB uses a common observation date when cross-rate series update at different times', async () => {
  const transport = transportFor((url, options) => {
    assert.equal(options.format, 'text');
    assert.equal(url.pathname, '/service/data/EXR/D.NOK+USD.EUR.SP00.A');
    return fxCsv;
  });
  const result = await createEcb({ transport, clock: () => NOW }).fx({ base: 'USD', quote: 'NOK' });
  assert.equal(result.data.rate, 8.4);
  assert.equal(result.data.observationDate, '2026-11-17');
  assert.equal(result.data.live, false);
  assert.equal(result.meta.latency, 'daily_reference');
  assert.equal(result.meta.timestampPrecision, 'date');
});

test('ECB supports EUR base and honest previous-business-day observations', async () => {
  const transport = transportFor(() => csvHeader + 'D,NOK,EUR,SP00,2026-11-17,10.5,A,NOK\r\n');
  const result = await createEcb({ transport, clock: () => NOW }).fx({ base: 'EUR', quote: 'NOK', date: '2026-11-18' });
  assert.equal(result.data.rate, 10.5);
  assert.equal(result.meta.previousBusinessDayUsed, true);
  assert.equal(result.data.asOf, '2026-11-17');
});

test('ECB validates currency/date inputs without network access', async () => {
  const transport = transportFor(() => ''), ecb = createEcb({ transport, clock: () => NOW });
  for (const params of [{ base: 'usd' }, { date: '2026-99-99' }, { date: '2026-11-31' }, { date: '2099-01-01' }, { base: 'USD', quote: 'USD' }]) await assert.rejects(ecb.fx(params), error => error.code === 'invalid_request');
  assert.equal(transport.calls.length, 0);
});

test('ECB rejects malformed CSV and does not invent unavailable rates', async () => {
  assert.throws(() => parseCsv('hello'), error => error.code === 'temporarily_unavailable');
  assert.throws(() => parseCsv('A,B\n1,2'), error => error.code === 'provider_invalid_data');
  assert.throws(() => parseCsv(csvHeader + 'D,NOK,EUR,SP00,2026-11-17,10.5,A,"unterminated'), error => error.code === 'provider_invalid_data');
  const ecb = createEcb({ transport: transportFor(() => csvHeader + 'D,USD,EUR,SP00,2026-11-17,1.25,A,USD\n'), clock: () => NOW });
  await assert.rejects(ecb.fx({ base: 'USD', quote: 'NOK' }), error => error.code === 'not_supported');
});
