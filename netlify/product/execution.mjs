import crypto from 'node:crypto';
import { fail, commandDigest, sha256 } from '../terminal/security.mjs';
import { change, owned, requestId, decimal, updateRecord, listAllRecords } from './providers-core.mjs';
import { instrument, brokerVenue } from './providers-data.mjs';
import { createBrokerClient, syncBroker, BROKER_MANAGEMENT_URL } from './broker.mjs';
import { requireLiveRelease } from './broker-release.mjs';

export const TERMINAL_ORDER_STATES = new Set(['filled', 'rejected', 'canceled', 'expired', 'replaced']);
const known = new Set(['pending', 'submitting', 'unknown', 'manual_review', 'new', 'accepted', 'pending_new', 'accepted_for_bidding', 'partially_filled', 'filled', 'rejected', 'pending_cancel', 'canceled', 'expired', 'replaced', 'pending_replace', 'done_for_day', 'stopped', 'suspended', 'calculated', 'held']);
const units = value => { if (!/^-?\d{1,15}(?:\.\d{1,8})?$/.test(String(value))) fail('INVALID_DECIMAL', 'A broker amount is invalid.', 502); const [whole, fraction = ''] = String(value).replace('-', '').split('.'); return (String(value).startsWith('-') ? -1n : 1n) * (BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'))); };
const amount = n => `${n / 100000000n}.${String(n % 100000000n).padStart(8, '0')}`;
function remainingOrderQuantity(order) {
  let quantity, filled;
  try { quantity = units(order.qty); filled = units(order.filled_qty); }
  catch { fail('BROKER_EVENT_INVALID', 'An outstanding order has invalid quantity or fills. Reconcile the broker account before trading.', 502); }
  if (quantity <= 0n || filled < 0n || filled > quantity) fail('BROKER_EVENT_INVALID', 'An outstanding order has invalid quantity or fills. Reconcile the broker account before trading.', 502);
  return quantity - filled;
}
function activeBrokerOrders(orders) {
  if (!Array.isArray(orders)) fail('BROKER_SNAPSHOT_INVALID', 'The broker open-order snapshot is invalid.', 502);
  const seen = new Map(), active = []; let visited = 0, unique = 0;
  const visit = (rows, depth) => {
    if (depth > 4) fail('BROKER_ORDER_SNAPSHOT_INCOMPLETE', 'The nested broker order snapshot exceeds supported limits. Manage the account directly at Alpaca.', 409);
    for (const order of rows) {
      if (++visited > 2000) fail('BROKER_ORDER_SNAPSHOT_INCOMPLETE', 'The nested broker order snapshot exceeds supported limits. Manage the account directly at Alpaca.', 409);
      if (!order || typeof order !== 'object' || Array.isArray(order) || order.legs != null && !Array.isArray(order.legs)) fail('BROKER_SNAPSHOT_INVALID', 'A broker order or its protective legs could not be verified.', 502);
      const id = order.id;
      if (id != null && (typeof id !== 'string' || !id || id.length > 100)) fail('BROKER_EVENT_INVALID', 'A broker order identity is invalid.', 502);
      const fingerprint = JSON.stringify(['client_order_id', 'symbol', 'side', 'qty', 'filled_qty', 'status', 'type', 'limit_price', 'stop_price', 'order_class', 'replaced_by', 'updated_at'].map(field => order[field] ?? null));
      if (id && seen.has(id) && seen.get(id) !== fingerprint) fail('BROKER_EVENT_INVALID', 'Conflicting versions of the same broker order require reconciliation before trading.', 502);
      const duplicate = id && seen.has(id);
      if (!duplicate) {
        if (++unique >= 500) fail('BROKER_ORDER_SNAPSHOT_INCOMPLETE', 'The complete nested broker order snapshot exceeds supported capacity. Manage the account directly at Alpaca.', 409);
        if (id) seen.set(id, fingerprint);
        if (!TERMINAL_ORDER_STATES.has(order.status)) { remainingOrderQuantity(order); active.push(order); }
      }
      if (order.legs?.length) visit(order.legs, depth + 1);
    }
  };
  visit(orders, 0);
  return active;
}
export function mergeBrokerOrder(current, event) {
  if (!event || event.client_order_id !== current.clientOrderId || !known.has(event.status) || !event.id || !/^[A-Za-z0-9-]{8,100}$/.test(event.id)) fail('BROKER_EVENT_INVALID', 'The broker order identity could not be verified.', 502);
  if (event.symbol !== current.symbol || event.side !== current.side || units(event.qty) !== units(current.quantity)) fail('BROKER_EVENT_INVALID', 'The broker order does not match its saved intent.', 502);
  const filled = units(event.filled_qty || '0'), previous = units(current.filledQuantity || '0');
  if (filled < 0n || filled > units(current.quantity)) fail('BROKER_EVENT_INVALID', 'The broker reported an invalid fill quantity.', 502);
  const at = Date.parse(event.updated_at || event.submitted_at || event.created_at);
  if (!Number.isFinite(at)) fail('BROKER_EVENT_INVALID', 'The broker order has no valid timestamp.', 502);
  if (filled < previous || at < (current.brokerUpdatedAt || 0) && filled <= previous) return current;
  if (TERMINAL_ORDER_STATES.has(current.status) && !TERMINAL_ORDER_STATES.has(event.status) && filled <= previous) return current;
  const status = filled === units(current.quantity) ? 'filled' : event.status;
  return { ...current, brokerOrderId: event.id, status, filledQuantity: event.filled_qty || '0', averageFillPrice: event.filled_avg_price || null, brokerUpdatedAt: Math.max(at, current.brokerUpdatedAt || 0), replacedBy: event.replaced_by || current.replacedBy || null, replaces: event.replaces || current.replaces || null };
}
export async function applyBrokerOrder(ctx, intentRow, event) {
  const eventKey = `${ctx.user.id}:${sha256(`${event.id}:${event.updated_at}:${event.status}:${event.filled_qty}`).slice(0, 40)}`;
  for (let i = 0; i < 8; i++) {
    const row = i ? await owned(ctx.store, 'order_intents', intentRow.key, ctx.user.id) : intentRow;
    const seen = await ctx.store.get('broker_events', eventKey); if (seen) return row.value;
    const value = mergeBrokerOrder(row.value, event);
    const result = await ctx.store.transact([change('order_intents', row.key, ctx.user.id, row, value), change('broker_events', eventKey, ctx.user.id, null, { intentId: row.value.id, brokerOrderId: event.id, status: event.status, filledQuantity: event.filled_qty, receivedAt: ctx.now })]);
    if (result.status === 'applied') return value;
  }
  fail('CONCURRENT_UPDATE', 'Order reconciliation is busy. Try again.', 409);
}
export async function acquireAccountLease(store, ownerId, holder, now, ttl = 45000) {
  const key = ownerId;
  for (let i = 0; i < 8; i++) {
    const row = await store.get('worker_leases', key);
    if (row && row.value.expiresAt > now && row.value.holder !== holder) return null;
    const value = { holder, fence: (row?.value.fence || 0) + 1, acquiredAt: now, expiresAt: now + ttl };
    if ((await store.transact([change('worker_leases', key, ownerId, row, value)])).status === 'applied') return value;
  }
  return null;
}
export async function assertAccountLease(store, ownerId, lease, now) {
  const row = await owned(store, 'worker_leases', ownerId, ownerId);
  if (row.value.fence !== lease.fence || row.value.holder !== lease.holder || row.value.expiresAt <= now) fail('WORKER_LEASE_LOST', 'Execution ownership expired. Reconciliation is required.', 409);
  return row;
}
export async function releaseAccountLease(store, ownerId, lease, now) {
  const row = await store.get('worker_leases', ownerId);
  if (row?.value.holder === lease.holder && row.value.fence === lease.fence) await store.transact([change('worker_leases', ownerId, ownerId, row, { ...row.value, expiresAt: now })]);
}
export async function renewAccountLease(store, ownerId, lease, now, ttl = 45000) {
  const row = await assertAccountLease(store, ownerId, lease, now);
  const result = await store.transact([change('worker_leases', ownerId, ownerId, row, { ...row.value, expiresAt: now + ttl })]);
  if (result.status !== 'applied') fail('WORKER_LEASE_LOST', 'Execution ownership changed during renewal.', 409);
}

export async function enqueueOrder(ctx, body, { automated = false, strategyVersion = null } = {}) {
  const rid = requestId(body.requestId), selected = instrument(body.instrumentId);
  if (!body.reduceOnly) await ctx.requireFeature(automated ? 'automation.run' : 'order.submit');
  if (!automated) { await ctx.requireStepUp('execution'); if (body.confirmed !== true) fail('ORDER_CONFIRMATION_REQUIRED', 'Review and confirm this order before submission.', 400); }
  if (!['buy', 'sell'].includes(body.side) || !['market', 'limit'].includes(body.type) || body.timeInForce !== 'day' || !decimal(body.quantity) || !/^\d+$/.test(String(body.quantity)) || Number(body.quantity) > 100000 || body.type === 'limit' && !decimal(body.limitPrice)) fail('UNSUPPORTED_ORDER', 'Use a whole-share US stock or ETF market/limit day order.', 400);
  if (body.type === 'limit' && !new RegExp(`^\\d+(?:\\.\\d{1,${Number(body.limitPrice) >= 1 ? 2 : 4}})?$`).test(String(body.limitPrice))) fail('INVALID_LIMIT_PRICE', 'US equity limit prices support two decimal places at $1 or above and four below $1.', 400);
  if (body.reduceOnly && body.side !== 'sell') fail('UNSUPPORTED_ORDER', 'This release supports reducing a long position by selling.', 400);
  const connection = await owned(ctx.store, 'broker_connections', `${ctx.user.id}:${body.connectionId}`, ctx.user.id);
  if (!['paper', 'live'].includes(connection.value.mode) || connection.value.status !== 'connected') fail('BROKER_AUTHORIZATION_REQUIRED', 'Connect an authorized brokerage account first.', 403);
  if (connection.value.mode === 'live' && !body.reduceOnly) await requireLiveRelease(ctx, connection.value, { automation: automated });
  if (automated && !body.reduceOnly && (!connection.value.automationEnabled || connection.value.strategyVersion !== strategyVersion)) fail('AUTOMATION_STOPPED', 'Automation is stopped or the strategy has changed.', 403);
  const digest = commandDigest({ connectionId: body.connectionId, instrumentId: body.instrumentId, side: body.side, quantity: body.quantity, type: body.type, limitPrice: body.limitPrice || null, reduceOnly: body.reduceOnly === true, automated, strategyVersion }), key = `${ctx.user.id}:${rid}`;
  const existing = await ctx.store.get('order_intents', key);
  if (existing) { if (existing.ownerId !== ctx.user.id || existing.value.digest !== digest) fail('IDEMPOTENCY_CONFLICT', 'This order request ID was already used.', 409); return { intent: existing.value, replayed: true, mode: connection.value.mode }; }
  const value = { id: rid, digest, ownerId: ctx.user.id, connectionId: body.connectionId, accountId: connection.value.accountId, mode: connection.value.mode, instrumentId: selected.id, symbol: selected.symbol, venue: selected.venue, side: body.side, quantity: String(body.quantity), type: body.type, limitPrice: body.type === 'limit' ? body.limitPrice : null, timeInForce: 'day', reduceOnly: body.reduceOnly === true, automated, strategyVersion, clientOrderId: `ntv-${sha256(`${ctx.user.id}:${rid}`).slice(0, 40)}`, status: 'pending', filledQuantity: '0', createdAt: ctx.now, expiresAt: ctx.now + 120000 };
  const result = await ctx.store.transact([change('order_intents', key, ctx.user.id, null, value)]);
  if (result.status !== 'applied') return enqueueOrder(ctx, body, { automated, strategyVersion });
  return { intent: value, mode: connection.value.mode, queued: true, message: 'Saved for the background worker. Broker acceptance and fills are not yet confirmed.' };
}
export function validateRisk({ intent, connection, quote, account, positions, openOrders, recentIntents, clock, now }) {
  const qty = units(intent.quantity), position = positions.find(p => p.symbol === intent.symbol), held = units(position?.qty || '0');
  const brokerOrders = activeBrokerOrders(openOrders), brokerIds = new Set(brokerOrders.map(o => o.client_order_id));
  const locallyAccepted = recentIntents.filter(o => o.id !== intent.id && o.connectionId === intent.connectionId && !TERMINAL_ORDER_STATES.has(o.status) && !['pending', 'submitting', 'unknown', 'manual_review'].includes(o.status) && !brokerIds.has(o.clientOrderId)).map(o => ({ symbol: o.symbol, side: o.side, qty: o.quantity, filled_qty: o.filledQuantity || '0', limit_price: o.limitPrice }));
  for (const order of locallyAccepted) remainingOrderQuantity(order);
  const outstanding = [...brokerOrders, ...locallyAccepted];
  if (!['paper', 'live'].includes(connection.mode) || intent.mode !== connection.mode || account.id !== connection.accountId || intent.accountId !== account.id || account.currency !== 'USD') fail('BROKER_ACCOUNT_MISMATCH', 'The brokerage account, USD currency and execution mode could not be verified.', 403);
  if (account.status !== 'ACTIVE' || account.trading_blocked || account.account_blocked) fail('BROKER_ACCOUNT_BLOCKED', 'The broker account is not available for trading.', 403);
  if (!clock.is_open || !Number.isFinite(Date.parse(clock.timestamp)) || Math.abs(now - Date.parse(clock.timestamp)) > 60000) fail('MARKET_CLOSED', 'Orders require a verified open regular market session.', 409);
  const openSells = outstanding.filter(o => o.symbol === intent.symbol && o.side === 'sell').reduce((sum, o) => sum + remainingOrderQuantity(o), 0n);
  if (intent.reduceOnly) {
    if (intent.side !== 'sell' || held <= 0n || qty > held - openSells) fail('RISK_REDUCTION_UNVERIFIED', 'This sell could exceed the available long position. Review existing and protective orders at the broker.', 409);
    return { reduceOnly: true };
  }
  const quoteTime = Date.parse(quote.asOf);
  if (quote.instrumentId !== intent.instrumentId || !decimal(quote.price) || quote.freshness !== 'current' || !quote.executionEligible || !Number.isFinite(quoteTime) || quoteTime > now + 60000 || now - quoteTime > 120000) fail('STALE_DATA', 'New orders are paused until authorized current prices are available.', 409);
  const risk = connection.risk;
  if (!risk) fail('RISK_LIMITS_REQUIRED', 'Set account risk limits before placing new orders.', 409);
  if (locallyAccepted.some(o => o.side === 'buy' && o.symbol !== intent.symbol && !o.limit_price)) fail('EXECUTION_UNRESOLVED', 'A market order for another instrument has not appeared in the authoritative open-order snapshot. Entries await reconciliation.', 409);
  const marketPrice = units(quote.price), limitPrice = units(intent.limitPrice || quote.price), price = limitPrice > marketPrice ? limitPrice : marketPrice, notional = qty * price / 100000000n;
  if (notional > units(risk.maxOrderNotional)) fail('ORDER_LIMIT', 'This order exceeds the account order-size limit.', 409);
  // Alpaca's available buying_power already reserves unfilled buy-long orders. Never subtract them twice
  // or guess the price of an unrelated symbol. See official Placing Orders / Buying Power.
  if (intent.side === 'buy' && notional > units(account.buying_power || '0')) fail('BUYING_POWER', 'The broker’s available buying power cannot cover this order.', 409);
  const pendingExposure = outstanding.filter(o => o.symbol === intent.symbol && o.side === 'buy').reduce((sum, o) => {
    const remaining = remainingOrderQuantity(o), openLimit = units(o.limit_price || quote.price);
    return sum + remaining * (openLimit > marketPrice ? openLimit : marketPrice) / 100000000n;
  }, 0n);
  if (intent.side === 'buy' && held * marketPrice / 100000000n + pendingExposure + notional > units(risk.maxPositionNotional)) fail('POSITION_LIMIT', 'This order and outstanding buys exceed the configured position limit.', 409);
  if (intent.side === 'sell' && qty > held - openSells) fail('SHORTING_UNSUPPORTED', 'Short selling is not supported in this release.', 409);
  if (units(account.last_equity || '0') - units(account.equity || '0') >= units(risk.maxDailyLoss)) fail('DAILY_LOSS_LIMIT', 'New orders are paused at the daily account-loss limit.', 409);
  const day = new Date(now).toISOString().slice(0, 10);
  if (recentIntents.filter(o => o.id !== intent.id && o.connectionId === intent.connectionId && new Date(o.createdAt).toISOString().slice(0, 10) === day && !['pending', 'rejected', 'expired'].includes(o.status)).length >= risk.maxOrdersPerDay) fail('ORDER_FREQUENCY_LIMIT', 'The daily order-frequency limit is reached.', 409);
  return { estimatedNotional: amount(notional), currency: 'USD', quoteAsOf: quote.asOf };
}

export async function reconcileIntent(ctx, row, broker, connection) {
  const result = await broker(connection, `orders:by_client_order_id?client_order_id=${encodeURIComponent(row.value.clientOrderId)}`, { allowMissing: true });
  if (result) return applyBrokerOrder(ctx, row, result);
  if (['submitting', 'unknown', 'pending_cancel'].includes(row.value.status)) {
    return updateRecord(ctx.store, 'order_intents', row.key, ctx.user.id, current => ({ ...current, status: 'manual_review', reason: 'The original order was not found after an ambiguous outcome. No resubmission occurred. Verify with the broker.', reconciledAt: ctx.now }));
  }
  return row.value;
}
export async function processOrder(ctx, row, lease, providers) {
  const connectionKey = `${ctx.user.id}:${row.value.connectionId}`, connectionRow = await owned(ctx.store, 'broker_connections', connectionKey, ctx.user.id), broker = createBrokerClient(ctx.env, ctx.fetcher);
  if (row.value.status !== 'pending') return reconcileIntent(ctx, row, broker, connectionRow.value);
  let transmissionAttempted = false;
  const failIntent = async error => updateRecord(ctx.store, 'order_intents', row.key, ctx.user.id, current => TERMINAL_ORDER_STATES.has(current.status) ? current : ({ ...current, status: error.code === 'BROKER_OUTCOME_UNKNOWN' || transmissionAttempted && error.code !== 'BROKER_ORDER_REJECTED' ? 'unknown' : 'rejected', reason: error.message, errorCode: error.code || 'EXECUTION_UNCONFIRMED', updatedAt: ctx.now }));
  try {
    if (row.value.expiresAt <= ctx.now) fail('ORDER_EXPIRED', 'This pending order expired before submission.', 409);
    if (!row.value.reduceOnly) await ctx.requireFeature(row.value.automated ? 'automation.run' : 'order.submit');
    if (connectionRow.value.mode === 'live' && !row.value.reduceOnly) await requireLiveRelease(ctx, connectionRow.value, { automation: row.value.automated });
    if (row.value.automated && !row.value.reduceOnly && (!connectionRow.value.automationEnabled || connectionRow.value.strategyVersion !== row.value.strategyVersion)) fail('AUTOMATION_STOPPED', 'Automation was stopped or the strategy changed.', 403);
    const all = await listAllRecords(ctx.store, 'order_intents', { ownerId: ctx.user.id, prefix: `${ctx.user.id}:` });
    const unresolved = all.some(r => {
      const prior = r.value;
      if (r.key === row.key || !['submitting', 'unknown', 'manual_review', 'pending_replace'].includes(prior.status)) return false;
      if (row.value.reduceOnly) return prior.connectionId === row.value.connectionId && prior.symbol === row.value.symbol && prior.side === 'sell';
      return prior.connectionId === row.value.connectionId || prior.accountId === row.value.accountId && prior.mode === row.value.mode;
    });
    if (unresolved) fail('EXECUTION_UNRESOLVED', row.value.reduceOnly ? 'This position has an unresolved sell that could race with another reduction. Reconcile that order at the broker first.' : 'New entries await reconciliation of an earlier order in this brokerage account.', 409);
    const [account, positions, openOrders, marketClock, asset, quoted] = await Promise.all([broker(connectionRow.value, 'account'), broker(connectionRow.value, 'positions'), broker(connectionRow.value, 'orders?status=open&limit=500&nested=true'), broker(connectionRow.value, 'clock'), broker(connectionRow.value, `assets/${encodeURIComponent(row.value.symbol)}`), row.value.reduceOnly ? Promise.resolve({ quote: {} }) : providers.quotes({ instrumentId: row.value.instrumentId })]);
    if (!Array.isArray(positions) || !Array.isArray(openOrders)) fail('BROKER_SNAPSHOT_INVALID', 'The broker position or order snapshot could not be verified. Manage the account directly at Alpaca.', 502);
    if (openOrders.length >= 500) fail('BROKER_ORDER_SNAPSHOT_INCOMPLETE', 'The broker returned the maximum open-order page. Trading requires a complete snapshot; manage the account directly at Alpaca.', 409);
    if (!asset.tradable || asset.status !== 'active' || asset.class !== 'us_equity' || asset.symbol !== row.value.symbol || brokerVenue(asset.exchange) !== row.value.venue) fail('UNSUPPORTED_INSTRUMENT', 'The broker has not confirmed this instrument and venue as tradable.', 403);
    const estimate = validateRisk({ intent: row.value, connection: connectionRow.value, quote: quoted.quote, account, positions, openOrders, recentIntents: all.map(x => x.value), clock: marketClock, now: ctx.now });
    const leaseRow = await assertAccountLease(ctx.store, ctx.user.id, lease, Date.now());
    // Fence intent transition and the exact connection version reviewed above in one transaction.
    const commit = await ctx.store.transact([change('order_intents', row.key, ctx.user.id, row, { ...row.value, status: 'submitting', submissionStartedAt: ctx.now, leaseFence: lease.fence, estimate }), change('worker_leases', ctx.user.id, ctx.user.id, leaseRow, leaseRow.value), change('broker_connections', connectionKey, ctx.user.id, connectionRow, connectionRow.value)]);
    if (commit.status !== 'applied') fail('EXECUTION_CHANGED', 'The account changed during review. This order was not transmitted.', 409);
    if (!row.value.reduceOnly) await ctx.requireFeature(row.value.automated ? 'automation.run' : 'order.submit');
    const current = await owned(ctx.store, 'broker_connections', connectionKey, ctx.user.id);
    if (current.version !== connectionRow.version + 1) fail('EXECUTION_CHANGED', 'Account settings changed after order review. This order was not transmitted.', 409);
    if (current.value.status !== 'connected' || row.value.automated && !row.value.reduceOnly && !current.value.automationEnabled) fail('AUTOMATION_STOPPED', 'Automation was stopped before submission.', 403);
    await assertAccountLease(ctx.store, ctx.user.id, lease, Date.now());
    transmissionAttempted = true;
    const response = await broker(current.value, 'orders', { method: 'POST', releaseContext: { ...ctx, now: Date.now() }, automated: row.value.automated, verifiedRiskReduction: row.value.reduceOnly === true, body: { symbol: row.value.symbol, qty: row.value.quantity, side: row.value.side, type: row.value.type, time_in_force: 'day', client_order_id: row.value.clientOrderId, extended_hours: false, ...(row.value.limitPrice ? { limit_price: row.value.limitPrice } : {}) } });
    return applyBrokerOrder(ctx, await owned(ctx.store, 'order_intents', row.key, ctx.user.id), response);
  } catch (error) { return failIntent(error); }
}
export async function cancelOrder(ctx, body) {
  requestId(body.requestId); await ctx.requireStepUp('execution');
  const row = await owned(ctx.store, 'order_intents', `${ctx.user.id}:${body.intentId}`, ctx.user.id), connection = await owned(ctx.store, 'broker_connections', `${ctx.user.id}:${row.value.connectionId}`, ctx.user.id);
  if (TERMINAL_ORDER_STATES.has(row.value.status)) return { intent: row.value, unchanged: true };
  if (row.value.status === 'pending') {
    const value = { ...row.value, status: 'canceled', canceledBeforeSubmission: true, updatedAt: ctx.now };
    if ((await ctx.store.transact([change('order_intents', row.key, ctx.user.id, row, value)])).status === 'applied') return { intent: value };
    return cancelOrder(ctx, body); // A worker may have begun transmission; never label that locally cancelled.
  }
  const broker = createBrokerClient(ctx.env, ctx.fetcher), original = await broker(connection.value, `orders:by_client_order_id?client_order_id=${encodeURIComponent(row.value.clientOrderId)}`, { allowMissing: true });
  if (!original) fail('BROKER_ORDER_UNRESOLVED', 'The broker order cannot be located. Manage it directly at Alpaca.', 409);
  if (['stop', 'stop_limit', 'trailing_stop'].includes(original.type) && body.confirmedProtective !== true) fail('PROTECTIVE_ORDER_CONFIRMATION', 'Confirm that cancelling this protective order removes its protection.', 409);
  await broker(connection.value, `orders/${encodeURIComponent(original.id)}`, { method: 'DELETE' });
  const value = await updateRecord(ctx.store, 'order_intents', row.key, ctx.user.id, current => ({ ...current, status: 'pending_cancel', cancelRequestedAt: ctx.now }));
  return { intent: value, message: 'Cancellation requested. Only the broker can confirm cancellation or a racing fill.', manageUrl: BROKER_MANAGEMENT_URL };
}
export async function listOrders(ctx, params = {}) {
  const rows = await ctx.store.list('order_intents', { ownerId: ctx.user.id, prefix: `${ctx.user.id}:`, limit: 1000, ...(params.afterKey ? { afterKey: params.afterKey } : {}) });
  return { intents: rows.map(row => row.value), nextCursor: rows.length === 1000 ? rows.at(-1).key : null, manageUrl: BROKER_MANAGEMENT_URL };
}
