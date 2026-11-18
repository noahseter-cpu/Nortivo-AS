# Provider, AI and worker setup

Implementation is reviewable locally; current production services remain unverified without the owner's credentials, contracts and successful authenticated checks. Do not paste secrets into source, screenshots, fixtures or chat. Use the hosting provider's protected environment settings. Placeholder names are in `product-providers.env.example`.

## Configuration and first real checks

1. The reviewed additive `supabase/product.sql` migration was applied to the existing production Supabase project on 18 November 2026 (schema version 3, original records preserved). Do not reset or recreate those records as setup. Both Netlify and the separate worker must use that same Supabase project/product store; an isolated worker SQLite file cannot coordinate production orders.
2. Record actual approved permissions for each selected capability. Example shape below is deliberately **not valid release evidence**; replace every field from the signed provider agreement and confirm expiry/retention/exchange/AI conditions. Missing or malformed evidence disables that adapter.
3. Configure server-only provider credentials, the owner-selected OpenAI project key/model and `PRODUCT_ADMIN_USER_IDS` with the actual existing user UUID. Set OpenAI project budgets/alerts. Keep `PRODUCT_LIVE_TRANSMISSION_ENABLED=false`.
4. Sign in as the existing owner, verify email and enroll/confirm MFA. `POST product-health-probe` accepts `{requestId,services:["market","strategy","news","calendar","ai"],instrumentId:"XNAS:AAPL:USD"}`. This performs real paid/metered requests only when configured and rights are valid. Strategy readiness requires verified licensed daily history of at least 52 bars; a successful symbol search alone does not verify current quotes. No paid customer subscription is required or invented. AI uses the operator's bounded 200-request/2.2M-token monthly verification allowance.
5. After genuine Alpaca paper commercial approval and OAuth app configuration, call the same probe with `services:["broker_oauth_paper"]` and follow the returned authorization URL. MFA is required. Use an approved paper account. Then probe `services:["broker"],connectionId:<owned id>` to synchronize read-only account/positions/orders. This probe never sends an order.
6. Start the persistent worker only after its separate host and secrets are authorized. Verify a fresh heartbeat **and completed healthy cycle** in `GET product-health`; a configuration flag alone does not establish readiness. Exercise paper orders/restart/reconciliation using authorized sandbox accounts before a live release.

After the independently signed live release exists, the owner-only `broker_oauth_live` probe can authorize an eligible owner live account for read-only verification without buying a Nortivo subscription. Its release and MFA gates remain mandatory. A subsequent owned broker sync must successfully verify the live environment before brokerage is purchasable. No probe transmits an order. Reconnecting a previously linked account reuses its binding so outstanding intents can reconcile, and leaves automation off until deliberately authorized again.

```json
{
  "market": {
    "provider": "twelve",
    "documentRef": "REPLACE_WITH_APPROVED_CONTRACT_REFERENCE",
    "validUntil": "REPLACE_WITH_ACTUAL_EXPIRY_ISO",
    "externalDisplay": false,
    "markets": ["US"],
    "nonDisplay": false,
    "aiProcessing": false,
    "cacheSeconds": 0,
    "delayMinutes": null,
    "coverage": "REPLACE_WITH_PRECISE_VENUES_AND_SUBSET_OR_CONSOLIDATED_DESCRIPTION"
  },
  "news": { "provider": "finnhub", "documentRef": "REPLACE", "validUntil": "REPLACE", "externalDisplay": false, "markets": ["US"], "nonDisplay": false, "aiProcessing": false, "cacheSeconds": 0 },
  "calendar": { "provider": "tradingeconomics", "documentRef": "REPLACE", "validUntil": "REPLACE", "externalDisplay": false, "markets": ["global"], "nonDisplay": false, "aiProcessing": false, "cacheSeconds": 0 },
  "fx": { "provider": "twelve", "documentRef": "REPLACE", "validUntil": "REPLACE", "externalDisplay": false, "markets": ["FX"], "nonDisplay": false, "aiProcessing": false, "cacheSeconds": 0 }
}
```

Raw excerpts need `PRODUCT_NEWS_EXCERPTS_APPROVED=true` **and** an actual provider permission covering them. No article imagery/full-body mirroring is implemented. Calendar reminders are explicitly in-app; there is no claim of email/push delivery while the app is closed.

## Exact API surface

Use `/.netlify/functions/terminal?action=...` with the existing authenticated cookie and CSRF header for POST. Owner IDs, broker tokens and arbitrary store namespaces are never accepted as client-controlled authority.

| Action | Method | Request / result |
| --- | --- | --- |
| product-catalog | GET | `q`; returns disambiguated `instruments` with stable venue/currency IDs |
| product-quotes | GET | `instrumentId`, optional `resolution`; returns dated decimal `quote`, `bars`, coverage/source/freshness |
| product-news / product-calendar | GET | Optional news `symbol`; returns attributed `items` or real `events` |
| product-watchlist | GET / POST | GET retained after expiry; POST `{requestId,type:"add"|"remove",instrumentId}`; at most 100 IDs |
| product-reminders | GET / POST | `{requestId,type:"add"|"remove",eventId,leadMinutes?:0|5|15|60}`; add resolves the actual licensed event server-side; remove survives expiry; only an open app delivers reminders |
| product-ai / product-ai-usage | POST / GET | `{requestId,question,kind:"basic"|"advanced",portfolioId?,instrumentId?,newsId?,eventId?}`; sourced explanation/remaining allowance |
| product-broker-status / product-broker-orders | GET | Owned public connections/intents; no access-token material |
| product-broker-connect | POST | `{requestId,mode:"paper"|"live"}`; approved OAuth URL and required MFA |
| product-broker-callback | GET | Public return verifies the initiating browser nonce and still-active original Nortivo session before consuming one-use state; successful connection or provider cancellation returns a clearing 303 to the validated local route |
| product-broker-sync | POST | Owned `connectionId`; broker positions and open orders authoritative |
| product-broker-consent | POST | `{requestId,connectionId,risk,automationEnabled,strategyId?}`; risk has decimal `maxOrderNotional,maxPositionNotional,maxDailyLoss`, integer `maxOrdersPerDay`; automation needs an enabled bound strategy; live additionally `liveConsentConfirmed:true` |
| product-broker-order | POST | `{requestId,connectionId,instrumentId,side,quantity,type,timeInForce:"day",confirmed:true,limitPrice?,reduceOnly?}`; returns durable pending intent; worker/broker acceptance determines outcome |
| product-broker-cancel / stop / disconnect | POST | Owned intent/connection plus requestId; retained after subscription loss; protected cancellation needs explicit confirmation |
| product-strategy | GET / POST | Saved versioned daily SMA crossover; `{requestId,strategyId?,strategy:{name,instrumentId,fast,slow,quantity,connectionId,mode,enabled}}`; disabled research-only strategy may have empty connection ID |
| product-backtest / product-scan | POST | Owned strategy or validated strategy plus optional costs; bounded 1–8-instrument 20/50 SMA scan; licensed non-display history required |
| product-health / product-health-probe | GET / POST | Owner UUID allowlist only; credential-free diagnostics / bounded real checks |

Supported order types here are whole-share common-stock/ETF market or limit day orders during a verified regular session; no shorts, leverage controls, funds transfers, options, crypto or unsupported venues. Existing protective broker orders are read/reconciled and never silently removed by stop, downgrade or disconnect. If broker access fails, direct management is `https://app.alpaca.markets/`.

OAuth uses an independent host-only `__Host-nortivo_broker_oauth` cookie for ten minutes with `Path=/`, HttpOnly, Secure and SameSite=Lax. Only the standalone local runtime uses the separate non-Secure `nortivo_broker_oauth_local` name. The main Nortivo session cookie stays SameSite=Strict. The callback compares the browser nonce hash in constant time, rechecks the original persisted session/account entitlement, and sends no provider code/state in HTML. Owner setup probes store a trusted server bootstrap marker and recheck the current administrator allowlist. Success and verified `access_denied` cancellation consume the state, clear the nonce cookie, and redirect with `Referrer-Policy:no-referrer`. One pending OAuth browser flow is supported at a time.

## Live release evidence

The live adapter is implemented at the official live host but unavailable by default. Changing a flag is insufficient. `broker-release.mjs` verifies Ed25519 signatures against `PRODUCT_BROKER_APPROVAL_PUBLIC_KEY`, bound to the deployed build, client ID and a maximum 30-day evidence age. Keep the signing private key outside the app/runtime. There is no web endpoint to mint approvals.

An independently reviewed launch process must persist `jobs/broker_live_release`, owned by the system UUID `00000000-0000-4000-8000-000000000001`, with:

```text
type=broker_live_release; appClientId; buildId;
commercialApprovalReference; brokerApprovalReference; securityReviewReference;
sandboxEvidenceReference; countries:[approved ISO country codes];
automationApproved:true; verifiedAt; expiresAt; signature(base64)
```

Each approved live customer needs `jobs/broker_eligibility:<actual broker accountId>`, owned by their stable Nortivo UUID:

```text
type=broker_account_eligibility; ownerId; accountId; country;
brokerApprovalReference; automationApproved; verifiedAt; expiresAt; signature(base64)
```

Sign the exact UTF-8 JSON bytes from exported `approvalBytes(record)`, which excludes signature and sorts top-level keys. References must point to actual reviewed evidence; test signatures are not release evidence. The runtime verifies account ownership, country, scopes, MFA, separate live consent, selected strategy version, active entitlement, current licensed inputs, broker market/account status, available buying power, position/order/loss/frequency limits and the current account lease before any risk-increasing live POST. Recheck those facts at dispatch, not just when queuing.

Turning the release gate off stops new risk. Viewing, stopping, cancelling, and **server-verified long-position reduction** remain available with authorization, even after subscription expiry. Existing open sell/protective orders reduce the free sell quantity; Nortivo never cancels them to make room. An ambiguous submission is queried by its original stable client order ID. A missing result after an ambiguous outcome becomes manual review and blocks entries; no blind resubmission occurs.

## Persistent deployment, operations and rollback

`render-worker.yaml` defines a separate Node 22 paid background worker in Frankfurt. It is intentionally off by default and does not purchase hosting. Review plan availability/current price in the owner dashboard; the example legacy `starter` name maps to the 512 MB/$7 paid compute. Supply the same approved database, broker encryption key, data credentials, rights manifest and live approval public key/build settings as appropriate. The worker does not need the AI secret. Run `node scripts/run-product-worker.mjs`; no open browser is involved.

Worker cycles every 15 seconds with independent 10-second persisted heartbeat, renewable 45-second account leases and monotonic fencing. Missing data/reconciliation/authorization stops entries; each account is reconciled against actual positions/open orders first. Ordered internal cursor pages include outstanding work even after more than 1,000 historical orders; all permanent history remains stored. Daily signals exclude the forming bar; repeated account/strategy-version/bar IDs deduplicate across crashes. The sample replay engine is independent.

Provider metering uses stable per-provider minute counters, not indefinitely growing keys. The permitted cache uses 256 collision-safe replaceable slots, at most 200 KB each, and the shorter of service TTL/contract TTL. HTTP errors consume attempted upstream units; cache hits do not. Provider errors back off exponentially. No financial receipts/orders/billing history is trimmed for quota space.

Before rollback, stop automation through the product, keep broker protective orders, reconcile outstanding/unknown intents and confirm the direct broker-management route. Suspend new live risk by disabling its release flag, then stop worker entries; do not discard intents/tokens needed for reconciliation without a deliberate disconnect. Roll back application files with the additive schema retained and account data backed up. Restore a compatible worker/API build together. Deleting product records is not a rollback.

## Evidence delivered

`node --test tests/product-integrations.test.mjs` verifies provider rights/freshness/metering/failure paths, concurrent AI quota/idempotency/timeout isolation, encrypted OAuth/state/scopes, signed fixture-only live gates, order lifecycle/out-of-order fills, lease fencing, stale/risk limits, ambiguous timeout/restart, expiry safety, actual worker heartbeats and next-bar backtest simulation. All upstream calls there use **mock HTTP responses**. No real data sandbox, real OpenAI completion, Stripe purchase, broker paper/live order or hosted worker has been certified by these tests. Run the real authorized checks above before recording reachability or enabling paid activation.

## Incident identification
Owner health explicitly scopes unresolved intents to that owner's account. The private persistent-worker log preserves the affected internal owner UUID and a bounded error code for cross-account incident triage. It excludes email, tokens, positions and raw upstream bodies. Review these private logs whenever worker health is degraded; absence from the owner's own intent list is not a system-wide clean bill of health.
