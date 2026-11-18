import crypto from 'node:crypto';
import { fail, commandDigest } from '../terminal/security.mjs';
import { change, owned, requestId, clean, listAllRecords } from './providers-core.mjs';
import { instrument } from './providers-data.mjs';

export function validateStrategy(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('INVALID_STRATEGY','Provide a strategy to validate.',400);
  instrument(input.instrumentId);
  if (!Number.isInteger(input.fast) || !Number.isInteger(input.slow) || input.fast < 2 || input.slow <= input.fast || input.slow > 200 || !/^\d{1,5}$/.test(String(input.quantity)) || Number(input.quantity) < 1 || !['paper', 'live'].includes(input.mode) || typeof input.connectionId !== 'string' || input.enabled === true && !input.connectionId) fail('INVALID_STRATEGY', 'Use a daily moving-average crossover with 2–200 periods and a whole-share size. Enabled automation requires an account binding.', 400);
  return { name: clean(input.name || 'Daily moving-average crossover', 100), kind: 'sma_cross', instrumentId: input.instrumentId, fast: input.fast, slow: input.slow, quantity: String(input.quantity), connectionId: input.connectionId, mode: input.mode, enabled: input.enabled === true, timeframe: '1day', corporateActions: 'Adjusted history; broker positions are authoritative. No automatic split quantity changes.' };
}
export function signals(bars, { fast, slow }, now = Date.now()) {
  // The current UTC day is excluded. Signals cannot see a still-forming daily bar.
  const cutoff = new Date(now).toISOString().slice(0, 10), closed = bars.filter(b => b.time.slice(0, 10) < cutoff), result = [];
  const average = (at, periods) => closed.slice(at - periods + 1, at + 1).reduce((n, b) => n + Number(b.close), 0) / periods;
  for (let i = slow; i < closed.length; i++) {
    const previous = average(i - 1, fast) - average(i - 1, slow), current = average(i, fast) - average(i, slow);
    result.push({ time: closed[i].time, signal: previous <= 0 && current > 0 ? 'buy' : previous >= 0 && current < 0 ? 'sell' : 'hold', fast: average(i, fast), slow: average(i, slow) });
  }
  return result;
}
export function backtestStrategy(bars, strategy, { initialCash = 10000, fee = 1, slippageBps = 10, now = Date.now() } = {}) {
  if (![initialCash, fee, slippageBps].every(Number.isFinite) || initialCash < 100 || initialCash > 10000000 || fee < 0 || fee > 100 || slippageBps < 0 || slippageBps > 1000) fail('INVALID_BACKTEST_COSTS', 'Choose valid starting cash, fees and slippage.', 400);
  const signalMap = new Map(signals(bars, strategy, now).map(s => [s.time, s.signal]));
  if (bars.length < strategy.slow + 2) fail('INSUFFICIENT_HISTORY', 'The provider did not supply enough history for this strategy.', 409);
  let cash = initialCash, held = 0, previousSignal = 'hold'; const trades = [], curve = [];
  for (const bar of bars) {
    if (Date.parse(bar.time) >= now) continue;
    const qty = Number(strategy.quantity);
    if (previousSignal === 'buy' && held === 0) { const price = Number(bar.open) * (1 + slippageBps / 10000), cost = qty * price + fee; if (cash >= cost) { cash -= cost; held = qty; trades.push({ time: bar.time, side: 'buy', quantity: qty, price, fee }); } }
    if (previousSignal === 'sell' && held > 0) { const price = Number(bar.open) * (1 - slippageBps / 10000); cash += held * price - fee; trades.push({ time: bar.time, side: 'sell', quantity: held, price, fee }); held = 0; }
    curve.push({ time: bar.time, equity: cash + held * Number(bar.close) }); previousSignal = signalMap.get(bar.time) || 'hold';
  }
  const endingEquity = curve.at(-1)?.equity ?? cash;
  return { simulated: true, mode: 'backtest', currency: 'USD', initialCash, endingEquity, returnPercent: (endingEquity / initialCash - 1) * 100, trades, curve, assumptions: { feePerOrder: fee, slippageBps, fill: 'Next daily open after a completed crossover bar; long only; no fill at signal close.', history: 'Provider-adjusted daily OHLC; no dividends credited separately, no reconstructed portfolio history.', limitations: 'No queue, liquidity, tax, spread or borrow simulation. Float arithmetic is confined to labeled simulation, not the financial ledger.' } };
}
export async function handleStrategy(ctx, action, body, params, providers) {
  if (action === 'product-strategy' && !body) { return { strategies: (await listAllRecords(ctx.store,'strategies',{ownerId:ctx.user.id,prefix:`${ctx.user.id}:`})).map(row => row.value) }; }
  if (action === 'product-strategy') {
    const rid=requestId(body.requestId),input=validateStrategy(body.strategy),id=body.strategyId||crypto.randomUUID(),key=`${ctx.user.id}:${id}`;
    const receiptKey=`${ctx.user.id}:strategy:${rid}`,digest=commandDigest({strategyId:body.strategyId||null,input});
    for(let attempt=0;attempt<8;attempt++){
      const receipt=await ctx.store.get('receipts',receiptKey);
      if(receipt){if(receipt.ownerId!==ctx.user.id||receipt.value.digest!==digest)fail('IDEMPOTENCY_CONFLICT','This request ID belongs to another strategy change.',409);return {strategy:(await owned(ctx.store,'strategies',`${ctx.user.id}:${receipt.value.strategyId}`,ctx.user.id)).value,replayed:true};}
      await ctx.requireFeature('strategy.write');
      const previous=await ctx.store.get('strategies',key);if(previous&&previous.ownerId!==ctx.user.id)fail('NOT_FOUND','Strategy not found.',404);
      const value={...input,id,version:(previous?.value.version||0)+1,createdAt:previous?.value.createdAt||ctx.now,updatedAt:ctx.now};
      const changes=[change('strategies',key,ctx.user.id,previous,value),change('receipts',receiptKey,ctx.user.id,null,{digest,strategyId:id,version:value.version,recordedAt:ctx.now})];
      // Moving a strategy must stop the old binding in the same transaction as
      // its version change. Already queued old-version entries then fail closed.
      for(const connectionId of new Set([previous?.value.connectionId,input.connectionId].filter(Boolean))){
        const connection=await owned(ctx.store,'broker_connections',`${ctx.user.id}:${connectionId}`,ctx.user.id);
        if(connection.value.strategyId===id)changes.push(change('broker_connections',connection.key,ctx.user.id,connection,{...connection.value,automationEnabled:false,stoppedReason:'Strategy changed. Review and authorize this version before restarting.'}));
      }
      if((await ctx.store.transact(changes)).status==='applied')return {strategy:value,replayed:false};
    }
    fail('CONCURRENT_UPDATE','The strategy changed. Retry with the same request ID.',409);
  }
  if (action === 'product-backtest') {
    await ctx.requireFeature('backtest.run'); const strategy = body.strategyId ? (await owned(ctx.store, 'strategies', `${ctx.user.id}:${body.strategyId}`, ctx.user.id)).value : validateStrategy(body.strategy);
    const { bars, source } = await providers.history({ instrumentId: strategy.instrumentId });
    return { ...backtestStrategy(bars, strategy, { ...body.costs, now: ctx.now }), source, strategyVersion: strategy.version || null };
  }
  if (action === 'product-scan') {
    await ctx.requireFeature('scan.run');
    if (!Array.isArray(body.instrumentIds) || body.instrumentIds.length < 1 || body.instrumentIds.length > 8 || new Set(body.instrumentIds).size !== body.instrumentIds.length) fail('INVALID_SCAN', 'Select 1–8 distinct supported instruments for a bounded scan.', 400);
    const results = [];
    for (const instrumentId of body.instrumentIds) { instrument(instrumentId); const { bars, source } = await providers.history({ instrumentId }); results.push({ instrumentId, signal: signals(bars, { fast: 20, slow: 50 }, ctx.now).at(-1) || null, source }); }
    return { results, definition: 'Completed daily 20/50 simple moving-average crossover', asOf: new Date(ctx.now).toISOString() };
  }
  fail('UNKNOWN_ACTION', 'Strategy action is unavailable.', 404);
}
