import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createInitialState } from '../netlify/terminal/engine.mjs';
import { createOwnerGrant, isOwnerAccount, isOwnerContext } from '../netlify/product/owner.mjs';
import { deriveEntitlements, requireEntitlement, FEATURES } from '../netlify/product/entitlements.mjs';
import { reserveAi, settleAi, getAiUsage, explainAi } from '../netlify/product/ai.mjs';
import { handlePublicAuth } from '../netlify/product/auth.mjs';

// All identities, credentials and provider responses here are explicit fixtures.
const NOW = Date.parse('2026-11-18T12:00:00Z');
const USER = 'a1111111-1111-4111-8111-111111111111';
const OTHER = 'b2222222-2222-4222-8222-222222222222';
const ownerAccount = () => ({ emailVerified: true, access: createOwnerGrant(NOW), billing: { status: 'none', paidUntil: null } });

async function fixture(t, account = ownerAccount()) {
  const legacyStore = await createLocalStore(':memory:'); t.after(() => legacyStore.close());
  const user = { id: USER, kind: 'user', email: 'owner@example.test', created_at: NOW, password_hash: 'explicit-fixture-only', expires_at: null };
  await legacyStore.createUser(user, createInitialState({ now: NOW }));
  await legacyStore.product.transact([{ ns: 'accounts', key: USER, ownerId: USER, expectedVersion: null, value: account }]);
  const ctx = { legacyStore, store: legacyStore.product, user, account, env: {}, now: NOW, origin: 'https://nortivo.test', rate: async () => {}, ip: 'fixture', fetcher: async () => { throw new Error('Unexpected fixture network request.'); } };
  ctx.entitlements = deriveEntitlements(account, NOW);
  ctx.requireFeature = feature => requireEntitlement(account, feature, NOW);
  return ctx;
}
async function seedUsage(ctx, value) {
  const key = `${USER}:2026-11`, row = await ctx.store.get('ai_usage', key);
  await ctx.store.transact([{ ns: 'ai_usage', key, ownerId: USER, expectedVersion: row?.version ?? null, value }]);
}

test('an explicit verified owner grant unlocks Pro without a subscription or fake paid period', () => {
  const account = ownerAccount(), before = structuredClone(account.billing);
  const access = deriveEntitlements(account, NOW);
  assert.equal(isOwnerAccount(account), true);
  assert.equal(access.tier, 'pro'); assert.equal(access.reason, 'owner');
  assert.equal(access.billingExempt, true); assert.equal(access.unlimited, true); assert.equal(access.paidUntil, null);
  assert.deepEqual(access.features, FEATURES.pro);
  assert.doesNotThrow(() => requireEntitlement(account, 'ai.advanced', NOW));
  assert.deepEqual(account.billing, before);
});

test('unverified, incomplete, revoked and client-style owner flags never confer owner access', () => {
  const valid = ownerAccount();
  for (const account of [
    { ...valid, emailVerified: false }, { ...valid, emailVerified: 'true' },
    { emailVerified: true, role: 'owner', admin: true, owner: true },
    { emailVerified: true, access: { role: 'owner', active: true } },
    { ...valid, access: { ...valid.access, active: false } },
    { ...valid, access: { ...valid.access, grantedBy: 'browser' } },
    { ...valid, access: { ...valid.access, grantedAt: '1763467200000' } },
  ]) {
    assert.equal(isOwnerAccount(account), false);
    assert.equal(deriveEntitlements(account, NOW).tier, 'none');
  }
  assert.equal(isOwnerContext({ user: { kind: 'guest' }, account: valid }), false);
  assert.equal(isOwnerContext({ user: { kind: 'user' }, account: valid }), true);
});

test('paid and expired customer behavior remains unchanged and revocation restores billing rules', () => {
  const paid = { emailVerified: true, billing: { tier: 'portfolio', paidUntil: NOW + 1000 } };
  assert.equal(deriveEntitlements(paid, NOW).tier, 'portfolio');
  assert.equal(deriveEntitlements(paid, NOW + 1001).tier, 'none');
  assert.equal(deriveEntitlements(paid, NOW).unlimited, undefined);
  const revoked = { ...paid, access: { ...createOwnerGrant(NOW), active: false } };
  assert.equal(deriveEntitlements(revoked, NOW).tier, 'portfolio');
  assert.throws(() => requireEntitlement(revoked, 'automation.run', NOW), { code: 'UPGRADE_REQUIRED' });
});

test('owner access retains account deletion restrictions and does not grant execution readiness', () => {
  const access = deriveEntitlements({ ...ownerAccount(), deletionRequest: { status: 'review_required' } }, NOW);
  assert.equal(access.tier, 'pro'); assert(access.features.includes('market.read'));
  for (const feature of ['broker.connect', 'order.submit', 'automation.run', 'strategy.write']) assert.equal(access.features.includes(feature), false);
  assert.equal(access.liveReleaseEnabled, undefined); assert.equal(access.providerPermissions, undefined);
});

test('owner AI reservations waive monthly product quotas but retain atomic metering and idempotency', async t => {
  const ctx = await fixture(t); await seedUsage(ctx, { requests: 1000, tokens: 10000000 });
  const before = structuredClone(ctx.account.billing);
  const reservations = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveAi(ctx, { requestId: `owner-reservation-${i}`, digest: `owner-digest-${i}`, inputBound: 100, outputBound: 200, tier: 'pro' })));
  assert(reservations.every(result => !result.replay && result.request.quotaExempt === true));
  const usage = await getAiUsage(ctx, 'pro');
  assert.equal(usage.unlimited, true); assert.equal(usage.requestLimit, null); assert.equal(usage.tokenLimit, null);
  assert.equal(usage.remainingRequests, null); assert.equal(usage.remainingTokens, null);
  assert.equal(usage.usedRequests, 1012); assert.equal(usage.usedTokens, 10003600);
  assert.equal(JSON.stringify(usage).includes('Infinity'), false);
  const replay = await reserveAi(ctx, { requestId: 'owner-reservation-0', digest: 'owner-digest-0', inputBound: 100, outputBound: 200, tier: 'pro' });
  assert.equal(replay.replay, true);
  await assert.rejects(() => reserveAi(ctx, { requestId: 'owner-reservation-0', digest: 'another-input', inputBound: 100, outputBound: 200, tier: 'pro' }), { code: 'IDEMPOTENCY_CONFLICT' });
  await settleAi(ctx, 'owner-reservation-0', { state: 'completed', inputTokens: 10, outputTokens: 20 });
  assert.equal((await getAiUsage(ctx, 'pro')).usedTokens, 10003330);
  assert.deepEqual(ctx.account.billing, before);
});

test('ordinary customers, guests and revoked owners still face the existing AI quota', async t => {
  const ctx = await fixture(t, { emailVerified: true, billing: { tier: 'pro', paidUntil: NOW + 1000 } });
  await seedUsage(ctx, { requests: 200, tokens: 0 });
  await assert.rejects(() => reserveAi(ctx, { requestId: 'customer-over-quota', digest: 'fixture', inputBound: 100, outputBound: 100, tier: 'pro' }), { code: 'AI_QUOTA_EXHAUSTED' });
  assert.equal((await getAiUsage(ctx, 'pro')).remainingRequests, 0);
  ctx.account = ownerAccount(); ctx.user = { ...ctx.user, kind: 'guest' };
  await assert.rejects(() => reserveAi(ctx, { requestId: 'guest-over-quota', digest: 'fixture', inputBound: 100, outputBound: 100, tier: 'pro' }), { code: 'AI_QUOTA_EXHAUSTED' });
  ctx.user = { ...ctx.user, kind: 'user' }; ctx.account.access.active = false;
  await assert.rejects(() => reserveAi(ctx, { requestId: 'revoked-over-quota', digest: 'fixture', inputBound: 100, outputBound: 100, tier: 'pro' }), { code: 'AI_QUOTA_EXHAUSTED' });
});

test('owner AI preserves per-request context limits and failed-provider replay safety', async t => {
  const ctx = await fixture(t); ctx.env.OPENAI_API_KEY = 'fixture-not-a-real-key';
  let calls = 0; ctx.fetcher = async () => { calls++; throw new Error('Explicit fixture timeout.'); };
  const request = { requestId: 'owner-provider-timeout', question: 'Explain portfolio diversification', kind: 'advanced' };
  await assert.rejects(() => explainAi(ctx, request, {}), { code: 'AI_PROVIDER_UNAVAILABLE' });
  await assert.rejects(() => explainAi(ctx, request, {}), { code: 'AI_REQUEST_FAILED' });
  assert.equal(calls, 1); assert.equal((await getAiUsage(ctx)).usedRequests, 1);
  await ctx.store.transact([{ ns: 'portfolios', key: `${OTHER}:private-portfolio`, ownerId: OTHER, expectedVersion: null, value: { notes: 'must remain private' } }]);
  await assert.rejects(() => explainAi(ctx, { ...request, requestId: 'owner-private-record', portfolioId: 'private-portfolio' }, {}), { code: 'NOT_FOUND' });
  assert.equal(calls, 1);
  await ctx.store.transact([{ ns: 'strategies', key: `${USER}:oversized-context`, ownerId: USER, expectedVersion: null, value: { kind: 'daily_sma_crossover', instrumentId: 'X'.repeat(35000), quantity: '1', fast: 20, slow: 50, timeframe: '1d', version: 1, enabled: false } }]);
  await assert.rejects(() => explainAi(ctx, { ...request, requestId: 'owner-oversized-evidence', strategyId: 'oversized-context' }, {}), { code: 'AI_CONTEXT_TOO_LARGE' });
  assert.equal(calls, 1); assert.equal((await getAiUsage(ctx)).usedRequests, 1);
});

test('signup ignores requested owner/admin/billing/verification fields', async t => {
  const ctx = await fixture(t); const email = 'new-customer@example.test';
  const unsigned = { ...ctx, user: null, env: { PRODUCT_TEST_MODE: 'true' }, testEmail: async () => {} };
  await handlePublicAuth(unsigned, 'signup', { email, password: 'fixture-long-password-only', name: 'Fixture', access: createOwnerGrant(NOW), emailVerified: true, admin: true, owner: true, billing: { tier: 'pro', paidUntil: NOW + 1000000 } }, async () => { throw new Error('Signup must not sign in automatically.'); });
  const user = await ctx.legacyStore.findUserByEmail(email), record = await ctx.store.get('accounts', user.id);
  assert.equal(record.value.emailVerified, false); assert.equal(record.value.access, undefined);
  assert.equal(record.value.billing.status, 'none'); assert.equal(isOwnerAccount(record.value), false);
  assert.equal(deriveEntitlements(record.value, NOW).tier, 'none');
});


test('a single atomic provider budget covers owners and customers across retries and UTC rollover', async t => {
  const ctx = await fixture(t);
  ctx.env.PRODUCT_AI_DAILY_PROVIDER_TOKEN_LIMIT = '400';
  const customer = { ...ctx, user:{ id: OTHER, kind:'user' }, account:{emailVerified:true} };
  const reserve = (actor, id) => reserveAi(actor, { requestId:id, digest:id, tier:'pro', inputBound:100, outputBound:100 });
  const results = await Promise.allSettled([reserve(ctx,'one'),reserve(customer,'two'),reserve(ctx,'three')]);
  assert.equal(results.filter(item=>item.status==='fulfilled').length,2);
  assert.equal(results.find(item=>item.status==='rejected').reason.code,'AI_PROVIDER_BUDGET');
  assert.equal((await reserve(ctx,'one')).replay,true);
  assert.equal((await getAiUsage(ctx)).unlimited,true);
  const next = {...ctx,now:ctx.now+86400000};
  assert.equal((await reserve(next,'next')).replay,false);
  await assert.rejects(reserve(ctx,'old-clock'),{code:'AI_NOT_CONFIGURED'});
  assert.equal((await ctx.store.get('provider_meter','openai:daily')).value.reservedTokens,200);
});
