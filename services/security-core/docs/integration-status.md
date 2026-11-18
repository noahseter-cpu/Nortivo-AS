# Local protection coverage

18 November 2026 · Unpublished source integration · No production changes by this work

Nortivo KORVNT is connected to the actual application source. Deploying a label is not the release goal: each listed protection has a server-side integration and local evidence. Deployment and production configuration remain explicitly prohibited until Noah approves them.

| Surface | Prepared in local application source | Limits before a live protection claim |
| --- | --- | --- |
| Company website | Existing strict static CSP/frame/content-type policies retained; HSTS prepared; public security scope pages and locale-safe footer links added | Actual hosting/TLS/header behavior unverified. Local pages state review/deployment pending; badge inactive. |
| Customer accounts | Core verifier reads true session issuance, expiry and current hash record; revocation and user/guest lifetime checks; explicit ownership, safe body/CSRF handling and shared rates | Real deployed migrations, device/browser cookies and recovery flow need staging evidence. Existing maintained password/recovery mechanisms are preserved. |
| Trading platform | Core sessions and rate protection in terminal/product entry points; owner checks before private account records; operational admin routes require verified, non-disabled server admin/owner role and recent security-scope MFA | Existing entitlements, broker approvals/signatures, idempotency, risk and stop/reduction paths remain separate essential controls. No trading execution or broker-account changes occurred. |
| Support and administration | Named verified MFA accounts; opaque hashed admin sessions; current grants and recent MFA checked per protected request; server-side logout; CSRF including private tutor; shared support throttling; bounded/redirect-rejecting database/mail calls; safe access-decision logs | A real named verified MFA-enrolled administrator must be confirmed before release. Missing/malformed cookies are cheaply denied before remote rate/audit initialization; edge flood protection/logging is a separate layer. |
| Invest conversations and custom requests | Shared customer session and ownership, operator MFA, idempotent versioned records, encrypted transcripts, briefs, receipts and indexes | Requires workflow schema and protected vault ring. Retention, restored reads and remote service-role policy need hosted verification. |
| Standalone KORVNT enquiries | Separate guest cookie with server-side expiry and revocation, dedicated function, separate namespaces, key ring and encrypted purpose, five bounded enquiry types, guest tracking and two-way follow-up. The parent-host KORVNT inbox and online status require an explicitly granted operator plus fresh named-admin MFA. | Hosted origin/DNS/TLS, grants, recovery, operator availability and handling of sensitive evidence beyond initial intake remain release work. |
| Private/customer data | Cross-account authorization, no-store responses, minimal pseudonymized security events and preserved MFA/broker/private-package encryption. Authenticated data vault and rotation helper in the new workflow repository | The vault has not migrated existing database rows. Portfolio/support data is not universally application-encrypted. Provider at-rest encryption, backups, key custody, retention and restore need separate evidence. |

The code does not promise immunity from compromise, end-to-end encryption of all records, a 24/7 monitoring service or regulatory certification. It combines enforceable application controls and operational procedures around Nortivo's existing providers.

## Baseline finding remediation

The [original application review](application-review.md) is a retained pre-integration baseline. Its line references and old behavior should not be read as a description of the updated local code.

| Baseline | Local remediation | Remaining work |
| --- | --- | --- |
| APP-01: per-instance admin/support limits | Active endpoints use Core limits and the existing shared atomic RPC; no memory fallback in hosted mode | Prove actual remote multi-instance behavior and hosting edge settings. |
| APP-02: nonrevocable admin cookies | Old cookies cannot authorize endpoints; opaque hash lookup and server-side logout replace them | Verify deployed/browser revocation and incident key/session operations. |
| APP-03: shared password without MFA | Named account password plus maintained MFA/recovery; current admin/owner grant, verification and enablement checked | Confirm the real account's enrollment before deployment; this task created no account. |
| APP-04: unbounded support transport | Explicit ten-second abort, redirects rejected, strict HTTPS database origin and bounded JSON response | Verify real upstream failure/retry behavior and provider budgets. |
| APP-05: no attributable admin security events | Minimal route/request/actor-pseudonym access decisions before privileged actions | Durable protected log delivery/retention/alerts and business-completion evidence remain operational requirements. |

## Evidence

`evidence/integration-verification.json` records the current combined security suite, repository regressions, environment blockers, publish-boundary check and source hashes. Tests use synthetic identities and records. The [dependency query record](../evidence/dependency-advisories.json) covers the exact root npm lockfile versions. Remote account/provider configuration still requires independent review.

`docs/admin-integration.md` describes the real named login and five-minute privileged MFA freshness. `docs/privacy-data.md` distinguishes access protection, existing encryption and the workflow vault and earlier records. `docs/operations.md` supplies response, rotation, backup and recovery procedures with their unproven objectives clearly labeled.
