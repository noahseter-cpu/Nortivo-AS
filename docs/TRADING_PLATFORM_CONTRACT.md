# Nortivo Trading Platform implementation contract

The selected visual target is C:/Users/noahn/Downloads/Nortivo_Approved_Trading_Interface.png. The owner's complete implementation brief is Nortivo_Trading_Platform_Implementation_Prompt.txt in the same directory. Preserve the public website and its existing integrations. This is a new Operate surface, not a marketing redesign.

## Architecture and boundaries

- Keep the static Netlify site. App routes are /en/terminal/, /nb/terminal/ and the legacy /terminal/ route. The app has its own compact shell and bilingual copy.
- Use a server-owned, deterministic sample replay and paper ledger. Start each new account with explicitly virtual USD 100,000; stock sample prices are USD. No conversion of the existing NOK report or user funds occurs. Nortivo's published 2026 history appears only in its separately identified report panel.
- Shared report source remains /report-2026/summary.json and equity-series.json. The public headline change selects averageDeployedDailyPercent, with its deployed-capital basis, rather than changing the report or the averaging definition.
- Local development uses Node's built-in SQLite, under ignored .local/. Production persistence uses the existing server-only Supabase configuration with an additive migration and atomic revision compare-and-set. Never use ephemeral production files as a database.
- New app authentication is isolated from support/admin. Random HttpOnly sessions, password hashing, same-origin/CSRF enforcement, bounded persisted rate limits and server-side authorization protect each user's records. No real account is created by the agent; tests use .test identities.
- Broker execution is unconditionally disabled. Data adapters are opt-in and require both credentials and an explicit commercial-display entitlement setting; missing services show unavailable states without substituting fake live activity. Optional AI summaries remain unavailable unless a separate configured service exists.

## Shared engine modules

`netlify/terminal/engine.mjs` exports `createInitialState({now})`, `applyCommand(state, command, requestId, {now}) -> {state,result}` and `snapshot(state,{now})`. Commands operate on a clone and throw a typed error with code/status on invalid input. Money/prices use integer minor units and whole-share quantities. Request IDs are persisted for idempotency. The engine obtains prices only from its server-owned fixed fixture and current replay cursor.

`netlify/terminal/sample-data.mjs` exports the sample instrument catalogue, full fixed bars, news/calendar fixtures and source/method labels. All sample content is explicitly fictional. Historical report values never initialize paper account metrics.

Snapshots expose: `account` (currency, startingCashMinor, cashMinor, equityMinor, realizedPnlMinor, unrealizedPnlMinor, feesMinor, winRate/profitFactor null until completed trades, completedTrades); `replay` (cursor,total,asOf,mode:'sample',execution:'paper',source); `catalog`; `markets` keyed by symbol (current quote and bars only through cursor); `watchlist`; `settings`; `strategy`; `risk`; `positions`; `orders`; `fills`; `ledger`; `signals`; `alerts`; `notifications`; `audit`; `news`; `calendar`; and a rule-based `regime` if supported. JSON record fields must be documented by the engine owner for the UI owner.

Commands: select_symbol, watchlist_add, watchlist_remove, watchlist_sort, settings_update, strategy_update, engine_start, engine_pause, engine_stop, replay_advance, order_submit, order_cancel, alert_add, alert_remove, notifications_read. Use command.type and remaining fields as the payload. `order_submit` requires confirmed:true; prices, quantity, fees and limits are validated on the server. Replay moves forward only; no future candles/news enter decisions. Strategy fills occur on the next eligible bar, with explicit fees/slippage and conservative stop/target ordering. Running bots are in-tab replay, never advertised as persistent workers.

## HTTP contract

Single same-origin endpoint `/.netlify/functions/terminal?action=...`:

- GET action=session: `{user:{id,kind:'guest'|'user',email?},csrfToken,state:<snapshot>,integrations:<statuses>}`; 401 if no session.
- POST action=guest: create isolated guest and session; return the session shape. Guest expiry and storage limits are disclosed.
- POST action=signup/login: `{email,password,name?}`; return session shape. No actual email verification/delivery is claimed.
- POST action=logout: clear session and return `{ok:true}`.
- POST action=command: `{requestId,command}` with X-CSRF-Token; return `{state:<snapshot>,result}`.
- GET action=integrations/news/calendar/market: configured adapter status or explicitly selected sample/provider data. No silent live-to-sample switch.
- GET action=export: authenticated CSV trade history.

Errors are `{error:{code,message}}` with appropriate HTTP status, no secrets or provider bodies. Every private route resolves identity from the session, not client IDs. The UI refreshes from the returned authoritative state, retains drafts on error and never invents saved success.

## Delivery stages

1. Engine/data invariants, server persistence/auth and faithful shell are developed independently against this contract.
2. Connect and exercise the complete paper workflow, all visible module actions, localization and provider-unavailable states.
3. Integrate the homepage frame, native enlarged preview, route links and exact +2.40% historical metric selection. Replace artwork with an actual application screenshot after functional and visual QA.
4. Test desktop/laptop/mobile, keyboard/reduced motion, account isolation, duplicate requests, fills/rejections, persistence, indicator warm-up, chronology and source accuracy. Document required external setup separately from implemented behavior and production readiness.
