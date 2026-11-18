import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSecurityCore, createSessionVerifier, randomSessionToken, createRateLimiter, createMemoryRateStore, createAuditLogger, netlifyHandler, terminalSessionLookup, terminalRateStore } from '../src/index.mjs';

const TIME = 1795000000000;
const ORIGIN = 'https://security.nortivo.test';
function fixture({ auditFailure = false, lookupFailure = false, limit = 100 } = {}) {
  const raw = randomSessionToken(), hash = createHash('sha256').update(raw).digest('hex');
  const records = new Map([[hash, { subjectId: 'alice', roles: ['user'], createdAt: TIME - 1000, expiresAt: TIME + 60000 }]]);
  const logs = [];
  const verifySession = createSessionVerifier({ now: () => TIME, lookupSession: async id => { if (lookupFailure) throw Error('secret-database-url'); return records.get(id); } });
  const consumeRate = createRateLimiter({ store: createMemoryRateStore(), key: 'r'.repeat(32), now: () => TIME, production: false });
  const audit = createAuditLogger({ key: 'a'.repeat(32), now: () => TIME, sink: line => { if (auditFailure) throw Error('secret-sink-url'); logs.push(line); } });
  const sentinel = createSecurityCore({ origins: [ORIGIN], verifySession, consumeRate, audit, csrfKey: 'c'.repeat(32), now: () => TIME });
  const request = (path = '/private', { method = 'GET', body, headers = {}, signed = true } = {}) => new Request(`${ORIGIN}${path}`, { method, headers: { ...(signed ? { cookie: `__Host-nortivo_security_core=${raw}` } : {}), ...headers }, ...(body !== undefined ? { body } : {}) });
  const route = { id: 'private', methods: ['GET'], access: { roles: ['user'] }, rate: { limit, windowMs: 60000 } };
  return { sentinel, request, route, logs, records, hash, raw, context: { clientId: 'verified-connection' } };
}

test('authentication, ownership and named roles enforce independent server boundaries', async () => {
  const f = fixture(); let calls = 0;
  const handler = f.sentinel.protect({ ...f.route, owner: async () => 'alice' }, () => { calls++; return { ok: true }; });
  assert.equal((await handler(f.request('/private', { signed: false, headers: { 'x-user-id': 'alice', 'x-role': 'admin' } }), f.context)).status, 401);
  assert.equal((await handler(f.request(), f.context)).status, 200);
  const wrong = f.sentinel.protect({ ...f.route, owner: async () => 'bob' }, () => { calls++; });
  assert.equal((await wrong(f.request(), f.context)).status, 403);
  const missing = f.sentinel.protect({ ...f.route, owner: async () => undefined }, () => { calls++; });
  assert.equal((await missing(f.request(), f.context)).status, 404);
  assert.equal(calls, 1);
});

test('admin routes reject ordinary accounts and require current MFA evidence', async () => {
  const f = fixture();
  const handler = f.sentinel.protect({ ...f.route, access: { roles: ['admin'] } }, () => ({ ok: true }));
  assert.equal((await handler(f.request(), f.context)).status, 403);
  f.records.get(f.hash).roles = ['admin'];
  assert.equal((await (await handler(f.request(), f.context)).json()).error.code, 'MFA_REQUIRED');
  f.records.get(f.hash).mfaVerifiedAt = TIME - 1;
  assert.equal((await handler(f.request(), f.context)).status, 200);
});

test('mutation requires exact Origin and session-bound CSRF; other session tokens fail', async () => {
  const f = fixture(); let calls = 0;
  const handler = f.sentinel.protect({ ...f.route, methods: ['POST'], schema: { label: { type: 'string', required: true, maxLength: 20 } } }, ({ body }) => { calls++; return { label: body.label }; });
  const token = f.sentinel.csrfTokenFor({ sessionHash: f.hash });
  const headers = { origin: ORIGIN, 'content-type': 'application/json', 'x-csrf-token': token };
  const send = extra => handler(f.request('/private', { method: 'POST', body: '{"label":"draft"}', headers: { ...headers, ...extra } }), f.context);
  assert.equal((await send({ origin: 'https://evil.test' })).status, 403);
  assert.equal((await send({ origin: `${ORIGIN}/` })).status, 403);
  assert.equal((await send({ origin: 'null' })).status, 403);
  assert.equal((await send({ 'x-csrf-token': 'x'.repeat(43) })).status, 403);
  assert.equal((await send({ 'sec-fetch-site': 'cross-site' })).status, 403);
  const other = f.sentinel.csrfTokenFor({ sessionHash: 'b'.repeat(64) });
  assert.equal((await send({ 'x-csrf-token': other })).status, 403);
  assert.equal((await send({})).status, 200);
  assert.equal(calls, 1);
});

test('strict schemas reject privilege injection, malformed/deep JSON and large streamed bodies', async () => {
  const f = fixture(); let calls = 0;
  const handler = f.sentinel.protect({ id: 'draft', public: true, methods: ['POST'], maxBytes: 200, schema: { title: { type: 'string', required: true, maxLength: 20 } } }, () => { calls++; return {}; });
  const send = (body, extra = {}) => handler(f.request('/draft', { signed: false, method: 'POST', body, headers: { origin: ORIGIN, 'content-type': 'application/json', ...extra } }), f.context);
  assert.equal((await send('{"title":"x","roles":["admin"]}')).status, 400);
  assert.equal((await send('{"title":"x","__proto__":{}}')).status, 400);
  assert.equal((await send('[]')).status, 400);
  assert.equal((await send('{broken')).status, 400);
  assert.equal((await send('{}', { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await send('x'.repeat(201))).status, 413);
  assert.equal((await send('{"title":"ok"}')).status, 200);
  assert.equal(calls, 1);
});

test('store failure and revoked session fail closed without invoking business action', async () => {
  const f = fixture({ lookupFailure: true }); let calls = 0;
  const handler = f.sentinel.protect(f.route, () => { calls++; });
  const result = await handler(f.request(), f.context);
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /secret-database-url|stack/);
  assert.equal(calls, 0);
  const good = fixture(); good.records.get(good.hash).revokedAt = TIME;
  assert.equal((await good.sentinel.protect(good.route, () => { calls++; })(good.request(), good.context)).status, 401);
  assert.equal(calls, 0);
});

test('audit sink failure prevents side effects and does not leak errors', async () => {
  const f = fixture({ auditFailure: true }); let called = false;
  const handler = f.sentinel.protect(f.route, () => { called = true; });
  const response = await handler(f.request(), f.context);
  assert.equal(response.status, 503); assert.equal(called, false);
  assert.equal((await response.json()).error.code, 'AUDIT_UNAVAILABLE');
});

test('shared limiter applies across protected handler instances and emits Retry-After', async () => {
  const f = fixture({ limit: 1 });
  const first = f.sentinel.protect(f.route, () => ({}));
  const second = f.sentinel.protect(f.route, () => ({}));
  assert.equal((await first(f.request(), f.context)).status, 200);
  const response = await second(f.request(), f.context);
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
});

test('response headers protect success, denied and unexpected-error responses', async () => {
  const f = fixture();
  for (const handler of [f.sentinel.protect(f.route, () => ({})), f.sentinel.protect(f.route, () => { throw Error('sk_test_secret'); })]) {
    const response = await handler(f.request(), f.context);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(response.headers.get('strict-transport-security'), /max-age=/);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.doesNotMatch(await response.text(), /sk_test_secret/);
  }
  const denied = await f.sentinel.protect(f.route, () => ({}))(f.request('/private', { signed: false }), f.context);
  assert.equal(denied.headers.get('x-content-type-options'), 'nosniff');
});

test('forwarded identity headers cannot replace trusted client context or broaden origins', async () => {
  const f = fixture(); const handler = f.sentinel.protect(f.route, () => ({}));
  assert.equal((await handler(f.request('/private', { headers: { 'x-forwarded-for': '127.0.0.1', 'x-nf-client-connection-ip': '127.0.0.1' } }))).status, 503);
  assert.equal((await handler(new Request('https://evil.test/private'), f.context)).status, 403);
  const wrongMethod = await handler(f.request('/private', { method: 'DELETE' }), f.context);
  assert.equal(wrongMethod.status, 405); assert.equal(wrongMethod.headers.get('allow'), 'GET');
});

test('legacy adapter preserves error hardening; base64 and oversized envelopes rejected', async () => {
  const f = fixture();
  const handler = netlifyHandler(f.sentinel.protect(f.route, () => ({})), { resolveClientId: () => 'trusted' });
  const response = await handler({ httpMethod: 'GET', rawUrl: `${ORIGIN}/private`, headers: {} }, {});
  assert.equal(response.statusCode, 401); assert.match(response.headers['content-security-policy'], /default-src/);
  assert.equal((await handler({ isBase64Encoded: true }, {})).statusCode, 413);
});

test('terminal session bridge requires real issuance and session-specific MFA evidence', async () => {
  const f = fixture();
  const load = terminalSessionLookup({ loadSessionRow: async hash => ({ token_hash: hash, user_id: 'alice', created_at: TIME - 1, expires_at: TIME + 10 }), loadIdentity: async () => ({ id: 'alice', roles: ['user'] }) });
  const record = await load(f.hash, TIME); assert.equal(record.createdAt, TIME - 1); assert.equal(record.mfaVerifiedAt, undefined);
  const bad = terminalSessionLookup({ loadSessionRow: async () => ({ token_hash: 'wrong', user_id: 'alice' }), loadIdentity: async () => ({ id: 'alice' }) });
  await assert.rejects(bad(f.hash, TIME), { code: 'AUTH_UNAVAILABLE' });
  assert.throws(() => terminalRateStore({ kind: 'local', consumeRateLimit() {} }));
});

test('audit decisions carry no cookie, raw body, raw IP or arbitrary request headers', async () => {
  const f = fixture();
  await f.sentinel.protect(f.route, () => ({}))(f.request('/private?api_key=hidden-query', { headers: { authorization: 'Bearer hidden-bearer' } }), f.context);
  const joined = f.logs.join('\n');
  assert.doesNotMatch(joined, new RegExp(`${f.raw}|hidden-query|hidden-bearer|verified-connection|alice`));
  assert.equal(JSON.parse(f.logs[0]).reason, 'AUTHORIZED');
});
