import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createInitialState } from '../netlify/terminal/engine.mjs';
import { hashPassword, verifyPassword } from '../netlify/terminal/auth.mjs';
import { sha256 } from '../netlify/terminal/security.mjs';
import { createOwnerBootstrapHandler } from '../netlify/product/owner-bootstrap.mjs';
import { isOwnerAccount } from '../netlify/product/owner.mjs';
import { SYSTEM_OWNER } from '../netlify/product/providers-core.mjs';
import { sealRuntimeValue, openRuntimeValue } from '../netlify/product/runtime-envelope.mjs';
import { loadOwnerBootstrapConfiguration } from '../netlify/functions/product-owner-bootstrap.mjs';

const NOW = Date.parse('2026-11-18T20:00:00Z');
const ORIGIN = 'https://invest.nortivo.no';
const USER = 'a1111111-1111-4111-8111-111111111111';
const OTHER = 'b2222222-2222-4222-8222-222222222222';
const ID = 'c3333333-3333-4333-8333-333333333333';
const TOKEN = Buffer.alloc(32, 19).toString('base64url');
const PASSWORD = 'fixture-owner-initial-password-only';
const PASSWORD_HASH = await hashPassword(PASSWORD);
const ENV = { PRODUCT_ENABLED: 'true', TERMINAL_ORIGIN: ORIGIN, PRODUCT_ENCRYPTION_KEY: Buffer.alloc(32, 27).toString('base64url') };
const CONFIG = { id: ID, userId: USER, email: 'fixture-owner@example.test', name: 'Fixture owner', passwordHash: PASSWORD_HASH, tokenHash: sha256(TOKEN), issuedAt: NOW - 1000, expiresAt: NOW + 1800000, origin: ORIGIN };

function event({ method = 'POST', body = {}, token = TOKEN, origin = ORIGIN, headers = {}, rawUrl = `${ORIGIN}/.netlify/functions/owner-bootstrap` } = {}) {
  return { httpMethod: method, rawUrl, headers: { Origin: origin, 'Content-Type': 'application/json', ...(token === null ? {} : { 'X-Nortivo-Owner-Bootstrap': token }), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body), isBase64Encoded: false };
}
const payload = result => JSON.parse(result.body);
async function fixture(t, configuration = CONFIG) {
  const legacyStore = await createLocalStore(':memory:');
  t.after(() => legacyStore.close());
  const handler = createOwnerBootstrapHandler({ env: ENV, store: legacyStore, now: () => NOW, configuration });
  return { legacyStore, handler, product: legacyStore.product };
}
async function put(product, ns, key, ownerId, value) { return product.transact([{ ns, key, ownerId, expectedVersion: null, value }]); }
async function existingIdentity(legacyStore, { verified = true, account = true, deletion = false } = {}) {
  const identity = { id: OTHER, kind: 'user', email: CONFIG.email, name: 'Existing fixture owner', password_hash: await hashPassword('existing-fixture-owner-password'), created_at: NOW - 86400000, expires_at: null };
  await legacyStore.createUser(identity, createInitialState({ now: identity.created_at }));
  if (account) await put(legacyStore.product, 'accounts', OTHER, OTHER, { emailVerified: verified, createdAt: identity.created_at, billing: { status: 'active', tier: 'portfolio', paidUntil: NOW + 86400000, customerId: 'fixture-existing-customer' }, locale: 'nb', authTokens: { verify: null }, ...(deletion ? { deletionRequest: { status: 'review_required' } } : {}) });
  return identity;
}

test('runtime envelopes are randomized, purpose-separated and never expose fixture credentials', () => {
  const value = { apiKey: 'fixture-paper-key-only', apiSecret: 'fixture-paper-secret-only' };
  const first = sealRuntimeValue(value, ENV, 'owner-market-v1');
  const second = sealRuntimeValue(value, ENV, 'owner-market-v1');
  assert.deepEqual(openRuntimeValue(first, ENV, 'owner-market-v1'), value);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(JSON.stringify(first).includes(value.apiSecret), false);
  assert.throws(() => openRuntimeValue(first, ENV, 'owner-bootstrap-v1'), { code: 'RUNTIME_CONFIGURATION_INVALID' });
  assert.throws(() => openRuntimeValue({ ...first, purpose: 'owner-bootstrap-v1' }, ENV, 'owner-bootstrap-v1'), { code: 'RUNTIME_CONFIGURATION_INVALID' });
});

test('runtime ciphertext, metadata and master-key tampering fail without disclosing plaintext', () => {
  const sealed = sealRuntimeValue({ protectedValue: 'fixture-never-include-in-errors' }, ENV, 'owner-bootstrap-v1');
  const changeFirst = value => `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;
  const cases = ['ciphertext', 'iv', 'salt', 'tag'].map(field => ({ ...sealed, [field]: changeFirst(sealed[field]) }));
  cases.push({ ...sealed, version: 2 }, { ...sealed, extra: true }, { ...sealed, ciphertext: ' ' }, { ...sealed, iv: Buffer.alloc(11).toString('base64url') });
  for (const value of cases) assert.throws(() => openRuntimeValue(value, ENV, 'owner-bootstrap-v1'), error => error.code === 'RUNTIME_CONFIGURATION_INVALID' && !error.message.includes('fixture-never'));
  assert.throws(() => openRuntimeValue(sealed, { PRODUCT_ENCRYPTION_KEY: Buffer.alloc(32, 28).toString('base64url') }, 'owner-bootstrap-v1'), { code: 'RUNTIME_CONFIGURATION_INVALID' });
  assert.throws(() => openRuntimeValue(sealed, {}, 'owner-bootstrap-v1'), { code: 'RUNTIME_CONFIGURATION_INVALID' });
  assert.throws(() => sealRuntimeValue({}, ENV, 'arbitrary-unapproved-purpose'), { code: 'RUNTIME_CONFIGURATION_INVALID' });
});

test('wrong or missing bootstrap tokens, inactive authorizations and spoofed requests never touch the database', async () => {
  let touched = 0;
  const neverStore = new Proxy({}, { get() { touched++; throw new Error('Database must not be reached.'); } });
  const handler = configuration => createOwnerBootstrapHandler({ env: ENV, store: neverStore, now: () => NOW, configuration });
  for (const request of [event({ token: null }), event({ token: 'bad' }), event({ token: Buffer.alloc(32, 18).toString('base64url') })]) assert.equal((await handler(CONFIG)(request)).statusCode, 403);
  assert.equal((await handler(CONFIG)(event({ method: 'GET' }))).statusCode, 405);
  assert.equal((await handler(CONFIG)(event({ body: { email: 'attacker@example.test', role: 'owner', password: 'not-accepted' } }))).statusCode, 400);
  assert.equal((await handler(CONFIG)(event({ origin: 'https://evil.example.test' }))).statusCode, 403);
  assert.equal((await handler(CONFIG)(event({ headers: { 'sec-fetch-site': 'cross-site' } }))).statusCode, 403);
  assert.equal((await handler(CONFIG)(event({ rawUrl: 'https://nortivo.no/.netlify/functions/owner-bootstrap' }))).statusCode, 403);
  assert.equal((await handler(CONFIG)(event({ rawUrl: `${ORIGIN}/.netlify/functions/owner-bootstrap?token=forbidden-in-query` }))).statusCode, 403);
  assert.equal((await handler({ ...CONFIG, expiresAt: NOW })(event())).statusCode, 403);
  assert.equal((await handler({ ...CONFIG, issuedAt: NOW + 1 })(event())).statusCode, 403);
  assert.equal((await handler({ ...CONFIG, expiresAt: CONFIG.issuedAt + 45 * 60000 + 1 })(event())).statusCode, 503);
  assert.equal((await handler({ ...CONFIG, passwordHash: 'not-an-accepted-password-hash' })(event())).statusCode, 503);
  assert.equal(touched, 0);
});

test('fresh owner creation atomically binds identity, owner grant, audit and permanent one-use receipt', async t => {
  const { legacyStore, handler, product } = await fixture(t);
  let transaction;
  const original = legacyStore.productIdentity.bind(legacyStore);
  legacyStore.productIdentity = async input => { transaction = input; return original(input); };
  const result = await handler(event());
  assert.equal(result.statusCode, 200); assert.deepEqual(payload(result), { ok: true, ownerId: USER, created: true, unlimited: true });
  const user = await legacyStore.findUserByEmail(CONFIG.email), account = await product.get('accounts', USER);
  assert.equal(user.id, USER); assert.equal(await verifyPassword(PASSWORD, user.password_hash), true);
  assert.equal(isOwnerAccount(account.value), true); assert.equal(account.value.verificationMethod, 'operator_provisioned');
  assert.deepEqual(account.value.billing, { status: 'none', paidUntil: null });
  assert.deepEqual((await legacyStore.getState(USER)).state, createInitialState({ now: NOW }));
  assert.equal(transaction.operation, 'create'); assert.deepEqual(transaction.changes.map(change => change.ns).sort(), ['accounts', 'audit', 'jobs']);
  assert(transaction.changes.every(change => change.expiresAt === null));
  const receipt = await product.get('jobs', `owner-bootstrap:${ID}`);
  assert.equal(receipt.ownerId, SYSTEM_OWNER); assert.equal(receipt.expiresAt, null); assert.equal(receipt.value.ownerId, USER);
  assert.equal(JSON.stringify(payload(result)).includes(PASSWORD), false); assert.equal(JSON.stringify(payload(result)).includes(PASSWORD_HASH), false);
});

test('existing verified owner promotion preserves password, MFA, sessions, account data and billing', async t => {
  const { legacyStore, handler, product } = await fixture(t);
  const user = await existingIdentity(legacyStore);
  await put(product, 'mfa', OTHER, OTHER, { enabled: true, secret: 'fixture-encrypted-mfa-material', recoveryHashes: ['fixture-recovery-hash'] });
  await legacyStore.createSession({ token_hash: 'a'.repeat(64), user_id: OTHER, created_at: NOW - 1000, expires_at: NOW + 3600000 });
  const beforeAccount = await product.get('accounts', OTHER), beforeMfa = await product.get('mfa', OTHER), beforeState = await legacyStore.getState(OTHER);
  const result = await handler(event());
  assert.equal(result.statusCode, 200); assert.deepEqual(payload(result), { ok: true, ownerId: OTHER, created: false, unlimited: true });
  const after = await product.get('accounts', OTHER);
  assert.equal(isOwnerAccount(after.value), true); assert.deepEqual(after.value.billing, beforeAccount.value.billing);
  const { access, ...rest } = after.value; assert.deepEqual(rest, beforeAccount.value);
  assert.equal((await legacyStore.findUserByEmail(CONFIG.email)).password_hash, user.password_hash);
  assert.deepEqual(await product.get('mfa', OTHER), beforeMfa); assert.deepEqual(await legacyStore.getState(OTHER), beforeState);
  assert.equal((await legacyStore.getSession('a'.repeat(64), NOW)).id, OTHER);
});

test('existing unverified, missing-account and deletion-pending identities cannot receive a grant', async t => {
  for (const settings of [{ verified: false }, { account: false }, { deletion: true }]) {
    const legacyStore = await createLocalStore(':memory:');
    try {
      const user = await existingIdentity(legacyStore, settings);
      const handler = createOwnerBootstrapHandler({ env: ENV, store: legacyStore, now: () => NOW, configuration: CONFIG });
      const result = await handler(event());
      assert.equal(result.statusCode, settings.deletion ? 409 : 403);
      assert.equal((await legacyStore.findUserById(OTHER)).password_hash, user.password_hash);
      assert.equal(isOwnerAccount((await legacyStore.product.get('accounts', OTHER))?.value), false);
      assert.equal(await legacyStore.product.get('jobs', `owner-bootstrap:${ID}`), null);
    } finally { legacyStore.close(); }
  }
});

test('concurrent requests and repeated authorization create exactly one identity and one audit event', async t => {
  const { legacyStore, handler, product } = await fixture(t);
  let applied = 0;
  const original = legacyStore.productIdentity.bind(legacyStore);
  legacyStore.productIdentity = async input => { const result = await original(input); if (result.status === 'applied') applied++; return result; };
  const results = await Promise.all(Array.from({ length: 8 }, () => handler(event())));
  assert(results.every(result => result.statusCode === 200)); assert.equal(applied, 1);
  assert(results.every(result => payload(result).ownerId === USER));
  assert.equal((await product.list('audit', { ownerId: USER })).length, 1);
  const replay = payload(await handler(event())); assert.equal(replay.replayed, true); assert.equal(replay.ownerId, USER);
  assert.equal((await product.list('jobs', { ownerId: SYSTEM_OWNER })).length, 1);
  const later = createOwnerBootstrapHandler({ env: ENV, store: legacyStore, now: () => CONFIG.expiresAt, configuration: CONFIG });
  assert.equal((await later(event())).statusCode, 403); assert.equal(applied, 1);
});

test('a lost response replays its durable receipt; failed transactions cannot leave a privileged partial identity', async t => {
  const { legacyStore, handler, product } = await fixture(t);
  const original = legacyStore.productIdentity.bind(legacyStore);
  legacyStore.productIdentity = async input => { await original(input); throw new Error('Simulated response loss with private provider detail.'); };
  const recovered = await handler(event()); assert.equal(recovered.statusCode, 200); assert.equal(payload(recovered).replayed, true);
  assert.equal(isOwnerAccount((await product.get('accounts', USER)).value), true);

  const otherStore = await createLocalStore(':memory:');
  try {
    await put(otherStore.product, 'audit', `${USER}:owner-bootstrap:${ID}`, USER, { kind: 'preexisting-conflict-fixture' });
    const blocked = createOwnerBootstrapHandler({ env: ENV, store: otherStore, now: () => NOW, configuration: CONFIG });
    const failure = await blocked(event()); assert.equal(failure.statusCode, 409);
    assert.equal(await otherStore.findUserByEmail(CONFIG.email), null);
    assert.equal(await otherStore.product.get('accounts', USER), null);
    assert.equal(await otherStore.product.get('jobs', `owner-bootstrap:${ID}`), null);
  } finally { otherStore.close(); }
});

test('runtime bootstrap configuration may be decrypted lazily and errors contain no private server material', async t => {
  const { legacyStore } = await fixture(t);
  const sealed = sealRuntimeValue(CONFIG, ENV, 'owner-bootstrap-v1');
  const handler = createOwnerBootstrapHandler({ env: ENV, store: legacyStore, now: () => NOW, configuration: () => openRuntimeValue(sealed, ENV, 'owner-bootstrap-v1') });
  assert.equal((await handler(event())).statusCode, 200);
  const failing = createOwnerBootstrapHandler({ env: ENV, store: legacyStore, now: () => NOW, configuration: () => { throw new Error('fixture-private-master-or-token-details'); } });
  const result = await failing(event()); assert.equal(result.statusCode, 503); assert.equal(result.body.includes('fixture-private-master'), false);
});

test('deployment bootstrap configuration is supplied exclusively as protected environment JSON', () => {
  const sealed = sealRuntimeValue(CONFIG, ENV, 'owner-bootstrap-v1');
  assert.deepEqual(loadOwnerBootstrapConfiguration({ ...ENV, PRODUCT_OWNER_BOOTSTRAP_ENVELOPE: JSON.stringify(sealed) }), CONFIG);
  for (const raw of [undefined, '', '{broken-json', 'null', 'x'.repeat(65537), JSON.stringify(sealRuntimeValue({ unrelated: true }, ENV, 'owner-market-v1'))]) {
    assert.throws(() => loadOwnerBootstrapConfiguration({ ...ENV, PRODUCT_OWNER_BOOTSTRAP_ENVELOPE: raw }), { code: 'OWNER_BOOTSTRAP_NOT_CONFIGURED' });
  }
  assert.throws(() => loadOwnerBootstrapConfiguration({ PRODUCT_OWNER_BOOTSTRAP_ENVELOPE: JSON.stringify(sealed) }), { code: 'OWNER_BOOTSTRAP_NOT_CONFIGURED' });
});
