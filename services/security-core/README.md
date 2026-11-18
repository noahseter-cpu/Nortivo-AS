# Nortivo KORVNT

Version 0.2.0 · Local integration under review · Unpublished · 18 November 2026

KORVNT is Nortivo’s customer-facing daughter company with a standalone site prepared for korvnt.no. Nortivo Security is the security-service identity. Nortivo KORVNT is the underlying application-security framework and operating protocol. The framework is now connected to the local Netlify / Node ESM / Supabase application source: account/trading sessions and rate limits, ownership checks, privileged MFA, support protection, administrative sessions and response headers. **These changes are unpublished. They do not establish that the live site has received this protection.**

Core uses explicit server-side policies, current revocable sessions, recent administrative MFA evidence, same-origin/CSRF checks, bounded JSON validation, shared rate limits, minimal security events and defensive response headers. New support conversation and project-request records use authenticated owner/purpose/record-bound encryption through the workflow repository. No customer records were re-encrypted. There are no added third-party runtime packages; maintained Node cryptographic APIs and the application's existing OTP library provide the primitives.

## Review first

- [Application review](docs/application-review.md): baseline findings, local remediation status, endpoint inventory and trust boundaries.
- [Named administrator integration](docs/admin-integration.md): the real account, MFA, cookie, CSRF and revocation contract.
- [Privacy and data scope](docs/privacy-data.md): existing protection, new vault, provider dependencies and migration limits.
- [Architecture and integration](docs/architecture.md): API contracts, sample integration and migration boundaries.
- [Control status](docs/control-status.md): implemented controls versus production and operating work still pending.
- [Operating protocol](docs/operations.md): incidents, secret rotation, backup/recovery, cost and maintenance ownership.
- [Roadmap and release gates](docs/roadmap.md): practical order of work before deployment or badge activation.
- [Naming and references](docs/naming-and-references.md): preliminary brand check and primary technical references.
- [Framework evidence](evidence/verification.json) and [integration evidence](evidence/integration-verification.json): recorded results and blocked checks.

## Run locally

Use an actively supported Node runtime meeting the repository's >=22.5 requirement. Verification in this environment used Node 24.19.0. No installation or real credentials are needed.

```powershell
node --test services/security-core/tests/*.test.mjs
node services/security-core/scripts/check.mjs
node services/security-core/scripts/verify.mjs
node services/security-core/scripts/verify-integration.mjs --full
node services/security-core/scripts/privacy-check.mjs
node services/security-core/scripts/preview.mjs
```

From inside the standalone package folder, use these equivalent commands:

```powershell
node --test tests/*.test.mjs
node scripts/check.mjs
node scripts/verify.mjs
node scripts/preview.mjs
```

The marketing preview binds to `127.0.0.1:4486`; use `--port 4487` if needed. It refuses production runtime flags, reads no `.env` files, has no users/login fixtures, and starts no worker or trading execution. Its in-memory rate state and random process keys are development-only. `/api/status` states development status; `/api/private` and `/api/admin` deny anonymous callers. Actual application integration lives in the repository's `netlify` source. `verify-integration.mjs` requires that full repository; the standalone library's tests/check/marketing preview work independently.

Open [the homepage](preview/index.html), [security page](preview/security.html), or [local report builder](preview/report.html) directly if local HTTP networking is unavailable. File previews allow visual/interaction review but cannot verify HTTP headers or hosted behavior. HTTP response construction is covered in the local security tests.

The report builder prepares a text draft in browser memory and offers download/clear. It does not submit or store reports. Common-pattern redaction is a convenience with stated limits; a monitored reporting destination is still a release gate. Keep real secrets out of drafts.

## Package layout

```text
src/       Reusable server-side controls and Netlify/terminal adapter contracts
tests/     Behavioral security and failure-path tests using synthetic data
preview/   Buildless homepage, dedicated security page and report-draft route
examples/  Integration factory; not located in Netlify's deployed Functions directory
scripts/   Loopback preview, bounded local alert evaluation, checks and evidence
docs/      Source review, architecture, operating procedures and release gates
evidence/  Recorded local verification and explicit verification limits
```

Import the package through `src/index.mjs`. Build one `createSecurityCore` instance with separate server-only CSRF, limiter and log-pseudonym keys, a trusted session verifier, an atomic shared limiter, and an awaited audit sink. Declare every endpoint's methods and role/ownership requirements explicitly. The configuration intentionally rejects a production limiter backed by the development memory store.

## Limits that matter

The local admin source now requires an existing named, verified account with enabled MFA and a current server-owned admin/owner grant. A shared admin password and old signed admin cookies no longer authorize application endpoints. Before any later deployment, verify a real named administrator can complete this flow. The existing session stores now return true session creation times; workspace and admin bridges validate current records with their explicit lifetimes.

Dependency failures and default five-second dependency deadlines fail closed. The deadline bounds application waiting; each network adapter must also abort underlying I/O. A handler may still fail after it has performed an action: retain the application's transaction/idempotency rules, especially for money, email and broker operations.

Logging durability, retention/access controls, notification delivery, production backup restoration, provider configuration and live route coverage have not been verified. Early malformed-envelope rejections in the Netlify adapter are hardened but do not enter the core audit pipeline. Hosting/edge logs and a bounded adapter-rejection logger remain integration work.

Nortivo KORVNT is a descriptive working name; preliminary search is not trademark clearance. The future “Secured by KORVNT” wording remains inactive until a reviewed deployment has evidence for its exact scope. Local pages state that integration is under review and has not been deployed. No publishing, DNS changes, account provisioning, credential changes or production data migration were performed.
