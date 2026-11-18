import crypto from 'node:crypto';
import { fail, sha256, commandDigest } from '../terminal/security.mjs';
import { change, owned, updateRecord, requestId, readJsonResponse, clean, SYSTEM_OWNER, listAllRecords } from './providers-core.mjs';
import { liveRelease, requireLiveRelease } from './broker-release.mjs';
import { brokerVenue } from './providers-data.mjs';

export const BROKER_MANAGEMENT_URL = 'https://app.alpaca.markets/';
function key(env) { const value = env.PRODUCT_BROKER_TOKEN_KEY || ''; if (!/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, 'base64').length !== 32) fail('BROKER_NOT_CONFIGURED', 'Broker token encryption is not configured.', 503); return Buffer.from(value, 'base64'); }
export function encryptBrokerToken(raw, ownerId, connectionId, env, mode = 'paper') {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(env), iv); cipher.setAAD(Buffer.from(`${ownerId}:${connectionId}:${mode}:v1`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(raw), 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
export function decryptBrokerToken(value, ownerId, connectionId, env, mode = 'paper') {
  try { const decipher = crypto.createDecipheriv('aes-256-gcm', key(env), Buffer.from(value.iv, 'base64')); decipher.setAAD(Buffer.from(`${ownerId}:${connectionId}:${mode}:v1`)); decipher.setAuthTag(Buffer.from(value.tag, 'base64')); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8')); }
  catch { fail('BROKER_AUTHORIZATION_REQUIRED', 'Broker access needs to be connected again.', 403); }
}
export function brokerConfigured(env) { return Boolean(env.ALPACA_OAUTH_CLIENT_ID && env.ALPACA_OAUTH_CLIENT_SECRET && env.ALPACA_OAUTH_REDIRECT_URI && env.PRODUCT_BROKER_TOKEN_KEY); }
export function brokerPaperApproved(env) { return env.PRODUCT_ALPACA_PAPER_COMMERCIAL_APPROVAL === 'true' && typeof env.PRODUCT_ALPACA_APPROVAL_REFERENCE === 'string' && env.PRODUCT_ALPACA_APPROVAL_REFERENCE.length >= 8; }
export function publicConnection(value) { return { id: value.id, provider: 'Alpaca', mode: value.mode, accountLabel: value.accountLabel, status: value.status, authorized: value.status === 'connected', connectedAt: value.connectedAt, lastSyncAt: value.lastSyncAt || null, automationEnabled: value.automationEnabled === true, risk: value.risk || null, positions: value.positions || [], balances: value.balances || null, orders: value.orders || [], stoppedReason: value.stoppedReason || null, manageUrl: BROKER_MANAGEMENT_URL }; }
export function publicBrokerPosition(position, mode) {
  const venue = brokerVenue(position.exchange), identified = venue && /^[A-Z][A-Z0-9.-]{0,14}$/.test(position.symbol || '') && (!position.asset_class || position.asset_class === 'us_equity');
  return { symbol: position.symbol, assetId: position.asset_id, instrumentId: identified ? `${venue}:${position.symbol}:USD` : null, venue: identified ? venue : null, quantity: position.qty, marketValue: position.market_value, averageEntryPrice: position.avg_entry_price, currency: 'USD', source: `Alpaca ${mode}`, origin: 'broker_synchronized' };
}
export async function getBrokerStatus(ctx) {
  const rows = await listAllRecords(ctx.store, 'broker_connections', { ownerId: ctx.user.id, prefix: `${ctx.user.id}:` });
  const release = await liveRelease(ctx);
  return { connections: rows.map(row => publicConnection(row.value)), liveReleaseEnabled: release.enabled, supportedModes: release.enabled ? ['paper', 'live'] : ['paper'], eligibility: 'Alpaca account eligibility and Nortivo commercial approval must be confirmed for each target country. Norwegian live availability is unverified until signed approval evidence exists.', manageUrl: BROKER_MANAGEMENT_URL };
}
export async function connectBroker(ctx, body) {
  requestId(body.requestId); await ctx.requireFeature('broker.connect'); await ctx.requireStepUp('broker');
  if (!['paper', 'live'].includes(body.mode)) fail('INVALID_BROKER_MODE', 'Choose paper or live brokerage explicitly.', 400);
  if (body.mode === 'live') await requireLiveRelease(ctx);
  if (!brokerConfigured(ctx.env) || !brokerPaperApproved(ctx.env)) fail('BROKER_NOT_CONFIGURED', 'Broker connections await approved application configuration.', 503);
  key(ctx.env);
  const redirect = new URL(ctx.env.ALPACA_OAUTH_REDIRECT_URI);
  if (redirect.origin !== ctx.origin || redirect.pathname !== '/.netlify/functions/terminal' || redirect.searchParams.get('action') !== 'product-broker-callback') fail('BROKER_NOT_CONFIGURED', 'The registered broker return route does not match this website.', 503);
  const state = crypto.randomBytes(32).toString('base64url'), stateHash = sha256(state), connectionId = crypto.randomUUID();
  const locale = ctx.account?.locale === 'nb' ? 'nb' : 'en';
  const result = await ctx.store.transact([change('broker_states', stateHash, ctx.user.id, null, { ownerId: ctx.user.id, connectionId, mode: body.mode, redirectUri: redirect.href, returnPath: `/${locale}/terminal/?broker=connected`, expiresAt: ctx.now + 600000, consumed: false }, ctx.now + 600000)]);
  if (result.status !== 'applied') fail('CONCURRENT_UPDATE', 'Broker connection could not start. Try again.', 409);
  const url = new URL('https://app.alpaca.markets/oauth/authorize');
  Object.entries({ response_type: 'code', client_id: ctx.env.ALPACA_OAUTH_CLIENT_ID, redirect_uri: redirect.href, state, scope: 'trading', env: body.mode }).forEach(([name, value]) => url.searchParams.set(name, value));
  return { authorizationUrl: url.href, mode: body.mode, scopes: ['trading'], expiresAt: ctx.now + 600000 };
}

export function createBrokerClient(env, fetcher = fetch) {
  return async function request(connection, route, options = {}) {
    if (!['paper', 'live'].includes(connection.mode)) fail('INVALID_BROKER_MODE', 'The broker account mode is invalid.', 403);
    // Live risk-increasing POST requires independently verified evidence each time. Read/cancel safety survives release suspension.
    if (connection.mode === 'live' && options.method === 'POST' && !options.verifiedRiskReduction) {
      if (!options.releaseContext) fail('LIVE_RELEASE_BLOCKED', 'Live submission requires the verified release context.', 403);
      await requireLiveRelease(options.releaseContext, connection, { automation: options.automated === true });
    }
    const token = options.rawToken || decryptBrokerToken(connection.token, connection.ownerId, connection.id, env, connection.mode);
    if (token.expiresAt && token.expiresAt <= Date.now()) fail('BROKER_AUTHORIZATION_REQUIRED', 'Broker authorization expired. Connect again.', 403);
    let response;
    try { response = await fetcher(`${connection.mode === 'paper' ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets'}/v2/${route}`, { method: options.method || 'GET', headers: { Authorization: `Bearer ${token.accessToken}`, Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}), signal: AbortSignal.timeout(10000), redirect: 'error' }); }
    catch { fail(options.method === 'POST' ? 'BROKER_OUTCOME_UNKNOWN' : 'BROKER_UNAVAILABLE', 'The broker did not confirm this request. Manage your account directly if needed.', 503); }
    if (response.status === 404 && options.allowMissing) return null;
    if (response.status === 401 || response.status === 403) fail('BROKER_AUTHORIZATION_REQUIRED', 'The broker rejected authorization. Connect again or manage the account directly.', 403);
    if (!response.ok) fail(response.status === 422 ? 'BROKER_ORDER_REJECTED' : options.method === 'POST' && response.status >= 500 ? 'BROKER_OUTCOME_UNKNOWN' : 'BROKER_UNAVAILABLE', 'The broker did not accept this request.', response.status === 422 ? 422 : 503);
    if (response.status === 204) return { accepted: true };
    return readJsonResponse(response);
  };
}
export async function handleBrokerCallback(ctx, params) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(params.state || '') || typeof params.code !== 'string' || params.code.length > 500) fail('BROKER_OAUTH_INVALID', 'Broker authorization could not be verified. Start again.', 400);
  const hash = sha256(params.state), row = await ctx.store.get('broker_states', hash);
  if (!row || row.value.consumed || row.value.expiresAt <= ctx.now || !['paper', 'live'].includes(row.value.mode)) fail('BROKER_OAUTH_INVALID', 'This broker authorization is expired or already used.', 400);
  if (row.value.mode === 'live') await requireLiveRelease(ctx);
  if (!brokerConfigured(ctx.env) || !brokerPaperApproved(ctx.env)) fail('BROKER_NOT_CONFIGURED', 'Broker application configuration is unavailable.', 503);
  const consume = await ctx.store.transact([change('broker_states', hash, row.ownerId, row, { ...row.value, consumed: true, consumedAt: ctx.now }, row.value.expiresAt)]);
  if (consume.status !== 'applied') fail('BROKER_OAUTH_INVALID', 'This broker authorization was already used.', 409);
  let response, data;
  try {
    response = await (ctx.fetcher || fetch)('https://api.alpaca.markets/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: params.code, client_id: ctx.env.ALPACA_OAUTH_CLIENT_ID, client_secret: ctx.env.ALPACA_OAUTH_CLIENT_SECRET, redirect_uri: row.value.redirectUri }).toString(), signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw new Error(); data = await readJsonResponse(response, 10000);
  } catch { fail('BROKER_OAUTH_EXCHANGE_FAILED', 'The broker did not complete authorization. Start again.', 503); }
  if (typeof data.access_token !== 'string' || data.access_token.length > 4000 || !String(data.scope || '').split(' ').includes('trading') || String(data.scope).split(' ').some(x => !['trading', ''].includes(x))) fail('BROKER_OAUTH_SCOPES', 'The broker returned an unexpected authorization scope.', 403);
  if (data.token_type && String(data.token_type).toLowerCase() !== 'bearer' || data.expires_in != null && (!Number.isSafeInteger(Number(data.expires_in)) || Number(data.expires_in) <= 0 || Number(data.expires_in) > 365 * 86400)) fail('BROKER_OAUTH_INVALID', 'The broker returned an unsupported token type or expiry.', 502);
  const tokenData = { accessToken: data.access_token, expiresAt: data.expires_in ? ctx.now + Number(data.expires_in) * 1000 : null };
  let value = { id: row.value.connectionId, ownerId: row.ownerId, mode: row.value.mode, status: 'connected', automationEnabled: false, token: encryptBrokerToken(tokenData, row.ownerId, row.value.connectionId, ctx.env, row.value.mode), connectedAt: ctx.now };
  const broker = createBrokerClient(ctx.env, ctx.fetcher), account = await broker(value, 'account');
  if (!/^[A-Za-z0-9-]{8,100}$/.test(account.id || '') || account.status !== 'ACTIVE') fail('BROKER_ACCOUNT_INELIGIBLE', 'This paper account is not active.', 403);
  value.accountId = account.id; value.accountLabel = `${value.mode === 'paper' ? 'Paper' : 'Live'} • ${clean(account.account_number, 24).slice(-6) || account.id.slice(-6)}`;
  const bindingKey = `binding:${value.mode}:${account.id}`, binding = await ctx.store.get('broker_connections', bindingKey);
  if (binding && binding.ownerId !== row.ownerId) fail('BROKER_ACCOUNT_ALREADY_BOUND', 'This brokerage account is already linked to another Nortivo account.', 409);
  const previous = binding ? await owned(ctx.store, 'broker_connections', `${row.ownerId}:${binding.value.connectionId}`, row.ownerId) : null;
  if (previous) value = { ...previous.value, ...value, id: previous.value.id, token: encryptBrokerToken(tokenData, row.ownerId, previous.value.id, ctx.env, value.mode), liveConsent: null, automationEnabled: false, stoppedReason: 'Reconnected. Review and authorize automation again; existing intents will reconcile against this same account.' };
  const result = await ctx.store.transact([change('broker_connections', `${row.ownerId}:${value.id}`, row.ownerId, previous, value), change('broker_connections', bindingKey, row.ownerId, binding, { ownerId: row.ownerId, connectionId: value.id, mode: value.mode })]);
  if (result.status !== 'applied') fail('BROKER_CONNECTION_CONFLICT', 'The brokerage account was updated concurrently. Start again.', 409);
  await updateRecord(ctx.store, 'provider_health', 'broker', SYSTEM_OWNER, current => ({ ...current, provider: 'Alpaca', reachable: true, lastSuccessAt: ctx.now, verifiedMode: value.mode, appClientId: ctx.env.ALPACA_OAUTH_CLIENT_ID }));
  return { connected: true, mode: value.mode, connection: publicConnection(value), returnPath: row.value.returnPath || '/en/terminal/?broker=connected' };
}
export async function syncBroker(ctx, connectionId) {
  const row = await owned(ctx.store, 'broker_connections', `${ctx.user.id}:${connectionId}`, ctx.user.id), broker = createBrokerClient(ctx.env, ctx.fetcher);
  if (row.value.status !== 'connected') fail('BROKER_AUTHORIZATION_REQUIRED', 'Connect this brokerage account again.', 403);
  try {
    const [account, positions, orders] = await Promise.all([broker(row.value, 'account'), broker(row.value, 'positions'), broker(row.value, 'orders?status=open&limit=500&nested=true')]);
    if (account.id !== row.value.accountId || account.currency !== 'USD' || !Array.isArray(positions) || !Array.isArray(orders)) fail('BROKER_ACCOUNT_MISMATCH', 'The broker account and USD currency could not be verified.', 403);
    if (orders.length >= 500) fail('BROKER_ORDER_SNAPSHOT_INCOMPLETE', 'The broker returned the maximum open-order page. A complete account snapshot is unavailable; manage the account directly at Alpaca.', 409);
    const value = await updateRecord(ctx.store, 'broker_connections', `${ctx.user.id}:${connectionId}`, ctx.user.id, current => ({ ...current, lastSyncAt: ctx.now, accountStatus: account.status, tradingBlocked: account.trading_blocked || account.account_blocked, balances: { currency: account.currency, cash: account.cash, equity: account.equity, buyingPower: account.buying_power, lastEquity: account.last_equity }, positions: positions.map(p => publicBrokerPosition(p, current.mode)), orders: orders.map(o => ({ id: o.id, clientOrderId: o.client_order_id, symbol: o.symbol, side: o.side, quantity: o.qty, filledQuantity: o.filled_qty, status: o.status, orderClass: o.order_class, type: o.type, updatedAt: o.updated_at, legs: (o.legs || []).map(x => ({ id: x.id, symbol: x.symbol, side: x.side, type: x.type, status: x.status })) })) }));
    await updateRecord(ctx.store, 'provider_health', 'broker', SYSTEM_OWNER, current => ({ ...current, provider: 'Alpaca', reachable: true, lastSuccessAt: ctx.now, verifiedMode: value.mode, appClientId: ctx.env.ALPACA_OAUTH_CLIENT_ID }));
    return publicConnection(value);
  } catch (error) { if (error.code === 'BROKER_AUTHORIZATION_REQUIRED') await updateRecord(ctx.store, 'broker_connections', `${ctx.user.id}:${connectionId}`, ctx.user.id, current => ({ ...current, status: 'authorization_required', automationEnabled: false, stoppedReason: 'Broker authorization was revoked or expired.' })); throw error; }
}
export async function brokerControl(ctx, action, body) {
  requestId(body.requestId);
  const key = `${ctx.user.id}:${body.connectionId}`, row = await owned(ctx.store, 'broker_connections', key, ctx.user.id);
  if (action === 'product-broker-stop') {
    const value = await updateRecord(ctx.store, 'broker_connections', key, ctx.user.id, current => ({ ...current, automationEnabled: false, stoppedAt: ctx.now, stoppedReason: 'Stopped by account owner. Existing broker orders, including protective stops, remain active.' }));
    return { connection: publicConnection(value), existingOrders: 'preserved', manageUrl: BROKER_MANAGEMENT_URL };
  }
  await ctx.requireStepUp('broker');
  if (action === 'product-broker-disconnect') {
    const value = await updateRecord(ctx.store, 'broker_connections', key, ctx.user.id, current => ({ ...current, automationEnabled: false, status: 'disconnected', token: null, disconnectedAt: ctx.now, stoppedReason: 'Disconnected. Existing broker orders remain at the broker.' }));
    return { connection: publicConnection(value), revokeAtBroker: BROKER_MANAGEMENT_URL, message: 'Stored access was erased. Revoke the application in Alpaca to revoke the grant. Existing orders remain at the broker.' };
  }
  if (action === 'product-broker-consent') {
    await ctx.requireFeature(body.automationEnabled === true ? 'automation.run' : 'broker.connect'); await ctx.requireStepUp('execution');
    const r = body.risk;
    if (!r || !['maxOrderNotional', 'maxPositionNotional', 'maxDailyLoss'].every(k => /^\d{1,7}(?:\.\d{1,2})?$/.test(String(r[k])) && Number(r[k]) > 0) || !Number.isInteger(r.maxOrdersPerDay) || r.maxOrdersPerDay < 1 || r.maxOrdersPerDay > 100) fail('INVALID_RISK_LIMITS', 'Set positive position, order, daily-loss and frequency limits.', 400);
    const strategy = body.automationEnabled === true ? await owned(ctx.store, 'strategies', `${ctx.user.id}:${body.strategyId}`, ctx.user.id) : null;
    if (strategy && (strategy.value.enabled !== true || strategy.value.mode !== row.value.mode || strategy.value.connectionId !== body.connectionId)) fail('STRATEGY_NOT_READY', 'Choose a saved, enabled strategy for this account and mode.', 400);
    if (row.value.status !== 'connected') fail('BROKER_AUTHORIZATION_REQUIRED', 'Connect the paper account first.', 403);
    const liveConsent = row.value.mode === 'live' ? { acceptedAt: ctx.now, accountId: row.value.accountId, requestId: body.requestId } : null;
    if (row.value.mode === 'live') {
      if (body.liveConsentConfirmed !== true) fail('LIVE_CONSENT_REQUIRED', 'Confirm that this enables transmission to the selected real-money brokerage account.', 400);
      await requireLiveRelease(ctx, { ...row.value, liveConsent }, { automation: body.automationEnabled === true });
    }
    const value = await updateRecord(ctx.store, 'broker_connections', key, ctx.user.id, current => ({ ...current, risk: r, automationEnabled: body.automationEnabled === true, strategyId: strategy?.value.id || null, strategyVersion: strategy?.value.version || null, liveConsent, consent: { acceptedAt: ctx.now, requestId: body.requestId, digest: commandDigest({ risk: r, strategyId: strategy?.value.id || null, version: strategy?.value.version || null }) }, stoppedReason: null }));
    return { connection: publicConnection(value), mode: row.value.mode };
  }
  fail('UNKNOWN_ACTION', 'This broker action is unavailable.', 404);
}
