# Manual portfolio accounting

`netlify/product/portfolio.mjs` is a pure ledger; `portfolio-service.mjs` supplies ownership, access checks, current licensed quotes, FX, atomic persistence and permanent request receipts. Broker positions are never inserted into this ledger.

## Values and records

- Quantity, native-currency price, fees and cash use canonical decimal strings with eight decimal places. Arithmetic uses BigInt fixed point and symmetric half-away rounding. Partial FIFO disposals allocate cost proportionally and retain the exact remainder in the unsold lot.
- An opening position is a disclosed baseline. Its purchase date and cost may be unknown. It never fabricates a historic deposit, cash debit, return or valuation curve. Unknown sold-lot costs make realized gain/loss incomplete.
- Dated buys debit native cash including fees. Sales credit proceeds less fees and use FIFO cost. Deposits and withdrawals are separate from dividend income and trading gain. Negative native cash and short positions are rejected; another currency’s cash does not fund a purchase automatically.
- Instrument ID, venue, asset type and currency are explicit. The same ID cannot change its identity. Manual instruments and valuations are labeled; unavailable or unverified provider prices remain unavailable.
- Corrections and voids append amendments. Originals remain unchanged. Every amended ledger is replayed chronologically and must still satisfy all subsequent cash and position constraints. No historical receipt is discarded to make room.
- Verified splits are entered manually as `new shares / old shares`. Cost remains unchanged. A split that would erase a lot below precision is rejected and needs an explicit cash-in-lieu correction. There is no automatic corporate-action adjustment to double-apply.

## Display and history

Native-currency lot cost, cash and realized gain remain in their original currencies. Display totals use an explicit licensed FX rate and timestamp; missing prices or FX yield a partial/unavailable state and `totalValue:null`. `knownValue` is only the identified display-currency subtotal. Unknown values are never zero.

`displayCostBasis` converts native lot costs at the displayed FX timestamp. `displayUnrealizedPnl` uses that same conversion. They are not historical FX-adjusted investment returns. Per-holding P&L is denominated in the holding currency.

History consists only of complete valuations observed when a change is recorded, with recording time, currency and ledger revision. A later correction does not rewrite earlier observations. Different-currency snapshots must not be joined into one unlabeled curve. Complete dated cash flows and a defined valuation methodology would be needed for an investment-return series; this release does not invent one.

## Boundaries

An account supports up to 20 manual portfolios and 100 identified instruments per portfolio, within the store’s size limits. Historical data remains available at capacity. Ownership is derived from the session. A permanent actor/request digest prevents duplicate transactions; retrying the same request returns current committed state. Read/export survives subscription expiry, while new writes and licensed data access require their server entitlements.

The tests in `tests/product-portfolio.test.mjs` cover fractional FIFO, fees, cash currencies, unknown costs/dates, immutable amendments, splits, missing/stale/incorrect prices, FX, isolation, concurrent retries, creation limits and expiry. These tests use explicit fixtures, not real brokerage accounts or live quotes.
