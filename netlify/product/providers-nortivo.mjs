import { createAlpaca } from '../../services/market-data/providers/alpaca.mjs';
import { ApiError } from '../../services/market-data/core.mjs';
import { fail, sha256, TerminalError } from '../terminal/security.mjs';
import { createProviderTransport, clean, decimal, SYSTEM_OWNER, updateRecord } from './providers-core.mjs';
import { instrument, brokerVenue, VENUES } from './providers-data.mjs';

const SOURCE = 'Nortivo Data · Alpaca IEX (single venue)';
const COVERAGE = 'IEX trades and volume only; not consolidated US prices, NBBO, or market-wide volume. Private owner use.';
const PAPER_ASSETS = 'https://paper-api.alpaca.markets/v2/assets';
const RESOLUTIONS = Object.freeze({ '1min': '1m', '5min': '5m', '15min': '15m', '1h': '1h', '1day': '1d' });
// This is a private-use transport scope, not a commercial redistribution licence.
const PRIVATE_SCOPE = Object.freeze({ ready: true, cacheSeconds: 0, nonDisplay: true, ai: false, scope: 'owner_private' });
// Listing names, MICs and asset types are public metadata. Prices, candles,
// sessions, owner grants and provider permissions never enter this cache.
const metadataCaches = new WeakMap();
const METADATA_TTL = 60000, METADATA_BYTES = 4000000, METADATA_ENTRIES = 128;

function providerError(error) {
  if (error instanceof TerminalError) throw error;
  if (error instanceof ApiError) {
    const code = error.code === 'requires_key' ? 'INTEGRATION_NOT_CONFIGURED'
      : error.status === 429 ? 'PROVIDER_RATE_LIMIT'
      : error.status === 400 ? 'UNSUPPORTED_INSTRUMENT'
      : error.status === 502 ? 'PROVIDER_INVALID_DATA' : 'PROVIDER_UNAVAILABLE';
    const wrapped = new TerminalError(code, error.message, error.status || 503);
    if (error.details?.retryAfterSeconds) wrapped.retryAfter = error.details.retryAfterSeconds;
    throw wrapped;
  }
  fail('PROVIDER_UNAVAILABLE', 'The private market-data service could not confirm this request.', 503);
}
function price(value) {
  const result = decimal(value);
  if (!result) fail('PROVIDER_INVALID_DATA', 'The source returned an unsupported price precision.', 502);
  return result;
}
function normalizeAsset(row) {
  if (!row || (row.class || row.asset_class) !== 'us_equity' || row.status !== 'active'
    || typeof row.symbol !== 'string' || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(row.symbol)
    || row.currency && row.currency !== 'USD') return null;
  const venue = brokerVenue(String(row.exchange || '').toUpperCase());
  if (!VENUES[venue]) return null;
  const name = clean(row.name, 180);
  if (!name) return null;
  // Alpaca's us_equity class covers both stocks and ETFs. Do not infer a subtype from a name.
  const assetType = row.asset_type === 'etf' ? 'etf' : row.asset_type === 'stock' ? 'stock' : 'stock_or_etf';
  return { id: `${venue}:${row.symbol}:USD`, symbol: row.symbol, name, venue, currency: 'USD', assetType, providerAssetId: typeof row.id === 'string' ? clean(row.id, 80) : null };
}
function normalizedBars(result, interval) {
  return result.data.bars.map(bar => ({
    time: bar.time, open: price(bar.open), high: price(bar.high), low: price(bar.low), close: price(bar.close),
    volume: String(bar.volume), complete: bar.complete,
    timeKind: interval === '1d' ? 'exchange_session_start' : 'bar_open', timeZone: 'UTC',
  }));
}

/** Must be selected only after server-side owner authorization; never attach to public/paid-user contexts. */
export function createNortivoDataProviders({ env, fetcher = fetch, store, clock = Date.now }) {
  if (!store) throw new TypeError('The persistent product store is required.');
  const requestedLimit = Number(env.PRODUCT_ALPACA_CREDITS_PER_MINUTE || 180);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200) fail('INTEGRATION_NOT_CONFIGURED', 'The private Alpaca allowance must be between 1 and 200 requests per minute.', 503);
  const transport = createProviderTransport({ env: { ...env, PRODUCT_ALPACA_CREDITS_PER_MINUTE: String(requestedLimit) }, fetcher, store, clock });
  if (!metadataCaches.has(fetcher)) metadataCaches.set(fetcher, { entries: new Map(), pending: new Map(), bytes: 0 });
  const metadata = metadataCaches.get(fetcher), credentialScope = sha256(JSON.stringify([env.APCA_API_KEY_ID || '', env.APCA_API_SECRET_KEY || '', 'iex', 'us_equity', 'USD']));
  function dropMetadata(key) { const row = metadata.entries.get(key); if (row) { metadata.bytes -= row.bytes; metadata.entries.delete(key); } }
  async function publicMetadata(address, load) {
    const key = credentialScope + ':' + address, now = clock();
    for (const [storedKey, row] of metadata.entries) if (row.until <= now) dropMetadata(storedKey);
    const cached = metadata.entries.get(key);
    if (cached) { metadata.entries.delete(key); metadata.entries.set(key, cached); return cached.value; }
    if (metadata.pending.has(key)) return metadata.pending.get(key);
    const promise = (async () => {
      const value = await load(), bytes = Buffer.byteLength(JSON.stringify(value));
      if (bytes <= METADATA_BYTES / 2) {
        dropMetadata(key);
        while (metadata.entries.size >= METADATA_ENTRIES || metadata.bytes + bytes > METADATA_BYTES) dropMetadata(metadata.entries.keys().next().value);
        metadata.entries.set(key, { value, bytes, until: clock() + METADATA_TTL }); metadata.bytes += bytes;
      }
      return value;
    })();
    const tracked = metadata.pending.size < METADATA_ENTRIES;
    if (tracked) metadata.pending.set(key, promise);
    try { return await promise; } finally { if (tracked && metadata.pending.get(key) === promise) metadata.pending.delete(key); }
  }
  const credentials = () => {
    if (!env.APCA_API_KEY_ID || !env.APCA_API_SECRET_KEY) fail('INTEGRATION_NOT_CONFIGURED', 'The private Alpaca market-data credentials are not configured.', 503);
    return { 'APCA-API-KEY-ID': env.APCA_API_KEY_ID, 'APCA-API-SECRET-KEY': env.APCA_API_SECRET_KEY };
  };
  async function request({ url, headers, maxBytes = 4_000_000 }) {
    const target = new URL(url);
    const metadata = target.origin === 'https://paper-api.alpaca.markets' && /^\/v2\/assets(?:\/[A-Z0-9.%_-]+)?$/.test(target.pathname);
    const market = target.origin === 'https://data.alpaca.markets' && /^\/v2\/stocks\/[A-Z0-9.%_-]+\/(?:trades\/latest|bars)$/.test(target.pathname) && target.searchParams.get('feed') === 'iex';
    if (!metadata && !market) fail('PROVIDER_INVALID_DATA', 'This private adapter only permits asset metadata and IEX market-data reads.', 502);
    const result = await transport.request({
      provider: 'alpaca', capability: 'owner_market', url: target.href, headers: headers || credentials(), rights: PRIVATE_SCOPE,
      // Only the validated quote/history below may publish successful market
      // evidence. A successful metadata fetch does not establish a fresh price.
      ttl: 0, maxBytes, recordSuccess: false, normalize: (body, now) => ({ body, fetchedAt: new Date(now).toISOString(), sourceUrl: target.href }),
    });
    return { body: result.body, fetchedAt: new Date(clock()).toISOString(), sourceUrl: result.sourceUrl, cache: { hit: false, stale: false, ageMs: 0 } };
  }
  const adapter = createAlpaca({ transport: { request }, clock, apiKey: env.APCA_API_KEY_ID, apiSecret: env.APCA_API_SECRET_KEY, cacheSeconds: 0 });
  async function verifyInstrument(value) {
    const selected = instrument(value);
    const asset = await publicMetadata('listing:' + selected.id, async () => {
      const response = await request({ url: `${PAPER_ASSETS}/${encodeURIComponent(selected.symbol)}` });
      const confirmed = normalizeAsset(response.body);
      if (!confirmed || confirmed.id !== selected.id) fail('UNSUPPORTED_INSTRUMENT', 'The provider did not confirm this exact US listing, symbol and currency.', 400);
      return Object.freeze(confirmed);
    });
    return { ...selected, ...asset };
  }
  async function evidence(update) {
    await updateRecord(store, 'provider_health', 'owner_market', SYSTEM_OWNER, current => ({ ...current, provider: 'alpaca', reachable: true, privateOwnerUse: true, coverage: COVERAGE, lastSuccessAt: clock(), lastAttemptAt: clock(), failures: 0, retryAt: 0, ...update }));
  }
  async function run(action) {
    try { return await action(); } catch (error) {
      if (error instanceof ApiError && error.status >= 500) await updateRecord(store, 'provider_health', 'owner_market', SYSTEM_OWNER, current => ({ ...current, provider: 'alpaca', reachable: false, lastAttemptAt: clock(), freshness: 'unavailable', errorCode: 'PROVIDER_INVALID_DATA' }));
      return providerError(error);
    }
  }
  return {
    async catalog(params = {}) {
      return run(async () => {
        const q = clean(params.q || params.symbol, 50);
        if (!q || /[^\p{L}\p{N} .-]/u.test(q)) fail('INVALID_SEARCH', 'Enter a US stock/ETF symbol or name.', 400);
        const assets = await publicMetadata('directory:active-us-equity', async () => {
          const response = await request({ url: `${PAPER_ASSETS}?status=active&asset_class=us_equity`, maxBytes: 16_000_000 });
          if (!Array.isArray(response.body) || response.body.length > 50000) fail('PROVIDER_INVALID_DATA', 'The source returned an unsupported instrument directory.', 502);
          return Object.freeze(response.body.map(normalizeAsset).filter(Boolean).map(Object.freeze));
        });
        const query = q.toUpperCase(), seen = new Set();
        const instruments = assets.filter(asset => asset.symbol.includes(query) || asset.name.toUpperCase().includes(query)).filter(asset => { if (seen.has(asset.id)) return false; seen.add(asset.id); return true; });
        instruments.sort((a, b) => Number(b.symbol === query) - Number(a.symbol === query) || Number(b.symbol.startsWith(query)) - Number(a.symbol.startsWith(query)) || a.symbol.localeCompare(b.symbol));
        return { instruments: instruments.slice(0, 30), source: SOURCE, sourceUrl: 'https://alpaca.markets', coverage: COVERAGE, privateOwnerUse: true };
      });
    },
    async quotes(params = {}) {
      return run(async () => {
        if (params.resolution && !RESOLUTIONS[params.resolution]) fail('INVALID_TIMEFRAME', 'Choose 1min, 5min, 15min, 1h or 1day for IEX charts.', 400);
        const selected = await verifyInstrument(params.instrumentId);
        const calls = [adapter.quote({ symbol: selected.symbol })];
        if (params.resolution) calls.push(adapter.bars({ symbol: selected.symbol, interval: RESOLUTIONS[params.resolution], limit: 500, adjustment: 'raw' }));
        const settled = await Promise.allSettled(calls), rejected = settled.find(result => result.status === 'rejected');
        if (rejected) throw rejected.reason;
        const result = settled[0].value;
        const freshness = result.meta.freshness === 'live' ? 'current' : 'stale';
        const quote = { instrumentId: selected.id, symbol: selected.symbol, venue: selected.venue, currency: 'USD', price: price(result.data.price), previousClose: null, asOf: result.data.asOf, sourceTimestamp: result.data.sourceTimestamp, receivedAt: result.data.receivedAt, freshness, delayMinutes: 0, source: SOURCE, sourceUrl: 'https://alpaca.markets', coverage: COVERAGE, feed: 'IEX', feedVenue: 'IEX', marketOpen: null, executionEligible: false, privateOwnerUse: true };
        await evidence({ quoteSuccessAt: clock(), quoteFreshness: freshness, freshness });
        const output = { quote, bars: [], source: SOURCE, coverage: COVERAGE, feed: 'IEX', privateOwnerUse: true };
        if (params.resolution) {
          const interval = RESOLUTIONS[params.resolution], candles = settled[1].value;
          output.bars = normalizedBars(candles, interval);
          output.adjustment = 'Raw IEX OHLCV; not consolidated volume. Incomplete candles are marked.';
        }
        return output;
      });
    },
    async history(params = {}) {
      return run(async () => {
        const selected = await verifyInstrument(params.instrumentId), result = await adapter.bars({ symbol: selected.symbol, interval: '1d', limit: 1000, adjustment: 'all' });
        const bars = normalizedBars(result, '1d').filter(bar => bar.complete);
        await evidence({ historySuccessAt: clock(), historyBars: bars.length, historyInstrumentId: selected.id });
        return { bars, source: SOURCE, sourceUrl: 'https://alpaca.markets', instrumentId: selected.id, historyType: 'adjusted_daily', adjustment: 'Alpaca all corporate-action adjusted daily IEX bars; not execution prices.', coverage: COVERAGE, volumeScope: 'IEX only', privateOwnerUse: true, nextPageToken: result.meta.nextPageToken, historyScope: 'Most recent available page, at most 1000 bars; no claim of complete or survivorship-free history.' };
      });
    },
    async fx(from, to) {
      if (!/^[A-Z]{3}$/.test(from || '') || !/^[A-Z]{3}$/.test(to || '')) fail('UNSUPPORTED_CURRENCY', 'Choose a supported currency pair.', 400);
      if (from !== to) fail('INTEGRATION_NOT_CONFIGURED', 'This stock feed does not include an FX feed. Cross-currency valuations remain partial.', 503);
      return { from, to, rate: '1', asOf: new Date(clock()).toISOString(), source: 'Same-currency identity', freshness: 'current' };
    },
  };
}
