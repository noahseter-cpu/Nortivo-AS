import crypto from 'node:crypto';

export const COOKIE = 'nortivo_terminal';
export const BODY_LIMIT = 24_000;
export const GUEST_TTL = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const GUEST_SESSION_TTL = 24 * 60 * 60 * 1000;

export class TerminalError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export const fail = (code, message, status) => { throw new TerminalError(code, message, status); };
export const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
export const token = () => crypto.randomBytes(32).toString('base64url');
export const header = (event, name) => Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] || '';
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
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function cookieToken(event) {
  const raw = header(event, 'cookie').split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`));
  const value = raw?.slice(COOKIE.length + 1) || '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
export function cookie(rawToken, ttl, local = false) {
  return `${COOKIE}=${rawToken}; Path=/.netlify/functions/terminal; HttpOnly; ${local ? '' : 'Secure; '}SameSite=Strict; Max-Age=${Math.max(0, Math.floor(ttl / 1000))}`;
}

export function requestOrigin(event, env) {
  const configured = [env.TERMINAL_ORIGIN, env.URL, env.DEPLOY_PRIME_URL, env.DEPLOY_URL].filter(Boolean);
  if (!configured.length) configured.push('https://nortivo.no', 'https://www.nortivo.no');
  const allowed = new Set(configured.map(value => {
    try {
      const url = new URL(value);
      const loopback = isLocalRuntime(env) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
      return !url.username && !url.password && (url.protocol === 'https:' || (loopback && url.protocol === 'http:')) ? url.origin : '';
    } catch { return ''; }
  }).filter(Boolean));
  let actual;
  try { actual = new URL(event.rawUrl).origin; } catch { fail('INVALID_ORIGIN', 'Request origin could not be verified.', 403); }
  if (!allowed.has(actual)) fail('INVALID_ORIGIN', 'Request origin is not permitted.', 403);
  return actual;
}
export function requireSameOrigin(event, env, required = true) {
  const origin = requestOrigin(event, env);
  if (header(event, 'sec-fetch-site') === 'cross-site') fail('INVALID_ORIGIN', 'Cross-site requests are not permitted.', 403);
  const source = header(event, 'origin') || header(event, 'referer');
  if (!source && !required) return;
  try { if (new URL(source).origin === origin) return; } catch { /* reject below */ }
  fail('INVALID_ORIGIN', 'Use this workspace from its own website.', 403);
}
export function parseBody(event) {
  if (!/^application\/json(?:\s*;|$)/i.test(header(event, 'content-type'))) fail('INVALID_BODY', 'Send a JSON request.', 415);
  if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > BODY_LIMIT) fail('INVALID_BODY', 'Request body is missing or too large.', 413);
  try {
    const value = JSON.parse(event.body);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
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
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Robots-Tag': 'noindex, nofollow', ...extra }, body: JSON.stringify(data) };
}
