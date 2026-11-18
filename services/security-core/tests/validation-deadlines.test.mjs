import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, createSessionVerifier, createRateLimiter, createAuditLogger, randomSessionToken, terminalSessionLookup } from '../src/index.mjs';

const req = body => new Request('https://test.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}) });
test('body reader limits actual streamed bytes without relying on Content-Length', async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"x":"')); controller.enqueue(new TextEncoder().encode('x'.repeat(100))); controller.close(); } });
  await assert.rejects(readJson(req(body), { maxBytes: 30 }), { code: 'BODY_TOO_LARGE' });
});
test('deep objects, invalid UTF-8, misleading length and nested prototype keys are rejected', async () => {
  await assert.rejects(readJson(req('{"x":'.repeat(14) + '0' + '}'.repeat(14))), { code: 'INVALID_BODY' });
  await assert.rejects(readJson(req(new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125]))), { code: 'INVALID_BODY' });
  const request = req('{"x":"' + 'a'.repeat(100) + '"}'); request.headers.set('content-length', '2');
  await assert.rejects(readJson(request, { maxBytes: 30 }), { code: 'BODY_TOO_LARGE' });
  const advertised = req('{}'); advertised.headers.set('content-length', '90000');
  await assert.rejects(readJson(advertised), { code: 'BODY_TOO_LARGE' });
  await assert.rejects(readJson(req('{"x":{"constructor":{}}}')), { code: 'INVALID_BODY' });
});
test('hung session, rate and audit dependencies fail closed within a bounded deadline', async () => {
  const hung = () => new Promise(() => {});
  const session = createSessionVerifier({ lookupSession: hung, timeoutMs: 15 });
  const request = new Request('https://test.invalid', { headers: { cookie: `__Host-nortivo_security_core=${randomSessionToken()}` } });
  await assert.rejects(session(request), { code: 'AUTH_UNAVAILABLE' });
  const rate = createRateLimiter({ store: { durable: true, consumeRateLimit: hung }, key: 'r'.repeat(32), timeoutMs: 15 });
  await assert.rejects(rate({ scope: 'test', identifier: 'connection', limit: 1, windowMs: 1000 }), { code: 'RATE_LIMIT_UNAVAILABLE' });
  const audit = createAuditLogger({ key: 'a'.repeat(32), sink: hung, timeoutMs: 15 });
  await assert.rejects(audit({ event: 'request_allowed', decision: 'allow', status: 200, routeId: 'test', reason: 'AUTHORIZED' }), { code: 'AUDIT_UNAVAILABLE' });
});
test('stalled request stream is cancelled rather than waiting indefinitely', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(readJson(req(body), { timeoutMs: 15 }), { code: 'INVALID_BODY' });
  assert.equal(cancelled, true);
});
test('session bridge rejects expired and disabled identities even when session remains valid', async () => {
  for (const identity of [{ id: 'alice', roles: ['user'], expires_at: 50 }, { id: 'alice', roles: ['user'], expires_at: 'invalid' }, { id: 'alice', roles: ['user'], disabled: true }]) {
    const load = terminalSessionLookup({ loadSessionRow: async hash => ({ token_hash: hash, user_id: 'alice', created_at: 1, expires_at: 1000 }), loadIdentity: async () => identity });
    assert.equal(await load('a'.repeat(64), 100), null);
  }
});
