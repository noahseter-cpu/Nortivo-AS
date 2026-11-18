import { setTimeout as wait } from 'node:timers/promises';
import { ApiError, digest, safeSourceUrl } from './core.mjs';

export const PROVIDER_HOSTS = Object.freeze({
  kraken: ['api.kraken.com'], ecb: ['data-api.ecb.europa.eu'],
  sec: ['www.sec.gov', 'data.sec.gov'], fred: ['api.stlouisfed.org'],
  alpaca: ['data.alpaca.markets'],
  fed: ['www.federalreserve.gov'], bls: ['www.bls.gov'],
});
export const DEFAULT_LIMITS = Object.freeze({
  kraken: { second: 1, minute: 50, day: 10000 },
  ecb: { second: 2, minute: 20, day: 500 },
  sec: { second: 4, minute: 90, day: 10000 },
  fred: { second: 2, minute: 60, day: 5000 },
  alpaca: { second: 3, minute: 180, day: 10000 },
  fed: { second: 1, minute: 5, day: 100 },
  bls: { second: 1, minute: 5, day: 100 },
});

async function limitedBody(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new ApiError('invalid_upstream_data', 'The upstream response exceeded the size limit.', 502);
  const chunks = []; let length = 0;
  for await (const chunk of response.body || []) {
    length += chunk.byteLength;
    if (length > maxBytes) throw new ApiError('invalid_upstream_data', 'The upstream response exceeded the size limit.', 502);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createTransport({ store, fetcher = fetch, clock = Date.now, limits = DEFAULT_LIMITS, timeoutMs = 12000, sleeper = wait } = {}) {
  const pending = new Map(), lastStart = new Map(), queues = new Map();
  async function paced(provider) {
    const previous = queues.get(provider) || Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const spacing = Math.ceil(1000 / limits[provider].second);
      const ms = (lastStart.get(provider) || 0) + spacing - clock();
      if (ms > 0) await sleeper(ms);
      lastStart.set(provider, clock());
    });
    queues.set(provider, next);
    await next;
  }
  async function request({ provider, url, headers = {}, format = 'json', ttlMs = 0, maxBytes = 8_000_000 }) {
    let target;
    try { target = new URL(url); } catch { throw new ApiError('invalid_upstream', 'Invalid provider destination.', 500); }
    if (target.protocol !== 'https:' || target.port || target.username || target.password || !PROVIDER_HOSTS[provider]?.includes(target.hostname)) {
      throw new ApiError('invalid_upstream', 'The provider destination is not allowed.', 500);
    }
    if (!['json', 'text'].includes(format)) throw new ApiError('invalid_upstream', 'Unsupported upstream format.', 500);
    const sourceUrl = safeSourceUrl(target), key = digest(JSON.stringify({ provider, url, headers, format }));
    const cached = ttlMs > 0 ? store.get(key) : null;
    if (cached) return { ...cached, cache: { hit: true, stale: false, ageMs: cached.ageMs }, sourceUrl };
    if (pending.has(key)) return structuredClone(await pending.get(key));
    const task = (async () => {
      const health = store.health(provider);
      if (health.retryAt > clock()) throw new ApiError('temporarily_unavailable', 'This provider is in a short recovery period.', 503, { provider, retryAfterSeconds: Math.ceil((health.retryAt - clock()) / 1000) });
      let lastError;
      for (let attempt = 0; attempt < 2; attempt++) {
        await paced(provider);
        const attemptHealth = store.health(provider);
        if (attemptHealth.retryAt > clock()) throw new ApiError('temporarily_unavailable', 'This provider is in a short recovery period.', 503, { provider, retryAfterSeconds: Math.ceil((attemptHealth.retryAt - clock()) / 1000) });
        const failureVersion = attemptHealth.failureVersion || 0;
        store.claim(provider, limits[provider]);
        try {
          const response = await fetcher(target.href, { method: 'GET', headers: { Accept: format === 'json' ? 'application/json' : 'text/csv, application/xml;q=0.9, text/plain;q=0.8', ...headers }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
          if (!response.ok) {
            const status = response.status;
            await response.body?.cancel();
            if (status === 429) {
              const retryHeader = response.headers.get('retry-after');
              const seconds = /^\d+$/.test(retryHeader || '') ? Math.min(Number(retryHeader), 3600) : Math.max(1, Math.min(3600, Math.ceil((Date.parse(retryHeader) - clock()) / 1000) || 60));
              throw new ApiError('rate_limited', 'The upstream provider is rate limiting requests.', 429, { provider, retryAfterSeconds: seconds });
            }
            if ([401, 403].includes(status)) throw new ApiError('plan_restricted', 'The provider refused access. Check credentials, permissions and plan access.', 503, { provider, upstreamStatus: status });
            if (status === 404) throw new ApiError('not_found', 'The provider has no data at this endpoint.', 404, { provider });
            if (status >= 500 && attempt === 0) { await sleeper(200); continue; }
            throw new ApiError('temporarily_unavailable', 'The upstream provider did not return usable data.', 503, { provider, upstreamStatus: status });
          }
          const text = await limitedBody(response, maxBytes);
          let body = text;
          if (format === 'json') {
            try { body = JSON.parse(text); } catch { throw new ApiError('invalid_upstream_data', 'The provider returned invalid JSON.', 502, { provider }); }
            if (provider === 'kraken' && Array.isArray(body?.error) && body.error.length) {
              if (body.error.some(value => /rate limit|throttled/i.test(String(value)))) throw new ApiError('rate_limited', 'Kraken temporarily limited requests.', 429, { provider, retryAfterSeconds: 60 });
              throw new ApiError('temporarily_unavailable', 'Kraken returned an upstream error instead of market data.', 503, { provider });
            }
            if (provider === 'fred' && body?.error_code) throw new ApiError('plan_restricted', 'FRED refused the data request. Check the key and series access.', 503, { provider });
            if (provider === 'alpaca' && body?.code && !body.trade && !Array.isArray(body.bars)) throw new ApiError('temporarily_unavailable', 'Alpaca returned an error instead of market data.', 503, { provider });
          }
          const fetchedMs = clock(), fetchedAt = new Date(fetchedMs).toISOString();
          if (ttlMs > 0) store.put(key, provider, body, Math.min(ttlMs, 86400000), fetchedMs);
          const current = store.health(provider);
          store.health(provider, { lastAttemptAt: fetchedAt, lastSuccessAt: fetchedAt, ...((current.failureVersion || 0) === failureVersion ? { failures: 0, retryAt: 0, lastError: null } : {}) });
          return { body, fetchedAt, cache: { hit: false, stale: false, ageMs: 0 }, sourceUrl };
        } catch (error) {
          lastError = error instanceof ApiError ? error : new ApiError('temporarily_unavailable', 'The provider could not be reached from this runtime.', 503, { provider, cause: /ENOTFOUND|EAI_AGAIN/.test(error.cause?.code || '') ? 'dns_unavailable' : error.name === 'TimeoutError' ? 'timeout' : 'network_error' });
          if (!(error instanceof ApiError) && attempt === 0) { await sleeper(200); continue; }
          const failures = Math.min((store.health(provider).failures || 0) + 1, 6);
          const retryMs = lastError.details.retryAfterSeconds ? lastError.details.retryAfterSeconds * 1000 : Math.min(60000, 1000 * 2 ** failures);
          store.health(provider, { lastAttemptAt: new Date(clock()).toISOString(), failures, failureVersion: (store.health(provider).failureVersion || 0) + 1, retryAt: clock() + retryMs, lastError: lastError.code });
          throw lastError;
        }
      }
      throw lastError;
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }
  return { request, stats: () => store.stats(limits), limits };
}
