# Nortivo subscription release review

Reviewed 2026-11-18 against `docs/SUBSCRIPTION_SPEC.md` and `docs/SUBSCRIPTION_CONTRACT.md`.

## Scope

Independent release-blocking review of account authentication and MFA, Stripe billing and durable entitlements, product-store CAS/RLS boundaries, private portfolio and AI quota isolation, broker authorization, order reconciliation, execution fencing, expiry behavior and the persistent worker. Existing public pages, support, report data and legacy account/history paths were included as regression boundaries.

## Confirmed blockers found and resolved

- **Canceled customers could be trapped or double charged on resubscription.** A completed historical Checkout session permanently blocked a new checkout, while a canceled Stripe subscription with still-valid purchased access could alternatively start a second charge. `netlify/product/billing.mjs` now scans the complete canonical customer subscription history, replaces a completed checkout only when its exact subscription is canceled/expired, and blocks checkout while `paidUntil` remains valid. Regression coverage is in `tests/product-commerce.test.mjs`.
- **Risk-reducing orders were blocked by unrelated ambiguous work.** `netlify/product/execution.mjs` now scopes the unresolved-order fence to the brokerage account and permits an unrelated verified reduction, while still blocking a same-account/same-symbol unresolved sell that could create a short position.
- **Order risk settings could change after validation but before transmission.** The pre-submit path now verifies the exact post-CAS broker-connection version before any broker POST. A concurrent risk/consent change rejects the intent without transmission.
- **Incomplete broker order snapshots could understate reservations.** A maximum-size open-order page now fails closed. Nested protective legs are flattened, bounded, deduplicated by broker ID, validated for conflicting representations and included in reducible-quantity checks; terminal child legs reserve nothing.
- **Strategy changes could leave old automation active.** Strategy writes now atomically persist a permanent idempotency receipt and stop matching old/new connection bindings. Moving a strategy disables the old connection in the same transaction; queued old-version entries fail closed. Owner-only strategy reads remain available after expiry.
- **Broker reconnection could duplicate one account.** Reauthorization reuses the existing owner-bound broker connection, resets live consent and automation, and retains one account binding.
- **Large retained histories could hide unresolved work.** Internal ordered cursor pagination now scans beyond the first 1,000 records. The additive Supabase cursor function and owner isolation were exercised in an actual PostgreSQL transaction and rolled back cleanly.
- **Worker failures lacked account attribution.** Private worker logs now retain only a validated internal owner UUID plus a sanitized error code, while the customer-facing/admin account view labels its unresolved-order scope explicitly. Emails, tokens, positions and provider bodies remain excluded from logs.

## Validation

- Full local Node test suite: **209 passing, 0 failing** after the fixes above.
- Focused commerce tests cover exact prices, readiness fail-closed behavior, signed webhooks, customer/subscription ownership, concurrent checkout, canceled resubscription, subscription pagination, paid-upgrade failure, scheduled downgrade, lost responses and expiry.
- Focused execution tests cover leases, partial/out-of-order fills, ambiguous POST outcomes, restart reconciliation without resubmission, entitlement loss, unrelated versus conflicting unresolved orders, malformed quantities, post-validation risk changes, full broker pages, and nested protective legs.
- Portfolio tests cover private owner binding, immutable accounting history, exact fixed-point arithmetic, concurrent count bounds, stale/future quote and FX rejection, retained reads/export and blocked expired writes.
- Authentication tests cover existing-account preservation, generic recovery, single-use tokens, session revocation, encrypted MFA secrets, replay rejection and expiring step-up sessions.
- Store tests cover owner immutability, atomic multi-record CAS, tombstone/ABA behavior, storage bounds and AI quota reservation/settlement.

## Ship verdict and residual risk

**Code-path verdict:** no known release-blocking entitlement bypass, cross-customer data exposure, duplicate-charge path or unsafe order retry remains in the reviewed implementation.

**Activation verdict:** keep checkout and real-money/live execution disabled. No provider/broker commercial contracts, production credentials, verified price catalog, signed live-release evidence or successful production readiness probes are present. The backend deliberately fails closed when these are absent; this is an external launch gate, not a claim that paid/live service is ready.

Before paid activation, verify the exact Stripe API/account configuration and webhook delivery in test mode, run successful authenticated provider probes under documented display/non-display/AI rights, confirm the persistent worker heartbeat and per-account failure diagnostics, apply the additive SQL migration with backup/rollback evidence, and complete a paper-broker end-to-end order/reconciliation drill. Before live activation, additionally require current signed global and per-account release evidence, country eligibility, owner consent/MFA and a controlled canary with direct-broker rollback instructions.

Residual runtime risk remains in third-party behavior that local fixtures cannot prove: Stripe API-version semantics, provider payload changes/quotas, broker OAuth/account eligibility, actual network timeouts, and worker/database availability. These are guarded by fail-closed paths and require environment verification rather than further frontend changes.
