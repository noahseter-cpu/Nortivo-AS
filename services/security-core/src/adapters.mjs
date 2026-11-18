import { SecurityCoreError } from './errors.mjs';
import { jsonResponse } from './headers.mjs';

// Existing Supabase RPC is atomic across function instances. No database changes are applied here.
export function terminalRateStore(store) {
  if (store?.kind !== 'supabase' || typeof store.consumeRateLimit !== 'function') throw new TypeError('Use the remote terminal store with the rate-limit RPC migration.');
  return Object.freeze({ durable: true, consumeRateLimit: store.consumeRateLimit.bind(store) });
}

// Repositories are injected. This intentionally does not accept legacy exp-only admin cookies.
export function terminalSessionLookup({ loadSessionRow, loadIdentity }) {
  if (typeof loadSessionRow !== 'function' || typeof loadIdentity !== 'function') throw new TypeError('Provide trusted session-row and identity repositories.');
  return async (hash, time) => {
    const row = await loadSessionRow(hash, time);
    if (!row) return null;
    if (row.token_hash !== hash || typeof row.user_id !== 'string') throw new SecurityCoreError(503, 'AUTH_UNAVAILABLE');
    // MFA evidence must be scoped to this session, not just account enrollment.
    const identity = await loadIdentity(row.user_id, hash, time);
    if (!identity || identity.id !== row.user_id || identity.disabled) return null;
    if (identity.expires_at != null && (!Number.isSafeInteger(Number(identity.expires_at)) || Number(identity.expires_at) <= time)) return null;
    return { subjectId: identity.id, roles: identity.roles, createdAt: Number(row.created_at), expiresAt: Number(row.expires_at), revokedAt: row.revoked_at, mfaVerifiedAt: identity.sessionMfaVerifiedAt };
  };
}

// Netlify legacy-event adapter. The caller must validate which platform metadata is trustworthy.
export function netlifyHandler(guarded, { resolveClientId } = {}) {
  if (typeof guarded !== 'function' || typeof resolveClientId !== 'function') throw new TypeError('Provide a protected handler and verified platform client identity resolver.');
  return async (event, context) => {
    let response;
    try {
      if (event.isBase64Encoded || (event.body && (typeof event.body !== 'string' || Buffer.byteLength(event.body) > 24_000))) throw new SecurityCoreError(413, 'BODY_TOO_LARGE');
      const method = String(event.httpMethod || '').toUpperCase();
      const request = new Request(event.rawUrl, { method, headers: event.headers, ...(!['GET', 'HEAD'].includes(method) ? { body: event.body || '' } : {}) });
      response = await guarded(request, { clientId: await resolveClientId(event, context) });
    } catch (error) {
      response = jsonResponse(error instanceof SecurityCoreError && error.code === 'BODY_TOO_LARGE' ? 413 : 503, { error: { code: error instanceof SecurityCoreError && error.code === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : 'UNAVAILABLE', message: 'The request could not be accepted.' } });
    }
    return { statusCode: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
  };
}
