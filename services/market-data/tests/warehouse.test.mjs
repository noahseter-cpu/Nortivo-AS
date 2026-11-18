import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWarehouse } from '../warehouse.mjs';

// Synthetic observations verify storage behavior only, never live-feed coverage.
const NOW = Date.parse('2026-11-18T18:00:00Z');
const source = (id = 'own-import', extra = {}) => ({ id, label: 'Owner-provided test observations', kind: 'user_import', canRetain: true, externalDisplay: false, retentionUntil: null, provenanceUrl: null, ...extra });
const instrument = (id = 'own:aapl', extra = {}) => ({ id, symbol: 'AAPL', name: 'Apple', assetType: 'stock', currency: 'USD', listingVenue: 'XNAS', ...extra });
const quote = (extra = {}) => ({ asOf: '2026-11-18T17:59:59.123456789Z', price: 123.45, delaySeconds: 0, ...extra });
const bar = (extra = {}) => ({ time: '2026-11-17T05:00:00Z', interval: '1d', adjustment: 'raw', open: 100, high: 110, low: 90, close: 105, volume: 1234, complete: true, ...extra });
function setup(t, opts = {}) {
  const warehouse = createWarehouse({ clock: () => NOW, ...opts });
  t.after(() => warehouse.close());
  warehouse.registerSource(source());
  warehouse.upsertInstrument(instrument());
  return warehouse;
}

test('warehouse persists independently of network and survives database reopen', t => {
  const directory = mkdtempSync(join(tmpdir(), 'nortivo-warehouse-test-')), path = join(directory, 'owned.sqlite');
  t.after(() => { rmSync(path, { force: true }); rmdirSync(directory); });
  let warehouse = createWarehouse({ path, clock: () => NOW });
  warehouse.registerSource(source()); warehouse.upsertInstrument(instrument());
  warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [quote()], bars: [bar()] });
  warehouse.close();
  warehouse = createWarehouse({ path, clock: () => NOW + 86_400_000 });
  try {
    const result = warehouse.quote({ symbol: 'aapl' });
    assert.equal(result.data.price, 123.45);
    assert.equal(result.data.asOf, quote().asOf);
    assert.equal(result.data.receivedAt, new Date(NOW).toISOString());
    assert.equal(result.meta.freshness, 'imported');
    assert.equal(warehouse.bars({ instrumentId: 'own:aapl' }).data.bars[0].close, 105);
    assert.equal(warehouse.stats().networkRequiredForStoredReads, false);
  } finally { warehouse.close(); }
});

test('warehouse source permission is explicit and credentials cannot enter records', t => {
  const warehouse = setup(t);
  assert.throws(() => warehouse.registerSource(source('forbidden', { canRetain: false })), { code: 'retention_permission_required' });
  assert.throws(() => warehouse.registerSource(source('implicit-unlimited', { retentionUntil: undefined })), { code: 'invalid_request' });
  assert.throws(() => warehouse.registerSource({ ...source('with-key'), apiKey: 'credential' }), { code: 'invalid_request' });
  assert.throws(() => warehouse.registerSource(source('bad-url', { provenanceUrl: 'https://example.com/data?api_key=secret' })), { code: 'invalid_request' });
  assert.throws(() => warehouse.registerSource(source('bad-url', { provenanceUrl: 'https://user:secret@example.com/data' })), { code: 'invalid_request' });
  assert.throws(() => warehouse.registerSource(source('bad-url', { provenanceUrl: 'http://example.com' })), { code: 'invalid_request' });
  assert.equal(warehouse.sources()[0].externalDisplay, false);
});

test('warehouse ingest rolls back a batch if a later observation is malformed', t => {
  const warehouse = setup(t);
  assert.throws(() => warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [quote()], bars: [bar(), bar({ high: 80 })] }), { code: 'invalid_request' });
  assert.equal(warehouse.stats().quotes, 0);
  assert.equal(warehouse.stats().bars, 0);
  assert.throws(() => warehouse.quote({ symbol: 'AAPL' }), { code: 'not_found' });
});

test('warehouse separates sources and never joins bars from competing feeds', t => {
  const warehouse = setup(t);
  warehouse.registerSource(source('second', { label: 'Second independent source' }));
  warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [quote({ price: 100 })], bars: [bar({ time: '2026-11-16T05:00:00Z' }), bar({ time: '2026-11-17T05:00:00Z' })] });
  warehouse.ingest({ sourceId: 'second', instrumentId: 'own:aapl', quotes: [quote({ asOf: '2026-11-18T18:00:00Z', price: 200 })], bars: [bar({ time: '2026-11-18T05:00:00Z', close: 109 })] });
  assert.equal(warehouse.quote({ symbol: 'AAPL' }).data.price, 200);
  assert.equal(warehouse.quote({ symbol: 'AAPL', sourceId: 'own-import' }).data.price, 100);
  const latest = warehouse.bars({ symbol: 'AAPL' });
  assert.equal(latest.meta.sourceId, 'second');
  assert.equal(latest.data.bars.length, 1);
  assert.equal(warehouse.bars({ symbol: 'AAPL', sourceId: 'own-import' }).data.bars.length, 2);
});

test('warehouse removes expired source observations on reads and cannot resurrect them on renewal', t => {
  let now = NOW;
  const warehouse = setup(t, { clock: () => now });
  warehouse.registerSource(source('limited', { retentionUntil: '2026-11-18T18:00:01Z' }));
  warehouse.ingest({ sourceId: 'limited', instrumentId: 'own:aapl', quotes: [quote()], bars: [bar()] });
  now += 2000;
  assert.equal(warehouse.stats().quotes, 0);
  assert.equal(warehouse.stats().bars, 0);
  assert.throws(() => warehouse.quote({ symbol: 'AAPL', sourceId: 'limited' }), { code: 'retention_expired' });
  assert.throws(() => warehouse.ingest({ sourceId: 'limited', instrumentId: 'own:aapl', quotes: [quote()] }), { code: 'retention_expired' });
  warehouse.registerSource(source('limited', { retentionUntil: null }));
  assert.throws(() => warehouse.quote({ symbol: 'AAPL', sourceId: 'limited' }), { code: 'not_found' });
});

test('warehouse rejects future observations and preserves exact event timestamps', t => {
  const warehouse = setup(t);
  assert.throws(() => warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [quote({ asOf: '2026-11-18T18:00:00.001Z' })] }), { code: 'invalid_request' });
  assert.throws(() => warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [quote({ asOf: '2026-11-18T18:00:00.000000001Z' })] }), { code: 'invalid_request' });
  warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [quote()] });
  const first = warehouse.quote({ symbol: 'AAPL' });
  const second = warehouse.quote({ symbol: 'AAPL' });
  assert.equal(first.data.asOf, quote().asOf);
  assert.equal(second.data.asOf, first.data.asOf);
  assert.equal(second.data.receivedAt, first.data.receivedAt);
});

test('warehouse distinguishes timestamp precision, updates true revisions, and orders nanoseconds', t => {
  const warehouse = setup(t);
  warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [quote({ asOf: '2026-11-18T17:59:59.000000002Z', price: 2 }), quote({ asOf: '2026-11-18T17:59:59.000000001Z', price: 1 })] });
  assert.equal(warehouse.quote({ symbol: 'AAPL' }).data.price, 2);
  warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [quote({ asOf: '2026-11-18T17:59:59.000000002Z', price: 3 })] });
  assert.equal(warehouse.stats().quotes, 2);
  assert.equal(warehouse.quote({ symbol: 'AAPL' }).data.price, 3);
});

test('warehouse only calls zero-delay recent direct observations current', t => {
  let now = NOW;
  const warehouse = setup(t, { clock: () => now });
  warehouse.registerSource(source('exchange', { kind: 'direct_exchange' }));
  warehouse.ingest({ sourceId: 'exchange', instrumentId: 'own:aapl', quotes: [quote()] });
  assert.equal(warehouse.quote({ symbol: 'AAPL' }).meta.freshness, 'current');
  now += 20_000;
  assert.equal(warehouse.quote({ symbol: 'AAPL' }).meta.freshness, 'stale');
  warehouse.ingest({ sourceId: 'exchange', instrumentId: 'own:aapl', quotes: [quote({ asOf: new Date(now).toISOString(), delaySeconds: null })] });
  assert.equal(warehouse.quote({ symbol: 'AAPL' }).meta.freshness, 'unknown');
  warehouse.ingest({ sourceId: 'exchange', instrumentId: 'own:aapl', quotes: [quote({ asOf: new Date(now).toISOString(), delaySeconds: 900 })] });
  assert.equal(warehouse.quote({ symbol: 'AAPL' }).meta.freshness, 'delayed');
});

test('warehouse rejects ambiguous symbols and conflicting stable instrument identities', t => {
  const warehouse = setup(t);
  warehouse.upsertInstrument(instrument('other:aapl', { listingVenue: 'XNYS' }));
  assert.throws(() => warehouse.quote({ symbol: 'AAPL' }), { code: 'ambiguous_symbol' });
  assert.throws(() => warehouse.quote({ instrumentId: 'own:aapl', symbol: 'MSFT' }), { code: 'invalid_request' });
  assert.throws(() => warehouse.upsertInstrument(instrument('own:aapl', { currency: 'NOK' })), { code: 'instrument_conflict' });
  warehouse.upsertInstrument(instrument('own:aapl', { name: 'Apple renamed display label' }));
  assert.equal(warehouse.instruments({ q: 'renamed' })[0].id, 'own:aapl');
});

test('warehouse queries respect interval, adjustment, literal search and UTC date bounds', t => {
  const warehouse = setup(t);
  warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', bars: [bar({ time: '2026-11-16T05:00:00Z' }), bar({ time: '2026-11-17T05:00:00Z' }), bar({ time: '2026-11-17T05:00:00Z', adjustment: 'split', close: 109 }), bar({ time: '2026-11-18T17:00:00Z', interval: '1m' })] });
  const result = warehouse.bars({ symbol: 'AAPL', start: '2026-11-17', end: '2026-11-17' });
  assert.equal(result.data.bars.length, 1);
  assert.equal(result.data.bars[0].adjustment, 'raw');
  assert.equal(warehouse.bars({ symbol: 'AAPL', adjustment: 'split' }).data.bars[0].close, 109);
  assert.equal(warehouse.bars({ symbol: 'AAPL', limit: 1 }).data.bars[0].time, '2026-11-17T05:00:00Z');
  assert.deepEqual(warehouse.instruments({ q: '%' }), []);
  assert.throws(() => warehouse.bars({ symbol: 'AAPL', interval: '1s' }), { code: 'invalid_request' });
});

test('warehouse exact instrument lookup works beyond the first catalog page without needing prices', t => {
  const warehouse = setup(t);
  for (let i = 0; i < 600; i++) warehouse.upsertInstrument(instrument(`own:listing-${i}`, { symbol: `S${String(i).padStart(4, '0')}` }));
  warehouse.upsertInstrument(instrument('own:last', { symbol: 'ZZZZ', name: 'Last listing' }));
  assert.equal(warehouse.instruments({ limit: 500 }).some(row => row.id === 'own:last'), false);
  assert.equal(warehouse.instrument({ instrumentId: 'own:last' }).symbol, 'ZZZZ');
  assert.equal(warehouse.instrument({ symbol: 'zzzz' }).id, 'own:last');
  assert.throws(() => warehouse.instrument({ instrumentId: 'own:last', symbol: 'AAPL' }), { code: 'invalid_request' });
  assert.throws(() => warehouse.instrument({ instrumentId: 'missing' }), { code: 'not_found' });
  assert.equal(warehouse.stats().quotes, 0);
});

test('warehouse validates bounded records, unknown inputs, dates, prices and OHLC', t => {
  const warehouse = setup(t);
  for (const row of [quote({ price: Infinity }), quote({ price: '12' }), quote({ price: 0 }), quote({ bid: 10, ask: 9 }), quote({ asOf: '2026-02-31T00:00:00Z' }), quote({ asOf: '2026-11-17T24:00:00Z' }), quote({ asOf: '2026-11-18T12:00:00+00:00' }), { ...quote(), token: 'secret' }]) assert.throws(() => warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: [row] }), { code: 'invalid_request' });
  for (const row of [bar({ volume: -1 }), bar({ complete: undefined }), bar({ low: 120 }), bar({ time: '2026-11-19T00:00:00Z' }), bar({ adjustment: 'unknown' })]) assert.throws(() => warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', bars: [row] }), { code: 'invalid_request' });
  assert.throws(() => warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: Array.from({ length: 1001 }, () => quote()) }), { code: 'invalid_request' });
  assert.throws(() => warehouse.ingest({ sourceId: 'own-import', instrumentId: 'own:aapl', quotes: null }), { code: 'invalid_request' });
  assert.equal(warehouse.stats().quotes, 0);
  assert.equal(warehouse.stats().bars, 0);
  assert.throws(() => warehouse.ingest({ sourceId: 'missing', instrumentId: 'own:aapl', quotes: [quote()] }), { code: 'not_found' });
});
