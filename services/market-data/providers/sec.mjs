import { ApiError } from '../core.mjs';

const CATALOG_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const DAY = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const usefulTags = new Set([
  'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet',
  'NetIncomeLoss', 'OperatingIncomeLoss', 'GrossProfit', 'CostOfRevenue',
  'Assets', 'AssetsCurrent', 'Liabilities', 'LiabilitiesCurrent', 'StockholdersEquity',
  'CashAndCashEquivalentsAtCarryingValue', 'LongTermDebtCurrent', 'LongTermDebtNoncurrent',
  'EarningsPerShareDiluted', 'EarningsPerShareBasic', 'CommonStockSharesOutstanding',
  'WeightedAverageNumberOfDilutedSharesOutstanding', 'NetCashProvidedByUsedInOperatingActivities',
  'PaymentsToAcquirePropertyPlantAndEquipment', 'NetCashProvidedByUsedInInvestingActivities',
  'NetCashProvidedByUsedInFinancingActivities', 'PaymentsOfDividends', 'EntityCommonStockSharesOutstanding',
]);

const text = (value, max = 250) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : null;
const invalid = message => { throw new ApiError('invalid_request', message, 400); };
const malformed = message => { throw new ApiError('invalid_provider_data', message, 502); };
function date(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}
function cikValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!/^\d{1,10}$/.test(String(value)) || Number(value) === 0) invalid('CIK must contain 1–10 digits and be nonzero.');
  return String(value).padStart(10, '0');
}
function symbolValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9.-]{0,14}$/.test(value)) invalid('Use an exact SEC-listed symbol.');
  return value.toUpperCase();
}
function boundedLimit(value, fallback, max = 500) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > max) invalid(`limit must be an integer from 1 to ${max}.`);
  return result;
}
function easternDate(time) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(time).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function easternMidnight(day) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let guess = target;
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(format.formatToParts(guess).map(part => [part.type, part.value]));
    const local = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    guess += target - local;
  }
  return guess;
}
function cutoff(value) {
  if (value === undefined || value === null || value === '') return null;
  if (date(value)) return { time: easternMidnight(value), day: value, interpretation: 'start_of_day_America/New_York' };
  if (typeof value !== 'string' || !TIMESTAMP.test(value) || !date(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) {
    invalid('asOf must be a valid YYYY-MM-DD or an ISO timestamp with an explicit timezone.');
  }
  const time = Date.parse(value);
  return { time, day: easternDate(time), interpretation: 'explicit_timestamp' };
}
function accessionUrl(cik, accession, document = null) {
  if (!/^\d{10}-\d{2}-\d{6}$/.test(accession || '')) return null;
  const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll('-', '')}/`;
  if (document && /^[A-Za-z0-9_.-]{1,200}$/.test(document)) return `${base}${document}`;
  return `${base}${accession}-index.html`;
}
function metadata(response, extra = {}) {
  return {
    provider: 'SEC EDGAR', sourceUrl: response.sourceUrl, feed: 'public_filings',
    retrievedAt: response.fetchedAt, cache: response.cache,
    coverage: 'SEC reporting entities and the records supplied by this endpoint; not a complete global security master.',
    latency: 'filing_dependent', ...extra,
  };
}

export function createSec({ transport, clock = Date.now, userAgent } = {}) {
  function headers() {
    if (typeof userAgent !== 'string' || userAgent.length > 250 || /[\r\n]/.test(userAgent)
      || !/\S+@[^\s@]+\.[^\s@]+/.test(userAgent)) {
      throw new ApiError('requires_configuration', 'Set SEC_USER_AGENT to your application name and a real contact email before requesting SEC data.', 503, { setting: 'SEC_USER_AGENT' });
    }
    return { 'User-Agent': userAgent, Accept: 'application/json' };
  }
  async function request(url, ttlMs = 3_600_000, maxBytes = 12_000_000) {
    return transport.request({ provider: 'sec', url, headers: headers(), format: 'json', ttlMs, maxBytes });
  }
  async function catalog() {
    const response = await request(CATALOG_URL, DAY, 8_000_000);
    const { fields, data } = response.body || {};
    if (!Array.isArray(fields) || !Array.isArray(data) || data.length > 100_000
      || !['cik', 'name', 'ticker', 'exchange'].every(field => fields.includes(field))) malformed('The SEC instrument directory has an unsupported structure.');
    const positions = Object.fromEntries(fields.map((field, index) => [field, index]));
    const seen = new Set();
    const instruments = [];
    for (const row of data) {
      if (!Array.isArray(row)) continue;
      const rawCik = row[positions.cik], symbol = row[positions.ticker];
      if (!/^\d{1,10}$/.test(String(rawCik)) || Number(rawCik) === 0
        || typeof symbol !== 'string' || !/^[A-Za-z][A-Za-z0-9.-]{0,14}$/.test(symbol)) continue;
      const cik = String(rawCik).padStart(10, '0'), normalizedSymbol = symbol.toUpperCase();
      const id = `SEC:${cik}:${normalizedSymbol}`;
      if (seen.has(id)) continue;
      seen.add(id);
      instruments.push({ id, symbol: normalizedSymbol, name: text(row[positions.name]), cik,
        exchange: text(row[positions.exchange], 80), assetType: 'security', currency: null,
        pricingAvailable: false, identifierScope: 'current_issuer_symbol_mapping' });
    }
    if (!instruments.length && data.length) malformed('The SEC directory contained no valid instrument records.');
    return { response, instruments };
  }
  async function resolve({ symbol, cik } = {}) {
    const requestedSymbol = symbolValue(symbol), requestedCik = cikValue(cik);
    if (!requestedSymbol && !requestedCik) invalid('Provide an exact symbol or CIK.');
    if (!requestedSymbol) return { cik: requestedCik, symbol: null };
    const { instruments } = await catalog();
    const matches = instruments.filter(row => row.symbol === requestedSymbol && (!requestedCik || row.cik === requestedCik));
    if (!matches.length) throw new ApiError('not_found', 'The requested symbol/CIK combination was not found in the current SEC directory.', 404);
    if (new Set(matches.map(row => row.cik)).size > 1) invalid('The symbol is ambiguous; also provide the issuer CIK.');
    return matches[0];
  }
  async function submissions(input) {
    const selected = await resolve(input);
    const response = await request(`https://data.sec.gov/submissions/CIK${selected.cik}.json`, 300_000, 8_000_000);
    const body = response.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || String(body.cik).padStart(10, '0') !== selected.cik || typeof body.name !== 'string') {
      malformed('The SEC submissions response did not confirm the requested CIK.');
    }
    return { selected, response, body };
  }
  return {
    async instruments({ q = '', limit = 50 } = {}) {
      limit = boundedLimit(limit, 50);
      if (typeof q !== 'string' || q.length > 100) invalid('q must be at most 100 characters.');
      const { response, instruments } = await catalog(), query = q.trim().toLowerCase();
      const matches = instruments.filter(row => !query || `${row.symbol} ${row.name} ${row.cik}`.toLowerCase().includes(query));
      matches.sort((a, b) => Number(b.symbol.toLowerCase() === query) - Number(a.symbol.toLowerCase() === query) || a.symbol.localeCompare(b.symbol));
      return { data: matches.slice(0, limit), meta: metadata(response, { totalMatches: matches.length, totalCatalogInstruments: instruments.length,
        returned: Math.min(matches.length, limit), hasMore: matches.length > limit, pointInTimeDirectory: false }) };
    },
    async company(input = {}) {
      const { selected, response, body } = await submissions(input);
      return { data: {
        cik: selected.cik, name: text(body.name), tickers: Array.isArray(body.tickers) ? body.tickers.map(value => text(value, 30)).filter(Boolean) : [],
        exchanges: Array.isArray(body.exchanges) ? body.exchanges.map(value => text(value, 80)).filter(Boolean) : [],
        sic: text(body.sic, 20), sicDescription: text(body.sicDescription), entityType: text(body.entityType, 80),
        fiscalYearEnd: /^\d{4}$/.test(body.fiscalYearEnd || '') ? body.fiscalYearEnd : null,
        stateOfIncorporation: text(body.stateOfIncorporation, 80), employees: null, marketCapitalization: null,
        website: typeof body.website === 'string' && /^https:\/\/[^\s]+$/.test(body.website) ? body.website : null,
      }, meta: metadata(response, { profileType: 'current_filing_metadata', unavailableFields: ['employees', 'marketCapitalization'], pointInTimeProfile: false }) };
    },
    async filings({ symbol, cik, form = null, limit = 50, asOf = null } = {}) {
      limit = boundedLimit(limit, 50);
      const asAt = cutoff(asOf);
      if (form !== null && (typeof form !== 'string' || !/^[A-Za-z0-9 /-]{1,30}$/.test(form))) invalid('form must be a valid SEC form name.');
      const { selected, response, body } = await submissions({ symbol, cik });
      const recent = body.filings?.recent;
      if (!recent || !Array.isArray(recent.accessionNumber) || !Array.isArray(recent.filingDate)
        || !Array.isArray(recent.form) || recent.accessionNumber.length > 25_000) malformed('SEC recent filings are unavailable or malformed.');
      const rows = [];
      for (let index = 0; index < recent.accessionNumber.length; index++) {
        const accession = recent.accessionNumber[index], filed = date(recent.filingDate[index]);
        const rawAccepted = recent.acceptanceDateTime?.[index];
        const acceptedAt = typeof rawAccepted === 'string' && TIMESTAMP.test(rawAccepted) && Number.isFinite(Date.parse(rawAccepted))
          ? new Date(rawAccepted).toISOString() : null;
        const filedForm = text(recent.form[index], 30), sourceUrl = accessionUrl(selected.cik, accession, recent.primaryDocument?.[index]);
        if (!filed || !filedForm || !sourceUrl || (form && filedForm.toUpperCase() !== form.toUpperCase())) continue;
        if (asAt && (acceptedAt ? Date.parse(acceptedAt) > asAt.time : filed >= asAt.day)) continue;
        rows.push({ cik: selected.cik, accession, form: filedForm, filed, acceptedAt,
          reportDate: date(recent.reportDate?.[index]), sourceUrl,
          primaryDocument: text(recent.primaryDocument?.[index], 200),
          primaryDocumentDescription: text(recent.primaryDocDescription?.[index]),
          isAmendment: filedForm.toUpperCase().endsWith('/A'),
        });
      }
      rows.sort((a, b) => b.filed.localeCompare(a.filed) || (b.acceptedAt || '').localeCompare(a.acceptedAt || '') || b.accession.localeCompare(a.accession));
      return { data: rows.slice(0, limit), meta: metadata(response, {
        cik: selected.cik, asOf: asAt ? new Date(asAt.time).toISOString() : null,
        asOfInterpretation: asAt?.interpretation || null, availableInRecentBlock: rows.length,
        hasMore: rows.length > limit, additionalHistoricalFilesAvailable: Array.isArray(body.filings?.files) && body.filings.files.length > 0,
        coverage: 'Recent submissions block only; older history files are not downloaded by this endpoint. Ownership forms are disclosures, not parsed transactions or holdings.',
        asOfLimitation: 'Filings without an exact acceptance timestamp are included only when filed before the cutoff Eastern calendar date. Current issuer metadata is not historical.',
      }) };
    },
    async fundamentals({ symbol, cik, asOf = null, limit = 100 } = {}) {
      limit = boundedLimit(limit, 100, 5_000);
      const asAt = cutoff(asOf), selected = await resolve({ symbol, cik });
      const response = await request(`https://data.sec.gov/api/xbrl/companyfacts/CIK${selected.cik}.json`, 3_600_000, 20_000_000);
      const body = response.body;
      if (!body || String(body.cik).padStart(10, '0') !== selected.cik || !body.facts || typeof body.facts !== 'object') malformed('The SEC facts response did not confirm the requested issuer.');
      const facts = [];
      for (const taxonomy of ['us-gaap', 'ifrs-full', 'dei']) {
        const concepts = body.facts[taxonomy];
        if (!concepts || typeof concepts !== 'object') continue;
        for (const [tag, concept] of Object.entries(concepts)) {
          if (!usefulTags.has(tag) || !concept || typeof concept !== 'object' || !concept.units || typeof concept.units !== 'object') continue;
          for (const [unit, values] of Object.entries(concept.units)) {
            if (!Array.isArray(values) || unit.length > 100) continue;
            for (const row of values) {
              const filed = date(row.filed), end = date(row.end), start = row.start === undefined ? null : date(row.start);
              if (!filed || !end || (row.start !== undefined && (!start || start > end))
                || typeof row.val !== 'number' || !Number.isFinite(row.val) || Math.abs(row.val) > Number.MAX_SAFE_INTEGER
                || !accessionUrl(selected.cik, row.accn)) continue;
              // companyfacts supplies a filing date rather than a publication timestamp. Excluding
              // the entire cutoff day is conservative and avoids accidentally using later revisions.
              if (asAt && filed >= asAt.day) continue;
              facts.push({ taxonomy, tag, label: text(concept.label), unit, value: row.val,
                start, end, periodType: start ? 'duration' : 'instant',
                durationDays: start ? Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1 : null,
                filed, form: text(row.form, 30), accession: row.accn,
                fiscalYear: Number.isInteger(row.fy) ? row.fy : null, fiscalPeriod: text(row.fp, 10),
                frame: text(row.frame, 40), sourceUrl: accessionUrl(selected.cik, row.accn),
                isAmendment: typeof row.form === 'string' && row.form.toUpperCase().endsWith('/A'),
              });
            }
          }
        }
      }
      facts.sort((a, b) => b.filed.localeCompare(a.filed) || b.end.localeCompare(a.end) || a.tag.localeCompare(b.tag) || a.unit.localeCompare(b.unit));
      return { data: { cik: selected.cik, entityName: text(body.entityName), facts: facts.slice(0, limit) }, meta: metadata(response, {
        format: 'selected_original_xbrl_facts', totalMatchingFacts: facts.length, hasMore: facts.length > limit,
        asOf: asAt ? new Date(asAt.time).toISOString() : null, asOfInterpretation: asAt?.interpretation || null,
        asOfLimitation: 'Facts filed on the cutoff Eastern calendar date are excluded because exact publication times are unavailable. Current companyfacts is not a complete historical publication database.',
        normalization: 'Original units, duration, fiscal-period labels, and all reported revisions are preserved. No YTD cash flow is relabeled as a standalone quarter. This is not a complete normalized financial statement.',
        generatedAt: new Date(clock()).toISOString(),
      }) };
    },
  };
}
