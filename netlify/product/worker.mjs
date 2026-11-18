import crypto from 'node:crypto';
import { change, owned, updateRecord, SYSTEM_OWNER, listAllRecords, recordPages } from './providers-core.mjs';
import { acquireAccountLease, releaseAccountLease, renewAccountLease, processOrder, reconcileIntent, enqueueOrder, TERMINAL_ORDER_STATES } from './execution.mjs';
import { createBrokerClient, syncBroker } from './broker.mjs';
import { requireEntitlement } from './entitlements.mjs';
import { createDataProviders } from './providers-data.mjs';
import { signals } from './execution-strategy.mjs';

export async function runAccountTick({ store, env, fetcher = fetch, ownerId, holder = crypto.randomUUID(), clock = Date.now, providers: suppliedProviders }) {
  const lease = await acquireAccountLease(store, ownerId, holder, clock()); if (!lease) return { status: 'leased_elsewhere' };
  const leaseHeartbeat = setInterval(() => { renewAccountLease(store, ownerId, lease, clock()).catch(() => {}); }, 10000);
  const accountContext = () => ({ store, env, fetcher, now: clock(), user: { id: ownerId }, requireFeature: async feature => { const account = await store.get('accounts', ownerId); return requireEntitlement(account?.value || {}, feature, clock()); }, requireStepUp: () => { throw new Error('Worker cannot grant step-up authentication.'); } });
  const providers = suppliedProviders || createDataProviders(env, fetcher, store, clock);
  let reconciled = 0, processed = 0;
  try {
    const connections = (await listAllRecords(store, 'broker_connections', { ownerId, prefix: `${ownerId}:` })).filter(x => x.value.status === 'connected' && ['paper', 'live'].includes(x.value.mode));
    for (const connectionRow of connections) {
      let ctx = accountContext(), connection = connectionRow.value, broker = createBrokerClient(env, fetcher);
      // Restart always reconciles actual positions/open orders and all nonterminal intents before entries.
      await syncBroker(ctx, connection.id);
      const intents = await listAllRecords(store, 'order_intents', { ownerId, prefix: `${ownerId}:` });
      for (const row of intents.filter(r => r.value.connectionId === connection.id && r.value.status !== 'pending' && !TERMINAL_ORDER_STATES.has(r.value.status))) { await reconcileIntent(accountContext(), row, broker, connection); reconciled++; }
      let canEnter = true;
      try { await ctx.requireFeature('automation.run'); }
      catch { canEnter = false; await updateRecord(store, 'broker_connections', `${ownerId}:${connection.id}`, ownerId, current => ({ ...current, automationEnabled: false, stoppedReason: 'Subscription no longer permits automation. Existing protective orders remain at the broker. Stop, cancel and verified risk reduction remain available.', accessLostAt: clock() })); }
      for (const row of intents.filter(r => r.value.connectionId === connection.id && r.value.status === 'pending')) { await processOrder(accountContext(), row, lease, providers); processed++; }
      connection = (await owned(store, 'broker_connections', `${ownerId}:${connection.id}`, ownerId)).value;
      if (!canEnter || !connection.automationEnabled || !connection.strategyId) continue;
      const strategyRow = await owned(store, 'strategies', `${ownerId}:${connection.strategyId}`, ownerId), strategy = strategyRow.value;
      if (!strategy.enabled || strategy.version !== connection.strategyVersion) { await updateRecord(store, 'broker_connections', `${ownerId}:${connection.id}`, ownerId, current => ({ ...current, automationEnabled: false, stoppedReason: 'Strategy version changed; review and authorize again.' })); continue; }
      const { bars } = await providers.history({ instrumentId: strategy.instrumentId }), signal = signals(bars, strategy, clock()).at(-1);
      if (!signal || signal.time === strategy.lastEvaluatedBar) continue;
      const current = await owned(store, 'strategies', `${ownerId}:${strategy.id}`, ownerId);
      // Deterministic order ID across restart/version/account/bar prevents duplicate strategy entries.
      const id = `strategy-${strategy.id}-${strategy.version}-${signal.time.slice(0, 10)}`;
      const position = connection.positions.find(p => p.symbol === strategy.instrumentId.split(':')[1]), held = Number(position?.quantity || 0);
      if (signal.signal === 'buy' && held === 0 || signal.signal === 'sell' && held > 0) {
        const order = await enqueueOrder(accountContext(), { requestId: id, connectionId: connection.id, instrumentId: strategy.instrumentId, side: signal.signal, quantity: signal.signal === 'sell' ? String(Math.min(held, Number(strategy.quantity))) : strategy.quantity, type: 'market', timeInForce: 'day', reduceOnly: signal.signal === 'sell' }, { automated: true, strategyVersion: strategy.version });
        const intent = await owned(store, 'order_intents', `${ownerId}:${order.intent.id}`, ownerId);
        if (intent.value.status === 'pending') { await processOrder(accountContext(), intent, lease, providers); processed++; }
      }
      await store.transact([change('strategies', `${ownerId}:${strategy.id}`, ownerId, current, { ...current.value, lastEvaluatedBar: signal.time, lastSignal: signal.signal, lastEvaluatedAt: clock() })]);
    }
    return { status: 'completed', reconciled, processed };
  } finally { clearInterval(leaseHeartbeat); await releaseAccountLease(store, ownerId, lease, clock()); }
}

export function createDurableWorker({ store, env, fetcher = fetch, clock = Date.now, instanceId = crypto.randomUUID(), onError = () => {} }) {
  let stopped = true, busy = false, timer, heartbeatTimer;
  async function heartbeat(extra = {}) { return updateRecord(store, 'worker_health', 'executor', SYSTEM_OWNER, current => ({ ...current, instanceId, lastHeartbeatAt: clock(), pid: process.pid, runtime: 'persistent_node', ...extra })); }
  async function tick() {
    if (busy || stopped) return; busy = true;
    try {
      const ownerSet = new Set();
      for await (const rows of recordPages(store, 'broker_connections')) for (const row of rows) if (row.value.status === 'connected' && row.value.ownerId) ownerSet.add(row.value.ownerId);
      const owners = [...ownerSet];
      let failures = 0;
      for (const ownerId of owners) {
        if (stopped) break;
        try { await runAccountTick({ store, env, fetcher, ownerId, holder: instanceId, clock }); }
        catch (error) { failures++; onError({ ownerId, code: error.code || 'WORKER_FAILURE' }); }
      }
      await heartbeat({ lastCompletedAt: clock(), accountsExamined: owners.length, failures, status: failures ? 'degraded' : 'running' });
    } catch (error) { onError({ code: error.code || 'WORKER_FAILURE' }); await heartbeat({ status: 'degraded', lastErrorCode: error.code || 'WORKER_FAILURE' }); }
    finally { busy = false; }
  }
  return {
    async start() {
      if (!stopped) return; stopped = false;
      await heartbeat({ startedAt: clock(), status: 'starting' });
      // Independent persisted heartbeats cannot claim a successful completed execution tick.
      heartbeatTimer = setInterval(() => { heartbeat().catch(() => onError({ code: 'HEARTBEAT_FAILED' })); }, 10000);
      timer = setInterval(() => { tick().catch(() => onError({ code: 'WORKER_FAILURE' })); }, 15000);
      await tick();
    },
    async stop() { stopped = true; clearInterval(timer); clearInterval(heartbeatTimer); await heartbeat({ status: 'stopped', stoppedAt: clock() }); },
    tick,
  };
}
