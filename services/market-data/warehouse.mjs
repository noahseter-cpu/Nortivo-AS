import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ApiError } from './core.mjs';

const KINDS = new Set(['user_import', 'direct_exchange', 'provider']);
const ASSETS = new Set(['stock', 'etf', 'crypto', 'forex', 'index', 'option', 'future', 'commodity', 'mutual_fund', 'otc', 'other']);
const INTERVALS = new Set(['1m', '5m', '15m', '1h', '1d']);
const ADJUSTMENTS = new Set(['raw', 'split', 'dividend', 'all']);
const sourceFields = new Set(['id', 'label', 'kind', 'canRetain', 'externalDisplay', 'retentionUntil', 'provenanceUrl']);
const instrumentFields = new Set(['id', 'symbol', 'name', 'assetType', 'currency', 'listingVenue']);
const quoteFields = new Set(['asOf', 'price', 'bid', 'ask', 'feed', 'venue', 'delaySeconds']);
const barFields = new Set(['time', 'interval', 'adjustment', 'open', 'high', 'low', 'close', 'volume', 'complete']);
const invalid = message => { throw new ApiError('invalid_request', message, 400); };
const missing = message => { throw new ApiError('not_found', message, 404); };

function object(value, allowed, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${name} must be an object.`);
  if (Object.keys(value).some(key => !allowed.has(key))) invalid(`${name} contains unsupported fields; credentials must never be included in stored market records.`);
  return value;
}
function text(value, name, { max = 200, nullable = false } = {}) {
  if (nullable && (value === undefined || value === null)) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid(`${name} must be nonempty text of at most ${max} characters.`);
  return value.trim();
}
function id(value, name = 'id') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,119}$/.test(value)) invalid(`${name} must be a stable identifier of at most 120 characters.`);
  return value;
}
function symbol(value) {
  const result = text(value, 'symbol', { max: 30 }).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9./-]{0,29}$/.test(result)) invalid('symbol contains unsupported characters.');
  return result;
}
function number(value, name, { positive = false, nullable = false } = {}) {
  if (nullable && (value === undefined || value === null)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value <= 0)) invalid(`${name} must be a finite ${positive ? 'positive' : 'nonnegative'} number.`);
  return value;
}
function timestamp(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) invalid(`${name} must be a valid UTC timestamp ending in Z.`);
  const ms = Date.parse(value), hour = Number(value.slice(11, 13)), minute = Number(value.slice(14, 16)), second = Number(value.slice(17, 19));
  const calendar = value.slice(0, 10), [year, month, day] = calendar.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(ms) || year < 1900 || year > 2200 || hour > 23 || minute > 59 || second > 59 || date.toISOString().slice(0, 10) !== calendar) invalid(`${name} is not a supported calendar timestamp.`);
  const fraction = value.includes('.') ? value.slice(20, -1) : '';
  return { raw: value, ms, key: `${value.slice(0, 19)}.${fraction.padEnd(9, '0')}Z` };
}
function bound(value, name, ending = false) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return timestamp(`${value}T${ending ? '23:59:59.999999999' : '00:00:00'}Z`, name);
  return timestamp(value, name);
}
function limit(value, fallback = 100) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > 1000) invalid('limit must be an integer from 1 to 1000.');
  return value;
}
function sourceUrl(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 2000) invalid('provenanceUrl must be an HTTPS URL without credentials.');
  let url;
  try { url = new URL(value); } catch { invalid('provenanceUrl must be an HTTPS URL without credentials.'); }
  if (url.protocol !== 'https:' || url.username || url.password || [...url.searchParams.keys()].some(key => /key|token|secret|password|auth|signature/i.test(key))) invalid('provenanceUrl must be an HTTPS URL without credentials.');
  url.hash = '';
  return url.href;
}
function readSource(row) { return row ? JSON.parse(row.payload) : null; }
function readInstrument(row) { return row ? JSON.parse(row.payload) : null; }

/** Nortivo-owned durable records, independent of provider caches and networking. */
export function createWarehouse({ path = ':memory:', clock = Date.now } = {}) {
  if (typeof path !== 'string' || !path) throw new TypeError('Warehouse path is required.');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=5000;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS warehouse_sources (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS warehouse_instruments (
      id TEXT PRIMARY KEY, symbol TEXT NOT NULL, name TEXT NOT NULL, payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS warehouse_instrument_symbol ON warehouse_instruments(symbol);
    CREATE TABLE IF NOT EXISTS warehouse_quotes (
      source_id TEXT NOT NULL REFERENCES warehouse_sources(id),
      instrument_id TEXT NOT NULL REFERENCES warehouse_instruments(id),
      time_key TEXT NOT NULL, event_time TEXT NOT NULL, payload TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      PRIMARY KEY(source_id,instrument_id,time_key)
    );
    CREATE INDEX IF NOT EXISTS warehouse_quote_latest ON warehouse_quotes(instrument_id,time_key DESC,received_at DESC);
    CREATE TABLE IF NOT EXISTS warehouse_bars (
      source_id TEXT NOT NULL REFERENCES warehouse_sources(id),
      instrument_id TEXT NOT NULL REFERENCES warehouse_instruments(id),
      interval TEXT NOT NULL, adjustment TEXT NOT NULL,
      time_key TEXT NOT NULL, event_time TEXT NOT NULL, payload TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      PRIMARY KEY(source_id,instrument_id,interval,adjustment,time_key)
    );
    CREATE INDEX IF NOT EXISTS warehouse_bar_latest ON warehouse_bars(instrument_id,interval,adjustment,time_key DESC,received_at DESC);`);

  function prune() {
    const now = clock();
    db.prepare('DELETE FROM warehouse_quotes WHERE source_id IN (SELECT id FROM warehouse_sources WHERE expires_at IS NOT NULL AND expires_at <= ?)').run(now);
    db.prepare('DELETE FROM warehouse_bars WHERE source_id IN (SELECT id FROM warehouse_sources WHERE expires_at IS NOT NULL AND expires_at <= ?)').run(now);
  }
  function resolve({ instrumentId, symbol: requestedSymbol } = {}) {
    if (instrumentId !== undefined && instrumentId !== null) {
      const row = readInstrument(db.prepare('SELECT payload FROM warehouse_instruments WHERE id=?').get(id(instrumentId, 'instrumentId')));
      if (!row) missing('The instrument is not in Nortivo’s warehouse.');
      if (requestedSymbol !== undefined && requestedSymbol !== null && symbol(requestedSymbol) !== row.symbol) invalid('The requested symbol does not match instrumentId.');
      return row;
    }
    if (requestedSymbol === undefined || requestedSymbol === null) invalid('Supply instrumentId or symbol.');
    const rows = db.prepare('SELECT payload FROM warehouse_instruments WHERE symbol=? ORDER BY id LIMIT 2').all(symbol(requestedSymbol));
    if (!rows.length) missing('The symbol is not in Nortivo’s warehouse.');
    if (rows.length > 1) throw new ApiError('ambiguous_symbol', 'More than one stored instrument has this symbol; supply instrumentId.', 400);
    return readInstrument(rows[0]);
  }
  function findSource(sourceId, { writable = false } = {}) {
    const row = db.prepare('SELECT * FROM warehouse_sources WHERE id=?').get(id(sourceId, 'sourceId'));
    if (!row) missing('The source is not registered in Nortivo’s warehouse.');
    const source = readSource(row);
    if (row.expires_at !== null && row.expires_at <= clock()) throw new ApiError('retention_expired', 'This source’s retention permission has expired; its market records have been removed.', writable ? 403 : 404, { sourceId: source.id });
    return source;
  }
  function metadata(source, instrument, extra = {}) {
    return {
      storage: 'nortivo_warehouse', instrumentId: instrument.id, currency: instrument.currency,
      sourceId: source.id, sourceLabel: source.label, sourceKind: source.kind,
      sourceUrl: source.provenanceUrl, externalDisplay: source.externalDisplay,
      retentionUntil: source.retentionUntil, canRetain: true,
      verification: 'source declaration; storage does not independently verify market observations',
      units: { price: instrument.currency, volume: 'instrument units as supplied by the source' },
      ...extra,
    };
  }
  function validatedQuote(input, now) {
    object(input, quoteFields, 'quote');
    const asOf = timestamp(input.asOf, 'quote.asOf');
    if (asOf.key > timestamp(new Date(now).toISOString(), 'clock').key) invalid('quote.asOf must not be in the future.');
    const price = number(input.price, 'quote.price', { positive: true });
    const bid = number(input.bid, 'quote.bid', { positive: true, nullable: true });
    const ask = number(input.ask, 'quote.ask', { positive: true, nullable: true });
    if (bid !== null && ask !== null && bid > ask) invalid('quote.bid must not exceed quote.ask.');
    const delaySeconds = number(input.delaySeconds, 'quote.delaySeconds', { nullable: true });
    return { time: asOf, payload: { asOf: asOf.raw, price, bid, ask, feed: text(input.feed, 'quote.feed', { max: 120, nullable: true }), venue: text(input.venue, 'quote.venue', { max: 120, nullable: true }), delaySeconds } };
  }
  function validatedBar(input, now) {
    object(input, barFields, 'bar');
    const time = timestamp(input.time, 'bar.time');
    if (time.key > timestamp(new Date(now).toISOString(), 'clock').key) invalid('bar.time must not be in the future.');
    if (!INTERVALS.has(input.interval) || !ADJUSTMENTS.has(input.adjustment)) invalid('bar.interval or bar.adjustment is unsupported.');
    if (typeof input.complete !== 'boolean') invalid('bar.complete must be an explicit boolean.');
    const open = number(input.open, 'bar.open', { positive: true }), high = number(input.high, 'bar.high', { positive: true });
    const low = number(input.low, 'bar.low', { positive: true }), close = number(input.close, 'bar.close', { positive: true });
    const volume = number(input.volume, 'bar.volume');
    if (high < low || high < open || high < close || low > open || low > close) invalid('bar OHLC values are inconsistent.');
    return { time, payload: { time: time.raw, interval: input.interval, adjustment: input.adjustment, open, high, low, close, volume, complete: input.complete } };
  }

  prune();
  return {
    sources() {
      prune();
      return db.prepare('SELECT payload,expires_at FROM warehouse_sources ORDER BY id').all().map(row => ({ ...readSource(row), expired: row.expires_at !== null && row.expires_at <= clock() }));
    },
    registerSource(input) {
      object(input, sourceFields, 'source');
      const sourceId = id(input.id, 'source.id'), label = text(input.label, 'source.label');
      if (!KINDS.has(input.kind)) invalid('source.kind must be user_import, direct_exchange or provider.');
      if (input.canRetain !== true) throw new ApiError('retention_permission_required', 'Register only a source whose records you explicitly have permission to retain.', 403);
      if (input.externalDisplay !== undefined && typeof input.externalDisplay !== 'boolean') invalid('source.externalDisplay must be a boolean.');
      if (!Object.hasOwn(input, 'retentionUntil') || input.retentionUntil === undefined) invalid('Declare source.retentionUntil as a future UTC timestamp, or explicitly null for unlimited retention permission.');
      const expires = input.retentionUntil === null ? null : timestamp(input.retentionUntil, 'source.retentionUntil');
      if (expires && expires.ms <= clock()) invalid('source.retentionUntil must be in the future.');
      const source = { id: sourceId, label, kind: input.kind, canRetain: true, externalDisplay: input.externalDisplay === true, retentionUntil: expires?.raw || null, provenanceUrl: sourceUrl(input.provenanceUrl) };
      const existing = readSource(db.prepare('SELECT payload FROM warehouse_sources WHERE id=?').get(sourceId));
      if (existing && existing.kind !== source.kind) throw new ApiError('source_conflict', 'A source’s kind cannot be changed under the same source ID.', 409);
      // Expired records must be removed before a renewed permission is registered.
      prune();
      db.prepare('INSERT INTO warehouse_sources(id,payload,expires_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').run(sourceId, JSON.stringify(source), expires?.ms ?? null);
      return source;
    },
    instruments({ q = '', limit: count = 50 } = {}) {
      prune(); count = limit(count, 50);
      if (typeof q !== 'string' || q.length > 200 || /[\u0000-\u001f\u007f]/.test(q)) invalid('q must be text of at most 200 characters.');
      const needle = `%${q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      return db.prepare("SELECT payload FROM warehouse_instruments WHERE symbol LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' ORDER BY symbol,id LIMIT ?").all(needle, needle, needle, count).map(readInstrument);
    },
    instrument(selection = {}) {
      prune();
      return resolve(selection);
    },
    upsertInstrument(input) {
      object(input, instrumentFields, 'instrument');
      const record = { id: id(input.id, 'instrument.id'), symbol: symbol(input.symbol), name: text(input.name, 'instrument.name'), assetType: input.assetType, currency: text(input.currency, 'instrument.currency', { max: 12 }).toUpperCase(), listingVenue: text(input.listingVenue, 'instrument.listingVenue', { max: 120, nullable: true }) };
      if (!ASSETS.has(record.assetType) || !/^[A-Z0-9]{2,12}$/.test(record.currency)) invalid('instrument.assetType or instrument.currency is invalid.');
      const current = readInstrument(db.prepare('SELECT payload FROM warehouse_instruments WHERE id=?').get(record.id));
      if (current && ['symbol', 'assetType', 'currency', 'listingVenue'].some(key => current[key] !== record[key])) throw new ApiError('instrument_conflict', 'Stable instrument identity fields cannot be changed; register a distinct instrument ID.', 409);
      db.prepare('INSERT INTO warehouse_instruments(id,symbol,name,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,payload=excluded.payload').run(record.id, record.symbol, record.name, JSON.stringify(record));
      return record;
    },
    ingest(input) {
      object(input, new Set(['sourceId', 'instrumentId', 'quotes', 'bars']), 'ingest');
      const quotes = input.quotes === undefined ? [] : input.quotes, bars = input.bars === undefined ? [] : input.bars;
      if (!Array.isArray(quotes) || !Array.isArray(bars) || quotes.length + bars.length > 1000) invalid('Supply quotes and bars arrays containing at most 1000 records in total.');
      prune();
      db.exec('BEGIN IMMEDIATE');
      try {
        const now = clock(), source = findSource(input.sourceId, { writable: true });
        const instrument = resolve({ instrumentId: input.instrumentId });
        const insertQuote = db.prepare('INSERT INTO warehouse_quotes(source_id,instrument_id,time_key,event_time,payload,received_at) VALUES (?,?,?,?,?,?) ON CONFLICT(source_id,instrument_id,time_key) DO UPDATE SET event_time=excluded.event_time,payload=excluded.payload,received_at=excluded.received_at');
        const insertBar = db.prepare('INSERT INTO warehouse_bars(source_id,instrument_id,interval,adjustment,time_key,event_time,payload,received_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(source_id,instrument_id,interval,adjustment,time_key) DO UPDATE SET event_time=excluded.event_time,payload=excluded.payload,received_at=excluded.received_at');
        for (const inputQuote of quotes) {
          const row = validatedQuote(inputQuote, now);
          insertQuote.run(source.id, instrument.id, row.time.key, row.time.raw, JSON.stringify(row.payload), now);
        }
        for (const inputBar of bars) {
          const row = validatedBar(inputBar, now);
          insertBar.run(source.id, instrument.id, row.payload.interval, row.payload.adjustment, row.time.key, row.time.raw, JSON.stringify(row.payload), now);
        }
        db.exec('COMMIT');
        return { sourceId: source.id, instrumentId: instrument.id, accepted: { quotes: quotes.length, bars: bars.length }, receivedAt: new Date(now).toISOString(), revisions: 'Matching source/instrument/event-time records are replaced atomically; counts represent accepted inputs.' };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    quote({ instrumentId, symbol: requestedSymbol, sourceId = null } = {}) {
      prune();
      const instrument = resolve({ instrumentId, symbol: requestedSymbol });
      if (sourceId !== null) findSource(sourceId);
      const row = sourceId === null
        ? db.prepare('SELECT * FROM warehouse_quotes WHERE instrument_id=? ORDER BY time_key DESC,received_at DESC,source_id LIMIT 1').get(instrument.id)
        : db.prepare('SELECT * FROM warehouse_quotes WHERE instrument_id=? AND source_id=? ORDER BY time_key DESC,received_at DESC LIMIT 1').get(instrument.id, sourceId);
      if (!row) missing('No retained quote is available for this instrument and source. Import or ingest a timestamped observation first.');
      const source = findSource(row.source_id), payload = JSON.parse(row.payload), ageMs = Math.max(0, clock() - Date.parse(payload.asOf));
      const freshness = source.kind === 'user_import' ? 'imported' : payload.delaySeconds === null ? 'unknown' : payload.delaySeconds === 0 ? ageMs <= 15_000 ? 'current' : 'stale' : ageMs <= payload.delaySeconds * 1000 + 15_000 ? 'delayed' : 'stale';
      const receivedAt = new Date(row.received_at).toISOString();
      return {
        data: { ...payload, instrumentId: instrument.id, symbol: instrument.symbol, assetType: instrument.assetType, currency: instrument.currency, listingVenue: instrument.listingVenue, sourceId: source.id, receivedAt },
        meta: metadata(source, instrument, { asOf: payload.asOf, receivedAt, ageMs, freshness, delaySeconds: payload.delaySeconds, feed: payload.feed, venue: payload.venue, sourceSelection: sourceId === null ? 'Latest stored event; source is disclosed.' : 'Explicit source.' }),
      };
    },
    bars({ instrumentId, symbol: requestedSymbol, sourceId = null, interval = '1d', adjustment = 'raw', limit: count = 100, start = null, end = null } = {}) {
      prune();
      const instrument = resolve({ instrumentId, symbol: requestedSymbol });
      count = limit(count);
      if (!INTERVALS.has(interval) || !ADJUSTMENTS.has(adjustment)) invalid('interval or adjustment is unsupported.');
      const first = bound(start, 'start'), last = bound(end, 'end', true);
      if (first && last && first.key > last.key) invalid('start must not follow end.');
      if (sourceId !== null) findSource(sourceId);
      const predicates = ['instrument_id=?', 'interval=?', 'adjustment=?'], values = [instrument.id, interval, adjustment];
      if (first) { predicates.push('time_key>=?'); values.push(first.key); }
      if (last) { predicates.push('time_key<=?'); values.push(last.key); }
      let selected = sourceId;
      if (selected === null) selected = db.prepare(`SELECT source_id FROM warehouse_bars WHERE ${predicates.join(' AND ')} ORDER BY time_key DESC,received_at DESC,source_id LIMIT 1`).get(...values)?.source_id ?? null;
      if (selected === null) missing('No retained bars are available for this instrument, interval and adjustment.');
      const source = findSource(selected);
      const rows = db.prepare(`SELECT event_time,payload,received_at FROM warehouse_bars WHERE ${predicates.join(' AND ')} AND source_id=? ORDER BY time_key DESC LIMIT ?`).all(...values, selected, count);
      if (!rows.length) missing('No retained bars match the requested source and time range.');
      const bars = rows.reverse().map(row => ({ ...JSON.parse(row.payload), receivedAt: new Date(row.received_at).toISOString() }));
      return {
        data: { instrumentId: instrument.id, symbol: instrument.symbol, currency: instrument.currency, assetType: instrument.assetType, listingVenue: instrument.listingVenue, interval, adjustment, bars },
        meta: metadata(source, instrument, { asOf: bars.at(-1).time, freshness: 'historical', interval, adjustment, sourceSelection: sourceId === null ? 'Source with the latest matching stored bar; the series never mixes sources.' : 'Explicit source.', gapsFilled: false, start: bars[0].time, end: bars.at(-1).time, receivedAt: new Date(Math.max(...rows.map(row => row.received_at))).toISOString(), requestedRange: { start, end }, returned: bars.length }),
      };
    },
    stats() {
      prune();
      return {
        storage: 'sqlite', networkRequiredForStoredReads: false,
        sources: db.prepare('SELECT COUNT(*) AS count FROM warehouse_sources').get().count,
        expiredSources: db.prepare('SELECT COUNT(*) AS count FROM warehouse_sources WHERE expires_at IS NOT NULL AND expires_at<=?').get(clock()).count,
        instruments: db.prepare('SELECT COUNT(*) AS count FROM warehouse_instruments').get().count,
        quotes: db.prepare('SELECT COUNT(*) AS count FROM warehouse_quotes').get().count,
        bars: db.prepare('SELECT COUNT(*) AS count FROM warehouse_bars').get().count,
      };
    },
    close() { db.close(); },
  };
}
