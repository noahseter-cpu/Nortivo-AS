import { fail, sha256 } from '../terminal/security.mjs';

export const SYSTEM_OWNER = '00000000-0000-4000-8000-000000000001';
export const clean = (value, max = 200) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
export const iso = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
export const safeLink = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } };
export const decimal = value => /^(?:0|[1-9]\d{0,14})(?:\.\d{1,8})?$/.test(String(value)) && Number(value) > 0 ? String(value) : null;
export function requestId(value) { if (!/^[A-Za-z0-9_-]{8,128}$/.test(value || '')) fail('REQUEST_ID_REQUIRED', 'Use a stable request ID for this action.', 400); return value; }
export async function owned(store, ns, key, userId) { const row = await store.get(ns, key); if (!row || row.ownerId !== userId) fail('NOT_FOUND', 'This record is unavailable.', 404); return row; }
export const change = (ns, key, ownerId, row, value, expiresAt = null) => ({ ns, key, ownerId, expectedVersion: row?.version ?? null, value, expiresAt });
export async function updateRecord(store, ns, key, ownerId, transform, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const row = await store.get(ns, key);
    if (row && row.ownerId !== ownerId) fail('NOT_FOUND', 'This record is unavailable.', 404);
    const value = await transform(row?.value ?? null, row);
    const result = await store.transact([change(ns, key, ownerId, row, value)]);
    if (result.status === 'applied') return value;
  }
  fail('CONCURRENT_UPDATE', 'Another action is updating this account. Retry with the same request ID.', 409);
}
export async function* recordPages(store, ns, options = {}) {
  let afterKey;
  for (let page = 0; page < 1000; page++) {
    const rows = await store.list(ns, { ...options, limit: Math.min(options.limit || 100, 1000), ...(afterKey ? { afterKey } : {}) });
    if (!rows.length) return;
    yield rows;
    const next = rows.at(-1).key;
    if (next === afterKey) fail('STORAGE_PAGINATION_REQUIRED', 'The current data migration is required before background execution can continue.', 503);
    afterKey = next;
    if (rows.length < Math.min(options.limit || 100, 1000)) return;
  }
  fail('WORKER_CAPACITY_LIMIT', 'Background execution reached its configured scan capacity. New entries are paused.', 503);
}
export async function listAllRecords(store, ns, options = {}) { const result = []; for await (const rows of recordPages(store, ns, options)) { result.push(...rows); if (result.length > 50000) fail('WORKER_CAPACITY_LIMIT', 'Account execution history requires an operator review before new entries.', 503); } return result; }

// This manifest is release evidence recorded by the owner, not a substitute for a contract.
// Each capability needs its own document reference, expiry, markets and explicit use rights.
export function rightsFor(env, capability, provider) {
  let manifest; try { manifest = JSON.parse(env.PRODUCT_PROVIDER_RIGHTS_JSON || '{}'); } catch { manifest = {}; }
  const row = manifest[capability];
  const ready = Boolean(row && row.provider === provider && typeof row.documentRef === 'string' && row.documentRef.length >= 8 && Number.isFinite(Date.parse(row.validUntil)) && Date.parse(row.validUntil) > Date.now() && row.externalDisplay === true && Array.isArray(row.markets) && row.markets.includes(capability === 'calendar' ? 'global' : capability === 'fx' ? 'FX' : 'US'));
  return { ready, nonDisplay: ready && row.nonDisplay === true, ai: ready && row.aiProcessing === true, cacheSeconds: ready && Number.isInteger(row.cacheSeconds) ? Math.max(0, Math.min(row.cacheSeconds, 86400)) : 0, delayMinutes: ready && Number.isInteger(row.delayMinutes) && row.delayMinutes >= 0 ? row.delayMinutes : null, coverage: ready ? clean(row.coverage, 160) : null };
}

export async function readJsonResponse(response, maxBytes = 2_000_000) {
  if (Number(response.headers.get('content-length')) > maxBytes) fail('PROVIDER_INVALID_DATA', 'The provider response exceeded its permitted size.', 502);
  let length = 0; const chunks = [];
  for await (const chunk of response.body || []) { length += chunk.byteLength; if (length > maxBytes) fail('PROVIDER_INVALID_DATA', 'The provider response exceeded its permitted size.', 502); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('PROVIDER_INVALID_DATA', 'The provider returned an unreadable response.', 502); }
}

export function createProviderTransport({ env, fetcher = fetch, store, clock = Date.now }) {
  async function meter(provider, units) {
    const now = clock(), key = provider, windowStart = Math.floor(now / 60000) * 60000;
    const limit = Number(env[`PRODUCT_${provider.toUpperCase()}_CREDITS_PER_MINUTE`] || (provider === 'twelve' ? 55 : provider === 'tradingeconomics' ? 10 : 30));
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) fail('INTEGRATION_NOT_CONFIGURED', 'The shared provider credit limit is invalid.', 503);
    await updateRecord(store, 'provider_meter', key, SYSTEM_OWNER, current => {
      const count = (current?.windowStart === windowStart ? current.upstreamUnits : 0) + units;
      if (count > limit) fail('PROVIDER_RATE_LIMIT', 'The shared data allowance is busy. Try again shortly.', 429);
      return { upstreamUnits: count, upstreamRequests: (current?.windowStart === windowStart ? current.upstreamRequests || 0 : 0) + 1, totalUpstreamRequests: (current?.totalUpstreamRequests || 0) + 1, windowStart, updatedAt: now };
    });
  }
  async function health(capability, value) { return updateRecord(store, 'provider_health', capability, SYSTEM_OWNER, current => ({ ...current, ...value })); }
  return {
    async request({ provider, capability, url, headers, rights, units = 1, ttl = 0, method = 'GET', body, normalize }) {
      const now = clock();
      if (!rights.ready) fail('COMMERCIAL_PERMISSION_REQUIRED', 'This data service awaits verified commercial permissions.', 503);
      const requestDigest = sha256(`${provider}:${url}`), cacheKey = `slot:${requestDigest.slice(0, 2)}`, cached = ttl && rights.cacheSeconds ? await store.get('provider_cache', cacheKey) : null;
      // A fixed 256-slot collision-safe cache bounds storage over years of searches. Collisions only miss.
      if (cached?.value.requestDigest === requestDigest && cached.value.until > now) return { ...cached.value.result, cacheHit: true };
      const state = await store.get('provider_health', capability);
      if (state?.value.retryAt > now) fail('PROVIDER_BACKOFF', 'The data service is recovering. Try again shortly.', 503);
      await meter(provider, units); // Counts the actual upstream attempt; cache hits consume no credits.
      let payload, response;
      try {
        response = await fetcher(url, { method, headers: { Accept: 'application/json', ...headers }, ...(body ? { body } : {}), signal: AbortSignal.timeout(10000), redirect: 'error' });
        if (!response.ok) fail(response.status === 429 ? 'PROVIDER_RATE_LIMIT' : response.status === 401 || response.status === 403 ? 'PROVIDER_AUTHORIZATION' : 'PROVIDER_UNAVAILABLE', 'The authenticated data request did not succeed.', response.status === 429 ? 429 : 503);
        payload = await readJsonResponse(response);
        if (payload?.status === 'error' || payload?.error) fail('PROVIDER_UNAVAILABLE', 'The provider did not supply usable data.', 503);
        const result = await normalize(payload, now);
        const quoteEvidence = result.quote ? { quoteSuccessAt: now, quoteFreshness: result.quote.freshness } : {};
        const historyEvidence = result.historyType === 'adjusted_daily' && Array.isArray(result.bars) ? { historySuccessAt: now, historyBars: result.bars.length, historyInstrumentId: result.instrumentId } : {};
        await health(capability, { provider, reachable: true, lastSuccessAt: now, lastAttemptAt: now, failures: 0, retryAt: 0, ...quoteEvidence, ...historyEvidence, freshness: result.quote?.freshness || result.freshness || (capability === 'market' ? state?.value.quoteFreshness || 'unavailable' : 'current') });
        const seconds = Math.min(ttl, rights.cacheSeconds);
        if (seconds > 0 && Buffer.byteLength(JSON.stringify(result)) < 200000) await updateRecord(store, 'provider_cache', cacheKey, SYSTEM_OWNER, () => ({ requestDigest, result, until: now + seconds * 1000 }));
        return { ...result, cacheHit: false };
      } catch (error) {
        const failures = Math.min((state?.value.failures || 0) + 1, 8);
        await health(capability, { provider, reachable: false, lastAttemptAt: now, failures, retryAt: now + Math.min(300000, 1000 * 2 ** failures), errorCode: error.code || 'PROVIDER_UNAVAILABLE', freshness: 'unavailable' });
        if (error.code?.startsWith('PROVIDER_')) throw error;
        fail('PROVIDER_UNAVAILABLE', 'The data service could not be reached. Retry later.', 503);
      }
    },
  };
}
