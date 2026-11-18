import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, createMemoryRateStore } from '../src/rate-limit.mjs';
import { createAuditLogger, evaluateAlerts } from '../src/audit.mjs';

const key = 'test-only-key-material-at-least-32-bytes';
const budget = { scope: 'private.read', identifier: '203.0.113.5', limit: 2, windowMs: 60_000 };
const isError = (status, code) => error => error.status === status && error.code === code;

test('shared atomic counter permits only its budget under concurrent calls', async () => {
  const consume = createRateLimiter({ store: createMemoryRateStore(), key, now: () => 1000, production: false });
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => consume(budget)));
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 2);
  for (const result of results.filter(item => item.status === 'rejected')) {
    assert.equal(result.reason.code, 'RATE_LIMITED');
    assert.equal(result.reason.status, 429);
    assert.equal(result.reason.retryAfter, 60);
  }
});

test('production requires a declared shared durable store', () => {
  assert.throws(() => createRateLimiter({ store: createMemoryRateStore(), key }), isError(503, 'RATE_LIMIT_UNAVAILABLE'));
  assert.throws(() => createRateLimiter({ store: { consumeRateLimit() {} }, key }), isError(503, 'RATE_LIMIT_UNAVAILABLE'));
  assert.throws(() => createRateLimiter({ store: { durable: true, consumeRateLimit() {} }, key: 'weak' }), isError(503, 'RATE_LIMIT_UNAVAILABLE'));
});

test('store receives only a domain-separated HMAC identifier and rate parameters', async () => {
  const calls = [];
  const consume = createRateLimiter({ key, now: () => 1000, store: { durable: true, async consumeRateLimit(...args) { calls.push(args); return { allowed: true, retryAfterMs: 0 }; } } });
  await consume(budget);
  await consume({ ...budget, scope: 'private.write' });
  assert.match(calls[0][0], /^[a-f0-9]{64}$/);
  assert.notEqual(calls[0][0], calls[1][0]);
  assert(!JSON.stringify(calls).includes(budget.identifier));
  assert.deepEqual(calls[0].slice(1), [2, 60_000, 1000]);
});

test('outages and malformed store responses fail closed', async () => {
  for (const response of [undefined, {}, { allowed: 'yes', retryAfterMs: 0 }, { allowed: true, retryAfterMs: NaN }, { allowed: false, retryAfterMs: -1 }, { allowed: false, retryAfterMs: 60_001 }]) {
    const consume = createRateLimiter({ key, store: { durable: true, async consumeRateLimit() { return response; } } });
    await assert.rejects(consume(budget), isError(503, 'RATE_LIMIT_UNAVAILABLE'));
  }
  const consume = createRateLimiter({ key, store: { durable: true, async consumeRateLimit() { throw new Error('database credential secret'); } } });
  await assert.rejects(consume(budget), error => error.code === 'RATE_LIMIT_UNAVAILABLE' && !error.message.includes('credential'));
});

test('memory budget expires and prunes capacity without evicting active keys', async () => {
  let time = 0;
  const consume = createRateLimiter({ store: createMemoryRateStore({ maxEntries: 1 }), key, now: () => time, production: false });
  await consume({ ...budget, limit: 1 });
  await assert.rejects(consume({ ...budget, identifier: 'different', limit: 1 }), isError(503, 'RATE_LIMIT_UNAVAILABLE'));
  await assert.rejects(consume({ ...budget, limit: 1 }), isError(429, 'RATE_LIMITED'));
  time = 60_000;
  await consume({ ...budget, identifier: 'different', limit: 1 });
});

test('rate inputs, clock rollback and changed budgets fail closed', async () => {
  let time = 1000;
  const consume = createRateLimiter({ store: createMemoryRateStore(), key, now: () => time, production: false });
  for (const invalid of [{ ...budget, limit: 0 }, { ...budget, limit: 1.5 }, { ...budget, windowMs: Infinity }, { ...budget, scope: '../request' }, { ...budget, identifier: '' }]) {
    await assert.rejects(consume(invalid), isError(503, 'RATE_LIMIT_UNAVAILABLE'));
  }
  await consume(budget);
  await assert.rejects(consume({ ...budget, limit: 3 }), isError(503, 'RATE_LIMIT_UNAVAILABLE'));
  time = 999;
  await assert.rejects(consume(budget), isError(503, 'RATE_LIMIT_UNAVAILABLE'));
});

const auditInput = { event: 'request_denied', decision: 'deny', routeId: 'account.read', status: 403, reason: 'FORBIDDEN', requestId: 'request-123' };

test('audit discards arbitrary nested fields and pseudonymizes client and subject IDs', async () => {
  const lines = [];
  const emit = createAuditLogger({ key, now: () => 1000, sink: async line => { lines.push(line); } });
  const result = await emit({ ...auditInput, subjectId: 'same-identity', clientId: 'same-identity', headers: { Authorization: 'Bearer stolen-secret' }, body: { password: 'nested-secret' }, message: 'raw error secret', url: '/api?token=secret' });
  const record = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(record), ['version', 'timestamp', 'event', 'decision', 'routeId', 'status', 'requestId', 'reason', 'subjectId', 'clientId']);
  assert.match(record.subjectId, /^[a-f0-9]{64}$/);
  assert.notEqual(record.subjectId, record.clientId);
  assert(!lines[0].includes('secret'));
  assert(!lines[0].includes('same-identity'));
  assert(!lines[0].includes('\n'));
  assert.equal(record.timestamp, '1970-01-01T00:00:01.000Z');
  assert(Object.isFrozen(result));
  assert.equal((await emit({ ...auditInput, subjectId: 'same-identity' })).subjectId, record.subjectId);
});

test('CRLF metadata cannot create forged log records and event metadata is validated', async () => {
  const lines = [];
  const emit = createAuditLogger({ key, sink: line => lines.push(line) });
  for (const input of [
    { ...auditInput, routeId: 'api\nforged' },
    { ...auditInput, requestId: 'req\r\nforged' },
    { ...auditInput, reason: 'FORBIDDEN\nforged' },
    { ...auditInput, reason: 'Error with secret details' },
    { ...auditInput, reason: 'SECRET_TOKEN_VALUE' },
    { ...auditInput, event: 'unknown_event' },
    { ...auditInput, status: 200 },
    { ...auditInput, decision: 'allow' },
    { ...auditInput, durationMs: Infinity },
  ]) await assert.rejects(emit(input), isError(503, 'AUDIT_UNAVAILABLE'));
  assert.equal(lines.length, 0);
  await emit({ ...auditInput, subjectId: 'user\nwith\rnewline' });
  assert.equal(lines.length, 1);
  assert(!lines[0].includes('\n'));
});

test('audit sink failures are awaited and fail closed without exposing error details', async () => {
  const emit = createAuditLogger({ key, sink: async () => { throw new Error('sink credential secret'); } });
  await assert.rejects(emit(auditInput), error => error.status === 503 && error.code === 'AUDIT_UNAVAILABLE' && !error.message.includes('secret'));
  assert.throws(() => createAuditLogger({ key: 'weak', sink() {} }), isError(503, 'AUDIT_UNAVAILABLE'));
});

test('alert evaluation uses caller-selected window and emits only deterministic safe summaries', () => {
  const events = [
    ...Array.from({ length: 10 }, () => ({ ...auditInput, url: 'secret' })),
    ...Array.from({ length: 3 }, () => ({ event: 'dependency_unavailable', decision: 'deny', routeId: 'account.write', status: 503, body: 'secret' })),
    { event: 'request_denied', decision: 'deny', routeId: 'bad\nsecret', status: 403 },
    { event: 'request_allowed', decision: 'allow', routeId: 'account.read', status: 200 },
  ];
  assert.deepEqual(evaluateAlerts(events), [
    { rule: 'DENIAL_THRESHOLD', routeId: 'account.read', count: 10, severity: 'warning' },
    { rule: 'DEPENDENCY_UNAVAILABLE', routeId: 'account.write', count: 3, severity: 'critical' },
  ]);
  assert.deepEqual(evaluateAlerts(events, { denialThreshold: 20, unavailableThreshold: 4 }), []);
  assert.throws(() => evaluateAlerts([], { denialThreshold: 0 }), isError(503, 'AUDIT_UNAVAILABLE'));
});
