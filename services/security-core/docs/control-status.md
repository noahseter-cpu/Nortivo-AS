# Current control status

18 November 2026 · Nortivo KORVNT 0.2 · Local integration under review · Unpublished

| Control | Implemented and exercised locally | Remaining production evidence |
| --- | --- | --- |
| Account/trading sessions | Authoritative hash lookup, real issuance/expiry, revocation, canonical cookies, explicit user/guest lifetimes | Current deployed migrations, browser cookies, real-host recovery and revocation |
| Ownership and private records | Core server policy before account/terminal data; cross-account negative tests | Applied database policy, live entry-point coverage and service-role scope |
| Operational privileges | Verified, non-disabled account plus current server admin/owner grant and recent security MFA | Real operator configuration and enrollment |
| Support/private administration | Named account password plus maintained MFA/recovery; dedicated opaque cookie; five-minute MFA freshness; revocation on logout | Confirm named MFA login before any deployment replacing legacy access |
| CSRF and origin | Exact origin and session-bound tokens; dashboard/session bootstrap and guarded private tutor bridge | Browser and hosting behavior on actual domains |
| Shared abuse protection | Existing atomic RPC wired through Core; no hosted memory fallback; support and admin limits | Actual remote multi-instance behavior and trusted platform IP provenance; edge limits |
| Input and transport bounds | Strict request types/size/depth; bounded dependency waits; support HTTPS origin, redirect rejection, ten-second abort and response-size limit | Real upstream timeout/retry and spend behavior |
| Website/API headers | Core headers on functions, existing strict static CSP retained, host-only HSTS prepared | Actual deployment headers, TLS and constrained private iframe behavior |
| Security events | Allowlisted route/request/actor-pseudonym access decisions; credential/body exclusion; pre-action sink acceptance | Restricted durable retention, notification delivery, completion evidence and edge logging; malformed anonymous cookies are denied before Core audit/rate setup |
| Shared upstream AI resources | One atomic reservation covers both account usage and the daily provider token budget, including owners and operator probes. Duplicate receipts consume once. | Set the production ceiling and provider funding alerts. Actual currency cost depends on provider rates. |
| Sensitive-data encryption | Existing broker/MFA/private-package formats retained; AES-GCM vault integrated into the workflow repository, with context and rotation checks | Vault is not a migration of customer rows; provider at-rest encryption, key custody, restore and field migration need evidence |
| Publish boundary | Publish-tree check flags private/server/key/database paths, sealed provisioning filenames and common credential markers in public text | A complete content/provenance scan, current dependency advisories and deployed artifact review |
| Incidents/backups/alerts | Written runbooks and local rule evaluator | No live alert scheduler/delivery or production restore exercise configured |
| Website/name/badge | Renamed preview and local site scope pages; English/Norwegian links; future badge inactive | Brand clearance and explicit approval before publication; no security guarantee implied |

See [integration coverage](integration-status.md), [administrator contract](admin-integration.md), [privacy scope](privacy-data.md) and [verification evidence](../evidence/integration-verification.json). The original [application review](application-review.md) is retained as a pre-integration baseline. Local tests do not establish live protection.