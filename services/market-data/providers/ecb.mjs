import { ApiError } from '../core.mjs';

const API = 'https://data-api.ecb.europa.eu/service/data/EXR/';
const invalidData = message => new ApiError('provider_invalid_data', message, 502);
const code = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);

// SDMX CSV supports quoted cells, including commas and escaped double quotes in labels.
export function parseCsv(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw invalidData('ECB returned an invalid CSV response.');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else throw invalidData('ECB returned malformed CSV quoting.');
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(value => value !== '')) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw invalidData('ECB returned unterminated CSV quoting.');
  row.push(cell); if (row.some(value => value !== '')) rows.push(row);
  if (rows.length < 2) throw new ApiError('temporarily_unavailable', 'ECB returned no reference-rate observations.', 503);
  const headers = rows.shift().map(value => value.replace(/^\uFEFF/, '').trim());
  for (const required of ['CURRENCY', 'CURRENCY_DENOM', 'TIME_PERIOD', 'OBS_VALUE']) if (!headers.includes(required)) throw invalidData('ECB CSV omitted required observation columns.');
  return rows.map(values => {
    if (values.length !== headers.length) throw invalidData('ECB returned an inconsistent CSV row.');
    return Object.fromEntries(headers.map((key, i) => [key, values[i]]));
  });
}

export function createEcb({ transport, clock = Date.now }) {
  return {
    async fx({ base = 'USD', quote = 'NOK', date = null } = {}) {
      if (!code(base) || !code(quote)) throw new ApiError('invalid_request', 'Use uppercase three-letter currency codes.', 400);
      if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || Date.parse(date) > clock())) throw new ApiError('invalid_request', 'date must be a valid date not in the future (YYYY-MM-DD).', 400);
      if (base === quote) throw new ApiError('invalid_request', 'Choose two different currencies.', 400);
      const currencies = [...new Set([base, quote].filter(value => value !== 'EUR'))].sort();
      const url = new URL(`${API}D.${currencies.join('+')}.EUR.SP00.A`);
      url.searchParams.set('format', 'csvdata');
      // Fetch a small shared window so cross-rates always use a common observation date.
      url.searchParams.set('startPeriod', new Date(Date.parse(date || new Date(clock()).toISOString().slice(0, 10)) - 14 * 86_400_000).toISOString().slice(0, 10));
      url.searchParams.set('endPeriod', date || new Date(clock()).toISOString().slice(0, 10));
      const response = await transport.request({ provider: 'ecb', url: url.href, headers: { Accept: 'text/csv' }, format: 'text', ttlMs: date ? 86_400_000 : 3_600_000, maxBytes: 2_000_000 });
      const rows = parseCsv(response.body), byDate = new Map();
      for (const row of rows) {
        if (!currencies.includes(row.CURRENCY) || row.CURRENCY_DENOM !== 'EUR' || (row.FREQ && row.FREQ !== 'D') || (row.EXR_TYPE && row.EXR_TYPE !== 'SP00')) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.TIME_PERIOD) || !Number.isFinite(Date.parse(row.TIME_PERIOD)) || row.TIME_PERIOD > (date || new Date(clock()).toISOString().slice(0, 10))) throw invalidData('ECB returned an invalid observation date.');
        if (row.OBS_VALUE.trim() === '') continue;
        const value = Number(row.OBS_VALUE);
        if (!Number.isFinite(value) || value <= 0) throw invalidData('ECB returned an invalid exchange rate.');
        if (row.OBS_STATUS && !['A', 'E', 'P'].includes(row.OBS_STATUS)) continue;
        const values = byDate.get(row.TIME_PERIOD) || { EUR: 1 };
        if (values[row.CURRENCY] !== undefined && values[row.CURRENCY] !== value) throw invalidData('ECB returned conflicting observations.');
        values[row.CURRENCY] = value; byDate.set(row.TIME_PERIOD, values);
      }
      const observationDate = [...byDate.keys()].sort().reverse().find(day => byDate.get(day)[base] !== undefined && byDate.get(day)[quote] !== undefined);
      if (!observationDate) throw new ApiError('not_supported', 'No common ECB reference-rate date is available for these currencies in the requested window.', 404);
      const values = byDate.get(observationDate), rate = values[quote] / values[base];
      if (!Number.isFinite(rate) || rate <= 0) throw invalidData('The ECB cross-rate is invalid.');
      return {
        data: { base, quote, rate, observationDate, asOf: observationDate, requestedDate: date, isReferenceRate: true, live: false, inputs: { denominator: 'EUR', [base]: values[base], [quote]: values[quote] } },
        meta: { provider: 'ecb', sourceUrl: response.sourceUrl, feed: 'ECB daily euro foreign exchange reference rates', coverage: 'Official reference exchange rates; not executable live forex quotes.', latency: 'daily_reference', delaySeconds: null, asOf: observationDate, timestampPrecision: 'date', retrievedAt: response.fetchedAt, cache: response.cache, calculation: `${quote}/EUR divided by ${base}/EUR`, previousBusinessDayUsed: date !== null && observationDate !== date },
      };
    },
  };
}
