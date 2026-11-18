import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createDataProviders, normalizeCatalog, normalizeQuote, normalizeEconomicCalendar, normalizeCandles } from '../netlify/product/providers-data.mjs';
import { createProviderTransport, rightsFor, SYSTEM_OWNER, change, listAllRecords } from '../netlify/product/providers-core.mjs';
import { getIntegrationReadiness, handleIntegrations } from '../netlify/product/providers.mjs';
import { reserveAi, settleAi, getAiUsage, explainAi, buildAiEvidence } from '../netlify/product/ai.mjs';
import { encryptBrokerToken, decryptBrokerToken, createBrokerClient, connectBroker, handleBrokerCallback, brokerControl, syncBroker } from '../netlify/product/broker.mjs';
import { approvalBytes, liveRelease } from '../netlify/product/broker-release.mjs';
import { acquireAccountLease, assertAccountLease, enqueueOrder, mergeBrokerOrder, validateRisk, processOrder, reconcileIntent } from '../netlify/product/execution.mjs';
import { backtestStrategy, signals } from '../netlify/product/execution-strategy.mjs';
import { runAccountTick, createDurableWorker } from '../netlify/product/worker.mjs';
import { createPortfolio, applyPortfolioCommand } from '../netlify/product/portfolio.mjs';

// All upstream responses in this file are explicit fixtures. These tests do not establish provider connectivity.
const USER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';
const NOW = Date.now(), ORIGIN = 'https://nortivo.test';
const approved = (provider, markets = ['US']) => ({ provider, documentRef: 'fixture-approved-contract', validUntil: '2099-01-01T00:00:00Z', externalDisplay: true, markets, cacheSeconds: 300, nonDisplay: true, aiProcessing: true, delayMinutes: 0, coverage: 'Fixture US subset' });
const ENV = { TWELVE_DATA_API_KEY: 'fixture-not-a-key', FINNHUB_API_KEY: 'fixture-not-a-key', TRADING_ECONOMICS_API_KEY: 'fixture-not-a-key', PRODUCT_PROVIDER_RIGHTS_JSON: JSON.stringify({ market: approved('twelve'), news: approved('finnhub'), calendar: approved('tradingeconomics', ['global']), fx: approved('twelve', ['FX']) }), PRODUCT_BROKER_TOKEN_KEY: Buffer.alloc(32, 9).toString('base64'), ALPACA_OAUTH_CLIENT_ID: 'fixture-client', ALPACA_OAUTH_CLIENT_SECRET: 'fixture-not-secret', ALPACA_OAUTH_REDIRECT_URI: `${ORIGIN}/.netlify/functions/terminal?action=product-broker-callback`, PRODUCT_ALPACA_PAPER_COMMERCIAL_APPROVAL: 'true', PRODUCT_ALPACA_APPROVAL_REFERENCE: 'fixture-paper-approval', OPENAI_API_KEY: 'fixture-not-an-api-key' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
async function fixture(t, env = ENV) {
  const legacy = await createLocalStore(':memory:'); t.after(() => legacy.close());
  const ctx = { store: legacy.product, user: { id: USER }, account: { emailVerified: true, billing: { tier: 'pro', paidUntil: NOW + 86400000 } }, env, now: NOW, origin: ORIGIN, requireFeature: async () => {}, requireStepUp: async () => {}, fetcher: async () => { throw new Error('Unexpected fixture network request'); } };
  return ctx;
}
async function put(ctx, ns, key, value, ownerId = USER) { const row = await ctx.store.get(ns, key); const result = await ctx.store.transact([change(ns, key, ownerId, row, value)]); assert.equal(result.status, 'applied'); }
function connection(ctx, mode = 'paper') { const c = { id: 'conn-test', ownerId: USER, accountId: 'account-12345', accountLabel: 'Fixture account', mode, status: 'connected', automationEnabled: true, strategyVersion: 1, risk: { maxOrderNotional: '1000', maxPositionNotional: '5000', maxDailyLoss: '500', maxOrdersPerDay: 10 } }; c.token = encryptBrokerToken({ accessToken: 'fixture-token' }, USER, c.id, ctx.env, mode); return c; }
function intent() { return { id: 'test-order-001', clientOrderId: 'ntv-fixture-001', connectionId: 'conn-test', accountId: 'account-12345', instrumentId: 'XNAS:AAPL:USD', symbol: 'AAPL', venue: 'XNAS', mode: 'paper', side: 'buy', quantity: '2', type: 'market', status: 'pending', filledQuantity: '0', createdAt: NOW, expiresAt: NOW + 120000 }; }
const event = (status, filled = '0', timestamp = NOW) => ({ id: 'broker-order-123', client_order_id: 'ntv-fixture-001', symbol: 'AAPL', side: 'buy', qty: '2', filled_qty: filled, status, updated_at: new Date(timestamp).toISOString() });
function quote(time = NOW) { return { instrumentId: 'XNAS:AAPL:USD', price: '100', freshness: 'current', executionEligible: true, asOf: new Date(time).toISOString() }; }
function account() { return { id: 'account-12345', status: 'ACTIVE', buying_power: '10000', equity: '10000', last_equity: '10000', cash: '10000', currency: 'USD' }; }

test('credentials alone never authorize commercial display or claim a verified connection', async t => {
  const ctx = await fixture(t, { TWELVE_DATA_API_KEY: 'fixture' }); let calls = 0;
  const providers = createDataProviders(ctx.env, async () => { calls++; return json({}); }, ctx.store);
  await assert.rejects(providers.catalog({ q: 'AAPL' }), { code: 'COMMERCIAL_PERMISSION_REQUIRED' });
  assert.equal(calls, 0); const states = await getIntegrationReadiness(ctx);
  assert.equal(states.market.configured, true); assert.equal(states.market.permissionsReady, false); assert.equal(states.market.reachable, null);
});
test('instrument catalog filters unsupported currencies/assets and preserves venue disambiguation', () => {
  const data = { data: [{ symbol: 'ABC', instrument_name: 'One', country: 'United States', currency: 'USD', mic_code: 'XNAS', instrument_type: 'Common Stock' }, { symbol: 'ABC', instrument_name: 'Two', country: 'United States', currency: 'USD', mic_code: 'XNYS', instrument_type: 'ETF' }, { symbol: 'ABC', country: 'United States', currency: 'EUR', mic_code: 'XNAS', instrument_type: 'Common Stock' }] };
  assert.deepEqual(normalizeCatalog(data).map(x => x.id), ['XNAS:ABC:USD', 'XNYS:ABC:USD']);
});
test('quote freshness distinguishes delay, stale and market closed; exact venue is checked', () => {
  const p = { symbol: 'AAPL', currency: 'USD', mic_code: 'XNAS', close: '100.1234', timestamp: Math.floor(NOW / 1000), is_market_open: true }, i = { id: 'XNAS:AAPL:USD', symbol: 'AAPL', venue: 'XNAS' }, rights = { delayMinutes: 0, nonDisplay: true };
  assert.equal(normalizeQuote(p, i, { now: NOW, rights }).freshness, 'current');
  assert.equal(normalizeQuote({ ...p, timestamp: Math.floor((NOW - 300000) / 1000) }, i, { now: NOW, rights }).freshness, 'stale');
  assert.equal(normalizeQuote({ ...p, is_market_open: false }, i, { now: NOW, rights }).freshness, 'market_closed');
  assert.equal(normalizeQuote(p, i, { now: NOW, rights: { ...rights, delayMinutes: 15 } }).freshness, 'delayed');
  assert.throws(() => normalizeQuote({ ...p, mic_code: 'XNYS' }, i, { now: NOW, rights }), { code: 'PROVIDER_INVALID_DATA' });
});
test('cache hits spend no upstream credits; actual HTTP failures consume credits and enforce backoff', async t => {
  const ctx = await fixture(t); let calls = 0;
  const transport = createProviderTransport({ env: ctx.env, store: ctx.store, clock: () => NOW, fetcher: async () => { calls++; return json({ ok: true }); } });
  const options = { provider: 'twelve', capability: 'market', url: 'https://fixture.test/quote', rights: rightsFor(ctx.env, 'market', 'twelve'), ttl: 30, normalize: p => ({ success: p.ok }) };
  assert.equal((await transport.request(options)).cacheHit, false); assert.equal((await transport.request(options)).cacheHit, true); assert.equal(calls, 1);
  const meter = await ctx.store.list('provider_meter', { ownerId: SYSTEM_OWNER }); assert.equal(meter[0].value.upstreamUnits, 1);
  const failing = createProviderTransport({ env: ctx.env, store: ctx.store, clock: () => NOW, fetcher: async () => { calls++; return json({ error: 'private upstream text' }, 429); } });
  await assert.rejects(failing.request({ ...options, url: 'https://fixture.test/failure' }), { code: 'PROVIDER_RATE_LIMIT' });
  await assert.rejects(failing.request({ ...options, url: 'https://fixture.test/failure' }), { code: 'PROVIDER_BACKOFF' });
  assert.equal(calls, 2); assert.equal((await ctx.store.list('provider_meter', { ownerId: SYSTEM_OWNER }))[0].value.upstreamUnits, 2);
});
test('economic events preserve provider IDs/revisions/missing values and UTC precision across DST', () => {
  const rows = [{ CalendarId: '42', Date: '2026-10-25T01:30:00', Event: 'CPI', Country: 'Norway', Actual: '', Forecast: '2.5%', Previous: '2.4%', Revised: '2.3%', DateSpan: '1', Importance: 3, LastUpdate: '2026-10-25T02:00:00', URL: '/norway/inflation-cpi' }];
  const e = normalizeEconomicCalendar(rows)[0]; assert.equal(e.id, 'te:42'); assert.equal(e.time, '2026-10-25T01:30:00.000Z'); assert.equal(e.actual, null); assert.equal(e.consensus, '2.5%'); assert.equal(e.revised, '2.3%'); assert.equal(e.estimatedTime, true);
});
test('AI allowance reservations are atomic across tabs, requests are idempotent, settlement refunds unused tokens', async t => {
  const ctx = await fixture(t); const requests = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => reserveAi(ctx, { requestId: `request-${i}`, digest: `digest-${i}`, inputBound: 100, outputBound: 100, tier: 'portfolio' })));
  assert.equal(requests.filter(x => x.status === 'fulfilled').length, 30); assert.equal((await getAiUsage(ctx, 'portfolio')).remainingRequests, 0);
  const replay = await reserveAi(ctx, { requestId: 'request-0', digest: 'digest-0', inputBound: 100, outputBound: 100, tier: 'portfolio' }); assert.equal(replay.replay, true);
  await assert.rejects(reserveAi(ctx, { requestId: 'request-0', digest: 'changed', inputBound: 100, outputBound: 100, tier: 'portfolio' }), { code: 'IDEMPOTENCY_CONFLICT' });
  await settleAi(ctx, 'request-0', { state: 'completed', inputTokens: 10, outputTokens: 20 }); assert.equal((await getAiUsage(ctx, 'portfolio')).remainingTokens, 150000 - 29 * 200 - 30);
});
test('AI unknown timeout remains charged and cannot trigger a duplicate provider call on same ID', async t => {
  const ctx = await fixture(t); let calls = 0; ctx.fetcher = async () => { calls++; throw new Error('fixture timeout'); };
  const body = { requestId: 'explanation-123', question: 'Explain diversification', kind: 'basic' };
  await assert.rejects(explainAi(ctx, body, {}), { code: 'AI_PROVIDER_UNAVAILABLE' }); await assert.rejects(explainAi(ctx, body, {}), { code: 'AI_REQUEST_FAILED' });
  assert.equal(calls, 1); assert.equal((await getAiUsage(ctx, 'pro')).remainingRequests, 199);
});
test('AI source IDs are server-authorized, credentials stay server-side, private account context is isolated', async t => {
  const ctx = await fixture(t); await put(ctx, 'portfolios', `${OTHER}:private`, { id: 'private', notes: 'private data' }, OTHER);
  await assert.rejects(explainAi(ctx, { requestId: 'private-attempt', question: 'Explain holdings', portfolioId: 'private' }, {}), { code: 'NOT_FOUND' });
  ctx.fetcher = async (url, options) => { assert.equal(url, 'https://api.openai.com/v1/responses'); const input = JSON.parse(options.body); assert.equal(input.store, false); assert.equal(input.tools, undefined); assert.match(input.instructions, /untrusted/); return json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ text: 'Diversification spreads exposure.', citations: ['invented'], uncertainty: '' }) }] }], usage: { input_tokens: 100, output_tokens: 20 } }); };
  await assert.rejects(explainAi(ctx, { requestId: 'bad-citation-123', question: 'Explain diversification' }, {}), { code: 'AI_INVALID_RESPONSE' });
});
test('broker encryption binds actor, connection and paper/live mode; tampering fails closed', () => {
  const encrypted = encryptBrokerToken({ accessToken: 'fixture' }, USER, 'connection1', ENV);
  assert.equal(decryptBrokerToken(encrypted, USER, 'connection1', ENV).accessToken, 'fixture');
  assert.throws(() => decryptBrokerToken(encrypted, OTHER, 'connection1', ENV), { code: 'BROKER_AUTHORIZATION_REQUIRED' });
  assert.throws(() => decryptBrokerToken(encrypted, USER, 'connection1', ENV, 'live'), { code: 'BROKER_AUTHORIZATION_REQUIRED' });
});
test('broker OAuth state is unpredictable, single use, scoped trading only, paper fixed, replay rejected', async t => {
  const ctx = await fixture(t); const started = await connectBroker(ctx, { requestId: 'connect-123', mode: 'paper' }), url = new URL(started.authorizationUrl);
  assert.equal(url.searchParams.get('scope'), 'trading'); assert.equal(url.searchParams.get('env'), 'paper');
  ctx.fetcher = async url => String(url).includes('oauth/token') ? json({ access_token: 'fixture-token', scope: 'trading' }) : json(account());
  const params = { state: url.searchParams.get('state'), code: 'fixture-code' }, result = await handleBrokerCallback(ctx, params);
  assert.equal(result.mode, 'paper'); assert.equal(result.connection.automationEnabled, false); assert.equal(result.connection.token, undefined);
  await assert.rejects(handleBrokerCallback(ctx, params), { code: 'BROKER_OAUTH_INVALID' });
  const existing = await ctx.store.get('broker_connections', `${USER}:${result.connection.id}`);
  await put(ctx, 'broker_connections', existing.key, { ...existing.value, status: 'authorization_required', automationEnabled: true });
  const reconnect = await connectBroker(ctx, { requestId: 'reconnect-123', mode: 'paper' });
  const reconnectUrl = new URL(reconnect.authorizationUrl), restored = await handleBrokerCallback(ctx, { state: reconnectUrl.searchParams.get('state'), code: 'new-fixture-code' });
  assert.equal(restored.connection.id, result.connection.id); assert.equal(restored.connection.automationEnabled, false);
});
test('live flag alone cannot enable transmission; signed approvals bind build, app, country and account', async t => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519'), ctx = await fixture(t, { ...ENV, PRODUCT_LIVE_TRANSMISSION_ENABLED: 'true', PRODUCT_RELEASE_BUILD_ID: 'fixture-build', PRODUCT_BROKER_APPROVAL_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }) });
  assert.equal((await liveRelease(ctx)).enabled, false);
  const sign = value => ({ ...value, signature: crypto.sign(null, approvalBytes(value), privateKey).toString('base64') });
  await put(ctx, 'jobs', 'broker_live_release', sign({ type: 'broker_live_release', appClientId: ENV.ALPACA_OAUTH_CLIENT_ID, buildId: 'fixture-build', commercialApprovalReference: 'fixture-commercial', brokerApprovalReference: 'fixture-broker', securityReviewReference: 'fixture-security', sandboxEvidenceReference: 'fixture-sandbox', countries: ['NO'], automationApproved: true, verifiedAt: NOW, expiresAt: NOW + 86400000 }), SYSTEM_OWNER);
  assert.equal((await liveRelease(ctx)).enabled, true);
  const c = connection(ctx, 'live'); c.liveConsent = { acceptedAt: NOW, accountId: c.accountId };
  await put(ctx, 'jobs', `broker_eligibility:${c.accountId}`, sign({ type: 'broker_account_eligibility', ownerId: USER, accountId: c.accountId, country: 'NO', brokerApprovalReference: 'fixture-approved-norway', automationApproved: true, verifiedAt: NOW, expiresAt: NOW + 86400000 }));
  let called = 0; const broker = createBrokerClient(ctx.env, async url => { called++; assert.match(url, /^https:\/\/api\.alpaca\.markets\/v2\/orders$/); return json(event('accepted')); });
  await broker(c, 'orders', { method: 'POST', releaseContext: ctx, automated: true, body: { fixture: true } }); assert.equal(called, 1);
  await assert.rejects(broker(c, 'orders', { method: 'POST', body: {} }), { code: 'LIVE_RELEASE_BLOCKED' }); assert.equal(called, 1);
  assert.equal((await liveRelease({ ...ctx, env: { ...ctx.env, PRODUCT_RELEASE_BUILD_ID: 'changed' } })).enabled, false);
});
test('broker order lifecycle handles partial fills, out of order, cancellation races and replacement', () => {
  let current = { ...intent(), status: 'accepted' }; current = mergeBrokerOrder(current, event('partially_filled', '1', NOW + 1000)); assert.equal(current.filledQuantity, '1');
  current = mergeBrokerOrder(current, event('accepted', '0', NOW)); assert.equal(current.status, 'partially_filled');
  current = mergeBrokerOrder(current, event('pending_cancel', '1', NOW + 2000)); current = mergeBrokerOrder(current, event('filled', '2', NOW + 3000)); assert.equal(current.status, 'filled');
  assert.equal(mergeBrokerOrder(current, event('canceled', '1', NOW + 4000)).status, 'filled');
  assert.equal(mergeBrokerOrder({ ...intent(), status: 'accepted' }, { ...event('replaced'), replaced_by: 'replacement-123' }).replacedBy, 'replacement-123');
});
test('account leases fence expired workers and prevent concurrent holders', async t => {
  const ctx = await fixture(t), a = await acquireAccountLease(ctx.store, USER, 'a', NOW, 1000);
  assert.equal(await acquireAccountLease(ctx.store, USER, 'b', NOW + 1), null);
  const b = await acquireAccountLease(ctx.store, USER, 'b', NOW + 1001); assert.ok(b.fence > a.fence);
  await assert.rejects(assertAccountLease(ctx.store, USER, a, NOW + 1002), { code: 'WORKER_LEASE_LOST' });
});
test('risk rejects stale inputs and open-market uncertainty, allows verified reductions without stale-price dependence', async t => {
  const ctx = await fixture(t), c = connection(ctx), inputs = { intent: intent(), connection: c, quote: quote(), account: account(), positions: [], openOrders: [], recentIntents: [], clock: { is_open: true, timestamp: new Date(NOW).toISOString() }, now: NOW };
  assert.equal(validateRisk(inputs).estimatedNotional, '200.00000000');
  assert.throws(() => validateRisk({ ...inputs, quote: quote(NOW - 300000) }), { code: 'STALE_DATA' });
  assert.throws(() => validateRisk({ ...inputs, clock: { is_open: false } }), { code: 'MARKET_CLOSED' });
  assert.equal(validateRisk({ ...inputs, intent: { ...intent(), side: 'sell', reduceOnly: true }, quote: {}, positions: [{ symbol: 'AAPL', qty: '2' }] }).reduceOnly, true);
  assert.throws(() => validateRisk({ ...inputs, intent: { ...intent(), side: 'sell', reduceOnly: true }, quote: {}, positions: [{ symbol: 'AAPL', qty: '2' }], openOrders: [{ symbol: 'AAPL', side: 'sell', qty: '2', filled_qty: '0', type: 'stop' }] }), { code: 'RISK_REDUCTION_UNVERIFIED' });
});
test('idempotent queued order cannot change account payload or cross owner boundary', async t => {
  const ctx = await fixture(t); await put(ctx, 'broker_connections', `${USER}:conn-test`, connection(ctx));
  const body = { requestId: 'manual-order-123', connectionId: 'conn-test', instrumentId: 'XNAS:AAPL:USD', side: 'buy', quantity: '2', type: 'market', timeInForce: 'day', confirmed: true };
  const first = await enqueueOrder(ctx, body), second = await enqueueOrder(ctx, body); assert.equal(first.intent.clientOrderId, second.intent.clientOrderId); assert.equal(second.replayed, true);
  await assert.rejects(enqueueOrder(ctx, { ...body, quantity: '3' }), { code: 'IDEMPOTENCY_CONFLICT' });
  await assert.rejects(enqueueOrder({ ...ctx, user: { id: OTHER } }, body), { code: 'NOT_FOUND' });
});
test('ambiguous broker POST records unknown; restart queries original client ID and never resubmits', async t => {
  const ctx = await fixture(t), c = connection(ctx); await put(ctx, 'broker_connections', `${USER}:conn-test`, c); await put(ctx, 'order_intents', `${USER}:test-order-001`, intent());
  let posts = 0; ctx.fetcher = async (url, options) => {
    if (options.method === 'POST') { posts++; throw new Error('fixture ambiguous timeout'); }
    if (String(url).endsWith('/account')) return json(account()); if (String(url).endsWith('/positions')) return json([]); if (String(url).includes('/orders?')) return json([]); if (String(url).endsWith('/clock')) return json({ is_open: true, timestamp: new Date(NOW).toISOString() }); if (String(url).includes('/assets/')) return json({ symbol: 'AAPL', exchange: 'NASDAQ', class: 'us_equity', tradable: true, status: 'active' }); throw new Error('unexpected fixture route');
  };
  const lease = await acquireAccountLease(ctx.store, USER, 'worker1', NOW), row = await ctx.store.get('order_intents', `${USER}:test-order-001`);
  const result = await processOrder(ctx, row, lease, { quotes: async () => ({ quote: quote() }) }); assert.equal(result.status, 'unknown'); assert.equal(posts, 1);
  const stored = await ctx.store.get('order_intents', row.key); const reconciled = await reconcileIntent(ctx, stored, async () => event('partially_filled', '1'), c); assert.equal(reconciled.status, 'partially_filled'); assert.equal(posts, 1);
});
test('crash before transmission remains unresolved on broker 404 and is never blindly retried', async t => {
  const ctx = await fixture(t); await put(ctx, 'order_intents', `${USER}:test-order-001`, { ...intent(), status: 'submitting' });
  const row = await ctx.store.get('order_intents', `${USER}:test-order-001`); const value = await reconcileIntent(ctx, row, async () => null, connection(ctx)); assert.equal(value.status, 'manual_review');
});
test('billing loss stops queued new risk, preserves protective orders and permits owner stop', async t => {
  const ctx = await fixture(t), c = connection(ctx); c.orders = [{ id: 'protective-stop', type: 'stop', symbol: 'AAPL' }];
  await put(ctx, 'accounts', USER, { emailVerified: true, billing: { tier: 'pro', paidUntil: NOW - 1 } }); await put(ctx, 'broker_connections', `${USER}:conn-test`, c); await put(ctx, 'order_intents', `${USER}:test-order-001`, { ...intent(), automated: true, strategyVersion: 1 });
  let post = 0; const fetcher = async (url, options) => { if (options.method !== 'GET') post++; return String(url).endsWith('/account') ? json(account()) : String(url).endsWith('/positions') ? json([]) : json(c.orders); };
  await runAccountTick({ store: ctx.store, env: ctx.env, ownerId: USER, fetcher, clock: () => NOW, providers: {} });
  const saved = await ctx.store.get('broker_connections', `${USER}:conn-test`); assert.equal(saved.value.automationEnabled, false); assert.equal(saved.value.orders[0].id, 'protective-stop'); assert.equal(post, 0); assert.equal((await ctx.store.get('order_intents', `${USER}:test-order-001`)).value.status, 'rejected');
  const result = await brokerControl({ ...ctx, requireFeature: async () => { throw new Error('expired'); } }, 'product-broker-stop', { requestId: 'stop-after-expiry', connectionId: 'conn-test' }); assert.equal(result.existingOrders, 'preserved');
});
test('worker health requires real recent heartbeat and successful cycle, not an environment flag', async t => {
  const ctx = await fixture(t); assert.equal((await getIntegrationReadiness(ctx)).worker.connected, false);
  const worker = createDurableWorker({ store: ctx.store, env: ctx.env, clock: () => NOW }); await worker.start();
  assert.equal((await getIntegrationReadiness(ctx)).worker.connected, true); assert.equal((await getIntegrationReadiness({ ...ctx, now: NOW + 100000 })).worker.connected, false);
  await worker.stop();
});
test('backtest applies next-bar execution and costs; forming daily bar cannot create a signal', () => {
  const bars = [10, 9, 8, 7, 8, 12, 13, 10, 7, 6].map((n, i) => ({ time: new Date(Date.UTC(2026, 9, i + 1)).toISOString(), open: String(n), high: String(n + 1), low: String(n - 1), close: String(n), volume: '1000' }));
  const strategy = { fast: 2, slow: 3, quantity: '1' }, signal = signals(bars, strategy, Date.UTC(2026, 9, 10)); assert.ok(signal.every(x => x.time < '2026-10-10'));
  const result = backtestStrategy(bars, strategy, { initialCash: 1000, fee: 2, slippageBps: 10, now: Date.UTC(2026, 9, 11) }); assert.equal(result.simulated, true); assert.ok(result.trades.length > 0); assert.ok(result.trades[0].price > Number(bars.find(b => b.time === result.trades[0].time).open));
});
test('risk includes outstanding same-symbol buys and missing broker-visible reservations', async t => {
  const ctx = await fixture(t), c = connection(ctx); c.risk.maxPositionNotional = '1000';
  const inputs = { intent: { ...intent(), quantity: '6' }, connection: c, quote: quote(), account: account(), positions: [], openOrders: [{ client_order_id: 'prior', symbol: 'AAPL', side: 'buy', qty: '6', filled_qty: '0', limit_price: '100' }], recentIntents: [], clock: { is_open: true, timestamp: new Date(NOW).toISOString() }, now: NOW };
  assert.throws(() => validateRisk(inputs), { code: 'POSITION_LIMIT' });
  const accepted = { ...intent(), id: 'prior', clientOrderId: 'prior', quantity: '6', status: 'accepted' };
  assert.throws(() => validateRisk({ ...inputs, openOrders: [], recentIntents: [accepted] }), { code: 'POSITION_LIMIT' });
  assert.throws(() => validateRisk({ ...inputs, openOrders: [], recentIntents: [{ ...accepted, symbol: 'MSFT' }] }), { code: 'EXECUTION_UNRESOLVED' });
  // An unrelated open market buy is already reserved in the broker's available buying power;
  // the AAPL quote is never used to value it a second time.
  assert.throws(() => validateRisk({ ...inputs, openOrders: [{ symbol: 'MSFT', side: 'buy', qty: '10000', filled_qty: '0' }], account: { ...account(), buying_power: '100' } }), { code: 'BUYING_POWER' });
  assert.throws(() => validateRisk({ ...inputs, quote: { ...quote(), asOf: 'invalid' } }), { code: 'STALE_DATA' });
  assert.throws(() => validateRisk({ ...inputs, quote: quote(NOW + 120000) }), { code: 'STALE_DATA' });
});
test('AI facts use corrected effective ledger and deterministic holdings, never voided transactions or notes', async t => {
  const ctx = await fixture(t), selected = { id: 'XNAS:AAPL:USD', symbol: 'AAPL', name: 'Apple', venue: 'XNAS', currency: 'USD', assetType: 'stock' };
  let state = createPortfolio({ name: 'Private name not forwarded', displayCurrency: 'USD' }, { now: NOW });
  const apply = command => { state = applyPortfolioCommand(state, command, { now: NOW }); };
  apply({ type: 'opening_position', instrument: selected, quantity: '2', unitCost: '100', notes: 'DO NOT FORWARD PRIVATE NOTE' });
  apply({ type: 'transaction_correct', transactionId: state.transactions[0].id, replacement: { instrument: selected, quantity: '3', unitCost: '90' } });
  apply({ type: 'opening_position', instrument: selected, quantity: '9', unitCost: '200' });
  apply({ type: 'transaction_void', transactionId: state.transactions.at(-1).id });
  await put(ctx, 'portfolios', `${USER}:${state.id}`, state);
  const result = await buildAiEvidence(ctx, { portfolioId: state.id }, {}), fact = result.facts[0];
  assert.equal(fact.holdings[0].quantity, '3'); assert.equal(fact.holdings[0].costBasis, '270'); assert.equal(fact.effectiveTransactions.length, 1); assert.equal(fact.totalValue, null);
  assert.doesNotMatch(JSON.stringify(result), /DO NOT FORWARD|Private name/); assert.equal(fact.performance.available, false);
});
test('daily candle timestamps follow New York DST and retain session-date semantics', () => {
  const meta = { symbol: 'AAPL', currency: 'USD', mic_code: 'XNAS', interval: '1day', exchange_timezone: 'America/New_York' }, selected = { id: 'XNAS:AAPL:USD', symbol: 'AAPL', venue: 'XNAS' };
  const values = ['2026-03-06', '2026-03-09'].map(datetime => ({ datetime, open: '100', high: '102', low: '99', close: '101', volume: '10' }));
  const bars = normalizeCandles({ meta, values }, selected, NOW);
  assert.equal(bars[0].time, '2026-03-06T05:00:00.000Z'); assert.equal(bars[1].time, '2026-03-09T04:00:00.000Z'); assert.equal(bars[1].sessionDate, '2026-03-09'); assert.equal(bars[1].timeKind, 'exchange_session_date');
});
test('admin cold-start probes cannot be invoked by customers and never claim missing credentials succeeded', async t => {
  const ctx = await fixture(t, { PRODUCT_ADMIN_USER_IDS: USER });
  await assert.rejects(handleIntegrations({ ...ctx, user: { id: OTHER } }, 'product-health-probe', { requestId: 'probe-attempt-001', services: ['market'] }), { code: 'ADMIN_REQUIRED' });
  const result = await handleIntegrations(ctx, 'product-health-probe', { requestId: 'probe-missing-001', services: ['market', 'news', 'calendar', 'ai'] });
  assert.ok(Object.values(result.results).every(r => r.success === false)); assert.equal(result.readiness.market.connected, false); assert.equal(result.readiness.ai.connected, false);
});
test('watchlist and real-event reminders persist idempotently; reminder removal survives expiry', async t => {
  const ctx = await fixture(t); await put(ctx, 'accounts', USER, ctx.account);
  const body = { requestId: 'watchlist-add-001', type: 'add', instrumentId: 'XNAS:AAPL:USD' };
  assert.deepEqual((await handleIntegrations(ctx, 'product-watchlist', body)).instrumentIds, ['XNAS:AAPL:USD']);
  assert.equal((await handleIntegrations(ctx, 'product-watchlist', body)).instrumentIds.length, 1);
  await assert.rejects(handleIntegrations(ctx, 'product-watchlist', { ...body, type: 'remove' }), { code: 'IDEMPOTENCY_CONFLICT' });
  ctx.providers = { calendar: async () => ({ events: [{ id: 'te:1', title: 'Real provider fixture title', time: new Date(NOW + 3600000).toISOString(), estimatedTime: false }], asOf: new Date(NOW).toISOString() }) };
  const reminder = await handleIntegrations(ctx, 'product-reminders', { requestId: 'reminder-add-001', type: 'add', eventId: 'te:1', title: 'Spoofed client title', eventTime: '2000-01-01', leadMinutes: 5 });
  assert.equal(reminder.reminders[0].title, 'Real provider fixture title'); assert.equal(reminder.reminders[0].remindAt, NOW + 3300000); assert.equal(reminder.backgroundDelivery, false);
  ctx.requireFeature = async () => { throw new Error('expired subscription'); };
  assert.equal((await handleIntegrations(ctx, 'product-reminders', { requestId: 'reminder-remove-001', type: 'remove', eventId: 'te:1' })).reminders.length, 0);
});
test('restart scan finds unresolved orders after a thousand retained historical intents', async t => {
  const ctx = await fixture(t); await put(ctx, 'broker_connections', `${USER}:conn-test`, connection(ctx));
  for (let start = 0; start < 1001; start += 30) {
    const changes = Array.from({ length: Math.min(30, 1001 - start) }, (_, i) => change('order_intents', `${USER}:history-${String(start + i).padStart(5, '0')}`, USER, null, { ...intent(), id: `history-${start + i}`, status: 'filled', filledQuantity: '2' }));
    assert.equal((await ctx.store.transact(changes)).status, 'applied');
  }
  await put(ctx, 'order_intents', `${USER}:zz-unresolved`, { ...intent(), id: 'zz-unresolved', status: 'unknown' });
  await put(ctx, 'order_intents', `${USER}:aaa-pending`, intent());
  const rows = await listAllRecords(ctx.store, 'order_intents', { ownerId: USER }); assert.equal(rows.length, 1003); assert.equal(rows.at(-1).value.status, 'unknown');
  const lease = await acquireAccountLease(ctx.store, USER, 'paged-worker', NOW), pending = await ctx.store.get('order_intents', `${USER}:aaa-pending`);
  const result = await processOrder(ctx, pending, lease, { quotes: async () => { throw new Error('Must not request entry data while unresolved'); } });
  assert.equal(result.errorCode, 'EXECUTION_UNRESOLVED');
});

function dispatchFixture(ctx, selected, { positions = [], openOrders = [] } = {}) {
  let posts = 0;
  ctx.fetcher = async (url, options) => {
    if (options.method === 'POST') {
      posts++; const sent = JSON.parse(options.body);
      return json({ id: 'broker-fixture-dispatch', client_order_id: sent.client_order_id, symbol: sent.symbol, side: sent.side, qty: sent.qty, filled_qty: '0', status: 'accepted', updated_at: new Date(NOW).toISOString() });
    }
    if (String(url).endsWith('/account')) return json({ ...account(), id: selected.accountId });
    if (String(url).endsWith('/positions')) return json(positions);
    if (String(url).includes('/orders?')) return json(openOrders);
    if (String(url).endsWith('/clock')) return json({ is_open: true, timestamp: new Date(NOW).toISOString() });
    if (String(url).includes('/assets/')) return json({ symbol: selected.symbol, exchange: 'NASDAQ', class: 'us_equity', tradable: true, status: 'active' });
    throw new Error('Unexpected fixture route');
  };
  return { get posts() { return posts; } };
}
test('verified reduction survives unrelated unresolved orders but not a same-account same-symbol unresolved sell', async t => {
  const scenarios = [
    { name: 'different account and instrument', prior: { connectionId: 'other-connection', accountId: 'other-account-123', symbol: 'AAPL', side: 'sell' }, expected: 'accepted' },
    { name: 'same account other instrument', prior: { connectionId: 'conn-test', accountId: 'account-12345', symbol: 'AAPL', side: 'sell' }, expected: 'accepted' },
    { name: 'same instrument unresolved buy with verified long position', prior: { connectionId: 'conn-test', accountId: 'account-12345', symbol: 'MSFT', side: 'buy' }, expected: 'accepted' },
    { name: 'same instrument unresolved sell', prior: { connectionId: 'conn-test', accountId: 'account-12345', symbol: 'MSFT', side: 'sell' }, expected: 'rejected' },
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async sub => {
    const ctx = await fixture(sub), c = connection(ctx), current = { ...intent(), instrumentId: 'XNAS:MSFT:USD', symbol: 'MSFT', side: 'sell', reduceOnly: true };
    ctx.requireFeature = async () => { throw new Error('Expired subscriptions must not prevent a verified reduction'); };
    await put(ctx, 'broker_connections', `${USER}:conn-test`, c);
    await put(ctx, 'order_intents', `${USER}:${current.id}`, current);
    await put(ctx, 'order_intents', `${USER}:prior-unknown`, { ...intent(), ...scenario.prior, id: 'prior-unknown', status: 'unknown' });
    const upstream = dispatchFixture(ctx, current, { positions: [{ symbol: 'MSFT', qty: '2' }] }), lease = await acquireAccountLease(ctx.store, USER, 'reduction-worker', NOW);
    const result = await processOrder(ctx, await ctx.store.get('order_intents', `${USER}:${current.id}`), lease, { quotes: async () => { throw new Error('Reduction must not depend on a live quote'); } });
    assert.equal(result.status, scenario.expected); assert.equal(upstream.posts, scenario.expected === 'accepted' ? 1 : 0);
    if (scenario.expected === 'rejected') assert.equal(result.errorCode, 'EXECUTION_UNRESOLVED');
  });
});
test('new risk fences unresolved work only for the selected broker account and mode', async t => {
  const ctx = await fixture(t), c = connection(ctx), current = intent();
  await put(ctx, 'broker_connections', `${USER}:conn-test`, c); await put(ctx, 'order_intents', `${USER}:${current.id}`, current);
  await put(ctx, 'order_intents', `${USER}:unrelated-unknown`, { ...intent(), id: 'unrelated-unknown', status: 'unknown', connectionId: 'unrelated-connection', accountId: 'unrelated-account' });
  const upstream = dispatchFixture(ctx, current), lease = await acquireAccountLease(ctx.store, USER, 'scoped-worker', NOW);
  const result = await processOrder(ctx, await ctx.store.get('order_intents', `${USER}:${current.id}`), lease, { quotes: async () => ({ quote: quote() }) });
  assert.equal(result.status, 'accepted'); assert.equal(upstream.posts, 1);
});
test('invalid outstanding sell quantities cannot inflate reducible long quantity', async t => {
  const ctx = await fixture(t), inputs = { intent: { ...intent(), side: 'sell', reduceOnly: true }, connection: connection(ctx), quote: {}, account: account(), positions: [{ symbol: 'AAPL', qty: '2' }], recentIntents: [], clock: { is_open: true, timestamp: new Date(NOW).toISOString() }, now: NOW };
  for (const malformed of [{ qty: '-1', filled_qty: '0' }, { qty: '0', filled_qty: '0' }, { qty: '1', filled_qty: '2' }, { qty: '1', filled_qty: '-1' }, { qty: '1' }, { filled_qty: '0' }]) assert.throws(() => validateRisk({ ...inputs, openOrders: [{ symbol: 'AAPL', side: 'sell', ...malformed }] }), { code: 'BROKER_EVENT_INVALID' });
  assert.equal(validateRisk({ ...inputs, intent: { ...inputs.intent, quantity: '1' }, openOrders: [{ symbol: 'AAPL', side: 'sell', qty: '2', filled_qty: '1' }] }).reduceOnly, true);
});
test('risk changes between fencing commit and transmission reject before any broker POST', async t => {
  const ctx = await fixture(t), c = connection(ctx), current = intent();
  await put(ctx, 'broker_connections', `${USER}:conn-test`, c); await put(ctx, 'order_intents', `${USER}:${current.id}`, current);
  const upstream = dispatchFixture(ctx, current), lease = await acquireAccountLease(ctx.store, USER, 'risk-change-worker', NOW);
  const transact = ctx.store.transact.bind(ctx.store); let changed = false;
  ctx.store.transact = async changes => {
    const result = await transact(changes);
    if (!changed && result.status === 'applied' && changes.some(x => x.ns === 'order_intents' && x.value?.status === 'submitting')) {
      changed = true; const row = await ctx.store.get('broker_connections', `${USER}:conn-test`);
      assert.equal((await transact([change('broker_connections', row.key, USER, row, { ...row.value, risk: { ...row.value.risk, maxOrderNotional: '50' } })])).status, 'applied');
    }
    return result;
  };
  const result = await processOrder(ctx, await ctx.store.get('order_intents', `${USER}:${current.id}`), lease, { quotes: async () => ({ quote: quote() }) });
  assert.equal(changed, true); assert.equal(result.status, 'rejected'); assert.equal(result.errorCode, 'EXECUTION_CHANGED'); assert.equal(upstream.posts, 0);
});
test('maximum-size broker open-order page is unverified for entries, reductions and account sync', async t => {
  for (const reduceOnly of [false, true]) await t.test(reduceOnly ? 'reduction' : 'entry', async sub => {
    const ctx = await fixture(sub), c = connection(ctx), current = { ...intent(), side: reduceOnly ? 'sell' : 'buy', reduceOnly };
    await put(ctx, 'broker_connections', `${USER}:conn-test`, c); await put(ctx, 'order_intents', `${USER}:${current.id}`, current);
    const openOrders = Array.from({ length: 500 }, (_, i) => ({ id: `fixture-${i}`, symbol: 'AAPL', side: 'buy', qty: '1', filled_qty: '0' }));
    const upstream = dispatchFixture(ctx, current, { openOrders, positions: [{ symbol: 'AAPL', qty: '2' }] }), lease = await acquireAccountLease(ctx.store, USER, 'full-page-worker', NOW);
    const result = await processOrder(ctx, await ctx.store.get('order_intents', `${USER}:${current.id}`), lease, { quotes: async () => ({ quote: quote() }) });
    assert.equal(result.errorCode, 'BROKER_ORDER_SNAPSHOT_INCOMPLETE'); assert.equal(result.status, 'rejected'); assert.equal(upstream.posts, 0);
    await assert.rejects(syncBroker(ctx, c.id), { code: 'BROKER_ORDER_SNAPSHOT_INCOMPLETE' });
  });
});
test('nested active protective sells reserve long shares, while filled or canceled legs reserve none', async t => {
  const ctx = await fixture(t), inputs = { intent: { ...intent(), side: 'sell', quantity: '1', reduceOnly: true }, connection: connection(ctx), quote: {}, account: account(), positions: [{ symbol: 'AAPL', qty: '2' }], recentIntents: [], clock: { is_open: true, timestamp: new Date(NOW).toISOString() }, now: NOW };
  const stop = { id: 'protective-stop-123', client_order_id: 'protective-stop-client', symbol: 'AAPL', side: 'sell', type: 'stop', status: 'new', qty: '2', filled_qty: '0' };
  const parent = { id: 'bracket-parent-123', symbol: 'AAPL', side: 'buy', status: 'filled', qty: '2', filled_qty: '2', legs: [stop] };
  assert.throws(() => validateRisk({ ...inputs, openOrders: [parent] }), { code: 'RISK_REDUCTION_UNVERIFIED' });
  assert.equal(validateRisk({ ...inputs, intent: { ...inputs.intent, quantity: '2' }, openOrders: [{ ...parent, legs: [{ ...stop, status: 'filled', filled_qty: '2' }, { ...stop, id: 'canceled-stop-456', status: 'canceled' }] }] }).reduceOnly, true);
  assert.throws(() => validateRisk({ ...inputs, openOrders: [{ ...parent, legs: [{ ...stop, symbol: 'MSFT', qty: '1', filled_qty: '2' }] }] }), { code: 'BROKER_EVENT_INVALID' });
});
test('nested and top-level duplicate broker IDs reserve only the remaining quantity once; conflicts fail closed', async t => {
  const ctx = await fixture(t), inputs = { intent: { ...intent(), side: 'sell', quantity: '1', reduceOnly: true }, connection: connection(ctx), quote: {}, account: account(), positions: [{ symbol: 'AAPL', qty: '2' }], recentIntents: [], clock: { is_open: true, timestamp: new Date(NOW).toISOString() }, now: NOW };
  const partiallyFilled = { id: 'partial-protective-123', client_order_id: 'partial-stop-client', symbol: 'AAPL', side: 'sell', type: 'stop', status: 'partially_filled', qty: '2', filled_qty: '1' };
  const parent = { id: 'filled-bracket-123', symbol: 'AAPL', side: 'buy', status: 'filled', qty: '2', filled_qty: '2', legs: [partiallyFilled] };
  assert.equal(validateRisk({ ...inputs, openOrders: [parent, { ...partiallyFilled }] }).reduceOnly, true);
  assert.throws(() => validateRisk({ ...inputs, openOrders: [parent, { ...partiallyFilled, filled_qty: '0' }] }), { code: 'BROKER_EVENT_INVALID' });
});
test('nested order snapshot capacity is bounded even below the top-level page limit', async t => {
  const ctx = await fixture(t), legs = Array.from({ length: 499 }, (_, i) => ({ id: `nested-fixture-${i}`, symbol: 'MSFT', side: 'sell', type: 'limit', status: 'new', qty: '1', filled_qty: '0' }));
  const inputs = { intent: { ...intent(), side: 'sell', quantity: '1', reduceOnly: true }, connection: connection(ctx), quote: {}, account: account(), positions: [{ symbol: 'AAPL', qty: '2' }], recentIntents: [], clock: { is_open: true, timestamp: new Date(NOW).toISOString() }, now: NOW };
  assert.throws(() => validateRisk({ ...inputs, openOrders: [{ id: 'nested-root-123', symbol: 'MSFT', side: 'buy', status: 'filled', qty: '499', filled_qty: '499', legs }] }), { code: 'BROKER_ORDER_SNAPSHOT_INCOMPLETE' });
});
