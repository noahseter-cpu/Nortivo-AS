# Nortivo subscription implementation

Scope: existing product extended in this worktree; stable terminal user UUIDs and all existing stored state survive. US stocks and ETFs are the initial requested coverage. Owner has no new Stripe/data/broker contracts yet. No real-card charges or live orders are test actions. Public paid activation depends on real provider readiness; implementation must not pretend fixtures establish it.

## Work sequence
1. [x] Shared contracts, additive persistence and provider/cost decision matrix.
2. [x] Existing-identity registration, verified email, recovery, password/session management and step-up.
3. [x] Exact two-tier Stripe catalog, Checkout/Portal, signed durable webhooks, reconciliation and feature entitlements.
4. [x] Independent manual portfolio ledger, decimal quantities, currency/FX valuation and honest history.
5. [x] Production data/news/calendar/AI/broker adapters and meaningful provider-state handling. Actual provider connections remain unverified without credentials/contracts.
6. [x] Durable worker, order-intent/reconciliation lifecycle, risk and billing-loss safety controls. Persistent hosting and broker activation remain external dependencies.
7. [x] Bilingual pricing, onboarding, Portfolio, Pro and billing/account interfaces within existing design.
8. [x] Automated financial/security/billing/integration tests and actual local desktop/mobile browser QA; independent review. 212 tests passed. Hosted account persistence, unverified-write denial and real Resend acceptance also passed. Market/payment/broker sandbox checks remain blocked by the documented credentials/contracts, not counted as passed.
9. [ ] Authorized hosted configuration and verified release; exact unresolved external dependencies disclosed.

The complete user brief is retained in SUBSCRIPTION_SPEC.md. This plan is not a claim that external approvals, billing or live brokerage are already active.
