# Release verification

## Automated and source checks

- Full suite: **245 passed, 0 failed** on 18 November 2026.
- Localized build: 26 pages generated; diff whitespace checks passed.
- New route tests cover exact production origins, no cross-origin mutations, host-only cookies, language entry, old bookmark/index paths, safe query filtering, account/billing workspace intent, private admin isolation and same-origin callback/data preservation.
- Commerce regressions cover future recurring prices from validated Stripe prices and reject reusing an open checkout for a different tier or interval. These use test adapters, not real payments.
- Executable client harness verifies bounded email/name drafts across auth modes and Norwegian, no credential retention, annual journey intent, expiry clearing, no write replay, rejection of stale in-flight responses and bookmarkable account/billing routes.
- Read-only integration reviews found and fixed two concrete issues: dropped workspace context during host migration and mismatched open checkout reuse.

## Actual browser checks

All private checks used isolated local fixtures on `127.0.0.1:4422`, without loading production keys or contacting external financial services.

| Check | Observed result |
| --- | --- |
| Live baseline `/en/`, `/en/terminal/`, `/en/pricing/`, `/en/portfolio/` | Company homepage, terminal account entry/read-only sample, catalog and guest portfolio observed. |
| Desktop sample before/after | Both contain six KPI cards and all eight lower/main panel headings. Central chart rectangle unchanged: x 521.7625, y 226.3500, width 931.05, height 490 CSS pixels. |
| Reference-sized evidence | Before/after images are exactly 1920 × 1061. Browser viewport was measured at 1920 × 1062 due to browser rounding; captures clip the final bottom pixel. This is not a claim of a measured 1061 CSS-pixel viewport. |
| Annual plans, 1440 × 1000 | USD 96 / year and 288 / year lead, with monthly equivalents and upfront charge. No page overflow. |
| Pro annual → signup → auth modes → Norwegian → pricing | Name draft and year/plan/locale/destination retained; purchases closed and selected/not-active copy present. Email field is privacy-redacted by the browser tooling; exact email retention is established by the executable harness, not by reading a secret field. |
| Local billing deep link | Existing verified fixture signs in to the subscription page; current monthly plan stays distinct from an annual change selection, unknown renewal remains “—”. |
| Security/session controls | Account/security navigation and revoking the current disposable fixture session return to sign-in. No real account or password changed. |
| Failed login | Generic error shown; form remains with draft fields. |
| Recovery | Test email adapter accepted a recovery request; generic conditional wording shown. No claim of inbox delivery. |
| Populated manual Portfolio | 1.5 AAPL, cost USD 150, manual value USD 165, unrealized USD 15. Lot date explicitly unknown; currency and valuation source/time retained. No record edits used to produce the screenshot. |
| Phone 390 × 844, Norwegian sample | All six KPIs visible after fixing legacy responsive hiding; all main/lower panel headings retained, no page-wide overflow. Dense content scrolls normally. |
| Phone 390 × 844, English annual pricing/signup | No page-wide overflow; input font 16px; name/email/password-manager autocomplete present; visible main form buttons at least 44px tall. This is browser viewport testing, not physical-device keyboard verification. |
| Tablet 1024 × 1366 sample | Six KPIs, chart height 440px, no page-wide overflow. |
| Search dialog | Input receives focus, Escape closes, focus returns to search control with solid outline. |
| Accessible chart | Focusable labeled canvas, visible keyboard guide and candle table. ArrowLeft changes the viewed candle range; sample mode remains explicit. |

## Hosting evidence

- Netlify alias added to existing project; existing main domain retained.
- Exactly one CNAME added: `invest` → `vermillion-mousse-5e3749.netlify.app`, TTL 1800.
- Public DNS resolver returned the exact CNAME.
- Netlify certificate UI confirms `invest.nortivo.no, nortivo.no, www.nortivo.no`, renewed 18 November, expires 16 February 2027.
- New HTTPS hostname opens without an interstitial. Before the prepared origin change is deployed, the API correctly reports `INVALID_ORIGIN`; this is recorded as pre-deployment evidence, not a passing application check.
- Old public product links and migration redirect flag remain unchanged until the first investment-host application verification.

## Verification limits

No real payment, invoice, Stripe portal, funded AI response, licensed data/news/calendar connection, broker OAuth or live order was exercised. These remain unavailable or disabled. No new account signup or password change was submitted through the browser. No claim of WCAG certification, screen-reader certification, physical-device testing, 200% browser zoom or an OS reduced-motion toggle test is made. Existing reduced-motion rules were preserved; this release adds no animation. Financial, identity, authorization, entitlement and freshness regressions are covered by the existing and new automated tests.

Publication receipts and final hostname checks are appended after the staged release.
