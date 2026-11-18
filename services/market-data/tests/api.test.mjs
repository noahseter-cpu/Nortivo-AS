import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createApi } from '../server.mjs';

const TOKEN = 'fixture_local_token_abcdefghijklmnopqrstuvwxyz';
const NOW = Date.parse('2026-11-18T18:00:00Z');
// These fixed values are TEST FIXTURES, never current prices or production seed records.
const source = { id: 'owned-fixture', label: 'Explicit test fixture', kind: 'user_import', canRetain: true, retentionUntil: null };
const instrument = { id: 'owned-test-stock', symbol: 'TEST', name: 'Fixture instrument', assetType: 'stock', currency: 'USD', listingVenue: 'XNAS' };

class Reply extends EventEmitter {
  constructor() { super(); this.headers = {}; this.chunks = []; this.headersSent = false; this.writableLength = 0; }
  setHeader(key, value) { this.headers[key.toLowerCase()] = value; }
  writeHead(status, headers) { this.statusCode = status; for (const [k, v] of Object.entries(headers)) this.setHeader(k, v); this.headersSent = true; return this; }
  flushHeaders() { this.headersSent = true; }
  write(chunk) { this.chunks.push(String(chunk)); return true; }
  end(chunk) { if (chunk) this.write(chunk); this.ended = true; this.emit('close'); }
  destroy() { this.end(); }
}
async function dispatch(app, path, { method = 'GET', body, headers = {}, token = TOKEN } = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
  req.url = path; req.method = method;
  req.headers = { host: '127.0.0.1:4435', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers };
  const res = new Reply(); await app.handler(req, res);
  return { status: res.statusCode, body: res.headers['content-type']?.startsWith('application/json') ? JSON.parse(res.chunks.join('')) : null, response: res };
}
function isolated(t, extra = {}) {
  let calls = 0;
  const app = createApi({ config: { apiToken: TOKEN }, clock: () => NOW, fetcher: async () => { calls++; throw new Error('External access explicitly disabled for this test.'); }, ...extra });
  t.after(() => app.close());
  return { app, calls: () => calls };
}
async function register(app) {
  assert.equal((await dispatch(app, '/api/v1/sources', { method: 'POST', body: source })).status, 201);
  assert.equal((await dispatch(app, '/api/v1/instruments', { method: 'POST', body: instrument })).status, 201);
}

test('own API registration, ingestion, offline history, indicators, and quote reads need zero external calls', async t => {
  const { app, calls } = isolated(t); await register(app);
  const bars = Array.from({ length: 40 }, (_, i) => ({ time: new Date(NOW - (41 - i) * 60000).toISOString(), interval: '1m', adjustment: 'raw', open: 100, high: 101, low: 99, close: 100, volume: 10, complete: true }));
  const ingest = await dispatch(app, '/api/v1/ingest', { method: 'POST', body: { sourceId: source.id, instrumentId: instrument.id, quotes: [{ price: 100, asOf: new Date(NOW - 1000).toISOString() }], bars } });
  assert.equal(ingest.status, 201); assert.equal(ingest.body.data.accepted.bars, 40);
  const quote = await dispatch(app, '/api/v1/quotes?symbol=TEST');
  assert.equal(quote.status, 200); assert.equal(quote.body.data.price, 100); assert.equal(quote.body.meta.freshness, 'imported');
  const analysis = await dispatch(app, '/api/v1/indicators?instrumentId=owned-test-stock&interval=1m');
  assert.equal(analysis.status, 200); assert.equal(analysis.body.data.rsi14, 50); assert.equal(analysis.body.data.ema20, 100); assert.equal(analysis.body.data.macd.value, 0); assert(Math.abs(analysis.body.data.atr14 - 2) < 1e-12);
  assert.equal(analysis.body.data.vwap, null); assert.equal(calls(), 0);
  assert.equal((await dispatch(app, '/api/v1/instruments')).body.data.length, 1);
});

test('unauthorized, browser-origin and rebound-host requests cannot read or mutate records', async t => {
  const { app, calls } = isolated(t);
  assert.equal((await dispatch(app, '/health', { token: null })).status, 200);
  assert.equal((await dispatch(app, '/api/v1/status', { token: null })).status, 401);
  assert.equal((await dispatch(app, '/api/v1/status', { headers: { origin: 'https://nortivo.no' } })).status, 403);
  assert.equal((await dispatch(app, '/api/v1/status', { headers: { host: 'evil.test' } })).status, 403);
  assert.equal(calls(), 0); assert.equal(app.warehouse.stats().instruments, 0);
});

test('malformed ingestion is atomic through the HTTP interface and does not create partial observations', async t => {
  const { app } = isolated(t); await register(app);
  const result = await dispatch(app, '/api/v1/ingest', { method: 'POST', body: { sourceId: source.id, instrumentId: instrument.id, quotes: [{ price: 100, asOf: new Date(NOW - 1000).toISOString() }, { price: -5, asOf: new Date(NOW - 500).toISOString() }] } });
  assert.equal(result.status, 400); assert.equal(app.warehouse.stats().quotes, 0);
  assert.equal((await dispatch(app, '/api/v1/quotes?symbol=TEST')).status, 404);
});

test('single-day stored history bounds are inclusive and preserve the source timestamp', async t => {
  const { app } = isolated(t); await register(app);
  app.warehouse.ingest({ sourceId: source.id, instrumentId: instrument.id, bars: [{ time: '2026-11-17T00:00:00Z', interval: '1d', adjustment: 'raw', open: 100, high: 101, low: 99, close: 100, volume: 20, complete: true }] });
  const result = await dispatch(app, '/api/v1/bars?symbol=TEST&start=2026-11-17&end=2026-11-17');
  assert.equal(result.status, 200); assert.equal(result.body.data.bars.length, 1); assert.equal(result.body.data.bars[0].time, '2026-11-17T00:00:00Z');
});

test('SSE streams own ingestions and do not poll any external platform', async t => {
  const { app, calls } = isolated(t); await register(app);
  await dispatch(app, '/api/v1/ingest', { method: 'POST', body: { sourceId: source.id, instrumentId: instrument.id, quotes: [{ price: 100, asOf: new Date(NOW - 2000).toISOString() }] } });
  const stream = await dispatch(app, '/api/v1/stream?symbol=TEST');
  assert.equal(stream.status, 200); assert.equal(stream.response.headers['content-type'], 'text/event-stream');
  await dispatch(app, '/api/v1/ingest', { method: 'POST', body: { sourceId: source.id, instrumentId: instrument.id, quotes: [{ price: 101, asOf: new Date(NOW - 1000).toISOString() }] } });
  assert.equal((stream.response.chunks.join('').match(/event: quote/g) || []).length, 2);
  assert(stream.response.chunks.join('').includes('"price":101')); assert.equal(calls(), 0); stream.response.end();
});

test('unknown query parameters, credential injection and oversized writes are rejected', async t => {
  const { app } = isolated(t);
  assert.equal((await dispatch(app, '/api/v1/instruments?url=https://evil.test')).status, 400);
  assert.equal((await dispatch(app, '/api/v1/instruments?limit=1&limit=2')).status, 400);
  assert.equal((await dispatch(app, '/api/v1/sources', { method: 'POST', body: { ...source, apiKey: 'never-store-me' } })).status, 400);
  assert.equal((await dispatch(app, '/api/v1/sources', { method: 'POST', body: '{"padding":"' + 'x'.repeat(1000000) + '"}' })).status, 413);
});

test('missing stock keys and SEC/FRED prerequisites are explicit and never use invented fallback data', async t => {
  const { app, calls } = isolated(t);
  const stock = await dispatch(app, '/api/v1/connectors/quotes?provider=alpaca&symbol=AAPL');
  assert.equal(stock.status, 503); assert.equal(stock.body.error.code, 'requires_key'); assert.equal(stock.body.data, null);
  const sec = await dispatch(app, '/api/v1/connectors/companies?symbol=AAPL'); assert.equal(sec.body.error.code, 'requires_configuration');
  const fred = await dispatch(app, '/api/v1/connectors/economic-series?seriesId=GDP'); assert.equal(fred.body.error.code, 'requires_key');
  assert.equal(calls(), 0);
});

test('unsupported datasets and empty own data remain explicit in capabilities', async t => {
  const { app, calls } = isolated(t);
  const result = await dispatch(app, '/api/v1/capabilities');
  assert.equal(result.body.data.siteIntegration, 'not_connected'); assert.equal(result.body.data.freshExternalPricesRequireIncomingFeed, true);
  assert.equal((await dispatch(app, '/api/v1/esg')).status, 501);
  assert.equal((await dispatch(app, '/api/v1/quotes?symbol=AAPL')).status, 404);
  assert.equal(calls(), 0);
});

test('collector rejects expired sources and false Kraken adjustments before network traffic', async t => {
  let now = NOW;
  const { app, calls } = isolated(t, { clock: () => now });
  app.warehouse.registerSource({ id: 'kraken', label: 'Fixture provider permission', kind: 'provider', canRetain: true, retentionUntil: new Date(now + 1000).toISOString() });
  app.warehouse.upsertInstrument({ ...instrument, id: 'btc', symbol: 'BTC/USD', assetType: 'crypto', listingVenue: 'Kraken' });
  const settings = { provider: 'kraken', sourceId: 'kraken', instrumentId: 'btc', symbol: 'BTC/USD', dataset: 'bars', adjustment: 'all' };
  assert.equal((await dispatch(app, '/api/v1/collect', { method: 'POST', body: settings })).status, 400);
  now += 1001;
  assert.equal((await dispatch(app, '/api/v1/collect', { method: 'POST', body: { ...settings, adjustment: 'raw' } })).status, 503);
  assert.equal(calls(), 0);
});

test('concurrent starts cannot create duplicate quote collectors for one instrument', async t => {
  const { app } = isolated(t);
  app.warehouse.registerSource({ id: 'kraken', label: 'Fixture provider permission', kind: 'provider', canRetain: true, retentionUntil: null });
  app.warehouse.upsertInstrument({ ...instrument, id: 'btc', symbol: 'BTC/USD', assetType: 'crypto', listingVenue: 'Kraken' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  app.providers.kraken.quote = async () => { await gate; return { data: { currency: 'USD', price: 100, asOf: new Date(NOW - 1000).toISOString(), venue: 'Kraken' }, meta: { feed: 'fixture', delaySeconds: 0 } }; };
  const settings = { provider: 'kraken', sourceId: 'kraken', instrumentId: 'btc', symbol: 'BTC/USD' };
  const first = dispatch(app, '/api/v1/collectors', { method: 'POST', body: settings });
  await new Promise(resolve => setImmediate(resolve));
  const second = await dispatch(app, '/api/v1/collectors', { method: 'POST', body: settings });
  assert.equal(second.status, 409); release();
  assert.equal((await first).status, 201);
  assert.equal((await dispatch(app, '/api/v1/collectors')).body.data.length, 1);
});

test('a cross-market stock ticker cannot be collected into an unrelated listing', async t => {
  const { app, calls } = isolated(t);
  app.warehouse.registerSource({ id: 'alpaca', label: 'Fixture provider permission', kind: 'provider', canRetain: true, retentionUntil: null });
  app.warehouse.upsertInstrument({ ...instrument, id: 'foreign-test', listingVenue: 'XOSL' });
  const r = await dispatch(app, '/api/v1/collect', { method: 'POST', body: { provider: 'alpaca', sourceId: 'alpaca', instrumentId: 'foreign-test', symbol: 'TEST' } });
  assert.equal(r.status, 400); assert.equal(calls(), 0);
});
