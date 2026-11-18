# Provider decisions and operating costs

Reviewed 18 November 2026 against the official sources linked below. This is an implementation decision record, not an assertion that Nortivo has purchased a licence. No new provider purchase, contract, credential probe or brokerage order was performed in this work. Fixture HTTP responses test code only.

## Initial coverage and choices

| Capability | Selected adapter and target | Delivery/history/authentication | Commercial readiness and cost |
| --- | --- | --- | --- |
| Prices, candles and currency conversion | Twelve Data; USD US common stocks/ETFs explicitly identified as XNAS, XNYS, ARCX or BATS; separately licensed FX pairs | REST quote/time_series/exchange_rate; bounded polling, not a claimed streaming implementation. Up to 500 chart bars and 1,000 daily research bars, subject to the subscribed history. Server API key. | Business plan plus exact external-display/redistribution and exchange permissions must be confirmed. Published business material shows Venture from $149 with different credit selections and a $499 selected package; budget $149–$499 **before** add-ons and request a binding quote. No personal/free-plan redistribution. |
| News | Finnhub enterprise company/general news | REST; provider IDs/attributed publisher/original links; seven-day company request window; provider enterprise page advertises deeper history, not fetched here. Server token. | Written commercial/redistribution approval required, with separate text/media/AI rights. Enterprise pricing is **contact sales**. No invented free licence or numeric enterprise quote. |
| Economic calendar | Trading Economics | REST snapshot; stable CalendarID, UTC releases, estimated timing, revisions, consensus, units/source links. Real-time streaming is a provider option; this adapter polls. Server Authorization header. | Distribution/AI/caching quote required. Public Standard $199/month/500 requests and Professional $399/month/5,000 requests are reference prices, **not** proof of public redistribution rights. Enterprise is customized. |
| Brokerage | Alpaca Connect OAuth, paper first; live adapter separately gated | Server authorization-code exchange, `trading` scope only, per-user encrypted token; account/positions/orders/clock/assets and stable client order IDs. REST reconciliation persists across restarts. | Commercial app written approval and approval to trade for other users required. Norwegian US-OAuth account eligibility and automation authorization remain unverified. Partner fees and broker/exchange costs require an actual agreement. |
| Explanations | OpenAI Responses, `gpt-6-luna`; optional explicitly configured `gpt-6.1-terra` | User-triggered server requests; no tools/order execution. Atomic monthly account quotas and source IDs. `store:false`. | Owner selected their own OpenAI key; provisioning pending. Luna $0.10/M input, $0.50/M output. Terra $1/M input, $5/M output. Account access, spend settings and privacy setup still require verification. |
| Durable engine | Separate paid Render Node background worker, same Supabase product records | Independent heartbeat, account leases with fencing/renewal, reconciliation before entries and durable order intents; daily SMA crossover only | Render smallest paid 512 MB worker $7/month; optional production workspace $25/month plus compute. Existing Netlify/Supabase/email charges, egress and database growth are additional. No service purchased or deployed here. |

Sources: [Twelve business pricing](https://twelvedata.com/pricing-business), [Twelve plan descriptions](https://support.twelvedata.com/en/articles/5335783-trial), [Twelve March 2026 pricing update](https://twelvedata.com/news/march-2026-updates), [Finnhub enterprise](https://api.finnhub.io/pricing-startups-and-enterprise), [Trading Economics pricing](https://tradingeconomics.com/api/pricing.aspx), [Alpaca Connect approval](https://docs.alpaca.markets/us/docs/about-connect-api), [OpenAI Luna pricing](https://developers.openai.com/api/docs/models/gpt-6-luna.md), [OpenAI Terra pricing](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Render pricing](https://render.com/pricing).

## Rights are separate from API access

| Use | Twelve Data | Finnhub news | Trading Economics calendar |
| --- | --- | --- | --- |
| External display/redistribution | Confirm business tier, US Equities Redistribution Rights Add-On and any exchange requirements for this paid app. | Enterprise/written approval; self-serve plans are personal unless explicitly agreed otherwise. | Obtain public paid-app distribution permission; a single-user plan is insufficient evidence. |
| Automated/non-display analysis | Explicit permission needed for strategy scans/backtests and engine inputs. | Confirm automated tagging/analysis rights. | Confirm strategy filtering/automated analysis rights. |
| Caching/storage | Only the licensed TTL; derived data must not reconstruct raw data. Cache is disabled when no TTL is recorded. | Written permitted retention; provider terms require data deletion when the subscription ends. | Obtain exact permitted retention/update policy. |
| AI processing | Confirm external model processing separately. Internal AI use on an individual plan does not authorize a customer-facing product. | Confirm AI summarization/model processing and permitted excerpts. Full articles/images are not mirrored. | Confirm external AI processing separately. |
| Attribution | Visible Twelve Data source link and exchange-specific notices. Default US feed is roughly 5% venue coverage; do not call it consolidated. | Publisher and original link retained. Summaries excluded unless approved. | Provider/source organization and original links retained. |

The server requires independent capability evidence in `PRODUCT_PROVIDER_RIGHTS_JSON`. Setting that evidence records the operator's existing permission; it does not create rights. The implementation defaults all missing rights to unavailable and never substitutes sample prices. FX has its own `fx` permission with `markets:["FX"]`. The initial US feed does not imply Norwegian/European exchange coverage.

Sources: [Twelve commercial use](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage), [Twelve terms](https://twelvedata.com/terms), [US subset and redistribution add-ons](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data), [Twelve attribution](https://support.twelvedata.com/en/articles/12647398-attribution-guidelines-for-using-twelve-data), [Finnhub terms](https://finnhub.io/terms-of-service), [Trading Economics distribution-based pricing](https://tradingeconomics.com/analytics/api.aspx).

## Why not “free DeepSeek/OpenCode” for subscribers?

DeepSeek V4.1 Flash is real. The current direct API ID is `deepseek-flash`; peak pricing is $0.30/M uncached input and $1.20/M output, with half-price off-peak rates. Its direct API is not a guaranteed free production service. OpenCode currently offers a limited-time free Flash model, but its official endpoint documentation says free-tier chat models require OpenCode; other clients use paid models or Go. Nortivo therefore does not route customers through that free tier. The selected supported Luna route is cheaper at the published standard rates for this bounded explanation workload. This is a cost-based implementation choice, not a claim of superior investment results.

Sources: [DeepSeek current models/pricing](https://api-docs.deepseek.com/quick_start/pricing/), [OpenCode endpoints/free models](https://opencode.ai/docs/console/models/).

## Plan economics and usage assumptions

Portfolio includes **30 requests/month**, up to **150,000 aggregate input+output tokens**; Pro includes **200 requests/month**, up to **2,200,000 tokens**. Output caps are 800/1,800 tokens, context payload caps 10/30 KB. Input is conservatively reserved by UTF-8 bytes plus the system prompt; provider-reported input/output tokens settle the reservation atomically. Unknown timeout outcomes remain charged and are never automatically resubmitted. These are included allowances, with no usage overage billing.

At an illustrative 3,000 input/500 output tokens per Portfolio request, 30 Luna explanations cost **$0.0165/account-month**. At 8,000/1,200 for Pro, 200 cost **$0.28/account-month**. Pure worst-case aggregate-token upper bounds using the highest Luna token rate are **$0.075** and **$1.10** respectively; configured Terra would raise them to **$0.75/$11**. These exclude tax, retries with different IDs and any external tools (none are requested). A provider budget/alert is still necessary.

Illustrative 100 customers, 80 Portfolio and 20 Pro:

| Item | Monthly-billed revenue/cost | Annual-billed monthly equivalent |
| --- | ---: | ---: |
| Subscription gross revenue | $1,400 | $1,120 |
| Luna at illustrative included request use | $6.92 | $6.92 |
| Render worker only | $7 | $7 |
| Twelve reference range before add-ons | $149–$499 | Use the actual provider annual quote; no inferred discount |
| Remainder before unknown costs | $887.08–$1,237.08 | $607.08–$957.08 |
| Still unpriced | Finnhub commercial fee + Trading Economics distribution fee + US-equities redistribution/non-display/AI/exchange fees + existing hosting/database/email + payment/tax/support costs | Same dependencies |

This is **not a profitability forecast**: the largest required commercial licence prices are unknown. With ten simultaneous users and twenty distinct visible symbols each, one quote per minute requires up to 200 quote credits/minute before charts, search, FX and research. The server defaults to a conservative 55 Twelve credits/minute until the owner configures the actual purchased allowance. Cache hits spend no upstream credits; every attempted HTTP call, including HTTP errors, does. A 120-second calendar refresh continuously would require about **21,600 requests/month**, exceeding the public 500/5,000-request reference plans; negotiate sufficient volume/streaming or explicitly approve a suitable refresh policy. Do not conceal this gap by calling stale events live.

At ten customers the $7 worker plus even $149 base prices already exceed $140 gross mix revenue before news/calendar. With no new contracts currently authorized, public paid activation must remain blocked. Options are to obtain the missing business quotes/permissions, fund an explicitly limited launch, or deliberately revise offered coverage with the owner. Prices in the specification are not silently changed.

## Brokerage country and execution boundaries

Alpaca's US Connect page supports international existing accounts in general, but its current country-support page directs users to support for country eligibility. Its EEA passport announcement includes Norway and concerns its European infrastructure; that does not establish eligibility for this US OAuth integration. Written Nortivo-specific confirmation is required for business location, customer residence, instruments, charging model and automation. Custody, identity verification and funding remain at Alpaca.

The OAuth guide documents confidential server authorization-code exchange and a random state, not a PKCE contract, refresh-token contract or revocation endpoint. This implementation follows that documented server flow, validates one-use state/registered redirect, and never invents unsupported refresh requests. Expiry/401/403 stops new activity and requests reconnect. Disconnect erases Nortivo's token and provides Alpaca's direct grant-revocation route. Broker protective orders remain untouched.

Sources: [Alpaca country eligibility](https://alpaca.markets/support/countries-alpaca-is-available), [Alpaca EEA announcement](https://alpaca.markets/blog/alpaca-completes-eea-passporting-to-29-countries-expanding-access-to-regulated-investment-services-across-europe/), [Alpaca OAuth scopes/flow](https://docs.alpaca.markets/us/docs/using-oauth2-and-trading-api).
