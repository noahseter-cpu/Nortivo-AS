# Shared subscription implementation contract

Root: C:/Users/noahn/Documents/ChatGPT/Nortivo FInal. Existing static/Netlify/Node stack stays. New modules use ESM. No secret or private account data in fixtures or commits. User's new spec supersedes the former permanent paper-only product scope; actual live transmission remains separately gated until verified readiness and user enablement.

## Ownership
- Commerce worker: `netlify/product/{store*,auth*,billing*,plans*,entitlements*,service*,mfa*}.mjs`, `netlify/functions/terminal.mjs` integration, separate Stripe webhook endpoint, existing terminal store adapters/security capability extension, additive `supabase/product.sql`, their tests/docs/package dependencies. Preserve original handlers when PRODUCT_ENABLED is not true. Own local-server integration/wiring after coordinating root portfolio/providers.
- Integrations worker: `netlify/product/{providers*,broker*,ai*,worker*,execution*,health*}.mjs`, worker scripts/deployment definition, tests and provider/cost docs. No auth/billing/store implementation edits.
- UI worker: `dist/terminal/*` (preserve chart), `dist/portfolio/*`, `dist/pricing/*`, new product client assets, UI docs. Root owns existing public homepage/shared localization/nav/generator/privacy integration.
- Root: `netlify/product/portfolio*.mjs`, decimal financial domain, portfolio tests; shared contract/coordination, marketing wiring, final browser/testing/release. Do not edit another owner's modules without coordination.

## Existing identity and public API
Keep terminal_users.id, terminal_sessions, terminal_states and terminal_receipts ownership. Existing `nortivo_terminal` cookie path is /.netlify/functions/terminal. Extend this endpoint for application actions; a sibling endpoint cannot assume it receives that cookie. Stripe webhook is separate, signature-validated original body; broker redirect is public callback with cryptographic state, not a CSRF bypass for other actions.

Main endpoint remains `/.netlify/functions/terminal?action=...`, GET or JSON POST. Errors `{error:{code,message}}`; JSON never exposes upstream bodies/secrets. Same-origin and CSRF remain. Request IDs 8..128 chars required for idempotent writes. Legacy `session` can add `product`; `product` GET returns complete account/product snapshot without replaying a command. New actions are prefixed `product-` (see below). Authentication actions signup/login/logout remain, with product verification/recovery added. Raw callback tokens use fragments or deliberate POST confirmation, not GET consumption. Locale/tier/interval/return path are validated and retained server-side through the journey.

Products: portfolio / pro. Intervals month / year. Price minor USD {portfolio:{month:1000,year:9600},pro:{month:3000,year:28800}}. Exact server price IDs; no coupon or trial. `getPlanCatalog()` is shared by backend and UI via public pricing response. UI must not choose actual Stripe IDs/amounts.

## Product store boundary
Expose `legacyStore.product` backed by the same local SQLite database or Supabase tables, not browser storage. Namespace/key records with private owner binding and transactional CAS:
- `get(ns,key) -> null | {value,version,ownerId,expiresAt}`
- `list(ns,{ownerId,prefix?,limit?}) -> records with key/value/version/ownerId`
- `transact(changes) -> {status:'applied'|'conflict',...}`; each change `{ns,key,ownerId,expectedVersion:null|number,value:object|null,expiresAt?:number|null}`. Sorted locking/atomic all-or-nothing across records, bounded payloads, service-role-only SQL. `null` expected version means create-if-absent. No partial quota/event/order commits.
- Legacy password update + all-session revocation, token consume/verification, and new verified-account creation need atomic store operations. Commerce owner can add narrowly scoped methods and document them immediately.
- Financial history and permanent idempotency receipts are never trimmed to make quota space. Generic receipt writes need resource limits; no unbounded anonymous allocations.

Data namespaces: accounts (key userId), portfolios (key `${userId}:${portfolioId}`), receipts (key scoped actor+requestId), tokens (hash only), billing_customers, billing_events, ai_usage, ai_requests, broker_connections, broker_states, order_intents, broker_events, strategies, jobs, worker_health. Use records for the smallest suitable design; any additional relational tables remain additive and RLS protected. Namespace reads/writes are server APIs only, never arbitrary client ns/key access.

## Service context and contracts
Services receive `{store:legacyStore.product, legacyStore, user, sessionHash, env, now:number, fetcher, origin, requireFeature(feature), requireStepUp(scope), providers}`; user is derived from validated legacy session. Handlers return plain JSON or response envelope when setting a cookie/redirect/export. Commerce dispatches `handlePortfolio(ctx,action,body,params)` (root) and integration worker `handleIntegrations(ctx,action,body,params)`. Exports should be agreed quickly with the worker; no silent fake-success handler when dependency missing.

Snapshot contract for UI, `product` GET:
```
{user:{id,email,name,emailVerified}, selectedPlan:{tier,interval}|null,
 billing:{mode,status,tier,interval,currentPeriodStart,currentPeriodEnd,cancelAtPeriodEnd,nextCharge,changePending,ready},
 entitlements:{features:string[],tier:'none'|'portfolio'|'pro',paidUntil,reason},
 readiness:{market,news,calendar,broker,ai,email,billing,worker},
 ai:{remainingRequests,requestLimit,remainingTokens,tokenLimit,resetAt},
 portfolios:[summary], broker:{connections:[],liveReleaseEnabled:false},
 onboarding:{step,returnPath}, capabilities:{...}}
```
Each integration state separates configured, permissionsReady, reachable (null until actual probe), freshness, planIncluded, connected/authorized and safe public reason. Admin-only diagnostics contain configuration details without credentials. Billing readiness for taking a payment must account for mandatory offered features, not merely presence of a Stripe key.

## Portfolio domain (root)
Pure exports createPortfolio(input,{now}), applyPortfolioCommand(state,command,{now}), summarizePortfolio(state,{quotes,fx,now}) and handlePortfolio(ctx,action,body,params). Stored money/quantities are canonical decimal strings or integer-minor-unit strings with explicit currency and scale; financial math uses fixed-point BigInt. No floating-point ledger. Portfolio IDs/transaction IDs UUIDs. Opening positions may have purchaseDate:null. Manual records stay separate from broker positions. No artificial history; historical snapshots begin when recorded. Unsupported/manual valuations and missing FX produce explicit partial totals.
API actions:
- `product-portfolio` GET (optional portfolioId; list or full owned detail)
- `product-portfolio` POST `{requestId,command:{type,portfolioId?,...}}`
Commands: portfolio_create {name,displayCurrency}; opening_position {instrument,quantity,unitCost,purchaseDate?,fees?,notes?}; transaction_add {kind:'buy'|'sell'|'deposit'|'withdrawal'|'dividend'|'split',...}; transaction_correct {transactionId,replacement}; transaction_void {transactionId}; valuation_set {instrumentId,price,currency,asOf}; portfolio_settings {name?,displayCurrency?}. Ownership is always actor-derived, not client IDs. Validate complete amended ledger before save. No historical date guessed from current holdings.

## Integrations/execution (worker)
Initial coverage US stocks/ETFs with explicit instrument venue/currency IDs and search disambiguation. Research official provider docs/rights/prices before selecting. Existing Finnhub code can be reused where licensed. No credentials/contracts means unavailable, not random production prices. Keep original sample engine independent.
Suggested new actions: `product-catalog`, `product-quotes`, `product-news`, `product-calendar` GET; `product-ai` POST; `product-ai-usage` GET; `product-broker-status` GET; `product-broker-connect/disconnect/consent/order/cancel/stop` POST; OAuth callback validated state. `product-strategy` GET/POST, `product-backtest` POST, `product-scan` POST, `product-health` admin-only GET. Publish exact exported dispatch/action contracts to root/UI before implementing incompatible names.
AI cannot execute an order or change risk. Atomic per-actor monthly quotas and idempotent reservation/settlement with explicit token limits/budget; actual provider errors never become a fake explanation. The owner chose OpenAI or the best supported economical option. The selected default is OpenAI gpt-6-luna, with configurable supported Terra. Secure key setup has not completed because the picker was not visible. No paid/free DeepSeek/OpenCode access is assumed.
Worker runs outside the browser, uses per-account durable lease/fencing + idempotent intents, reconciliation before risk-increasing submissions, handles broker order states/partial fills/out-of-order events/timeouts. No live transmission until all release/approval/auth/consent/MFA/freshness/risk gates pass. Downgrade/expiry stops new risk, never forces liquidation or removes stop/cancel/reduce/read controls. Independent heartbeat and owner health view; no worker-ready claim from a flag alone.

## UI and localization
Extend existing Manrope/IBM Plex/charcoal/silver/green system. Portfolio gets a meaningful holdings-first view; Pro retains dense terminal. Pricing exact totals and 20% toggle; no grand redesign/concept round. Functional native forms/dialog/focus and 44px mobile controls; motion120–250ms onlywhereuseful. Both NB/EN complete. Public demo read-only when PRODUCT_ENABLED, not an unrestricted engine behind blur. Existing account/history/export/safety controls survive subscription expiry. All customer-facing availability follows server state.

No production activation until candidate tests/reviews and actual credentials/rights are verified. User authorized eventual publication; do not ask again for routine reversible implementation or the already-authorized deployment. New paid contracts/provider purchases and real-money tests are outside that authorization. Preserve old site and data throughout.

## Implemented commerce boundary

`legacyStore.productIdentity(input)` is an internal atomic identity operation: create inserts the existing terminal user/state plus supplied product changes; update consumes verification plus account CAS; password checks expectedPasswordHash, commits token/account changes, updates the same user UUID and revokes all sessions. `productCreateSession(session)` bounds active sessions at 50 atomically. Other narrow methods are findUserById, listSessions and owner-bound revokeSessions. No Supabase Auth is added.

Generic store namespaces additionally include billing_checkout, billing_previews, mfa, mfa_sessions, audit, provider_health, provider_meter, provider_cache and worker_leases. List owner omission is internal worker/admin enumeration only. Deleted records retain owner/version tombstones; create-after-delete requires expectedVersion null and retains monotonically increasing versions. Owner reassignment remains forbidden.

Public catalog action is product-plans (product-pricing alias). Account/mfa/billing routes and request fields are documented in IDENTITY_BILLING_SETUP.md. getPlanCatalog returns productEnabled,currency,annualDiscountPercent,plans; dispatch adds ready, per-tier availability and readiness. Signup uses a generic result for new/existing addresses; verification/recovery tokens are deliberate POST inputs. Account authTokens holds current purpose/hash/expiry pointers, never raw tokens.

Services also receive method, account, entitlements and rate. requireFeature is synchronous-compatible and may be awaited. requireStepUp is asynchronous, session-bound and ten minutes; execution scope includes broker scope and security covers both. Product snapshot uses post-auth integration readiness so planIncluded is accurate. Public broker callback is the only cross-site GET exception and redirects to a validated locale terminal path after cryptographic state validation.
