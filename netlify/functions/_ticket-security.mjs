import crypto from 'node:crypto';

export const LINK_TTL = 15 * 60 * 1000;
export const SESSION_TTL = 30 * 60 * 1000;
export const TICKET_COOKIE = 'nortivo_ticket';
const buckets = new Map();
const MAX_BUCKETS = 5000;
const PURPOSES = new Set(['email-proof', 'ticket-session']);

export function header(event, name) {
  const entry = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return typeof entry?.[1] === 'string' ? entry[1] : '';
}

function configuredOrigin(value) {
  try {
    const url = new URL(value);
    const local = process.env.NETLIFY_DEV === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return '';
    return url.origin;
  } catch { return ''; }
}

function allowedOrigins() {
  const configured = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL]
    .map(configuredOrigin).filter(Boolean);
  if (process.env.NETLIFY_DEV === 'true') configured.push('http://localhost:8888', 'http://127.0.0.1:8888');
  return new Set(configured.length ? configured : ['https://nortivo.no', 'https://www.nortivo.no']);
}

export function siteOrigin(event = {}) {
  const allowed = allowedOrigins();
  // rawUrl is supplied by Netlify; it still has to match a configured deployment.
  const requestOrigin = configuredOrigin(event.rawUrl);
  if (requestOrigin && allowed.has(requestOrigin)) return requestOrigin;
  const preferred = process.env.CONTEXT === 'production' ? process.env.URL : process.env.DEPLOY_PRIME_URL || process.env.URL;
  return configuredOrigin(preferred) || [...allowed][0];
}

export function sameOrigin(event, { required = false } = {}) {
  if (header(event, 'sec-fetch-site') === 'cross-site') return false;
  if (event.rawUrl && !allowedOrigins().has(configuredOrigin(event.rawUrl))) return false;
  const origin = header(event, 'origin');
  const referer = header(event, 'referer');
  const source = origin || referer;
  if (!source) return !required;
  const normalized = configuredOrigin(source);
  if (!normalized || !allowedOrigins().has(normalized)) return false;
  return normalized === siteOrigin(event);
}

export function clientIp(event) {
  // Netlify sets this header. Never trust the user-controlled X-Forwarded-For chain.
  return header(event, 'x-nf-client-connection-ip').slice(0, 80) || 'unknown';
}

export function consumeRateLimit(namespace, identifier, limit, windowMs, now = Date.now()) {
  for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  const key = `${namespace}:${crypto.createHash('sha256').update(String(identifier)).digest('hex')}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) return false;
    bucket = { count: 0, until: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function rateLimit(event, namespace, { email, ipLimit = 20, emailLimit = 3, windowMs = LINK_TTL } = {}) {
  const ipAllowed = consumeRateLimit(`${namespace}:ip`, clientIp(event), ipLimit, windowMs);
  // A blocked IP must not allocate arbitrary new email buckets and exhaust capacity.
  if (!ipAllowed) return false;
  const emailAllowed = !email || consumeRateLimit(`${namespace}:email`, email.toLowerCase(), emailLimit, windowMs);
  return emailAllowed;
}

export function normalizeTicket(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validTicket(value) {
  return /^NT-\d{4}-[A-Z0-9]{6}$/.test(value);
}

function key(purpose, use) {
  if (!PURPOSES.has(purpose)) throw new Error('Unsupported token purpose.');
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('Support access is not configured.');
  return crypto.createHmac('sha256', secret).update(`nortivo:ticket-access:v1:${purpose}:${use}`).digest();
}

export function signaturesEqual(received, expected) {
  if (typeof received !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(received)) return false;
  const a = Buffer.from(received, 'base64url');
  const b = Buffer.from(expected, 'base64url');
  return a.toString('base64url') === received && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function issueToken(purpose, { ticketNumber, email }, now = Date.now()) {
  const ttl = purpose === 'email-proof' ? LINK_TTL : SESSION_TTL;
  const payload = JSON.stringify({ purpose, ticketNumber, email, iat: now, exp: now + ttl });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(purpose, 'encryption'), iv);
  cipher.setAAD(Buffer.from(`nortivo:${purpose}:v1`));
  const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const encoded = ['v1', iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
  const signature = crypto.createHmac('sha256', key(purpose, 'signature')).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function readToken(token, purpose, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 1800) return null;
    const parts = token.split('.');
    if (parts.length !== 5 || parts[0] !== 'v1' || parts.slice(1).some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
    const encoded = parts.slice(0, 4).join('.');
    const expected = crypto.createHmac('sha256', key(purpose, 'signature')).update(encoded).digest('base64url');
    if (!signaturesEqual(parts[4], expected)) return null;
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(purpose, 'encryption'), iv);
    decipher.setAAD(Buffer.from(`nortivo:${purpose}:v1`));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()]).toString('utf8');
    const claims = JSON.parse(plaintext);
    const ttl = purpose === 'email-proof' ? LINK_TTL : SESSION_TTL;
    if (claims.purpose !== purpose || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)
      || claims.iat > now || claims.exp <= now || claims.exp - claims.iat !== ttl
      || !validTicket(claims.ticketNumber) || typeof claims.email !== 'string'
      || claims.email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)
      || normalizeEmail(claims.email) !== claims.email) return null;
    return claims;
  } catch { return null; }
}

export function ticketSession(event) {
  try {
    const item = header(event, 'cookie').split(';').map(value => value.trim()).find(value => value.startsWith(`${TICKET_COOKIE}=`));
    return item ? readToken(decodeURIComponent(item.slice(TICKET_COOKIE.length + 1)), 'ticket-session') : null;
  } catch { return null; }
}

export function ticketCookie(claims) {
  return `${TICKET_COOKIE}=${encodeURIComponent(issueToken('ticket-session', claims))}; Path=/.netlify/functions/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}`;
}
