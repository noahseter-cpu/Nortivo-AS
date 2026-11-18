# Reviewing the unpublished integration

The working Nortivo checkout already contains these local changes. The downloadable review package contains the reusable framework at its root plus an `application` reference overlay with the selected website, server, UI and test integrations. It is not a complete application repository and does not register or deploy a website.

The framework's own tests and marketing preview run independently. Application integration tests require the existing full Nortivo repository and its pinned runtime dependencies. The overlay is review material; do not copy it over an unrelated checkout or a live deployment automatically. Source hashes and test results are in `evidence/integration-verification.json`.

No local environment file, actual credential, sealed provider/bootstrap payload, private course package or customer record is intentionally included. The optional `.env.example` contains configuration names and empty values only. The public security assets contain only presentation files. Existing private/provider data was not decrypted or repackaged for this review.

Concurrent owner/API work remains in the shared checkout and was preserved. The new operator-owned role is treated as a trusted privilege only when its server record is verified, active and non-disabled; current session/MFA checks still apply. A source-only follow-up reviewed its separate bootstrap/runtime modules: short-lived bearer authorization, fixed configuration, expected origin, one-use atomic receipt and no signed-in session or named-MFA bypass. Sealed payloads, real authorization and actual key custody were not inspected. That provisioning flow is separate from ordinary signup and from this security task's actions.

Production release still needs a verified named MFA-enrolled administrator, remote shared-state and live browser/header evidence, a monitored reporting/logging destination, backup restoration and name clearance. Nothing in the package authorizes publication, account provisioning, credential changes or data migration.
