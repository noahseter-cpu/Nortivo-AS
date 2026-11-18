import { createHash, randomBytes } from 'node:crypto';
import { SecurityCoreError } from './errors.mjs';
import { bounded } from './bounded.mjs';

export const DEFAULT_COOKIE = '__Host-nortivo_security_core';
const DEFAULT_LIFETIME_MS = 8 * 60 * 60 * 1000;
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/;
const ROLE = /^[a-z][a-z0-9:_-]{0,63}$/;
const safeTime = value => Number.isSafeInteger(value) && value >= 0;
const unauthorized = () => { throw new SecurityCoreError(401, 'AUTH_REQUIRED'); };

function validateCookieName(name) {
  if (typeof name !== 'string' || name.length > 128 || !COOKIE_NAME.test(name)) {
    throw new TypeError('Invalid session cookie name.');
  }
}

function canonicalToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
    && Buffer.from(value, 'base64url').length === 32
    && Buffer.from(value, 'base64url').toString('base64url') === value;
}

export const randomSessionToken = () => randomBytes(32).toString('base64url');

/**
 * lookupSession is a trusted, server-only adapter. It receives a SHA-256 hash,
 * never the browser's raw credential. It must return current roles, revocation
 * and MFA state from authoritative storage on every request.
 */
export function createSessionVerifier({
  lookupSession,
  cookieName = DEFAULT_COOKIE,
  now = Date.now,
  maxSessionMs = DEFAULT_LIFETIME_MS,
  timeoutMs = 5000,
} = {}) {
  if (typeof lookupSession !== 'function' || typeof now !== 'function') {
    throw new TypeError('Session verification requires a trusted lookup adapter and clock.');
  }
  validateCookieName(cookieName);
  if (!Number.isSafeInteger(maxSessionMs) || maxSessionMs <= 0) {
    throw new TypeError('Invalid maximum session lifetime.');
  }

  return async function verify(request) {
    const time = now();
    if (!safeTime(time)) throw new SecurityCoreError(503, 'AUTH_UNAVAILABLE');
    const cookieHeader = request?.headers?.get?.('cookie') || '';
    if (typeof cookieHeader !== 'string' || cookieHeader.length > 8192) unauthorized();
    const matches = cookieHeader.split(';').map(part => part.trim()).filter(part => {
      const separator = part.indexOf('=');
      return separator >= 0 && part.slice(0, separator).trim() === cookieName;
    });
    // Duplicate cookies can otherwise select a different session at different layers.
    if (matches.length !== 1) unauthorized();
    const rawToken = matches[0].slice(matches[0].indexOf('=') + 1);
    if (!canonicalToken(rawToken)) unauthorized();
    const sessionHash = createHash('sha256').update(rawToken).digest('hex');
    let record;
    try {
      record = await bounded(() => lookupSession(sessionHash, time), timeoutMs);
    } catch {
      // A store outage must not become an anonymous or previously cached session.
      throw new SecurityCoreError(503, 'AUTH_UNAVAILABLE');
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)
      || typeof record.subjectId !== 'string' || !SUBJECT.test(record.subjectId)
      || !safeTime(record.createdAt) || !safeTime(record.expiresAt)
      || record.createdAt > time || record.expiresAt <= time
      || record.expiresAt <= record.createdAt
      || record.expiresAt - record.createdAt > maxSessionMs
      || record.revokedAt != null
      || !Array.isArray(record.roles) || record.roles.length > 32
      || record.roles.some(role => typeof role !== 'string' || !ROLE.test(role))
      || new Set(record.roles).size !== record.roles.length
      || (record.mfaVerifiedAt != null && !safeTime(record.mfaVerifiedAt))) unauthorized();

    return Object.freeze({
      id: record.subjectId,
      roles: Object.freeze([...record.roles]),
      mfaVerifiedAt: record.mfaVerifiedAt ?? null,
      sessionHash,
    });
  };
}

/** Production cookies are always host-only, Secure, HttpOnly and SameSite=Strict. */
export function sessionCookie(rawToken, {
  maxAgeSeconds = DEFAULT_LIFETIME_MS / 1000,
  cookieName = DEFAULT_COOKIE,
} = {}) {
  validateCookieName(cookieName);
  if (!canonicalToken(rawToken)) throw new TypeError('Invalid opaque session token.');
  if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 1 || maxAgeSeconds > 31 * 86400) {
    throw new TypeError('Invalid cookie lifetime.');
  }
  return `${cookieName}=${rawToken}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie({ cookieName = DEFAULT_COOKIE } = {}) {
  validateCookieName(cookieName);
  // Call the authoritative store's revoke operation before returning this header.
  return `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;
}
