# Subscription implementation — 18 November 2026

## Release boundary

The existing Nortivo project now contains Portfolio and Terminal Pro, with four exact USD prices, bilingual account/workspace/billing interfaces, an independent manual ledger, production provider adapters and a persistent execution worker. Public report/support/company pages and the original account IDs and paper history remain separate.

The reviewed release may expose registration and the new interface. **Purchases and real-money execution remain closed.** Nortivo has no new provider/merchant agreements or API credentials for this scope. An installed adapter, placeholder or passing fixture is not a verified production service.

## Verification completed

- Independent code review: `docs/qa/SUBSCRIPTION_REVIEW.md`; full suite **209 passed, zero failed**. It includes financial, auth, billing, webhook, isolation, quota, order lifecycle, worker recovery and safety-control regressions. Upstream responses are explicitly mocked in those integration tests.
- Browser, isolated local server: annual Portfolio selection → free signup → captured local verification link → deliberate confirmation → sign-in → preserved annual choice. No real email was sent by the local fixture.
- Browser, local paid fixtures: both workspaces, explicit sample/production separation, an undated fractional NOK holding, unavailable prices/FX, immutable void and restored complete USD valuation. The fixture entitlements and holdings exist only in an ignored local SQLite database; they were not copied to Supabase.
- Responsive browser checks at 390×844: pricing, Portfolio and Pro; no document-wide horizontal overflow. Tables/navigation can scroll within their own containers. English/Norwegian switching and annual totals inspected. Native dialog Tab/Escape returned focus to its trigger. The OS reduced-motion preference was off; the reduced-motion stylesheet was inspected, not claimed as an exercised OS setting.
- Static UI detector: zero anti-pattern failures; advisory differences refer to the older marketing design tokens. This is not an accessibility certification or design score.
- Real Supabase PostgreSQL: reviewed migration compiled and ran inside rollback transactions. Create/stale/multi-record CAS, owner isolation, tombstone versioning, cursor pagination and public-role denial passed; rollback left the original schema unchanged.
- Applied additive `supabase/product.sql` to the existing project. Schema version **3**; original **8 users, 8 states and 12 receipts** remained. The new table contained zero rows after migration, and anonymous SELECT was denied. No account/password/history conversion or reset occurred.
- Netlify `PRODUCT_ENABLED=true` saved for the next deployment. Existing secret values were not revealed or changed. Purchasability remains server-gated by missing verified services and merchant configuration.
- Candidate secret-pattern scan found no private-key or live API-key material. Local fixture files and `.env.local` are ignored.

Hosted candidate/production checks and final revision are recorded below when completed.

## Activation dependencies

| Capability | Implemented | Required before enabling paid use |
| --- | --- | --- |
| Accounts/email | Existing identity, verification/recovery, session revocation, TOTP and step-up | Existing Resend sender/key reused; verify an actual owner-controlled delivery. Configure the separate encryption key before MFA activation. |
| Billing | Stripe SDK, exact prices, Checkout/Portal, raw signed webhooks, canonical paid access, pending upgrades/scheduled changes | Merchant account, all four actual recurring price IDs, webhook secret, portal and real sandbox payment/lifecycle validation. No real card charge was made. |
| Manual portfolio | Decimal ledger, FIFO, native-currency cash, corrections/voids, manual values, FX/partial states, observed snapshots | Already fixture-tested; paid writing still needs a legitimate paid entitlement. Current prices/FX require their commercial feeds. |
| Market/news/calendar | Twelve Data/Finnhub/Trading Economics server adapters, rights/freshness/caching/metering, in-app reminders | Business contracts and exact display/non-display/storage/AI/exchange permissions, credentials and authenticated probes. US stocks/ETFs first; no universal coverage claim. |
| AI | OpenAI Responses, grounded evidence, isolated context and atomic monthly quotas | Secure project key setup did not complete because its picker was not visible. Obtain a key through a functioning secure setup, configure budget and verify a real response. Portfolio 30/month; Pro 200/month, with separate token caps. |
| Broker/automation | Encrypted delegated OAuth, separate paper/live targets, durable intents/reconciliation/fencing, strategy tools, risk controls | Alpaca commercial/live approval and Norwegian/customer-country eligibility, credentials, signed app/account release evidence, MFA/consent, paper sandbox validation, persistent worker hosting and live health evidence. |

Exact provider choices, sources, unpriced commercial gaps, request-volume assumptions and current cost estimates are in `PROVIDER_DECISIONS.md`; secure configuration locations and worker launch controls are in `PROVIDER_SETUP.md`, `IDENTITY_BILLING_SETUP.md` and the placeholder environment examples. The requested USD10/USD30 prices are unchanged. No extra trial, discount or overage charge was invented.

## Rollback

Set `PRODUCT_ENABLED=false` in the relevant Netlify context and redeploy to restore the legacy terminal path. If necessary, restore the prior published deploy through Netlify. Leave additive database tables and private records intact; do not drop financial receipts, account records or broker audit history. Live transmission is independently off and must remain so until its full release gates pass. A billing rollback never liquidates positions or cancels protective broker orders.

One obsolete local fixture directory with an encoded-space path remains outside the worktree because automatic approval review rejected its deletion. It contains disposable test data only and is not a publication candidate.
