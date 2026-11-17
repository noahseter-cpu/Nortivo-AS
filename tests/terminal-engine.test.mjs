import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, applyCommand, snapshot, aggregateBars, ema } from '../netlify/terminal/engine.mjs';
import { SAMPLE_BARS, SAMPLE_NEWS, SAMPLE_SOURCE, INITIAL_CURSOR } from '../netlify/terminal/sample-data.mjs';

const NOW = '2026-11-17T20:00:00.000Z';
let serial = 0;
const initial = () => createInitialState({ now: NOW });
const send = (state, command, requestId = `test-${++serial}`, now = NOW) => applyCommand(state, command, requestId, { now });
const step = (state, steps = 1) => send(state, { type: 'replay_advance', steps }).state;
const buy = (state, extra = {}, requestId) => send(state, { type: 'order_submit', symbol: 'NVDA', side: 'buy', quantity: 10, confirmed: true, ...extra }, requestId);
const sell = (state, extra = {}) => send(state, { type: 'order_submit', symbol: 'NVDA', side: 'sell', quantity: 10, confirmed: true, ...extra });
function conserved(state) {
  const view = snapshot(state, { now: NOW });
  assert.equal(state.ledger.reduce((sum, item) => sum + item.amountMinor, 0), view.account.cashMinor, 'ledger cash is exact');
  assert.equal(view.account.equityMinor - view.account.startingCashMinor, view.account.realizedPnlMinor + view.account.unrealizedPnlMinor, 'net P&L reconciles to equity');
  assert.equal(state.closedTrades.reduce((sum, trade) => sum + trade.pnlMinor, 0), view.account.realizedPnlMinor, 'closed lots reconcile to realized P&L');
  assert.equal(state.fills.reduce((sum, fill) => sum + fill.feeMinor, 0), view.account.feesMinor, 'fees reconcile to fills');
  assert.ok(view.account.cashMinor >= 0);
  for (const entry of state.ledger) assert.ok(Number.isSafeInteger(entry.amountMinor) && Number.isSafeInteger(entry.cashAfterMinor));
  let runningCash = 0;
  for (const entry of state.ledger) { runningCash += entry.amountMinor; assert.equal(entry.cashAfterMinor, runningCash); }
  for (const position of state.positions) assert.ok(Number.isSafeInteger(position.costBasisMinor) && Number.isSafeInteger(position.quantity) && position.quantity > 0);
}

test('fixed fictional fixture, independent virtual account, empty metrics and deep cloning', () => {
  const state = initial(); const second = initial();
  assert.deepEqual(state, second);
  const view = snapshot(state, { now: NOW });
  assert.equal(view.replay.mode, 'sample'); assert.equal(view.replay.execution, 'paper');
  assert.match(SAMPLE_SOURCE.name, /fictional/i);
  assert.equal(view.account.startingCashMinor, 10_000_000); assert.equal(view.account.currency, 'USD');
  assert.equal(view.account.winRate, null); assert.equal(view.account.profitFactor, null);
  assert.equal(view.account.completedTrades, 0); assert.equal(view.account.realizedPnlMinor, 0);
  assert.equal(SAMPLE_BARS.NVDA.length, 780);
  for (const bars of Object.values(SAMPLE_BARS)) {
    for (const bar of bars) {
      for (const key of ['open','high','low','close','volume']) assert.ok(Number.isSafeInteger(bar[key]));
      assert.ok(bar.high >= Math.max(bar.open, bar.close) && bar.low <= Math.min(bar.open, bar.close));
    }
  }
  view.positions.push({ fake: true }); view.markets.NVDA.bars[0].close = 1;
  assert.equal(state.positions.length, 0); assert.notEqual(SAMPLE_BARS.NVDA[0].close, 1);
  conserved(state);
});

test('indicator warm-up and session-aware aggregation have no fabricated overnight bars', () => {
  const view = snapshot(initial(), { now: NOW });
  assert.equal(view.markets.NVDA.bars5m.length, 102);
  assert.equal(view.markets.NVDA.bars15m.length, 34);
  assert.ok(view.markets.NVDA.indicators.ema20 > 0);
  assert.equal(ema([1,2], 3), null); assert.equal(ema([1,2,3], 3), 2);
  assert.equal(aggregateBars(SAMPLE_BARS.NVDA.slice(0,4), 5).length, 0);
  assert.equal(aggregateBars(SAMPLE_BARS.NVDA.slice(0,390), 60).length, 7);
  const daily = aggregateBars(SAMPLE_BARS.NVDA.slice(0,510), 390);
  assert.equal(daily.length, 1); assert.equal(daily[0].time, '2026-11-13T21:00:00.000Z');
  assert.ok(view.markets.NVDA.bars.every(bar => bar.time <= view.replay.asOf));
  let state = send(initial(), { type: 'settings_update', settings: { timeframe: '1d' } }).state;
  assert.equal(snapshot(state).markets.NVDA.indicators.ema20, null);
});

test('future news and unreleased calendar actuals do not leak', () => {
  const state = initial(); const view = snapshot(state);
  assert.ok(view.news.length < SAMPLE_NEWS.length);
  assert.ok(view.news.every(item => item.publishedAt <= view.replay.asOf && item.fixture));
  assert.ok(view.calendar.filter(item => item.scheduledAt > view.replay.asOf).every(item => item.actual === null && item.status === 'scheduled'));
  const later = snapshot(step(state, 30));
  assert.ok(later.news.every(item => item.publishedAt <= later.replay.asOf));
  assert.ok(later.calendar.filter(item => item.scheduledAt > later.replay.asOf).every(item => item.actual === null));
});

test('commands reject invalid money, quantities, symbols and unconfirmed orders atomically', () => {
  const state = initial(); const before = structuredClone(state);
  for (const extra of [{ quantity: 0 },{ quantity: 1.2 },{ symbol:'FAKE' },{ side:'short' },{ confirmed:false },{ orderType:'limit',limitPriceMinor:1.5 },{ stopLossMinor:999999 }]) {
    assert.throws(() => buy(state, extra), error => Boolean(error.code && error.status));
    assert.deepEqual(state, before);
  }
  assert.throws(() => send(state, { type:'replay_advance',steps:-1 }), { code:'INVALID_INPUT' });
  assert.throws(() => send(state, { type:'settings_update',settings:{timezone:'Mars/Example'} }), { code:'INVALID_INPUT' });
  assert.throws(() => send(state, { type:'strategy_update',strategy:{fastPeriod:30,slowPeriod:20} }), { code:'INVALID_INPUT' });
});

test('market orders are pending until next bar, apply adverse slippage and fees exactly', () => {
  const start = initial(); let { state, result } = buy(start);
  assert.equal(result.status, 'pending'); assert.equal(state.fills.length, 0); assert.equal(start.orders.length, 0);
  const next = SAMPLE_BARS.NVDA[INITIAL_CURSOR + 1];
  state = step(state);
  const fill = state.fills[0];
  assert.equal(fill.time, next.time); assert.equal(fill.priceMinor, Math.ceil(next.open * 1.0005));
  assert.equal(state.orders[0].filledCursor, INITIAL_CURSOR + 1);
  assert.equal(state.account.cashMinor, 10_000_000 - fill.priceMinor * 10 - 100);
  assert.equal(state.positions[0].costBasisMinor, fill.priceMinor * 10 + 100);
  assert.equal(state.account.feesMinor, 100);
  assert.ok(!ownFingerprint(snapshot(state).orders[0]));
  conserved(state);
});
function ownFingerprint(order) { return Object.prototype.hasOwnProperty.call(order, 'fingerprint'); }

test('idempotent order retries and conflicts cannot duplicate submissions or fills', () => {
  const command = { type:'order_submit',symbol:'NVDA',side:'buy',quantity:10,confirmed:true };
  const first = send(initial(), command, 'stable-buy');
  const retry = send(first.state, command, 'stable-buy');
  assert.deepEqual(first.result, retry.result); assert.equal(retry.state.orders.length, 1);
  assert.throws(() => send(first.state, { ...command, quantity:11 }, 'stable-buy'), { code:'IDEMPOTENCY_CONFLICT' });
  let state = step(retry.state);
  state = send(state, command, 'stable-buy').state;
  assert.equal(state.orders.length, 1); assert.equal(state.fills.length, 1);
  for (let index = 0; index < 260; index += 1) state = send(state, { type:'select_symbol',symbol:'NVDA' }).state;
  assert.equal(state.requestLog.length, 256);
  state = send(state, command, 'stable-buy').state;
  assert.equal(state.orders.length, 1); assert.equal(state.fills.length, 1);
  conserved(state);
});

test('limit orders touch at their limit, cancellation is final, sell quantity is reserved', () => {
  let state = buy(initial(), { orderType:'limit',limitPriceMinor:1 }).state;
  state = step(state, 5); assert.equal(state.orders[0].status, 'pending'); assert.equal(state.fills.length, 0);
  state = send(state, { type:'order_cancel',orderId:state.orders[0].id }).state;
  assert.throws(() => send(state, { type:'order_cancel',orderId:state.orders[0].id }), { code:'ORDER_NOT_PENDING' });
  state = step(state, 5); assert.equal(state.fills.length, 0);
  state = initial();
  const limit = SAMPLE_BARS.NVDA[INITIAL_CURSOR + 1].low;
  state = step(buy(state, { orderType:'limit',limitPriceMinor:limit }).state);
  assert.equal(state.fills[0].priceMinor, limit);
  state = sell(state, { quantity:8,orderType:'limit',limitPriceMinor:999999 }).state;
  const rejected = sell(state, { quantity:3 });
  assert.equal(rejected.result.status, 'rejected'); assert.match(rejected.result.reason, /shares/);
  conserved(rejected.state);
});

test('stop entries fill at worse stop/open with explicit slippage', () => {
  const bar = SAMPLE_BARS.NVDA[INITIAL_CURSOR + 1];
  const stop = bar.high - 1;
  let state = buy(initial(), { orderType:'stop',stopPriceMinor:stop }).state;
  state = step(state);
  assert.equal(state.fills[0].priceMinor, Math.ceil(Math.max(bar.open, stop) * 1.0005));
  conserved(state);
});

test('FIFO partial closures conserve all fee cents and account equity', () => {
  let state = send(initial(), { type:'settings_update',risk:{feePerOrderMinor:101,slippageBps:0} }).state;
  state = step(buy(state, { quantity:3 }).state);
  state = step(buy(state, { quantity:5 }).state);
  state = step(sell(state, { quantity:4 }).state);
  assert.equal(state.positions.length, 1); assert.equal(state.positions[0].quantity, 4);
  assert.equal(state.closedTrades.length, 2);
  assert.equal(state.closedTrades.reduce((sum, trade) => sum + trade.exitFeesMinor, 0), 101);
  conserved(state);
  state = step(sell(state, { quantity:4 }).state);
  assert.equal(state.positions.length, 0);
  assert.equal(state.closedTrades.reduce((sum, trade) => sum + trade.entryFeesMinor + trade.exitFeesMinor, 0), state.account.feesMinor);
  const view = snapshot(state);
  assert.equal(view.account.cashMinor - view.account.startingCashMinor, view.account.realizedPnlMinor);
  assert.equal(view.account.winRate, state.closedTrades.filter(trade => trade.pnlMinor > 0).length / state.closedTrades.length * 100);
  conserved(state);
});

test('conservative brackets prefer stops to targets, including an ambiguous entry bar', () => {
  let state = send(initial(), { type:'settings_update',risk:{slippageBps:0} }).state;
  state = buy(state, { stopLossMinor:15480,takeProfitMinor:15485 }).state;
  state = step(state);
  assert.equal(state.fills.length, 2); assert.equal(state.positions.length, 0);
  assert.equal(state.fills[1].priceMinor, 15480); assert.equal(state.fills[1].source, 'bracket');
  assert.ok(state.closedTrades[0].pnlMinor < 0);
  assert.equal(snapshot(state).account.winRate, 0); assert.equal(snapshot(state).account.profitFactor, 0);
  conserved(state);
  state = send(step(initial(), 2), { type:'settings_update',risk:{slippageBps:0} }).state;
  state = step(buy(state, { stopLossMinor:15482,takeProfitMinor:15500 }).state);
  assert.equal(state.positions.length, 1); // first bar touches neither
  state = step(state); // next bar touches both
  assert.equal(state.fills.at(-1).priceMinor, 15482);
  conserved(state);
});

test('win rate and profit factor use real positive and negative net closures', () => {
  let state = step(buy(initial()).state);
  state = step(state,30);
  state = step(sell(state).state);
  assert.ok(state.closedTrades[0].pnlMinor > 0);
  assert.equal(snapshot(state).account.winRate,100);
  assert.equal(snapshot(state).account.profitFactor,null, 'winning-only history has no loss denominator');
  state = step(buy(state, { quantity:1 }).state);
  state = step(sell(state, { quantity:1 }).state);
  assert.ok(state.closedTrades[1].pnlMinor < 0);
  const view = snapshot(state);
  assert.equal(view.account.winRate,50);
  assert.equal(view.account.profitFactor,state.closedTrades[0].pnlMinor / -state.closedTrades[1].pnlMinor);
  conserved(state);
});

test('server risk rejects insufficient funds, exposure and daily count; pending orders reserve cash', () => {
  let rejected = buy(initial(), { quantity:100000 });
  assert.equal(rejected.result.status, 'rejected'); assert.match(rejected.result.reason, /cash.*exposure/i);
  assert.equal(rejected.state.fills.length, 0);
  let state = send(initial(), { type:'settings_update',risk:{maxTradesPerDay:1} }).state;
  state = buy(state).state;
  rejected = buy(state);
  assert.equal(rejected.result.status, 'rejected'); assert.match(rejected.result.reason, /entry fill limit/);
  state = send(initial(), { type:'settings_update',risk:{maxExposureBps:10000,maxPositionBps:10000} }).state;
  state = buy(state, { quantity:600 }).state;
  rejected = buy(state, { symbol:'AMD',quantity:100 });
  assert.equal(rejected.result.status, 'rejected'); assert.match(rejected.result.reason, /cash/);
  assert.ok(snapshot(state).account.reservedMinor > 9_000_000);
  conserved(rejected.state);
});

test('fill-time risk rechecks changed limits; daily loss blocks buys but permits exits', () => {
  let state = buy(initial(), { quantity:100 }).state;
  state = send(state, { type:'settings_update',risk:{maxPositionBps:100} }).state;
  state = step(state);
  assert.equal(state.orders[0].status, 'rejected'); assert.equal(state.fills.length, 0);
  assert.match(state.orders[0].reason, /instrument exposure/);
  state = send(initial(), { type:'settings_update',risk:{maxDailyLossMinor:1} }).state;
  state = step(buy(state).state);
  assert.ok(snapshot(state).risk.dailyPnlMinor < -1);
  const rejected = buy(state, { symbol:'AMD' });
  assert.equal(rejected.result.status, 'rejected'); assert.match(rejected.result.reason, /Daily marked paper loss/);
  state = sell(rejected.state).state; assert.equal(state.orders.at(-1).status, 'pending');
  state = step(state); assert.equal(state.positions.length, 0);
  conserved(state);
});

test('actual strategy conditions, evidence and next-bar order chronology are linked', () => {
  let state = send(initial(), { type:'engine_start' }).state;
  assert.equal(state.engine.status, 'starting'); assert.equal(state.orders.length, 0);
  state = step(state, 30);
  assert.equal(state.engine.status, 'running'); assert.equal(state.engine.processedBars, 30);
  const signal = state.signals.find(item => item.orderId);
  assert.ok(signal); assert.equal(signal.conditionsMet, signal.conditionsTotal);
  assert.equal(signal.conditionsTotal, 2); assert.equal(signal.timeframe, '1m');
  assert.ok(signal.riskChecks.every(check => check.passed));
  const order = state.orders.find(item => item.id === signal.orderId);
  assert.ok(order); assert.equal(order.source, 'strategy');
  assert.equal(order.submittedCursor, signal.dataSnapshot.cursor);
  assert.ok(order.filledCursor > order.submittedCursor);
  const closes = SAMPLE_BARS.NVDA.slice(0,signal.dataSnapshot.cursor + 1).map(bar => bar.close);
  assert.equal(signal.dataSnapshot.emaFastMinor, ema(closes, state.strategy.fastPeriod));
  assert.ok(state.signals.every(item => item.time <= snapshot(state).replay.asOf));
  assert.ok(state.audit.some(item => item.action === 'strategy_evaluated' && item.detail.signalId === signal.id));
  conserved(state);
});

test('pause/stop, replay exhaustion and server-side in-tab lease have real effects', () => {
  let state = send(initial(), { type:'engine_start' }).state;
  assert.equal(snapshot(state, { now:'2026-11-17T20:00:21.000Z' }).engine.status, 'paused');
  state = send(state, { type:'replay_advance',steps:30 }, undefined, '2026-11-17T20:00:21.000Z').state;
  assert.equal(state.engine.status, 'paused'); assert.equal(state.engine.processedBars, 0); assert.equal(state.orders.length, 0);
  assert.ok(state.audit.some(item => item.action === 'engine_lease_expired'));
  state = send(initial(), { type:'engine_start' }).state;
  state = send(state, { type:'engine_pause' }).state;
  state = step(state,30); assert.equal(state.engine.processedBars,0);
  state = send(initial(), { type:'engine_start' }).state;
  while (!state.orders.length) state = step(state);
  assert.equal(state.orders[0].status, 'pending');
  state = send(state, { type:'engine_stop' }).state;
  assert.equal(state.orders[0].status, 'cancelled');
  while (state.replay.cursor < 779) state = step(state,30);
  assert.equal(snapshot(state).replay.canAdvance,false);
  assert.throws(() => send(state, { type:'engine_start' }), { code:'REPLAY_ENDED' });
  assert.throws(() => buy(state), { code:'REPLAY_ENDED' });
  assert.equal(step(state).replay.cursor,779);
});

test('persisted alerts fire once, notifications read, watchlist and settings remain authoritative', () => {
  let state = initial();
  state = send(state, { type:'alert_add',symbol:'NVDA',direction:'above',priceMinor:15400 }).state;
  state = step(state); assert.equal(state.alerts[0].status,'triggered');
  const count = state.notifications.length;
  state = step(state,5); assert.equal(state.notifications.length,count);
  state = send(state, { type:'notifications_read' }).state;
  assert.ok(state.notifications.every(item => item.read));
  state = send(state, { type:'watchlist_remove',symbol:'AMD' }).state;
  state = send(state, { type:'watchlist_sort',sort:'symbol' }).state;
  state = send(state, { type:'settings_update',settings:{timezone:'America/New_York',language:'nb',indicators:{vwap:false},timeframe:'15m'} }).state;
  state = JSON.parse(JSON.stringify(state));
  const view = snapshot(state);
  assert.deepEqual(view.watchlist,['AAPL','MSFT','NVDA','SPY']);
  assert.equal(view.settings.language,'nb'); assert.equal(view.settings.indicators.vwap,false);
  assert.equal(view.settings.timezone,'America/New_York');
  assert.ok(view.markets.NVDA.indicators.ema20 !== null);
  assert.equal(view.replay.cursor, INITIAL_CURSOR + 6);
});

test('financial and chronology invariants hold through deterministic multi-instrument activity', () => {
  let state = send(initial(), { type:'settings_update',risk:{maxTradesPerDay:100,feePerOrderMinor:137,slippageBps:7} }).state;
  const tickers = ['NVDA','AMD','MSFT','AAPL','SPY'];
  for (let index=0; index<60; index+=1) {
    const ticker = tickers[index % tickers.length];
    const quantity = index % 4 + 1;
    state = buy(state, { symbol:ticker,quantity }).state;
    state = step(state);
    if (index % 3 !== 0) { state = sell(state, { symbol:ticker,quantity }).state; state = step(state); }
    conserved(state);
  }
  for (const order of state.orders.filter(item => item.status === 'filled' && item.source !== 'bracket')) assert.ok(order.filledCursor > order.submittedCursor);
  assert.equal(state.orders.length, new Set(state.orders.map(item => item.id)).size);
  assert.ok(state.audit.length <= 300); assert.ok(state.notifications.length <= 100);
  assert.ok(state.requestLog.length <= 256);
});
