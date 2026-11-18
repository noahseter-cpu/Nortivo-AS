# Release verification

## Automated and source checks

- Initial migration suite: **245 passed, 0 failed** on 18 November 2026. Final link-cutover suite is recorded in the publication receipt below.
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
- Stage-one deploy `6afdf10c93e62190914c4496`, commit `81345e7`, published successfully in 17 seconds.
- On that deployment, investment root with `lang=nb` resolved to `/nb/terminal/`; English switching, six sample KPIs, chart, report data, annual pricing and Pro/year signup intent all worked on the actual HTTPS hostname. No real account was created.
- Only after those checks, production `TERMINAL_ORIGIN` was changed to `https://invest.nortivo.no` and production-only `PRODUCT_PLATFORM_MIGRATION_READY=true` was saved. Other context values were retained. These non-secret settings use All scopes because this project's UI does not allow narrower scope selection.

## Verification limits

No real payment, invoice, Stripe portal, funded AI response, licensed data/news/calendar connection, broker OAuth or live order was exercised. These remain unavailable or disabled. No new account signup or password change was submitted through the browser. No claim of WCAG certification, screen-reader certification, physical-device testing, 200% browser zoom or an OS reduced-motion toggle test is made. Existing reduced-motion rules were preserved; this release adds no animation. Financial, identity, authorization, entitlement and freshness regressions are covered by the existing and new automated tests.

## Final publication receipt

- **Published** to the existing Netlify production project. Production code commit: `1b87184`.
- Final deploy: `6afdf2adeada72708f837a4f`, 18 November 2026 at 19:47 Europe/Oslo; Netlify reported successful publication in 18 seconds, with 13 functions and one edge function deployed.
- Live entry: https://invest.nortivo.no/ ; English: https://invest.nortivo.no/en/terminal/ ; Norwegian: https://invest.nortivo.no/nb/terminal/ . Company homepage stays at https://nortivo.no/ .
- Final full test suite: **248 passed, zero failed**. An old restaurant/navigation assertion was updated to the required investment destination after the locale build exposed it; no application failure was hidden.
- **24 read-only hosted checks passed**, recorded in `hosted-checks.json`: both languages, new roots, company home separation, old annual pricing and account/index bookmarks, retained safe workspace context, company destinations, six isolated admin endpoints, four same-origin assets/data files, and public API catalogs on both hosts. These requests create no account, session or financial record.
- Browser confirmed old Norwegian pricing bookmark redirects to the investment host with Pro/year and intended terminal destination retained. Browser confirmed company navigation links point directly to the investment host in English and after switching to Norwegian.
- A synthetic verification fragment reached the investment confirmation screen through an old company-host URL. The existing client then removed the fragment from the address bar before submission, as designed. No real verification token was used or submitted.
- Final live sample screenshot measured all six KPIs and exactly the same central chart rectangle as the baseline (931.05 × 490px). `live-invest-terminal-1920.jpg` is the published result, not a mockup. No page-wide overflow at the measured desktop viewport.
- `netlify-final-deploy.jpg` and `netlify-invest-https.jpg` provide publication/certificate evidence. Before/after captures and phone/tablet captures are included alongside this receipt.
- Temporary browser test tabs were closed and the live platform left open. Viewport override was reset. Local preview remains available at http://127.0.0.1:4422/en/terminal/ with isolated test data and no production keys.

No production database record migration, commercial enablement or real-money action was performed. The hostname uses the same backend and records; host-only cookies intentionally require a new sign-in. External service and private-flow limits above remain applicable.
