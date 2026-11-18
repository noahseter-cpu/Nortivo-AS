# Nortivo Data Engine

An isolated, private API and durable SQLite data warehouse for Nortivo. It is **not connected to the website**. It does not import site code, alter production configuration, place orders, register accounts, purchase feeds, or deploy anything.

The main price and instrument endpoints read Nortivo's own records, even with no network connection or provider account. Imports and incoming feeds write through the same validated ingestion API. Optional connectors are under `/api/v1/connectors/` and can be replaced without changing stored instrument IDs or consumer endpoints.

Live stock trades originate at exchanges. Nortivo can own the software, database and analysis, and retain records when permitted, but writing this service does not create stock observations or grant ownership of another source's data. A direct exchange feed, licensed supplier, or another authorized incoming feed is still needed for fresh real stock prices. The owner's Alpaca paper-account credentials were configured locally on 18 November 2026: real IEX quotes for AAPL, NVDA and MSFT and recent NVDA candles passed the actual API checks. This is read-only access to a single-venue source, not consolidated US pricing or a public website integration.

## Run locally

Requires Node.js 24 or newer. There are no third-party runtime dependencies and no installation step.

From this directory:

```powershell
npm test
npm start
```

The API binds to `127.0.0.1:4435` only. On first start it creates a private bearer token and SQLite files under `.local/`, which the repository already ignores. Optional settings can be saved in this directory's `.env.local`, copied from `.env.example`. The website's environment file is not loaded.

Use a second PowerShell terminal in this directory:

```powershell
$nortivoToken = (Get-Content -LiteralPath .local/access-token -Raw).Trim()
$nortivoHeaders = @{ Authorization = "Bearer $nortivoToken" }
Invoke-RestMethod http://127.0.0.1:4435/health
Invoke-RestMethod http://127.0.0.1:4435/api/v1/capabilities -Headers $nortivoHeaders
Invoke-RestMethod http://127.0.0.1:4435/api/v1/status -Headers $nortivoHeaders
```

If `DATA_API_TOKEN` is explicitly configured, use that value instead of the generated token file. Do not paste tokens into URLs, browser code or committed files. Browser origins are rejected, including Nortivo's site, until an integration is separately reviewed and approved.

## Own data without another API

Register a source that you have permission to retain. `retentionUntil: null` is an explicit declaration of unlimited retention; otherwise provide the permitted future UTC deadline. These are operator declarations, not independently verified licences. External display remains disabled by default.

```powershell
$nortivoSource = @{
  id = 'owned-history'
  label = 'My permitted historical dataset'
  kind = 'user_import'
  canRetain = $true
  externalDisplay = $false
  retentionUntil = $null
} | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:4435/api/v1/sources -Method Post -Headers $nortivoHeaders -ContentType application/json -Body $nortivoSource

$nortivoInstrument = @{
  id = 'nortivo-us-aapl'
  symbol = 'AAPL'
  name = 'Apple Inc.'
  assetType = 'stock'
  currency = 'USD'
  listingVenue = 'XNAS'
} | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:4435/api/v1/instruments -Method Post -Headers $nortivoHeaders -ContentType application/json -Body $nortivoInstrument
```

Registering an instrument does not create a price. POST actual permitted observations to `/api/v1/ingest`, with the following structure. Replace the placeholders with real source records; no sample market prices are seeded by this application.

```text
{
  "sourceId": "owned-history",
  "instrumentId": "nortivo-us-aapl",
  "quotes": [
    { "asOf": "<actual UTC trade timestamp>", "price": <actual numeric price> }
  ],
  "bars": [
    {
      "time": "<actual UTC interval start>",
      "interval": "1d",
      "adjustment": "raw",
      "open": <actual number>, "high": <actual number>,
      "low": <actual number>, "close": <actual number>,
      "volume": <actual number>, "complete": true
    }
  ]
}
```

Send an existing JSON file:

```powershell
Invoke-RestMethod http://127.0.0.1:4435/api/v1/ingest -Method Post -Headers $nortivoHeaders -ContentType application/json -InFile actual-observations.json
Invoke-RestMethod 'http://127.0.0.1:4435/api/v1/quotes?instrumentId=nortivo-us-aapl' -Headers $nortivoHeaders
Invoke-RestMethod 'http://127.0.0.1:4435/api/v1/bars?instrumentId=nortivo-us-aapl&interval=1d&limit=100' -Headers $nortivoHeaders
```

An ingestion accepts at most 1,000 observations and 1 MB per request and commits atomically. It validates dates, prices, OHLC consistency, source permission and instrument identity. It preserves original event time and separate receipt time. Repeated observations at the same source/instrument/event time are revisions; the latest revision replaces the earlier one. This initial warehouse is not an append-only audit archive for historical revisions.

Sources, instruments and retained observations survive restarts. Expired source observations are removed on warehouse access/startup, including before a permission renewal. Back up `.local/warehouse.sqlite` while the service is stopped. Cache data and private access tokens are separate files; copying the source code alone does not copy the database.

## Live ingestion and streaming

An authorized incoming feed can POST new timestamped observations to `/api/v1/ingest`. Register the source as `direct_exchange` when it truly is a direct exchange feed. This service does not implement an exchange's proprietary wire protocol, sign a feed agreement, or create a physical exchange connection.

`GET /api/v1/stream?instrumentId=...` sends authenticated Server-Sent Events from the own warehouse. It sends the initial stored quote and a new quote after ingestion. It never silently polls an external API. Use a streaming HTTP client that supports an Authorization header. Native browser EventSource cannot send this bearer header; no browser integration is enabled.

Optional provider collection is explicit:

1. Register the provider source with its permitted retention and an ID of `kraken` or `alpaca`.
2. Register the exact instrument and currency. Alpaca collection requires a supported US listing MIC.
3. POST `/api/v1/collect` with `provider`, `sourceId`, `instrumentId`, `symbol`, and `dataset` (`quote` or `bars`).
4. Read the resulting records through the same own `/quotes` and `/bars` endpoints, without another upstream call.

`POST /api/v1/collectors` starts an optional quote collector after its first successful ingestion. `everySeconds` must be at least 10. There are at most three collectors; identical instruments are rejected. `GET /api/v1/collectors` reports observed state, and `DELETE /api/v1/collectors/{id}` stops one. Collectors stop when this local process stops and are not restarted automatically. This does not create a hosted scheduled task.

## Coverage and prerequisites

| Dataset | Implemented coverage | Prerequisite or limitation |
| --- | --- | --- |
| Own instruments, quotes, bars | Durable local records with source, units, timestamps and adjustment basis | Real permitted imports or an incoming feed; no external API needed for stored reads |
| Own analytics | EMA 9/20, Wilder RSI/ATR 14, MACD 12/26/9 | Sufficient complete bars; VWAP/RVOL remain null when session-level inputs are unverified |
| Live crypto connector | Kraken spot instrument directory, timestamped last trades and recent OHLCV | Internet; single venue, at most 720 recent bars per query, final candle provisional |
| Live US stock connector | Read-only Alpaca IEX last trades and price bars; real AAPL/NVDA/MSFT quotes and NVDA candles verified locally | Owner's paper credentials configured privately; one venue, not consolidated pricing or volume; REST snapshots on request, not an upstream WebSocket subscription |
| SEC company data | Filer metadata, recent filing discovery, selected original XBRL facts and revisions | Explicit `SEC_USER_AGENT` with real operator contact email |
| Insider/institutional research | SEC filing discovery via `form=4`, `144` or `13F-HR` | Parsed transactions and fund holdings not implemented; filings are delayed disclosures |
| Economic series | FRED observations and daily historical vintages | `FRED_API_KEY`; source-specific permissions still apply |
| FX | ECB daily euro reference rates and dated cross-rates | Reference data, not live executable forex prices |
| News | Official Federal Reserve releases, dates and links | No full company/publisher news service |
| Events | Official BLS release calendar | No full global calendar, earnings consensus or complete two-month event guarantee |
| Other identifiers, ESG, fund holdings, corporate-action events, derivatives | Explicit capability gaps | No invented substitutes or advertised unsupported coverage |

Research source endpoints are under `/api/v1/connectors/companies`, `/filings`, `/fundamentals`, `/economic-series`, `/fx`, `/news` and `/events`; the prefix applies to each path. These optional reads require their upstream source. Their data is not automatically ingested into the price warehouse.

Read the complete machine-readable specification in `openapi.json`, or authenticated `/api/v1/openapi.json`. `/api/v1/capabilities` reports precise scope and configuration gaps. `/api/v1/status` reports local counts, actual HTTP connection attempts, quotas and collector errors; an HTTP success is not commercial permission or proof of complete coverage.

## Data quality and cost controls

Quotes keep the original trade time; a cache hit never makes an old quote new. Manual imports are labeled imported. A source with unknown delay is labeled unknown. Single-venue volume remains single-venue volume. Own history queries use one source and adjustment basis per series and never fill missing candles. An identifier lookup does not imply current price availability.

Source price bars preserve their gaps. Indicators exclude incomplete candles, return null while warming up, and label the final input candle's start separately from computation time. They are calculations over the supplied series, not forecasts or a backtest. The current warehouse does not reconstruct historical data revisions for an as-of backtest.

Default shared upstream limits are conservative local budgets, not promises of a provider's contractual allowance:

| Connector | Requests per second | Requests per minute | Requests per day |
| --- | ---: | ---: | ---: |
| Kraken | 1 | 50 | 10,000 |
| Alpaca IEX | 3 | 180 | 10,000 |
| SEC | 4 | 90 | 10,000 |
| FRED | 2 | 60 | 5,000 |
| ECB | 2 | 20 | 500 |
| Federal Reserve / BLS, each | 1 | 5 | 100 |

Three 10-second quote collectors require approximately 18 quote requests per minute (25,920 per continuous day), plus reference calls. They fit the minute budget but exceed the 10,000/day local budget if left on continuously; the limiter then pauses useful collection until reset. During a 6.5-hour session, the three collectors need about 7,020 quote calls. API consumers share collected records; ten users do not require ten upstream collectors. A 500-stock scan every 10 seconds would require about 3,000 single-symbol requests per minute and is not supported by these budgets.

The service spends no subscription money and provisions no hosting. Existing computer operation, electricity, internet and disk space remain costs. Live public stock display, redistribution, exchange connections and future hosting need their own permissions and cost decision; no such deployment is enabled here.

## Verification

```powershell
npm test
npm run smoke -- --offline
npm run smoke
```

Unit/contract tests use explicitly labeled fixtures. The smoke script opens a real loopback HTTP server and checks authentication, own ingestion, offline-style reads and actual SSE delivery. The online mode separately attempts real Kraken/ECB/Fed/BLS calls and reports blocked credentials or source/network restrictions. Smoke state is in-memory and does not seed the normal warehouse.

Some restricted execution environments prevent shell DNS, loopback connections or Windows symlink creation. Such failures are reported separately from provider behavior. See `TEST_REPORT.md` for the observed checks, limitations and isolation evidence.

## Official source references

- [Alpaca market-data plans and coverage](https://docs.alpaca.markets/us/docs/about-market-data-api)
- [Alpaca historical feeds](https://docs.alpaca.markets/us/docs/historical-stock-data-1)
- [Kraken public market data](https://docs.kraken.com/api/docs/rest-api/get-recent-trades/)
- [Kraken recent candle limits](https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/)
- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [FRED API](https://fred.stlouisfed.org/docs/api/fred/)
- [ECB API](https://data.ecb.europa.eu/help/api/overview)
- [Federal Reserve RSS feeds](https://www.federalreserve.gov/feeds/feeds.htm)
- [BLS calendar subscription](https://www.bls.gov/schedule/)
