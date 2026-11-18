import { ApiError } from '../core.mjs';

const BASE = 'https://api.kraken.com/0/public/';
const INTERVALS = Object.freeze({ '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440, '1w': 10080, '15d': 21600 });
const FIAT = new Set(['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'CHF', 'NZD', 'AED', 'ARS', 'BRL', 'ZAR', 'TRY', 'MXN', 'NOK', 'SEK', 'DKK', 'PLN']);
const canonicalAsset = value => value === 'XBT' ? 'BTC' : value === 'XDG' ? 'DOGE' : value;
const badData = message => new ApiError('provider_invalid_data', message, 502);

function number(value, { zero = false } = {}) {
  if (!['number', 'string'].includes(typeof value) || value === '') throw badData('Kraken returned an invalid numeric field.');
  const result = Number(value);
  if (!Number.isFinite(result) || (zero ? result < 0 : result <= 0)) throw badData('Kraken returned an invalid numeric field.');
  return result;
}

function resultOf(payload) {
  if (!payload || !Array.isArray(payload.error)) throw badData('Kraken returned an invalid response envelope.');
  if (payload.error.length) {
    const errors = payload.error.join(' ');
    if (/Rate limit|Throttled/i.test(errors)) throw new ApiError('rate_limited', 'Kraken temporarily limited market-data requests.', 429);
    throw new ApiError('temporarily_unavailable', 'Kraken did not return usable market data.', 503);
  }
  if (!payload.result || typeof payload.result !== 'object') throw badData('Kraken returned an invalid result.');
  return payload.result;
}

function metadata(response, extra = {}) {
  return {
    provider: 'kraken', sourceUrl: response.sourceUrl, feed: 'Kraken spot',
    coverage: 'Single-venue spot crypto data; not stock, ETF, or consolidated market data.',
    latency: 'live_snapshot', delaySeconds: 0, retrievedAt: response.fetchedAt,
    cache: response.cache, ...extra,
  };
}

function validateLimit(limit, maximum) {
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) throw new ApiError('invalid_request', `limit must be an integer from 1 to ${maximum}.`, 400);
}

function requestedSymbol(value) {
  if (typeof value !== 'string' || value.length > 60 || !/^(?:KRAKEN:)?[A-Za-z0-9./-]{3,40}$/.test(value)) throw new ApiError('invalid_request', 'Use a supported crypto pair such as BTC/USD.', 400);
  return value.toUpperCase().replace(/^KRAKEN:/, '').replaceAll('-', '/').replace(/^XBT\//, 'BTC/').replace(/^XDG\//, 'DOGE/');
}

export function createKraken({ transport, clock = Date.now }) {
  async function catalog() {
    const response = await transport.request({ provider: 'kraken', url: `${BASE}AssetPairs`, ttlMs: 86_400_000, maxBytes: 8_000_000 });
    const pairs = resultOf(response.body);
    const data = Object.entries(pairs).flatMap(([providerSymbol, row]) => {
      if (!row || typeof row.wsname !== 'string' || providerSymbol.endsWith('.d') || (row.aclass_base && row.aclass_base !== 'currency') || (row.asset_class && row.asset_class !== 'currency')) return [];
      // Preserve the provider spelling; reject tokenized equity names rather than presenting them as stocks.
      if (!/^[A-Z0-9]{2,20}\/[A-Z0-9]{2,12}$/.test(row.wsname)) return [];
      const [rawBase, quote] = row.wsname.split('/'), base = canonicalAsset(rawBase);
      if (FIAT.has(base)) return [];
      const symbol = `${base}/${canonicalAsset(quote)}`;
      return [{ id: `KRAKEN:${symbol}`, symbol, providerSymbol, alternateSymbol: row.altname || null, websocketSymbol: row.wsname, base, quote: canonicalAsset(quote), currency: canonicalAsset(quote), assetType: 'crypto', venue: 'Kraken', status: row.status || 'unknown' }];
    });
    return { data, meta: metadata(response, { latency: 'reference', delaySeconds: null, asOf: null, verifiedAt: response.fetchedAt, total: data.length }) };
  }

  async function resolve(symbol) {
    const key = requestedSymbol(symbol), all = await catalog();
    const item = all.data.find(row => row.symbol === key || row.providerSymbol === key || row.alternateSymbol === key || row.websocketSymbol === key);
    if (!item) throw new ApiError('not_supported', 'This pair is not in the Kraken spot crypto directory.', 404);
    if (item.status !== 'online' && item.status !== 'unknown') throw new ApiError('temporarily_unavailable', 'This Kraken pair is not currently online.', 503);
    return item;
  }

  return {
    async instruments({ q = '', limit = 50 } = {}) {
      validateLimit(limit, 500);
      if (typeof q !== 'string' || q.length > 60) throw new ApiError('invalid_request', 'Search text must be at most 60 characters.', 400);
      const all = await catalog(), query = q.toUpperCase().replaceAll('XBT', 'BTC');
      const matches = all.data.filter(row => !query || [row.symbol, row.providerSymbol, row.alternateSymbol].some(value => value?.includes(query)));
      return { data: matches.slice(0, limit), meta: { ...all.meta, total: matches.length, returned: Math.min(limit, matches.length), truncated: matches.length > limit } };
    },
    async quote({ symbol } = {}) {
      const instrument = await resolve(symbol);
      const url = new URL(`${BASE}Trades`); url.searchParams.set('pair', instrument.providerSymbol); url.searchParams.set('count', '1');
      const response = await transport.request({ provider: 'kraken', url: url.href, ttlMs: 3000, maxBytes: 500_000 });
      const result = resultOf(response.body);
      const rows = result[instrument.providerSymbol];
      if (!Array.isArray(rows) || !rows.length) throw new ApiError('temporarily_unavailable', 'No dated trade is available for this pair.', 503);
      const row = rows.at(-1);
      if (!Array.isArray(row) || row.length < 3) throw badData('Kraken returned an invalid trade.');
      const timestamp = number(row[2]) * 1000;
      if (timestamp < Date.UTC(2009, 0, 1) || timestamp > clock() + 60_000) throw badData('Kraken returned an invalid trade timestamp.');
      const asOf = new Date(timestamp).toISOString(), ageMs = Math.max(0, clock() - timestamp);
      const freshness = response.cache?.stale || ageMs > 120_000 ? 'stale' : 'current';
      return { data: { instrumentId: instrument.id, symbol: instrument.symbol, currency: instrument.currency, venue: 'Kraken', price: number(row[0]), quantity: number(row[1], { zero: true }), bid: null, ask: null, asOf, receivedAt: response.fetchedAt, freshness, tradeId: row[6] == null ? null : String(row[6]) }, meta: metadata(response, { asOf, freshness, ageMs, priceType: 'last_trade', bidAskReason: 'not_requested' }) };
    },
    async bars({ symbol, interval = '1m', limit = 100, start = null, end = null } = {}) {
      validateLimit(limit, 720);
      if (!Object.hasOwn(INTERVALS, interval)) throw new ApiError('not_supported', `Supported Kraken intervals: ${Object.keys(INTERVALS).join(', ')}.`, 400);
      for (const value of [start, end]) if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10))) throw new ApiError('invalid_request', 'start and end must be ISO UTC dates or timestamps.', 400);
      const startMs = start === null ? null : Date.parse(start), endMs = end === null ? null : Date.parse(end) + (end.length === 10 ? 86_400_000 - 1 : 0);
      if (startMs !== null && endMs !== null && startMs > endMs) throw new ApiError('invalid_request', 'start must not be after end.', 400);
      const instrument = await resolve(symbol), durationMs = INTERVALS[interval] * 60_000;
      const url = new URL(`${BASE}OHLC`); url.searchParams.set('pair', instrument.providerSymbol); url.searchParams.set('interval', String(INTERVALS[interval]));
      if (startMs !== null) url.searchParams.set('since', String(Math.floor(startMs / 1000)));
      const response = await transport.request({ provider: 'kraken', url: url.href, ttlMs: 10_000, maxBytes: 1_000_000 });
      const result = resultOf(response.body), rows = result[instrument.providerSymbol];
      // The live endpoint can return 720 historical candles plus its always-present provisional candle.
      if (!Array.isArray(rows) || rows.length > 721) throw badData('Kraken returned an invalid OHLC array.');
      const seen = new Set();
      const normalized = rows.map((row, index) => {
        if (!Array.isArray(row) || row.length < 8) throw badData('Kraken returned an incomplete OHLC row.');
        const timeMs = number(row[0]) * 1000;
        if (timeMs < Date.UTC(2009, 0, 1) || timeMs > clock() + 60_000 || seen.has(timeMs)) throw badData('Kraken returned an invalid or duplicate candle timestamp.');
        seen.add(timeMs);
        const open = number(row[1]), high = number(row[2]), low = number(row[3]), close = number(row[4]), volume = number(row[6], { zero: true }), vwap = number(row[5], { zero: true }), tradeCount = number(row[7], { zero: true });
        if (high < Math.max(open, close, low) || low > Math.min(open, close) || !Number.isSafeInteger(tradeCount) || (volume > 0 && vwap === 0)) throw badData('Kraken returned inconsistent OHLC values.');
        return { time: new Date(timeMs).toISOString(), open, high, low, close, volume, vwap: volume === 0 && vwap === 0 ? null : vwap, tradeCount, complete: index !== rows.length - 1 && timeMs + durationMs <= clock() };
      }).sort((a, b) => a.time.localeCompare(b.time));
      const filtered = normalized.filter(row => (startMs === null || Date.parse(row.time) >= startMs) && (endMs === null || Date.parse(row.time) <= endMs));
      const data = filtered.slice(-limit), missingIntervals = data.reduce((sum, row, index) => index ? sum + Math.max(0, Math.round((Date.parse(row.time) - Date.parse(data[index - 1].time)) / durationMs) - 1) : sum, 0);
      return { data: { symbol: instrument.symbol, instrumentId: instrument.id, currency: instrument.currency, interval, bars: data }, meta: metadata(response, { instrumentId: instrument.id, symbol: instrument.symbol, currency: instrument.currency, interval, adjustment: 'raw', volumeScope: 'Kraken only', asOf: data.at(-1)?.time || null, earliestAvailable: normalized[0]?.time || null, missingIntervals, historyLimit: 720, upstreamMaximumRows: 721, historyComplete: false, requestedStartUnavailable: startMs !== null && normalized.length > 0 && startMs < Date.parse(normalized[0].time), incompleteCandleIncluded: data.some(row => !row.complete), note: 'The endpoint can return 720 recent historical candles plus its final provisional candle; older history cannot be requested. This response is bounded by the requested limit.' }) };
    },
  };
}
