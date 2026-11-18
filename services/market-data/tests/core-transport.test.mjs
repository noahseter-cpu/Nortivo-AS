import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, dateValue, safeSourceUrl, sameSecret } from '../core.mjs';
import { createStore } from '../store.mjs';
import { createTransport } from '../transport.mjs';

test('strict dates and redacted source URLs do not leak provider credentials', () => {
  assert.throws(() => dateValue('2026-02-30'), { code: 'invalid_request' });
  assert.equal(dateValue('2026-11-18'), '2026-11-18');
  assert.equal(safeSourceUrl('https://example.com/data?api_key=private&token=secret&symbol=AAPL'), 'https://example.com/data?symbol=AAPL');
  assert.equal(sameSecret('a', 'a'), true); assert.equal(sameSecret('a', 'b'), false);
});

test('persistent cache retains original retrieval time and expires rather than refreshing its age', async () => {
  let now = 1800000000000, calls = 0;
  const store = createStore({ clock: () => now });
  const transport = createTransport({ store, clock: () => now, fetcher: async () => { calls++; return Response.json({ actualEventTime: '2026-01-01T00:00:00Z' }); }, sleeper: async ms => { now += ms; } });
  const args = { provider: 'kraken', url: 'https://api.kraken.com/0/public/Time', ttlMs: 2000 };
  try {
    const first = await transport.request(args); now += 1000;
    const second = await transport.request(args);
    assert.equal(calls, 1); assert.equal(second.fetchedAt, first.fetchedAt); assert.equal(second.cache.ageMs, 1000); assert.equal(second.cache.hit, true);
    now += 1001; await transport.request(args); assert.equal(calls, 2);
  } finally { store.close(); }
});

test('deduplication makes concurrent identical data requests consume one upstream attempt', async () => {
  const store = createStore(); let calls = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const transport = createTransport({ store, fetcher: async () => { calls++; await gate; return Response.json({ okay: true }); } });
  try {
    const first = transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/Time' });
    const second = transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/Time' });
    release(); assert.deepEqual(await first, await second); assert.equal(calls, 1);
  } finally { store.close(); }
});

test('fixed provider destination policy rejects SSRF and redirects are disabled', async () => {
  const store = createStore(); let calls = 0;
  const transport = createTransport({ store, fetcher: async (_, options) => { calls++; assert.equal(options.redirect, 'error'); return Response.json({}); } });
  try {
    for (const url of ['http://api.kraken.com/0/public/Time', 'https://api.kraken.com.evil.test/', 'https://127.0.0.1/', 'https://user:pass@api.kraken.com/']) await assert.rejects(transport.request({ provider: 'kraken', url }), { code: 'invalid_upstream' });
    assert.equal(calls, 0); await transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/Time' }); assert.equal(calls, 1);
  } finally { store.close(); }
});

test('429 backoff stops an already queued second request and is not silently bypassed', async () => {
  let now = 1800000000000, calls = 0;
  const store = createStore({ clock: () => now });
  const transport = createTransport({ store, clock: () => now, sleeper: async ms => { now += ms; }, fetcher: async () => { calls++; return new Response('limited', { status: 429, headers: { 'Retry-After': '60' } }); } });
  try {
    const settled = await Promise.allSettled([
      transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/Time' }),
      transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/AssetPairs' }),
    ]);
    assert.equal(calls, 1); assert(settled.every(item => item.status === 'rejected'));
    assert.equal(settled[0].reason.code, 'rate_limited');
    assert(store.health('kraken').retryAt > now);
  } finally { store.close(); }
});

test('an older in-flight success cannot clear a later provider backoff', async () => {
  let now = 1800000000000, release;
  const gate = new Promise(resolve => { release = resolve; });
  const store = createStore({ clock: () => now });
  const transport = createTransport({ store, clock: () => now, sleeper: async ms => { now += ms; }, fetcher: async url => {
    if (url.endsWith('/Time')) { await gate; return Response.json({ okay: true }); }
    return new Response('limited', { status: 429, headers: { 'Retry-After': '60' } });
  } });
  try {
    const first = transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/Time' });
    await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/AssetPairs' }), { code: 'rate_limited' });
    release(); await first;
    assert(store.health('kraken').retryAt > now); assert.equal(store.health('kraken').lastError, 'rate_limited');
  } finally { release(); store.close(); }
});

test('network errors are bounded, classified, and never return fake market data', async () => {
  let now = 1800000000000, calls = 0;
  const store = createStore({ clock: () => now });
  const transport = createTransport({ store, clock: () => now, sleeper: async ms => { now += ms; }, fetcher: async () => { calls++; throw Object.assign(new Error('secret request URL'), { cause: { code: 'ENOTFOUND' } }); } });
  try {
    await assert.rejects(transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/Time' }), error => error instanceof ApiError && error.details.cause === 'dns_unavailable' && !error.message.includes('secret'));
    assert.equal(calls, 2); assert.equal(store.health('kraken').lastError, 'temporarily_unavailable');
  } finally { store.close(); }
});

test('upstream JSON and response byte bounds are enforced', async () => {
  const store = createStore();
  const transport = createTransport({ store, fetcher: async () => new Response('{"large":"1234567890"}') });
  try { await assert.rejects(transport.request({ provider: 'kraken', url: 'https://api.kraken.com/0/public/Time', maxBytes: 5 }), { code: 'invalid_upstream_data' }); }
  finally { store.close(); }
});

test('quota claims roll back all periods when one budget is exhausted', () => {
  const store = createStore({ clock: () => 1800000000000 });
  try {
    store.claim('fixture', { minute: 10, day: 1 });
    assert.throws(() => store.claim('fixture', { minute: 10, day: 1 }), { code: 'rate_limited' });
    const stats = store.stats({ fixture: { minute: 10, day: 1 } });
    assert.equal(stats.fixture.quota.minute.used, 1); assert.equal(stats.fixture.quota.day.used, 1);
  } finally { store.close(); }
});

test('HTTP-200 provider error envelopes are never cached as valid data', async () => {
  let now = 1800000000000, calls = 0;
  const store = createStore({ clock: () => now });
  const transport = createTransport({ store, clock: () => now, sleeper: async ms => { now += ms; }, fetcher: async () => { calls++; return Response.json(calls === 1 ? { error: ['EAPI:Rate limit exceeded'] } : { error: [], result: { actual: true } }); } });
  const args = { provider: 'kraken', url: 'https://api.kraken.com/0/public/AssetPairs', ttlMs: 86400000 };
  try {
    await assert.rejects(transport.request(args), { code: 'rate_limited' });
    now += 61000;
    const result = await transport.request(args);
    assert.equal(result.cache.hit, false); assert.equal(result.body.result.actual, true); assert.equal(calls, 2);
  } finally { store.close(); }
});
