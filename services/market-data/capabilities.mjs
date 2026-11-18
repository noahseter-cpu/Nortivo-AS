export function capabilities(config = {}) {
  const stock = Boolean(config.alpacaKey && config.alpacaSecret);
  const sec = Boolean(config.secUserAgent);
  const fred = Boolean(config.fredKey);
  return {
    architecture: 'Independent Nortivo SQLite warehouse and private API; optional replaceable ingestion connectors.',
    networkRequiredForStoredData: false,
    freshExternalPricesRequireIncomingFeed: true,
    siteIntegration: 'not_connected',
    publicRedistribution: 'not_enabled',
    categories: [
      { id: 'symbols', status: 'implemented', scope: 'Own instrument registry; optional Kraken crypto and SEC US filer directories. Searchability does not imply price entitlement.' },
      { id: 'end_of_day', status: 'implemented', scope: 'Own imported/collected OHLCV with source and adjustment basis; actual history depends on stored data. Optional Kraken recent 720 bars; Alpaca IEX history with key.' },
      { id: 'intraday', status: 'implemented', scope: 'Own stored bars; optional Kraken and Alpaca IEX connectors. No gap filling or invented granular history.' },
      { id: 'real_time', status: 'partial', scope: 'Timestamped observations ingested into own warehouse, streamed locally by SSE. Optional quota-limited collector. The Alpaca connector provides IEX last-trade snapshots when configured; actual availability is checked on each request.', stockConnector: stock ? 'configured' : 'requires_key' },
      { id: 'company_information', status: sec ? 'configured_not_yet_verified' : 'requires_configuration', scope: 'SEC filing metadata; no complete profile, employee count, or current market capitalization.' },
      { id: 'identifiers', status: 'partial', scope: 'Own stable instrument IDs and SEC CIK where supplied. No invented CUSIP, ISIN, FIGI, LEI or EIN.' },
      { id: 'fundamentals', status: sec ? 'configured_not_yet_verified' : 'requires_configuration', scope: 'Selected original SEC XBRL facts, units, periods, filing dates and revisions; not a complete normalized statement service.' },
      { id: 'news', status: 'partial', scope: 'Official Federal Reserve release headlines and links; not a full company or publisher news feed.' },
      { id: 'events', status: 'partial', scope: 'Official BLS release calendar; not comprehensive global earnings, IPO or macro coverage.' },
      { id: 'insider_trading', status: 'partial', scope: 'SEC Form 4/144 filing discovery when configured; transaction parsing and congressional data not implemented.' },
      { id: 'institutional_trading', status: 'partial', scope: 'SEC 13F filing discovery when configured; parsed holdings and live institutional trading not available.' },
      { id: 'etf_data', status: 'partial', scope: 'Own ETF instrument metadata and price history; fund holdings not implemented.' },
      { id: 'mutual_funds', status: 'not_supported', scope: 'No verified fund directory/holdings source implemented.' },
      { id: 'esg', status: 'not_supported', scope: 'No standardized ESG score source implemented.' },
      { id: 'corporate_actions', status: 'not_supported', scope: 'Price adjustment labels are supported; no standalone corporate-action event feed.' },
      { id: 'economic_series', status: fred ? 'configured_not_yet_verified' : 'requires_key', scope: 'Optional FRED observations and daily historical vintages; source-specific use restrictions apply.' },
      { id: 'fx', status: 'implemented', scope: 'Optional ECB daily reference FX and dated cross-rates; not live executable FX quotes.' },
      { id: 'options_futures_otc_indices', status: 'not_supported', scope: 'No live connector implemented. ETFs and tokenized products are not substituted for underlyings.' },
    ],
    prerequisites: {
      alpaca: stock ? [] : ['APCA_API_KEY_ID', 'APCA_API_SECRET_KEY'],
      sec: sec ? [] : ['SEC_USER_AGENT with a real contact email'],
      fred: fred ? [] : ['FRED_API_KEY'],
    },
    costs: { softwareSubscriptionsUsd: 0, paidResourcesCreated: false, localRunningCost: 'Uses the existing computer; electricity, internet, storage and any future hosting/feed contracts are separate.' },
  };
}
