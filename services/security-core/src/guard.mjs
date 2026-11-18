import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { SecurityCoreError, publicError } from './errors.mjs';
import { jsonResponse } from './headers.mjs';
import { readJson, validateObject } from './validation.mjs';
import { authorize } from './policy.mjs';

function validOrigin(value, production) {
  const url = new URL(value);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.origin !== value || url.username || url.password || (url.protocol !== 'https:' && !(local && !production && url.protocol === 'http:'))) throw new TypeError('Configure exact HTTPS origins.');
  return url.origin;
}

export function createSecurityCore({ origins, verifySession, consumeRate, audit, csrfKey, now = Date.now, production = true } = {}) {
  if (!Array.isArray(origins) || !origins.length || ![verifySession, consumeRate, audit].every(x => typeof x === 'function') || !(typeof csrfKey === 'string' || Buffer.isBuffer(csrfKey)) || Buffer.byteLength(csrfKey) < 32) throw new TypeError('Configure security adapters and a separate strong CSRF key.');
  const allowed = new Set(origins.map(value => validOrigin(value, production)));
  function csrfTokenFor(principal) {
    if (!/^[a-f0-9]{64}$/.test(principal?.sessionHash || '')) throw new SecurityCoreError(401, 'AUTH_REQUIRED');
    return createHmac('sha256', csrfKey).update(`nortivo-security-core:csrf:v1:${principal.sessionHash}`).digest('base64url');
  }
  function protect(route, handler) {
    if (!/^[a-z][a-z0-9_.-]{1,63}$/.test(route?.id || '') || !Array.isArray(route.methods) || !route.methods.length || route.methods.some(x => !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(x)) || typeof handler !== 'function') throw new TypeError('Declare a stable route ID, methods and handler.');
    const isPublic = route.public === true;
    if (!isPublic && !route.access) throw new TypeError('Declare explicit access requirements.');
    if (isPublic && (route.access || route.owner)) throw new TypeError('Public routes cannot declare private resource access.');
    if (route.owner && typeof route.owner !== 'function') throw new TypeError('Resolve ownership from a server-loaded resource.');
    const rate = { limit: 60, windowMs: 60_000, ...route.rate };
    return async function guarded(request, context = {}) {
      const startedAt = now();
      const requestId = randomUUID();
      let principal, clientId, https = false;
      const emit = (event, decision, status, reason) => audit({ event, decision, status, reason, requestId, routeId: route.id, subjectId: principal?.id, clientId, durationMs: Math.max(0, now() - startedAt) });
      try {
        const url = new URL(request.url);
        https = url.protocol === 'https:';
        if (!allowed.has(url.origin) || url.username || url.password) throw new SecurityCoreError(403, 'INVALID_ORIGIN');
        if (!route.methods.includes(request.method)) throw new SecurityCoreError(405, 'METHOD_NOT_ALLOWED');
        // This comes from the adapter's verified platform/socket context, never forwarded request headers.
        clientId = context.clientId;
        if (typeof clientId !== 'string' || !clientId || clientId.length > 256 || /[\r\n]/.test(clientId)) throw new SecurityCoreError(503, 'CLIENT_CONTEXT_REQUIRED');
        await consumeRate({ scope: `${route.id}.connection`, identifier: clientId, ...rate });
        const mutation = request.method !== 'GET';
        if (request.headers.get('sec-fetch-site') === 'cross-site') throw new SecurityCoreError(403, 'INVALID_ORIGIN');
        if (mutation && request.headers.get('origin') !== url.origin) throw new SecurityCoreError(403, 'INVALID_ORIGIN');
        if (!isPublic) {
          principal = await verifySession(request);
          const ownerId = route.owner ? await route.owner({ request, principal }) : undefined;
          // A configured owner resolver must produce an owner; a missing row must never remove its restriction.
          if (route.owner && (typeof ownerId !== 'string' || !ownerId)) throw new SecurityCoreError(404, 'NOT_FOUND');
          authorize(principal, { ...route.access, ...(route.owner ? { ownerId } : {}) }, now());
          await consumeRate({ scope: `${route.id}.account`, identifier: principal.id, ...rate });
          if (mutation) {
            const actual = request.headers.get('x-csrf-token') || '';
            const expected = csrfTokenFor(principal);
            if (!/^[A-Za-z0-9_-]{43}$/.test(actual) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new SecurityCoreError(403, 'CSRF_FAILED');
          }
        }
        const parsed = mutation ? await readJson(request, { maxBytes: route.maxBytes ?? 24_000 }) : undefined;
        const body = mutation ? validateObject(parsed, route.schema ?? {}) : undefined;
        // The sink accepts the access decision BEFORE side effects; sink durability is an integration obligation.
        await emit('request_allowed', 'allow', 200, 'AUTHORIZED');
        const value = await handler({ request, principal, body, requestId, csrfTokenFor });
        if (value instanceof Response) throw new TypeError('Return data, not arbitrary response headers.');
        return jsonResponse(200, { data: value, requestId }, { https });
      } catch (error) {
        let failure = publicError(error);
        try {
          await emit(failure.status >= 500 ? 'dependency_unavailable' : 'request_denied', 'deny', failure.status, failure.code);
        } catch { failure = publicError(new SecurityCoreError(503, 'AUDIT_UNAVAILABLE')); }
        return jsonResponse(failure.status, { error: { code: failure.code, message: failure.message }, requestId }, { https, retryAfter: failure.status === 429 ? Math.min(86400, Math.max(1, Math.ceil(error.retryAfter || 1))) : undefined, allow: failure.status === 405 ? route.methods.join(', ') : undefined });
      }
    };
  }
  return Object.freeze({ protect, csrfTokenFor });
}
