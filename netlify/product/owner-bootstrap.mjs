import crypto from 'node:crypto';
import { createInitialState } from '../terminal/engine.mjs';
import { createSupabaseStore } from '../terminal/store.mjs';
import { TerminalError, fail, header, sha256, requireSameOrigin, parseBody, response } from '../terminal/security.mjs';
import { SYSTEM_OWNER, change } from './providers-core.mjs';
import { createOwnerGrant } from './owner.mjs';
import { openRuntimeValue } from './runtime-envelope.mjs';

export function loadOwnerBootstrapConfiguration(env = {}) {
  try {
    const raw = env.PRODUCT_OWNER_BOOTSTRAP_ENVELOPE;
    if (typeof raw !== 'string' || !raw || Buffer.byteLength(raw) > 65536) throw new Error();
    return openRuntimeValue(JSON.parse(raw), env, 'owner-bootstrap-v1');
  } catch {
    fail('OWNER_BOOTSTRAP_NOT_CONFIGURED', 'Owner provisioning is not configured.', 503);
  }
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^scrypt-v1\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/;
const MAX_TTL = 45 * 60000;
const configFailure = () => fail('OWNER_BOOTSTRAP_NOT_CONFIGURED', 'Owner provisioning is not configured.', 503);

function validatedConfiguration(value, now) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !UUID.test(value.id || '') || !UUID.test(value.userId || '') || value.userId === SYSTEM_OWNER
    || typeof value.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email.length > 160 || value.email !== value.email.trim().toLowerCase()
    || typeof value.name !== 'string' || value.name.length > 80 || /[\u0000-\u001f\u007f]/.test(value.name)
    || !HASH.test(value.passwordHash || '') || !/^[a-f0-9]{64}$/.test(value.tokenHash || '')
    || !Number.isSafeInteger(now) || !Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)
    || value.issuedAt <= 0 || value.expiresAt <= value.issuedAt || value.expiresAt - value.issuedAt > MAX_TTL) configFailure();
  let origin;
  try { const u = new URL(value.origin); if (u.protocol !== 'https:' || u.username || u.password || u.origin !== value.origin || u.port) throw new Error(); origin = u.origin; }
  catch { configFailure(); }
  if (value.issuedAt > now || value.expiresAt <= now) fail('OWNER_BOOTSTRAP_EXPIRED', 'This owner provisioning authorization is not active.', 403);
  return { id: value.id, userId: value.userId, email: value.email, name: value.name, passwordHash: value.passwordHash, tokenHash: value.tokenHash, issuedAt: value.issuedAt, expiresAt: value.expiresAt, origin };
}

function authenticate(event, config) {
  const token = header(event, 'x-nortivo-owner-bootstrap');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) fail('OWNER_BOOTSTRAP_UNAUTHORIZED', 'Owner provisioning authorization was not accepted.', 403);
  const actual = Buffer.from(sha256(token), 'hex'), expected = Buffer.from(config.tokenHash, 'hex');
  if (!crypto.timingSafeEqual(actual, expected)) fail('OWNER_BOOTSTRAP_UNAUTHORIZED', 'Owner provisioning authorization was not accepted.', 403);
}

function configurationDigest(config) { return sha256(JSON.stringify(config)); }
function publicReceipt(row, config, digest) {
  if (!row) return null;
  const value = row.value;
  if (row.ownerId !== SYSTEM_OWNER || value?.configurationDigest !== digest || value?.configurationId !== config.id
    || !UUID.test(value.ownerId || '') || typeof value.created !== 'boolean') fail('OWNER_BOOTSTRAP_CONFLICT', 'This provisioning authorization has already been used for another operation.', 409);
  return { ok: true, ownerId: value.ownerId, created: value.created, replayed: true };
}

/** Temporary operator-only endpoint. Its immutable configuration, token and permanent receipt authorize one grant. */
export function createOwnerBootstrapHandler({ env = process.env, store: suppliedStore, fetcher = fetch, now = Date.now, configuration } = {}) {
  let legacyStore = suppliedStore;
  return async event => {
    try {
      const method = String(event?.httpMethod || event?.method || 'GET').toUpperCase();
      if (method !== 'POST') return response(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for owner provisioning.' } }, { Allow: 'POST' });
      const time = now();
      const config = validatedConfiguration(typeof configuration === 'function' ? await configuration() : configuration, time);
      let actual;
      try { actual = new URL(event.rawUrl); } catch { fail('INVALID_ORIGIN', 'The provisioning origin could not be verified.', 403); }
      if (actual.origin !== config.origin || actual.search || actual.username || actual.password) fail('INVALID_ORIGIN', 'The provisioning origin is not permitted.', 403);
      requireSameOrigin(event, env, true);
      authenticate(event, config);
      const body = parseBody(event);
      if (Object.keys(body).length) fail('INVALID_BODY', 'Owner provisioning accepts no client-selected account settings.', 400);
      legacyStore ||= createSupabaseStore(env, fetcher);
      const store = legacyStore.product;
      if (!store || !legacyStore.productIdentity) fail('STORAGE_MIGRATION_REQUIRED', 'The product store is not ready for owner provisioning.', 503);
      const receiptKey = `owner-bootstrap:${config.id}`, digest = configurationDigest(config);

      for (let attempt = 0; attempt < 4; attempt++) {
        const previous = publicReceipt(await store.get('jobs', receiptKey), config, digest);
        if (previous) return response(200, previous);
        const found = await legacyStore.findUserByEmail(config.email);
        if (found && (found.kind !== 'user' || !UUID.test(found.id || '') || found.email !== config.email)) fail('OWNER_IDENTITY_CONFLICT', 'The existing account could not be matched to this owner authorization.', 409);
        const account = found ? await store.get('accounts', found.id) : null;
        if (found && (!account || account.ownerId !== found.id || account.value.emailVerified !== true)) fail('OWNER_VERIFICATION_REQUIRED', 'Verify the existing account before granting owner access.', 403);
        if (account?.value.deletionRequest) fail('OWNER_IDENTITY_CONFLICT', 'An account pending deletion cannot receive owner access.', 409);
        const ownerId = found?.id || config.userId, created = !found;
        const value = account ? { ...account.value, access: createOwnerGrant(time) } : {
          emailVerified: true, verifiedAt: time, verificationMethod: 'operator_provisioned', createdAt: time,
          selectedPlan: null, locale: 'en', returnPath: '/en/terminal/', billing: { status: 'none', paidUntil: null }, access: createOwnerGrant(time),
        };
        const changes = [
          change('accounts', ownerId, ownerId, account, value),
          change('jobs', receiptKey, SYSTEM_OWNER, null, { type: 'owner_bootstrap_receipt', configurationId: config.id, configurationDigest: digest, ownerId, created, createdAt: time }),
          change('audit', `${ownerId}:owner-bootstrap:${config.id}`, ownerId, null, { kind: 'owner_access_granted', actor: 'operator', ownerId, authorizationId: config.id, created, createdAt: time }),
        ];
        try {
          const result = await legacyStore.productIdentity({ operation: created ? 'create' : 'update', ...(created ? { user: { id: ownerId, kind: 'user', email: config.email, name: config.name, password_hash: config.passwordHash, created_at: time, expires_at: null }, state: createInitialState({ now: time }) } : {}), changes });
          if (result?.status !== 'applied') fail('OWNER_BOOTSTRAP_CONFLICT', 'The account changed during owner provisioning.', 409);
          return response(200, { ok: true, ownerId, created, unlimited: true });
        } catch (error) {
          // The remote transaction may have committed before its response was lost.
          const consumed = publicReceipt(await store.get('jobs', receiptKey), config, digest);
          if (consumed) return response(200, consumed);
          if (error?.status === 409) {
            if (attempt < 3) continue;
            fail('OWNER_BOOTSTRAP_CONFLICT', 'The account changed during owner provisioning.', 409);
          }
          throw error;
        }
      }
      fail('OWNER_BOOTSTRAP_CONFLICT', 'The account changed during owner provisioning.', 409);
    } catch (error) {
      const known = error instanceof TerminalError;
      return response(known ? error.status : 503, { error: { code: known ? error.code : 'OWNER_BOOTSTRAP_UNAVAILABLE', message: known ? error.message : 'Owner provisioning could not be confirmed. Retry the same authorization.' } });
    }
  };
}
