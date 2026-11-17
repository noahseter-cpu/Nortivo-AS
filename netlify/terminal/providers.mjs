import { fail, sha256 } from './security.mjs';

const CAPABILITIES = ['market', 'news', 'calendar'];
const official = 'https://finnhub.io';
export function integrationStatus(env = process.env) {
  const credential = Boolean(env.FINNHUB_API_KEY);
  const entitled = env.TERMINAL_FINNHUB_COMMERCIAL_DISPLAY === 'true';
  const enabled = new Set((env.TERMINAL_FINNHUB_CAPABILITIES || '').split(',').map(value => value.trim()));
  const statuses = Object.fromEntries(CAPABILITIES.map(name => {
    const configured = credential && entitled && enabled.has(name);
    return [name, { provider: 'Finnhub', status: configured ? 'configured' : 'unavailable', available: configured, verified: false, reason: configured ? 'Configured by the owner; feed availability is checked on request.' : 'Requires a server credential, written commercial-display permission, and this capability explicitly enabled.', sourceUrl: official }];
  }));
  return { ...statuses, brokerage: { status: 'disabled', available: false, reason: 'Real-money brokerage execution is disabled in this release.' }, ai: { status: 'unavailable', available: false, reason: 'No AI summarization service is configured. Article summaries are provider text.' } };
}
export const brokerAdapter = Object.freeze({
  status: () => ({ available: false, status: 'disabled' }),
  connect: async () => fail('BROKER_NOT_CONFIGURED', 'Real-money brokerage execution is disabled.', 503),
  submitOrder: async () => fail('BROKER_NOT_CONFIGURED', 'Real-money brokerage execution is disabled.', 503),
});
const cleanText = (value, max) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0,max) : '';
function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : null; } catch { return null; }
}
const epoch = value => Number.isSafeInteger(value) && value > 946684800 && value < 4102444800 ? new Date(value * 1000).toISOString() : null;
const minor = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isSafeInteger(Math.round(value * 100)) ? Math.round(value * 100) : null;
export function normalizeNews(input, { symbol = '', category = '', now = Date.now() } = {}) {
  const seen = new Set();
  return (Array.isArray(input) ? input : []).slice(0,500).flatMap(item => {
    const url = safeUrl(item.url), publishedAt = epoch(item.datetime), title = cleanText(item.headline, 260), source = cleanText(item.source,100);
    if (!url || !publishedAt || Date.parse(publishedAt) > now + 60_000 || !title || !source) return [];
    const canonical = new URL(url); canonical.hash = '';
    for (const key of [...canonical.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) canonical.searchParams.delete(key);
    const keys = [`url:${canonical.href}`,`title:${source.toLowerCase()}|${title.toLowerCase()}|${publishedAt.slice(0,10)}`];
    if (keys.some(key => seen.has(key))) return [];
    keys.forEach(key => seen.add(key));
    const related = (typeof item.related === 'string' ? item.related : symbol).split(',').map(value => value.trim()).filter(value => /^[A-Z][A-Z0-9.-]{0,14}$/.test(value)).slice(0,20);
    return [{ id:`finnhub-${sha256(url).slice(0,20)}`,title,summary:cleanText(item.summary,1800),summaryKind:'provider',machineGenerated:false,source,url,publishedAt,symbols:related,category:cleanText(item.category || category,40),sentiment:null,impact:null,association:'Publication time is a temporal reference, not evidence of price causation.' }];
  }).sort((a,b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0,100);
}
export function normalizeCalendar(input, now = Date.now()) {
  const seen = new Set();
  return (Array.isArray(input?.economicCalendar) ? input.economicCalendar : []).slice(0,500).flatMap(item => {
    const title = cleanText(item.event,240), rawTime = cleanText(item.time,80);
    if (!title) return [];
    // Do not assign an exchange/UTC zone to a provider timestamp that does not carry one.
    const ms = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawTime) ? Date.parse(rawTime) : NaN;
    const time = Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    const id = sha256(`${title}|${rawTime}|${item.country}`).slice(0,20);
    if (seen.has(id)) return [];
    seen.add(id);
    const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
    const actual = number(item.actual);
    return [{id:`finnhub-${id}`,title,time,sourceTime:rawTime,timeZone:time ? 'UTC' : null,country:cleanText(item.country,40),unit:cleanText(item.unit,40),forecast:number(item.estimate),previous:number(item.prev),actual,status:actual !== null ? 'released' : time && ms > now ? 'scheduled' : 'result_unavailable',impact:cleanText(item.impact,30) || null,impactMethod:'Provider classification',source:'Finnhub',url:'https://finnhub.io/docs/api/economic-calendar'}];
  }).sort((a,b) => (a.time || 'z').localeCompare(b.time || 'z'));
}
export function normalizeBars(input, now = Date.now()) {
  if (input?.s === 'no_data') return [];
  if (input?.s !== 'ok' || !['t','o','h','l','c','v'].every(key => Array.isArray(input[key]) && input[key].length === input.t.length) || input.t.length > 12000) fail('PROVIDER_INVALID_DATA','The market provider returned incomplete bars.',502);
  const map = new Map();
  for (let i = 0; i < input.t.length; i++) {
    const time = epoch(input.t[i]), openMinor = minor(input.o[i]), highMinor = minor(input.h[i]), lowMinor = minor(input.l[i]), closeMinor = minor(input.c[i]), volume = input.v[i];
    if (!time || Date.parse(time) > now || !openMinor || !highMinor || !lowMinor || !closeMinor || highMinor < Math.max(openMinor,closeMinor) || lowMinor > Math.min(openMinor,closeMinor) || lowMinor > highMinor || !Number.isFinite(volume) || volume < 0) fail('PROVIDER_INVALID_DATA','The market provider returned invalid bars.',502);
    const bar = { time,openMinor,highMinor,lowMinor,closeMinor,volume };
    if (map.has(time) && JSON.stringify(map.get(time)) !== JSON.stringify(bar)) fail('PROVIDER_INVALID_DATA','The market provider returned conflicting bars.',502);
    map.set(time,bar);
  }
  return [...map.values()].sort((a,b) => a.time.localeCompare(b.time));
}
export function createProviderAdapters(env = process.env, fetcher = fetch) {
  const cache = new Map();
  async function request(capability, route, params, now, ttl) {
    if (!integrationStatus(env)[capability]?.available) fail('INTEGRATION_NOT_CONFIGURED', `${capability === 'market' ? 'Market data' : capability[0].toUpperCase()+capability.slice(1)} is not configured for commercial display. Sample replay remains a separate selectable mode.`, 503);
    const query = new URLSearchParams(params).toString();
    const key = `${route}?${query}`;
    const existing = cache.get(key);
    if (existing && existing.until > now) return structuredClone(existing.data);
    let data;
    try {
      const res = await fetcher(`https://finnhub.io/api/v1/${route}?${query}`, { headers:{'X-Finnhub-Token':env.FINNHUB_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(8_000),redirect:'error' });
      if (!res.ok) fail(res.status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_UNAVAILABLE','The configured provider is unavailable. No sample data was substituted.',503);
      if (Number(res.headers.get('content-length')) > 2_000_000) throw new Error();
      const chunks = []; let length = 0;
      for await (const chunk of res.body || []) {
        length += chunk.byteLength;
        if (length > 2_000_000) throw new Error();
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString('utf8');
      data = JSON.parse(text);
      if (data?.error) fail('PROVIDER_UNAVAILABLE','The configured provider did not supply usable data. No sample data was substituted.',503);
    } catch (error) {
      if (error?.code?.startsWith('PROVIDER_')) throw error;
      fail('PROVIDER_UNAVAILABLE','The configured provider could not be reached. No sample data was substituted.',503);
    }
    for (const [cacheKey,value] of cache) if (value.until <= now) cache.delete(cacheKey);
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    const envelope = {payload:data,fetchedAt:new Date(now).toISOString()};
    cache.set(key,{data:structuredClone(envelope),until:now+ttl});
    return envelope;
  }
  function symbolParam(value) {
    if (!/^[A-Z]{1,6}$/.test(value || '')) fail('INVALID_SYMBOL','Select a supported US stock symbol.',400);
    return value;
  }
  return {
    async news(params, now) {
      const symbol = params.symbol ? symbolParam(params.symbol) : '';
      const category = params.category || 'general';
      if (!['general','forex','crypto','merger'].includes(category)) fail('INVALID_CATEGORY','Select a supported news category.',400);
      const today = new Date(now).toISOString().slice(0,10), from = new Date(now - 7*86400_000).toISOString().slice(0,10);
      const data = await request('news', symbol ? 'company-news' : 'news', symbol ? {symbol,from,to:today} : {category},now,300_000);
      return { mode:'provider',source:'Finnhub',fetchedAt:data.fetchedAt,items:normalizeNews(data.payload,{symbol,category,now}) };
    },
    async calendar(params, now) {
      const from = new Date(now).toISOString().slice(0,10), to = new Date(now + 7*86400_000).toISOString().slice(0,10);
      const data = await request('calendar','calendar/economic',{from,to},now,300_000);
      return { mode:'provider',source:'Finnhub',fetchedAt:data.fetchedAt,events:normalizeCalendar(data.payload,now) };
    },
    async market(params, now) {
      const symbol = symbolParam(params.symbol);
      const resolution = params.resolution || '5';
      if (!['1','5','15','30','60','D'].includes(resolution)) fail('INVALID_TIMEFRAME','Select a supported timeframe.',400);
      const to = Math.floor(now/60_000)*60, from = to - (resolution === 'D' ? 365 : 5)*86400;
      const profile = (await request('market','stock/profile2',{symbol},now,86400_000)).payload;
      if (!profile?.ticker || profile.currency !== 'USD' || profile.country !== 'US') fail('UNSUPPORTED_MARKET','This adapter currently displays USD stocks from US companies only.',400);
      const [quoteResult,barsResult] = await Promise.all([request('market','quote',{symbol},now,60_000),request('market','stock/candle',{symbol,resolution,from:String(from),to:String(to)},now,60_000)]);
      const quote = quoteResult.payload, rawBars = barsResult.payload;
      const asOf = epoch(quote.t), priceMinor = minor(quote.c);
      if (!asOf || !priceMinor || Date.parse(asOf) > now+60_000) fail('PROVIDER_INVALID_DATA','The market provider did not supply a valid dated quote.',502);
      const delay = /^\d{1,4}$/.test(env.TERMINAL_FINNHUB_DELAY_MINUTES || '') ? Number(env.TERMINAL_FINNHUB_DELAY_MINUTES) : null;
      const bars = normalizeBars(rawBars,now);
      return { mode:'provider',source:'Finnhub',symbol,currency:'USD',timeZone:'America/New_York',fetchedAt:quoteResult.fetchedAt,barsFetchedAt:barsResult.fetchedAt,asOf,delayMinutes:delay,timing:delay === null ? 'unverified' : delay > 0 ? 'delayed' : 'provider-realtime-entitlement',stale:now-Date.parse(asOf) > ((delay || 0)+2)*60_000,quote:{priceMinor,previousCloseMinor:minor(quote.pc)},bars,adjustment:resolution === 'D' ? 'Provider split-adjusted daily OHLCV' : 'Provider unadjusted intraday OHLCV',executionEligible:false,executionReason:'External prices are research-only. Paper fills use the separately labeled server-owned replay.' };
    },
  };
}
