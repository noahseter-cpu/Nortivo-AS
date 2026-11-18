import { createHash, createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { createSupabaseStore } from '../terminal/store.mjs';
import { verifyPassword } from '../terminal/auth.mjs';
import { isReviewHost, isActiveWorkspaceSession } from '../terminal/security.mjs';
import { verifiedMfaTime } from './mfa-proof.mjs';
import {isKorvntHostname} from '../routing/application-routes.mjs';
import { consumeMfa } from '../product/mfa.mjs';
import { isOwnerAccount } from '../product/owner.mjs';
import { SecurityCoreError, createSessionVerifier, randomSessionToken, sessionCookie, clearSessionCookie, authorize, createRateLimiter, createAuditLogger, securityHeaders, readJson, validateObject } from '../../services/security-core/src/index.mjs';

export const ADMIN_COOKIE = '__Host-nortivo_admin_core';
const SESSION_MS = 8 * 60 * 60 * 1000;
const MFA_MS = 5 * 60 * 1000;
const allowedCodes = new Set(['AUTH_REQUIRED', 'AUTH_UNAVAILABLE', 'FORBIDDEN', 'MFA_REQUIRED', 'INVALID_ORIGIN', 'CSRF_FAILED', 'METHOD_NOT_ALLOWED', 'INVALID_BODY', 'BODY_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'RATE_LIMITED', 'RATE_LIMIT_UNAVAILABLE', 'AUDIT_UNAVAILABLE', 'UNAVAILABLE']);
const header = (event, name) => Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] || '';
const hash = value => createHash('sha256').update(value).digest('hex');

export function adminJson(statusCode, body, extra = {}) {
  return { statusCode, headers: { ...securityHeaders({ https: true }), 'Content-Type': 'application/json; charset=utf-8', ...extra }, body: JSON.stringify(body) };
}

export function adminError(error, extra = {}) {
  const known = error instanceof SecurityCoreError && allowedCodes.has(error.code);
  const code = known ? error.code : 'UNAVAILABLE';
  const status = known ? error.status : 503;
  const message = status === 401 ? 'Sign in with your named administrator account and security code.' : code === 'MFA_REQUIRED' ? 'Sign in again with a current security code.' : status === 403 ? 'The request is not permitted.' : status === 429 ? 'Too many attempts. Try again later.' : status >= 500 ? 'Administration is temporarily unavailable.' : 'The request could not be accepted.';
  return adminJson(status, { error: message, code }, { ...(status === 429 ? { 'Retry-After': String(Math.min(86400, Math.max(1, Math.ceil(error.retryAfter || 1)))) } : {}), ...extra });
}

function roots(env) {
  const secret = env.SECURITY_CORE_ADMIN_KEY || env.ADMIN_SESSION_SECRET;
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new SecurityCoreError(503, 'AUTH_UNAVAILABLE');
  const derive = purpose => Buffer.from(hkdfSync('sha256', secret, 'nortivo-security-core:admin:v1', purpose, 32));
  return { csrf: derive('csrf'), rate: derive('rate'), audit: derive('audit') };
}

function requestFor(event, env, mutation) {
  let url;
  try { url = new URL(event.rawUrl); } catch { throw new SecurityCoreError(403, 'INVALID_ORIGIN'); }
  const values = ['https://nortivo.no', 'https://www.nortivo.no', 'https://invest.nortivo.no', env.URL, env.DEPLOY_PRIME_URL, env.DEPLOY_URL].filter(Boolean);
  const local = env.NETLIFY_DEV === 'true' && env.NETLIFY !== 'true' && env.CONTEXT !== 'production';
  const permitted = new Set(values.map(value => { try { const item = new URL(value); return !item.username && !item.password && item.protocol === 'https:' ? item.origin : ''; } catch { return ''; } }).filter(Boolean));
  if (local && isReviewHost(url.hostname) && url.protocol === 'http:' && (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || values.includes(url.origin))) permitted.add(url.origin);
  if (url.username || url.password || isKorvntHostname(url.hostname) || !permitted.has(url.origin) || header(event, 'sec-fetch-site') === 'cross-site') throw new SecurityCoreError(403, 'INVALID_ORIGIN');
  const origin = header(event, 'origin');
  if ((mutation && origin !== url.origin) || (origin && origin !== url.origin)) throw new SecurityCoreError(403, 'INVALID_ORIGIN');
  const method = event.httpMethod || 'GET';
  if (event.isBase64Encoded || (event.body && (typeof event.body !== 'string' || Buffer.byteLength(event.body) > 24000))) throw new SecurityCoreError(413, 'BODY_TOO_LARGE');
  return new Request(url, { method, headers: event.headers, ...(!['GET', 'HEAD'].includes(method) ? { body: event.body || '' } : {}) });
}

function requireCookieCandidate(request) {
  const cookie = request.headers.get('cookie') || '';
  const candidates = cookie.split(';').map(part => part.trim()).filter(part => part.split('=')[0]?.trim() === ADMIN_COOKIE);
  const raw = candidates[0]?.slice(candidates[0].indexOf('=') + 1) || '';
  if (cookie.length > 8192 || candidates.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(raw) || Buffer.from(raw, 'base64url').toString('base64url') !== raw) throw new SecurityCoreError(401, 'AUTH_REQUIRED');
}

const namedAdminIds = env => new Set((env.PRODUCT_ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean));

export async function lookupAdminSession(db, env, sessionHash, time) {
  if (!/^[a-f0-9]{64}$/.test(sessionHash) || !Number.isSafeInteger(time)) return null;
  const user = await db.getSession(sessionHash, time);
  if (!isActiveWorkspaceSession(user, time) || user.kind !== 'user' || user.session_expires_at - user.session_created_at > SESSION_MS) return null;
  const [account, mfa, proof] = await Promise.all([
    db.product.get('accounts', user.id), db.product.get('mfa', user.id), db.product.get('mfa_sessions', sessionHash),
  ]);
  if (account?.ownerId !== user.id || account.value.emailVerified !== true || account.value.disabled
    || (!namedAdminIds(env).has(user.id) && !isOwnerAccount(account.value)) || mfa?.ownerId !== user.id || mfa.value.enabled !== true) return null;
  return { subjectId:user.id, roles:['admin'], createdAt:user.session_created_at, expiresAt:user.session_expires_at,
    mfaVerifiedAt:verifiedMfaTime(proof, mfa, user.id, time, ['admin'], MFA_MS) };
}

export function createAdminSecurity({ store: suppliedStore, env = process.env, now = Date.now, auditSink = line => console.info(line) } = {}) {
  let store = suppliedStore;
  const getStore = () => store ||= createSupabaseStore(env);

  function components() {
    const db = getStore(), keys = roots(env);
    const developmentStore = suppliedStore && db.kind === 'local-sqlite';
    const rate = createRateLimiter({ store: { durable: db.kind === 'supabase', consumeRateLimit: db.consumeRateLimit.bind(db) }, key: keys.rate, now, production: !developmentStore });
    const audit = createAuditLogger({ sink: auditSink, key: keys.audit, now });
    const verifier = createSessionVerifier({ cookieName: ADMIN_COOKIE, now, maxSessionMs: SESSION_MS,
      lookupSession: (sessionHash, time) => lookupAdminSession(db, env, sessionHash, time) });
    const csrf = principal => createHmac('sha256', keys.csrf).update(`nortivo-security-core:admin-csrf:v1:${principal.sessionHash}`).digest('base64url');
    return { db, rate, audit, verifier, csrf };
  }
  async function eventAudit(c, event, routeId, principal, error) {
    const status = error instanceof SecurityCoreError ? error.status : error ? 503 : 200;
    const reason = error && allowedCodes.has(error.code) ? error.code : error ? 'UNAVAILABLE' : 'AUTHORIZED';
    await c.audit({ event: error ? status >= 500 ? 'dependency_unavailable' : 'request_denied' : 'request_allowed', decision: error ? 'deny' : 'allow', routeId, status, reason, requestId: randomUUID(), ...(principal ? { subjectId: principal.id } : {}), clientId: String(header(event, 'x-nf-client-connection-ip') || 'unknown').slice(0, 80) });
  }
  async function verifyAdmin(event, { routeId = 'admin-access', mutation = !['GET', 'HEAD'].includes(event.httpMethod) } = {}, logoutOnly = false) {
    let c, principal;
    try {
      const request = requestFor(event, env, mutation);
      requireCookieCandidate(request);
      c = components();
      await c.rate({ scope: 'admin-request', identifier: String(header(event, 'x-nf-client-connection-ip') || 'unknown').slice(0, 80), limit: 120, windowMs: 60000 });
      principal = await c.verifier(request);
      if (!logoutOnly) authorize(principal, { roles: ['admin'], mfaMaxAgeMs: MFA_MS }, now());
      else if (!principal.roles.includes('admin')) throw new SecurityCoreError(403, 'FORBIDDEN');
      await c.rate({ scope: 'admin-account-request', identifier: principal.id, limit: 240, windowMs: 60000 });
      if (mutation) {
        const actual = header(event, 'x-csrf-token'), expected = c.csrf(principal);
        if (!/^[A-Za-z0-9_-]{43}$/.test(actual) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new SecurityCoreError(403, 'CSRF_FAILED');
      }
      await eventAudit(c, event, routeId, principal);
      return principal;
    } catch (error) {
      const safe = error instanceof SecurityCoreError ? error : new SecurityCoreError(503, 'AUTH_UNAVAILABLE');
      if (c) await eventAudit(c, event, routeId, principal, safe);
      throw safe;
    }
  }
  const requireAdmin = (event, options) => verifyAdmin(event, options);
  async function login(event) {
    let c;
    try {
      if (event.httpMethod !== 'POST') throw new SecurityCoreError(405, 'METHOD_NOT_ALLOWED');
      const request = requestFor(event, env, true);
      c = components();
      const ip = String(header(event, 'x-nf-client-connection-ip') || 'unknown').slice(0, 80);
      await c.rate({ scope: 'admin-login-ip', identifier: ip, limit: 10, windowMs: 900000 });
      const body = validateObject(await readJson(request, { maxBytes: 4000 }), { email: { type: 'string', required: true, maxLength: 160 }, password: { type: 'string', required: true, minLength: 12, maxLength: 256 }, code: { type: 'string', maxLength: 6 }, recoveryCode: { type: 'string', maxLength: 80 }, language: { type: 'string', maxLength: 2 } });
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (body.code && body.recoveryCode)) throw new SecurityCoreError(400, 'INVALID_BODY');
      await c.rate({ scope: 'admin-login-account', identifier: email, limit: 30, windowMs: 900000 });
      const user = await c.db.findUserByEmail(email);
      const passwordValid = await verifyPassword(body.password, user?.password_hash);
      if (!passwordValid || !user || user.disabled || user.kind !== 'user' || typeof user.id !== 'string' || typeof user.email !== 'string' || user.email.toLowerCase() !== email || (user.expires_at != null && (!Number.isSafeInteger(Number(user.expires_at)) || Number(user.expires_at) <= now()))) throw new SecurityCoreError(401, 'AUTH_REQUIRED');
      const account = await c.db.product.get('accounts', user.id), mfa = await c.db.product.get('mfa', user.id);
      if (account?.ownerId !== user.id || account.value.emailVerified !== true || account.value.disabled || (!namedAdminIds(env).has(user.id) && !isOwnerAccount(account.value))) throw new SecurityCoreError(401, 'AUTH_REQUIRED');
      if (mfa?.ownerId !== user.id || mfa.value.enabled !== true) throw new SecurityCoreError(403, 'MFA_REQUIRED');
      const raw = randomSessionToken(), sessionHash = hash(raw), time = now();
      try { await consumeMfa({ store: c.db.product, user, env, now: time, sessionHash }, body, { scope: 'admin' }); }
      catch (error) { if (error?.status >= 400 && error.status < 500) throw new SecurityCoreError(403, 'MFA_REQUIRED'); throw error; }
      const principal = { id: user.id, roles: ['admin'], sessionHash, mfaVerifiedAt: time };
      await eventAudit(c, event, 'admin-login', principal);
      const session = { token_hash: sessionHash, user_id: user.id, created_at: time, expires_at: time + SESSION_MS };
      if (c.db.productCreateSession) await c.db.productCreateSession(session); else await c.db.createSession(session);
      return adminJson(200, { ok: true, csrfToken: c.csrf(principal), admin: { id: user.id } }, { 'Set-Cookie': sessionCookie(raw, { cookieName: ADMIN_COOKIE, maxAgeSeconds: SESSION_MS / 1000 }) });
    } catch (error) {
      let safe = error instanceof SecurityCoreError ? error : new SecurityCoreError(503, 'AUTH_UNAVAILABLE');
      if (c) { try { await eventAudit(c, event, 'admin-login', null, safe); } catch { safe = new SecurityCoreError(503, 'AUDIT_UNAVAILABLE'); } }
      return adminError(safe, safe.status === 405 ? { Allow: 'POST' } : {});
    }
  }
  async function logout(event) {
    try {
      if (event.httpMethod !== 'POST') throw new SecurityCoreError(405, 'METHOD_NOT_ALLOWED');
      const principal = await verifyAdmin(event, { routeId: 'admin-logout', mutation: true }, true);
      await getStore().deleteSession(principal.sessionHash);
      return adminJson(200, { ok: true }, { 'Set-Cookie': clearSessionCookie({ cookieName: ADMIN_COOKIE }) });
    } catch (error) { return adminError(error, error?.status === 405 ? { Allow: 'POST' } : {}); }
  }
  async function session(event) {
    try {
      if (event.httpMethod !== 'GET') throw new SecurityCoreError(405, 'METHOD_NOT_ALLOWED');
      const principal = await requireAdmin(event, { routeId: 'admin-session', mutation: false });
      return adminJson(200, { ok: true, csrfToken: components().csrf(principal), admin: { id: principal.id } });
    } catch (error) { return adminError(error, error?.status === 405 ? { Allow: 'GET' } : {}); }
  }
  return Object.freeze({ login, logout, session, requireAdmin });
}

export const adminSecurity = createAdminSecurity();
export const requireAdmin = (event, options) => adminSecurity.requireAdmin(event, options);
