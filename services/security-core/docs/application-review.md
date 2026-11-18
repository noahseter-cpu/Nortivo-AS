# Nortivo application security review

**Retained baseline:** this review records the earlier source snapshot. The subsequent unpublished integration addresses its admin/session/rate/transport findings locally. Read [current integration status](integration-status.md) and the current evidence alongside the historical line references below. This baseline is not a claim that old behavior remains in the updated local endpoints.

Reviewed 18 November 2026. This is a source review of local checkout snapshots, with two synthetic local reproductions. It is not a live penetration test or confirmation of production configuration. KORVNT did not change existing application files, secrets, accounts, deployed settings or database records. Existing and concurrent unrelated workspace changes, including an admin dashboard update, were left untouched. The changed `admin-tickets.mjs` was re-read and its affected references below were refreshed; all five substantive findings still apply to that snapshot. No nested `AGENTS.md` was found in the reviewed directories.

## Scope and evidence

Reviewed the support/admin Functions, shared request and token helpers, product authentication, MFA, request dispatch, storage adapters, billing/webhook paths, and the three Supabase SQL migrations. Runtime dependencies are pinned in the root lockfile: `otpauth`, its `@noble/hashes` dependency, and `stripe`. Package presence and pinning do not establish freedom from vulnerabilities; a current advisory check and normal update process remain necessary.

Findings below describe checked-in code. Whether the same code, migrations, feature flags, infrastructure protections or external identity gates are active in production is unknown. This review did not inspect `.env.local`, secret values, provider accounts, actual database policies or hosting logs.

## Priority findings

| ID | Priority | Verified condition and impact | Source | Recommended action |
| --- | --- | --- | --- | --- |
| APP-01 | High hardening priority | Admin/support throttles use a process-local `Map`. Ten login attempts are limited within one module instance, but another instance starts with an empty counter. Serverless scaling and cold starts therefore prevent this from being a dependable account-wide brute-force or mail-abuse limit. | `netlify/functions/_ticket-security.mjs:6`, `:57`; `admin-login.mjs:9`; `tickets.mjs:34`; `ticket-access.mjs:19` | Use an atomic shared store and independent account/IP limits for admin login and support email operations. Keep edge-level abuse limits as another layer. Fail closed if the required limiter is unavailable. |
| APP-02 | High hardening priority | Admin sessions contain only an expiration time signed with the shared secret. There is no server session ID, actor identity, revocation lookup or authentication epoch. Logout deletes the browser cookie, while a copied valid cookie remains accepted for the remainder of its eight-hour lifetime. Rotating the shared signing secret invalidates all admin/support-derived tokens rather than one session. | `netlify/functions/_utils.mjs:85-104`; `admin-logout.mjs:4-9` | Adopt opaque random admin sessions stored as hashes, named administrators, expiration, and server-side revocation. Revoke the specific session on logout, and all sessions on security-relevant identity changes. |
| APP-03 | High hardening priority | The administrative entry point accepts one shared environment password and issues an admin session immediately after comparison. Product TOTP and step-up logic are separate and are not invoked by this handler. A stolen admin password therefore suffices at the application layer to access support conversations and private admin content. Any additional external identity gate has not been verified. | `netlify/functions/admin-login.mjs:14-17`; `_utils.mjs:107-112`; `admin-projects.mjs:7`; `admin-tickets.mjs:9` | Require individually attributable admin identities with MFA and recent step-up for sensitive operations. Use an established identity provider or carefully integrate the existing maintained MFA implementation. |
| APP-04 | Medium | Support database and email `fetch` calls have no explicit timeout or redirect policy. Public ticket operations can hold function execution while an upstream stalls. This also makes error recovery and mail-abuse cost control less predictable. The product storage adapter already has a ten-second timeout and rejects redirects. | `netlify/functions/_utils.mjs:47-56`, `:67-72`; compare `netlify/terminal/store.mjs:16-20` | Add bounded request/body handling and `redirect: 'error'`; validate the database origin as the product store does. Make delivery retries idempotent and bounded. |
| APP-05 | Medium | Admin login/logout, ticket status changes, and replies do not produce structured security audit events or carry an individual actor ID. Ticket replies retain only the shared `admin` sender, and the status update overwrites current state. This limits investigation and attribution. Hosting-level logs may exist but were not inspected. | `admin-login.mjs:14-20`; `admin-logout.mjs:7-9`; `admin-tickets.mjs:47-58`; `reply-ticket.mjs:26-41`; `supabase/schema.sql:21` | Add minimal structured events for authentication, revocation, denied admin access and ticket mutations. Store actor, operation, request ID, result and timestamp; exclude passwords, raw cookies, tokens, ticket bodies and email content. Route alerts to a tested operational destination. |

These are verified design gaps, not evidence that a compromise has occurred. Priority reflects impact if the admin surface is reachable without additional infrastructure controls.

## Local reproduction evidence

Two assertions ran successfully using Node and synthetic process-only configuration:

1. Issued a synthetic admin cookie with `createAdminSession`, invoked the local logout handler, and passed the original cookie to `isAdmin` again. Logout returned 200 and the copied cookie still passed validation.
2. Imported `_ticket-security.mjs` as two independent module instances. The first instance rejected the second request after a one-request limit; the second instance accepted the same identifier immediately. This verifies instance-local state; it does not attempt to force production scaling.

No raw cookie or secret was printed. These checks use only local functions and make no network requests. They document the baseline behavior and are not KORVNT release tests.

## Existing protections worth preserving

| Area | Verified in source | Limit of verification |
| --- | --- | --- |
| Product password storage | Salted Node `scrypt` with N=32768, r=8, p=1 and constant-time digest comparison; input length bounds. `netlify/terminal/auth.mjs:6-25`. | Existing production password records and operational password policy were not inspected. |
| Product session handling | Cryptographically random 32-byte session tokens, SHA-256 hashes in storage, HttpOnly/Secure/SameSite cookies, database expiry and logout deletion. `netlify/terminal/security.mjs:15`, `:31-37`; `netlify/product/service.mjs:40`, `:45`; `netlify/terminal/store.mjs:43-54`. | Browser and production cookie behavior were not tested here. |
| CSRF and request boundaries | Same-origin checks before dispatch and a session-bound CSRF token for authenticated product POSTs; support/admin mutation origin checks. `netlify/product/service.mjs:21`, `:33`; `netlify/terminal/security.mjs:56-71`. | Origin checks complement authentication and are not authentication for non-browser clients. |
| Product throttling | Database-backed rate consumption, per-connection request/auth limits and per-user limits. `netlify/product/service.mjs:23-24`, `:41`, `:44`; `netlify/terminal/store.mjs:63-66`. | Distributed source attacks still require account-level and edge protections. Applied SQL and hosting rules are unknown. |
| MFA | Maintained `otpauth` TOTP, AES-256-GCM sealing bound to the account, replay counter, hashed one-use recovery codes and transaction version checks. `netlify/product/mfa.mjs`. | It is optional for normal users, and does not protect the separate support/admin login. Key custody and recovery operations require operational review. |
| Email recovery | Random tokens stored as hashes with purpose/expiry, transactional consumption, generic account-existence responses and session revocation after password change. `netlify/product/auth.mjs:21-25`, `:48-65`; `supabase/product.sql:77-87`. | Email-provider and mailbox security remain external dependencies. |
| Support privacy | Creating a ticket does not grant conversation access. Reads require a ticket/email-bound encrypted proof cookie. Email proof requests give the same public result for missing tickets and delivery failures. `tickets.mjs:64-84`; `ticket-access.mjs:15-46`; `_ticket-security.mjs:98-155`. | Support proof tokens are reusable within their validity and have no per-token revocation store. Avoid promising one-use proof links. |
| SQL access | Product/terminal tables enable and force RLS; anon/authenticated grants are explicitly revoked; RPC access is service-role only. Product transactions enforce existing record owners, expected versions and quotas. Support tables enable RLS and define no public policies. `supabase/product.sql:13-16`, `:37-69`, `:102-105`; `supabase/terminal.sql:49-64`, `:147-152`; `supabase/schema.sql:28-32`. | Server-side service-role access can see all customers, so every handler must enforce ownership. Production policy drift and migration state were not checked. |
| Billing | Raw signed Stripe webhook verification with a bounded body and timestamp tolerance; canonical subscription retrieval, customer/owner/mode checks, idempotent operations and event processing. `netlify/functions/stripe-webhook.mjs:6-9`; `netlify/product/billing.mjs`. | Provider configuration, current SDK advisories, webhook delivery and merchant settings were not inspected. |
| Private content | Signed admin check before private content access, constrained private path resolution and explicit response CSP/cache headers. `netlify/functions/admin-vibb.mjs`. | Its access boundary inherits APP-02 and APP-03. |

## Data flow and trust boundaries

| Data | Movement and boundary | Main responsibility |
| --- | --- | --- |
| Support name/email/message/replies | Browser to support Function to Supabase; submitted content and confirmations also pass through Resend and the configured admin mailbox. | Nortivo enforces proof/authorization and content handling. Providers secure hosted storage/transport and mailbox delivery. |
| Product password | Browser over the hosting TLS endpoint to Function; scrypt digest to `terminal_users`. | Nortivo password/session implementation; hosting TLS; database service access. |
| Product session/recovery token | Raw token in browser cookie or email fragment; only hashes in server storage for product sessions/recovery. | Nortivo creates, validates, expires and revokes tokens. User devices/mailboxes hold bearer secrets. |
| Support/admin cookies | Browser sends bearer cookies to Functions; support proof is encrypted/signed, admin proof is signed and stateless. | Nortivo cookie and signing implementation; APP-02 identifies admin revocation gap. |
| MFA secret/recovery codes | Enrollment returns secret/codes once to the signed-in user; sealed TOTP secret and code hashes in product storage. | Nortivo implementation and key custody; user authenticator and recovery-code handling. |
| Account, portfolio and entitlement records | Authenticated Function to service-role Supabase RPC/store adapter. | Nortivo binds all requests to verified user ownership and paid entitlements. Database RLS prevents direct public access, not misuse of the service-role key. |
| Payment details and billing events | Browser to Stripe-hosted checkout/portal; Stripe to signed webhook; Nortivo stores identifiers, plan/status/coverage and receipts. | Stripe payment processing; Nortivo signature/ownership checks and entitlement reconciliation. |
| Upstream credentials | Hosting environment to server-side database/email/billing requests; some encryption roots protect stored MFA/access data. | Nortivo deploy access and rotation; provider secret storage and privileges. No live values reviewed. |

## Endpoint and permission map

| Surface | Intended caller and checks |
| --- | --- |
| `admin-login` / `admin-logout` | POST from configured same origin; shared password on login, local-memory throttle, signed cookie issuance; browser cookie deletion on logout. |
| `admin-tickets` | Admin cookie before GET paginated list/detail/configuration-only operations view or PATCH status; origin validation; bounded offset and permitted status allowlist. |
| `reply-ticket` | Admin cookie, POST, same origin and bounded body before lookup/email/write. |
| `admin-projects`, `admin-vibb` | Admin cookie before private bytes; same origin; constrained methods/paths for the private app. |
| `tickets` | POST with origin, field/body checks and local throttling; GET requires proof cookie matched to ticket and email. |
| `ticket-access` | POST origin/validation and local throttles; generic email-proof request result; verified proof exchanges for a support cookie. |
| `terminal` with product enabled | Action/method allowlists, same-origin policy, persistent rate limits, authentication, CSRF for signed-in POSTs, account/entitlement/ownership checks and specific step-up scopes. Public actions include registration/login/recovery, plan catalog and guest entry. |
| `stripe-webhook` | No browser cookie required; feature flag, POST, bounded raw body and Stripe signature authenticate the webhook. |

## Integration and release implications

KORVNT should start as a separate reusable control library and local reference application. It does not silently replace the existing auth or grant protection to the live site. Integrating it requires reviewing every entry point, defining a single trusted identity/session adapter, selecting a shared atomic rate-limit store, and verifying resulting production response headers.

Priority integration order: shared administrative throttling; named MFA-protected administrators and revocable sessions; bounded support upstream requests; attributable minimal security events; alert delivery and incident/recovery exercises. Preserve the existing product owner checks, CSRF, persistent session revocation, transaction versioning, step-up protections and Stripe verification.

Production configuration, backup restoration, notification delivery, key rotation, dependency advisories and vulnerability-reporting ownership remain separate release evidence. Source review alone cannot mark these complete or justify the public “Secured by KORVNT” badge.

## Worker, outbound requests and private build follow-up

Additional source inspection covered `netlify/product/worker.mjs`, `scripts/run-product-worker.mjs`, `render-worker.yaml`, the broker OAuth/client code, provider transport/call sites, AI request transport, locale builds and private content packaging/loading.

| Boundary | Verified behavior | Remaining release work |
| --- | --- | --- |
| Persistent worker | `scripts/run-product-worker.mjs:4` requires explicit enablement and database credentials. It starts a background loop and defines no HTTP listener. `render-worker.yaml` describes a worker, disables auto deploy and defaults `PRODUCT_ENABLED` to `false`. Errors are restricted to safe error-code/UUID metadata. | Manifest defaults do not prove hosted settings. Verify service identity, actual enabled state, runtime updates, secret scope and operator access. The worker still uses a powerful service-role database credential. |
| Worker authority | `netlify/product/worker.mjs:10-12` acquires per-account leases, reloads entitlements and explicitly refuses to grant step-up. Stored automation consent, strategy binding, release gates and execution reconciliation remain essential authority boundaries. | Review actual broker/strategy state and execution evidence before enabling a worker. The KORVNT preview must not start trading execution. This review did not prove the whole execution state machine. |
| Broker OAuth | `netlify/product/broker.mjs:16-24`, `:60-75`, `:101-109`, `:126` revalidate the originating account session, require step-up to initiate, use random state stored as a hash, bind a separate HttpOnly browser nonce, limit validity and transactionally consume state before exchange. | Provider app configuration, actual consent and redirect registration need separate checks. |
| Broker secret custody | `netlify/product/broker.mjs:37-45`, `:123-131` encrypt token data using AES-256-GCM with owner/connection/mode as authenticated associated data. Public connection output omits token material. | Key rotation/re-encryption and recovery require procedures and exercises; ciphertext does not protect against compromise of the running server and key together. |
| Outbound host selection | Reviewed broker, Twelve Data, Finnhub, Trading Economics and OpenAI call sites construct fixed provider hosts. Broker/provider/AI calls reject redirects and have request timeouts. `netlify/product/broker.mjs:91`; `providers-data.mjs:74`, `:114`, `:121`; `providers-core.mjs:82`; `ai.mjs:100`. The terminal database adapter validates an HTTPS origin. | No user-controlled arbitrary-target SSRF was identified in these reviewed call sites. This is a bounded source conclusion, not proof that all code/services are SSRF-free. Restrict future adapters to explicit provider origins. Support fetch gaps remain APP-04. |
| Private source publication | `netlify.toml:3` publishes `dist`, while Functions/private source live outside it. `.gitignore` excludes plaintext private inputs and environment/local-runtime files. No `.env`, private key, `projects.mjs`, `vibb-runtime.mjs` or `encrypted-content.mjs` filenames were found beneath the current `dist` tree. Locale builders write public templates/assets and do not interpolate environment credentials. | Filename inspection is not a complete content secret scan. Require a publish allowlist/secret scan in the release pipeline and inspect the final deployed artifact. |
| Encrypted private build | `scripts/package-private-workspace.mjs:10-17` packages private content into AES-GCM ciphertext; `netlify/private/content-loader.mjs:27-44` validates the key and imports authenticated source only in server memory. It executes trusted build-time code. | The regex-based standalone-module check is not a JavaScript sandbox. Keep private runtime authors/build inputs trusted and reviewed; never feed third-party or user-uploaded JavaScript into this path. |

### Session-adapter compatibility is pending

`netlify/terminal/store.mjs:43-54` validates session-hash existence/expiry and returns a joined user with `session_expires_at`. It does not return session creation time, recent authentication time, an administrative role or MFA assurance. The product's separate capability check uses `PRODUCT_ADMIN_USER_IDS`, and recent MFA scopes come from `mfa_sessions`.

A KORVNT verifier that requires verified identity, explicit roles, issuance/expiry and recent MFA must receive these from a trusted server-side adapter. The existing store response is not directly compatible with that stronger contract. Do not fill missing assurance fields with guesses or client claims. Adapter implementation and end-to-end authorization tests remain part of the integration migration.
