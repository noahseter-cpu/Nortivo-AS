import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ApiError } from './core.mjs';

export function createStore({ path = ':memory:', clock = Date.now, maxEntries = 2000 } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, provider TEXT NOT NULL, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS quota (provider TEXT NOT NULL, period TEXT NOT NULL, window INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(provider,period,window));
    CREATE TABLE IF NOT EXISTS health (provider TEXT PRIMARY KEY, payload TEXT NOT NULL);`);
  const getCache = db.prepare('SELECT * FROM cache WHERE key = ?');
  function prune() {
    db.prepare('DELETE FROM cache WHERE expires_at <= ?').run(clock());
    db.prepare('DELETE FROM quota WHERE window < ?').run(clock() - 2 * 86400000);
  }
  prune();
  return {
    get(key) {
      const row = getCache.get(key);
      if (!row) return null;
      if (row.expires_at <= clock()) { db.prepare('DELETE FROM cache WHERE key=?').run(key); return null; }
      return { body: JSON.parse(row.payload), fetchedAt: new Date(row.fetched_at).toISOString(), ageMs: Math.max(0, clock() - row.fetched_at) };
    },
    put(key, provider, body, ttlMs, fetchedAt = clock()) {
      if (!(ttlMs > 0)) return;
      const payload = JSON.stringify(body);
      if (Buffer.byteLength(payload) > 16_000_000) return;
      prune();
      db.prepare('INSERT OR REPLACE INTO cache VALUES (?,?,?,?,?)').run(key, provider, payload, fetchedAt, fetchedAt + ttlMs);
      db.prepare('DELETE FROM cache WHERE key IN (SELECT key FROM cache ORDER BY fetched_at DESC LIMIT -1 OFFSET ?)').run(maxEntries);
    },
    claim(provider, limits, units = 1) {
      const periods = { second: 1000, minute: 60000, day: 86400000 }, now = clock();
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const [period, max] of Object.entries(limits)) {
          const size = periods[period], window = Math.floor(now / size) * size;
          const row = db.prepare('SELECT used FROM quota WHERE provider=? AND period=? AND window=?').get(provider, period, window);
          if ((row?.used || 0) + units > max) {
            throw new ApiError('rate_limited', 'The shared upstream request allowance is exhausted. Retry after the quota resets.', 429, { provider, period, retryAfterSeconds: Math.max(1, Math.ceil((window + size - now) / 1000)) });
          }
          db.prepare('INSERT INTO quota VALUES (?,?,?,?) ON CONFLICT(provider,period,window) DO UPDATE SET used=used+excluded.used').run(provider, period, window, units);
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    health(provider, update) {
      const current = JSON.parse(db.prepare('SELECT payload FROM health WHERE provider=?').get(provider)?.payload || '{}');
      if (update) db.prepare('INSERT OR REPLACE INTO health VALUES (?,?)').run(provider, JSON.stringify({ ...current, ...update }));
      return update ? { ...current, ...update } : current;
    },
    stats(limits) {
      prune();
      const now = clock();
      return Object.fromEntries(Object.entries(limits).map(([provider, caps]) => [provider, {
        health: this.health(provider),
        quota: Object.fromEntries(Object.entries(caps).map(([period, limit]) => {
          const size = { second: 1000, minute: 60000, day: 86400000 }[period], window = Math.floor(now / size) * size;
          const used = db.prepare('SELECT used FROM quota WHERE provider=? AND period=? AND window=?').get(provider, period, window)?.used || 0;
          return [period, { used, limit, resetsAt: new Date(window + size).toISOString() }];
        })),
      }]));
    },
    prune,
    close() { db.close(); },
  };
}
