import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createInitialState } from '../netlify/terminal/engine.mjs';
import { hashPassword } from '../netlify/terminal/auth.mjs';
import { handleMfa } from '../netlify/product/mfa.mjs';
import { createOwnerGrant } from '../netlify/product/owner.mjs';
import { createAdminSecurity, ADMIN_COOKIE } from '../netlify/security-core/admin.mjs';
import { createHandler as adminTickets } from '../netlify/functions/admin-tickets.mjs';
import { createHandler as loginHandler } from '../netlify/functions/admin-login.mjs';
import { createHandler as logoutHandler } from '../netlify/functions/admin-logout.mjs';
import { createHandler as sessionHandler } from '../netlify/functions/admin-session.mjs';

const ID = 'a1111111-1111-4111-8111-111111111111';
const ORIGIN = 'https://nortivo.no';
const PASSWORD = 'synthetic-admin-password';
const initialTime = Date.parse('2026-11-18T12:00:00Z');
const passwordHash = hashPassword(PASSWORD);
const value = response => JSON.parse(response.body);

async function fixture(t, { owner = false, listed = true, sinkFailure = false } = {}) {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('No external service is allowed in admin tests.'); });
  const store = await createLocalStore(':memory:'); t.after(() => store.close());
  let time = initialTime;
  const env = { ADMIN_SESSION_SECRET: 'synthetic-admin-secret-at-least-thirty-two-bytes', PRODUCT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64url'), PRODUCT_ADMIN_USER_IDS: listed ? ID : '', URL: ORIGIN };
  const user = { id: ID, kind: 'user', email: 'named-admin@example.test', name: 'Synthetic admin', password_hash: await passwordHash, created_at: time, expires_at: null };
  await store.createUser(user, createInitialState({ now: time }));
  await store.product.transact([{ ns: 'accounts', key: ID, ownerId: ID, expectedVersion: null, value: { emailVerified: true, ...(owner ? { access: createOwnerGrant(time) } : {}) } }]);
  const ctx = () => ({ store: store.product, legacyStore: store, user, account: { emailVerified: true }, env, now: time });
  const enrollment = await handleMfa(ctx(), 'product-mfa-enroll', { password: PASSWORD });
  const totp = new OTPAuth.TOTP({ issuer: 'Nortivo', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(enrollment.secret) });
  const confirmed = await handleMfa(ctx(), 'product-mfa-confirm', { code: totp.generate({ timestamp: time }) });
  time += 30000;
  const logs = [];
  const security = createAdminSecurity({ store, env, now: () => time, auditSink: line => { if (sinkFailure) throw new Error('private-log-target'); logs.push(line); } });
  const event = (action, { method = 'GET', body, cookie, csrf, headers = {}, ip = 'synthetic-connection' } = {}) => ({ httpMethod: method, rawUrl: `${ORIGIN}/.netlify/functions/${action}`, headers: { ...(method === 'GET' ? {} : { origin: ORIGIN, 'content-type': 'application/json' }), 'x-nf-client-connection-ip': ip, ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const loginEvent = extra => event('admin-login', { method: 'POST', body: { email: user.email, password: PASSWORD, code: totp.generate({ timestamp: time }), ...extra } });
  const signIn = async () => {
    const result = await security.login(loginEvent());
    assert.equal(result.statusCode, 200, result.body);
    return { result, cookie: result.headers['Set-Cookie'].split(';')[0], csrf: value(result).csrfToken };
  };
  const update = async (ns, key, patch) => { const row = await store.product.get(ns, key); await store.product.transact([{ ns, key, ownerId: row.ownerId, expectedVersion: row.version, value: { ...row.value, ...patch } }]); };
  return { store, security, env, user, event, loginEvent, signIn, logs, update, recoveryCodes: confirmed.recoveryCodes, advance: ms => { time += ms; }, time: () => time };
}

test('named password plus maintained MFA issues only an opaque secure revocable session', async t => {
  const f = await fixture(t);
  const { result, cookie, csrf } = await f.signIn();
  assert.match(result.headers['Set-Cookie'], /^__Host-nortivo_admin_core=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800$/);
  assert.equal(Buffer.from(cookie.split('=')[1], 'base64url').length, 32);
  assert.match(csrf, /^[A-Za-z0-9_-]{43}$/);
  const raw = cookie.slice(ADMIN_COOKIE.length + 1), hash = crypto.createHash('sha256').update(raw).digest('hex');
  const stored = await f.store.getSession(hash, f.time());
  assert.equal(stored.id, ID); assert.equal(stored.session_created_at, f.time());
  const proof = await f.store.product.get('mfa_sessions', hash);
  assert.equal(proof.value.scope, 'admin'); assert.equal(proof.value.verifiedAt, f.time());
  const session = await sessionHandler({ security: f.security })(f.event('admin-session', { cookie }));
  assert.equal(session.statusCode, 200); assert.equal(value(session).csrfToken, csrf);
  assert.doesNotMatch(f.logs.join('\n'), new RegExp(`${raw}|named-admin@example.test|${PASSWORD}|synthetic-connection`));
});

test('legacy cookies, missing tokens, wrong passwords and spoofed client roles do not grant admin access', async t => {
  const f = await fixture(t);
  for (const cookie of [undefined, 'nortivo_admin=legacy-signed-expiration', `${ADMIN_COOKIE}=invalid`, `${ADMIN_COOKIE}=${'a'.repeat(43)}; ${ADMIN_COOKIE}=${'a'.repeat(43)}`]) {
    await assert.rejects(f.security.requireAdmin(f.event('admin-tickets', { cookie, headers: { 'x-role': 'admin', 'x-user-id': ID } })), { code: 'AUTH_REQUIRED' });
  }
  const wrong = await loginHandler({ security: f.security })(f.loginEvent({ password: 'wrong-but-long-password' }));
  assert.equal(wrong.statusCode, 401); assert.equal(wrong.headers['Set-Cookie'], undefined);
  const oldBody = await f.security.login(f.event('admin-login', { method: 'POST', body: { password: PASSWORD } }));
  assert.equal(oldBody.statusCode, 400);
});

test('administrator allowlist and owner grants are server-owned and checked on every request', async t => {
  const f = await fixture(t);
  const { cookie } = await f.signIn();
  f.env.PRODUCT_ADMIN_USER_IDS = '';
  await assert.rejects(f.security.requireAdmin(f.event('admin-tickets', { cookie, headers: { 'x-role': 'owner' } })), { code: 'AUTH_REQUIRED' });
  const owner = await fixture(t, { owner: true, listed: false });
  const ownerLogin = await owner.signIn();
  assert.equal((await owner.security.session(owner.event('admin-session', { cookie: ownerLogin.cookie }))).statusCode, 200);
  await owner.update('accounts', ID, { access: { role: 'owner', active: true, grantedBy: 'browser', grantedAt: owner.time() } });
  assert.equal((await owner.security.session(owner.event('admin-session', { cookie: ownerLogin.cookie }))).statusCode, 401);
});

test('unverified or nonprivileged account and unenrolled MFA cannot sign in', async t => {
  const ordinary = await fixture(t, { listed: false });
  assert.equal((await ordinary.security.login(ordinary.loginEvent())).statusCode, 401);
  const f = await fixture(t);
  await f.update('accounts', ID, { emailVerified: false });
  assert.equal((await f.security.login(f.loginEvent())).statusCode, 401);
  await f.update('accounts', ID, { emailVerified: true });
  await f.update('mfa', ID, { enabled: false });
  assert.equal((await f.security.login(f.loginEvent())).statusCode, 403);
});

test('string flags and nonnumeric MFA expiry never establish verified administrative assurance', async t => {
  const f = await fixture(t);
  await f.update('accounts', ID, { emailVerified: 'true' });
  assert.equal((await f.security.login(f.loginEvent())).statusCode, 401);
  await f.update('accounts', ID, { emailVerified: true });
  await f.update('mfa', ID, { enabled: 'true' });
  assert.equal((await f.security.login(f.loginEvent())).statusCode, 403);
  await f.update('mfa', ID, { enabled: true });
  const { cookie } = await f.signIn();
  const raw = cookie.slice(ADMIN_COOKIE.length + 1), sessionHash = crypto.createHash('sha256').update(raw).digest('hex');
  await f.update('mfa_sessions', sessionHash, { validUntil: String(f.time() + 600000) });
  assert.equal((await f.security.session(f.event('admin-session', { cookie }))).statusCode, 403);
  await f.update('mfa_sessions', sessionHash, { validUntil: f.time() + 600000 });
  await f.update('accounts', ID, { emailVerified: 'true' });
  assert.equal((await f.security.session(f.event('admin-session', { cookie }))).statusCode, 401);
});

test('copied cookie is denied after authoritative logout and invalid CSRF cannot revoke it', async t => {
  const f = await fixture(t); const { cookie, csrf } = await f.signIn();
  const bad = await logoutHandler({ security: f.security })(f.event('admin-logout', { method: 'POST', cookie }));
  assert.equal(bad.statusCode, 403); assert.equal(value(bad).code, 'CSRF_FAILED');
  assert.equal((await f.security.session(f.event('admin-session', { cookie }))).statusCode, 200);
  const good = await f.security.logout(f.event('admin-logout', { method: 'POST', cookie, csrf }));
  assert.equal(good.statusCode, 200); assert.match(good.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal((await f.security.session(f.event('admin-session', { cookie }))).statusCode, 401);
});

test('fresh MFA gates sensitive data while stale sessions can still sign out safely', async t => {
  const f = await fixture(t); const { cookie, csrf } = await f.signIn();
  f.advance(5 * 60000);
  const stale = await f.security.session(f.event('admin-session', { cookie }));
  assert.equal(stale.statusCode, 403); assert.equal(value(stale).code, 'MFA_REQUIRED');
  assert.equal((await f.security.logout(f.event('admin-logout', { method: 'POST', cookie, csrf }))).statusCode, 200);
});

test('TOTP and recovery-code reuse are transactionally denied', async t => {
  const f = await fixture(t); await f.signIn();
  assert.equal((await f.security.login(f.loginEvent())).statusCode, 403);
  const r = await fixture(t);
  const request = r.loginEvent({ code: undefined, recoveryCode: r.recoveryCodes[0] });
  assert.equal((await r.security.login(request)).statusCode, 200);
  assert.equal((await r.security.login(request)).statusCode, 403);
});

test('admin endpoint enforces real auth, CSRF and origin before private query execution', async t => {
  const f = await fixture(t); let queried = 0;
  const endpoint = adminTickets({ authorizeAdmin: f.security.requireAdmin, query: async () => { queried++; return []; } });
  assert.equal((await endpoint(f.event('admin-tickets'))).statusCode, 401); assert.equal(queried, 0);
  const { cookie, csrf } = await f.signIn();
  assert.equal((await endpoint(f.event('admin-tickets', { cookie }))).statusCode, 200); assert.equal(queried, 1);
  const denied = await endpoint(f.event('admin-tickets', { method: 'PATCH', cookie, body: { id: 'ticket', status: 'closed' } }));
  assert.equal(denied.statusCode, 403); assert.equal(queried, 1);
  const cross = await endpoint(f.event('admin-tickets', { method: 'PATCH', cookie, csrf, body: {}, headers: { origin: 'https://attacker.test' } }));
  assert.equal(cross.statusCode, 403); assert.equal(queried, 1);
});

test('two security instances share one atomic login budget and return Retry-After', async t => {
  const f = await fixture(t);
  const second = createAdminSecurity({ store: f.store, env: f.env, now: f.time, auditSink() {} });
  const wrong = f.loginEvent({ password: 'long-but-incorrect-password' });
  for (let i = 0; i < 10; i++) assert.equal((await (i % 2 ? second : f.security).login(wrong)).statusCode, 401);
  const limited = await second.login(wrong);
  assert.equal(limited.statusCode, 429); assert.equal(limited.headers['Retry-After'], '900');
});

test('database and audit failures fail closed without cookies or leaked provider details', async t => {
  const f = await fixture(t, { sinkFailure: true });
  const auditFailure = await f.security.login(f.loginEvent());
  assert.equal(auditFailure.statusCode, 503); assert.equal(auditFailure.headers['Set-Cookie'], undefined); assert.doesNotMatch(auditFailure.body, /private-log-target/);
  const g = await fixture(t); const { cookie } = await g.signIn();
  const broken = createAdminSecurity({ store: { ...g.store, getSession: async () => { throw Error('private-db-password'); } }, env: g.env, now: g.time, auditSink() {} });
  const unavailable = await broken.session(g.event('admin-session', { cookie }));
  assert.equal(unavailable.statusCode, 503); assert.doesNotMatch(unavailable.body, /private-db-password/);
  assert.match(unavailable.headers['Content-Security-Policy'], /default-src 'none'/); assert.match(unavailable.headers['Cache-Control'], /no-store/);
});
