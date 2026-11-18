import { openRuntimeValue } from './runtime-envelope.mjs';

// Hosting environment values take precedence. A partial explicit pair is never
// mixed with the older sealed pair during credential rotation.
export function loadOwnerMarketEnvironment(env = {}, envelope) {
  if (env.PRODUCT_OWNER_MARKET_PROVIDER === 'disabled') return env;
  const overlay = values => new Proxy({}, {
    get(_target, key) {
      if (key === 'PRODUCT_OWNER_MARKET_PROVIDER') return env[key] || 'nortivo';
      if (key === 'APCA_API_KEY_ID' || key === 'APCA_API_SECRET_KEY') return env.APCA_API_KEY_ID || env.APCA_API_SECRET_KEY ? env[key] || '' : values[key];
      return Reflect.get(env, key);
    },
    has(_target, key) { return key in env || key in values || key === 'PRODUCT_OWNER_MARKET_PROVIDER'; },
    ownKeys() { return [...new Set([...Reflect.ownKeys(env), ...Reflect.ownKeys(values), 'PRODUCT_OWNER_MARKET_PROVIDER'])]; },
    getOwnPropertyDescriptor(_target, key) {
      if (!(key in env) && !(key in values) && key !== 'PRODUCT_OWNER_MARKET_PROVIDER') return undefined;
      return { configurable: true, enumerable: true, writable: true, value: this.get(_target, key) };
    },
    set(_target, key, value) { return Reflect.set(env, key, value); },
  });
  if (env.APCA_API_KEY_ID || env.APCA_API_SECRET_KEY) return overlay({ APCA_API_KEY_ID: '', APCA_API_SECRET_KEY: '' });
  if (!env.PRODUCT_ENCRYPTION_KEY) return env;
  try {
    // Production uses protected hosting configuration only. The optional second
    // argument exists for explicit in-process injection/tests, never an import
    // of credential-derived bytes from the source repository.
    const raw = envelope === undefined ? env.PRODUCT_OWNER_MARKET_ENVELOPE : envelope;
    if (!raw || envelope === undefined && typeof raw !== 'string' || typeof raw === 'string' && Buffer.byteLength(raw) > 65536) return env;
    const selected = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const value = openRuntimeValue(selected, env, 'owner-market-v1');
    if (!value || Object.keys(value).some(key => !['keyId', 'secretKey'].includes(key))
      || ![value.keyId, value.secretKey].every(key => typeof key === 'string' && key.length >= 12 && key.length <= 256 && !/[\s\u0000-\u001f\u007f]/.test(key))) return env;
    return overlay({ APCA_API_KEY_ID: value.keyId, APCA_API_SECRET_KEY: value.secretKey });
  } catch { return env; }
}
