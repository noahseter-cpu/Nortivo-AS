# Trading platform design verification

Date: 17 November 2026. Scope: the new terminal and its homepage/report connections. This does not replace the existing public-site design.

## Visual evidence

- Source truth: `C:/Users/noahn/Downloads/Nortivo_Approved_Trading_Interface.png` (1672 × 941 pixels).
- Rendered application: `http://127.0.0.1:4420/en/terminal/`.
- Final captures: `.impeccable/review/terminal/terminal-final-1672.jpg`, `terminal-final-1920.jpg`, `terminal-final-1440.jpg`, `terminal-final-1024.jpg`, and `terminal-final-mobile.jpg`.
- Same-input full comparison: `.impeccable/review/terminal/comparison-full.png`, source on the left and actual application on the right.
- Focused typography/watchlist comparison: `.impeccable/review/terminal/comparison-detail.png`. This was needed because dense labels are difficult to judge in the full comparison.
- Public product capture: `dist/assets/trading-platform-1920.jpg`; optimized 1440px variant: `dist/assets/trading-platform-1440.jpg`.

CSS viewports tested were 1920 × 1080, 1672 × 941 (reported inner height 942), 1440 × 900, 1024 × 768 and 390 × 844. Device pixel ratio was approximately 1. Native IAB captures exclude the scrollbar/window gutter: respectively 1920 × 1061, 1662 × 935, 1430 × 894, 1014 × 761 and 380 × 822. Comparisons retain 1:1 content pixels and treat the missing right/bottom gutter as crop, without rescaling the interface. The wide capture includes the full operational composition.

State: English guest workspace, fixed fictional sample at 16 November 2026 16:30 UTC, virtual USD 100,000, stopped example engine and empty personal trading metrics. Source-image quotes, headlines, AI claims and invented personal returns are intentionally replaced by the implemented data/state, as required by the brief. Nortivo's NOK historical report is separate.

## Comparison history

1. Initial functional render: the main chart was excessively tall at the reference viewport; risk meters incorrectly depended on CSP-blocked inline styles; evidence prices displayed raw cents. Fixed the desktop grid height, used semantic progress elements, formatted typed price/volume evidence, and added completed-candle timestamps/session boundaries. Actual source-logo and engine-art crops replaced approximations.
2. Independent finish review returned `fix`: operational metadata was too small, mobile targets were below 44px, chart density remained fixed at 90 candles, and panel depth was insufficient. Raised metadata to 11–12px, retained 13px body text, provided 44px mobile targets, implemented responsive 34/56/64/78 candle defaults with preserved user zoom, and strengthened scoped charcoal surfaces/selective green illumination.
3. Corrected two fix-batch regressions: mobile tabs now retain intrinsic width and scroll horizontally, and desktop watchlist padding allows all five rows to remain visible. Replaced the same screenshot paths and repeated the paired comparison. Independent verdict: all four material findings resolved, no visible regressions, `disposition: ship`.

## Required fidelity surfaces

- Typography: existing Manrope and IBM Plex Mono retained; operational labels/metadata are readable and financial quantities keep a stable hierarchy. The implementation deliberately uses real empty-state metrics instead of the reference's populated claims.
- Layout: compact top bar/sidebar, KPI strip, left watchlist/trend, central chart, right news/calendar and four bottom panels retained. Narrow layouts use task views and horizontally scrolling controls.
- Color: scoped charcoal/green system preserves restrained depth. Negative values/candles remain red; limitations remain amber.
- Assets: supplied logo and engine illustration are real raster crops with documented provenance; Tabler drawing assets and MIT license are retained. Chart content is rendered from the actual known fixture, not a screenshot.
- Content: visible sample provenance, paper execution, in-tab lifecycle and USD currency remain distinct from reported historical NOK values. The homepage +2.40% label includes the deployed-capital basis and full report/risk link.

## Functional browser evidence

Tested symbol search/selection, timeframe and indicator persistence, keyboard pan/zoom/reset, news-to-chart timing, signal evidence, engine start/pause, alerts and notification read state, language/timezone changes, signup/logout/login restoration, order review/confirmation, next-bar fills, fees, exits, ledger/CSV export, server risk rejection and homepage preview Escape/focus restoration. A three-share buy/sell workflow reconciled USD 2.00 fees and USD -2.39 realized P&L to USD 99,997.61 cash. This is a fictional test, not company performance.

Homepage desktop/mobile navigation, localized report cross-link, actual preview image and visible +2.40% basis were checked. The full report retains maximum drawdown, both return bases, losing months, dates and original downloads. All 125 automated checks passed after the final source changes. The final app session has no application script errors; an earlier marketing-to-app navigation emitted a browser-native view-transition opt-out notice. Reduced-motion removal is checked in source; physical touch hardware and external feeds were not tested.

## Remaining scope limits

External quotes/news/calendar require credentials and documented display entitlements. AI summaries and real brokerage are unavailable. Hosted account creation defaults off pending the documented owner-controlled activation/verification boundary. Hosted release checks are recorded separately from this local visual acceptance.

Production follow-through: the actual Netlify preview and production domain passed the hosted isolation, security, concurrent state, next-bar fill, ledger and export checks. The published Norwegian interface was opened in the browser with no console warnings/errors. See `docs/TRADING_PLATFORM_RELEASE.md`; the final production screenshot is `.impeccable/review/terminal/published-terminal-nb.jpg`.

final result: passed
