import crypto from 'node:crypto';
import {isKorvntHostname} from '../routing/application-routes.mjs';
import { verifiedMfaTime } from '../security-core/mfa-proof.mjs';
import { isOwnerAccount } from '../product/owner.mjs';
import { createSessionVerifier } from '../../services/security-core/src/sessions.mjs';
import { createRateLimiter } from '../../services/security-core/src/rate-limit.mjs';
import { authorize } from '../../services/security-core/src/policy.mjs';
import { securityHeaders } from '../../services/security-core/src/headers.mjs';
import { SecurityCoreError } from '../../services/security-core/src/errors.mjs';

export const COOKIE = 'nortivo_terminal';
export const BODY_LIMIT = 24_000;
export const GUEST_TTL = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const GUEST_SESSION_TTL = 24 * 60 * 60 * 1000;
export const PRODUCTION_ORIGINS = Object.freeze(['https://nortivo.no', 'https://www.nortivo.no', 'https://invest.nortivo.no']);

export class TerminalError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export const fail = (code, message, status) => { throw new TerminalError(code, message, status); };
export const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
export const token = () => crypto.randomBytes(32).toString('base64url');
export const header = (event, name) => { const value = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]; return typeof value === 'string' ? value : ''; };
export const isLocalRuntime = env => env.TERMINAL_LOCAL === 'true' && env.NETLIFY !== 'true' && env.CONTEXT !== 'production';
export const COMMAND_QUOTAS = Object.freeze({guest:2000,user:10000});
export const terminalCapabilities = env => ({signupEnabled:isLocalRuntime(env) || env.TERMINAL_ALLOW_SIGNUP === 'true',guestEnabled:true,emailVerification:false,passwordRecovery:false});

export function sessionSecret(env) {
  const value = env.TERMINAL_SESSION_SECRET;
  if (typeof value !== 'string' || Buffer.byteLength(value) < 32) fail('SERVER_NOT_CONFIGURED', 'Trading workspace security is not configured.', 503);
  return value;
}
export const csrfToken = (rawToken, secret) => crypto.createHmac('sha256', secret).update(`terminal-csrf:v1:${rawToken}`).digest('base64url');
export function equalToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length > 256) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
export function cookieToken(event) {
  const cookies = header(event, 'cookie');
  if (cookies.length > 8192) return '';
  const values = cookies.split(';').map(value => value.trim()).filter(value => value.slice(0, value.indexOf('=')).trim() === COOKIE);
  if (values.length !== 1) return '';
  const value = values[0].slice(values[0].indexOf('=') + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value, 'base64url').toString('base64url') === value ? value : '';
}
export function cookie(rawToken, ttl, local = false) {
  return `${COOKIE}=${rawToken}; Path=/.netlify/functions/terminal; HttpOnly; ${local ? '' : 'Secure; '}SameSite=Strict; Max-Age=${Math.max(0, Math.floor(ttl / 1000))}`;
}

export const isReviewHost = host => ['127.0.0.1', 'localhost', '[::1]', 'invest.localhost', 'nortivo.localhost'].includes(host);

export function requestOrigin(event, env) {
  // Both production hosts share the existing backend during the migration.
  // Browser sessions remain host-only; approving an origin never grants CORS.
  const configured = [...PRODUCTION_ORIGINS, env.TERMINAL_ORIGIN, env.URL, env.DEPLOY_PRIME_URL, env.DEPLOY_URL].filter(Boolean);
  const allowed = new Set(configured.map(value => {
    try {
      const url = new URL(value);
      const loopback = isLocalRuntime(env) && isReviewHost(url.hostname);
      return !url.username && !url.password && (url.protocol === 'https:' || (loopback && url.protocol === 'http:')) ? url.origin : '';
    } catch { return ''; }
  }).filter(Boolean));
  let actual;
  try { const url = new URL(event.rawUrl); if (url.username || url.password) throw new Error(); actual = url.origin; } catch { fail('INVALID_ORIGIN', 'Request origin could not be verified.', 403); }
  if (isKorvntHostname(new URL(actual).hostname) || !allowed.has(actual)) fail('INVALID_ORIGIN', 'Request origin is not permitted.', 403);
  return actual;
}
export function requireSameOrigin(event, env, required = true) {
  const origin = requestOrigin(event, env);
  if (header(event, 'sec-fetch-site') === 'cross-site') fail('INVALID_ORIGIN', 'Cross-site requests are not permitted.', 403);
  const source = header(event, 'origin') || header(event, 'referer');
  if (!source && !required) return;
  try { const url = new URL(source); if (!url.username && !url.password && url.origin === origin) return; } catch { /* reject below */ }
  fail('INVALID_ORIGIN', 'Use this workspace from its own website.', 403);
}
export function parseBody(event, maxBytes = BODY_LIMIT) {
  if (!/^application\/json(?:\s*;|$)/i.test(header(event, 'content-type'))) fail('INVALID_BODY', 'Send a JSON request.', 415);
  if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > maxBytes) fail('INVALID_BODY', 'Request body is missing or too large.', 413);
  try {
    const value = JSON.parse(event.body);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    function inspect(item, depth = 0) {
      if (depth > 12) throw new Error();
      if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error();
        inspect(child, depth + 1);
      }
    }
    inspect(value);
    return value;
  } catch { fail('INVALID_BODY', 'Request body must be a JSON object.', 400); }
}
export function clientIdentifier(event, secret) {
  // Only the connection address supplied by Netlify/the local wrapper is trusted.
  return crypto.createHmac('sha256', secret).update(`ip:${String(header(event, 'x-nf-client-connection-ip') || 'unknown').slice(0, 80)}`).digest('hex');
}
export function commandDigest(command) {
  function canonical(value, depth = 0) {
    if (depth > 12) fail('INVALID_COMMAND', 'Command is too deeply nested.', 400);
    if (Array.isArray(value)) return value.map(item => canonical(item, depth + 1));
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key], depth + 1)]));
    return value;
  }
  return sha256(JSON.stringify(canonical(command)));
}
export function response(statusCode, data, extra = {}) {
  return { statusCode, headers: { ...securityHeaders(), 'Content-Type': 'application/json; charset=utf-8', ...extra }, body: JSON.stringify(data) };
}

// The existing cookie and CSRF formats remain compatible. Core validates the
// authoritative session's true issuance/expiry rather than guessing missing assurance.
export function isActiveWorkspaceSession(identity, now) {
  if (!identity || !['user', 'guest'].includes(identity.kind) || identity.disabled || identity.session_revoked_at != null) return false;
  if (identity.expires_at != null && (!Number.isSafeInteger(Number(identity.expires_at)) || Number(identity.expires_at) <= now)) return false;
  const { session_created_at: issued, session_expires_at: expiry } = identity;
  return Number.isSafeInteger(issued) && issued >= 0 && issued <= now && Number.isSafeInteger(expiry) && expiry > now
    && expiry - issued <= (identity.kind === 'guest' ? GUEST_SESSION_TTL : SESSION_TTL);
}

export async function workspaceSession(event, store, time) {
  if (!cookieToken(event)) return null;
  let identity;
  const verify = createSessionVerifier({
    cookieName: COOKIE, now: () => time, maxSessionMs: SESSION_TTL,
    lookupSession: async (hash, now) => {
      identity = await store.getSession(hash, now);
      if (!isActiveWorkspaceSession(identity, now)) return null;
      return { subjectId: identity.id, roles: [identity.kind], createdAt: identity.session_created_at, expiresAt: identity.session_expires_at };
    },
  });
  try {
    const principal = await verify({ headers: new Headers({ cookie: header(event, 'cookie') }) });
    authorize(principal, { roles: ['user', 'guest'] }, time);
    return identity;
  } catch (error) {
    if (error instanceof SecurityCoreError && error.status === 401) return null;
    fail('STORAGE_UNAVAILABLE', 'Account security is temporarily unavailable.', 503);
  }
}

export function authorizeWorkspaceRecord(identity, ownerId, time) {
  if (typeof ownerId !== 'string' || !ownerId) fail('RECORD_OWNER', 'Account ownership could not be verified.', 403);
  try { return authorize({ id: identity?.id, roles: identity && ['user', 'guest'].includes(identity.kind) ? [identity.kind] : [] }, { roles: ['user', 'guest'], ownerId }, time); }
  catch { fail('RECORD_OWNER', 'Account ownership could not be verified.', 403); }
}

export async function authorizeWorkspaceAdmin(identity, env, store, sessionHash, time) {
  const account = identity?.kind === 'user' ? await store.get('accounts', identity.id) : null;
  const eligible = identity?.kind === 'user' && account?.ownerId === identity.id && account.value?.emailVerified === true && !account.value.disabled;
  const owner = eligible && isOwnerAccount(account.value);
  if (!eligible || !owner && !(env.PRODUCT_ADMIN_USER_IDS || '').split(',').map(id => id.trim()).includes(identity.id)) fail('ADMIN_REQUIRED', 'This operational view is restricted to the owner.', 403);
  const [proof, enrollment] = await Promise.all([store.get('mfa_sessions', sessionHash), store.get('mfa', identity.id)]);
  const verifiedAt = verifiedMfaTime(proof, enrollment, identity.id, time, ['security']);
  try { authorize({ id: identity.id, roles: ['admin'], mfaVerifiedAt: verifiedAt }, { roles: ['admin'] }, time); }
  catch { fail('STEP_UP_REQUIRED', 'Confirm an authenticator or recovery code before this sensitive action.', 403); }
}

export function workspaceRateLimiter(store, secret, time) {
  // Production constructs the remote Supabase store; SQLite is explicitly
  // injected only by the local preview/tests and is never a hosted fallback.
  const consume = createRateLimiter({
    store: { durable: store.kind === 'supabase', consumeRateLimit: (...args) => store.consumeRateLimit(...args) },
    production: store.kind !== 'local-sqlite',
    key: crypto.createHmac('sha256', secret).update('nortivo-security-core:workspace-rate:v1').digest(), now: () => time,
  });
  return async (scope, identifier, limit, windowMs) => {
    try { await consume({ scope, identifier: String(identifier), limit, windowMs }); }
    catch (error) {
      if (error instanceof SecurityCoreError && error.status === 429) {
        const denied = new TerminalError('RATE_LIMITED', 'Too many requests. Wait before trying again.', 429);
        denied.retryAfter = error.retryAfter; throw denied;
      }
      fail('STORAGE_UNAVAILABLE', 'Request protection is temporarily unavailable.', 503);
    }
  };
}

export function secureWorkspaceResponse(result, event) {
  let https = false;
  try { https = new URL(event.rawUrl).protocol === 'https:'; } catch { /* invalid origins still receive defensive headers */ }
  return { ...result, headers: { ...result.headers, ...securityHeaders({ https }) } };
}
