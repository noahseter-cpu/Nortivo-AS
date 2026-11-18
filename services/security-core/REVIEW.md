# Nortivo KORVNT: unpublished integration

18 November 2026 · Version 0.2.0 · Local integration under review

Nortivo KORVNT now has real local integrations across the website, accounts, trading platform, administration and private-data access. It includes the reusable framework, application changes, named MFA administration, website pages, security tests, a baseline audit and operating protocol. These changes are unpublished; live protection has not been activated by this work.

## Open the work

- [Homepage preview](preview/index.html)
- [Nortivo Security / KORVNT page](preview/security.html)
- [Local vulnerability-report draft builder](preview/report.html)
- [Setup and project guide](README.md)
- [Current protection coverage](docs/integration-status.md)
- [Named MFA administrator setup](docs/admin-integration.md)
- [Privacy and encryption scope](docs/privacy-data.md)
- [Existing application audit](docs/application-review.md)
- [Control status and limits](docs/control-status.md)
- [Operating procedures and costs](docs/operations.md)
- [Roadmap and release gates](docs/roadmap.md)
- [Recorded verification](evidence/verification.json)
- [Combined security and regression results](evidence/integration-verification.json)
- [Package scope](docs/review-package.md)

The [latest machine-readable run](evidence/integration-verification.json) records the focused results, full repository results, skips, failures and publish-tree filenames and text-marker check. The earlier 89 focused passes and 360/362 repository result belong to the pre-merge review.

## What works locally

Current results are recorded in [integration verification](evidence/integration-verification.json). The combined checks exercise actual named admin login/logout, MFA/recovery/replay, copied-session revocation, owner/role boundaries, account/trading handlers, CSRF including private tutor, shared limits/outages, safe transport/logging, headers and authenticated encryption. Core adds no third-party runtime packages. Existing commerce/broker/idempotency protections are retained and regression-tested.

The initial homepage was visually reviewed before this rename. The updated preview/pages received static and synthetic interaction checks; they have not received a fresh complete browser review. The current run records actual loopback and directory-link outcomes. The 18 November 2026 GitHub public advisory queries returned zero matching reviewed, unreviewed or malware entries for the three exact root npm lockfile versions. The [query record](evidence/dependency-advisories.json) covers only those packages and that database at the recorded time. Node, hosting, browser assets and newly disclosed issues require separate checks. Production database/hosting settings, notifications and backup restoration remain unverified.

## What to fix first

The baseline support/admin findings now have local remediations: shared rate protection, named verified MFA accounts, opaque revocable sessions, bounded transport and attributable access-decision logs. The original findings are retained as historical evidence, with current status in the coverage guide. Concurrent unrelated workspace work was preserved.

Before a later release, confirm a real named verified MFA-enrolled administrator, remote shared-state behavior, deployed browser/response protection and durable restricted log/alert delivery. The report-draft tool still does not submit reports; verify its operational reporting destination before publishing.

## Name and public claim

KORVNT is the customer-facing daughter company. Nortivo Security identifies its security services where appropriate. Nortivo KORVNT identifies the technical framework. The owner reports purchasing korvnt.no through Uniweb. Similar names and pending trademark checks are recorded in the [naming screen](../../docs/master-upgrade/NAMING.md). The preview states local integration under review; “Secured by KORVNT” remains an inactive future badge until deployed scope and evidence are approved.

## Cost and maintenance

The local review needs no paid service or credentials. Hosting requests, shared database operations, security-log retention, alert delivery, provider usage and human response time are production cost categories. Actual provider charges and a budget must be confirmed before deployment. The operating guide assigns maintenance/incident ownership to Noah and includes a proposed cadence and recovery procedure; no recurring automation was created.

No production deployment, live website integration, DNS change, account change or trade execution was performed by this work. Those actions remain pending Noah's explicit approval.
