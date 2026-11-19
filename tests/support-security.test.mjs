import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { handler as access } from '../netlify/functions/ticket-access.mjs';
import { handler as tickets } from '../netlify/functions/tickets.mjs';
import { handler as defaultAdminTickets, createHandler as createAdminTickets } from '../netlify/functions/admin-tickets.mjs';
import { handler as adminLogin } from '../netlify/functions/admin-login.mjs';
import { handler as defaultReply, createHandler as createReply } from '../netlify/functions/reply-ticket.mjs';
import { createCoreAdminFixture } from './helpers/core-admin.mjs';
const adminFixture = await createCoreAdminFixture();
test.after(() => adminFixture.close());
const adminTickets = createAdminTickets({authorizeAdmin: adminFixture.authorizeAdmin});
const reply = createReply({authorizeAdmin: adminFixture.authorizeAdmin});
import { createAdminSession } from '../netlify/functions/_utils.mjs';
import { LINK_TTL, SESSION_TTL, TICKET_COOKIE, consumeRateLimit, issueToken, rateLimit, readToken, signaturesEqual, siteOrigin, sameOrigin, ticketCookie } from '../netlify/functions/_ticket-security.mjs';

// Dummy configuration only. Every fetch is intercepted; no production services are used.
Object.assign(process.env, {
  ADMIN_SESSION_SECRET: 'synthetic-test-session-secret-at-least-32-characters', ADMIN_PASSWORD: 'synthetic-password',
  SUPABASE_URL: 'https://database.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key', RESEND_API_KEY: 'synthetic-resend',
  SUPPORT_FROM_EMAIL: 'Support <support@example.invalid>', URL: 'https://nortivo.no', CONTEXT: 'production',
});
delete process.env.DEPLOY_PRIME_URL;
delete process.env.DEPLOY_URL;
delete process.env.NETLIFY_DEV;
delete process.env.ADMIN_NOTIFICATION_EMAIL;

const identity = { ticketNumber: 'NT-2026-ABC234', email: 'synthetic@example.invalid' };
const syntheticTicket = { id: 'test-ticket-id', ticket_number: identity.ticketNumber, email: identity.email, name: 'Synthetic user', subject: 'Synthetic subject', message: 'Synthetic private message', status: 'open' };
let requestCounter = 0;
const event = (body, { httpMethod = 'POST', ...overrides } = {}) => ({ httpMethod, rawUrl: 'https://nortivo.no/.netlify/functions/ticket-access',
  headers: { origin: 'https://nortivo.no', 'content-type': 'application/json', 'x-forwarded-proto': 'https', 'x-nf-client-connection-ip': `test-${++requestCounter}` },
  ...(['GET', 'HEAD'].includes(httpMethod) ? {} : { body: JSON.stringify(body) }), ...overrides });
const data = response => JSON.parse(response.body);
const response = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value), json: async () => value });
const cookieHeader = value => value.split(';')[0];
let rateCounters;
const isRateRpc = url => String(url).includes('/rest/v1/rpc/terminal_consume_limit');
const serviceCalls = () => globalThis.fetch.mock.calls.filter(call => !isRateRpc(call.arguments[0]));
function mockFetch(t, implementation) {
  return t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (!isRateRpc(url)) return implementation(url, options);
    const {p_key:key,p_limit:limit,p_window_ms:windowMs,p_now:now} = JSON.parse(options.body);
    let bucket = rateCounters.get(key);
    if (!bucket || bucket.until <= now) { bucket = {count:0,until:now+windowMs}; rateCounters.set(key,bucket); }
    bucket.count++;
    return response({allowed:bucket.count<=limit,retryAfterMs:bucket.count<=limit?0:bucket.until-now});
  });
}

beforeEach(t => {
  rateCounters = new Map();
  mockFetch(t, async () => { throw new Error('Unexpected external call blocked by test.'); });
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'info', () => {});
});

test('tokens expire exactly at their boundary and use independent purposes', () => {
  const now = 1_000_000;
  for (const [purpose, ttl] of [['email-proof', LINK_TTL], ['ticket-session', SESSION_TTL]]) {
    const token = issueToken(purpose, identity, now);
    assert.equal(readToken(token, purpose, now + ttl - 1).email, identity.email);
    assert.equal(readToken(token, purpose, now + ttl), null);
    assert.equal(readToken(token, purpose, now - 1), null);
    assert.equal(readToken(token, purpose === 'email-proof' ? 'ticket-session' : 'email-proof', now), null);
    assert.ok(!token.includes(identity.email));
    assert.ok(!token.includes(Buffer.from(identity.email).toString('base64url')));
  }
});

test('signatures reject same-length tampering, malformed lengths and noncanonical encodings', () => {
  const signature = crypto.createHmac('sha256', 'synthetic').update('payload').digest('base64url');
  assert.equal(signaturesEqual(signature, signature), true);
  const changed = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  assert.equal(signaturesEqual(changed, signature), false);
  assert.equal(signaturesEqual(signature.slice(1), signature), false);
  assert.equal(signaturesEqual('='.repeat(43), signature), false);
  const token = issueToken('email-proof', identity);
  const parts = token.split('.');
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  assert.equal(readToken(parts.join('.'), 'email-proof'), null);
  assert.equal(readToken(`${token}.extra`, 'email-proof'), null);
});

test('customer tokens cannot authenticate as admin, and admin cookie cannot read a customer ticket', async () => {
  const token = issueToken('ticket-session', identity);
  const deniedAdmin = await defaultAdminTickets(event({}, {httpMethod:'GET',headers:{cookie:`nortivo_admin=${token}`}}));
  assert.equal(deniedAdmin.statusCode,401);
  const result = await tickets(event({}, { httpMethod: 'GET', queryStringParameters: identity, headers: adminFixture.headers() }));
  assert.equal(result.statusCode, 401);
  assert.equal(serviceCalls().length, 0);
});

test('unauthenticated and wrong-ticket lookups never reach storage', async () => {
  for (const headers of [{}, { cookie: `${TICKET_COOKIE}=bad` }, { cookie: cookieHeader(ticketCookie({ ...identity, ticketNumber: 'NT-2026-ZZZ999' })) }, { cookie: cookieHeader(ticketCookie({ ...identity, email: 'different@example.invalid' })) }]) {
    const result = await tickets(event({}, { httpMethod: 'GET', headers, queryStringParameters: identity }));
    assert.equal(result.statusCode, 401);
    assert.equal(data(result).code, 'ACCESS_REQUIRED');
  }
  assert.equal(globalThis.fetch.mock.calls.length, 0);
});

test('valid request emails a safe fragment link, verifies and reads only the matching ticket', async t => {
  const mails = [];
  mockFetch(t, async (url, options = {}) => {
    if (url === 'https://api.resend.com/emails') { mails.push(JSON.parse(options.body)); return response({ id: 'synthetic-email-id' }); }
    assert.ok(url.startsWith('https://database.invalid/rest/v1/'));
    if (url.includes('ticket_replies?')) return response([{ body: 'Synthetic private reply' }]);
    return response([syntheticTicket]);
  });
  const result = await access(event({ action: 'request', ...identity, language: 'nb' }));
  assert.equal(result.statusCode, 202);
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, [identity.email]);
  const link = mails[0].text.match(/https:\/\/\S+/)[0];
  assert.equal(new URL(link).origin, 'https://nortivo.no');
  assert.equal(new URL(link).search, '');
  assert.ok(!link.includes(identity.email));
  assert.ok(!mails[0].text.includes(syntheticTicket.message));
  assert.match(mails[0].subject, /Bekreft tilgang/);
  const token = decodeURIComponent(new URL(link).hash.slice('#access='.length));
  const verified = await access(event({ action: 'verify', token }));
  assert.equal(verified.statusCode, 200);
  assert.deepEqual(data(verified), { ok: true, ...identity });
  assert.match(verified.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict; Max-Age=1800/);
  const cookie = cookieHeader(verified.headers['Set-Cookie']);
  for (const params of [identity, { ticket: identity.ticketNumber, email: identity.email }, { ticketNumber: identity.ticketNumber }]) {
    const lookup = await tickets(event({}, { httpMethod: 'GET', queryStringParameters: params, headers: { cookie } }));
    assert.equal(lookup.statusCode, 200);
    assert.equal(data(lookup).ticket.message, syntheticTicket.message);
    assert.equal(data(lookup).replies[0].body, 'Synthetic private reply');
    assert.equal(lookup.headers['Cache-Control'], 'no-store');
  }
});

test('missing ticket, throttling and service failure return the same neutral request response', async t => {
  const details = { ticketNumber: 'NT-2026-MISS99', email: 'missing@example.invalid' };
  mockFetch(t, async () => response([]));
  const first = await access(event({ action: 'request', ...details }));
  assert.equal(first.statusCode, 202);
  mockFetch(t, async () => { throw new Error('Synthetic secret must not leak.'); });
  const second = await access(event({ action: 'request', ...details }));
  const third = await access(event({ action: 'request', ...details }));
  const callsBefore = serviceCalls().length;
  const fourth = await access(event({ action: 'request', ...details }));
  assert.equal(serviceCalls().length, callsBefore);
  for (const current of [second, third, fourth]) { assert.equal(current.statusCode, 202); assert.equal(current.body, first.body); }
});

test('email delivery failure remains neutral and does not expose service response', async t => {
  mockFetch(t, async url => url === 'https://api.resend.com/emails'
    ? { ok: false, status: 500, text: async () => 'PRIVATE_PROVIDER_SECRET' } : response([syntheticTicket]));
  const result = await access(event({ action: 'request', ticketNumber: identity.ticketNumber, email: 'delivery@example.invalid' }));
  assert.equal(result.statusCode, 202);
  assert.ok(!result.body.includes('PRIVATE_PROVIDER_SECRET'));
  assert.ok(console.error.mock.calls.every(call => !JSON.stringify(call.arguments).includes('PRIVATE_PROVIDER_SECRET')));
});

test('verification rejects altered, expired, wrong-purpose and absent tokens without storage', async () => {
  for (const token of [undefined, 'invalid', issueToken('email-proof', identity, Date.now() - LINK_TTL - 1), issueToken('ticket-session', identity)]) {
    const result = await access(event({ action: 'verify', token, language: 'nb' }));
    assert.equal(result.statusCode, 401);
    assert.equal(data(result).code, 'INVALID_ACCESS');
    assert.ok(!result.headers['Set-Cookie']);
  }
  assert.equal(globalThis.fetch.mock.calls.length, 0);
});

test('same-origin checks reject cross-origin, absent origin on POST and unconfigured hosts', async () => {
  for (const overrides of [
    { headers: { origin: 'https://attacker.invalid' } },
    { headers: {} },
    { headers: { origin: 'https://nortivo.no', 'sec-fetch-site': 'cross-site' } },
    { rawUrl: 'https://attacker.invalid/.netlify/functions/ticket-access' },
    { headers: { origin: 'null' } },
  ]) {
    const result = await access(event({ action: 'verify', token: issueToken('email-proof', identity) }, overrides));
    assert.equal(result.statusCode, 403);
    assert.ok(!result.headers['Set-Cookie']);
  }
  assert.equal(sameOrigin(event({}, { headers: { referer: 'https://nortivo.no/support/' } }), { required: true }), true);
});

test('site links use allowlisted deployment origins and ignore hostile forwarded host headers', t => {
  assert.equal(siteOrigin(event({}, { rawUrl: 'https://attacker.invalid/path', headers: { host: 'attacker.invalid', 'x-forwarded-host': 'attacker.invalid' } })), 'https://nortivo.no');
  process.env.DEPLOY_PRIME_URL = 'https://deploy-preview-9--nortivo.netlify.app';
  t.after(() => { delete process.env.DEPLOY_PRIME_URL; });
  const preview = event({}, { rawUrl: `${process.env.DEPLOY_PRIME_URL}/.netlify/functions/ticket-access`, headers: { origin: process.env.DEPLOY_PRIME_URL } });
  assert.equal(siteOrigin(preview), process.env.DEPLOY_PRIME_URL);
  assert.equal(sameOrigin(preview, { required: true }), true);
  assert.equal(sameOrigin({ ...preview, headers: { origin: 'https://nortivo.no' } }, { required: true }), false);
});

test('isolated legacy limiter helpers count attempts and reset after their windows', () => {
  const key = crypto.randomUUID();
  assert.equal(consumeRateLimit('test', key, 2, 1000, 100), true);
  assert.equal(consumeRateLimit('test', key, 2, 1000, 101), true);
  assert.equal(consumeRateLimit('test', key, 2, 1000, 102), false);
  assert.equal(consumeRateLimit('test', key, 2, 1000, 1100), true);
});

test('repeated verification is throttled by Netlify IP regardless of spoofed forwarded IP', async () => {
  const request = event({ action: 'verify', token: issueToken('email-proof', identity) });
  for (let index = 0; index < 20; index++) {
    request.headers['x-forwarded-for'] = `spoofed-${index}`;
    assert.equal((await access(request)).statusCode, 200);
  }
  const limited = await access(request);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['Retry-After'], '900');
});

test('isolated legacy limiter helper prevents blocked IP from exhausting capacity', () => {
  const blocked = event({});
  const namespace = `capacity-${crypto.randomUUID()}`;
  assert.equal(rateLimit(blocked, namespace, { ipLimit: 1, email: 'first@example.invalid' }), true);
  for (let index = 0; index < 5100; index++) {
    assert.equal(rateLimit(blocked, namespace, { ipLimit: 1, email: `attempt-${index}@example.invalid` }), false);
  }
  assert.equal(rateLimit(event({}), namespace, { ipLimit: 1, email: 'new-user@example.invalid' }), true);
});

test('malformed JSON, oversized body and invalid identities fail before any services', async () => {
  for (const body of ['{', 'null', '[]', 'x'.repeat(20001)]) {
    const result = await access(event({}, { body }));
    assert.equal(result.statusCode, 400);
    assert.equal(data(result).code, 'BAD_REQUEST');
  }
  const wrongType = event({ action: 'request', ...identity });
  wrongType.headers['content-type'] = 'text/plain';
  assert.equal((await access(wrongType)).statusCode, 415);
  for (const details of [{ ticketNumber: 'bad', email: identity.email }, { ticketNumber: identity.ticketNumber, email: 'bad' }]) {
    assert.equal((await access(event({ action: 'request', ...details }))).statusCode, 400);
  }
  assert.equal(globalThis.fetch.mock.calls.length, 0);
});

test('new ticket remains schema-compatible, sends selected language and grants no private session', async t => {
  const calls = [];
  mockFetch(t, async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://api.resend.com/emails') return response({ id: 'synthetic-mail' });
    const saved = JSON.parse(options.body);
    assert.deepEqual(Object.keys(saved).sort(), ['email', 'message', 'name', 'subject', 'ticket_number']);
    assert.match(saved.subject, /^Kontakt:/);
    return response([{ ...saved, id: 'synthetic-id', status: 'open' }]);
  });
  const result = await tickets(event({ name: 'Synthetic', email: 'creation@example.invalid', subject: 'Kontakt: et spørsmål', message: 'Dette er en syntetisk test.', language: 'nb' }));
  assert.equal(result.statusCode, 201);
  assert.ok(!result.headers['Set-Cookie']);
  assert.equal(data(result).confirmationSent, true);
  assert.deepEqual(Object.keys(data(result).ticket).sort(), ['status', 'ticket_number']);
  const emailBody = JSON.parse(calls.find(call => call.url === 'https://api.resend.com/emails').options.body);
  assert.match(emailBody.text, /Vi har mottatt supportsaken/);
});

test('populated honeypot rejects without fake saved success, storage or email', async () => {
  const result = await tickets(event({ name: 'Synthetic', email: 'autofill@example.invalid', subject: 'Autofilled form', message: 'Synthetic complete message', company: 'autofilled.example', language: 'nb' }));
  assert.equal(result.statusCode, 400);
  assert.equal(data(result).code, 'INVALID_FIELDS');
  assert.equal(data(result).ticket, undefined);
  assert.equal(data(result).ok, undefined);
  assert.equal(data(result).confirmationSent, undefined);
  assert.equal(result.headers['Set-Cookie'], undefined);
  assert.equal(globalThis.fetch.mock.calls.length, 0);
});

test('saved ticket remains successful if confirmation email fails', async t => {
  mockFetch(t, async url => url === 'https://api.resend.com/emails' ? { ok: false, status: 500 } : response([syntheticTicket]));
  const result = await tickets(event({ name: 'Synthetic', email: 'saved@example.invalid', subject: 'Saved ticket', message: 'Synthetic complete message' }));
  assert.equal(result.statusCode, 201);
  assert.equal(data(result).confirmationSent, false);
});

test('database exceptions are caught and do not expose provider or configuration data', async t => {
  mockFetch(t, async () => { throw new Error('SECRET_DATABASE_KEY_AND_EMAIL'); });
  const result = await tickets(event({}, { httpMethod: 'GET', queryStringParameters: identity, headers: { cookie: cookieHeader(ticketCookie(identity)) } }));
  assert.equal(result.statusCode, 503);
  assert.equal(data(result).code, 'UNAVAILABLE');
  assert.ok(!result.body.includes('SECRET'));
});

test('current named MFA admin session authorizes server reads while legacy proofs fail', async t => {
  const denied = await adminTickets(event({}, { httpMethod: 'GET', headers: {} }));
  assert.equal(denied.statusCode, 401);
  const legacy = { origin:'https://nortivo.no', cookie: `nortivo_admin=${createAdminSession()}` };
  assert.equal((await defaultAdminTickets(event({}, {httpMethod:'GET',headers:legacy}))).statusCode,401);
  assert.equal((await defaultReply(event({id:'test-ticket-id',message:'Synthetic reply'},{headers:legacy}))).statusCode,401);
  assert.equal(globalThis.fetch.mock.calls.length, 0);
  mockFetch(t, async () => response([syntheticTicket]));
  const allowed = await adminTickets(event({}, { httpMethod: 'GET', headers: adminFixture.headers() }));
  assert.equal(allowed.statusCode, 200);
  assert.equal(data(allowed).tickets[0].id, syntheticTicket.id);
});

test('legacy shared-password login cannot issue an administrator session', async () => {
  const rejected = await adminFixture.security.login(event({ password: 'synthetic-password' }));
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.headers['Set-Cookie'], undefined);
  assert.doesNotMatch(rejected.body, /synthetic-password/);
});

test('admin replies require admin proof and support Norwegian email without schema change', async t => {
  assert.equal((await reply(event({ id: 'test-ticket-id', message: 'Synthetic response' }))).statusCode, 401);
  const mails = [];
  mockFetch(t, async (url, options = {}) => {
    if (url === 'https://api.resend.com/emails') { mails.push(JSON.parse(options.body)); return response({ id: 'synthetic-email' }); }
    if (options.method === 'POST') assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ['body', 'sender', 'ticket_id']);
    return response(options.method ? null : [syntheticTicket]);
  });
  const request = event({ id: 'test-ticket-id', message: 'Et syntetisk svar.', language: 'nb' });
  request.headers = {...request.headers,...adminFixture.headers()};
  const result = await reply(request);
  assert.equal(result.statusCode, 200);
  assert.match(mails[0].text, /Saksnummer:/);
});
