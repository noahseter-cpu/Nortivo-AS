import crypto from 'node:crypto';
import { fail } from '../terminal/security.mjs';

const PURPOSES = new Set(['owner-market-v1', 'owner-bootstrap-v1']);
const FIELDS = new Set(['version', 'purpose', 'salt', 'iv', 'ciphertext', 'tag']);
const MAX_BYTES = 32768;
const invalid = () => fail('RUNTIME_CONFIGURATION_INVALID', 'The protected runtime configuration could not be opened.', 503);

function masterKey(env) {
  const raw = env?.PRODUCT_ENCRYPTION_KEY;
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{43}=?$/.test(raw)) invalid();
  const key = Buffer.from(raw, 'base64url');
  if (key.length !== 32 || key.toString('base64url') !== raw.replace(/=$/, '')) invalid();
  return key;
}

function decode(value, length, max = length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > Math.ceil(max * 4 / 3) + 2) invalid();
  const data = Buffer.from(value, 'base64url');
  if (data.length < length || data.length > max || data.toString('base64url') !== value) invalid();
  return data;
}

function derivedKey(env, purpose, salt) {
  if (!PURPOSES.has(purpose)) invalid();
  return Buffer.from(crypto.hkdfSync('sha256', masterKey(env), salt, Buffer.from(`nortivo:runtime-envelope:${purpose}:v1`), 32));
}

const associatedData = purpose => Buffer.from(`nortivo:runtime-envelope:v1:${purpose}`);

/** Encrypt only operator-prepared server configuration, never client-controlled authority. */
export function sealRuntimeValue(value, env, purpose) {
  if (!PURPOSES.has(purpose) || !value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  if (!plaintext.length || plaintext.length > MAX_BYTES) invalid();
  const salt = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey(env, purpose, salt), iv);
  cipher.setAAD(associatedData(purpose));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { version: 1, purpose, salt: salt.toString('base64url'), iv: iv.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
}

/** Fail closed on malformed, wrong-purpose, wrong-master, or unauthenticated data. */
export function openRuntimeValue(envelope, env, purpose) {
  try {
    if (!PURPOSES.has(purpose) || !envelope || typeof envelope !== 'object' || Array.isArray(envelope)
      || Object.keys(envelope).some(key => !FIELDS.has(key)) || envelope.version !== 1 || envelope.purpose !== purpose) invalid();
    const salt = decode(envelope.salt, 32), iv = decode(envelope.iv, 12), tag = decode(envelope.tag, 16);
    const ciphertext = decode(envelope.ciphertext, 1, MAX_BYTES);
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey(env, purpose, salt), iv);
    decipher.setAAD(associatedData(purpose)); decipher.setAuthTag(tag);
    const value = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    return value;
  } catch { invalid(); }
}
