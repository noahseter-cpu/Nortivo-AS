import { INSTRUMENTS, SAMPLE_BARS, SAMPLE_NEWS, SAMPLE_CALENDAR, SAMPLE_SOURCE, INITIAL_CURSOR } from './sample-data.mjs';

export class TerminalError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'TerminalError'; this.code = code; this.status = status; }
}
const STARTING_CASH = 10_000_000;
const SYMBOLS = new Set(INSTRUMENTS.map(item => item.symbol));
const TIMEFRAMES = new Set(['1m','5m','15m','1h','4h','1d']);
const FRAME_MINUTES = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 390 };
const ENGINE_LEASE_MS = 20_000;
const PENDING = order => order.status === 'pending';
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const copy = value => structuredClone(value);
const fail = (code, message, status) => { throw new TerminalError(code, message, status); };
const integer = (value, name, min = 1, max = 1_000_000_000) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_INPUT', `${name} must be an integer between ${min} and ${max}.`);
  return value;
};
function iso(now) {
  const date = new Date(now ?? Date.now());
  if (!Number.isFinite(date.getTime())) fail('INVALID_INPUT', 'Invalid clock value.');
  return date.toISOString();
}
function symbol(value) { if (!SYMBOLS.has(value)) fail('INVALID_SYMBOL', 'Choose a supported sample instrument.'); return value; }
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function id(state, prefix) { state.sequence += 1; return `${prefix}-${state.sequence}`; }
function asOf(state, cursor = state.replay.cursor) { return SAMPLE_BARS.NVDA[cursor].time; }
function dayAt(time) { return time.slice(0, 10); } // US regular-session fixture never crosses UTC midnight.
function quoteAt(state, ticker, cursor = state.replay.cursor, field = 'close') { return SAMPLE_BARS[ticker][cursor][field]; }
function audit(state, action, detail, now) {
  state.audit.push({ id: id(state, 'audit'), time: now, marketTime: asOf(state), action, detail });
  if (state.audit.length > 300) state.audit.splice(0, state.audit.length - 300);
}
function notify(state, type, title, message, now) {
  state.notifications.push({ id: id(state, 'notice'), time: asOf(state), recordedAt: now, type, title, message, read: false });
  if (state.notifications.length > 100) state.notifications.splice(0, state.notifications.length - 100);
}
function ledger(state, type, amountMinor, detail = {}) {
  state.ledger.push({ id: id(state, 'ledger'), time: asOf(state), type, amountMinor, cashAfterMinor: state.account.cashMinor, ...detail });
}
function expired(state, now) {
  return ['running','starting'].includes(state.engine.status) && (!Number.isSafeInteger(state.engine.leaseUntilMs) || Date.parse(now) >= state.engine.leaseUntilMs);
}
function expireEngine(state, now) {
  if (!expired(state, now)) return;
  state.engine.status = 'paused'; state.engine.reason = 'In-tab replay lease expired. Start explicitly to resume strategy evaluations.'; state.engine.leaseUntilMs = null;
  audit(state, 'engine_lease_expired', { runtime: 'in-tab-replay' }, now);
}
function renewLease(state, now) {
  if (['running','starting'].includes(state.engine.status)) { state.engine.lastTickAt = now; state.engine.leaseUntilMs = Date.parse(now) + ENGINE_LEASE_MS; }
  else state.engine.leaseUntilMs = null;
}

/** Warm-up returns null rather than seeding an EMA before period observations. */
export function ema(values, period) {
  if (values.length < period) return null;
  let value = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  const factor = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) value += factor * (values[index] - value);
  return value;
}
/** Aggregation is anchored at each exchange session, never across an overnight gap. */
export function aggregateBars(bars, minutes = 1) {
  if (minutes === 1) return bars.map(item => ({ ...item }));
  const grouped = [];
  let session = [];
  const emit = fullSession => {
    for (let start = 0; start < session.length; start += minutes) {
      const part = session.slice(start, start + minutes);
      // Final short regular-session intervals are valid only after that session has closed.
      if (part.length < minutes && !(fullSession && start + part.length === 390)) continue;
      grouped.push({ time: part.at(-1).time, open: part[0].open, high: Math.max(...part.map(bar => bar.high)), low: Math.min(...part.map(bar => bar.low)), close: part.at(-1).close, volume: part.reduce((sum, bar) => sum + bar.volume, 0) });
    }
  };
  for (const bar of bars) {
    if (session.length && dayAt(session[0].time) !== dayAt(bar.time)) { emit(true); session = []; }
    session.push(bar);
  }
  if (session.length) emit(session.length === 390);
  return grouped;
}
function vwap(bars) {
  if (!bars.length) return null;
  const today = dayAt(bars.at(-1).time);
  const session = bars.filter(bar => dayAt(bar.time) === today);
  const volume = session.reduce((sum, bar) => sum + bar.volume, 0);
  return volume ? session.reduce((sum, bar) => sum + (bar.high + bar.low + bar.close) / 3 * bar.volume, 0) / volume : null;
}
function totals(state, cursor = state.replay.cursor, field = 'close') {
  let marketValueMinor = 0;
  let costBasisMinor = 0;
  for (const position of state.positions) { marketValueMinor += position.quantity * quoteAt(state, position.symbol, cursor, field); costBasisMinor += position.costBasisMinor; }
  return { marketValueMinor, equityMinor: state.account.cashMinor + marketValueMinor, unrealizedPnlMinor: marketValueMinor - costBasisMinor };
}
function reservedBuys(state, excluding) {
  return state.orders.filter(order => PENDING(order) && order.side === 'buy' && order.id !== excluding).reduce((sum, order) => sum + order.reservedMinor, 0);
}
function heldQuantity(state, ticker) { return state.positions.filter(position => position.symbol === ticker).reduce((sum, position) => sum + position.quantity, 0); }
function riskChecks(state, order, priceMinor, { cursor = state.replay.cursor, field = 'close', excludeOrderId = null } = {}) {
  const balance = totals(state, cursor, field);
  const fee = state.risk.feePerOrderMinor;
  const notional = priceMinor * order.quantity;
  const reserves = reservedBuys(state, excludeOrderId);
  const symbolValue = state.positions.filter(position => position.symbol === order.symbol).reduce((sum, position) => sum + position.quantity * quoteAt(state, position.symbol, cursor, field), 0);
  const pendingSymbol = state.orders.filter(item => PENDING(item) && item.side === 'buy' && item.symbol === order.symbol && item.id !== excludeOrderId).reduce((sum, item) => sum + item.reservedMinor, 0);
  const today = dayAt(asOf(state, cursor));
  const tradesToday = state.fills.filter(fill => fill.side === 'buy' && dayAt(fill.time) === today).length;
  const pendingEntries = state.orders.filter(item => PENDING(item) && item.side === 'buy' && item.id !== excludeOrderId).length;
  const pnl = balance.equityMinor - state.daily.openingEquityMinor;
  if (order.side === 'sell') {
    const pendingSells = state.orders.filter(item => PENDING(item) && item.side === 'sell' && item.symbol === order.symbol && item.id !== excludeOrderId).reduce((sum, item) => sum + item.quantity, 0);
    const available = heldQuantity(state, order.symbol) - pendingSells;
    return [
      { id: 'holdings', label: 'Available whole shares', passed: order.quantity <= available, actual: order.quantity, limit: available },
      { id: 'sell-fee', label: 'Sale proceeds and cash cover fee', passed: state.account.cashMinor + notional >= fee, actual: state.account.cashMinor + notional, limit: fee },
    ];
  }
  const exposureLimit = Math.floor(balance.equityMinor * state.risk.maxExposureBps / 10_000);
  const positionLimit = Math.floor(balance.equityMinor * state.risk.maxPositionBps / 10_000);
  return [
    { id: 'cash', label: 'Available cash including fees and pending reservations', passed: notional + fee + reserves <= state.account.cashMinor, actual: notional + fee + reserves, limit: state.account.cashMinor },
    { id: 'exposure', label: 'Maximum portfolio exposure', passed: balance.marketValueMinor + notional + reserves <= exposureLimit, actual: balance.marketValueMinor + notional + reserves, limit: exposureLimit },
    { id: 'position', label: 'Maximum instrument exposure', passed: symbolValue + pendingSymbol + notional <= positionLimit, actual: symbolValue + pendingSymbol + notional, limit: positionLimit },
    { id: 'daily-loss', label: 'Daily marked paper loss limit', passed: pnl > -state.risk.maxDailyLossMinor, actual: pnl, limit: -state.risk.maxDailyLossMinor },
    { id: 'trade-limit', label: 'Daily entry fill limit including pending entries', passed: tradesToday + pendingEntries < state.risk.maxTradesPerDay, actual: tradesToday + pendingEntries, limit: state.risk.maxTradesPerDay },
  ];
}
function reasonFor(checks) { return checks.filter(check => !check.passed).map(check => check.label).join('; '); }
function fillPrice(order, bar, slippageBps) {
  const direction = order.side === 'buy' ? 1 : -1;
  if (order.orderType === 'limit') {
    const eligible = order.side === 'buy' ? bar.low <= order.limitPriceMinor : bar.high >= order.limitPriceMinor;
    // Conservative: no favorable opening-gap improvement, and no fill outside the limit.
    return eligible ? order.limitPriceMinor : null;
  }
  if (order.orderType === 'stop') {
    const eligible = order.side === 'buy' ? bar.high >= order.stopPriceMinor : bar.low <= order.stopPriceMinor;
    if (!eligible) return null;
    const base = order.side === 'buy' ? Math.max(bar.open, order.stopPriceMinor) : Math.min(bar.open, order.stopPriceMinor);
    return order.side === 'buy' ? Math.ceil(base * (10_000 + slippageBps) / 10_000) : Math.floor(base * (10_000 - slippageBps) / 10_000);
  }
  return order.side === 'buy' ? Math.ceil(bar.open * (10_000 + slippageBps) / 10_000) : Math.floor(bar.open * (10_000 - slippageBps) / 10_000);
}
function estimatedPrice(state, order) {
  if (order.orderType === 'limit') return order.limitPriceMinor;
  const price = order.orderType === 'stop' ? Math.max(quoteAt(state, order.symbol), order.stopPriceMinor) : quoteAt(state, order.symbol);
  return order.side === 'buy' ? Math.ceil(price * (10_000 + state.risk.slippageBps) / 10_000) : Math.floor(price * (10_000 - state.risk.slippageBps) / 10_000);
}
function createOrder(state, payload, requestId, now, source = 'manual', fingerprint = null) {
  const ticker = symbol(payload.symbol);
  if (!['buy','sell'].includes(payload.side)) fail('INVALID_INPUT', 'Order side must be buy or sell. Short selling is unavailable.');
  const orderType = payload.orderType ?? 'market';
  if (!['market','limit','stop'].includes(orderType)) fail('INVALID_INPUT', 'Choose a market, limit or stop order.');
  const quantity = integer(payload.quantity, 'Quantity', 1, 100_000);
  const order = {
    id: id(state, 'order'), requestId, fingerprint, symbol: ticker, side: payload.side, orderType, quantity,
    source, status: 'pending', submittedAt: asOf(state), submittedCursor: state.replay.cursor, recordedAt: now,
    limitPriceMinor: orderType === 'limit' ? integer(payload.limitPriceMinor, 'Limit price', 1, 100_000_000) : null,
    stopPriceMinor: orderType === 'stop' ? integer(payload.stopPriceMinor, 'Stop entry price', 1, 100_000_000) : null,
    stopLossMinor: payload.stopLossMinor == null ? null : integer(payload.stopLossMinor, 'Stop loss', 1, 100_000_000),
    takeProfitMinor: payload.takeProfitMinor == null ? null : integer(payload.takeProfitMinor, 'Take profit', 1, 100_000_000),
  };
  if (payload.side === 'sell' && (order.stopLossMinor !== null || order.takeProfitMinor !== null)) fail('INVALID_INPUT', 'Attached exits are available on buy orders only.');
  const estimate = estimatedPrice(state, order);
  if (order.stopLossMinor !== null && order.stopLossMinor >= estimate) fail('INVALID_INPUT', 'Stop loss must be below the estimated entry.');
  if (order.takeProfitMinor !== null && order.takeProfitMinor <= estimate) fail('INVALID_INPUT', 'Take profit must be above the estimated entry.');
  order.estimatedPriceMinor = estimate;
  order.estimatedFeeMinor = state.risk.feePerOrderMinor;
  order.reservedMinor = payload.side === 'buy' ? estimate * quantity + state.risk.feePerOrderMinor : 0;
  order.riskChecks = riskChecks(state, order, estimate);
  if (order.riskChecks.some(check => !check.passed)) { order.status = 'rejected'; order.reason = reasonFor(order.riskChecks); order.rejectedAt = asOf(state); }
  state.orders.push(order);
  audit(state, order.status === 'rejected' ? 'order_rejected' : 'order_submitted', { orderId: order.id, symbol: ticker, side: order.side, quantity, reason: order.reason ?? null, riskChecks: order.riskChecks }, now);
  notify(state, order.status === 'rejected' ? 'warning' : 'info', order.status === 'rejected' ? 'Paper order rejected' : 'Paper order pending', order.status === 'rejected' ? order.reason : `${order.side} ${quantity} ${ticker}; eligible from the next replay bar.`, now);
  return order;
}

function executeFill(state, order, priceMinor, now, { lotId = null, skipRisk = false } = {}) {
  const checks = skipRisk ? [{ id: 'sell-fee', label: 'Sale proceeds and cash cover fee', passed: state.account.cashMinor + order.quantity * priceMinor >= state.risk.feePerOrderMinor, actual: state.account.cashMinor + order.quantity * priceMinor, limit: state.risk.feePerOrderMinor }] : riskChecks(state, order, priceMinor, { field: 'open', excludeOrderId: order.id });
  if (checks.some(check => !check.passed)) {
    order.status = 'rejected'; order.reason = reasonFor(checks); order.rejectedAt = asOf(state); order.riskChecks = checks;
    audit(state, 'order_rejected_at_fill', { orderId: order.id, reason: order.reason, riskChecks: checks }, now);
    notify(state, 'warning', 'Paper order rejected at fill', order.reason, now);
    if (order.source === 'strategy') { state.engine.status = 'blocked'; state.engine.reason = order.reason; }
    return;
  }
  const feeMinor = state.risk.feePerOrderMinor;
  const grossMinor = order.quantity * priceMinor;
  if (order.side === 'buy') {
    state.account.cashMinor -= grossMinor;
    ledger(state, 'buy', -grossMinor, { orderId: order.id, symbol: order.symbol, quantity: order.quantity, priceMinor, description: 'Simulated whole-share purchase' });
    state.account.cashMinor -= feeMinor;
    ledger(state, 'fee', -feeMinor, { orderId: order.id, symbol: order.symbol, description: 'Paper entry fee' });
    state.positions.push({ id: id(state, 'position'), symbol: order.symbol, quantity: order.quantity, averagePriceMinor: priceMinor, costBasisMinor: grossMinor + feeMinor, entryFeesMinor: feeMinor, openedAt: asOf(state), openedCursor: state.replay.cursor, sourceOrderId: order.id, stopLossMinor: order.stopLossMinor, takeProfitMinor: order.takeProfitMinor });
  } else {
    const lots = state.positions.filter(position => position.symbol === order.symbol && (!lotId || position.id === lotId));
    let remaining = order.quantity;
    let basisMinor = 0;
    let allocatedExitFeeMinor = 0;
    const closures = [];
    for (const position of lots) {
      if (!remaining) break;
      const quantity = Math.min(remaining, position.quantity);
      const basis = quantity === position.quantity ? position.costBasisMinor : Math.floor(position.costBasisMinor * quantity / position.quantity);
      const exitFee = quantity === remaining ? feeMinor - allocatedExitFeeMinor : Math.floor(feeMinor * quantity / order.quantity);
      const entryFees = quantity === position.quantity ? position.entryFeesMinor : Math.floor(position.entryFeesMinor * quantity / position.quantity);
      basisMinor += basis;
      allocatedExitFeeMinor += exitFee;
      closures.push({ id: id(state, 'trade'), symbol: order.symbol, quantity, entryTime: position.openedAt, exitTime: asOf(state), entryPriceMinor: position.averagePriceMinor, exitPriceMinor: priceMinor, entryFeesMinor: entryFees, exitFeesMinor: exitFee, costBasisMinor: basis, proceedsMinor: quantity * priceMinor - exitFee, pnlMinor: quantity * priceMinor - exitFee - basis, entryOrderId: position.sourceOrderId, exitOrderId: order.id });
      position.quantity -= quantity; position.costBasisMinor -= basis; position.entryFeesMinor -= entryFees;
      remaining -= quantity;
    }
    if (remaining) fail('ENGINE_INVARIANT', 'Paper holdings changed before execution.', 409);
    state.positions = state.positions.filter(position => position.quantity > 0);
    state.account.cashMinor += grossMinor;
    ledger(state, 'sell', grossMinor, { orderId: order.id, symbol: order.symbol, quantity: order.quantity, priceMinor, description: 'Simulated whole-share sale; FIFO cost basis' });
    state.account.cashMinor -= feeMinor;
    ledger(state, 'fee', -feeMinor, { orderId: order.id, symbol: order.symbol, description: 'Paper exit fee' });
    state.account.realizedPnlMinor += grossMinor - feeMinor - basisMinor;
    state.closedTrades.push(...closures);
  }
  state.account.feesMinor += feeMinor;
  order.status = 'filled'; order.filledAt = asOf(state); order.filledCursor = state.replay.cursor;
  order.fillPriceMinor = priceMinor; order.feeMinor = feeMinor; order.riskChecksAtFill = checks;
  const fill = { id: id(state, 'fill'), orderId: order.id, time: asOf(state), symbol: order.symbol, side: order.side, quantity: order.quantity, priceMinor, grossMinor, feeMinor, source: order.source };
  state.fills.push(fill);
  audit(state, 'order_filled', { ...fill }, now);
  notify(state, 'success', 'Paper order filled', `${order.side} ${order.quantity} ${order.symbol} at USD ${(priceMinor / 100).toFixed(2)}; fee USD ${(feeMinor / 100).toFixed(2)}.`, now);
}
function executeBrackets(state, now, onlyNew = false) {
  for (const position of [...state.positions]) {
    if (onlyNew && position.openedCursor !== state.replay.cursor) continue;
    if (!onlyNew && position.openedCursor >= state.replay.cursor) continue;
    const bar = SAMPLE_BARS[position.symbol][state.replay.cursor];
    const stop = position.stopLossMinor !== null && bar.low <= position.stopLossMinor;
    const target = !onlyNew && position.takeProfitMinor !== null && bar.high >= position.takeProfitMinor;
    if (!stop && !target) continue;
    // If both prices trade, stop wins. On the entry bar, a target is never assumed.
    const base = stop ? Math.min(bar.open, position.stopLossMinor) : position.takeProfitMinor;
    const priceMinor = stop ? Math.floor(base * (10_000 - state.risk.slippageBps) / 10_000) : base;
    const order = { id: id(state, 'order'), requestId: null, symbol: position.symbol, side: 'sell', orderType: stop ? 'stop' : 'limit', quantity: position.quantity, source: 'bracket', status: 'pending', submittedAt: position.openedAt, submittedCursor: position.openedCursor, stopPriceMinor: stop ? position.stopLossMinor : null, limitPriceMinor: target && !stop ? position.takeProfitMinor : null, stopLossMinor: null, takeProfitMinor: null, reason: stop ? 'Attached stop loss; stop takes precedence when both exits touch.' : 'Attached profit target', recordedAt: now, reservedMinor: 0 };
    state.orders.push(order);
    // Cancel competing exits before reducing holdings; protective exits always reduce risk.
    for (const other of state.orders.filter(item => PENDING(item) && item.side === 'sell' && item.symbol === position.symbol && item.id !== order.id)) {
      other.status = 'cancelled'; other.cancelledAt = asOf(state); other.reason = 'Protective exit filled; competing sale cancelled.';
      audit(state, 'order_cancelled', { orderId: other.id, reason: other.reason }, now);
    }
    executeFill(state, order, priceMinor, now, { lotId: position.id, skipRisk: true });
  }
}
function evaluateStrategy(state, now, submit = true) {
  const ticker = state.settings.selectedSymbol;
  const bars = SAMPLE_BARS[ticker].slice(0, state.replay.cursor + 1);
  const closes = bars.map(bar => bar.close);
  const fast = ema(closes, state.strategy.fastPeriod);
  const slow = ema(closes, state.strategy.slowPeriod);
  const sessionVwap = vwap(bars);
  const volumeAverage = bars.slice(-21, -1).reduce((sum, bar) => sum + bar.volume, 0) / 20;
  const price = bars.at(-1).close;
  const conditions = [
    { id: 'ema-trend', label: 'Fast EMA above slow EMA', enabled: true, met: fast !== null && slow !== null && fast > slow, actual: fast, expected: slow },
    { id: 'price-trend', label: 'Close above fast EMA', enabled: true, met: fast !== null && price > fast, actual: price, expected: fast },
    { id: 'vwap', label: 'Close above session VWAP', enabled: state.strategy.useVwap, met: sessionVwap !== null && price > sessionVwap, actual: price, expected: sessionVwap },
    { id: 'volume', label: 'Volume meets previous 20-bar average filter', enabled: state.strategy.useVolume, met: bars.length >= 21 && bars.at(-1).volume >= volumeAverage * state.strategy.volumeMultiplier, actual: bars.at(-1).volume, expected: volumeAverage * state.strategy.volumeMultiplier },
  ];
  const enabled = conditions.filter(condition => condition.enabled);
  const stopLossMinor = Math.max(1, Math.floor(price * (10_000 - state.strategy.stopLossBps) / 10_000));
  const takeProfitMinor = Math.ceil(price * (10_000 + state.strategy.takeProfitBps) / 10_000);
  const estimate = Math.ceil(price * (10_000 + state.risk.slippageBps) / 10_000);
  const checks = riskChecks(state, { symbol: ticker, side: 'buy', quantity: state.strategy.quantity }, estimate);
  checks.push({ id: 'one-entry', label: 'No existing position or pending entry for this instrument', passed: heldQuantity(state, ticker) === 0 && !state.orders.some(order => PENDING(order) && order.side === 'buy' && order.symbol === ticker), actual: heldQuantity(state, ticker), limit: 0 });
  const allConditions = enabled.every(condition => condition.met);
  const allRisk = checks.every(check => check.passed);
  const signal = {
    id: id(state, 'signal'), symbol: ticker, time: asOf(state), strategyVersion: state.strategy.version, timeframe: '1m', source: SAMPLE_SOURCE.id,
    priceMinor: price, quantity: state.strategy.quantity, estimatedEntryMinor: estimate, estimatedFeeMinor: state.risk.feePerOrderMinor,
    stopLossMinor, takeProfitMinor, estimatedRiskMinor: (estimate - stopLossMinor) * state.strategy.quantity + state.risk.feePerOrderMinor * 2,
    conditions, conditionsMet: enabled.filter(condition => condition.met).length, conditionsTotal: enabled.length, riskChecks: checks,
    decision: !allConditions ? 'wait' : allRisk ? 'allowed' : 'blocked', orderId: null,
    dataSnapshot: { asOf: asOf(state), cursor: state.replay.cursor, closeMinor: price, emaFastMinor: fast, emaSlowMinor: slow, vwapMinor: sessionVwap, volume: bars.at(-1).volume, previousVolumeAverage: volumeAverage },
  };
  if (submit && allConditions && allRisk && state.strategy.autoTrade) {
    const order = createOrder(state, { symbol: ticker, side: 'buy', orderType: 'market', quantity: signal.quantity, stopLossMinor, takeProfitMinor }, `strategy:${signal.id}`, now, 'strategy');
    signal.orderId = order.id;
    if (order.status === 'rejected') { state.engine.status = 'blocked'; state.engine.reason = order.reason; }
  } else if (submit && allConditions && checks.some(check => !check.passed && check.id !== 'one-entry')) {
    state.engine.status = 'blocked'; state.engine.reason = reasonFor(checks.filter(check => check.id !== 'one-entry'));
    notify(state, 'warning', 'Strategy blocked by risk controls', state.engine.reason, now);
  }
  state.signals.push(signal);
  if (state.signals.length > 120) state.signals.splice(0, state.signals.length - 120);
  state.engine.lastEvaluationAt = signal.time;
  state.engine.processedBars += submit ? 1 : 0;
  audit(state, 'strategy_evaluated', { signalId: signal.id, symbol: ticker, decision: signal.decision, conditionsMet: signal.conditionsMet, conditionsTotal: signal.conditionsTotal, riskChecks: checks }, now);
  return signal;
}
function advance(state, steps, now) {
  let advanced = 0;
  for (let count = 0; count < steps && state.replay.cursor < SAMPLE_BARS.NVDA.length - 1; count += 1) {
    const priorEquity = totals(state).equityMinor;
    const nextDay = dayAt(asOf(state, state.replay.cursor + 1));
    if (state.daily.date !== nextDay) state.daily = { date: nextDay, openingEquityMinor: priorEquity };
    state.replay.cursor += 1; advanced += 1;
    executeBrackets(state, now);
    for (const order of state.orders.filter(item => PENDING(item) && item.submittedCursor < state.replay.cursor)) {
      const priceMinor = fillPrice(order, SAMPLE_BARS[order.symbol][state.replay.cursor], state.risk.slippageBps);
      if (priceMinor === null) continue;
      if ((order.stopLossMinor !== null && order.stopLossMinor >= priceMinor) || (order.takeProfitMinor !== null && order.takeProfitMinor <= priceMinor)) {
        order.status = 'rejected'; order.reason = 'Opening gap makes attached exits invalid for the actual fill price.'; order.rejectedAt = asOf(state);
        audit(state, 'order_rejected_at_fill', { orderId: order.id, reason: order.reason }, now);
        notify(state, 'warning', 'Paper order rejected at fill', order.reason, now);
        continue;
      }
      executeFill(state, order, priceMinor, now);
    }
    executeBrackets(state, now, true);
    for (const alert of state.alerts.filter(item => item.status === 'active')) {
      const price = quoteAt(state, alert.symbol);
      if ((alert.direction === 'above' && price >= alert.priceMinor) || (alert.direction === 'below' && price <= alert.priceMinor)) {
        alert.status = 'triggered'; alert.triggeredAt = asOf(state); alert.triggerPriceMinor = price;
        notify(state, 'info', 'Sample price alert', `${alert.symbol} closed ${alert.direction} USD ${(alert.priceMinor / 100).toFixed(2)}.`, now);
        audit(state, 'alert_triggered', { alertId: alert.id, symbol: alert.symbol, priceMinor: price }, now);
      }
    }
    if (['running','starting'].includes(state.engine.status)) {
      state.engine.status = 'running'; state.engine.reason = null;
      evaluateStrategy(state, now);
    }
  }
  if (state.replay.cursor === SAMPLE_BARS.NVDA.length - 1) {
    if (['running','starting'].includes(state.engine.status)) { state.engine.status = 'paused'; state.engine.reason = 'The fixed sample replay has ended.'; }
    for (const order of state.orders.filter(PENDING)) { order.status = 'cancelled'; order.cancelledAt = asOf(state); order.reason = 'Replay ended before another eligible bar.'; }
  }
  return { advanced, cursor: state.replay.cursor, asOf: asOf(state) };
}

export function createInitialState({ now } = {}) {
  const time = iso(now);
  const state = {
    schemaVersion: 1, createdAt: time, updatedAt: time, sequence: 0,
    account: { currency: 'USD', startingCashMinor: STARTING_CASH, cashMinor: STARTING_CASH, realizedPnlMinor: 0, feesMinor: 0 },
    replay: { cursor: INITIAL_CURSOR },
    settings: { selectedSymbol: 'NVDA', timeframe: '5m', timezone: 'Europe/Oslo', language: 'en', watchlistSort: 'manual', indicators: { ema9: true, ema20: true, vwap: true }, display: { compact: false } },
    watchlist: ['NVDA','AMD','MSFT','AAPL','SPY'],
    strategy: { name: 'EMA trend example', version: 'ema-trend-1.0', fastPeriod: 9, slowPeriod: 20, useVwap: false, useVolume: false, volumeMultiplier: 1, quantity: 10, stopLossBps: 150, takeProfitBps: 300, autoTrade: true },
    risk: { maxExposureBps: 6000, maxPositionBps: 2500, maxDailyLossMinor: 200000, maxTradesPerDay: 20, feePerOrderMinor: 100, slippageBps: 5 },
    engine: { status: 'stopped', reason: null, lastEvaluationAt: null, processedBars: 0, runtime: 'in-tab-replay', durableWorker: false, lastTickAt: null, leaseUntilMs: null, leaseDurationMs: ENGINE_LEASE_MS },
    daily: { date: '2026-11-16', openingEquityMinor: STARTING_CASH },
    positions: [], orders: [], fills: [], ledger: [], closedTrades: [], signals: [], alerts: [], notifications: [], audit: [], requestLog: [],
  };
  ledger(state, 'deposit', STARTING_CASH, { description: 'Virtual USD 100,000 opening paper balance; separate from Nortivo historical report' });
  notify(state, 'info', 'Fictional replay ready', 'Paper account with virtual USD 100,000. Replay runs only while you advance it in this tab; no real brokerage is connected.', time);
  evaluateStrategy(state, time, false);
  return state;
}

function updateSettings(state, command) {
  const patch = command.settings ?? {};
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) fail('INVALID_INPUT', 'Settings must be an object.');
  const allowed = new Set(['selectedSymbol','timeframe','timezone','language','watchlistSort','indicators','display']);
  for (const key of Object.keys(patch)) if (!allowed.has(key)) fail('INVALID_INPUT', `Unknown setting: ${key}.`);
  if (own(patch, 'selectedSymbol')) state.settings.selectedSymbol = symbol(patch.selectedSymbol);
  if (own(patch, 'timeframe')) { if (!TIMEFRAMES.has(patch.timeframe)) fail('INVALID_INPUT', 'Unsupported chart timeframe.'); state.settings.timeframe = patch.timeframe; }
  if (own(patch, 'timezone')) {
    if (typeof patch.timezone !== 'string' || patch.timezone.length > 80) fail('INVALID_INPUT', 'Invalid timezone.');
    try { new Intl.DateTimeFormat('en', { timeZone: patch.timezone }); } catch { fail('INVALID_INPUT', 'Invalid IANA timezone.'); }
    state.settings.timezone = patch.timezone;
  }
  if (own(patch, 'language')) { if (!['en','nb'].includes(patch.language)) fail('INVALID_INPUT', 'Choose English or Norwegian Bokmål.'); state.settings.language = patch.language; }
  if (own(patch, 'watchlistSort')) { if (!['manual','symbol','change'].includes(patch.watchlistSort)) fail('INVALID_INPUT', 'Unsupported watchlist sorting.'); state.settings.watchlistSort = patch.watchlistSort; }
  if (own(patch, 'indicators')) {
    if (!patch.indicators || typeof patch.indicators !== 'object' || Array.isArray(patch.indicators)) fail('INVALID_INPUT', 'Indicators must be an object.');
    for (const [key, value] of Object.entries(patch.indicators)) { if (!['ema9','ema20','vwap'].includes(key) || typeof value !== 'boolean') fail('INVALID_INPUT', 'Invalid indicator setting.'); state.settings.indicators[key] = value; }
  }
  if (own(patch, 'display')) {
    if (!patch.display || typeof patch.display !== 'object' || Array.isArray(patch.display)) fail('INVALID_INPUT', 'Display preferences must be an object.');
    for (const [key, value] of Object.entries(patch.display)) {
      if (!['compact','chartTimeframe'].includes(key) || (key === 'compact' && typeof value !== 'boolean') || (key === 'chartTimeframe' && !TIMEFRAMES.has(value))) fail('INVALID_INPUT', 'Invalid display preference.');
      state.settings.display[key] = value;
    }
  }
  const riskPatch = command.risk ?? {};
  if (!riskPatch || typeof riskPatch !== 'object' || Array.isArray(riskPatch)) fail('INVALID_INPUT', 'Risk controls must be an object.');
  const limits = { maxExposureBps: [100,10000], maxPositionBps: [100,10000], maxDailyLossMinor: [1,STARTING_CASH], maxTradesPerDay: [1,1000], feePerOrderMinor: [0,10000], slippageBps: [0,500] };
  for (const [key, value] of Object.entries(riskPatch)) { if (!own(limits, key)) fail('INVALID_INPUT', `Unknown risk control: ${key}.`); state.risk[key] = integer(value, key, ...limits[key]); }
  if (state.risk.maxPositionBps > state.risk.maxExposureBps) fail('INVALID_INPUT', 'Instrument exposure cannot exceed portfolio exposure.');
  return { saved: true };
}
function updateStrategy(state, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) fail('INVALID_INPUT', 'Strategy parameters must be an object.');
  const limits = { fastPeriod: [2,50], slowPeriod: [3,100], quantity: [1,10000], stopLossBps: [10,5000], takeProfitBps: [10,10000] };
  for (const [key, value] of Object.entries(patch)) {
    if (own(limits, key)) state.strategy[key] = integer(value, key, ...limits[key]);
    else if (['useVwap','useVolume','autoTrade'].includes(key)) { if (typeof value !== 'boolean') fail('INVALID_INPUT', `${key} must be a boolean.`); state.strategy[key] = value; }
    else if (key === 'volumeMultiplier') { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.1 || value > 10) fail('INVALID_INPUT', 'Volume multiplier must be 0.1–10.'); state.strategy[key] = value; }
    else fail('INVALID_INPUT', `Unknown strategy parameter: ${key}.`);
  }
  if (state.strategy.fastPeriod >= state.strategy.slowPeriod) fail('INVALID_INPUT', 'Fast EMA period must be less than slow EMA period.');
  return { saved: true, version: state.strategy.version };
}

export function applyCommand(original, command, requestId, { now } = {}) {
  if (!original || original.schemaVersion !== 1) fail('INVALID_STATE', 'Unsupported paper account schema.', 409);
  if (!command || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string') fail('INVALID_INPUT', 'A command type is required.');
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_:.\-]{1,128}$/.test(requestId)) fail('INVALID_REQUEST_ID', 'A stable request identifier is required.');
  const fingerprint = canonical(command);
  if (fingerprint.length > 16000) fail('INVALID_INPUT', 'Command is too large.');
  const previous = original.requestLog.find(receipt => receipt.id === requestId);
  if (previous) {
    if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'This request identifier was already used for a different command.', 409);
    return { state: copy(original), result: copy(previous.result) };
  }
  const existingOrder = original.orders.find(order => order.requestId === requestId && order.source === 'manual');
  if (existingOrder) {
    if (existingOrder.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'This order request identifier was already used for different parameters.', 409);
    return { state: copy(original), result: { orderId: existingOrder.id, status: existingOrder.status, reason: existingOrder.reason ?? null, riskChecks: copy(existingOrder.riskChecks) } };
  }
  const state = copy(original);
  const time = iso(now);
  expireEngine(state, time);
  let result;
  switch (command.type) {
    case 'select_symbol': state.settings.selectedSymbol = symbol(command.symbol); result = { symbol: command.symbol }; break;
    case 'watchlist_add': {
      const ticker = symbol(command.symbol);
      if (!state.watchlist.includes(ticker)) state.watchlist.push(ticker);
      result = { watchlist: [...state.watchlist] }; break;
    }
    case 'watchlist_remove': { const ticker = symbol(command.symbol); state.watchlist = state.watchlist.filter(item => item !== ticker); result = { watchlist: [...state.watchlist] }; break; }
    case 'watchlist_sort': {
      const sort = command.sort ?? command.sortBy;
      if (!['manual','symbol','change'].includes(sort)) fail('INVALID_INPUT', 'Choose manual, symbol or change sorting.');
      state.settings.watchlistSort = sort;
      if (command.symbols !== undefined) {
        if (!Array.isArray(command.symbols) || command.symbols.length !== state.watchlist.length || new Set(command.symbols).size !== state.watchlist.length || command.symbols.some(ticker => !state.watchlist.includes(ticker))) fail('INVALID_INPUT', 'Manual ordering must contain the current watchlist once each.');
        state.watchlist = [...command.symbols];
      }
      result = { sort }; break;
    }
    case 'settings_update': result = updateSettings(state, command); break;
    case 'strategy_update': result = updateStrategy(state, command.strategy); break;
    case 'engine_start': {
      if (state.replay.cursor >= SAMPLE_BARS.NVDA.length - 1) fail('REPLAY_ENDED', 'The fixed sample session has ended. It cannot be rewound into this ledger.', 409);
      state.engine.status = 'starting'; state.engine.reason = null;
      renewLease(state, time);
      result = { status: state.engine.status }; break;
    }
    case 'engine_pause': state.engine.status = 'paused'; state.engine.leaseUntilMs = null; state.engine.reason = 'New strategy evaluations paused. Existing orders and protective exits remain active when replay advances.'; result = { status: 'paused' }; break;
    case 'engine_stop': {
      state.engine.status = 'stopped'; state.engine.reason = null;
      state.engine.leaseUntilMs = null;
      for (const order of state.orders.filter(item => PENDING(item) && item.source === 'strategy')) { order.status = 'cancelled'; order.cancelledAt = asOf(state); order.reason = 'Strategy stopped before fill.'; }
      result = { status: 'stopped' }; break;
    }
    case 'replay_advance': result = advance(state, integer(command.steps ?? 1, 'Replay steps', 1, 30), time); renewLease(state, time); break;
    case 'order_submit': {
      if (command.confirmed !== true) fail('CONFIRMATION_REQUIRED', 'Confirm this paper order before submitting.');
      if (state.replay.cursor >= SAMPLE_BARS.NVDA.length - 1) fail('REPLAY_ENDED', 'No future sample bar remains to execute an order.', 409);
      const order = createOrder(state, command, requestId, time, 'manual', fingerprint);
      result = { orderId: order.id, status: order.status, reason: order.reason ?? null, riskChecks: order.riskChecks }; break;
    }
    case 'order_cancel': {
      const order = state.orders.find(item => item.id === command.orderId);
      if (!order) fail('ORDER_NOT_FOUND', 'Paper order was not found.', 404);
      if (!PENDING(order)) fail('ORDER_NOT_PENDING', 'Only pending orders can be cancelled.', 409);
      order.status = 'cancelled'; order.cancelledAt = asOf(state); order.reason = 'Cancelled by account owner.';
      result = { orderId: order.id, status: 'cancelled' }; break;
    }
    case 'alert_add': {
      if (state.alerts.length >= 100) fail('ALERT_LIMIT', 'Remove an alert before adding another.', 409);
      if (!['above','below'].includes(command.direction)) fail('INVALID_INPUT', 'Alert direction must be above or below.');
      const alert = { id: id(state, 'alert'), symbol: symbol(command.symbol), direction: command.direction, priceMinor: integer(command.priceMinor, 'Alert price', 1,100_000_000), status: 'active', createdAt: asOf(state) };
      state.alerts.push(alert); result = { alertId: alert.id }; break;
    }
    case 'alert_remove': {
      if (!state.alerts.some(alert => alert.id === command.alertId)) fail('ALERT_NOT_FOUND', 'Alert was not found.', 404);
      state.alerts = state.alerts.filter(alert => alert.id !== command.alertId); result = { removed: true }; break;
    }
    case 'notifications_read': {
      if (command.ids !== undefined && (!Array.isArray(command.ids) || command.ids.length > 100 || command.ids.some(value => typeof value !== 'string'))) fail('INVALID_INPUT', 'Notification identifiers must be an array.');
      for (const notification of state.notifications) if (command.ids === undefined || command.ids.includes(notification.id)) notification.read = true;
      result = { saved: true }; break;
    }
    default: fail('UNKNOWN_COMMAND', 'This terminal action is unavailable.');
  }
  state.updatedAt = time;
  audit(state, command.type, { requestId, result: { ...result, riskChecks: undefined } }, time);
  state.requestLog.push({ id: requestId, fingerprint, result: copy(result) });
  if (state.requestLog.length > 256) state.requestLog.splice(0, state.requestLog.length - 256);
  return { state, result };
}

export function snapshot(state, { now } = {}) {
  if (!state || state.schemaVersion !== 1) fail('INVALID_STATE', 'Unsupported paper account schema.', 409);
  const time = iso(now);
  const markets = {};
  let advancing = 0; let declining = 0;
  for (const instrument of INSTRUMENTS) {
    const bars = SAMPLE_BARS[instrument.symbol].slice(0, state.replay.cursor + 1).map(bar => ({ ...bar }));
    const last = bars.at(-1);
    const firstToday = bars.find(bar => dayAt(bar.time) === dayAt(last.time));
    const yesterday = bars.filter(bar => dayAt(bar.time) !== dayAt(last.time)).at(-1);
    const reference = yesterday?.close ?? firstToday.open;
    const changeMinor = last.close - reference;
    if (changeMinor > 0) advancing += 1; else if (changeMinor < 0) declining += 1;
    const frames = { bars, bars5m: aggregateBars(bars, 5), bars15m: aggregateBars(bars, 15), bars1h: aggregateBars(bars, 60), bars4h: aggregateBars(bars, 240), bars1d: aggregateBars(bars, 390) };
    const selected = aggregateBars(bars, FRAME_MINUTES[state.settings.timeframe]);
    const fast = ema(selected.map(bar => bar.close), 9); const slow = ema(selected.map(bar => bar.close), 20);
    const trend = fast === null || slow === null ? 'neutral' : fast > slow ? 'bullish' : fast < slow ? 'bearish' : 'neutral';
    markets[instrument.symbol] = { ...instrument, quote: { priceMinor: last.close, changeMinor, changePercent: changeMinor / reference * 100, asOf: last.time, previousCloseMinor: reference, currency: 'USD', stale: false, mode: 'sample' }, ...frames, indicators: { ema9: fast, ema20: slow, vwap: vwap(bars), timeframe: state.settings.timeframe, warmup: { ema9: selected.length >= 9, ema20: selected.length >= 20 }, observations: selected.length }, sentiment: { label: trend, method: 'Rule based: selected-timeframe EMA 9 versus EMA 20; insufficient warm-up is neutral. Not news sentiment or AI.' } };
  }
  const balances = totals(state);
  const wins = state.closedTrades.filter(trade => trade.pnlMinor > 0);
  const losses = state.closedTrades.filter(trade => trade.pnlMinor < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnlMinor, 0);
  const grossLoss = -losses.reduce((sum, trade) => sum + trade.pnlMinor, 0);
  const watchlist = [...state.watchlist];
  if (state.settings.watchlistSort === 'symbol') watchlist.sort();
  if (state.settings.watchlistSort === 'change') watchlist.sort((a,b) => markets[b].quote.changePercent - markets[a].quote.changePercent);
  const sampleTime = asOf(state);
  const calendar = SAMPLE_CALENDAR.map(event => ({ ...event, actual: event.scheduledAt <= sampleTime ? event.actual : null, status: event.scheduledAt <= sampleTime ? 'released' : 'scheduled' }));
  return {
    schemaVersion: state.schemaVersion, updatedAt: state.updatedAt, serverTime: time,
    account: { ...state.account, ...balances, reservedMinor: reservedBuys(state), availableCashMinor: state.account.cashMinor - reservedBuys(state), completedTrades: state.closedTrades.length, winRate: state.closedTrades.length ? wins.length / state.closedTrades.length * 100 : null, profitFactor: grossLoss ? grossProfit / grossLoss : null, grossProfitMinor: grossProfit, grossLossMinor: grossLoss, netReturnPercent: (balances.equityMinor - STARTING_CASH) / STARTING_CASH * 100, metricPeriod: { from: SAMPLE_BARS.NVDA[INITIAL_CURSOR].time, to: sampleTime }, definitions: { winRate: 'Profitable FIFO lot closures / all FIFO lot closures, after allocated entry and exit fees; percentage 0–100.', profitFactor: 'Sum of positive net closed-lot P&L / absolute sum of negative net closed-lot P&L; unavailable until at least one loss exists.', unrealizedPnl: 'Current sample close value minus remaining purchase cost including entry fees. No exit fee accrual.' } },
    replay: { cursor: state.replay.cursor, total: SAMPLE_BARS.NVDA.length, asOf: sampleTime, mode: 'sample', execution: 'paper', source: copy(SAMPLE_SOURCE), remaining: SAMPLE_BARS.NVDA.length - 1 - state.replay.cursor, canAdvance: state.replay.cursor < SAMPLE_BARS.NVDA.length - 1, exchangeTimezone: 'America/New_York', session: 'US regular session, 09:30–16:00 America/New_York', barTimestamp: 'Completed interval close; the 14:31 UTC candle represents 14:30–14:31 UTC.' },
    catalog: copy(INSTRUMENTS), markets, watchlist, settings: copy(state.settings), strategy: { ...state.strategy, description: 'Example 1-minute long-only EMA trend rule: fast EMA above slow EMA and close above fast EMA, with optional session VWAP and previous-20-bar volume filters. One active entry per instrument. No profitability claim.' },
    engine: expired(state, time) ? { ...state.engine, status: 'paused', reason: 'In-tab replay lease expired. Start explicitly to resume strategy evaluations.', leaseUntilMs: null } : copy(state.engine),
    risk: { ...state.risk, dailyPnlMinor: balances.equityMinor - state.daily.openingEquityMinor, dailyOpeningEquityMinor: state.daily.openingEquityMinor, tradesToday: state.fills.filter(fill => fill.side === 'buy' && dayAt(fill.time) === dayAt(sampleTime)).length, day: state.daily.date, exposureMinor: balances.marketValueMinor, exposurePercent: balances.equityMinor ? balances.marketValueMinor / balances.equityMinor * 100 : 0, checks: riskChecks(state, { symbol: state.settings.selectedSymbol, side: 'buy', quantity: state.strategy.quantity }, Math.ceil(quoteAt(state, state.settings.selectedSymbol) * (10000 + state.risk.slippageBps) / 10000)) },
    positions: state.positions.map(position => { const marketPriceMinor = quoteAt(state, position.symbol); return { ...position, marketPriceMinor, marketValueMinor: position.quantity * marketPriceMinor, unrealizedPnlMinor: position.quantity * marketPriceMinor - position.costBasisMinor }; }),
    orders: state.orders.map(order => { const { fingerprint, ...publicOrder } = order; return copy(publicOrder); }), fills: copy(state.fills), ledger: copy(state.ledger), closedTrades: copy(state.closedTrades), signals: copy(state.signals), alerts: copy(state.alerts), notifications: copy(state.notifications), audit: copy(state.audit),
    news: SAMPLE_NEWS.filter(item => item.publishedAt <= sampleTime).map(item => ({ ...item, symbols: [...item.symbols] })).reverse(), calendar,
    regime: { label: advancing >= 4 ? 'bullish' : declining >= 4 ? 'bearish' : 'mixed', advancing, declining, total: INSTRUMENTS.length, asOf: sampleTime, method: 'Rule based: at least four of five sample instruments above/below their previous session close. Otherwise mixed. This is sample breadth, not an AI prediction.' },
    executionModel: { name: 'Conservative OHLC paper model v1', wholeShares: true, priceCurrency: 'USD', accountCurrency: 'USD', fx: null, fillTiming: 'Next eligible 1-minute bar; no same-bar discretionary entry fills.', market: 'Next bar open plus adverse slippage.', limit: 'Limit price only when touched; no favorable opening improvement.', stop: 'Worse of stop/open, plus adverse slippage.', brackets: 'Stop before target if both touch. Same-entry-bar target is not assumed; same-entry-bar stop may fill.', liquidity: 'No queue, spread feed, partial fills or real liquidity simulation. Execution can fall outside an OHLC extreme after adverse slippage.', fee: 'One configured flat fee per completed order; entry fees allocated to FIFO cost basis.', runtime: 'In-tab replay only. No background worker or real broker.' },
  };
}
