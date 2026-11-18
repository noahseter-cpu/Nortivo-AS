import { createHmac } from 'node:crypto';
import { SecurityCoreError } from './errors.mjs';
import { bounded } from './bounded.mjs';

const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const unavailable = () => new SecurityCoreError(503, 'RATE_LIMIT_UNAVAILABLE');
const validTime = value => Number.isSafeInteger(value) && value >= 0;
const validBudget = (limit, windowMs) => Number.isSafeInteger(limit) && limit > 0 && limit <= 1_000_000
  && Number.isSafeInteger(windowMs) && windowMs > 0 && windowMs <= MAX_WINDOW_MS;

function keyBytes(key) {
  if ((typeof key !== 'string' && !Buffer.isBuffer(key)) || Buffer.byteLength(key) < 32 || Buffer.byteLength(key) > 1024) throw unavailable();
  return Buffer.from(key);
}

/**
 * The production store must be a server-owned, shared, atomic rate-limit store.
 * `durable: true` is an integration assertion, not a durability verification.
 * Never mark an in-memory or per-function-instance store durable.
 */
export function createRateLimiter({ store, key, now = Date.now, production = true, timeoutMs = 5000 } = {}) {
  const secret = keyBytes(key);
  if (!store || typeof store.consumeRateLimit !== 'function' || typeof now !== 'function'
    || typeof production !== 'boolean' || (production && store.durable !== true)) throw unavailable();

  return async function consume({ scope, identifier, limit, windowMs } = {}) {
    if (typeof scope !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(scope)
      || typeof identifier !== 'string' || identifier.length < 1 || Buffer.byteLength(identifier) > 512
      || !validBudget(limit, windowMs)) throw unavailable();
    let time;
    try { time = now(); } catch { throw unavailable(); }
    if (!validTime(time)) throw unavailable();

    const storageKey = createHmac('sha256', secret)
      .update('security-core:rate:v1:').update(JSON.stringify([scope, identifier])).digest('hex');
    let result;
    try { result = await bounded(() => store.consumeRateLimit(storageKey, limit, windowMs, time), timeoutMs); }
    catch { throw unavailable(); }
    if (!result || typeof result.allowed !== 'boolean' || !Number.isFinite(result.retryAfterMs)
      || result.retryAfterMs < 0 || result.retryAfterMs > windowMs) throw unavailable();
    if (!result.allowed) {
      const error = new SecurityCoreError(429, 'RATE_LIMITED');
      error.retryAfter = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
      throw error;
    }
  };
}

/** Local development/test implementation. It deliberately cannot satisfy production mode. */
export function createMemoryRateStore({ maxEntries = 10_000 } = {}) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 100_000) throw unavailable();
  const entries = new Map();
  return Object.freeze({
    durable: false,
    async consumeRateLimit(storageKey, limit, windowMs, time) {
      if (typeof storageKey !== 'string' || storageKey.length < 1 || storageKey.length > 200
        || !validBudget(limit, windowMs) || !validTime(time) || !Number.isSafeInteger(time + windowMs)) throw unavailable();
      // No await before the counter update: parallel callers in this process share one atomic update.
      for (const [id, entry] of entries) if (entry.expiresAt <= time) entries.delete(id);
      let entry = entries.get(storageKey);
      if (!entry) {
        // Never evict an unexpired key: doing so would give an attacker a fresh budget.
        if (entries.size >= maxEntries) throw unavailable();
        entry = { count: 0, limit, windowMs, expiresAt: time + windowMs, lastSeenAt: time };
        entries.set(storageKey, entry);
      }
      if (entry.limit !== limit || entry.windowMs !== windowMs || time < entry.lastSeenAt) throw unavailable();
      entry.lastSeenAt = time;
      if (entry.count >= limit) return { allowed: false, retryAfterMs: entry.expiresAt - time };
      entry.count += 1;
      return { allowed: true, retryAfterMs: 0 };
    },
  });
}
