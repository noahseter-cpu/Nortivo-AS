# Subscription application interfaces

The subscription surfaces extend the current Nortivo fonts, charcoal material, silver public actions and green terminal controls. They do not replace the public company site or its historical report.

## Routes and loading

- `/en/pricing/`, `/nb/pricing/`: exact Portfolio/Pro monthly and annual prices, full upfront annual charges, 20% saving, comparison and server-derived purchase readiness.
- `/en/portfolio/`, `/nb/portfolio/`: independent manual portfolio manager, account, authentication and billing workflows.
- `/en/terminal/`, `/nb/terminal/`: dense Pro workspace with selected-instrument chart, watchlist, news/calendar, strategy, account risk, sourced explanation and broker order controls.

Source shells are `dist/pricing/index.html` and `dist/portfolio/index.html`. The root build emits the localized static shells. Runtime strings in `dist/assets/product-client.js` supply both languages. `product-core.js` contains display and navigation helpers, with no ledger calculations or entitlement authority. `product.css` is scoped to the new surfaces. The legacy terminal imports the new module and calls `startProduct()` before starting the old interface. A `PRODUCT_DISABLED`/legacy `NOT_FOUND` response preserves the previous terminal. An unknown connectivity failure fails closed instead of launching an unrestricted engine.

## Authentication and billing

The chosen tier, interval, locale and validated internal destination travel from pricing into account creation. The server retains the journey. Registration replies are generic to avoid disclosing existing accounts. Verification/reset tokens are taken from the fragment, removed from browser history immediately, and consumed only after a deliberate form submission. Signup, signin, verification/resend, recovery, password change, session revocation, authenticator enrollment/confirmation/recovery and sensitive-action confirmation are connected to the existing identity service.

Only snapshot entitlements unlock workspace controls. Checkout return flags display a pending state and trigger bounded server reconciliation; they never grant access. Plan changes require a server charge preview and effective date. A paid upgrade requiring authentication opens the returned secure invoice while preserving the current plan. Cancellation schedules period-end termination; resumption and hosted invoice/payment-method management use the billing APIs. Account deletion records a review request that resolves recurring billing and connected-account consequences before deletion.

## Manual portfolios

The manager supports multiple named portfolios and an independent display currency, explicit supported/manual instrument identity, decimal quantities, opening lots with optional dates and unknown purchase costs, later buys/sells/deposits/withdrawals/dividends/splits, notes and fees. Corrections and voids retain the original audit trail and use server validation. Manual valuations are explicitly dated and labeled. All financial commands send decimal strings; totals, FX, allocation, cost basis and gain/loss come from the server.

Unknown prices and missing FX remain unknown; incomplete totals are disclosed. Native-currency cash and contribution records are shown separately. FX source/timestamp and the use of current FX for display cost basis are disclosed. History uses actual recorded observations with each row's own currency; there is no reconstructed performance curve. Broker-synchronized positions remain in the separate broker view. Corporate actions require a verified manual split/correction when not covered; the interface warns against applying both.

## Terminal and integration truth

The owner reconfirmed the approved terminal image on 18 November. Terminal Pro now uses the original dense application bar/side rail, KPI strip, watchlist/chart/news columns and four lower engine/signal/risk/company-report panels. The subscription account, provider and execution actions remain connected through the current product handlers. Longer research, broker, strategy and record tools have their own terminal views. The system menu retains manual Portfolio, plans, support and language controls.

Instrument choice carries through chart, news and explanation. The original canvas chart and its keyboard/data-table alternatives are reused. Production decimal prices are converted only for chart geometry, using an explicit chart scale; quote and ledger displays retain server decimal strings. Actual quotes refresh at a bounded 30-second cadence while visible and idle, with backoff to 120 seconds, retaining timestamped values on a failure. No random/fake quote changes run.

Read-only fixed sample replay is an explicit separate mode. Its prices/news/events remain labeled fictional, and no sample order/engine commands are exposed. Every sample navigation view stays isolated from real broker, risk, strategy, AI and order actions. Those real-account controls remain available in provider mode under the existing server permissions, including expiry safety controls. The enabled-product backend also rejects legacy sample commands. Production provider failures never select sample data automatically.

The server snapshot separates plan entitlement, provider configuration, commercial permission, authenticated reachability, freshness and broker authorization. The interface distinguishes upgrade, connect, market closed, delayed, stale, unverified and unavailable states. Owner-only operational health/probe controls appear only when the server grants the admin capability.

Strategies are supported daily simple-moving-average crossovers, distinct from the chart's EMA overlays. Research-only saved strategies do not require a broker. Backtests disclose costs and simulation assumptions; market scans show dated evidence. Broker connection, risk limits, order review and automation consent are separate actions. Stop/cancel/reduce/read/direct-broker controls remain available after subscription loss. A durable intent is displayed as pending until the broker confirms status. A timeout never displays a fabricated fill.

The Portfolio feed is scoped to the selected holding or watchlist instrument. Pro can inspect loaded licensed articles by headline and publisher, and events by country, currency and importance. Saved economic-event reminders use the explicitly described in-app channel while this tab is open; they do not claim email, push or background delivery. The server resolves the real event identity and updates saved timing after provider revisions.

## Accessibility and verification

Controls use native forms/selects/checkboxes/details/dialogs with visible labels, written errors, draft retention and show/hide password. Native dialogs provide protected focus and Escape dismissal, with focus recovery. Pricing and manual Portfolio use 44px targets; the restored terminal uses compact desktop controls and 44px mobile targets. The layout reflows into one column on mobile; large data tables remain explicitly scrollable. Quiet 160ms color/border feedback follows existing tokens; reduced motion disables transitions. Financial values do not animate.

Completed locally: syntax checks on all modified JavaScript; 16 direct assertions covering exact-decimal display, unknown values, internal return destinations, plan intent validation, safe external links, escaping and distinct provider states; 17 existing engine/indicator/replay tests; balanced CSS and absence of inline event handlers. These are frontend helper/static and legacy regression checks, not evidence of real payment, email, provider or broker activation. Root owns rendered desktop/mobile, keyboard/reduced-motion and complete server integration QA.

Production readiness remains server-derived and requires real commercial permissions, configuration and independently verified responses. The interface does not sell missing integrations as operational services.
