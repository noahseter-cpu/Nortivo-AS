## Objective

Work in my existing Nortivo project and turn the current terminal into a functioning subscription product.

Implement public registration, two paid plans, live market data, licensed news, an economic calendar, AI explanations and supported real-money brokerage integration. The entry plan is a manual portfolio manager. The higher plan is the full trading terminal with advanced analysis and automation.

Preserve the current premium Nortivo design, investment-company identity, report showcase, existing accounts and working application. Extend the current product rather than replacing it with a generic dashboard. Complete the implementation and meaningful tests; a pricing mockup or changed availability label is not completion.

Review:

- [Nortivo website](https://nortivo.no/en/)
- [Existing trading terminal](https://nortivo.no/en/terminal/)
- [Current privacy information](https://nortivo.no/en/privacy/)

This specification supersedes the earlier single-plan, paper-only subscription scope.

## 1. Inspect and preserve the existing project

Read project instructions, repository structure, deployment configuration, database migrations, account/session code, terminal APIs and engine execution before editing.

The reviewed public version had closed registration, unconnected email verification/recovery, fictional sample replay, browser-tab-dependent execution, and unavailable market data, news, calendar, brokerage and AI integrations. Its privacy page identified Netlify, Supabase and Resend. Reconfirm all of this against the current code; public observations are not a backend security audit.

Reuse suitable infrastructure and stable user IDs. Do not assume Supabase Auth is installed merely because Supabase stores data. Avoid disconnected authentication systems and unnecessary framework migrations.

Preserve accounts, watchlists, strategies, ledgers and report links. Do not invent subscriptions for existing users or charge them automatically. Keep sample replay as an explicitly labeled demo/test mode, separate from production data and live accounts.

Create a short implementation plan, then work through the complete scope.

## 2. Exact plans and prices

Use these customer-facing names unless an established Nortivo naming system requires a small adjustment:

| Plan | Monthly charge | Annual charge | Annual display | Annual savings |
| --- | --- | --- | --- | --- |
| Nortivo Portfolio | USD 10/month | USD 96/year | $8/month equivalent, billed $96 annually | $24; 20% |
| Nortivo Terminal Pro | USD 30/month | USD 288/year | $24/month equivalent, billed $288 annually | $72; 20% |

Apply the requested 20% annual discount to both plans. Treat tier and billing interval as separate choices. Monthly and annual customers within the same tier receive the same features.

Configure four recurring prices: **1000 cents monthly, 9600 cents annually, 3000 cents monthly and 28800 cents annually**, all USD. Annual prices already include the discount; do not add another 20% coupon.

Show the full upfront annual charge prominently. Registration is free, but neither paid plan has a free trial unless separately requested. Do not invent extra tiers, setup charges, usage overage charges or promotional discounts.

Keep marketing, checkout, receipts and account billing consistent. Use actual merchant tax settings and clearly disclose applicable taxes and any separate broker/exchange charges. Do not invent tax, refund or fee policies.

## 3. Define the plan differences clearly

| Capability | Portfolio — $10/month | Terminal Pro — $30/month |
| --- | --- | --- |
| Manually entered holdings and transactions | Included | Included |
| Accurate valuations using licensed current prices | Included | Included |
| Allocation, cost basis, cash and portfolio history | Core tools | Core tools plus advanced analysis |
| Watchlist, relevant news and economic events | Core portfolio views | Full terminal views and filters |
| AI assistance | Limited, user-triggered basic explanations | Advanced sourced explanations and research; higher allowance |
| Strategy tools, backtesting and market-wide scans | Not included | Included where supported and verified |
| Automated trading engine | Not included | Included |
| Broker connection and automatic position sync | Not included | Included for supported accounts |
| Manual live orders and automated live execution | Not included | Included after broker authorization and explicit user enablement |

Pro includes Portfolio’s features. The Portfolio customer manually enters their holdings; they do not need a broker connection or API key.

The lower price means fewer analytical features, smaller AI workloads and no automation. Both plans must have accurate calculations, honest data freshness, normal application speed and reliable security. Do not deliberately make Portfolio inaccurate or slow. Do not promise that Pro produces higher returns or better investment outcomes.

Define feature entitlements and actual AI quotas on the server. Explain limits clearly; do not advertise unlimited AI, universal market coverage or services that are not operational.

## 4. Build a genuinely useful manual portfolio manager

The Portfolio landing screen should feel complete and purposeful, not like a disabled Pro terminal.

Allow users to create a portfolio, choose its display currency, search supported instruments and manually add:

- Instrument, exchange/venue, trading currency and asset type.
- Quantity, average purchase cost or individual purchase lots.
- Purchase date when known, fees, cash balance and optional notes.
- Later buys, sells, deposits, withdrawals and dividends.

Use a validated transaction ledger or clearly identified opening-position records. Support correction and deletion without silently corrupting history. Do not require an invented purchase date for an existing holding. A CSV import may complement manual entry if implemented with validation, duplicate detection and an import preview.

Show current value, cost basis, unrealized gain/loss, allocation, cash and relevant news/events. Calculate realized returns only from sufficient transaction data. Distinguish today’s market movement from investment performance and from deposits/withdrawals.

Use deterministic financial calculations with suitable decimal precision. Handle currencies and FX consistently, disclose conversion timestamps, and never add unlike currencies as if they were identical. Handle splits/corporate actions without double-adjusting positions, or clearly request a manual correction when coverage is absent.

Do not fabricate historical portfolio curves, dividend income or time-weighted returns from a current holdings snapshot. Explain which analytics need more history.

Mark these records **“Manually entered.”** Keep them distinct from Pro’s broker-synchronized positions so an imported or connected account does not double-count holdings. Unsupported instruments need an honest unsupported/manual-valuation state, not a guessed ticker match.

## 5. Make all five integrations real

Implement production adapters for:

1. Market data.
2. News.
3. Economic calendar.
4. Brokerage.
5. AI explanations.

Start with a compact provider decision matrix: supported instruments/exchanges, target countries, real-time versus delayed coverage, historical depth, authentication, commercial permissions, quotas, streaming support and expected operating cost.

Use current official documentation and existing approved providers where suitable. Examples worth evaluating include Twelve Data for prices, Trading Economics for economic events, and an approved broker OAuth integration for execution; these are candidates, not preapproved universal choices.

Check external display, redistribution, automated/non-display use, storage, derived analytics and AI-processing permissions where applicable. A personal developer API key is not sufficient evidence of permission to redistribute data to paying customers. Record required exchange approvals and attribution.

Estimate provider, hosting and AI costs against the $10/$30 prices at realistic usage levels. If the desired coverage requires an additional contract or cost that conflicts with the plan economics, report the exact gap and options. Do not silently alter prices, invent free rights or degrade data to conceal it.

Give each integration distinct server-derived states:

- Configuration and commercial permissions ready.
- Provider reachable.
- Data current, delayed, stale or unavailable.
- Feature included in the user’s plan.
- User account connected/authorized, where applicable.

“Upgrade required,” “Connect your broker,” “Market closed” and “Service unavailable” are different states. Keep detailed credentials/configuration diagnostics in an admin view. Show useful customer-facing explanations and actions.

Do not mark a service connected until a real authenticated request or stream succeeds. Do not remove the brokerage release restriction without implementing its replacement authorization and execution controls. Missing credentials must not be replaced by invented production data.

## 6. Live market data, news and calendar

### Market data

Connect supported live quote and candle feeds through a secure server adapter. Normalize instrument IDs, venue, currency, quote type, exchange timestamp and received timestamp. Resolve ambiguous symbols explicitly.

Use licensed streaming where supported and bounded polling where appropriate. Implement rate limits, permitted caching, reconnect/backoff, stale-data detection and recovery. Keep provider secrets out of the browser.

Show actual source, freshness and coverage. Distinguish live, delayed, market closed, stale and unavailable. A subset feed must not be described as full consolidated market coverage.

Do not mix sample candles with production prices. When data fails, retain clearly timestamped last-known values where permitted and pause operations that require fresh input. Never animate fake price changes.

### News

Use a licensed news source with stable article IDs, publisher attribution, original links, publication/update times, instrument tagging and deduplication. Display only permitted text and media. Confirm permission for AI summarization separately where required.

Provide a concise portfolio-related feed for Portfolio and richer search/filtering, research context and engine-relevant analysis for Pro. Distinguish publisher facts, automated tagging and generated commentary.

### Economic calendar

Use a real provider with stable event IDs, source links, countries/currencies, release times, importance, units and separate actual, consensus, previous and revised values.

Store timestamps in UTC and display the user’s timezone. Handle daylight-saving changes and estimated release times. Update released and revised values from the provider; missing values stay missing.

Provide portfolio relevance and event reminders, with deeper event analysis and configurable strategy filters in Pro. Reminders must work through their implemented channel; do not imply background delivery if they only work in an open tab.

## 7. Implement useful, grounded AI

Use the project’s configured AI provider, or select a suitable documented provider. Keep its credentials server-side and route requests through authenticated, tier-aware endpoints.

**Portfolio AI** should offer concise, on-demand explanations of portfolio terms, allocation, a selected holding or a relevant news item. Give it a clearly defined modest allowance.

**Pro AI** should support deeper sourced market/portfolio analysis, explanations of strategy signals, scenario comparisons, news/event context and analysis of the user’s configured strategies. Give it a larger documented allowance.

Define initial quotas and model routing using a documented cost budget. Enforce limits atomically per account across tabs and jobs; show remaining allowance and reset time. Do not allow repeated requests, concurrent tabs or automated refreshes to evade limits. Do not create extra usage charges without an explicit billing design.

Ground responses in authorized, timestamped market data, news, calendar entries, portfolio facts and deterministic calculations. Show the data’s “as of” time and source links. Distinguish verified facts, calculated metrics, interpretations and uncertainty.

Do not ask the model to invent prices, portfolio totals, current events, performance statistics or confidence percentages. When evidence is unavailable or stale, say so.

Treat retrieved articles and user notes as untrusted content. They cannot override system instructions, access rights or execution limits. Minimize private data sent to the model and keep one customer’s context isolated from others.

AI text must not directly execute orders or change risk limits. Any proposed strategy configuration must be validated and deliberately accepted before it can affect the engine. Handle timeout/provider errors with an honest retry state, not a fake completed explanation.

## 8. Add supported real-money brokerage for Pro

Connect an eligible customer’s own brokerage account through an approved OAuth or delegated API flow. Verify support for Nortivo’s business location, intended customer countries, instruments, commercial model and automated execution.

Do not assume a broker supports Norwegian customers from a generic statement about international access. Keep identity onboarding, account eligibility, custody and funding with the broker. Do not route customers through the founder’s trading account or treat subscription payments as trading deposits.

Implement against broker paper/sandbox accounts first. Live deployment additionally needs the broker’s actual commercial approval and authorized live application credentials. For example, Alpaca Connect documents approval requirements for commercial apps and live trading for other users; evaluate these requirements before choosing it.

Never request brokerage passwords. Exchange OAuth codes server-side, validate state/redirect targets, use the provider’s recommended flow, encrypt per-user tokens and handle expiration, refresh, revocation and disconnection. Request only necessary scopes; exclude fund-transfer permissions when not needed.

Make the account and execution mode unmistakable:

- **Sample replay.**
- **Live market data with paper execution.**
- **Connected live brokerage.**

Keep balances, positions, order histories, credentials and endpoints separate for each mode. Default new users to a non-live mode. Buying Pro, signing in or connecting an account must never start trading automatically.

For manual orders, show account, instrument, side, size, order type, price conditions, time-in-force and estimated costs before confirmation. Broker responses determine accepted, rejected and filled status.

For automation, require separate explicit enablement of the selected strategy and brokerage account with visible position, exposure, loss and order-frequency limits. Provide clear stop controls and an audit trail.

## 9. Make the engine durable and safe to operate

Where unattended automation is offered, move execution out of the browser tab into a suitable persistent worker/queue architecture. Inspect the current hosting constraints and add the smallest appropriate backend service. A hidden tab or closed browser must not silently terminate a supposedly running live engine.

Persist strategy versions, execution state, order intents, account bindings and progress. Coordinate work per account, prevent concurrent duplicate execution, and recover safely after crashes.

Use stable client order IDs/idempotency where supported, durable order intent records, broker events and reconciliation. A network timeout means the outcome may be unknown. Query the original order before deciding whether resubmission is safe.

Handle pending, accepted, partially filled, filled, rejected, cancel-pending, cancelled, expired and replaced orders. Deduplicate fills/events and tolerate out-of-order delivery. Reconcile actual broker positions and outstanding orders before restarting entries.

Validate supported instruments/order types, market sessions, account status, buying power, input freshness and user risk limits before placing an order. Pause new entries on stale feeds, unresolved execution state or critical provider failure.

Implement supported strategy tools, scans and backtests using the same validated data/indicator definitions where appropriate. Account for fees, slippage, missing history and corporate actions. Label simulated results clearly and avoid look-ahead data. Do not present backtests as live outcomes.

“Stop automation” must prevent new entries and explain what happens to existing orders. Do not silently cancel protective stops. Preserve risk-reducing controls and appropriate supervision of existing positions through outages, downgrades and subscription expiry.

Billing changes must never trigger forced liquidation or block an authorized user from viewing their positions, stopping automation, cancelling orders or reducing exposure. If the app cannot reach the broker, show the limitation and the direct broker-management route. Preserve already-authorized protective orders and safely reconcile outstanding work.

## 10. Enable complete registration and account recovery

Implement account creation, sign-in/out, email verification/resend, forgotten password, recovery, password change and session management. Handle expired and reused links correctly.

Reuse the existing auth architecture where sound. Use maintained authentication components and supported provider features. Protect passwords and single-use expiring tokens properly; do not invent cryptography.

Keep user IDs and existing ownership intact. Validate callbacks and internal return destinations. Use Secure/HttpOnly cookies and appropriate CSRF protection for the architecture. Rate-limit abusive signup, login, resend and recovery requests without exposing account existence.

Use the existing email service where suitable. Verify sender configuration and actual delivery responses, and support Norwegian/English transactional templates. Permit password managers and paste; provide accessible field errors and show/hide password.

Remove “Account creation closed” and missing-verification/recovery notices only after the replacement works.

Preserve chosen tier, interval, locale and intended destination through:

**Pricing → account creation/sign-in → verification → checkout → server confirmation → correct workspace.**

Portfolio users should land in a clear “Add your first holding” flow. Pro users should see a guided setup for data, strategy and optional broker connection.

## 11. Implement subscriptions and self-service billing

Reuse an established billing integration if present; otherwise use Stripe Billing, hosted Checkout and the Customer Portal.

Maintain one provider customer mapping and one active plan subscription per account. Use two tiers and four server-controlled recurring price IDs. Accept only allowlisted tier/interval choices; never accept a client-supplied amount, arbitrary price or customer identity.

Create checkout and billing-portal sessions on the server for the authenticated owner. Prevent double-click/concurrent-tab duplicate purchases. Existing subscribers should manage their plan instead of buying another subscription.

Separate sandbox/live credentials, customers, prices and webhook secrets. Keep payment collection hosted; do not handle raw card details.

A success URL, browser flag or frontend payment callback must not unlock access. Use validated provider payment/subscription state and durable server entitlements. Handle delayed payment and webhook confirmation with an understandable pending state and reconciliation path.

Verify webhook signatures using the original request body. Deduplicate and durably process events; handle retries, out-of-order events and missed-event reconciliation. Use the provider’s actual billing dates.

Support:

- Current plan, interval, next charge and renewal/access-end date.
- Invoices, payment-method changes and payment recovery.
- Cancellation at period end and reversal before expiry where supported.
- Upgrades after a clearly previewed charge succeeds.
- Downgrades at the next renewal by default.
- Monthly/annual changes with explicit effective dates and credits/charges.
- Resubscription without duplicate billing.

An unpaid upgrade must not grant Pro or remove the customer’s existing paid Portfolio access. Replace the existing subscription item when changing plans; do not accidentally add both prices. Use supported pending-update/scheduling behavior appropriate to the provider/API version.

Preserve purchased access until its legitimate end. Do not invent a trial or grace period. Show upcoming feature changes before a downgrade and keep portfolios, strategies and history intact. A deletion flow must resolve recurring billing and connected-account consequences rather than leaving orphan charges.

## 12. Enforce entitlements throughout the backend

Use explicit feature entitlements, not a single frontend “isPaid” flag.

Check authenticated identity, verification, current paid tier, requested capability, usage allowance, provider readiness and account authorization as appropriate to each operation. Live execution also requires explicit consent and risk validation.

Apply checks to data APIs, portfolio records, AI, scans, strategy actions, exports, order submission, sockets and background jobs. Recheck queued jobs at execution time and revoke long-lived access when entitlement changes.

Portfolio must not reach Pro automation through direct API calls, manipulated client state, a deep link or a queued job. Keep provider cache sharing within contractual permissions and private data isolated per customer.

At downgrade/expiry, stop new premium analysis and risk-increasing automation, retain records, and preserve the brokerage safety controls described above. Explain the new state and route to billing.

Keep public marketing, company pages, guides, support, pricing and the complete historical report accessible. A public sample preview may remain read-only and clearly labeled. Do not load an unrestricted working engine behind a cosmetic blur.

Keep account, billing, receipts, support and appropriate read-only personal history accessible after paid access ends. Keep admin privileges explicitly server-managed and audited.

## 13. Preserve Nortivo’s premium design and make both plans feel intentional

Match the current near-black surfaces, white/silver typography, restrained green accents, precise spacing and fine borders. Preserve the website’s investment identity and report prominence.

Add a polished two-plan pricing section/page with one monthly/annual selector, “Save 20%,” full annual totals, a clear feature comparison and direct signup actions. Make Portfolio approachable and Pro visibly richer through useful features, not visual clutter.

Portfolio should prioritize holdings, allocation, portfolio value, transactions, relevant news/events and a compact basic-AI panel. Pro should preserve the dense but readable terminal with chart, watchlist, news, calendar, strategy/engine controls, risk information and advanced explanation panel.

Use progressive disclosure for secondary controls. A connected selection should carry the chosen instrument into its chart, news and explanation context. Keep layout stable during live updates.

Make plan, feed status, AI allowance, selected broker and execution mode easy to find. Use badges with text, not color alone. Add account/billing access and contextual upgrade actions without repetitive blocking popups.

Use restrained 120–250 ms control transitions, responsive button feedback, composed loading/empty/error states and subtle panel changes. Honor reduced motion, keyboard focus and mobile usability. Avoid flashing prices, oversized glows and decorative motion that impairs reading.

Keep authentic losses and risk information accurate. Preserve the historical report’s verified average-session statistic and its methodology; do not relabel it as daily return if that is not its definition. Company report results must remain separate from customers’ portfolios and backtests.

## 14. Production architecture, privacy and localization

Extend the actual schema with the minimum necessary records for billing entitlements, portfolio transactions, broker connections, strategies, order intents, provider events and AI usage.

Enforce account ownership in backend and database policies. Protect service credentials and encrypted tokens, minimize sensitive logging, and maintain audit records for billing, broker and execution changes. Add MFA or supported step-up authentication for sensitive live-account and automation controls.

Use migrations with safe defaults, backups and a rollback approach. Preserve existing contact/support/admin flows. Do not silently merge guest trades into registered or brokerage accounts.

Monitor integration health, stale feeds, worker liveness, unresolved orders, webhook failures, entitlement synchronization and AI budgets. Operational incidents must be visible to the owner without exposing credentials.

Implement Norwegian and English with locale continuity through email, checkout and return routes. Keep subscription currency explicitly USD; portfolio display currency is a separate user preference.

Update privacy, processor, retention and subscription information to match what is actually implemented. Reuse real company details and approved policies. Identify required owner/provider decisions for commercial data and trading availability rather than inventing permissions or legal assurances.

## 15. Verification and acceptance criteria

Use authorized test accounts, payment sandboxes and broker paper environments. Do not charge real cards or place live orders to test this work.

Verify:

1. Registration, verification/resend, expired links, sign-in/out, recovery and existing-account preservation.
2. All four exact recurring prices, annual disclosure and selected plan surviving the complete account/checkout journey.
3. Payment failure, authentication challenges, delayed payment, failed upgrade, renewal, cancellation, resubscription and scheduled downgrade.
4. Signed webhooks, duplicates, out-of-order events, missed-event reconciliation and no overlapping subscriptions.
5. Wrong-tier direct API requests, private-record isolation, forged customer/broker IDs, expired sessions and queued jobs after access loss.
6. Manual holdings/transactions, missing history, currency conversion, instrument mapping, unsupported symbols and corporate-action handling.
7. Real provider responses for quotes/news/calendar; stale data, closed markets, quota limits, reconnects and outages.
8. AI grounding, source links, unavailable facts, prompt injection, user isolation, quota exhaustion and concurrent requests.
9. Broker OAuth/account ownership, paper/live separation, revocation, order rejection, partial fills, ambiguous timeouts and reconciliation.
10. Worker restart and duplicate prevention, risk-limit enforcement, stale-feed pause and safe downgrade/expiry with open positions.
11. Existing public homepage/report/support and both locales, mobile layouts, keyboard access and reduced motion.

Use browser checks for signup, pricing, locked/unlocked workspaces, portfolio entry, broker setup and billing management. Review actual rendered layouts. Capture representative screens without private account/payment details.

Distinguish unit/fixture tests, real provider sandbox tests and verified production integrations. Fixtures are for tests and labeled demos; they are not evidence that live services work.

## 16. Deliver the complete implementation and a precise launch handoff

Complete the feasible code, migrations, UI, provider adapters, email templates, billing, workers, tests and setup documentation. Do not stop after adding five credentials fields or a pricing toggle.

If keys, commercial rights or broker approval are missing, finish the integration and sandbox validation available without them. Provide one exact setup list, secure configuration locations and evidence of what is tested. Do not label unverified services production-ready or sell unavailable functionality as already included and working.

For every capability report:

- Implemented components and relevant routes.
- Provider/environment used.
- Tests actually completed.
- Production readiness and remaining dependency.
- Exact owner configuration or approval needed.

Provide the selected provider rationale, supported markets/countries, usage/cost assumptions, AI quotas, deployment steps, rollback steps and operational checks. Example environment files must contain placeholders, never secrets.

Keep live order transmission disabled until the supported integration, required permissions, account authorization and execution controls are verified. Complete the work that can be reviewed before asking for any necessary production activation decision.

The finished result should let a visitor create an account, buy either plan, use accurate live information, manage a manually entered portfolio, and upgrade to sourced AI, durable trading automation and a supported connected brokerage experience. Billing, feature access and real-world execution must remain consistent across the interface, APIs and workers.

## Official references to verify against the chosen versions

- [Stripe subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions)
- [Stripe lifecycle and webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe plan changes](https://docs.stripe.com/billing/subscriptions/change-price)
- [Stripe paid upgrades](https://docs.stripe.com/billing/subscriptions/pending-updates)
- [Stripe billing portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Twelve Data commercial rights](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)
- [Trading Economics calendar fields](https://docs.tradingeconomics.com/economic_calendar/schema/)
- [Trading Economics calendar updates](https://docs.tradingeconomics.com/economic_calendar/streaming/)
- [Alpaca commercial account connections](https://docs.alpaca.markets/us/docs/about-connect-api)
- [Alpaca OAuth](https://docs.alpaca.markets/us/docs/using-oauth2-and-trading-api)
- [Alpaca order lifecycle](https://docs.alpaca.markets/us/docs/orders-at-alpaca)
- [Authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)