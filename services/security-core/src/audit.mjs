import { createHmac } from 'node:crypto';
import { SecurityCoreError } from './errors.mjs';
import { bounded } from './bounded.mjs';

const EVENTS = new Set(['request_allowed', 'request_denied', 'dependency_unavailable', 'internal_error']);
const REASONS = new Set([
  'AUTHORIZED', 'AUTH_REQUIRED', 'AUTH_UNAVAILABLE', 'FORBIDDEN', 'MFA_REQUIRED',
  'INVALID_ORIGIN', 'CSRF_FAILED', 'METHOD_NOT_ALLOWED', 'INVALID_BODY', 'BODY_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE', 'RATE_LIMITED', 'RATE_LIMIT_UNAVAILABLE', 'AUDIT_UNAVAILABLE',
  'CLIENT_CONTEXT_REQUIRED', 'NOT_FOUND', 'UNAVAILABLE',
]);
const unavailable = () => new SecurityCoreError(503, 'AUDIT_UNAVAILABLE');
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);
const validReason = value => REASONS.has(value);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;

function pseudonym(secret, domain, value) {
  if (typeof value !== 'string' || value.length < 1 || Buffer.byteLength(value) > 512) throw unavailable();
  return createHmac('sha256', secret).update(`security-core:audit:v1:${domain}:`).update(value).digest('hex');
}

/**
 * Emits one allowlisted JSON record per line. Raw URLs, credentials, arbitrary
 * metadata, request/response bodies and error messages are intentionally absent.
 * The caller must await emission before confirming a protected operation.
 */
export function createAuditLogger({ sink, key, now = Date.now, timeoutMs = 5000 } = {}) {
  if (typeof sink !== 'function' || typeof now !== 'function'
    || (typeof key !== 'string' && !Buffer.isBuffer(key)) || Buffer.byteLength(key) < 32
    || Buffer.byteLength(key) > 1024) throw unavailable();
  const secret = Buffer.from(key);
  return async function emit(input) {
    try {
      if (!input || typeof input !== 'object' || Array.isArray(input) || !EVENTS.has(input.event)
        || !['allow', 'deny'].includes(input.decision) || !identifier(input.routeId)
        || !Number.isInteger(input.status) || input.status < 100 || input.status > 599
        || (input.requestId !== undefined && !identifier(input.requestId))
        || (input.reason !== undefined && !validReason(input.reason))
        || (input.durationMs !== undefined && (!Number.isFinite(input.durationMs) || input.durationMs < 0 || input.durationMs > 86_400_000))) throw unavailable();
      if ((input.event === 'request_allowed') !== (input.decision === 'allow')
        || (input.decision === 'allow' && input.status >= 400)
        || (input.decision === 'deny' && input.status < 400)) throw unavailable();
      const time = now();
      if (!Number.isSafeInteger(time) || time < 0) throw unavailable();
      const record = {
        version: 1,
        timestamp: new Date(time).toISOString(),
        event: input.event,
        decision: input.decision,
        routeId: input.routeId,
        status: input.status,
      };
      if (input.requestId !== undefined) record.requestId = input.requestId;
      if (input.reason !== undefined) record.reason = input.reason;
      if (input.durationMs !== undefined) record.durationMs = Math.round(input.durationMs);
      if (input.subjectId !== undefined) record.subjectId = pseudonym(secret, 'subject', input.subjectId);
      if (input.clientId !== undefined) record.clientId = pseudonym(secret, 'client', input.clientId);
      await bounded(() => sink(JSON.stringify(record)), timeoutMs);
      return Object.freeze(record);
    } catch { throw unavailable(); }
  };
}

/**
 * Evaluates records from one caller-selected window (for example, five minutes).
 * This is a local rule evaluator; it does not collect, schedule or send alerts.
 */
export function evaluateAlerts(events, { denialThreshold = 10, unavailableThreshold = 3 } = {}) {
  if (!Array.isArray(events) || events.length > 100_000 || !positiveInteger(denialThreshold)
    || !positiveInteger(unavailableThreshold)) throw unavailable();
  const groups = new Map();
  for (const item of events) {
    // Only normalized fields affect summaries; no raw or user-defined content is returned.
    if (!item || !EVENTS.has(item.event) || item.decision !== 'deny' || !identifier(item.routeId)
      || !Number.isInteger(item.status) || item.status < 400 || item.status > 599) continue;
    let group = groups.get(item.routeId);
    if (!group) { group = { denied: 0, unavailable: 0 }; groups.set(item.routeId, group); }
    group.denied += 1;
    if (item.event === 'dependency_unavailable' || item.status === 503) group.unavailable += 1;
  }
  const alerts = [];
  for (const [routeId, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (group.denied >= denialThreshold) alerts.push(Object.freeze({ rule: 'DENIAL_THRESHOLD', routeId, count: group.denied, severity: 'warning' }));
    if (group.unavailable >= unavailableThreshold) alerts.push(Object.freeze({ rule: 'DEPENDENCY_UNAVAILABLE', routeId, count: group.unavailable, severity: 'critical' }));
  }
  return Object.freeze(alerts);
}
