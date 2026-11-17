# Nortivo Trading Platform interface

The new terminal is a compact operational surface at `/en/terminal/`, `/nb/terminal/` and `/terminal/`. Its source is `dist/terminal/index.html`, `app.css`, `app.js`, `chart.js` and the local licensed icon assets. The root locale builder creates the bilingual HTML entry points. It does not load the marketing header or public homepage styles.

The approved `Nortivo_Approved_Trading_Interface.png` is the composition target: compact top navigation, narrow sidebar, aligned paper-account metrics, watchlist and disclosed trend breadth, dominant candle chart, right news/calendar column and bottom engine/evidence/risk/reported-history panels. Manrope and IBM Plex Mono use the existing local font assets. Green indicates positive values, selection and permitted states; losses remain red and unavailable/limited states remain amber. The chart, engine and report are rendered components, not image hotspots.

## Authoritative state and workflows

- All saved records come from `/.netlify/functions/terminal`. The client has no local paper ledger, fabricated quotes or success fallback. It automatically opens an isolated guest session after an unauthenticated initial request. New guest funds are explicitly virtual USD 100,000.
- Guest access lasts one day through its session cookie; server cleanup retains the guest for seven days. Clearing or losing the cookie loses guest access. Account sign-in opens a separate private account; guest records do not transfer. Email verification and password recovery are visibly unavailable.
- Account creation follows the server's `capabilities.signupEnabled` flag. When disabled, the UI exposes the reason and offers guest access/existing-account sign-in. It never represents a disabled public signup as operational. Available cash subtracts the server's pending-order reservations and the reserved amount is shown separately.
- Symbol selection, watchlist changes/sorting, settings, strategy/risk parameters, alerts and notification read states are server commands. Order review and confirmation reuse one request ID across retries. Pending orders can be cancelled; rejection results expose the actual server risk checks. Fills, positions, fees and CSV export use the server records.
- Hash routes provide real content and browser back/forward behavior: overview, markets, trade, bots, strategy, research, news, calendar, analytics, reports, settings and alerts. Mobile uses content tabs and full views rather than shrinking the desktop canvas.
- The engine is a deterministic EMA example. Start enables one replay advance every four seconds in this tab. Pause/stop clear auto advancement, wait for any pending command and then persist the new engine state. Hiding/leaving the tab sends a best-effort pause; startup always pauses a previously running/starting state. The server independently expires its engine lease. No background trading service is claimed.
- News expansion, category/ticker filtering and original source details work on the disclosed fictional fixture. Selecting news or signal evidence selects the related symbol and highlights the known publication/evaluation timestamp on the chart. Temporal association is explicitly distinct from causation. Fictional news has no invented external original-article link.
- Calendar events use the selected display timezone. The server withholds future actual values. External providers and optional AI remain visibly unavailable until properly configured; real brokerage execution is disabled.

## Chart

The canvas uses the server's known integer-cent candles and completed 1m/5m/15m/1h/4h/1d intervals. No future bars, invented gaps or random movement is added. EMA 9/20 require full warm-up; session VWAP uses raw minute-price/volume observations, resetting at the America/New_York date boundary. Higher timeframe bars use the server's exchange-session aggregation. Latest known values are USD and the display timezone is explicit.

Pointer drag pans, scrolling zooms, Shift+scroll pans, and pointer motion exposes a candle crosshair/readout. Arrow keys pan, +/− zoom and Home/End move to the earliest/latest known range. Native controls expose reset/zoom and expanded-chart mode. A labeled table of the most recent thirty known candles supplies an accessible text alternative. Resizing redraws at the actual device pixel ratio; pan/zoom is retained across replay updates. A new news/signal marker moves the viewport to its known timestamp.

## Metrics and separation

Header metrics describe only the current paper account. Undefined win rate/profit factor remain unavailable until the ledger supplies the needed completed trade history. The NOK 2026 report is fetched separately from `/report-2026/summary.json`; its dates, risk/drawdown and deployed-capital/account-equity bases remain explicit. It never initializes or contributes to the virtual USD account.

## Accessibility and motion

Native buttons/forms, associated labels, visible focus, a skip link, keyboard chart navigation, native modal focus trapping/Escape, status/error live regions and responsive table scroll regions are implemented. Language and timezone are independent. The complete interface copy is English/Bokmål; instrument names and original fictional article titles retain source wording. Dialog transitions use opacity/scale over 180ms; common controls use 160ms color feedback. Frequent navigation and financial figures do not animate. Reduced-motion removes transitions and transforms.

Tabler Icons are official locally bundled outline sources under the MIT license, retained in `dist/terminal/ICONS-LICENSE.txt`; `icons.svg` is assembled without modifying the drawing paths. No CDN or remote font runtime is needed.

The Nortivo symbol and small engine illustration are mechanical crops from the owner's supplied approved interface, stored as `brand-reference.png` and `engine-reference.png`. The logo retains its exact supplied drawing; the engine image is purely decorative and does not claim any actual computation. No fictional headline, price, performance metric or other source-image data is embedded in the functional interface.

## Verification scope

`node --check dist/terminal/app.js` and `node --check dist/terminal/chart.js` check module syntax. The parent implementation task owns actual browser verification/captures at desktop/laptop/mobile widths and the integration/engine tests documented in `TERMINAL_ENGINE.md` and `TERMINAL_SERVER.md`. Hardware touch behavior, paid data entitlements, configured live providers and real brokerage execution are not validated by interface syntax checks.

Local Node checks were also executed against all five authoritative initial sample instruments: EMA 9/20 agreement with the server and null warm-up, raw-minute session VWAP agreement/reset, aggregation chronology, absence of CSP-blocked inline style attributes, semantic native risk progress values, reserved-cash source selection, signup capability gating, typed signal value presentation, Bokmål error messages and reduced-motion declarations. These checks passed. The mechanical visual detector was run once; its color/type/radius advisories compare this approved green terminal with the public site's separate silver marketing tokens. The approved reference explicitly governs the terminal palette and density.
