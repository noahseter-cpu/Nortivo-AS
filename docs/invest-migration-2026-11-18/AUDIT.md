# Investment workspace migration — 18 November 2026

## Scope and baseline

Preserve the approved compact terminal and the current near-black/charcoal/ivory identity. Improve the surrounding journeys and move the existing application to `invest.nortivo.no`, on the same Netlify project and backend. No purchases, provider contracts or trading activation are part of this release.

Source baseline: `f5b7470` (production implementation `5258e88`). The pre-existing tracked modifications were newline/stat noise, with no substantive diff. The earlier `terminal-audit-2026-11-18` directory is evidence from a prompt-only audit whose implementation was reverted; its tests do not validate this release. Unrelated `output/` artifacts are excluded.

Fresh live baseline: terminal entry and read-only sample, pricing and Portfolio entry, English. Current live catalog: Portfolio USD 10/month or 96/year; Terminal Pro USD 30/month or 288/year; 20% annual saving, paid upfront; purchases closed, free registration available. Dedicated company pages remain on `nortivo.no`. Screenshots are adjacent to this file. Browser dimensions and later validation are recorded in `VALIDATION.md`; no phone pass is inferred from desktop captures.

## Priorities

| Priority | Evidence | Change |
| --- | --- | --- |
| P1 | Live pricing and source: pricing switcher says Portfolio; annual intent can reset through bare pricing links. | Correct navigation and preserve tier, interval, locale and safe destination. Lead annual cards with the annual charge. |
| P1 | Source: auth mode switches discard safe drafts; password minimum has no nearby guidance; expired sessions leave stale UI. | Retain safe email/name drafts, explain password requirements and recover to sign-in without replaying mutations. |
| P1 | Source: selected-plan price is not clearly distinguished from an active subscription. | Keep purchases-closed state and selected-plan status visible through authentication. |
| P1 | Source: host-independent language redirect sends the investment root to marketing; origin checks omit the alias. | Add exact host-aware routing, exact origins, host-only sessions and gated old-URL cutover. |
| P1 | Source: cancellation return drops interval/plan; change preview omits future recurring amount. | Retain safe journey intent and return server-validated recurring pricing in the preview. |
| P2 | Source: some disabled controls do not identify the blocking prerequisite. | Visible compact reasons and accessible descriptions within the fixed composition. |
| P2 | Source: Portfolio guest CTA is distant from paid-write requirements. | Explain current access and purchases-closed state near entry and write controls. |

## Capability inventory

The evidence column distinguishes current observation from implementation coverage. A test fixture does not establish a funded external connection.

| Capability | Status | Evidence and limit |
| --- | --- | --- |
| Bilingual company site, platform entry, pricing, read-only sample | Working | Live baseline observed; fixed fictional sample is explicitly read-only. |
| Free account, verification, recovery, MFA, sessions | Working implementation; private hosted flow not yet exercised for this release | Existing source/tests. Provider acceptance is distinct from inbox delivery. Local fixture journey results follow in validation. |
| Portfolio records, decimal accounting, corrections, voids, unknown dates and partial valuations | Working implementation | Source and regression tests; local populated fixture verification follows. No records are migrated for the hostname change. |
| Account/billing states and secure billing portal | Partially implemented operationally | Existing server-controlled contracts; Stripe configuration/commercial release is unavailable. No real charge or portal session is claimed. |
| Paid purchases | Intentionally disabled | Live catalog says subscriptions closed. Free registration conveys no paid entitlement. |
| Market, news and calendar provider adapters | Unavailable operationally | Adapter code exists; licensed commercial sources and credentials are not verified. No sample fallback for provider failure. |
| AI explanations | Partially configured; unavailable operationally | Existing OpenAI integration; last verified production request lacked provider credit. No successful funded response asserted. |
| Brokerage OAuth, supported orders, risk gates | Partially implemented; unconnected | Source/contracts only; no verified brokerage application or callback registration. |
| Live execution / autonomous trading | Intentionally disabled | No enablement in this migration. Consent, subscription, provider, freshness and risk checks remain independent. |
| Company history | Working presentation | Separate NOK company report, definitions and drawdown retained. It is not the user's portfolio, sample return or a promise of future gains. |
| New hostname | Working | Alias, CNAME, HTTPS, bilingual entry, assets, API, public links and old bookmark redirects verified. See final release receipt and 24 read-only hosted checks. |

## Boundaries

No database copy or account recreation, cookie sharing across subdomains, broad CORS permissions, secret rotation, commercial activation or live order is needed for this move. Existing old-host API, signed payment webhook and callback delivery remain available during transition. New-host sign-in is expected because authentication cookies remain host-only.
