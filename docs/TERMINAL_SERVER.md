# Trading workspace server and setup

The trading workspace is separate from the existing support/admin login and from Nortivo's published report. Its paper accounts start with **virtual USD 100,000**. USD prices, balances and fees use integer cents; the existing NOK report never initializes an account. The server owns the fixture, replay cursor, rules, risk checks and ledger. A browser cannot upload replacement account state or choose another account's identity.

## Run the complete local application

Use **Node.js 24 or newer** for the terminal's built-in SQLite store. The earlier static preview remains available on Node 20 and deliberately leaves all functions disconnected.

From the repository directory:

```powershell
node scripts/build-locales.mjs
node --test tests/terminal-engine.test.mjs tests/terminal-server.test.mjs
node scripts/serve-terminal.mjs --port 4420
```

Open `http://127.0.0.1:4420/en/terminal/` or `/nb/terminal/`. Use that exact loopback host for the session's same-origin checks. Choose a guest sandbox, or create a local test account with an address ending in `.test`. No email is sent. This local server serves the existing static pages with the production Content Security Policy and implements only the new terminal function. Existing support/admin functions still return the static preview's honest 503 response.

The local server does not load `.env` or call production Supabase, support, email, market-data or brokerage services. It creates these ignored files:

- `.local/terminal/terminal.sqlite` and SQLite's WAL/SHM companions: local identities, scrypt password hashes, hashed sessions, paper states, command receipts and rate limits.
- `.local/terminal/session-secret`: a generated local security key. It is never printed or returned to the browser.

Keep this directory private. The database is not an encrypted personal vault. Stop the server before copying it for a local backup; copy the database and security key together. The application never resets it to resolve an error. There is no local database fallback in the Netlify function.

## Hosted configuration

The additive migration was applied to the existing project during the authorized 17 November 2026 release work. See TRADING_PLATFORM_RELEASE.md for observed hosted results. No provider purchase or external brokerage account creation is part of this release. The following is the reproducible deployment procedure.

1. Open the **existing** Supabase project's SQL editor. Review and execute the complete additive migration in `supabase/terminal.sql`. It records schema versions 1 and 2, creates terminal-specific users, sessions, states, receipts and rate-limit tables, and adds/backfills a receipt counter without removing any records. It does not modify existing support/admin tables or Supabase Auth users. The migration is transactional and safe to rerun; subsequent schema changes require a new versioned migration. Version 2 replaces the terminal rate-limit RPC's boolean result with its actual remaining-wait result. Update the function and migration together; old storage contracts fail closed.
2. Retain the existing server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values. Do not expose them in HTML, client JavaScript, a public Netlify variable or a committed file. The service role is required; an anonymous/public key cannot access these tables or procedures.
3. Create a **separate** random `TERMINAL_SESSION_SECRET`, at least 32 bytes, using a password manager. Add it to Netlify's protected function environment. Do not reuse the support/admin secret. Set `TERMINAL_ORIGIN=https://nortivo.no` for Production. In the Deploy Previews context, set `TERMINAL_ORIGIN` to the exact owner-approved preview URL before building that preview. Netlify `URL`, `DEPLOY_PRIME_URL` and `DEPLOY_URL` contribute additional approved origins when present, but build-time variables are not guaranteed to be available to Functions at runtime. The first hosted test correctly rejected a missing preview origin; context-specific configuration fixed it without broadening the origin checks. Do not set `TERMINAL_LOCAL` on Netlify. Leave `TERMINAL_ALLOW_SIGNUP=false` until the owner explicitly permits public account creation; only the exact value `true` enables hosted signup. Guests and existing-account login remain available independently. The local runner explicitly permits local test signup.
4. Build with the existing `node scripts/build-locales.mjs` command and publish through the existing Netlify project only after approval. Static imports bundle the engine and server adapters; the local SQLite adapter is not imported by the hosted function. No rewrite of support/admin authentication is necessary.
5. In an authorized preview, repeat signup/login/logout, two-account isolation, refresh, duplicate-command retry and export checks against the actual service. Verify that unauthenticated Supabase REST requests cannot read terminal tables or execute the three RPCs. Local tests do not prove a hosted migration or service-role configuration has been applied.

The function fails with `STORAGE_NOT_CONFIGURED` or `STORAGE_UNAVAILABLE` if hosted storage is missing; it never initializes a temporary filesystem account or invents saved success.

## Authentication, limits and retention

Passwords require 12 or more characters and at most 256 UTF-8 bytes. They are stored with a random 16-byte salt and scrypt N=32768, r=8, p=1, 64-byte output. Signup/login is independent of support/admin and does not claim email verification, identity verification, email delivery or password recovery. Account emails are visible only within their authenticated workspace. Hosted signup defaults to disabled; signup conflicts use a generic account-creation error. `capabilities.signupEnabled` exposes the actual server gate in session/integration responses, and `emailVerification:false` makes the missing verification explicit.

Sessions use 32 random bytes in a host-only HttpOnly cookie scoped to `/.netlify/functions/terminal`, `SameSite=Strict` and `Secure` on hosted HTTPS. Only SHA-256 session hashes are stored. Account sessions expire in seven days. Guest sessions expire in one day; guest identities and records expire seven days after creation and are removed on subsequent requests. Guest records do not transfer into a signed-in account. Persistent account records and their financial receipts are retained until an explicit, separately implemented deletion policy is applied.

All POSTs require a verified same-origin Origin/Referer. Authenticated mutations also require an `X-CSRF-Token` derived from that session and the separate server secret. Signup/login rotates the caller's cookie session. Logout deletes its server-side record. Private GETs require the same session and reject cross-site fetch contexts. Responses use private no-store caching. Errors exclude provider bodies, SQL details, stack traces and credentials.

Limits persist in SQLite/Supabase across process restarts: 600 requests per connection identifier per five minutes; 24 authentication attempts per 15 minutes per connection and eight per email/connection pair; 12 new guest attempts per connection per day; 1,200 private requests per user per five minutes; **90 new unique commands per user per minute**; 30 provider requests per user per minute and 90 globally. Existing idempotency receipts bypass the new-command limiter. Authentication limits run before scrypt; there is no email-wide login bucket that a different connection can exhaust. `Retry-After` is the ceiling of the blocked bucket's remaining window in seconds, not a fixed placeholder.

Only Netlify's connection-IP header (or the local socket address) is used. IPs and email/connection limit keys are hashed; raw IPs, credentials and article bodies are not audit events. Rate-limit allocation is capped at 10,000 active buckets and fails closed at capacity. Existing Supabase buckets use atomic per-key updates. Only a missing key's allocation, capacity check and expiry cleanup acquire the global allocation lock; a recheck/upsert handles races after waiting.

## HTTP contract

Every route is the same-origin `/.netlify/functions/terminal?action=...`. Bodies are bounded JSON objects (24,000 bytes). Session cookies are never returned as JSON. No private endpoint accepts a client-selected owner ID.

| Action | Method | Input and response |
| --- | --- | --- |
| `session` | GET | `{user,csrfToken,state,revision,integrations,capabilities,storage}`; 401 without a valid session. |
| `guest` | POST | `{}` creates a separate sandbox/session; an existing valid session is retained. Returns session shape. |
| `signup` / `login` | POST | `{email,password,name?}`. Returns session shape; hosted signup requires the explicit owner gate. Verification/recovery is unavailable. |
| `logout` | POST | `{}` and CSRF header. Revokes session; returns `{ok:true}`. |
| `command` | POST | `{requestId,command}` and CSRF header. Returns `{state,result,revision,duplicate}` after committed storage. |
| `integrations` | GET | `{integrations,capabilities}` with configured/unavailable status and actual signup gate. Configuration is not proof of a successful feed request. |
| `market` | GET | `mode=sample&symbol=NVDA` returns current account replay bars/quote; `mode=provider&symbol=NVDA&resolution=5` explicitly requests the configured research feed. |
| `news` | GET | `mode=sample` returns only already-published fictional replay items. `mode=provider&symbol=NVDA` requests company news; omit symbol and optionally set `category=general|forex|crypto|merger` for category news. |
| `calendar` | GET | `mode=sample` returns fictional replay events; `mode=provider` requests the configured upcoming calendar. |
| `export` | GET | Session-authorized CSV of this workspace's executed fills, quantities, integer prices, gross value, fees and realized P&L on sells. No fills produces a header-only CSV. |
| `broker` | POST | Always returns `BROKER_NOT_CONFIGURED`. No brokerage request exists. |

Without `mode`, data endpoints return integration status and `modeRequired:true`; they never implicitly switch sources. Errors use `{error:{code,message}}` and an appropriate status. Unknown commands, missing confirmation, stale/conflicting state, insufficient funds and breached limits are validated by the server/engine. Risk-rejected orders are persisted records with their rejection reason and risk checks; they are not successful fills.

`requestId` must be stable for retries and contain 8–128 letters, digits, `_`, `.`, `:` or `-`. Reusing it for another command returns 409. The server keeps **permanent per-user command receipts**, even after the engine's short in-state receipt log is trimmed. A transaction commits the new state revision and receipt together. Revision compare-and-set plus retry prevents lost updates across tabs or function instances. If a response is lost, retry the same ID; do not generate a replacement ID. Snapshots are always rebuilt from committed state. The hosted RPC locks the owner row and returns an existing receipt before testing the revision.

The same transaction enforces a lifetime bound of **2,000 unique commands per guest** and **10,000 per signed-in account**, with the role read from stored identity rather than a client claim. The durable `receipt_count` is backfilled from prior receipts during the additive migration. At capacity, new commands return `WORKSPACE_COMMAND_LIMIT`; prior receipts, snapshots, CSV export, login and logout remain available. No old receipt or ledger entry is evicted to make room. Session `storage` exposes `commandsUsed`, `commandLimit` and `commandsRemaining`. Accounts already above a new bound retain all their records and cannot add more commands. The local SQLite migration upgrades version 1 to 2 without a reset.

## Optional Finnhub research adapters

No provider is connected, purchased or tested with real credentials. The functional replay does not require one. The adapter boundary was checked on **17 November 2026** against Finnhub's [official API documentation](https://finnhub.io/docs/api), [official OpenAPI schema](https://github.com/Finnhub-Stock-API/finnhub-go/blob/master/api/openapi.yaml) and [terms](https://finnhub.io/terms-of-service). The schema declares API version 1.0.0. Runtime requests use `/api/v1`.

Finnhub's terms require written approval for redistribution and business use; a personal subscription does not establish those rights. Subscription, exchange entitlement, public display and attribution requirements must be confirmed with Finnhub for the actual application. The adapter requires **all three** of:

- A protected `FINNHUB_API_KEY`.
- `TERMINAL_FINNHUB_COMMERCIAL_DISPLAY=true`, set only after written permission is established.
- `TERMINAL_FINNHUB_CAPABILITIES=market,news,calendar`, listing only capabilities actually permitted by the agreement. Leave unavailable capabilities out.

Set `TERMINAL_FINNHUB_DELAY_MINUTES` only to the delay actually covered by that agreement. A blank value reports timing as unverified. Configuration status means owner configuration is present, not that entitlements or live connectivity were independently verified. Do not mark the platform live from this flag.

The market adapter currently accepts US-company USD stocks, with source/profile checks and resolutions `1,5,15,30,60,D`. Finnhub daily bars are split adjusted; intraday bars remain unadjusted. Data is labeled accordingly, with timestamps, currency, timezone, a stale-quote flag and actual cache retrieval times. It sorts and deduplicates bars, rejects conflicting or invalid records, and never fills missing intervals. Prices are rounded to display cents and are **research-only**; they cannot enter the replay ledger. A provider market closure may legitimately leave an old quote; the adapter still flags its age rather than implying a recent trade.

Responses are cached for 60 seconds for market data, five minutes for news/calendar and one day for instrument profile metadata. Memory cache capacity is bounded at 200 entries; it is disposable provider cache, separate from user records. There is no stale-cache success fallback after provider failure. API authentication uses a server header, not a credential in a returned URL. Timeouts, response-size limits, fixed provider paths and safe errors apply.

News keeps source, publication time, original HTTPS URL and plain text excerpts; it removes duplicates by URL and source/headline/date. It does not fetch full articles or execute external instructions. Summaries are explicitly provider excerpts, with `machineGenerated:false`. No sentiment score, causal claim or AI confidence is invented. Calendar forecast, previous and actual values are retained only when the provider supplies finite values; zero is preserved. A provider time without an explicit offset remains unzoned with `time:null` and `sourceTime` retained, rather than assigning a guessed timezone. AI summaries are unavailable. The broker adapter rejects connection and submission unconditionally; no environment flag enables real execution.

## Verified scope

`tests/terminal-server.test.mjs` uses local `.test` accounts and mocked provider replies. Its 19 tests cover guest readiness; account isolation; hosted signup gates/capabilities; valid login after eight remote failures; forged CSRF/origin; session revocation; concurrent idempotent submission and CAS updates; durable receipts beyond the engine window; atomic receipt quotas and old retries at capacity; lower new-command rates; paper confirmation/funds/risk rejection; restart persistence; scrypt/hashed sessions; persisted per-key limits and accurate retry timing; guest expiry; safe errors/body limits; unavailable and failing providers; stale quotes; news/calendar normalization; and actual local HTTP/static/CSP behavior. The engine's independent tests cover its financial, indicator and replay invariants. Neither suite establishes hosted Supabase migration success, paid entitlements, actual provider connectivity, email delivery, brokerage readiness or a production release.
