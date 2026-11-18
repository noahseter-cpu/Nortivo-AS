import { ApiError } from '../core.mjs';

const ORIGIN = 'https://data.alpaca.markets';
const FEED = 'iex';
const INTERVALS = Object.freeze({
  '1m': { timeframe: '1Min', ms: 60_000 },
  '5m': { timeframe: '5Min', ms: 300_000 },
  '15m': { timeframe: '15Min', ms: 900_000 },
  '1h': { timeframe: '1Hour', ms: 3_600_000 },
  '1d': { timeframe: '1Day', ms: 86_400_000 },
});
const ADJUSTMENTS = new Set(['raw', 'split', 'dividend', 'spin-off', 'all']);
const COVERAGE = 'IEX single-venue US equity/ETF feed; not consolidated prices or market volume. Listing venue and asset subtype are not inferred.';
const invalid = message => { throw new ApiError('invalid_provider_data', message, 502); };

function validCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number(match[1]) >= 2010 && date.toISOString().slice(0, 10) === match[0];
}

function selectedSymbol(value) {
  const symbol = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new ApiError('invalid_symbol', 'Use a valid US stock or ETF symbol.', 400);
  return symbol;
}

function eventTime(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validCalendarDate(value)) invalid('Alpaca returned an invalid event timestamp.');
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time < Date.UTC(2010, 0, 1) || time > now + 60_000) invalid('Alpaca returned an unsupported or future event timestamp.');
  return new Date(time).toISOString();
}

function number(value, { positive = false, integer = false, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value <= 0) || (integer && !Number.isSafeInteger(value))) invalid('Alpaca returned an invalid numeric field.');
  return value;
}

function requestTime(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) || !validCalendarDate(value)) throw new ApiError('invalid_date', `${field} must be a valid YYYY-MM-DD date or RFC3339 timestamp from 2010 onwards.`, 400);
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new ApiError('invalid_date', `${field} is not a valid date.`, 400);
  return new Date(field === 'end' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? time + 86_400_000 - 1 : time).toISOString();
}

function provenance(result, { asOf = null, ...extra } = {}) {
  return {
    provider: 'alpaca', sourceUrl: result.sourceUrl,
    feed: FEED, venue: 'IEX', listingVenue: null,
    coverage: COVERAGE, currency: 'USD', delaySeconds: 0,
    latency: 'real_time_single_venue', asOf,
    receivedAt: result.fetchedAt, cache: result.cache,
    ...extra,
  };
}

/** Read-only market-data adapter. It never calls an account or order endpoint. */
export function createAlpaca({ transport, clock = Date.now, apiKey, apiSecret, cacheSeconds = 0 } = {}) {
  if (!transport || typeof transport.request !== 'function') throw new TypeError('A provider transport is required.');
  if (!Number.isFinite(cacheSeconds) || cacheSeconds < 0 || cacheSeconds > 86_400) throw new TypeError('cacheSeconds must be between 0 and 86400.');

  function credentials() {
    if (typeof apiKey !== 'string' || !apiKey.trim() || typeof apiSecret !== 'string' || !apiSecret.trim()) {
      throw new ApiError('requires_key', 'Live US stock data requires an Alpaca market-data key and secret. No subscription is activated by this service.', 503, { provider: 'alpaca', required: ['APCA_API_KEY_ID', 'APCA_API_SECRET_KEY'] });
    }
    return { 'APCA-API-KEY-ID': apiKey, 'APCA-API-SECRET-KEY': apiSecret };
  }

  async function get(url, ttlMs) {
    const result = await transport.request({ provider: 'alpaca', url: url.href, headers: credentials(), format: 'json', ttlMs: Math.min(ttlMs, cacheSeconds * 1000), maxBytes: 4_000_000 });
    if (!result || !result.body || typeof result.body !== 'object' || Array.isArray(result.body)) invalid('Alpaca returned an invalid response.');
    if (result.body.code || result.body.message && !result.body.trade && !Array.isArray(result.body.bars)) invalid('Alpaca did not supply the requested market data.');
    return result;
  }

  return {
    async quote({ symbol } = {}) {
      const selected = selectedSymbol(symbol);
      const url = new URL(`/v2/stocks/${encodeURIComponent(selected)}/trades/latest`, ORIGIN);
      url.searchParams.set('feed', FEED);
      url.searchParams.set('currency', 'USD');
      const result = await get(url, 1_000);
      const payload = result.body;
      if (payload.symbol !== selected) invalid('Alpaca did not confirm the requested symbol.');
      if (!payload.trade || typeof payload.trade !== 'object') throw new ApiError('temporarily_unavailable', 'No timestamped IEX trade is available for this symbol.', 503, { provider: 'alpaca' });
      const row = payload.trade, now = clock();
      const asOf = eventTime(row.t, now), price = number(row.p, { positive: true });
      const tradeSize = number(row.s, { positive: true });
      const ageMs = Math.max(0, now - Date.parse(asOf));
      const data = {
        instrumentId: `alpaca:US:${selected}:USD`, symbol: selected,
        assetType: 'stock_or_etf', currency: 'USD', price,
        asOf, sourceTimestamp: row.t, receivedAt: result.fetchedAt,
        venue: 'IEX', listingVenue: null, tradeSize,
        tradeId: typeof row.i === 'number' && Number.isSafeInteger(row.i) || typeof row.i === 'string' ? String(row.i) : null,
      };
      return { data, meta: provenance(result, { asOf, ageMs, freshness: result.cache?.stale || ageMs > 120_000 ? 'stale' : 'live', marketState: 'unknown', priceType: 'last_trade', bidAskAvailable: false }) };
    },

    async bars({ symbol, interval = '1m', limit = 100, start = null, end = null, adjustment = 'raw', pageToken = null } = {}) {
      const selected = selectedSymbol(symbol), frame = INTERVALS[interval];
      if (!frame) throw new ApiError('not_supported', 'Supported stock bar intervals are 1m, 5m, 15m, 1h and 1d.', 400);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new ApiError('invalid_limit', 'Stock history limit must be between 1 and 1000.', 400);
      if (!ADJUSTMENTS.has(adjustment)) throw new ApiError('invalid_adjustment', 'Choose raw, split, dividend, spin-off or all adjustments.', 400);
      if (pageToken !== null && (typeof pageToken !== 'string' || pageToken.length < 1 || pageToken.length > 2048 || /[\u0000-\u0020\u007f]/.test(pageToken))) throw new ApiError('invalid_page_token', 'The history page token is invalid.', 400);
      const now = clock(), requestedEndTime = requestTime(end, 'end');
      const endTime = requestedEndTime && /^\d{4}-\d{2}-\d{2}$/.test(end) && end === new Date(now).toISOString().slice(0, 10)
        ? new Date(now).toISOString() : requestedEndTime || new Date(now).toISOString();
      const defaultLookback = interval === '1d' ? (limit * 3 + 7) * frame.ms : 7 * 86_400_000;
      const startTime = requestTime(start, 'start') || new Date(Math.max(Date.UTC(2016, 0, 1), Date.parse(endTime) - defaultLookback)).toISOString();
      if (Date.parse(startTime) >= Date.parse(endTime)) throw new ApiError('invalid_date_range', 'start must be earlier than end.', 400);
      if (Date.parse(endTime) > now + 60_000) throw new ApiError('invalid_date_range', 'end must not be in the future.', 400);
      const url = new URL(`/v2/stocks/${encodeURIComponent(selected)}/bars`, ORIGIN);
      for (const [key, value] of Object.entries({ feed: FEED, currency: 'USD', timeframe: frame.timeframe, start: startTime, end: endTime, limit, adjustment, sort: 'desc' })) url.searchParams.set(key, String(value));
      if (pageToken) url.searchParams.set('page_token', pageToken);
      const result = await get(url, 60_000), payload = result.body;
      if (payload.symbol !== selected || !Array.isArray(payload.bars) || payload.bars.length > limit) invalid('Alpaca returned unsupported history metadata.');
      if (payload.currency !== undefined && payload.currency !== 'USD') invalid('Alpaca returned an unexpected currency.');
      if (payload.next_page_token !== null && payload.next_page_token !== undefined && (typeof payload.next_page_token !== 'string' || payload.next_page_token.length > 2048 || /[\u0000-\u0020\u007f]/.test(payload.next_page_token))) invalid('Alpaca returned an invalid pagination token.');
      const seen = new Set();
      const bars = payload.bars.map(row => {
        if (!row || typeof row !== 'object') invalid('Alpaca returned an invalid bar.');
        const time = eventTime(row.t, now), at = Date.parse(time);
        if (seen.has(time)) invalid('Alpaca returned duplicate candle timestamps.');
        seen.add(time);
        if (at < Date.parse(startTime) || at > Date.parse(endTime)) invalid('Alpaca returned a candle outside the requested time range.');
        const open = number(row.o, { positive: true }), high = number(row.h, { positive: true }), low = number(row.l, { positive: true }), close = number(row.c, { positive: true });
        if (high < low || high < open || high < close || low > open || low > close) invalid('Alpaca returned inconsistent OHLC prices.');
        const volume = number(row.v), tradeCount = number(row.n, { integer: true, nullable: true }), vwap = number(row.vw, { positive: true, nullable: true });
        // Daily timestamps identify an exchange-local session. Without a market
        // calendar, require 26 elapsed hours before calling a daily bar complete.
        const complete = at + (interval === '1d' ? 26 * 3_600_000 : frame.ms + 30_000) <= now;
        return { time, sourceTimestamp: row.t, open, high, low, close, volume, vwap, tradeCount, complete };
      }).sort((a, b) => a.time.localeCompare(b.time));
      const newest = bars.at(-1)?.time || null;
      return {
        data: { instrumentId: `alpaca:US:${selected}:USD`, symbol: selected, assetType: 'stock_or_etf', currency: 'USD', interval, adjustment, bars },
        meta: provenance(result, {
          asOf: newest, adjustment, interval, requestedRange: { start: startTime, end: endTime },
          nextPageToken: payload.next_page_token || null,
          pageOrder: 'most_recent_first; each returned page is sorted chronologically',
          oldestAvailableInResponse: bars[0]?.time || null,
          newestAvailableInResponse: newest,
          totalHistoryCoverage: 'Provider advertises history since 2016; coverage for this instrument is not established by one response.',
          completionPolicy: 'Intraday: interval elapsed plus 30 seconds. Daily: conservative 26 hours after session timestamp. Bars can be revised by the source.',
          freshness: result.cache?.stale ? 'stale' : 'historical',
          gapsFilled: false,
        }),
      };
    },
  };
}
