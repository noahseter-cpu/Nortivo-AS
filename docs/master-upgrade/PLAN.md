# Nortivo master upgrade — local review plan

18 November 2026. **Local implementation and review only. No publication, push, DNS change, production migration, real-account changes, external messages or live trading.**

## Baseline and preservation

The review branch starts at `40c8789616a9f23c1f2e769496c79f33e012af07`, the published owner/live-feed and performance release. The original working directory remains in place on its existing branch, including unpublished KORVNT, administration and support work. A three-way reconciliation brings that work into this isolated review tree. This is a combined candidate, not a replay of the old 49-file release.

Keep the consumed owner provisioning endpoint absent. Keep all actual credentials, credential-derived envelopes and local database files outside the review source and public assets. Use independently generated local keys and synthetic named accounts.

## Implementation sequence

| Step | Work and dependency | Acceptance evidence |
| --- | --- | --- |
| 1. Reconcile source | Combine current KORVNT controls with persisted owner access, compact account boot, request cancellation, caching boundaries and chart lifecycle fixes. Resolve overlaps deliberately. | No conflict markers; owner/billing/OAuth/risk/performance regressions pass; original workspace preserved. |
| 2. Brand and application boundaries | Use the exact supplied PNG and reference JPEG. Keep terminal composition. Separate company, Invest and KORVNT host routing and local previews. | Original asset digests; strict host/origin tests; no broad cookies/CORS; security host cannot serve private administration. |
| 3. Public Invest and company | Build independent bilingual Invest home, complete terminal preview/enlargement, workspace comparison, custom-system pages, guidance, support, FAQs and qualified KORVNT links. Keep company report and original definitions prominent. | Public pages render without terminal initialization; real catalog/availability; keyboard, mobile/tablet/desktop and reduced-motion checks. |
| 4. Conversations and requests | Persist real local customer/operator conversations and four-stage bot/engine requests. Share conversation across embed/launcher. Protect guest ownership, retries, references, status and encrypted private payloads. | Customer/operator browser round trip, restart/history, duplicate prevention, claim isolation, failed/retry states, local capture only. |
| 5. Security integration | Reuse current KORVNT source, named verified MFA administration, authoritative revocable sessions, shared atomic limits, bounded transport/audit/vault and actual workflow guards. | Handler-level negative tests for owners, roles, sessions, MFA, CSRF, origins, limits, malformed input, outages, log redaction and vault context/tampering. |
| 6. Platform journeys | Integrate parent branding and Invest support entry while preserving exact accounting, plan intent, true availability, billing signatures, OAuth and execution gates. | Owner/no-subscription fixture plus ordinary customer/guest fixtures; account/billing/portfolio regression suite; no live execution. |
| 7. Combined verification | Run security check/verify/full integration/privacy commands, application and market tests, locale build and actual local browser journeys at required dimensions. | Save current passes/failures/skips separately; screenshots and route evidence; report actual limitations. |
| 8. Review and release preparation | Record coverage, provider requirements/costs, naming checks, retention/backup/incident responsibilities, migrations, host activation, administrator verification, smoke tests and rollback. | Reviewable checklist and residual-risk register; no checklist execution and an explicit unpublished statement. |

## File ownership while implementing

- Root: reconciliation record, plan, host routing/build integration, isolated preview and fixture lifecycle, product/terminal shared branding, final verification and combined delivery documents.
- Security worker: KORVNT backend/framework, named MFA administration, account/trading guards and security regression integration.
- Workflow worker: persisted chat/intake, protected operator inbox, customer components, prepared data migration and workflow tests.
- Public UI worker: Invest and service pages, company navigation/footer/public branding, dedicated bilingual KORVNT experience and isolated styles.

Workers share the review tree and preserve each other's changes. No worker may publish or push.

## Release hold

The eventual release needs a separate explicit approval after the completed combined review. In particular: named production MFA administrator validation, provider permissions, secret custody, migrations, security-host DNS/TLS, retention/alerts/restore verification and production smoke tests remain release gates. Local fixtures and tests do not establish production deployment or universal encryption/monitoring coverage.

## Completed local execution

Steps 1–6 are implemented together in the review tree. Step 7 passed the final source checks: 423 repository regressions, 100 overlapping security/workflow checks, 37 standalone framework checks, separate 87 market checks, static/locale checks and the scoped 219-file publish-boundary scan. The actual multi-host browser review covered normal named MFA login, owner/free accounts, real persisted replies, both intake types, tracking/follow-up and desktop/tablet/phone layouts. [Browser evidence](BROWSER_REVIEW.md) distinguishes observed results from remaining OS, assistive-technology and production checks.

Step 8 produced [coverage](COVERAGE.md), [operations and costs](OPERATIONS.md), [preliminary naming checks](NAMING.md), and the [unexecuted release/rollback checklist](RELEASE_CHECKLIST.md). The public remote main revision was read back as the original baseline after implementation. No release authorization was inferred from earlier work.
