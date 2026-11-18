import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createSupabaseStore } from '../netlify/terminal/store.mjs';
import { createTerminalHandler } from '../netlify/functions/terminal.mjs';
import { createInitialState } from '../netlify/terminal/engine.mjs';
import { createOwnerGrant } from '../netlify/product/owner.mjs';
import { COOKIE, SESSION_TTL, GUEST_SESSION_TTL, sha256, csrfToken, workspaceSession, authorizeWorkspaceRecord, equalToken } from '../netlify/terminal/security.mjs';

const NOW = Date.parse('2026-11-18T18:00:00Z');
const ORIGIN = 'https://security-platform.test';
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const ENV = { TERMINAL_ORIGIN: ORIGIN, TERMINAL_SESSION_SECRET: 'synthetic-security-core-platform-secret-at-least-32-characters' };

async function fixture(t, { product = false, admin = false } = {}) {
  const store = await createLocalStore(':memory:'); t.after(() => store.close());
  const env = { ...ENV, ...(product ? { PRODUCT_ENABLED: 'true' } : {}), ...(admin ? { PRODUCT_ADMIN_USER_IDS: ALICE } : {}) };
  const raw = randomBytes(32).toString('base64url'), hash = sha256(raw);
  for (const [id, email] of [[ALICE, 'alice@example.invalid'], [BOB, 'bob@example.invalid']]) {
    await store.createUser({ id, kind: 'user', email, name: id === ALICE ? 'Alice' : 'Bob', created_at: NOW - 5 * 86400000, expires_at: null }, createInitialState({ now: NOW }));
    if (product) await store.product.transact([{ ns: 'accounts', key: id, ownerId: id, expectedVersion: null, value: { emailVerified: true, billing: { status: 'none', paidUntil: null } } }]);
  }
  if (product) await store.product.transact([{ ns: 'mfa', key: ALICE, ownerId: ALICE, expectedVersion: null, value: { enabled: true } }]);
  await store.createSession({ token_hash: hash, user_id: ALICE, created_at: NOW - 1000, expires_at: NOW - 1000 + SESSION_TTL });
  const handler = createTerminalHandler({ store, env, now: () => NOW, fetcher: async () => { throw Error('Unexpected network request blocked in security fixture.'); } });
  const request = (action = 'session', { method = 'GET', body, headers = {}, query = {}, signed = true } = {}) => ({
    httpMethod: method, rawUrl: `${ORIGIN}/.netlify/functions/terminal?${new URLSearchParams({ action, ...query })}`,
    queryStringParameters: { action, ...query },
    headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-nf-client-connection-ip': '192.0.2.50', ...(signed ? { cookie: `${COOKIE}=${raw}`, 'x-csrf-token': csrfToken(raw, env.TERMINAL_SESSION_SECRET) } : {}), ...headers },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  return { store, env, raw, hash, request, handler };
}

test('actual account sessions use database issuance and preserve the existing seven-day lifetime', async t => {
  const f = await fixture(t);
  const row = await f.store.getSession(f.hash, NOW);
  assert.equal(row.session_created_at, NOW - 1000);
  assert.notEqual(row.session_created_at, row.created_at);
  const session = await workspaceSession(f.request(), f.store, NOW + 6 * 86400000);
  assert.equal(session.id, ALICE);
  assert.equal(await workspaceSession(f.request(), f.store, NOW - 1000 + SESSION_TTL), null);
});

test('remote session adapter forwards actual session creation instead of account creation', async () => {
  const store = createSupabaseStore({ SUPABASE_URL: 'https://database.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-secret' }, async url => ({ ok: true, text: async () => JSON.stringify(url.includes('terminal_sessions?') ? [{ user_id: ALICE, created_at: NOW - 10, expires_at: NOW + 1000 }] : [{ id: ALICE, kind: 'user', created_at: NOW - 100000, expires_at: null }]) }));
  const row = await store.getSession('a'.repeat(64), NOW);
  assert.equal(row.session_created_at, NOW - 10);
  assert.equal(row.created_at, NOW - 100000);
});

test('revoked, duplicate, noncanonical and forged-role cookies cannot read account state', async t => {
  const f = await fixture(t);
  const original = f.request();
  assert.equal((await f.handler(original)).statusCode, 200);
  const duplicate = await f.handler(f.request('session', { headers: { cookie: `${COOKIE}=${f.raw}; ${COOKIE}=${f.raw}`, 'x-role': 'admin', 'x-user-id': ALICE } }));
  assert.equal(duplicate.statusCode, 401);
  const malformed = await f.handler(f.request('session', { headers: { cookie: `${COOKIE}=${'Z'.repeat(43)}` } }));
  assert.equal(malformed.statusCode, 401);
  await f.store.deleteSession(f.hash);
  assert.equal((await f.handler(original)).statusCode, 401);
});

test('private terminal data remains bound to verified identity despite foreign owner claims', async t => {
  const f = await fixture(t);
  assert.throws(() => authorizeWorkspaceRecord({ id: ALICE, kind: 'user' }, undefined, NOW), { code: 'RECORD_OWNER' });
  const result = await f.handler(f.request('session', { query: { userId: BOB }, headers: { 'x-user-id': BOB, 'x-role': 'admin' } }));
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.user.id, ALICE); assert.equal(body.user.email, 'alice@example.invalid');
  assert.doesNotMatch(result.body, /bob@example.invalid/);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
});

test('actual product endpoint denies foreign server-record ownership before returning private data', async t => {
  const f = await fixture(t, { product: true });
  const original = f.store.product.get.bind(f.store.product);
  f.store.product.get = async (ns, key) => ns === 'accounts' && key === ALICE ? { ownerId: BOB, version: 1, value: { privateData: 'foreign-customer-record' } } : original(ns, key);
  const result = await f.handler(f.request('product'));
  assert.equal(result.statusCode, 403);
  assert.equal(JSON.parse(result.body).error.code, 'RECORD_OWNER');
  assert.doesNotMatch(result.body, /foreign-customer-record|bob@example.invalid/);
});

test('independent handlers share persistent rate budgets and limiter outages fail closed', async t => {
  const f = await fixture(t);
  const other = createTerminalHandler({ store: f.store, env: f.env, now: () => NOW });
  const guest = f.request('guest', { method: 'POST', body: {}, signed: false });
  for (let attempt = 0; attempt < 12; attempt++) assert.equal((await f.handler(guest)).statusCode, 200);
  const limited = await other(guest);
  assert.equal(limited.statusCode, 429); assert.equal(limited.headers['Retry-After'], '86400');
  assert.equal((await other({ ...guest, headers: { ...guest.headers, 'x-nf-client-connection-ip': '192.0.2.51' } })).statusCode, 200);
  let creates = 0;
  const blocked = createTerminalHandler({ store: { ...f.store, consumeRateLimit: async () => { throw Error('private-database-credential'); }, createUser: async () => { creates++; } }, env: f.env, now: () => NOW });
  const result = await blocked(guest);
  assert.equal(result.statusCode, 503); assert.equal(creates, 0);
  assert.doesNotMatch(result.body, /private-database-credential/);
});

test('malformed nested bodies and Unicode CSRF tokens cannot bypass or crash mutation checks', async t => {
  const f = await fixture(t);
  const body = '{"requestId":"security-test-request","command":{"type":"settings_update","__proto__":{}}}';
  assert.equal((await f.handler(f.request('command', { method: 'POST', body }))).statusCode, 400);
  const result = await f.handler(f.request('logout', { method: 'POST', body: {}, headers: { 'x-csrf-token': '\u00e9'.repeat(43) } }));
  assert.equal(result.statusCode, 403);
  assert.equal(equalToken('\u00e9', 'a'), false);
  assert.equal((await f.handler(f.request())).statusCode, 200);
});

test('product administrative operational routes require real recent security-scope MFA', async t => {
  const f = await fixture(t, { product: true, admin: true });
  const put = async value => {
    const old = await f.store.product.get('mfa_sessions', f.hash);
    await f.store.product.transact([{ ns: 'mfa_sessions', key: f.hash, ownerId: ALICE, expectedVersion: old?.version ?? null, value, expiresAt: NOW + 600000 }]);
  };
  assert.equal(JSON.parse((await f.handler(f.request('product-health'))).body).error.code, 'STEP_UP_REQUIRED');
  for (const value of [{ scope: 'security', validUntil: NOW + 600000 }, { scope: 'security', verifiedAt: NOW - 300000, validUntil: NOW + 600000 }, { scope: 'execution', verifiedAt: NOW - 1, validUntil: NOW + 600000 }, { scope: 'security', verifiedAt: NOW + 1, validUntil: NOW + 600000 }]) {
    await put(value);
    assert.equal(JSON.parse((await f.handler(f.request('product-health'))).body).error.code, 'STEP_UP_REQUIRED');
  }
  await put({ scope: 'security', verifiedAt: NOW - 1, validUntil: NOW + 600000 });
  assert.equal((await f.handler(f.request('product-health'))).statusCode, 200);
  const ordinary = await fixture(t, { product: true });
  const denied = await ordinary.handler(ordinary.request('product-health', { headers: { 'x-role': 'admin', 'x-user-id': ALICE } }));
  assert.equal(denied.statusCode, 403); assert.equal(JSON.parse(denied.body).error.code, 'ADMIN_REQUIRED');
  const account = await ordinary.store.product.get('accounts', ALICE);
  await ordinary.store.product.transact([{ ns: 'accounts', key: ALICE, ownerId: ALICE, expectedVersion: account.version, value: { ...account.value, access: createOwnerGrant(NOW) } }, { ns: 'mfa_sessions', key: ordinary.hash, ownerId: ALICE, expectedVersion: null, value: { scope: 'security', verifiedAt: NOW - 1, validUntil: NOW + 600000 }, expiresAt: NOW + 600000 }]);
  assert.equal((await ordinary.handler(ordinary.request('product-health'))).statusCode, 200);
  const granted = await ordinary.store.product.get('accounts', ALICE);
  await ordinary.store.product.transact([{ ns: 'accounts', key: ALICE, ownerId: ALICE, expectedVersion: granted.version, value: { ...granted.value, access: { ...granted.value.access, active: false } } }]);
  assert.equal((await ordinary.handler(ordinary.request('product-health'))).statusCode, 403);
});

test('listed administrators cannot access operations with missing, unverified, disabled or foreign account records', async t => {
  for (const condition of ['missing', 'unverified', 'disabled', 'foreign']) {
    await t.test(condition, async subtest => {
      const f = await fixture(subtest, { product: true, admin: true });
      await f.store.product.transact([{ ns: 'mfa_sessions', key: f.hash, ownerId: ALICE, expectedVersion: null, value: { scope: 'security', verifiedAt: NOW - 1, validUntil: NOW + 600000 }, expiresAt: NOW + 600000 }]);
      const account = await f.store.product.get('accounts', ALICE);
      if (condition === 'foreign') {
        const original = f.store.product.get.bind(f.store.product);
        f.store.product.get = async (ns, key) => ns === 'accounts' && key === ALICE ? { ...account, ownerId: BOB } : original(ns, key);
      } else {
        await f.store.product.transact([{ ns: 'accounts', key: ALICE, ownerId: ALICE, expectedVersion: account.version, value: condition === 'missing' ? null : { ...account.value, ...(condition === 'unverified' ? { emailVerified: false } : { disabled: true }) } }]);
      }
      for (const request of [f.request('product-health'), f.request('product-health-probe', { method: 'POST', body: { requestId: 'admin-account-validation', services: ['market'] } })]) {
        const result = await f.handler(request);
        assert.equal(result.statusCode, 403, `${condition}: ${result.body}`);
        assert.equal(JSON.parse(result.body).error.code, 'ADMIN_REQUIRED');
        assert.doesNotMatch(result.body, /providerAttempts|unresolvedOrders|broker_connections/);
      }
    });
  }
});

test('actual success, denial and failure responses carry Core security headers without CORS grants', async t => {
  for (const product of [false, true]) {
    const f = await fixture(t, { product });
    for (const event of [f.request(product ? 'product' : 'session'), f.request('session', { signed: false }), f.request('missing-action')]) {
      const result = await f.handler(event);
      assert.equal(result.headers['X-Frame-Options'], 'DENY');
      assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
      assert.match(result.headers['Content-Security-Policy'], /default-src 'none'/);
      assert.match(result.headers['Strict-Transport-Security'], /max-age=/);
      assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
      assert.doesNotMatch(result.body, /password_hash|synthetic-security-core-platform-secret/);
    }
  }
});

test('guest session lifetime cannot be extended merely by changing stored expiry', async t => {
  const f = await fixture(t);
  const id = '33333333-3333-4333-8333-333333333333', raw = randomBytes(32).toString('base64url');
  await f.store.createUser({ id, kind: 'guest', created_at: NOW, expires_at: NOW + SESSION_TTL }, createInitialState({ now: NOW }));
  await f.store.createSession({ token_hash: sha256(raw), user_id: id, created_at: NOW, expires_at: NOW + GUEST_SESSION_TTL + 1 });
  const result = await f.handler(f.request('session', { headers: { cookie: `${COOKIE}=${raw}` } }));
  assert.equal(result.statusCode, 401);
});


test('disabling the trusted account denies active owner reads and billing writes', async t => {
  const f = await fixture(t, { product: true });
  const account = await f.store.product.get('accounts', ALICE);
  await f.store.product.transact([{ ns:'accounts', key:ALICE, ownerId:ALICE, expectedVersion:account.version,
    value:{ ...account.value, access:createOwnerGrant(NOW), disabled:true } }]);
  for (const event of [f.request('product'), f.request('product-sessions'), f.request('product-checkout', { method:'POST', body:{tier:'pro'} })]) {
    const result = await f.handler(event);
    assert.equal(result.statusCode, 401);
    assert.doesNotMatch(result.body, /alice@example.invalid|billingExempt|sessionId/);
  }
  const logout = await f.handler(f.request('logout', { method:'POST', body:{} }));
  assert.equal(logout.statusCode,200);
  assert.equal(await f.store.getSession(f.hash,NOW),null);
});

test('current enrollment is required even when a privileged session still has fresh proof', async t => {
  const f = await fixture(t, { product:true, admin:true });
  await f.store.product.transact([{ ns:'mfa_sessions', key:f.hash, ownerId:ALICE, expectedVersion:null,
    value:{ scope:'security', verifiedAt:NOW-1, validUntil:NOW+600000 } }]);
  assert.equal((await f.handler(f.request('product-health'))).statusCode, 200);
  const enrollment = await f.store.product.get('mfa', ALICE);
  await f.store.product.transact([{ ns:'mfa', key:ALICE, ownerId:ALICE, expectedVersion:enrollment.version, value:null }]);
  const response = await f.handler(f.request('product-health'));
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).error.code, 'STEP_UP_REQUIRED');
});
