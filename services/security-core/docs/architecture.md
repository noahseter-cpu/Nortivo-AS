# Architecture and integration

## Current local integration

The 0.2 local source now connects Core components to account/trading entry points, authoritative session stores, named MFA administrator access, shared support limits and function headers. The full map is in [integration status](integration-status.md). `netlify/security-core/admin.mjs` reuses current account/password/MFA repositories; `netlify/terminal/security.mjs` bridges existing workspace cookies and lifetimes without changing their wire format. Stores now return actual `session_created_at`. A guarded external script supplies private tutor CSRF without decrypting or repackaging private content. The workflow repository seals new conversation and request records using the existing data vault. Historical rows retain their earlier formats.

The original planning contracts below remain useful design guidance; the old statement that an adapter is wholly unimplemented is superseded by these concrete integration files. Production configuration and deployment are still pending. Named administrator setup must be verified before replacing deployed legacy access.

## Scope and ownership

KORVNT is the customer-facing daughter company. Its technical framework, Nortivo KORVNT, supplies application controls, integration contracts and operating procedures. Nortivo owns its source, brand, route policies, deployment choices, incident handling and maintenance. It uses the existing Netlify/Node/Supabase design rather than introducing an unrelated stack or new cryptographic algorithm.

The hosting provider terminates TLS and supplies the execution environment and network controls. Supabase provides remote persistence and atomic RPC execution. Stripe handles hosted payment processing; Resend handles current email transport. Their presence does not enforce Nortivo's business authorization or prove their production configuration is correct.

## Enforcement path

1. The platform adapter constructs a WHATWG Request and supplies an independently trusted connection identity. Request headers such as `X-Forwarded-For`, user IDs and role claims are not authority.
2. `createSecurityCore().protect` checks the configured origin/method and consumes a connection rate budget.
3. A protected route verifies a canonical opaque cookie against current storage; the database lookup uses its SHA-256 hash. The verifier checks issue/expiry/revocation, identity attributes and maximum session lifetime.
4. Resource ownership is read on the server. The explicit role and owner restrictions are all required; empty policies deny. Admin identities require recent MFA evidence even if the route author omits that flag.
5. Mutations require the exact same Origin, acceptable Fetch Metadata, a session-bound HMAC CSRF header for signed-in routes, and a bounded JSON object matching the route's schema. Public mutations still require exact same-origin JSON and rate protection.
6. The audit sink accepts an allowlisted access-decision event before application actions execute. The handler returns data; the wrapper creates a response with the security headers. Known denials and failures produce generic safe errors and a correlated event when the sink is available.

Authentication, CSRF, TLS and rate limits solve distinct problems. A non-browser client can set Origin; origin checks do not authenticate that client. An XSS bug in an allowed origin can compromise browser actions even with CSRF protection.

## Module contract

| Module | Contract | Security boundary |
| --- | --- | --- |
| `sessions.mjs` | `createSessionVerifier({lookupSession, now, maxSessionMs, timeoutMs})` | `lookupSession(hash, nowMs)` must read current trusted storage on every request and return `{subjectId, createdAt, expiresAt, roles, revokedAt?, mfaVerifiedAt?}`. Default maximum lifetime is eight hours. No browser-supplied roles. |
| `policy.mjs` | `authorize(principal, {roles, ownerId, requireMfa, mfaMaxAgeMs}, nowMs)` | Role allowlist is OR internally; the role and owner requirements are ANDed. Default MFA freshness is five minutes. Load resources under a trusted repository policy; preserve transaction authorization against ownership races. |
| `rate-limit.mjs` | `createRateLimiter({store,key,production,timeoutMs})` | Store must atomically implement `consumeRateLimit(key,limit,windowMs,nowMs)` returning `{allowed,retryAfterMs}` across every instance. Production requires `durable:true`, an explicit integration assertion requiring external evidence. |
| `audit.mjs` | `createAuditLogger({sink,key,timeoutMs})` | Only enumerated event/decision/reason fields and bounded route/request metadata are logged. Subject/client IDs are domain-separated HMAC pseudonyms. No raw errors, URL/query, body, cookies or arbitrary metadata. |
| `validation.mjs` | `readJson` and `validateObject` | Actual streamed byte/depth limits, UTF-8 decoding, prototype-key rejection and explicit flat schemas. This is a small command validator, not a complete JSON Schema engine. |
| `headers.mjs` | `securityHeaders` and `jsonResponse` | CSP, no-store, nosniff, frame denial, referrer and permission policies on function responses. HSTS is emitted for configured HTTPS responses without enabling all subdomains. |
| `bounded.mjs` | `bounded(operation, timeoutMs)` | Default five-second dependency deadline. Network repositories must still set their own fetch abort deadline and reject redirects. No distributed cancellation guarantee. |
| `adapters.mjs` | `terminalRateStore`, `terminalSessionLookup`, `netlifyHandler` | Contracts and translation only. They do not alter an existing function, create a database, issue a login or trust the old admin cookie. |

## Application bindings

The terminal and product handlers read the current session hash from the authoritative store on every request. Their maximum lifetimes are seven days for named customers and one day for terminal guests. The store returns the actual session issuance and expiry. Password recovery and disabling MFA use versioned identity transactions. Sensitive mutations require current enrollment and a scope-bound proof. Ordinary customer step-up lasts ten minutes. Administrative reads and writes require recent MFA within five minutes.

Verified owner grants unlock Portfolio, Terminal Pro and the internal subscription quota exemption. Connection limits, provider permissions and the shared AI resource budget still apply. The IEX owner feed is private and limited to a single venue. The OAuth return binds a browser nonce to the originating session and rechecks the current account, entitlement, MFA and role before the exchange and before binding the connection. Billing webhooks retain their separate raw-body signature verification.

KORVNT service enquiries use a separate public function, an independent guest identity, an independent key ring and separate storage namespaces. Its staff inbox is on the Nortivo company origin and requires both current named MFA administration and an explicitly approved KORVNT operator UUID. The standalone origin has no administrative, terminal, account or portfolio function. The [workflow contract](../../../docs/WORKFLOWS.md) describes the two sets of records, consent and recovery.

The original ticket APIs and the new Nortivo workflow APIs coexist. The customer workflow dispatcher uses the terminal Function path so its host-scoped account cookie reaches the same server. The operator inbox uses the dedicated named-admin authorizer. The protected workflow repository seals records before the product transaction. SQLite serves isolated review data. Hosted operation needs the additive database schema and service-role access. The [privacy inventory](privacy-data.md) describes key custody and visible metadata.

The terminal_consume_limit RPC supplies the atomic hosted rate-limit operation. The existing product transaction enforces compare-and-swap versions and immutable record owners. Local concurrency tests provide evidence for the SQLite adapter. The intended remote database, permissions and hosted connection identity still need independent verification.

## Secrets and audit operations

Use independent high-entropy keys for CSRF, limiter pseudonyms and log pseudonyms. Keep database, billing, mail, signing and encryption keys in server-managed secrets, with scoped environment access and rotation procedures. No secrets are needed for this local preview and `.env.local` was not read. `.env.example` lists names, not usable credentials.

An audit event records an access decision, not proof an action completed. A durable remote sink, restricted append-only retention, bounded transport, budget monitoring and tested delivery are operational requirements. Pseudonymization reduces exposure but does not make logs anonymous; retain them for a justified period with access restrictions. Alert evaluation groups caller-selected records by route; notification routing and scheduling are not installed.

## Browser policy and publish boundary

Netlify's static headers do not automatically apply to Function responses. The KORVNT wrapper emits its own API headers; current existing Functions need separate coverage verification during integration. Test CSP against account, email, billing and broker journeys in staging before adoption. Keep all server modules, configuration and evidence out of the public publish directory. Only the `preview` assets are eligible for a public marketing build after review.

The loopback server serves only allowed static file types within the resolved preview directory, rejects unrecognized Host headers and has no login fixtures or external integrations. The direct-file preview verifies appearance only. Release evidence must cover the actual hosted response path as well as direct Function URLs, every locale/host, cache behavior and recovery/ownership tests.
