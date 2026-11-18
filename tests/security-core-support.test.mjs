import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedSupportLimiter } from '../netlify/functions/_ticket-security.mjs';
import { createMemoryRateStore } from '../services/security-core/src/rate-limit.mjs';
import { json, supabase, sendEmail, isAdmin, createAdminSession } from '../netlify/functions/_utils.mjs';

const env = { ADMIN_SESSION_SECRET: 'synthetic-support-core-secret-with-at-least-32-bytes' };
const event = { headers: { 'x-nf-client-connection-ip': 'synthetic-verified-connection', 'x-forwarded-for': 'untrusted-value' } };
function store() {
  const memory = createMemoryRateStore(); const keys = [];
  return { durable: true, keys, consumeRateLimit(...args) { keys.push(args[0]); return memory.consumeRateLimit(...args); } };
}
test('support function instances share atomic limits and use pseudonymous keys', async () => {
  const shared = store(), logs = [];
  const first = createSharedSupportLimiter({ store: shared, env, now: () => 10000, auditSink: line => logs.push(line) });
  const second = createSharedSupportLimiter({ store: shared, env, now: () => 10000, auditSink: line => logs.push(line) });
  assert.equal(await first(event, 'ticket-create', { email: 'private@example.invalid', ipLimit: 1 }), true);
  assert.equal(await second(event, 'ticket-create', { email: 'different@example.invalid', ipLimit: 1 }), false);
  assert.equal(shared.keys.length, 3, 'blocked connection cannot allocate another email budget');
  assert.ok(shared.keys.every(key => /^[a-f0-9]{64}$/.test(key)));
  assert.doesNotMatch(logs.join('\n'), /private@example|different@example|synthetic-verified-connection|untrusted-value/);
});
test('support protection rejects storage outages and audit sink outages before business work', async () => {
  const unavailable = createSharedSupportLimiter({ store: { durable: true, consumeRateLimit() { throw Error('private-store-diagnostic'); } }, env, auditSink() {} });
  await assert.rejects(unavailable(event, 'ticket-read'), { code: 'RATE_LIMIT_UNAVAILABLE' });
  const invalid = createSharedSupportLimiter({ store: { durable: true, consumeRateLimit() { return { allowed: true }; } }, env, auditSink() {} });
  await assert.rejects(invalid(event, 'ticket-read'), { code: 'RATE_LIMIT_UNAVAILABLE' });
  const noAudit = createSharedSupportLimiter({ store: store(), env, auditSink() { throw Error('private-sink-diagnostic'); } });
  await assert.rejects(noAudit(event, 'ticket-read'), { code: 'AUDIT_UNAVAILABLE' });
});
test('support transports reject insecure storage origins and enforce redirect/time limits', async t => {
  const previous = Object.fromEntries(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'SUPPORT_FROM_EMAIL'].map(name => [name, process.env[name]]));
  t.after(() => { for (const [name, value] of Object.entries(previous)) value === undefined ? delete process.env[name] : process.env[name] = value; });
  Object.assign(process.env, { SUPABASE_URL: 'http://storage.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key', RESEND_API_KEY: 'synthetic-mail-key', SUPPORT_FROM_EMAIL: 'test@example.invalid' });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url, options }); return new Response('{}'); });
  await assert.rejects(supabase('tickets'));
  assert.equal(calls.length, 0);
  process.env.SUPABASE_URL = 'https://storage.invalid';
  await supabase('tickets', { redirect: 'follow', signal: undefined });
  await sendEmail({ to: 'test@example.invalid', subject: 'Synthetic', text: 'Synthetic test' });
  assert.equal(calls.length, 2);
  for (const call of calls) { assert.equal(call.options.redirect, 'error'); assert.ok(call.options.signal instanceof AbortSignal); }
  await assert.rejects(supabase('https://attacker.invalid/'));
  assert.equal(calls.length, 2);
});
test('support response size bounds and function headers apply without legacy admin authorization', async t => {
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET };
  t.after(() => { for (const [name, value] of Object.entries(previous)) value === undefined ? delete process.env[name] : process.env[name] = value; });
  Object.assign(process.env, { SUPABASE_URL: 'https://storage.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key', ADMIN_SESSION_SECRET: env.ADMIN_SESSION_SECRET });
  t.mock.method(globalThis, 'fetch', async () => new Response('x'.repeat(2_000_001)));
  await assert.rejects(supabase('tickets'), /exceeded its limit/);
  assert.equal(isAdmin({ headers: { cookie: `nortivo_admin=${createAdminSession()}` } }), false);
  const response = json(401, { code: 'AUTH_REQUIRED' });
  assert.match(response.headers['Content-Security-Policy'], /default-src 'none'/);
  assert.equal(response.headers['X-Frame-Options'], 'DENY');
  assert.match(response.headers['Cache-Control'], /no-store/);
});
