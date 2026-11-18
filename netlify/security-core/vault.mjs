import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const PURPOSE = /^[a-z][a-z0-9_.:-]{0,63}$/;
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/;
const ENVELOPE_FIELDS = Object.freeze(['version', 'algorithm', 'keyId', 'iv', 'tag', 'ciphertext']);
const CONTEXT_FIELDS = Object.freeze(['purpose', 'ownerId', 'recordId']);
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// No raw values, provider errors, crypto diagnostics or key identifiers are included.
export class DataProtectionError extends Error {
  constructor() {
    super('Protected data is unavailable.');
    this.name = 'DataProtectionError';
    this.code = 'DATA_PROTECTION_UNAVAILABLE';
    this.status = 503;
  }
}
const unavailable = () => new DataProtectionError();
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function exactFields(value, fields) {
  if (!isPlainObject(value)) throw unavailable();
  const keys = Object.keys(value);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) throw unavailable();
}

function decodeCanonical(value, { bytes, maxBytes = bytes } = {}) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 4 * Math.ceil(maxBytes / 3)
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw unavailable();
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value || (bytes !== undefined && decoded.length !== bytes)
    || decoded.length > maxBytes) throw unavailable();
  return decoded;
}

function checkJson(value, depth = 0, active = new Set()) {
  if (depth > 16) throw unavailable();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw unavailable(); return; }
  if (typeof value !== 'object' || active.has(value) || (!Array.isArray(value) && !isPlainObject(value))) throw unavailable();
  if (Object.keys(value).length > 1000) throw unavailable();
  active.add(value);
  try {
    // Require data properties. Getters and toJSON methods are not part of this JSON contract.
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (Array.isArray(value) && key === 'length') continue;
      if (DANGEROUS_KEYS.has(key) || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) throw unavailable();
      checkJson(descriptor.value, depth + 1, active);
    }
    if (Object.getOwnPropertySymbols(value).length) throw unavailable();
  } finally { active.delete(value); }
}

function contextBytes(context, keyId) {
  exactFields(context, CONTEXT_FIELDS);
  if (!PURPOSE.test(context.purpose) || typeof context.purpose !== 'string'
    || typeof context.ownerId !== 'string' || !RECORD_ID.test(context.ownerId)
    || typeof context.recordId !== 'string' || !RECORD_ID.test(context.recordId)) throw unavailable();
  // JSON-array encoding avoids separator collisions between purpose, owner and record values.
  return Buffer.from(JSON.stringify(['nortivo-security-core:data', VERSION, ALGORITHM, keyId,
    context.purpose, context.ownerId, context.recordId]), 'utf8');
}

/**
 * Application-data encryption utility. Keys are canonical standard-base64 encodings
 * of exactly 32 random bytes. The ring stays server-side; envelope keyId is public
 * rotation metadata. Existing broker/MFA formats are intentionally not handled here.
 */
export function createDataVault({ keys, currentKeyId, maxPlaintextBytes = 64_000 } = {}) {
  try {
    if (!isPlainObject(keys) || !KEY_ID.test(currentKeyId) || typeof currentKeyId !== 'string'
      || !Object.hasOwn(keys, currentKeyId) || Object.keys(keys).length < 1 || Object.keys(keys).length > 16
      || !Number.isSafeInteger(maxPlaintextBytes) || maxPlaintextBytes < 1 || maxPlaintextBytes > 1_000_000) throw unavailable();
    const ring = new Map();
    for (const [id, encoded] of Object.entries(keys)) {
      if (!KEY_ID.test(id) || typeof encoded !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw unavailable();
      ring.set(id, decodeCanonical(encoded, { bytes: 32 }));
    }

    function seal(value, context) {
      try {
        const aad = contextBytes(context, currentKeyId);
        checkJson(value);
        const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
        if (!plaintext.length || plaintext.length > maxPlaintextBytes) throw unavailable();
        const iv = randomBytes(12);
        const cipher = createCipheriv(ALGORITHM, ring.get(currentKeyId), iv, { authTagLength: 16 });
        cipher.setAAD(aad);
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        return Object.freeze({ version: VERSION, algorithm: ALGORITHM, keyId: currentKeyId,
          iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
      } catch { throw unavailable(); }
    }

    function open(envelope, context) {
      try {
        exactFields(envelope, ENVELOPE_FIELDS);
        if (envelope.version !== VERSION || envelope.algorithm !== ALGORITHM
          || typeof envelope.keyId !== 'string' || !KEY_ID.test(envelope.keyId) || !ring.has(envelope.keyId)) throw unavailable();
        const aad = contextBytes(context, envelope.keyId);
        const iv = decodeCanonical(envelope.iv, { bytes: 12 });
        const tag = decodeCanonical(envelope.tag, { bytes: 16 });
        const ciphertext = decodeCanonical(envelope.ciphertext, { maxBytes: maxPlaintextBytes });
        const decipher = createDecipheriv(ALGORITHM, ring.get(envelope.keyId), iv, { authTagLength: 16 });
        decipher.setAAD(aad);
        decipher.setAuthTag(tag);
        // No plaintext is parsed or returned until final() verifies the authentication tag.
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
        checkJson(value);
        return value;
      } catch { throw unavailable(); }
    }

    // The caller must persist this new envelope using its normal owner/version checks.
    const reseal = (envelope, context) => seal(open(envelope, context), context);
    return Object.freeze({ seal, open, reseal });
  } catch { throw unavailable(); }
}
