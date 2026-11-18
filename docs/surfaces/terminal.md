# Terminal surface brief

Operational surface for `/terminal/`; it does not establish public marketing behaviour or availability claims. The original replay implementation below remains the compatibility contract when the subscription product is disabled. The enabled subscription extension is described in `docs/SUBSCRIPTION_UI.md` and governed by `docs/SUBSCRIPTION_SPEC.md`.

## Mode

Operate — a connected paper-trading workbench for reading disclosed replay data, checking risk evidence, creating paper orders, and reviewing the server-backed ledger.

## Direction contract

- **THESIS:** Connected paper-trading workbench.
- **OWN-WORLD:** User-pinned green-charcoal premium terminal, governed by `Nortivo_Approved_Trading_Interface.png`; do not transplant this palette into the public black/silver/titanium marketing system.
- **STORY:** Markets → news and signal evidence → risk → paper orders → ledger.
- **FIRST VIEWPORT:** Exact sequence is top shell, KPI/watch/trend strip, central chart, right news and calendar, then the four bottom panels: engine, signal evidence, risk and reported history.
- **FORM:** The approved image is pinned reference only; it is not a seed or a composition-approval gate. Implemented native controls, chart and panels carry the interaction.
- **RISK:** The replay and news are fictional fixtures; orders are current paper records in the user/guest server ledger. The USD paper account and the fetched NOK reported history are separate ledgers and historical contexts. Do not claim live brokerage, live provider data, or future results.

## Development boundaries

### Subscription terminal restoration — 18 November 2026

The owner reconfirmed `Nortivo_Approved_Trading_Interface.png` after the subscription release. The enabled Terminal Pro must retain this same visual contract: a compact application bar and side rail, KPI strip, watchlist/chart/news three-column work area and engine/signal/risk/reported-history lower row. Subscription work extends those controls and their real state; it does not replace the terminal with the Portfolio page composition.

Pricing and manual Portfolio remain separate surfaces. Account, language and plan links remain reachable from the terminal. Production account/market/signal values are shown only when supplied by the relevant current server context. Missing values stay unavailable inside the intended panel. The explicitly selected fixed sample can populate the workbench for inspection, with read-only and fictional-data disclosure. Company history belongs in its own report panel and never initializes a customer balance or signal.

The chart needs its accessible recent-candle table, visible control alternatives and its responsive 34/56/64/78-bar presentation. On mobile, content views replace the compressed desktop canvas and touch controls retain 44px minimum targets. Keep color paired with labels and status text. Use 160ms control feedback and 180ms dialog/toast feedback; remove terminal transforms/transitions for reduced motion.

## Evidence and recovery

Saved terminal state is server-authoritative. Surface failures must expose the actual response/error and keep the retry path visible; no local success or quote fallback is allowed. Guest history is distinct from signed-in history, so a transition to an account must not imply transfer. This brief records UI scope only; provider configuration, paid entitlements, hardware touch behaviour and brokerage execution require environment-level validation.
