import { SecurityCoreError } from './errors.mjs';
import { bounded } from './bounded.mjs';

const invalid = () => { throw new SecurityCoreError(400, 'INVALID_BODY'); };
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
function checkTree(value, depth = 0) {
  if (depth > 12) invalid();
  if (value && typeof value === 'object') {
    if (Object.keys(value).length > 100) invalid();
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) invalid();
      checkTree(item, depth + 1);
    }
  }
}

export async function readJson(request, { maxBytes = 24_000, timeoutMs = 5000 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_000_000) throw new TypeError('Invalid body limit.');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get('content-type') || '')) {
    throw new SecurityCoreError(415, 'UNSUPPORTED_MEDIA_TYPE');
  }
  if (request.headers.has('content-encoding')) throw new SecurityCoreError(415, 'UNSUPPORTED_MEDIA_TYPE');
  const advertised = request.headers.get('content-length');
  if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > maxBytes)) {
    throw new SecurityCoreError(413, 'BODY_TOO_LARGE');
  }
  const reader = request.body?.getReader();
  if (!reader) invalid();
  const chunks = [];
  let size = 0;
  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      const part = await bounded(() => reader.read(), Math.max(1, deadline - Date.now()));
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        reader.cancel().catch(() => {});
        throw new SecurityCoreError(413, 'BODY_TOO_LARGE');
      }
      chunks.push(part.value);
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') invalid();
    checkTree(value);
    return value;
  } catch (error) {
    if (error instanceof SecurityCoreError) throw error;
    invalid();
  } finally { reader.cancel().catch(() => {}); reader.releaseLock(); }
}

// Small explicit flat schemas for application commands, not a general JSON Schema implementation.
export function validateObject(value, schema) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || !schema || typeof schema !== 'object') invalid();
  checkTree(value);
  if (Object.keys(value).some(key => !Object.hasOwn(schema, key))) invalid();
  const result = Object.create(null);
  for (const [key, rule] of Object.entries(schema)) {
    if (forbiddenKeys.has(key)) throw new TypeError('Invalid schema field.');
    const item = value[key];
    if (!Object.hasOwn(value, key)) { if (rule.required) invalid(); else continue; }
    if (typeof item !== rule.type || item === null) invalid();
    if (rule.type === 'string') {
      if (item.length < (rule.minLength ?? 0) || item.length > (rule.maxLength ?? 1000) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item)) invalid();
      if (rule.pattern) { rule.pattern.lastIndex = 0; if (!rule.pattern.test(item)) invalid(); }
    } else if (rule.type === 'number') {
      if (!Number.isFinite(item) || (rule.integer && !Number.isSafeInteger(item)) || item < (rule.minimum ?? -Infinity) || item > (rule.maximum ?? Infinity)) invalid();
    } else if (rule.type !== 'boolean') throw new TypeError('Use a flat string, number or boolean schema.');
    if (rule.enum && !rule.enum.includes(item)) invalid();
    result[key] = item;
  }
  return Object.freeze(result);
}
