# Product refinement — 18 November 2026

## Scope and authority

The approved homepage black-and-ivory identity now governs the application. The complete owner brief is preserved in `PRODUCT_REFINEMENT_SPEC.md`. The previous green-charcoal reference remains in Git history.

## Implementation inventory

- Shared semantic product tokens, text-only Nortivo wordmark, neutral selection and ivory primary controls.
- Terminal top bar, grouped side rail, persistent data/execution context and Overview-only account KPIs.
- Distinct Overview, Trade, Bots, Strategies, Research, News, Calendar, Analytics, Reports and Settings layouts.
- Instrument-scoped search, contextual research, genuine indicator controls, chart viewport preservation and accessible chart data.
- Portfolio holdings, cash, transactions, allocation, history, manual-entry forms and onboarding.
- Pricing, account entry, sign-in/registration, verification/recovery, account, billing/MFA, connections and overlays.
- Company NOK report separated from account/sample USD records. No metric, date, period, price, entitlement or backend calculation changes.

## Verification plan

Inspect the implemented product at 1440, 1280, 768 and 390px. Use the public read-only sample and existing isolated paid test accounts. Check navigation, instrument/timeframe selection, zoom/data/expansion, contextual research, account forms, manual portfolio records and unavailable-provider/plan distinctions. No real trades, broker connections or automation are design tests.

Capture actual before/after desktop and phone views, refresh the homepage preview from the finished read-only application and verify the published Netlify source. Record results below after final checks.

## Automated checks

Initial full suite: 229 passed, 0 failed. Five new substantive regressions cover unavailable provider versus plan display precedence and chart viewport restoration across remounts, instruments, resolutions, event focus and responsive candle density.

## Browser and release results

- Final full suite: 229 passed, 0 failed. Syntax checks and locale build passed. Locale-dictionary consistency caught a stale embedded translation and passed after synchronization.
- Browser checked fixed sample plus isolated verified Pro and Portfolio accounts. All ten terminal workspaces and Settings remain reachable; secondary views do not repeat the six KPIs.
- Checked 1440, 1280, 768 and 390px. Document width equals viewport content width at every size; wide tables stay inside their own labelled, keyboard-focusable scroll regions.
- Chart search selected AAPL, 15m and VWAP; the accessible data view contained 20 actual candle rows. Explicit zoom changed 56 to 41 candles and survived News → Overview and Connections open/close. Expansion keeps its state and changes its accessible label.
- Account return retains Terminal Pro or Portfolio origin. Native dialog focus stays contained, Escape closes, and focus returns to Connections. Reduced-motion media rules disable transitions; native hardware touch/keyboard overlays were not emulated.
- Portfolio preserved a 1.5-share holding with unknown purchase date. A decimal manual valuation was saved and restored using only the isolated fixture. Missing/future observations were rejected; recorded history contains only real fixture observations.
- Actual unavailable providers remain labelled unavailable, separately from plan inclusion. No external account, broker, order, automation or live data state was created by these checks.
- The mechanical design detector ran once after implementation: 76 advisories and 10 warnings. All warnings were on the intentionally preserved marketing homepage (existing typography, spacing and decorative shadow); no warning was reported on the refined application. Shared product token/type advisories reflect the deliberate application ramp and semantic aliases. Dialog depth is intentional.
- Homepage preview JPEGs are real 1430×790 and 1910×1055 image captures (1440px and 1920px browser viewports) of the public read-only sample, with truthful bilingual captions. Its overall composition and report data were preserved.

Local visual evidence (ignored private QA directory): `refinement-before-desktop.jpg`, `refinement-after-desktop.jpg`, `refinement-before-mobile.jpg`, `refinement-after-mobile.jpg`, `refinement-768.jpg`, `refinement-1280.jpg`, `refinement-after-portfolio.jpg`, `refinement-portfolio-mobile.jpg`, `refinement-reports.jpg`.

Production deployment verification pending.

## Limits

Paid tools and provider adapters were checked with isolated local fixture accounts; real billing, licensed feeds, live AI responses, brokerage and production automation remain dependent on their actual service activation. Production paid purchasing and real-money execution were not enabled by this design release. Existing OpenAI credit exhaustion is separate from the interface and was not retested with paid calls.
