# Nortivo Trading Platform release record

## Candidate prepared on 17 November 2026

The approved green/charcoal application is implemented at `/en/terminal/` and `/nb/terminal/`. The homepage uses an actual rendered application screenshot with an accessible enlargement and separate application link. Navigation and the historical report link to the platform. The homepage average-session headline comes from the unchanged shared report summary and visibly identifies deployed capital; full historical risk remains available.

The functional release is a fixed fictional stock replay with virtual USD 100,000 paper accounts. Server-owned rules, chronology, orders, fees, FIFO positions, exact-cent ledger, risk, alerts, idempotent command receipts and persistence are implemented. It is not connected to real-money brokerage. Optional provider adapters are not configured or purchased.

## Verification

- `node scripts/build-locales.mjs`: succeeds; existing pages plus both terminal entry points generated.
- `node --test tests/*.test.mjs`: 125 passed, zero failed.
- Independent security review: five concrete findings fixed and re-reviewed; no remaining local P0/P1/security blocker confirmed.
- Independent visual finish review: `disposition: ship`; see `design-qa.md` for comparison history and actual browser evidence.
- Existing Supabase project was paused. It was resumed on the free plan before activation.
- Additive `supabase/terminal.sql` migrations 1/2 executed successfully in that existing project. Six terminal tables have enabled/forced RLS; `anon` and `authenticated` have no direct read permission. All three private RPCs use invoker security and deny execution to those browser roles while allowing `service_role`.
- `TERMINAL_ORIGIN` and the separate private request-protection key are configured in Netlify. Existing support/admin keys were not exposed or changed. Hosted signup remains disabled by default.

This candidate record precedes hosted application smoke testing and production publication. The final deployment IDs and hosted results are appended after those checks, rather than inferred from local tests.

## Published and verified

- Pull request: https://github.com/noahseter-cpu/Nortivo-AS/pull/1, merged after hosted preview checks.
- Runtime commit: `34a9231b5e859d2c7faca991c1bba827e40a2150`.
- Netlify production deployment: `6afcd8ea87b9b4869cb629b2`; the dashboard explicitly shows Published for that commit.
- Live application: https://nortivo.no/nb/terminal/ and https://nortivo.no/en/terminal/.
- Preview: https://deploy-preview-1--vermillion-mousse-5e3749.netlify.app.
- `node scripts/check-terminal-hosted.mjs <origin>` passed against both the actual Netlify preview and `https://nortivo.no`. It verified two isolated hosted guest workspaces, Secure/HttpOnly/SameSite cookies, CSRF/origin rejection, concurrent PostgreSQL updates, one order/fill under duplicate submission, exact fee/ledger reconciliation, cross-owner cancellation rejection, private CSV, disabled real brokerage and independent logout revocation. No credentials or private session identifiers are printed.
- Production browser verification opened the new homepage showcase, enlarged the real image, followed the localized platform link and loaded the actual server-backed Norwegian workspace. The final application console had no warnings/errors. The browser tab was left open as the deliverable.
- Actual production screenshot: `.impeccable/review/terminal/published-terminal-nb.jpg`. Homepage evidence: `.impeccable/review/terminal/published-homepage-preview.jpg`.

The first preview correctly rejected its unconfigured origin. The exact preview origin was then configured in its Netlify context and a new preview built before merging. Production retains `https://nortivo.no`; no origin checks were weakened.

The follow-up documentation commit uses Netlify's documented `[skip netlify]` marker to retain this evidence without spending another deployment on documentation-only changes: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#skip-a-deploy. The live runtime remains the verified commit above.

## Setup and boundaries

See `TERMINAL_SERVER.md` for configuration/retention, `TERMINAL_ENGINE.md` for fill/accounting assumptions, `TERMINAL_UI.md` for interface behavior and `TRADING_PLATFORM_CONTRACT.md` for the shared API. The complete local application remains available with `node scripts/serve-terminal.mjs --port 4420` on Node 24 or newer. Local persistence files and deployment secrets are ignored by Git.

Real email delivery, provider entitlements/connectivity and brokerage readiness are separate integrations. The in-tab replay pauses when hidden or disconnected and has no persistent background trading worker. Guest access lasts one day; guest records expire after seven days. Registered account records are separate, and email verification/recovery is not implemented in this release.
