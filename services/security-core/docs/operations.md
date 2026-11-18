# Nortivo KORVNT operating protocol

Current local source status: named MFA administration, revocable sessions, account/trading bridges, shared support protection and private-tutor CSRF are implemented and tested. Historical legacy-cookie discussion below explains the baseline risk; those cookies no longer authorize updated endpoints. Production configuration, operator enrollment, monitoring and recovery exercises remain pending. See [current coverage](integration-status.md).

Version 0.1, 18 November 2026. Owner: Noah. Status: local development and proposed operating procedures. KORVNT is not integrated with Nortivo production. This document does not establish a staffed monitoring service, incident response SLA, active alert delivery, completed production backup or successful production restore.

## Accountability and release authority

Noah owns vulnerability-report triage, incident decisions, application configuration, access approvals, release decisions and maintenance. Record any delegated operator and their permitted actions explicitly before giving access. Use individual accounts and least privilege; a shared password prevents useful attribution. An independent reviewer should check privileged changes and recovery evidence when available; no additional staffed role is assumed here.

The repository supplies controls and local verification. Production integration, hosted configuration, scheduled operations and provider changes need separate implementation and the owner's approval. Preserve an incident log with decisions, timestamps, affected services, request IDs, containment actions and verification results. Keep private incident material in access-controlled storage, outside the public website and marketing assets.

## Protection responsibilities

| Area | Nortivo operates | Hosting/provider dependency | Evidence needed before release |
| --- | --- | --- | --- |
| Authorization and session policy | Route policy, owner/role checks, trusted identity adapter, revocation and recent MFA requirements | Database availability and identity-provider guarantees where adopted | Cross-account denial, disabled/revoked user, fresh MFA and shared-store outage tests |
| Abuse controls | Per-route/account budgets and correct trusted client identity mapping | Shared atomic database/RPC and optional hosting edge limits | Multi-instance limit verification, platform header trust check, unavailable-store denial |
| Logs and alerts | Allowlisted events, privacy limits, thresholds, triage and delivery routing | Durable log storage, scheduler/collector and notification delivery | Synthetic alert received by the intended operator, retention/access checks and outage detection |
| Transport/browser protections | Function response headers, cookie flags, CSP inventory and testing | Hosting TLS/certificates, CDN/static headers and domain configuration | Actual deployed HTTPS headers and browser behavior across relevant routes |
| Data and backups | Data inventory, export schedule, access policy, retention, restore decisions | Supabase storage/backup capabilities and selected service plan | Backup existence, recoverable encryption keys and isolated restore evidence |
| Secret custody | Separate keys, least-privilege credentials, rotation and incident revocation | Hosting secret storage and provider key scopes/revocation | Credential ownership, rotation dry run and removal of obsolete access |
| Payments/brokerage | Signature checks, ownership, entitlement reconciliation, consent and safety gates | Stripe payment state and broker authoritative positions/orders/token revocation | Test-mode verification and a separately approved release; KORVNT does not authorize trading |
| Email and reporting | Accurate channel description, minimal report collection and triage | Mail delivery, mailbox security and provider availability | A real monitored channel and successful test delivery before publishing contact promises |

## Normal operating cycle

Before any release, run the KORVNT tests and checks, review changed route policies and dependency changes, and inspect the final publish artifact for secrets/private files. Verify the authentication, limiter and audit adapters against authoritative server data. Re-run denial cases for cross-account resources, revoked sessions, insufficient roles, stale MFA, malformed input, invalid origins and exhausted limits. Keep the public status as “In development” until integration and operational evidence support stronger claims.

On each operating day when production is enabled, Noah should review security/error summaries, alert delivery health, unconfirmed sensitive operations and provider status. The proposed cadence is a responsibility assignment, not an installed scheduled task.

Weekly: review dependencies/advisories and upstream runtime updates; inspect privileged access and recent admin actions; confirm backup completion and available capacity; review outstanding reports and unexplained denial spikes. Apply urgent security fixes according to exposure and verification evidence, rather than waiting for the weekly review.

Monthly: verify contact and alert routes using synthetic events; review key/credential owners and stale accounts; test recovery access; inspect retention and delete expired data according to the adopted policy. Quarterly and after material architecture changes: repeat threat review, permissions review and an isolated backup/restore exercise. Record the date, tested scope and failures; a checklist without execution evidence is incomplete.

## Actionable alerts

`src/audit.mjs` contains a sanitized event writer and a local rule evaluator. The evaluator does not collect logs, select a time window, schedule jobs, send notifications or confirm delivery. `scripts/alerts.mjs` accepts a bounded JSON-lines export on standard input, filters it to the most recent five minutes and prints a summary with `notificationDeliveryConfigured: false`.

| Rule or signal | Initial operational threshold | Owner action |
| --- | --- | --- |
| `DENIAL_THRESHOLD` | Default evaluator threshold: at least 10 denied events for one route in the caller-selected window. Use five minutes initially. | Check reason/status distribution and recent releases; determine whether it is user friction, a misconfiguration or repeated abuse. Review aggregate pseudonyms/request IDs. Tune protection based on evidence; do not disable authorization to silence the alert. |
| `DEPENDENCY_UNAVAILABLE` | Default evaluator threshold: at least 3 denied events for one route where event is `dependency_unavailable` or status is 503, in that same window. | Check authentication store, shared limiter and audit sink. Keep protected actions denied while the required dependency is unavailable. Resolve the provider or configuration failure, then run synthetic denial/allow tests. |
| Lost log/collector delivery | Proposed separate health check: a known synthetic event is not received within the agreed check window. No implementation here. | Check sink credentials, collector/scheduler and destination. An empty event stream is not proof that the site is healthy. |
| Unexpected privileged activity | Manual review or future provider alerts; no generic detector implemented here. | Check named operator, session and change evidence. Escalate unexplained allowed administrative activity as a potential incident. |

The evaluator groups by route, not unique attackers. Several denied events can belong to one request or user journey. Its `critical` severity describes a rule output, not proof of intrusion. De-duplicate and rate-limit notifications in the future delivery integration, preserve request IDs, and record acknowledgments. Use separate access-controlled monitoring for collector/sink health because a failed sink may prevent events from reaching the evaluator.

The logger omits raw bodies, URLs, credentials and arbitrary error text, and pseudonymizes subject/client identifiers using its dedicated HMAC key. Pseudonyms are linkable identifiers and should still receive access and retention controls. `request_allowed` records a pre-handler access decision, not confirmation that the business operation completed. Confirm business results from their authoritative receipt/state; do not interpret an allow event as proof of a successful payment or order.

Proposed starting retention: 30 days for routine security events, with a narrowly scoped incident hold when necessary. Noah must approve the actual retention, access and deletion policy before production. No retention enforcement or immutable archival service is configured by this subproject.

## Incident handling

1. Open a private incident record. Record UTC timestamps matching the ISO audit records, with Europe/Oslo time shown when helpful. State what is verified, what is suspected and which systems/data could be affected. Preserve request IDs, safe provider event IDs, version hashes and relevant sanitized events. Do not paste raw credentials, cookies, customer conversations or unrestricted database exports into tickets or public issue trackers.
2. Assign severity and contain within the affected boundary. Noah is the incident owner. P0: active unauthorized privileged access, confirmed secret/data theft, or unauthorized financial actions. P1: credible authorization bypass, exposed privileged credentials, or severe protection outage. P2: bounded abuse, configuration weakness or limited availability issue without confirmed sensitive access. P3: hardening/report with no verified immediate exposure. Reassess as evidence changes. These categories do not imply guaranteed response times or 24-hour staffing.
3. Preserve evidence before destructive cleanup where feasible. Export the minimal relevant logs, protect originals from modification and record a cryptographic digest and custody/access history. Capture deployed commit/configuration revision and provider audit references. Never include secret values merely to prove exposure. Provider account evidence requires the relevant authorized access.
4. Contain. Revoke the affected session/identity or provider credential in its authoritative system. Restrict affected routes or pause new sensitive actions when needed. If broker compromise is suspected, stop automation and manage/cancel risk directly through the broker with explicit authority; do not assume application suspension cancels broker-held orders. Preserve access to necessary risk-reduction paths. Production/account/DNS changes remain approval-gated in this task.
5. Investigate and fix. Identify entry point, affected identities/data, exposure period, root cause and related credentials. Treat API-key exposure as requiring provider revocation, not merely removal from source. Patch the cause, review analogous endpoints and add a focused regression test. Record uncertainty and evidence gaps.
6. Recover in stages. Verify clean build/configuration, trusted operators, rotated access, revoked stolen sessions and functioning logs/limits. Reconcile payment/broker truth with provider state before resuming associated workflows. Keep automation disabled until its independent release checks pass. Monitor the specific attack/failure indicators after restoration.
7. Close with a short review: cause, impact, chronology, containment, verification, unresolved risks, owner and due date for each follow-up. Noah determines customer/provider/regulatory communications based on established facts and applicable requirements, obtaining qualified advice when needed. This document does not send communications or make legal reporting determinations.

### Revocation is a server action

`clearSessionCookie()` only generates a browser deletion header. Revoke/delete the corresponding authoritative session record first, then clear the browser cookie. Test the original copied token after logout: it must fail even if a client keeps sending it. For suspected account compromise, revoke all account sessions, invalidate outstanding recovery/OAuth grants as applicable and require reauthentication/MFA. Change of roles or identity disablement must be reflected by the trusted lookup on the next protected request.

The combined source uses the current named-admin session and five-minute proof for reads and writes. Logout revokes the authoritative session. For local review, check the [administrator contract](admin-integration.md) and recorded handler tests. Hosted authentication and revocation remain release checks.

## Keys and credential rotation

Use independent strong random values for audit pseudonymization, CSRF tokens, rate-limit storage keys and application encryption. Existing broker-token, MFA/private-content encryption roots and upstream API credentials need separate custody. Record key purpose, owner, creation/rotation date and dependent data without recording the key in this document or logs. Store deployed values in approved secret storage and restrict local development to synthetic credentials.

| Secret purpose | Rotation procedure and practical consequence |
| --- | --- |
| Opaque sessions | No signing root is required by `src/sessions.mjs`; revoke authoritative hashed session records. Issue fresh random tokens after authentication. Rotating an unrelated key does not revoke these sessions. |
| CSRF key | Rotate the dedicated key during a controlled change; old forms/CSRF tokens fail and clients must refresh. Session revocation is separate. Test rejection of old tokens and acceptance after refresh. |
| Audit pseudonym key | Restrict access to old and new keys and record the rotation boundary. Pseudonyms change, affecting cross-window correlation. Preserve only the incident evidence that legitimately needs correlation; do not silently join exported identities or expose keys to analysts. |
| Limiter HMAC key | Rotation changes storage bucket IDs and effectively starts new budgets. Retain independent edge/account protections and schedule a controlled transition. The current library uses one key and does not implement dual-key budget migration. Do not rotate this key automatically during active abuse merely to clear limits. |
| Application encryption roots | Inventory ciphertext dependencies first. Back up required keys separately under restricted recovery access; test decrypt/re-encrypt on synthetic data. Current broker/MFA/private-content formats do not provide an automatic general-purpose key ring or rotation service. Plan explicit versioned re-encryption and rollback before retiring a key; a key change alone can make stored ciphertext unreadable. |
| Upstream database/mail/data/AI/payment credentials | Use the provider's authorized rotation process: provision least-privilege replacement, update the intended server environment, verify safely, revoke old credentials, and check provider usage/audit evidence. During confirmed compromise revoke promptly even if continuity is affected. A removed Git string or changed local variable does not revoke the upstream grant. |
| Broker OAuth access | Disable application automation, erase stored grants where appropriate and revoke authorization at the broker. Confirm the broker's authoritative state; deleting Nortivo's ciphertext alone does not invalidate the external grant or cancel orders. |

Never print secrets for comparison or pass them in command-line arguments, URLs, public forms or incident screenshots. Use separate test accounts and provider test modes for rotation exercises. Preserve rollback capability without leaving a known-compromised credential active.

## Backup and restoration

Proposed targets for the initial account/research portal are RPO 24 hours and RTO 8 hours. These are planning targets, not measured guarantees or a service promise. Paid account/billing workloads and any future order execution require a separate tighter recovery design and evidence before activation. Provider limits and chosen paid plans may prevent meeting these targets.

Backup scope: database schema/migrations/RLS/grants; required account/portfolio/receipt/entitlement records; code and exact release/configuration versions; operational evidence; and encrypted records together with separately protected recovery keys. Payment and broker platforms remain authoritative for their external actions. A Git checkout alone is not a database backup. A database dump without the correct encryption roots may not restore usable encrypted data.

Before production integration, Noah must choose and verify the provider backup/export mechanism, frequency, retention, recovery access and cost. Keep backups access-controlled and encrypted; keep recovery keys separately; avoid copying live personal data into ordinary local previews. Verify job success and recovery readability, rather than relying on a configured schedule. No automated backup job is installed here.

Restore procedure:

1. Record the incident/change, obtain the required production approval and select a known clean backup/release pair. Validate backup integrity, time and completeness. Establish an isolated target with no outbound mail, payment writes or broker execution and no production public routing.
2. Restore schema, permissions and data in that isolated target using the provider-supported process. Verify migrations, row counts, expected constraints, owner boundaries and encryption recovery with controlled access. Do not trust old restored sessions or stale OAuth flows: revoke them before any return to service.
3. Restore the matching code/configuration with replacement credentials where compromise is possible. Keep trading and scheduled side effects disabled. Verify synthetic unauthorized/authorized flows, CSRF, role/owner/MFA decisions, shared limits, audit emission and business record integrity.
4. Reconcile Stripe billing and broker positions/orders from canonical provider state under an approved, controlled process. Resolve outcomes after the snapshot and preserve idempotency/receipts. Do not blindly replay external financial requests from restored jobs or intents.
5. Measure actual recovery point/time, record discrepancies and get the release decision. Re-enable traffic/functions in stages, inspect health and perform a fresh backup. Destroy isolated copies according to the adopted retention policy.

### Synthetic tabletop drill

The combined suite executes a closed-database SQLite copy/restore using generated keys and two synthetic account holders in `tests/security-core-restore.test.mjs`. The real Nortivo and KORVNT customer handlers retrieve their own encrypted conversations after restoration. They deny cross-company reads and a wrong vault key. The Nortivo handler denies the other holder and the revoked session. This exercises the local adapter and key dependency. Hosted snapshots, production restore time and real recovery points still require independent verification.

The broader incident tabletop below remains a prepared exercise. Use only a small synthetic fixture: two test owners, a revoked and valid session, one sample portfolio/receipt, synthetic encrypted content and sanitized events. No production export, credential, mailbox delivery, external payment or broker action is needed.

Exercise sequence: record fixture digest/counts; simulate loss of the local working copy; restore a duplicate into a temporary isolated directory/store; confirm expected owners/records and synthetic decryption; reject the revoked session and cross-owner request; verify a valid authorized read; feed 10 denial events and 3 unavailable events to the alert evaluator for the same five-minute window; record expected rule outputs, elapsed time and failed checks. Keep outbound actions disabled throughout. Delete only the checked temporary exercise target after retaining a sanitized result.

Label any result “synthetic tabletop” and identify exactly what ran. It cannot establish provider backup recoverability, production RPO/RTO, actual notification delivery or successful recovery of real customer data. A real isolated restore exercise must be performed and documented separately before claiming those capabilities.

## Vulnerability-report triage

Noah is the named triage owner. The local preview can explain a future reporting path; it must not imply an invented staffed mailbox, response SLA or bug-bounty program. Before public release, choose a real channel, verify owner access/delivery and publish its exact scope. Keep customer-support and vulnerability handling privileges appropriate to the data they receive.

Request a concise affected route/version, reproducible steps, expected/observed behavior and minimal sanitized evidence using the reporter's own test account. Do not request passwords, access tokens, payment details or bulk customer data. Record receipt, severity, authorized reproduction, remediation and closure. Testing third-party systems or real financial actions requires their own explicit authorization. No report has been sent and no contact account created by this subproject.

## Cost and maintenance decisions

| Cost bucket | Initial choice or planning question | What is not included automatically |
| --- | --- | --- |
| KORVNT source | Current local library uses Node built-ins and injected adapters. No new paid KORVNT subscription is required. | Engineering time, security review and ongoing fixes |
| Database/atomic limits | Reuse the existing verified Supabase/RPC path where suitable; measure request count/storage and choose capacity | Availability guarantees, backup/PITR features or quota increases |
| Hosting/runtime | Existing Functions plus a separate preview; review actual request/runtime usage | DDoS protection tier, edge abuse rules and dedicated monitoring |
| Logs/notifications | Select durable retention, collector/scheduler and a tested delivery route | Installed alert scheduling, human response coverage or delivery guarantees |
| Backups/recovery | Budget for backup storage, selected restore features and exercise time | Proven restoration or the proposed RPO/RTO |
| External services | Review actual mail, data, AI, payment and broker account plans independently | Provider usage, licenses, commercial permissions or account-level security |

No current provider prices are asserted here. Confirm the actual plan, usage limits and bill before adopting paid features. Owner time is a recurring operational cost even when the code and libraries have no license fee.


## Shared provider resource ceiling

`PRODUCT_AI_DAILY_PROVIDER_TOKEN_LIMIT` sets the shared daily maximum of worst-case reserved upstream tokens. The default is 2,200,000 and zero pauses new calls. The limit applies across all users and operator probes, including the owner. A single versioned transaction reserves both provider capacity and the account/request receipt before any paid request. The UTC day rolls forward on the next request. A retry returns its original receipt and unknown outcomes keep their reservation. Actual pricing, currency conversion, provider credits and external hard caps remain the operator's responsibility. Verify the plan and a suitable setting before activating a funded provider.
