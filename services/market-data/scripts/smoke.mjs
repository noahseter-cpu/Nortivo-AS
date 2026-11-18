import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createApi } from '../server.mjs';

/** Real local HTTP/SSE verification. Fixture values are explicitly isolated from market observations. */
export async function runSmoke({ includeLive = true, fetcher = fetch, httpFetch = fetch, providerConfig = {} } = {}) {
  let upstreamCalls = 0;
  const token = randomBytes(32).toString('base64url');
  const app = createApi({ config: { apiToken: token, ...providerConfig, cachePath: ':memory:', warehousePath: ':memory:' }, fetcher: async (...args) => { upstreamCalls++; return fetcher(...args); } });
  const report = { testedAt: new Date().toISOString(), service: 'Nortivo Data Engine 0.1.0', siteIntegrated: false, checks: [], marketObservations: [] };
  let base;
  const check = async (name, action, { optional = false } = {}) => {
    try { const evidence = await action(); report.checks.push({ name, status: 'passed', ...(evidence ? { evidence } : {}) }); }
    catch (error) {
      const externallyBlocked = optional && (['requires_key', 'requires_configuration', 'plan_restricted', 'temporarily_unavailable', 'rate_limited'].includes(error.code) || ['TimeoutError', 'AbortError'].includes(error.name));
      report.checks.push({ name, status: externallyBlocked ? 'blocked' : 'failed', reason: error.message });
    }
  };
  const demand = (condition, message) => { if (!condition) throw new Error(message); };
  async function call(path, body, { auth = true } = {}) {
    const response = await httpFetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
    const result = await response.json();
    return { status: response.status, ...result };
  }
  const requireOkay = result => {
    if (!(result.status >= 200 && result.status < 300)) throw Object.assign(new Error(`${result.error?.code || result.status}: ${result.error?.message || 'HTTP check failed'}`), { code: result.error?.code });
    return result;
  };
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${app.server.address().port}`;
    await check('actual HTTP health', async () => { const r = requireOkay(await call('/health', null, { auth: false })); demand(r.data.siteConnected === false, 'Unexpected site connection.'); });
    await check('actual HTTP authentication', async () => { const r = await call('/api/v1/status', null, { auth: false }); demand(r.status === 401, 'Anonymous private access was not denied.'); });
    const fixtureTime = new Date(Date.now() - 60000).toISOString();
    await check('own source/instrument registration and atomic fixture ingestion', async () => {
      requireOkay(await call('/api/v1/sources', { id: 'smoke-owned-fixture', label: 'Smoke test fixture; not market data', kind: 'user_import', canRetain: true, retentionUntil: null }));
      requireOkay(await call('/api/v1/instruments', { id: 'smoke-fixture', symbol: 'NVFIXTURE', name: 'Explicit smoke test fixture', assetType: 'other', currency: 'USD' }));
      const bars = Array.from({ length: 40 }, (_, i) => ({ time: new Date(Date.now() - (42 - i) * 60000).toISOString(), interval: '1m', adjustment: 'raw', open: 100, high: 101, low: 99, close: 100, volume: 10, complete: true }));
      const r = requireOkay(await call('/api/v1/ingest', { sourceId: 'smoke-owned-fixture', instrumentId: 'smoke-fixture', quotes: [{ price: 123.45, asOf: fixtureTime }], bars }));
      demand(r.data.accepted.bars === 40, 'Fixture ingestion count mismatch.');
    });
    await check('own stored quotes and analytics require no upstream access', async () => {
      const q = requireOkay(await call('/api/v1/quotes?instrumentId=smoke-fixture'));
      demand(q.data.asOf === fixtureTime && q.meta.freshness === 'imported', 'Fixture timestamp/freshness changed.');
      const a = requireOkay(await call('/api/v1/indicators?instrumentId=smoke-fixture&interval=1m'));
      demand(a.data.ema20 === 100 && a.data.rsi14 === 50 && upstreamCalls === 0, 'Own analytics made an upstream request or returned invalid results.');
      return { upstreamCalls, sourceTimestampPreserved: true };
    });
    await check('actual HTTP SSE delivers a new own-database ingestion', async () => {
      const controller = new AbortController();
      const expiry = setTimeout(() => controller.abort(), 7000);
      let reader;
      try {
        const response = await httpFetch(base + '/api/v1/stream?instrumentId=smoke-fixture', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        demand(response.status === 200 && response.headers.get('content-type').includes('text/event-stream'), 'SSE failed to start.');
        reader = response.body.getReader();
        let text = new TextDecoder().decode((await reader.read()).value);
        requireOkay(await call('/api/v1/ingest', { sourceId: 'smoke-owned-fixture', instrumentId: 'smoke-fixture', quotes: [{ price: 124.45, asOf: new Date(Date.now() - 1000).toISOString() }] }));
        while (!text.includes('"price":124.45')) { const part = await reader.read(); if (part.done) break; text += new TextDecoder().decode(part.value); }
        demand(text.includes('"price":124.45'), 'The new observation did not reach the local stream.');
        demand(upstreamCalls === 0, 'Own SSE triggered an upstream request.');
      } finally { clearTimeout(expiry); await reader?.cancel().catch(() => {}); controller.abort(); }
    });
    await check('missing stock feed is reported without fabricated prices', async () => {
      if (providerConfig.alpacaKey && providerConfig.alpacaSecret) return { configured: true, separatelyProbed: false };
      const r = await call('/api/v1/connectors/quotes?provider=alpaca&symbol=AAPL');
      demand(r.status === 503 && r.error?.code === 'requires_key' && r.data === null, 'Missing stock source was not represented honestly.');
    });
    if (includeLive) {
      await check('real Kraken BTC/USD trade through the HTTP connector', async () => {
        const r = requireOkay(await call('/api/v1/connectors/quotes?provider=kraken&symbol=BTC%2FUSD'));
        demand(Number.isFinite(r.data.price) && r.data.price > 0 && Date.parse(r.data.asOf) <= Date.now() + 1000, 'Invalid real trade observation.');
        report.marketObservations.push({ source: 'Kraken', symbol: r.data.symbol, price: r.data.price, currency: r.data.currency, asOf: r.data.asOf, retrievedAt: r.data.receivedAt });
        return { actualTradeTimestamp: r.data.asOf, feed: r.meta.feed };
      }, { optional: true });
      await check('real Kraken bars through HTTP preserve provisional candles', async () => {
        const r = requireOkay(await call('/api/v1/connectors/bars?provider=kraken&symbol=BTC%2FUSD&interval=1m&limit=40'));
        demand(r.data.bars.length > 0 && r.data.bars.some(bar => bar.complete === false), 'Expected recent source bars and final provisional candle.');
        return { bars: r.data.bars.length, earliest: r.data.bars[0].time, lastBarStart: r.data.bars.at(-1).time };
      }, { optional: true });
      await check('real source ingestion into own warehouse and subsequent offline-style read', async () => {
        requireOkay(await call('/api/v1/sources', { id: 'kraken', label: 'Kraken bounded internal verification', kind: 'provider', canRetain: true, retentionUntil: new Date(Date.now() + 120000).toISOString(), provenanceUrl: 'https://docs.kraken.com/' }));
        requireOkay(await call('/api/v1/instruments', { id: 'kraken-btc-usd', symbol: 'BTC/USD', name: 'Bitcoin / US dollar on Kraken', assetType: 'crypto', currency: 'USD', listingVenue: 'Kraken' }));
        const collected = requireOkay(await call('/api/v1/collect', { provider: 'kraken', sourceId: 'kraken', instrumentId: 'kraken-btc-usd', symbol: 'BTC/USD' }));
        demand(collected.data.accepted.quotes === 1, 'The real observation was not stored.');
        const before = upstreamCalls;
        const own = requireOkay(await call('/api/v1/quotes?instrumentId=kraken-btc-usd'));
        demand(own.meta.storage === 'nortivo_warehouse' && before === upstreamCalls, 'Stored read depended on an upstream call.');
        return { feed: own.meta.feed, asOf: own.data.asOf, upstreamCallsForStoredRead: 0 };
      }, { optional: true });
      await check('real ECB USD/NOK daily reference conversion', async () => {
        const r = requireOkay(await call('/api/v1/connectors/fx?base=USD&quote=NOK'));
        demand(r.data.rate > 0 && r.data.live === false && r.data.observationDate, 'Invalid daily reference-rate metadata.');
        report.marketObservations.push({ source: 'ECB', pair: 'USD/NOK', rate: r.data.rate, observationDate: r.data.observationDate, live: false });
        return { observationDate: r.data.observationDate, live: false };
      }, { optional: true });
      await check('real Federal Reserve release headlines', async () => {
        const r = requireOkay(await call('/api/v1/connectors/news?limit=5'));
        demand(r.data.length > 0, 'No dated headlines returned.'); return { records: r.data.length };
      }, { optional: true });
      await check('real BLS scheduled release calendar', async () => {
        const r = requireOkay(await call('/api/v1/connectors/events?limit=10'));
        return { records: r.data.length, coverage: r.meta.coverage };
      }, { optional: true });
      if (!providerConfig.alpacaKey || !providerConfig.alpacaSecret) report.checks.push({ name: 'real live US stock feed', status: 'blocked', reason: 'No incoming stock feed or Alpaca credentials supplied. No stock prices fabricated.' });
      else await check('real live US stock feed', async () => { const r = requireOkay(await call('/api/v1/connectors/quotes?provider=alpaca&symbol=AAPL')); return { feed: r.meta.feed, asOf: r.data.asOf }; }, { optional: true });
      if (!providerConfig.secUserAgent) report.checks.push({ name: 'real SEC filings/fundamentals', status: 'blocked', reason: 'SEC_USER_AGENT with a real operator contact email is not configured.' });
      if (!providerConfig.fredKey) report.checks.push({ name: 'real FRED economic observations', status: 'blocked', reason: 'FRED_API_KEY is not configured.' });
    }
  } catch (error) { report.checks.push({ name: 'local HTTP runtime', status: 'failed', reason: error.cause?.code || error.code || error.message }); }
  finally { await app.close(); }
  report.summary = Object.fromEntries(['passed', 'failed', 'blocked'].map(status => [status, report.checks.filter(check => check.status === status).length]));
  return report;
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runSmoke({ includeLive: !process.argv.includes('--offline'), providerConfig: { alpacaKey: process.env.APCA_API_KEY_ID || '', alpacaSecret: process.env.APCA_API_SECRET_KEY || '', secUserAgent: process.env.SEC_USER_AGENT || '', fredKey: process.env.FRED_API_KEY || '' } });
  console.log(JSON.stringify(report, null, 2));
  if (report.summary.failed) process.exitCode = 1;
}
