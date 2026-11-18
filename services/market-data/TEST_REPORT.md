# Nortivo Data Engine verification

Recorded 18 November 2026. Initial online checks started at 19:56 Europe/Oslo (18:56 UTC). The successful Alpaca follow-up ran at 20:17-20:18 Europe/Oslo. This is a separate local service; site integration remains unapproved and disabled.

## Initial baseline results (19:56 Europe/Oslo)

| Verification | Result | Evidence and practical limit |
| --- | --- | --- |
| Automated API, storage, mathematics and adapter tests | 87 passed, 0 failed | Includes atomic rollback, disk persistence/reopen, nanosecond event ordering, source separation, retention expiry, authentication, browser-origin rejection, SSE, request limits and missing prerequisites. Fixtures are explicitly synthetic. |
| Real loopback HTTP/SSE with external access unused | 6 passed, 0 failed | Registered an own fixture source/instrument, ingested records, read history/quotes, calculated indicators, streamed a later ingestion, and verified authentication. Stored-data requests made zero upstream calls. |
| Online HTTP/source verification | 12 passed, 0 failed; 3 prerequisites blocked | Includes all core HTTP checks plus real Kraken quotes/bars/ingestion, ECB FX, Federal Reserve headlines and BLS upcoming events. This is not proof of a live stock connection. |
| Live US stocks | Not verified / not connected | No direct exchange feed or stock-provider credentials were supplied. The Alpaca IEX adapter is fixture-tested, and missing credentials return an explicit error with no invented price. |
| Live SEC data | Not verified | Requires `SEC_USER_AGENT` identifying a real operator contact email. No email was invented. |
| Live FRED series | Not verified | Requires `FRED_API_KEY`. |
| Existing repository regression suite | 243 passed; 2 environment failures out of 245 | Windows sandbox denied symlink creation (`EPERM`) and one loopback connection (`EACCES`). No existing-site code was changed to work around these restrictions. The new service's real HTTP/SSE was separately verified in the available native runtime. |

The online test observed a real Kraken BTC/USD trade at `2026-11-18T18:56:00.273Z`, returned 40 recent one-minute candles with the current candle marked provisional, stored a sourced observation in the Nortivo warehouse, and then read that observation with zero additional upstream calls. The ECB observation was dated 18 November and explicitly labeled a daily reference rate. The official feeds returned five Federal Reserve release headlines and ten BLS calendar entries within the requested upcoming window.

A live check found Kraken currently returns 721 OHLC rows: up to 720 historical rows plus the always-present provisional row. The adapter was corrected and a regression fixture now covers 721 accepted rows and an unexpected 722-row response. The subsequent real HTTP candle check passed. Date-only history end bounds are inclusive; today's Alpaca date bound is capped at the current time.

## Alpaca connection follow-up (20:17-20:18 Europe/Oslo)

The owner supplied matching paper-account credentials, which were saved only in the ignored local service configuration. Read-only calls through the authenticated Nortivo API at `http://127.0.0.1:4435` succeeded. No broker/account/order endpoints were called, no subscription was activated, and no website integration was enabled.

| Check | Result | Evidence |
| --- | --- | --- |
| AAPL IEX last trade, two separate requests | Both HTTP 200; timestamp advanced | Original trade time advanced from `19:16:52.986Z` to `19:17:48.170Z` on 18 November |
| NVDA IEX last trade, two separate requests | Both HTTP 200; timestamp advanced | Original trade time advanced from `19:16:58.294Z` to `19:17:58.765Z` |
| MSFT IEX last trade, two separate requests | Both HTTP 200; timestamp advanced | Original trade time advanced from `19:16:55.417Z` to `19:17:57.140Z` |
| NVDA one-minute candles | HTTP 200; 40 actual source bars | IEX, raw adjustment, first bar start `18:37:00Z`, last returned start `19:16:00Z` |

All three quotes used USD and preserved separate trade and receipt timestamps. On the follow-up request, source trades were approximately 8-18 seconds old. This establishes authenticated IEX access and advancing observations during the test, not exchange-wide pricing or guaranteed future uptime. Requests are REST snapshots; no continuously subscribed Alpaca WebSocket or autonomous stock collector is running.

The earlier baseline's three blocked prerequisites remain historical results. The stock prerequisite was resolved in this follow-up; SEC operator identification and a FRED key are still missing. See the private local verification record `.local/alpaca-verification.json` for sanitized observations; it contains no credentials.

## What independence means here

Nortivo controls its own API implementation, stable instrument IDs, database, ingestion interface, stored permitted price history, calculations and local event stream. The primary stored-data endpoints work without a provider account or network connection. Optional upstream previews are explicitly under `/api/v1/connectors/`. A provider collector only runs after an explicit local request and successful first ingestion.

Actual new stock trades still require an authorized incoming feed. The owner's Alpaca paper account now supplies the tested private IEX connection. No direct exchange agreement or physical exchange connection was established, and no paid subscription was created. Storing a source's data does not establish ownership of its underlying intellectual property or permission to redistribute it.

## Boundaries retained

- All source changes for this task are contained under `services/market-data/`.
- No edits were made by this task to `dist/`, `netlify/`, root package scripts, Netlify configuration, production credentials or the production database.
- No Git push, deployment, site routing, browser connection, order execution or paid resource was performed.
- Normal startup binds to loopback and requires bearer authentication for private endpoints. Browser-origin access, including Nortivo's site, is rejected.
- Smoke data uses an in-memory database; mathematical fixtures never seed the regular warehouse. Smoke servers are closed after checks.
- Optional source coverage is partial. Parsed fund holdings, congressional trades, ESG scores, corporate-action events and full global tick coverage are not implemented or advertised as available.

## Reproduce

From `services/market-data/` with Node.js 24+:

```powershell
npm test
npm run smoke -- --offline
npm run smoke
```

The offline smoke checks need local loopback permission. The online checks also need outbound internet access. Source/network restrictions are reported separately from invalid data or implementation failures. Stock credentials are now configured locally; SEC and FRED prerequisites remain explicitly blocked until supplied. The source and setup instructions are in `README.md`; the request/response contract is in `openapi.json`.
