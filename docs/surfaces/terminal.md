# Terminal surface brief

Development-only operational surface for `/terminal/`; it does not establish public marketing behaviour or availability claims.

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

The chart needs its accessible recent-candle table, visible control alternatives and its responsive 34/56/64/78-bar presentation. On mobile, content views replace the compressed desktop canvas and touch controls retain 44px minimum targets. Keep color paired with labels and status text. Use 160ms control feedback and 180ms dialog/toast feedback; remove terminal transforms/transitions for reduced motion.

## Evidence and recovery

Saved terminal state is server-authoritative. Surface failures must expose the actual response/error and keep the retry path visible; no local success or quote fallback is allowed. Guest history is distinct from signed-in history, so a transition to an account must not imply transfer. This brief records UI scope only; provider configuration, paid entitlements, hardware touch behaviour and brokerage execution require environment-level validation.
