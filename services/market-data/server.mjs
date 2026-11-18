import http from 'node:http';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ApiError, sameSecret, errorBody, integer, dateValue, validSymbol } from './core.mjs';
import { readConfig } from './config.mjs';
import { createStore } from './store.mjs';
import { createWarehouse } from './warehouse.mjs';
import { createTransport } from './transport.mjs';
import { capabilities } from './capabilities.mjs';
import { indicators } from './analytics.mjs';
import { createKraken } from './providers/kraken.mjs';
import { createAlpaca } from './providers/alpaca.mjs';
import { createSec } from './providers/sec.mjs';
import { createFred } from './providers/fred.mjs';
import { createEcb } from './providers/ecb.mjs';
import { createPublicFeeds } from './providers/public-feeds.mjs';

const VERSION = '0.1.0';
async function jsonBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new ApiError('invalid_request', 'Use application/json for request bodies.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.byteLength;
    if (size > 1_000_000) throw new ApiError('invalid_request', 'Request bodies must be under 1 MB.', 413);
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ApiError('invalid_request', 'Supply a JSON object.', 400); }
}

function query(url, allowed) {
  for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length > 1) throw new ApiError('invalid_request', 'An unknown or repeated query parameter was supplied.', 400);
  return Object.fromEntries(url.searchParams);
}
function selection(params) {
  if (!params.instrumentId && !params.symbol) throw new ApiError('invalid_request', 'Supply instrumentId or an unambiguous symbol.', 400);
  return {
    ...(params.instrumentId ? { instrumentId: params.instrumentId } : {}),
    ...(params.symbol ? { symbol: validSymbol(params.symbol) } : {}),
    ...(params.sourceId ? { sourceId: params.sourceId } : {}),
  };
}
function range(params, defaultLimit = 100) {
  const start = dateValue(params.start, 'start', { timestamp: true }), end = dateValue(params.end, 'end', { timestamp: true });
  if (start && end && (Date.parse(start) > Date.parse(end) || (start === end && start.includes('T')))) throw new ApiError('invalid_request', 'start must not follow end; exact timestamp bounds must differ.', 400);
  return { start, end, interval: params.interval || '1d', adjustment: params.adjustment || 'raw', limit: integer(params.limit, { max: 1000, fallback: defaultLimit }) };
}

export function createApi({ config, fetcher = fetch, clock = Date.now, store: suppliedStore, warehouse: suppliedWarehouse } = {}) {
  if (!config?.apiToken || config.apiToken.length < 32) throw new ApiError('requires_configuration', 'A protected local API token is required.', 503);
  const store = suppliedStore || createStore({ path: config.cachePath || ':memory:', clock });
  const warehouse = suppliedWarehouse || createWarehouse({ path: config.warehousePath || ':memory:', clock });
  const transport = createTransport({ store, fetcher, clock });
  const providers = {
    kraken: createKraken({ transport, clock }),
    alpaca: createAlpaca({ transport, clock, apiKey: config.alpacaKey, apiSecret: config.alpacaSecret }),
    sec: createSec({ transport, clock, userAgent: config.secUserAgent }),
    fred: createFred({ transport, clock, apiKey: config.fredKey }),
    ecb: createEcb({ transport, clock }),
    publicFeeds: createPublicFeeds({ transport, clock }),
  };
  const updates = new EventEmitter(); updates.setMaxListeners(30);
  const streams = new Set(), collectors = new Map(), startingCollectors = new Set();
  let windowStart = 0, requestCount = 0, stopped = false;
  const openapi = JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'));

  const respond = (res, status, body, requestId) => {
    const output = { ...body, meta: { ...(body.meta || {}), requestId, servedAt: new Date(clock()).toISOString() } };
    const text = JSON.stringify(output);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId });
    res.end(text);
  };
  function pick(provider) {
    if (!['kraken', 'alpaca'].includes(provider)) throw new ApiError('invalid_request', 'Choose provider=kraken or provider=alpaca for this optional connector.', 400);
    return providers[provider];
  }
  function publish(instrumentId) { updates.emit('update', instrumentId); }

  async function collect(input) {
    const allowed = ['provider', 'sourceId', 'instrumentId', 'symbol', 'dataset', 'interval', 'limit', 'start', 'end', 'adjustment'];
    for (const key of Object.keys(input)) if (!allowed.includes(key)) throw new ApiError('invalid_request', 'Unknown collection setting.', 400);
    const adapter = pick(input.provider);
    if (input.sourceId !== input.provider) throw new ApiError('invalid_request', 'Collection sourceId must match the provider name. Register that source with retention permission first.', 400);
    const source = warehouse.sources().find(item => item.id === input.sourceId);
    if (!source || source.kind !== 'provider' || source.canRetain !== true || source.expired) throw new ApiError('requires_configuration', 'Register this provider source with current permitted retention before collecting.', 503);
    const selected = warehouse.instrument({ instrumentId: input.instrumentId, symbol: validSymbol(input.symbol) });
    if (input.provider === 'alpaca' && !['XNAS', 'XNYS', 'ARCX', 'BATS', 'XASE', 'IEXG'].includes(selected.listingVenue)) throw new ApiError('invalid_request', 'Alpaca collection requires an explicitly registered supported US listing MIC. Cross-market ticker matches are not inferred.', 400);
    if (input.provider === 'kraken' && selected.assetType !== 'crypto') throw new ApiError('invalid_data', 'Crypto data cannot be ingested into a stock instrument.', 422);
    if (input.provider === 'alpaca' && !['stock', 'etf'].includes(selected.assetType)) throw new ApiError('invalid_data', 'Stock data cannot be ingested into another asset class.', 422);
    const dataset = input.dataset || 'quote';
    if (!['quote', 'bars'].includes(dataset)) throw new ApiError('invalid_request', 'Choose quote or bars for dataset.', 400);
    if (input.provider === 'kraken' && input.adjustment && input.adjustment !== 'raw') throw new ApiError('not_supported', 'Kraken supplies raw crypto bars; another adjustment cannot be requested or stored.', 400);
    if (input.provider === 'kraken' && input.interval && !['1m', '5m', '15m', '1h', '1d'].includes(input.interval)) throw new ApiError('not_supported', 'This interval is not supported by the Nortivo warehouse.', 400);
    const result = dataset === 'quote' ? await adapter.quote({ symbol: selected.symbol }) : await adapter.bars({ symbol: selected.symbol, ...range(input) });
    if (result.data.currency !== selected.currency) throw new ApiError('invalid_data', 'Provider and stored instrument currencies differ.', 422);
    const eventTime = typeof result.data.sourceTimestamp === 'string' && result.data.sourceTimestamp.endsWith('Z') ? result.data.sourceTimestamp : result.data.asOf;
    const quotes = dataset === 'quote' ? [{ asOf: eventTime, price: result.data.price, feed: result.meta.feed, venue: result.data.venue || result.meta.feed, delaySeconds: result.meta.delaySeconds ?? null }] : [];
    const bars = dataset === 'bars' ? (result.data.bars || []).map(bar => ({ time: bar.time, interval: input.interval || '1d', adjustment: input.adjustment || 'raw', open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume, complete: bar.complete })) : [];
    const saved = warehouse.ingest({ sourceId: input.sourceId, instrumentId: selected.id, quotes, bars });
    publish(selected.id);
    return { data: { ...saved, instrumentId: selected.id, dataset }, meta: { ...result.meta, storedInNortivo: true } };
  }

  function collectorState(row) {
    return { id: row.id, provider: row.settings.provider, instrumentId: row.settings.instrumentId, everySeconds: row.everySeconds, startedAt: row.startedAt, lastSuccessAt: row.lastSuccessAt, lastError: row.lastError, running: !stopped };
  }
  async function startCollector(body) {
    const everySeconds = integer(body.everySeconds, { name: 'everySeconds', min: 10, max: 3600, fallback: 10 });
    if (collectors.size + startingCollectors.size >= 3) throw new ApiError('capacity_limit', 'At most three local collectors may run concurrently.', 429);
    const { everySeconds: _, ...settings } = body;
    if (settings.dataset && settings.dataset !== 'quote') throw new ApiError('invalid_request', 'Continuous collectors currently support quotes only.', 400);
    if (startingCollectors.has(settings.instrumentId) || [...collectors.values()].some(row => row.settings.instrumentId === settings.instrumentId)) throw new ApiError('invalid_request', 'A collector is already starting or running for this instrument.', 409);
    startingCollectors.add(settings.instrumentId);
    try { await collect(settings); } // A collector is not reported running until its first real ingestion succeeds.
    catch (error) { startingCollectors.delete(settings.instrumentId); throw error; }
    const row = { id: randomUUID(), settings, everySeconds, busy: false, startedAt: new Date(clock()).toISOString(), lastSuccessAt: new Date(clock()).toISOString(), lastError: null };
    row.timer = setInterval(async () => {
      if (row.busy || stopped) return;
      row.busy = true;
      try { await collect(settings); row.lastSuccessAt = new Date(clock()).toISOString(); row.lastError = null; }
      catch (error) { row.lastError = { code: error instanceof ApiError ? error.code : 'internal_error', at: new Date(clock()).toISOString() }; }
      finally { row.busy = false; }
    }, everySeconds * 1000);
    row.timer.unref(); collectors.set(row.id, row); startingCollectors.delete(settings.instrumentId);
    return { data: collectorState(row), meta: { lifecycle: 'Local process only; collectors stop when this service stops. No hosted automation or paid subscription is created.' } };
  }

  const handler = async (req, res) => {
    const requestId = randomUUID();
    try {
      if ((req.url || '').length > 2048) throw new ApiError('invalid_request', 'The request URL is too long.', 414);
      const host = req.headers.host || '';
      if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(host)) throw new ApiError('forbidden', 'This service accepts loopback hostnames only.', 403);
      if (req.headers.origin || req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError('forbidden', 'Browser-origin access is disabled until a site integration is approved.', 403);
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/health' && req.method === 'GET') { respond(res, 200, { data: { service: 'Nortivo Data Engine', version: VERSION, status: stopped ? 'stopping' : 'ready', siteConnected: false } }, requestId); return; }
      const auth = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization || '');
      if (!auth || !sameSecret(auth[1], config.apiToken)) throw new ApiError('unauthorized', 'A valid bearer token is required.', 401);
      if (clock() - windowStart >= 60000) { windowStart = clock(); requestCount = 0; }
      if (++requestCount > 180) throw new ApiError('rate_limited', 'The local API allowance is 180 requests per minute.', 429, { retryAfterSeconds: 60 });
      const route = url.pathname;
      let result, status = 200;
      if (req.method === 'GET') {
        if (route === '/api/v1/openapi.json') {
          query(url, []); const text = JSON.stringify(openapi); res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(text); return;
        }
        if (route === '/api/v1' || route === '/api/v1/capabilities') { query(url, []); result = { data: capabilities(config) }; }
        else if (route === '/api/v1/status') { query(url, []); result = { data: { warehouse: warehouse.stats(), connections: transport.stats(), collectors: [...collectors.values()].map(collectorState), siteConnected: false }, meta: { connectionHealth: 'Upstream HTTP success is not proof of complete data coverage or public display rights.' } }; }
        else if (route === '/api/v1/sources') { query(url, []); result = { data: warehouse.sources() }; }
        else if (route === '/api/v1/instruments') { const p = query(url, ['q', 'limit']); result = { data: warehouse.instruments({ q: p.q || '', limit: integer(p.limit, { max: 500, fallback: 50 }) }), meta: { source: 'Nortivo warehouse', upstreamRequest: false } }; }
        else if (route === '/api/v1/quotes') { const p = query(url, ['instrumentId', 'symbol', 'sourceId']); result = warehouse.quote(selection(p)); }
        else if (route === '/api/v1/bars' || route === '/api/v1/indicators') { const p = query(url, ['instrumentId', 'symbol', 'sourceId', 'interval', 'adjustment', 'start', 'end', 'limit']); result = warehouse.bars({ ...selection(p), ...range(p, route.endsWith('indicators') ? 200 : 100) }); if (route.endsWith('indicators')) result = indicators(result, { clock }); }
        else if (route === '/api/v1/collectors') { query(url, []); result = { data: [...collectors.values()].map(collectorState) }; }
        else if (route === '/api/v1/stream') {
          const p = query(url, ['instrumentId', 'symbol', 'sourceId']); const selected = selection(p);
          if (streams.size >= 20) throw new ApiError('capacity_limit', 'At most twenty local streams may be open.', 429);
          const initial = warehouse.quote(selected); // Resolve ambiguity/auth/data before sending SSE headers.
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' });
          res.flushHeaders(); streams.add(res);
          const send = () => { try { res.write(`event: quote\ndata: ${JSON.stringify(warehouse.quote(selected))}\n\n`); } catch (error) { res.write(`event: data_error\ndata: ${JSON.stringify(errorBody(error, requestId))}\n\n`); } };
          res.write(`event: quote\ndata: ${JSON.stringify(initial)}\n\n`);
          const onUpdate = id => { if (id === initial.data.instrumentId) send(); };
          updates.on('update', onUpdate);
          const heartbeat = setInterval(() => { if (res.writableLength > 1000000) res.destroy(); else res.write(': heartbeat\n\n'); }, 15000); heartbeat.unref();
          const expiry = setTimeout(() => res.end(), 600000); expiry.unref();
          res.on('close', () => { clearInterval(heartbeat); clearTimeout(expiry); updates.off('update', onUpdate); streams.delete(res); });
          return;
        }
        else if (route === '/api/v1/connectors/instruments') { const p = query(url, ['provider', 'q', 'limit']); if (!['sec', 'kraken'].includes(p.provider)) throw new ApiError('invalid_request', 'Choose provider=sec or provider=kraken.', 400); result = await providers[p.provider].instruments({ q: p.q || '', limit: integer(p.limit, { max: 500, fallback: 50 }) }); }
        else if (route === '/api/v1/connectors/quotes') { const p = query(url, ['provider', 'symbol']); result = await pick(p.provider).quote({ symbol: validSymbol(p.symbol) }); }
        else if (route === '/api/v1/connectors/bars' || route === '/api/v1/connectors/indicators') { const p = query(url, ['provider', 'symbol', 'interval', 'limit', 'start', 'end', 'adjustment', 'pageToken']); result = await pick(p.provider).bars({ symbol: validSymbol(p.symbol), ...range(p, route.endsWith('indicators') ? 200 : 100), ...(p.pageToken ? { pageToken: p.pageToken } : {}) }); if (route.endsWith('indicators')) result = indicators(result, { clock }); }
        else if (['/api/v1/connectors/companies', '/api/v1/connectors/filings', '/api/v1/connectors/fundamentals'].includes(route)) { const p = query(url, ['symbol', 'cik', 'form', 'limit', 'asOf']); const args = { ...p, limit: integer(p.limit, { max: 500, fallback: 100 }) }; const method = route.split('/').at(-1) === 'companies' ? 'company' : route.split('/').at(-1); result = await providers.sec[method](args); }
        else if (route === '/api/v1/connectors/economic-series') { const p = query(url, ['seriesId', 'start', 'end', 'asOf', 'limit']); result = await providers.fred.series({ ...p, limit: integer(p.limit, { max: 1000, fallback: 1000 }) }); }
        else if (route === '/api/v1/connectors/fx') { const p = query(url, ['base', 'quote', 'date']); result = await providers.ecb.fx(p); }
        else if (route === '/api/v1/connectors/news') { const p = query(url, ['limit']); result = await providers.publicFeeds.news({ limit: integer(p.limit, { max: 100, fallback: 30 }) }); }
        else if (route === '/api/v1/connectors/events') { const p = query(url, ['start', 'end', 'limit']); result = await providers.publicFeeds.events({ ...p, limit: integer(p.limit, { max: 200, fallback: 100 }) }); }
        else if (['/api/v1/insiders', '/api/v1/institutional', '/api/v1/fund-holdings', '/api/v1/corporate-actions', '/api/v1/esg'].includes(route)) throw new ApiError('not_supported', 'This parsed dataset is not implemented. See capabilities; SEC filing discovery is available separately.', 501);
        else throw new ApiError('not_found', 'This API route does not exist.', 404);
      } else if (req.method === 'POST') {
        query(url, []);
        if (!['/api/v1/sources', '/api/v1/instruments', '/api/v1/ingest', '/api/v1/collect', '/api/v1/collectors'].includes(route)) throw new ApiError('not_found', 'This API route does not exist.', 404);
        const body = await jsonBody(req);
        if (route === '/api/v1/sources') { result = { data: warehouse.registerSource(body) }; status = 201; }
        else if (route === '/api/v1/instruments') { result = { data: warehouse.upsertInstrument(body) }; status = 201; }
        else if (route === '/api/v1/ingest') { result = { data: warehouse.ingest(body), meta: { source: 'Nortivo warehouse', upstreamRequest: false } }; publish(body.instrumentId); status = 201; }
        else if (route === '/api/v1/collect') { result = await collect(body); status = 201; }
        else { result = await startCollector(body); status = 201; }
      } else if (req.method === 'DELETE' && /^\/api\/v1\/collectors\/[a-f0-9-]{36}$/.test(route)) {
        query(url, []); const id = route.split('/').at(-1), row = collectors.get(id);
        if (!row) throw new ApiError('not_found', 'This collector does not exist.', 404);
        clearInterval(row.timer); collectors.delete(id); result = { data: { id, stopped: true } };
      } else throw new ApiError('method_not_allowed', 'This method is not supported for the route.', 405);
      respond(res, status, result, requestId);
    } catch (error) {
      if (!res.headersSent) {
        if (error.details?.retryAfterSeconds) res.setHeader('Retry-After', error.details.retryAfterSeconds);
        if (error.status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
        respond(res, error instanceof ApiError ? error.status : 500, errorBody(error, requestId), requestId);
      } else res.end();
    }
  };
  const server = http.createServer(handler);
  server.requestTimeout = 20000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  return {
    server, handler, providers, transport, store, warehouse,
    async close() {
      if (stopped) return; stopped = true;
      for (const row of collectors.values()) clearInterval(row.timer);
      for (const stream of streams) stream.end();
      if (server.listening) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
      store.close(); warehouse.close();
    },
  };
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readConfig(), app = createApi({ config });
  app.server.listen(config.port, config.host, () => {
    console.log(`Nortivo Data Engine ${VERSION}: http://${config.host}:${config.port}`);
    console.log(`Bearer token: ${config.tokenFile} (or DATA_API_TOKEN when explicitly set).`);
    console.log('Local warehouse active. Site integration disabled. No provider account, paid resource, or trade created.');
  });
  app.server.on('error', error => { console.error(`Server startup failed: ${error.code || 'unknown'}`); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exitCode = 0; });
}
