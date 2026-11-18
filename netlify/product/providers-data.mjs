import { fail } from '../terminal/security.mjs';
import { clean, decimal, safeLink, rightsFor, createProviderTransport } from './providers-core.mjs';
import { normalizeNews } from '../terminal/providers.mjs';

export const VENUES = Object.freeze({ XNAS: 'NASDAQ', XNYS: 'NYSE', ARCX: 'NYSE ARCA', BATS: 'CBOE BZX' });
export const brokerVenue = exchange => ({ NASDAQ: 'XNAS', NYSE: 'XNYS', ARCA: 'ARCX', NYSEARCA: 'ARCX', 'NYSE ARCA': 'ARCX', BATS: 'BATS', 'CBOE BZX': 'BATS' })[exchange] || null;
function exchangeDatetime(value, timezone) {
  const m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d):(\d\d))?$/.exec(value);
  if (!m || timezone !== 'America/New_York') fail('PROVIDER_INVALID_DATA', 'The daily candle exchange timestamp is unsupported.', 502);
  const target = Date.UTC(...[Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)]);
  let guess = target;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 3; i++) { const parts = Object.fromEntries(format.formatToParts(guess).map(x => [x.type, x.value])); const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)); guess += target - represented; }
  return new Date(guess).toISOString();
}
export function instrument(value) {
  const match = /^(XNAS|XNYS|ARCX|BATS):([A-Z][A-Z0-9.-]{0,14}):USD$/.exec(value || '');
  if (!match) fail('UNSUPPORTED_INSTRUMENT', 'Choose an explicitly identified US stock or ETF and its venue.', 400);
  return { id: value, venue: match[1], symbol: match[2], currency: 'USD' };
}
const epoch = n => Number.isSafeInteger(Number(n)) && Number(n) > 946684800 && Number(n) < 4102444800 ? new Date(Number(n) * 1000).toISOString() : null;
function providerVenue(row) { return row.mic_code || ({ NASDAQ: 'XNAS', NYSE: 'XNYS', 'NYSE ARCA': 'ARCX', CBOE: 'BATS' })[String(row.exchange).toUpperCase()]; }
export function normalizeCatalog(payload) {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const map = new Map();
  for (const row of items.slice(0, 200)) {
    const venue = providerVenue(row), assetType = /ETF|Exchange Traded Fund/i.test(row.instrument_type) ? 'etf' : /Common Stock/i.test(row.instrument_type) ? 'stock' : null;
    if (!VENUES[venue] || row.currency !== 'USD' || row.country !== 'United States' || !assetType || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(row.symbol)) continue;
    const id = `${venue}:${row.symbol}:USD`;
    map.set(id, { id, symbol: row.symbol, name: clean(row.instrument_name, 180), venue, currency: 'USD', assetType });
  }
  return [...map.values()].slice(0, 30);
}
export function normalizeQuote(row, selected, { now, rights }) {
  const price = decimal(row.close), asOf = epoch(row.timestamp), venue = providerVenue(row);
  if (!price || !asOf || Date.parse(asOf) > now + 60000 || row.symbol !== selected.symbol || row.currency !== 'USD' || venue !== selected.venue) fail('PROVIDER_INVALID_DATA', 'The provider did not confirm this instrument, currency and dated quote.', 502);
  const age = now - Date.parse(asOf), delay = rights.delayMinutes;
  const marketClosed = row.is_market_open === false;
  const freshness = delay === null ? 'unverified' : marketClosed ? age <= 4 * 86400000 ? 'market_closed' : 'stale' : age > (delay * 60000 + 120000) ? 'stale' : delay > 0 ? 'delayed' : 'current';
  return { instrumentId: selected.id, symbol: selected.symbol, venue, currency: 'USD', price, previousClose: decimal(row.previous_close), asOf, receivedAt: new Date(now).toISOString(), freshness, delayMinutes: delay, source: 'Twelve Data', sourceUrl: 'https://twelvedata.com', coverage: rights.coverage || 'US subset feed; consolidated coverage unverified', marketOpen: !marketClosed, executionEligible: freshness === 'current' && rights.nonDisplay };
}
export function normalizeCandles(payload, selected, now) {
  if (!Array.isArray(payload.values) || payload.values.length > 5000 || payload.meta?.symbol !== selected.symbol || providerVenue(payload.meta) !== selected.venue || payload.meta?.currency !== 'USD') fail('PROVIDER_INVALID_DATA', 'The provider returned unsupported candle metadata.', 502);
  const seen = new Map();
  for (const row of payload.values) {
    // Twelve ignores timezone=UTC for daily bars. Preserve their local session date and convert
    // exchange-local midnight using IANA rules, rather than mislabeling it as UTC or a trade timestamp.
    const daily = ['1day', '1week', '1month'].includes(payload.meta.interval);
    const time = daily ? exchangeDatetime(row.datetime, payload.meta.exchange_timezone) : new Date(`${row.datetime.replace(' ', 'T')}${/Z$|[+-]\d\d:\d\d$/.test(row.datetime) ? '' : 'Z'}`).toISOString();
    const values = ['open', 'high', 'low', 'close'].map(key => decimal(row[key])), volume = String(row.volume ?? '0');
    if (values.some(x => !x) || Date.parse(time) > now || !/^\d+(?:\.\d+)?$/.test(volume) || Number(values[1]) < Math.max(Number(values[0]), Number(values[3])) || Number(values[2]) > Math.min(Number(values[0]), Number(values[3])) || Number(values[2]) > Number(values[1])) fail('PROVIDER_INVALID_DATA', 'The provider returned invalid candles.', 502);
    const bar = { time, open: values[0], high: values[1], low: values[2], close: values[3], volume, ...(daily ? { sessionDate: row.datetime.slice(0, 10), timeKind: 'exchange_session_date', timeZone: payload.meta.exchange_timezone } : { timeKind: 'bar_open', timeZone: 'UTC' }) };
    if (seen.has(time) && JSON.stringify(seen.get(time)) !== JSON.stringify(bar)) fail('PROVIDER_INVALID_DATA', 'The provider returned conflicting candles.', 502);
    seen.set(time, bar);
  }
  return [...seen.values()].sort((a, b) => a.time.localeCompare(b.time));
}
export function normalizeEconomicCalendar(payload) {
  if (!Array.isArray(payload)) fail('PROVIDER_INVALID_DATA', 'The calendar provider returned invalid events.', 502);
  const seen = new Map(), value = x => x === null || x === undefined || x === '' ? null : clean(String(x), 60);
  for (const row of payload.slice(0, 1000)) {
    if (!/^\d{1,24}$/.test(String(row.CalendarId ?? row.CalendarID)) || !clean(row.Event)) continue;
    const rawDate = String(row.Date || ''), date = Date.parse(`${rawDate}${/Z$|[+-]\d\d:\d\d$/.test(rawDate) ? '' : 'Z'}`);
    if (!Number.isFinite(date)) continue;
    const id = `te:${row.CalendarId ?? row.CalendarID}`;
    const updated = Date.parse(`${row.LastUpdate || row.Date}${/Z$|[+-]\d\d:\d\d$/.test(row.LastUpdate || row.Date) ? '' : 'Z'}`) || date;
    if ((seen.get(id)?.updated || 0) > updated) continue;
    seen.set(id, { updated, event: { id, title: clean(row.Event, 240), time: new Date(date).toISOString(), estimatedTime: String(row.DateSpan) === '1', country: clean(row.Country, 80), currency: clean(row.Currency, 8) || (row.Country === 'United States' ? 'USD' : null), importance: [1, 2, 3].includes(Number(row.Importance)) ? Number(row.Importance) : null, unit: clean(row.Unit, 40) || null, actual: value(row.Actual), consensus: value(row.Forecast), previous: value(row.Previous), revised: value(row.Revised), reference: clean(row.Reference, 60) || null, updatedAt: new Date(updated).toISOString(), source: clean(row.Source, 100) || 'Trading Economics', sourceUrl: safeLink(row.SourceURL), url: safeLink(row.URL?.startsWith('/') ? `https://tradingeconomics.com${row.URL}` : row.URL) || 'https://tradingeconomics.com/calendar', status: value(row.Actual) === null ? 'scheduled_or_pending' : 'released' } });
  }
  return [...seen.values()].map(x => x.event).sort((a, b) => a.time.localeCompare(b.time));
}
export function createDataProviders(env, fetcher, store, clock = Date.now) {
  const transport = createProviderTransport({ env, fetcher, store, clock });
  const twelve = (route, params) => { const u = new URL(`https://api.twelvedata.com/${route}`); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v)); u.searchParams.set('apikey', env.TWELVE_DATA_API_KEY); return u.href; };
  const requireKey = key => { if (!env[key]) fail('INTEGRATION_NOT_CONFIGURED', 'The owner has not configured this data service.', 503); };
  const callTwelve = (route, params, normalize, ttl = 30) => { requireKey('TWELVE_DATA_API_KEY'); return transport.request({ provider: 'twelve', capability: 'market', rights: rightsFor(env, 'market', 'twelve'), url: twelve(route, params), ttl, normalize }); };
  return {
    async fx(from, to) {
      if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) fail('UNSUPPORTED_CURRENCY', 'Choose a supported currency pair.', 400);
      if (from === to) return { from, to, rate: '1', asOf: new Date(clock()).toISOString(), source: 'Identity conversion' };
      requireKey('TWELVE_DATA_API_KEY');
      const rights = rightsFor(env, 'fx', 'twelve');
      return transport.request({ provider: 'twelve', capability: 'fx', rights, url: twelve('exchange_rate', { symbol: `${from}/${to}` }), ttl: 60, normalize: (p, now) => {
        const rate = decimal(p.rate), asOf = epoch(p.timestamp);
        if (!rate || !asOf || p.symbol !== `${from}/${to}` || Date.parse(asOf) > now + 60000) fail('PROVIDER_INVALID_DATA', 'The currency provider returned an invalid dated rate.', 502);
        return { from, to, rate, asOf, receivedAt: new Date(now).toISOString(), source: 'Twelve Data', freshness: now - Date.parse(asOf) > 300000 ? 'stale' : 'current' };
      } });
    },
    async catalog(params = {}) {
      const q = clean(params.q || params.symbol, 50);
      if (q.length < 1 || /[^\p{L}\p{N} .-]/u.test(q)) fail('INVALID_SEARCH', 'Enter an instrument name or symbol.', 400);
      return callTwelve('symbol_search', { symbol: q, outputsize: 30 }, payload => ({ instruments: normalizeCatalog(payload), source: 'Twelve Data', sourceUrl: 'https://twelvedata.com' }), 3600);
    },
    async quotes(params = {}) {
      const selected = instrument(params.instrumentId), rights = rightsFor(env, 'market', 'twelve');
      const base = { symbol: selected.symbol, mic_code: selected.venue, timezone: 'UTC' };
      const result = await callTwelve('quote', base, (p, now) => ({ quote: normalizeQuote(p, selected, { now, rights }), source: 'Twelve Data', bars: [] }), 15);
      if (params.resolution) {
        if (!['1min', '5min', '15min', '30min', '1h', '1day'].includes(params.resolution)) fail('INVALID_TIMEFRAME', 'Choose a supported chart interval.', 400);
        const candles = await callTwelve('time_series', { ...base, interval: params.resolution, outputsize: 500, order: 'asc', adjust: 'all' }, (p, now) => ({ bars: normalizeCandles(p, selected, now), adjustment: 'Provider split/dividend adjusted; not an execution price' }), 60);
        result.bars = candles.bars; result.adjustment = candles.adjustment;
      }
      return result;
    },
    async history(params = {}) {
      const selected = instrument(params.instrumentId), rights = rightsFor(env, 'market', 'twelve');
      if (!rights.nonDisplay) fail('NON_DISPLAY_PERMISSION_REQUIRED', 'Scans and backtests await the provider’s non-display permission.', 503);
      return callTwelve('time_series', { symbol: selected.symbol, mic_code: selected.venue, timezone: 'UTC', interval: '1day', outputsize: 1000, order: 'asc', adjust: 'all' }, (p, now) => ({ bars: normalizeCandles(p, selected, now), source: 'Twelve Data', instrumentId: selected.id, historyType: 'adjusted_daily' }), 3600);
    },
    async news(params = {}) {
      requireKey('FINNHUB_API_KEY');
      const symbol = params.symbol || '';
      if (symbol && !/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) fail('INVALID_SYMBOL', 'Choose a supported US symbol.', 400);
      const u = new URL(`https://finnhub.io/api/v1/${symbol ? 'company-news' : 'news'}`), now = clock();
      if (symbol) { u.searchParams.set('symbol', symbol); u.searchParams.set('from', new Date(now - 7 * 86400000).toISOString().slice(0, 10)); u.searchParams.set('to', new Date(now).toISOString().slice(0, 10)); } else u.searchParams.set('category', 'general');
      return transport.request({ provider: 'finnhub', capability: 'news', rights: rightsFor(env, 'news', 'finnhub'), url: u.href, headers: { 'X-Finnhub-Token': env.FINNHUB_API_KEY }, ttl: 300, normalize: (p, time) => ({ items: normalizeNews(p, { symbol, now: time }).map(({ summary, ...item }) => ({ ...item, summary: env.PRODUCT_NEWS_EXCERPTS_APPROVED === 'true' ? summary : null })), source: 'Finnhub', asOf: new Date(time).toISOString() }) });
    },
    async calendar() {
      requireKey('TRADING_ECONOMICS_API_KEY');
      const from = new Date(clock() - 86400000).toISOString().slice(0, 10), to = new Date(clock() + 7 * 86400000).toISOString().slice(0, 10);
      return transport.request({ provider: 'tradingeconomics', capability: 'calendar', rights: rightsFor(env, 'calendar', 'tradingeconomics'), url: `https://api.tradingeconomics.com/calendar/country/all/${from}/${to}?f=json`, headers: { Authorization: env.TRADING_ECONOMICS_API_KEY }, ttl: 120, normalize: (p, time) => ({ events: normalizeEconomicCalendar(p), source: 'Trading Economics', asOf: new Date(time).toISOString(), window: { from, to }, reminders: { channel: 'in_app', backgroundDelivery: false } }) });
    },
  };
}
