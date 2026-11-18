import { fail, commandDigest } from '../terminal/security.mjs';
import { createDataProviders, instrument } from './providers-data.mjs';
import { rightsFor, SYSTEM_OWNER, updateRecord, requestId, owned, change, listAllRecords } from './providers-core.mjs';
import { liveRelease } from './broker-release.mjs';
import { getAiUsage, explainAi, AI_MODELS } from './ai.mjs';
import { getBrokerStatus, connectBroker, brokerControl, syncBroker, brokerConfigured, brokerPaperApproved } from './broker.mjs';
import { enqueueOrder, cancelOrder, listOrders } from './execution.mjs';
import { handleStrategy } from './execution-strategy.mjs';
import { deriveEntitlements } from './entitlements.mjs';
import { isOwnerContext } from './owner.mjs';
import { createNortivoDataProviders } from './providers-nortivo.mjs';

export function createProductProviders(env = process.env, fetcher = fetch, store) {
  const data = createDataProviders(env, fetcher, store);
  return { ...data, market: { quote: input => data.quotes({ instrumentId: typeof input === 'string' ? input : input.id }), fx: data.fx }, quote: input => data.quotes({ instrumentId: typeof input === 'string' ? input : input.id }) };
}
export function usesOwnerMarket(ctx) { return isOwnerContext(ctx) && ctx.env?.PRODUCT_OWNER_MARKET_PROVIDER === 'nortivo'; }
const ownerProviderBases = new WeakMap();
export function getProviders(ctx) {
  const base = ownerProviderBases.get(ctx.providers) || ctx.providers || createProductProviders(ctx.env, ctx.fetcher, ctx.store);
  if (!usesOwnerMarket(ctx)) return base;
  const market = createNortivoDataProviders({ env: ctx.env, fetcher: ctx.fetcher, store: ctx.store, clock: typeof ctx.clock === 'function' ? ctx.clock : () => Number.isFinite(ctx.now) ? ctx.now : Date.now() });
  const providers = { ...base, ...market, market: { quote: input => market.quotes({ instrumentId: typeof input === 'string' ? input : input.id }), fx: market.fx }, quote: input => market.quotes({ instrumentId: typeof input === 'string' ? input : input.id }) };
  ownerProviderBases.set(providers, base);
  return providers;
}
async function mutateAccount(ctx, action, body, transform) {
  const id = requestId(body.requestId), key = `integration:${ctx.user.id}:${id}`, digest = commandDigest({ action, ...body });
  for (let attempt = 0; attempt < 12; attempt++) {
    const receipt = await ctx.store.get('receipts', key);
    if (receipt) { if (receipt.ownerId !== ctx.user.id || receipt.value.digest !== digest) fail('IDEMPOTENCY_CONFLICT', 'That request ID was already used for another account action.', 409); return receipt.value.result; }
    const account = await owned(ctx.store, 'accounts', ctx.user.id, ctx.user.id), { value, result } = transform(account.value);
    const commit = await ctx.store.transact([change('accounts', ctx.user.id, ctx.user.id, account, value), change('receipts', key, ctx.user.id, null, { digest, result, createdAt: ctx.now })]);
    if (commit.status === 'applied') return result;
  }
  fail('CONCURRENT_UPDATE', 'The account changed. Retry with the same request ID.', 409);
}
export async function getIntegrationReadiness(ctx, { brokerStatus } = {}) {
  const env = ctx.env || {}, store = ctx.store, now = ctx.now || Date.now(), entitlements = ctx.entitlements || deriveEntitlements(ctx.account || {}, now), features = entitlements.features || [];
  const ownerMarket = usesOwnerMarket(ctx), ownerConfigured = Boolean(env.APCA_API_KEY_ID && env.APCA_API_SECRET_KEY);
  const config = { market: [ownerMarket ? 'alpaca' : 'twelve', ownerMarket ? ownerConfigured : Boolean(env.TWELVE_DATA_API_KEY), 'market.read'], news: ['finnhub', Boolean(env.FINNHUB_API_KEY), 'news.read'], calendar: ['tradingeconomics', Boolean(env.TRADING_ECONOMICS_API_KEY), 'calendar.read'] };
  // Independent evidence reads share no locks or authority. Read them together,
  // and use the same market evidence for quotes and daily-history readiness.
  const healthKeys = [ownerMarket ? 'owner_market' : 'market', 'news', 'calendar', 'ai', 'broker'];
  const connectionsPromise = ctx.user?.id && store ? Promise.resolve(brokerStatus ?? getBrokerStatus(ctx)) : Promise.resolve({ connections: [] });
  const releasePromise = ctx.user?.id && store ? connectionsPromise.then(value => ({ enabled: value.liveReleaseEnabled })) : store ? liveRelease(ctx) : Promise.resolve({ enabled: false });
  const [healthRows, heartbeatRow, connections, release] = await Promise.all([
    Promise.all(healthKeys.map(key => store ? store.get('provider_health', key) : null)),
    store ? store.get('worker_health', 'executor') : null, connectionsPromise, releasePromise,
  ]);
  const states = Object.fromEntries(['market', 'news', 'calendar', 'ai', 'broker'].map((name, index) => [name, healthRows[index]?.value || null]));
  const result = {};
  for (const [name, [provider, configured, feature]] of Object.entries(config)) {
    const rights = name === 'market' && ownerMarket ? { ready: ownerConfigured, nonDisplay: ownerConfigured, coverage: 'IEX single-venue data; private owner access, not consolidated US prices or public redistribution.' } : rightsFor(env, name, provider), state = states[name];
    const lastDataSuccess = name === 'market' ? state?.quoteSuccessAt : state?.lastSuccessAt;
    const currentEvidence = lastDataSuccess && now - lastDataSuccess < (name === 'market' ? 15 * 60000 : 60 * 60000);
    const reachable = configured && rights.ready && state?.provider === provider ? state.reachable ?? null : null;
    result[name] = { provider: provider === 'alpaca' ? 'Nortivo Data / Alpaca IEX' : provider === 'twelve' ? 'Twelve Data' : provider === 'finnhub' ? 'Finnhub' : 'Trading Economics', configured, permissionsReady: rights.ready, reachable, freshness: reachable === true ? currentEvidence ? state.freshness || 'current' : 'stale' : 'unavailable', planIncluded: features.includes(feature), connected: reachable === true, authorized: rights.ready, lastSuccessAt: state?.lastSuccessAt || null, reason: !configured ? 'Service setup is pending.' : !rights.ready ? 'Commercial permissions are pending.' : reachable === null ? 'The authenticated provider connection has not been verified.' : reachable === false ? 'The data service is temporarily unavailable.' : !currentEvidence ? 'The last successful provider check is stale.' : ownerMarket && name === 'market' ? 'Authenticated private IEX data was received for the owner.' : 'Authenticated provider data was received.', coverage: rights.coverage, sourceUrl: name === 'market' ? ownerMarket ? 'https://alpaca.markets' : 'https://twelvedata.com' : name === 'news' ? 'https://finnhub.io' : 'https://tradingeconomics.com', ...(name === 'market' && ownerMarket ? { privateOwnerUse: true, publicRedistribution: false } : {}) };
  }
  const aiState = states.ai, aiConfigured = Boolean(env.OPENAI_API_KEY && AI_MODELS[env.PRODUCT_OPENAI_MODEL || 'gpt-6-luna']);
  const researchState = states.market, researchRights = ownerMarket ? { nonDisplay: ownerConfigured } : rightsFor(env, 'market', 'twelve'), researchVerified = Boolean(researchState?.historySuccessAt && now - researchState.historySuccessAt < 86400000 && researchState.historyBars >= 52 && researchState.provider === (ownerMarket ? 'alpaca' : 'twelve'));
  result.strategy = { implemented: true, supported: researchRights.nonDisplay && researchVerified, configured: ownerMarket ? ownerConfigured : Boolean(env.TWELVE_DATA_API_KEY), permissionsReady: researchRights.nonDisplay, reachable: researchState?.reachable ?? null, freshness: researchVerified ? 'current' : 'unavailable', planIncluded: features.includes('strategy.write'), definitions: ['daily_sma_crossover', 'next_daily_open_backtest', 'bounded_20_50_sma_scan'], historyBars: researchState?.historyBars || 0, reason: !researchRights.nonDisplay ? 'Licensed non-display history permission is pending.' : !researchVerified ? 'The provider has not supplied sufficient verified daily history.' : ownerMarket ? 'Private IEX daily history is available for owner research; single-venue volume limitations apply.' : 'Supported daily SMA research tools have verified licensed history.' };
  result.ai = { provider: 'OpenAI', model: env.PRODUCT_OPENAI_MODEL || 'gpt-6-luna', configured: aiConfigured, permissionsReady: aiConfigured, reachable: aiConfigured ? aiState?.reachable ?? null : null, freshness: aiState?.reachable && now - aiState.lastSuccessAt < 86400000 ? 'current' : 'unavailable', planIncluded: features.includes('ai.basic'), connected: Boolean(aiState?.reachable), authorized: aiConfigured, reason: !aiConfigured ? 'AI explanations await server configuration.' : !aiState?.reachable ? 'The AI provider has not completed an authenticated explanation.' : 'The provider completed an authenticated explanation.' };
  const connected = connections.connections.some(x => x.authorized), configured = brokerConfigured(env), approved = brokerPaperApproved(env);
  const brokerHealth = states.broker, brokerReachable = brokerHealth?.appClientId === env.ALPACA_OAUTH_CLIENT_ID && brokerHealth?.reachable === true && now - brokerHealth.lastSuccessAt < 86400000;
  result.broker = { provider: 'Alpaca', configured, permissionsReady: approved, reachable: brokerHealth ? brokerReachable : null, freshness: brokerReachable ? 'current' : 'unavailable', purchasable: release.enabled && brokerReachable && brokerHealth.verifiedMode === 'live', planIncluded: features.includes('broker.connect'), connected, authorized: connected, liveReleaseEnabled: release.enabled, mode: release.enabled ? 'paper_or_live' : 'paper', reason: connected ? release.enabled ? 'Broker account authorized.' : 'Paper account authorized; live release is pending.' : !configured || !approved ? 'Approved brokerage setup is pending.' : 'Connect your eligible Alpaca account.', manageUrl: 'https://app.alpaca.markets/' };
  const heartbeat = heartbeatRow?.value, alive = Boolean(heartbeat && now - heartbeat.lastHeartbeatAt <= 45000 && heartbeat.status !== 'stopped'), completed = Boolean(heartbeat?.lastCompletedAt && now - heartbeat.lastCompletedAt < 90000), workerReady = alive && completed && heartbeat.status === 'running';
  result.worker = { configured: Boolean(heartbeat), permissionsReady: true, reachable: heartbeat ? alive : null, freshness: workerReady ? 'current' : 'unavailable', planIncluded: features.includes('automation.run'), connected: workerReady, authorized: true, lastHeartbeatAt: heartbeat?.lastHeartbeatAt || null, lastCompletedAt: heartbeat?.lastCompletedAt || null, reason: workerReady ? 'The persistent worker is running and completed a recent cycle.' : alive ? 'The worker is alive but has not completed a healthy recent cycle.' : 'The background worker is not currently verified.' };
  return result;
}
export async function getIntegrationSnapshot(ctx, { readiness, broker } = {}) {
  const brokerPromise = broker ?? getBrokerStatus(ctx);
  const [ready, ai, status] = await Promise.all([readiness ?? getIntegrationReadiness(ctx, { brokerStatus: brokerPromise }), getAiUsage(ctx, (ctx.entitlements || deriveEntitlements(ctx.account || {}, ctx.now)).tier), brokerPromise]);
  return { readiness: ready, ai, broker: status };
}
export async function handleIntegrations(ctx, action, body = {}, params = {}) {
  const providers = getProviders(ctx);
  if (action === 'product-watchlist') {
    if (!body) return { instrumentIds: ctx.account?.watchlist || [] };
    await ctx.requireFeature('market.read');
    requestId(body.requestId); instrument(body.instrumentId);
    if (!['add', 'remove'].includes(body.type)) fail('INVALID_WATCHLIST_ACTION', 'Choose add or remove.', 400);
    return mutateAccount(ctx, action, body, current => { const ids = new Set(current?.watchlist || []); if (body.type === 'add') ids.add(body.instrumentId); else ids.delete(body.instrumentId); if (ids.size > 100) fail('WATCHLIST_LIMIT', 'A watchlist can contain up to 100 instruments.', 409); return { value: { ...current, watchlist: [...ids] }, result: { instrumentIds: [...ids] } }; });
  }
  if (action === 'product-reminders') {
    const envelope = reminders => ({ reminders, channel: 'in_app', backgroundDelivery: false });
    if (!body) return envelope(ctx.account?.reminders || []);
    requestId(body.requestId);
    if (!['add', 'remove'].includes(body.type) || typeof body.eventId !== 'string') fail('INVALID_REMINDER', 'Choose a calendar event and add or remove its reminder.', 400);
    let reminder;
    if (body.type === 'add') {
      await ctx.requireFeature('calendar.read');
      const leadMinutes = body.leadMinutes ?? 5;
      if (![0, 5, 15, 60].includes(leadMinutes)) fail('INVALID_REMINDER', 'Choose 0, 5, 15 or 60 minutes before release.', 400);
      const data = await providers.calendar(), event = data.events.find(x => x.id === body.eventId);
      if (!event || Date.parse(event.time) <= ctx.now) fail('EVENT_UNAVAILABLE', 'Choose an upcoming event from the current licensed calendar.', 409);
      reminder = { eventId: event.id, eventTime: event.time, title: event.title, remindAt: Date.parse(event.time) - leadMinutes * 60000, leadMinutes, estimatedTime: event.estimatedTime, channel: 'in_app', requiresOpenTab: true, lastProviderUpdateAt: data.asOf, createdAt: ctx.now };
    }
    return mutateAccount(ctx, action, body, current => {
      const reminders = (current.reminders || []).filter(x => x.eventId !== body.eventId); if (reminder) reminders.push(reminder);
      if (reminders.length > 100) fail('REMINDER_LIMIT', 'Up to 100 in-app event reminders can be saved.', 409);
      return { value: { ...current, reminders }, result: envelope(reminders) };
    });
  }
  if (action === 'product-catalog') { await ctx.requireFeature('market.read'); return providers.catalog(params); }
  if (action === 'product-quotes') { await ctx.requireFeature('market.read'); return providers.quotes(params); }
  if (action === 'product-news') { await ctx.requireFeature('news.read'); return providers.news(params); }
  if (action === 'product-calendar') {
    await ctx.requireFeature('calendar.read'); const data = await providers.calendar(params);
    if (ctx.account?.reminders?.length) await updateRecord(ctx.store, 'accounts', ctx.user.id, ctx.user.id, current => ({ ...current, reminders: (current.reminders || []).map(reminder => { const event = data.events.find(x => x.id === reminder.eventId); return event ? { ...reminder, eventTime: event.time, remindAt: Date.parse(event.time) - reminder.leadMinutes * 60000, estimatedTime: event.estimatedTime, lastProviderUpdateAt: data.asOf } : reminder; }) }));
    return data;
  }
  if (action === 'product-ai-usage') return getAiUsage(ctx, deriveEntitlements(ctx.account, ctx.now).tier);
  if (action === 'product-ai') return explainAi(ctx, body, providers);
  if (action === 'product-broker-status') return getBrokerStatus(ctx);
  if (action === 'product-broker-connect') return connectBroker(ctx, body);
  if (action === 'product-broker-sync') return { connection: await syncBroker(ctx, body.connectionId) };
  if (['product-broker-consent', 'product-broker-stop', 'product-broker-disconnect'].includes(action)) return brokerControl(ctx, action, body);
  if (action === 'product-broker-order') return enqueueOrder(ctx, body);
  if (action === 'product-broker-orders') return listOrders(ctx, params);
  if (action === 'product-broker-cancel') return cancelOrder(ctx, body);
  if (['product-strategy', 'product-backtest', 'product-scan'].includes(action)) return handleStrategy(ctx, action, body, params, providers);
  if (action === 'product-health') {
    if (!isOwnerContext(ctx) && !(ctx.env.PRODUCT_ADMIN_USER_IDS || '').split(',').map(id=>id.trim()).includes(ctx.user.id)) fail('ADMIN_REQUIRED', 'This operational view is restricted to the owner.', 403);
    return { readiness: await getIntegrationReadiness(ctx), providerAttempts: (await ctx.store.list('provider_meter', { ownerId: SYSTEM_OWNER, limit: 50 })).map(r => ({ key: r.key, ...r.value })), unresolvedOrderScope:'Current owner account only. Other affected accounts are identified by ownerId in private persistent-worker logs.', unresolvedOrders: (await listAllRecords(ctx.store, 'order_intents', { ownerId: ctx.user.id })).filter(r => ['unknown', 'submitting', 'manual_review'].includes(r.value.status)).map(r => ({ intentId: r.value.id, status: r.value.status, since: r.value.createdAt })) };
  }
  if (action === 'product-health-probe') {
    if (!isOwnerContext(ctx) && !(ctx.env.PRODUCT_ADMIN_USER_IDS || '').split(',').map(id=>id.trim()).includes(ctx.user.id)) fail('ADMIN_REQUIRED', 'Only the owner can verify configured integrations.', 403);
    requestId(body.requestId);
    if (!Array.isArray(body.services) || !body.services.length || body.services.length > 8 || body.services.some(x => !['market', 'strategy', 'news', 'calendar', 'ai', 'broker', 'broker_oauth_paper', 'broker_oauth_live'].includes(x)) || new Set(body.services).size !== body.services.length) fail('INVALID_PROBE', 'Choose the supported services to verify.', 400);
    const results = {};
    for (const service of body.services) {
      try {
        if (service === 'market') { const data = await providers.quotes({ instrumentId: body.instrumentId || 'XNAS:AAPL:USD' }); results.market = { success: true, quote: data.quote }; }
        if (service === 'strategy') { const data = await providers.history({ instrumentId: body.instrumentId || 'XNAS:AAPL:USD' }); results.strategy = { success: data.bars.length >= 52, barCount: data.bars.length, definition: 'Daily SMA crossover/backtest/bounded scan', source: data.source }; }
        if (service === 'news') { const data = await providers.news({ symbol: 'AAPL' }); results.news = { success: true, itemCount: data.items.length, asOf: data.asOf }; }
        if (service === 'calendar') { const data = await providers.calendar(); results.calendar = { success: true, eventCount: data.events.length, asOf: data.asOf }; }
        if (service === 'ai') {
          // Operator checks spend their own bounded Pro-sized quota; no subscription or customer entitlement is granted.
          const result = await explainAi({ ...ctx, entitlements: { tier: 'pro' }, requireFeature: async () => {} }, { requestId: `probe-${body.requestId}`, kind: 'basic', question: 'Briefly explain what portfolio diversification means, without current market data.' }, providers);
          results.ai = { success: true, model: result.model, usage: result.usage, note: isOwnerContext(ctx) ? 'Owner access has no monthly Nortivo AI quota; actual provider charges and technical limits still apply.' : 'One actual request charged against the operator monthly 200-request/2.2M-token verification allowance.' };
        }
        if (service === 'broker') {
          const status = await getBrokerStatus(ctx), selected = status.connections.find(c => c.id === body.connectionId);
          if (!selected) fail('BROKER_AUTHORIZATION_REQUIRED', 'Choose an already authorized owner account to verify the broker.', 409);
          const synced = await syncBroker(ctx, selected.id); results.broker = { success: true, mode: synced.mode, lastSyncAt: synced.lastSyncAt };
        }
        if (service === 'broker_oauth_paper') results.broker_oauth_paper = await connectBroker({ ...ctx, brokerOperatorBootstrap: true, requireFeature: async () => {} }, { requestId: body.requestId, mode: 'paper' });
        if (service === 'broker_oauth_live') results.broker_oauth_live = await connectBroker({ ...ctx, brokerOperatorBootstrap: true, requireFeature: async () => {} }, { requestId: body.requestId, mode: 'live' });
      } catch (error) { results[service] = { success: false, code: error.code || 'PROBE_FAILED', message: error.code ? error.message : 'The service could not be verified.' }; }
    }
    return { results, readiness: await getIntegrationReadiness(ctx), verification: 'Only successful authenticated upstream responses establish provider reachability; this action never transmits an order.' };
  }
  fail('UNKNOWN_ACTION', 'This product action is unavailable.', 404);
}
