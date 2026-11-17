# Fictional replay and paper engine

`netlify/terminal/engine.mjs` is the server-owned, pure state transition boundary. It exports `createInitialState({now})`, `applyCommand(state,command,requestId,{now}) -> {state,result}`, `snapshot(state,{now})`, `TerminalError`, `ema`, and `aggregateBars`. Commands clone their input; invalid inputs throw an error with `code`, `message`, and `status`. Risk rejection is a recorded order with `status:'rejected'`, not a completed trade. Store the returned state atomically before acknowledging success.

## Provenance and clock

Every quote, candle, news item and calendar event is an **original fictional fixture**, not current/historical exchange data or real news. The source/version/method/licence are exported as `SAMPLE_SOURCE`. Five instruments are supported: NVDA, AMD, MSFT, AAPL and SPY. The real ticker names do not make their sample prices factual. No feed, broker, paid API, random movement or AI model is involved.

The fixed fixture comprises 780 completed one-minute regular-session bars across 13 and 16 November 2026. Prices are integer USD cents; volumes and traded quantities are integer shares. Timestamps are UTC **interval-close** times: 14:31 UTC represents 14:30–14:31 UTC. Session boundaries follow 09:30–16:00 America/New_York on these two dates. No overnight candles are fabricated. The first cursor is 509, as of 16 November 16:30 UTC. There are 102 completed five-minute and 34 completed fifteen-minute warm-up bars initially. EMA values are unavailable until their requested period has sufficient completed candles; the 1h/4h/daily views may lack warm-up.

Replay progresses only through `replay_advance` and can never rewind an existing ledger. A server wall clock `recordedAt`/audit `time` is distinct from sample-market `time`/`marketTime`. News is withheld until its publication time. Scheduled calendar metadata is visible in advance, while actual values remain null until release. Indicator and strategy calculations never read beyond the current cursor.

## Money and fill model

Each new account starts with **virtual USD 100,000**, independent of the public 2026 NOK report. Whole-share long-only orders use integer cents. No FX conversion occurs. Cash, fees, order consideration, cost basis and ledger amounts remain safe integers. Indicators and ratios may be fractional because they are not ledger amounts.

Submission records a pending order. It becomes eligible only on a strictly later one-minute bar. Market entries use that bar's open plus adverse configured slippage; sells subtract slippage. Limit fills occur at the limit only when touched, with no favorable opening-gap improvement. Stops use the worse of open/stop plus adverse slippage. The model has no real order book, queue, partial fills or liquidity simulation. Slippage may take an execution beyond that candle's reported extreme.

Attached stop loss and profit target belong to an entry lot. Existing lots process protective exits before pending discretionary orders. If a candle touches both exits, the stop takes precedence. New entries can stop out in their entry candle, but a same-entry-candle target is not assumed. A gap making the submitted bracket invalid rejects the entry. Protective exits cancel competing discretionary sell orders for that symbol. Cancelled/filled/rejected orders cannot be cancelled again. Replay exhaustion cancels remaining pending orders.

Each completed order incurs the configured flat fee. Entry fees enter FIFO lot cost basis; exit fees are allocated across the closed FIFO lots, conserving every cent. `realizedPnlMinor` is net of allocated entry and exit fees. `unrealizedPnlMinor` equals marked value minus remaining cost basis, with no hypothetical exit fee. Therefore `equityMinor-startingCashMinor === realizedPnlMinor+unrealizedPnlMinor`. Ledger amounts sum to cash. Financial orders, fills, ledger entries and closed trades are retained; none are trimmed as an audit cache.

Pending buy orders reserve their estimated price plus fee. Server-side submission **and fill-time** checks enforce available cash, total exposure, per-instrument exposure, daily marked loss and daily entry count (including pending reservations). Sell orders require held, unreserved shares; reductions remain available after a buy-side risk breach. Exposure and daily loss at a fill use available opening prices, never the future close. Protective exits reduce risk and bypass buy-side limits. Daily loss uses the sample account's day-opening marked equity; for the first partial session, the opening value is the newly created virtual account. Entry counts are buy fills, not exit fills.

`winRate` is 0–100 and counts profitable net FIFO lot closures divided by all closures. A partial exit can close part of a lot and counts as a closure. Before closures it is null. `profitFactor` is positive net closed P&L divided by absolute negative net closed P&L; it is null until a negative closure exists, including a winning-only history (no false infinity). Metric definitions and period are included in snapshots.

## Commands

Every command has `type` and a stable `requestId` passed separately to `applyCommand`. Reuse the same request ID for a retry, not for another action. The latest 256 command receipts are bounded in engine state; original order request IDs and fingerprints remain on orders permanently, so old buy retries cannot create another order. The server additionally owns durable command receipts for all request IDs. A reused ID with a different payload fails with `IDEMPOTENCY_CONFLICT`.

| Command | Payload beyond type |
| --- | --- |
| `select_symbol` | `symbol` |
| `watchlist_add`, `watchlist_remove` | `symbol` |
| `watchlist_sort` | `sort:'manual'|'symbol'|'change'`, optional `symbols` containing a complete manual ordering |
| `settings_update` | `settings:{...}` and/or `risk:{...}` |
| `strategy_update` | `strategy:{...}` |
| `engine_start`, `engine_pause`, `engine_stop` | none |
| `replay_advance` | `steps` integer 1–30, default 1 |
| `order_submit` | `confirmed:true,symbol,side:'buy'|'sell',orderType:'market'|'limit'|'stop'` (default market), integer `quantity`, `limitPriceMinor` for limit, `stopPriceMinor` for stop; optional buy `stopLossMinor,takeProfitMinor` |
| `order_cancel` | `orderId` |
| `alert_add` | `symbol,direction:'above'|'below',priceMinor` |
| `alert_remove` | `alertId` |
| `notifications_read` | optional `ids` array; omitted means all current notifications |

Settings contain `selectedSymbol`, `timeframe` (`1m,5m,15m,1h,4h,1d`), IANA `timezone`, `language` (`en,nb`), `watchlistSort`, `indicators:{ema9,ema20,vwap}` boolean toggles, and `display:{compact:boolean,chartTimeframe?:...}`. Unknown fields are rejected. Risk fields and defaults: `maxExposureBps:6000,maxPositionBps:2500,maxDailyLossMinor:200000,maxTradesPerDay:20,feePerOrderMinor:100,slippageBps:5`. A basis point is 1/100 of one percent; 6000 means 60%. Risk updates cannot set instrument exposure above portfolio exposure.

Strategy fields and defaults: `fastPeriod:9,slowPeriod:20,useVwap:false,useVolume:false,volumeMultiplier:1,quantity:10,stopLossBps:150,takeProfitBps:300,autoTrade:true`. Version `ema-trend-1.0` is a documented **example**, not a profitability claim. The rule evaluates completed **one-minute** bars regardless of chart timeframe: fast EMA above slow EMA and close above fast EMA, optional close above current session VWAP, optional volume at least the preceding 20-bar mean times the multiplier. No position/pending entry for that instrument is allowed. Passing conditions and all risk checks create a next-bar paper entry when autoTrade is enabled.

The lifecycle is `stopped -> starting -> running`, with `paused`, `blocked`, and reserved `error` states. Start waits for an actual replay advance before running an evaluation. Pause stops new strategy evaluations; existing orders and protective exits remain active if the user advances the market. Stop also cancels pending strategy entries; it does not liquidate holdings or cancel manual orders. A risk failure can block strategy entries. Invalid commands produce errors without corrupting account state. Start and each replay advance renew a **20-second in-tab lease** (`leaseUntilMs`, `lastTickAt`, `leaseDurationMs`). Snapshots show expired leases as paused, and each new mutation normalizes expiry before applying its action and records `engine_lease_expired`. Advancing after expiry does not resume automatic strategy evaluation; an explicit start is required. The frontend also pauses a persisted starting/running engine when reconnecting. The engine has no timer or background worker: no market advance or fill happens while the tab is closed. A lease never prevents existing protective exits from running when the user explicitly advances replay.

## Snapshot fields for the UI

All money fields ending in `Minor` are USD cents. All times are ISO UTC strings. Snapshot does not expose request fingerprints/receipts. It contains:

- `account`: currency, starting/cash/available/reserved/equity/market-value/realized/unrealized/fees amounts, completedTrades, winRate, profitFactor, grossProfitMinor, grossLossMinor, netReturnPercent, metricPeriod and definitions.
- `replay`: zero-based cursor, total, remaining, canAdvance, asOf, mode:'sample', execution:'paper', source object, exchangeTimezone, session and barTimestamp explanation.
- `catalog`: `{symbol,name,exchange,currency,sector}` array. `markets` is keyed by symbol. Each entry adds `quote:{priceMinor,changeMinor,changePercent,previousCloseMinor,asOf,currency,mode,stale}`, `bars,bars5m,bars15m,bars1h,bars4h,bars1d`, `indicators:{ema9,ema20,vwap,timeframe,warmup,observations}`, `sentiment:{label,method}`. Bars use `{time,open,high,low,close,volume}`; OHLC are cents. Change is against the previous fixture session close. VWAP uses typical price and volume since the current session opened. Sentiment is a named EMA rule, not news analysis or AI.
- `watchlist`, `settings`, `strategy`, `engine` and `risk`. Engine has status, reason, lastEvaluationAt, processedBars, runtime:'in-tab-replay', durableWorker:false, lastTickAt, leaseUntilMs and leaseDurationMs. Risk adds dailyPnlMinor, dailyOpeningEquityMinor, day, tradesToday, exposureMinor, exposurePercent and current proposal `checks`.
- `positions`: entry lots `{id,symbol,quantity,averagePriceMinor,costBasisMinor,entryFeesMinor,openedAt,openedCursor,sourceOrderId,stopLossMinor,takeProfitMinor,marketPriceMinor,marketValueMinor,unrealizedPnlMinor}`. Several lots may have the same symbol.
- `orders`: `{id,requestId,symbol,side,orderType,quantity,source:'manual'|'strategy'|'bracket',status:'pending'|'filled'|'cancelled'|'rejected',submittedAt,submittedCursor,recordedAt,limitPriceMinor,stopPriceMinor,stopLossMinor,takeProfitMinor,reservedMinor?,estimatedPriceMinor?,estimatedFeeMinor?,riskChecks?,reason?,filledAt?,filledCursor?,fillPriceMinor?,feeMinor?,riskChecksAtFill?,cancelledAt?,rejectedAt?}`. A filled bracket has a server-generated order ID and null request ID.
- `fills`: `{id,orderId,time,symbol,side,quantity,priceMinor,grossMinor,feeMinor,source}`.
- `ledger`: `{id,time,type:'deposit'|'buy'|'sell'|'fee',amountMinor,cashAfterMinor,description,orderId?,symbol?,quantity?,priceMinor?}`. Positive amount adds cash. No report returns enter this ledger.
- `closedTrades`: net FIFO closures with entry/exit times/prices/order IDs, quantity, fees, cost basis, net proceeds and `pnlMinor`.
- `signals`: `{id,symbol,time,strategyVersion,timeframe:'1m',source,priceMinor,quantity,estimatedEntryMinor,estimatedFeeMinor,estimatedRiskMinor,stopLossMinor,takeProfitMinor,conditions:[{id,label,enabled,met,actual,expected}],conditionsMet,conditionsTotal,riskChecks:[{id,label,passed,actual,limit}],decision:'wait'|'allowed'|'blocked',orderId,dataSnapshot}`. Data snapshot retains asOf,cursor,closeMinor,emaFastMinor,emaSlowMinor,vwapMinor,volume,previousVolumeAverage. Condition agreement is not a confidence percentage. Disabled filters do not increase the count. Stable risk IDs are cash, exposure, position, daily-loss, trade-limit, holdings, sell-fee and one-entry.
- `alerts`: `{id,symbol,direction,priceMinor,status:'active'|'triggered',createdAt,triggeredAt?,triggerPriceMinor?}`. Trigger once on a completed close meeting the threshold; no browser/push delivery is claimed.
- `notifications`: `{id,time,recordedAt,type:'info'|'success'|'warning',title,message,read}`. `audit`: `{id,time,marketTime,action,detail}`. Caps are 100 notices, 300 audit events, 120 signals, and 100 user alerts. Financial history is retained.
- `news`: already time-filtered newest-first `{id,symbols,category,title,summary,publishedAt,source,url:null,fixture:true,summaryMethod,sentiment:null,impact:null}`. No original-article link exists for fiction. No generated impact/confidence is invented.
- `calendar`: `{id,title,country,currency,scheduledAt,previous,forecast,actual,unit,source,url:null,fixture:true,status:'scheduled'|'released'}`. Numbers are illustrative strings; null means unavailable.
- `regime`: `{label:'bullish'|'bearish'|'mixed',advancing,declining,total,asOf,method}` is a disclosed five-instrument sample breadth rule. `executionModel` explains fill/fee/runtime limitations.

## Verification

Run `node --test tests/terminal-engine.test.mjs`. These tests exercise deterministic provenance, chronology, indicator warm-up, exact ledger conservation, fees/FIFO, invalid-input atomicity, risk at submission/fill, idempotency, stop/limit/bracket behavior, strategy evidence, lifecycle, alert persistence and future-data exclusion. They establish the local sample model only; no real broker, provider entitlement or production worker is tested.
