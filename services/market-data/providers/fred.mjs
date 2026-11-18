import { ApiError } from '../core.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value, label) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !DATE.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new ApiError('invalid_request', `${label} must be a valid YYYY-MM-DD date.`, 400);
  }
  return value;
}

export function createFred({ transport, clock = Date.now, apiKey } = {}) {
  return {
    async series({ seriesId, start = null, end = null, asOf = null, limit = 1000 } = {}) {
      if (typeof seriesId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(seriesId)) throw new ApiError('invalid_request', 'Provide a valid FRED series ID.', 400);
      start = validDate(start, 'start'); end = validDate(end, 'end'); asOf = validDate(asOf, 'asOf');
      if (start && end && start > end) throw new ApiError('invalid_request', 'start must be on or before end.', 400);
      limit = Number(limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new ApiError('invalid_request', 'limit must be an integer from 1 to 10000.', 400);
      if (typeof apiKey !== 'string' || !/^[a-fA-F0-9]{32}$/.test(apiKey)) {
        throw new ApiError('requires_key', 'Configure a free FRED_API_KEY to request economic series.', 503, { setting: 'FRED_API_KEY' });
      }
      const url = new URL('https://api.stlouisfed.org/fred/series/observations');
      url.searchParams.set('series_id', seriesId);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('file_type', 'json');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('sort_order', 'desc');
      url.searchParams.set('units', 'lin');
      if (start) url.searchParams.set('observation_start', start);
      if (end) url.searchParams.set('observation_end', end);
      if (asOf) { url.searchParams.set('realtime_start', asOf); url.searchParams.set('realtime_end', asOf); }
      const response = await transport.request({ provider: 'fred', url: url.href, format: 'json', ttlMs: 3_600_000, maxBytes: 8_000_000 });
      const body = response.body;
      if (!body || !Array.isArray(body.observations) || body.observations.length > 10_000
        || body.observations.length > limit || body.error_code) {
        throw new ApiError('invalid_provider_data', 'FRED returned an unsupported observations response.', 502);
      }
      let vintageStart, vintageEnd;
      try {
        vintageStart = validDate(body.realtime_start, 'provider realtime_start');
        vintageEnd = validDate(body.realtime_end, 'provider realtime_end');
      } catch { throw new ApiError('invalid_provider_data', 'FRED returned an invalid vintage date.', 502); }
      if (!vintageStart || !vintageEnd || vintageStart > vintageEnd) throw new ApiError('invalid_provider_data', 'FRED returned an invalid vintage range.', 502);
      if (asOf && (body.realtime_start !== asOf || body.realtime_end !== asOf)) {
        throw new ApiError('invalid_provider_data', 'FRED did not confirm the requested historical vintage.', 502);
      }
      const observations = [], seenDates = new Set();
      for (const row of body.observations) {
        let observed, realtimeStart, realtimeEnd;
        try {
          observed = validDate(row.date, 'provider observation date');
          realtimeStart = validDate(row.realtime_start, 'provider vintage start');
          realtimeEnd = validDate(row.realtime_end, 'provider vintage end');
        } catch { throw new ApiError('invalid_provider_data', 'FRED returned an invalid date.', 502); }
        if (!observed || seenDates.has(observed) || !realtimeStart || !realtimeEnd || realtimeStart > realtimeEnd
          || (start && observed < start) || (end && observed > end)
          || (asOf && (realtimeStart > asOf || realtimeEnd < asOf))) {
          throw new ApiError('invalid_provider_data', 'FRED returned observations outside the requested date or vintage range.', 502);
        }
        seenDates.add(observed);
        let value = null;
        if (row.value !== '.') {
          if (typeof row.value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(row.value) || !Number.isFinite(Number(row.value))) {
            throw new ApiError('invalid_provider_data', 'FRED returned an invalid economic value.', 502);
          }
          value = Number(row.value);
        }
        observations.push({ date: observed, value, missing: row.value === '.', realtimeStart, realtimeEnd });
      }
      observations.sort((a, b) => a.date.localeCompare(b.date));
      // Never expose the authenticated transport URL; FRED v1 sends its key in the query.
      return { data: { seriesId, observations }, meta: {
        provider: 'FRED', sourceUrl: `https://fred.stlouisfed.org/series/${encodeURIComponent(seriesId)}`,
        feed: 'economic_observations', retrievedAt: response.fetchedAt, cache: response.cache,
        asOf, vintageStart: body.realtime_start, vintageEnd: body.realtime_end,
        asOfInterpretation: asOf ? 'FRED_daily_vintage_not_intraday_publication_time' : 'latest_available_vintage',
        asOfLimitation: 'FRED vintage dates have daily granularity and are not exact release timestamps.',
        frequency: null, units: null, transformation: body.units || 'lin', latency: 'series_release_schedule',
        coverage: 'Requested FRED series and the available requested vintage; not a live price feed.',
        hasMore: Number.isInteger(body.count) ? body.count > observations.length : null,
        reportedObservationCount: Number.isInteger(body.count) ? body.count : null,
        rights: 'Underlying series can have separate third-party reuse restrictions; verify before public display.',
        generatedAt: new Date(clock()).toISOString(),
      } };
    },
  };
}
