import test from 'node:test';
import assert from 'node:assert/strict';
import { sealRuntimeValue } from '../netlify/product/runtime-envelope.mjs';
import { loadOwnerMarketEnvironment } from '../netlify/product/runtime-owner-market.mjs';

const MASTER = Buffer.alloc(32, 9).toString('base64url');
const PAIR = { keyId: 'fixture-paper-key-id', secretKey: 'fixture-paper-secret-only' };
const envelope = () => sealRuntimeValue(PAIR, { PRODUCT_ENCRYPTION_KEY: MASTER }, 'owner-market-v1');

test('sealed owner credentials remain server-only while live security policy changes are preserved', () => {
  const env = { PRODUCT_ENCRYPTION_KEY: MASTER, PRODUCT_ADMIN_USER_IDS: 'first', TERMINAL_ORIGIN: 'https://fixture.test' };
  const selected = loadOwnerMarketEnvironment(env, envelope());
  assert.equal(selected.APCA_API_KEY_ID, PAIR.keyId);
  assert.equal(selected.PRODUCT_OWNER_MARKET_PROVIDER, 'nortivo');
  env.PRODUCT_ADMIN_USER_IDS = 'revoked'; env.NEW_POLICY = 'enforced';
  assert.equal(selected.PRODUCT_ADMIN_USER_IDS, 'revoked'); assert.equal(selected.NEW_POLICY, 'enforced');
  assert.equal({ ...selected }.TERMINAL_ORIGIN, env.TERMINAL_ORIGIN);
  assert.equal({ ...selected }.NEW_POLICY, 'enforced');
});
test('production defaults load only the protected market-envelope environment value', () => {
  const env = { PRODUCT_ENCRYPTION_KEY: MASTER, PRODUCT_OWNER_MARKET_ENVELOPE: JSON.stringify(envelope()) };
  const selected = loadOwnerMarketEnvironment(env);
  assert.equal(selected.APCA_API_KEY_ID, PAIR.keyId); assert.equal(selected.APCA_API_SECRET_KEY, PAIR.secretKey);
  assert.equal(selected.PRODUCT_OWNER_MARKET_PROVIDER, 'nortivo');
  const absent = { PRODUCT_ENCRYPTION_KEY: MASTER };
  assert.equal(loadOwnerMarketEnvironment(absent), absent);
  assert.equal(absent.APCA_API_KEY_ID, undefined);
});
test('malformed, wrong-purpose and oversized protected market configuration fails closed', () => {
  const bootstrap = sealRuntimeValue({ unrelated: true }, { PRODUCT_ENCRYPTION_KEY: MASTER }, 'owner-bootstrap-v1');
  for (const raw of ['{broken-json', 'null', JSON.stringify(bootstrap), 'x'.repeat(65537)]) {
    const env = { PRODUCT_ENCRYPTION_KEY: MASTER, PRODUCT_OWNER_MARKET_ENVELOPE: raw };
    assert.equal(loadOwnerMarketEnvironment(env), env); assert.equal(env.APCA_API_KEY_ID, undefined);
  }
});
test('missing master, failed authentication and invalid payload preserve the original environment', () => {
  for (const env of [{}, { PRODUCT_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64url') }]) assert.equal(loadOwnerMarketEnvironment(env, envelope()), env);
  const env = { PRODUCT_ENCRYPTION_KEY: MASTER };
  assert.equal(loadOwnerMarketEnvironment(env, sealRuntimeValue({ ...PAIR, unexpected: 'no' }, env, 'owner-market-v1')), env);
});
test('explicit and rotated credentials take precedence without mixing old secret halves', () => {
  const env = { PRODUCT_ENCRYPTION_KEY: MASTER };
  const selected = loadOwnerMarketEnvironment(env, envelope());
  env.APCA_API_KEY_ID = 'new-fixture-key-id';
  assert.equal(selected.APCA_API_KEY_ID, env.APCA_API_KEY_ID); assert.equal(selected.APCA_API_SECRET_KEY, '');
  env.APCA_API_SECRET_KEY = 'new-fixture-secret'; assert.equal(selected.APCA_API_SECRET_KEY, env.APCA_API_SECRET_KEY);
  const explicit = loadOwnerMarketEnvironment(env, envelope()); env.PRODUCT_ADMIN_USER_IDS = 'new-admin'; assert.equal(explicit.PRODUCT_ADMIN_USER_IDS, 'new-admin');
  env.PRODUCT_OWNER_MARKET_PROVIDER = 'disabled'; assert.equal(selected.PRODUCT_OWNER_MARKET_PROVIDER, 'disabled');
  assert.equal(loadOwnerMarketEnvironment(env, envelope()), env);
});
