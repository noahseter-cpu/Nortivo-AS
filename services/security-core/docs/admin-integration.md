# Named administrator integration

Local source integration prepared on 18 November 2026. Nothing in this change provisions a real account, applies database migrations, publishes a website, changes provider settings or reads real credentials.

## Authorization path

The support administration endpoints now use `netlify/security-core/admin.mjs`. A valid shared `ADMIN_PASSWORD` or old `nortivo_admin` signed cookie is no longer accepted by those endpoints.

Administrator identity must be an existing `terminal_users` account with its own maintained scrypt password. Its server-owned account record must be email-verified and not disabled. Privilege comes from either the current `PRODUCT_ADMIN_USER_IDS` allowlist or an explicit operator-provisioned owner grant recognized by `isOwnerAccount`. A browser field, email address, paid plan or billing metadata cannot grant administrator status.

The named account must have enabled MFA in the existing product MFA system. Login reuses the maintained TOTP/recovery implementation, including replay-counter and transaction-version checks. The stored `mfa_sessions` proof records an actual `verifiedAt` timestamp and the internal `admin` scope. A normal product `security`, `broker` or `execution` proof cannot be repurposed as an admin proof.

Successful login creates a random 256-bit opaque token. Only its SHA-256 hash is stored in the existing terminal session table. The browser receives a dedicated `__Host-nortivo_admin_core` cookie with `Path=/`, `Secure`, `HttpOnly`, `SameSite=Strict` and an eight-hour maximum. The authoritative session, current privilege, verified account, enabled MFA and session-specific MFA proof are read again on protected requests. A copied cookie fails after server revocation.

Admin access requires MFA verified within the preceding five minutes. At that boundary the UI returns to named sign-in for a fresh password/MFA authentication. Logout is the only operation that can use an otherwise valid stale-MFA session; it still requires exact origin and its session-bound CSRF header, deletes the session row first, and then clears the cookie. Session expiry, disabled MFA/account or privilege removal deny access.

## Browser/API contract

| Endpoint | Request | Successful response |
| --- | --- | --- |
| `admin-login` | POST JSON: `email`, `password`, and either six-digit `code` or `recoveryCode`; optional `language`. Exact same-origin required. | `{ok:true, csrfToken, admin:{id}}` plus opaque secure cookie. |
| `admin-session` | GET with dedicated cookie. | `{ok:true, csrfToken, admin:{id}}`; use it to restore in-memory CSRF after navigation/refresh. |
| `admin-logout` | POST with cookie, exact Origin and `x-csrf-token`. | `{ok:true}` after authoritative revocation, then cookie deletion. |
| Admin ticket/project/private endpoints | Dedicated cookie on all requests. Every state-changing request also requires exact Origin and `x-csrf-token`. | Existing business/binary response formats are preserved. |

Failures are generic and do not include passwords, raw tokens, MFA secrets, provider bodies, SQL or stacks. `401 AUTH_REQUIRED` means sign-in is needed. `403 MFA_REQUIRED` means fresh MFA is required. `403 CSRF_FAILED` means the client must refresh its session-bound token. Shared protection outages fail closed with 503. Shared rate limits return 429 with `Retry-After`.

Login uses shared atomic per-connection and per-account limits, not a function-instance Map. Protected requests use additional shared connection/account limits. The remote production implementation is the existing Supabase RPC; an explicitly injected SQLite store supports local tests only. There is no automatic production memory fallback. Missing/malformed legacy cookies are rejected before database access.

The private course wrapper serves an authenticated external `core-csrf.js` bridge and injects that external script into trusted HTML responses. It obtains the admin token in memory and adds it only to same-origin private tutor mutations. It does not forward arbitrary incoming identity headers and does not require editing or decrypting the packaged private runtime. Its existing private-page and same-origin iframe CSP exceptions remain constrained to that application.

## Configuration and operational limits

The integration needs the existing database, product MFA encryption key and individually provisioned verified account. It uses `SECURITY_CORE_ADMIN_KEY` when configured, otherwise the existing strong `ADMIN_SESSION_SECRET`; minimum input length is 32 bytes. HKDF-SHA256 derives distinct CSRF, limiter-pseudonym and audit-pseudonym keys under explicit purpose labels. No secret value is written by this change.

The default audit sink is structured console/provider logging. It emits minimal pseudonymized access decisions before privileged application work. Provider log custody, retention, durability, alert routing and tested delivery remain deployment evidence. An allow event proves that an access decision was accepted by the sink, not that a later email, mutation or private worker action completed.

Production publishing remains prohibited until approved. Before a later release, verify that the existing owner/admin account can complete MFA, the required database migrations/RPC permissions exist, cross-instance limits work, every live response carries the expected headers, the UI/session bridge works on real hosts, and named login/logout/revocation is exercised without weakening broker or billing checks. Existing shared-password access will stop working after this source is deployed; a named verified MFA-enrolled identity is required beforehand.

## Verification

`node --test tests/security-core-admin.test.mjs` passes eleven synthetic integration tests using a private in-memory SQLite database and maintained OTP implementation. Coverage includes successful login, opaque hashing, current server grants, strict boolean verification/MFA flags and integer assurance expiry, denied spoofed/legacy credentials, MFA enrollment/freshness/replay/recovery, authoritative logout, CSRF/origin, no private query before authorization, cross-instance shared limiting, safe headers, secret exclusion, and dependency/audit failures. No real service is called.

The existing admin/support/private workspace suites were migrated separately to real synthetic named-session fixtures; they do not enable a production test bypass.
