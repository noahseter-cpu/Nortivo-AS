import { SecurityCoreError } from './errors.mjs';

const ROLE = /^[a-z][a-z0-9:_-]{0,63}$/;

/**
 * Roles and principal come from createSessionVerifier, never browser input.
 * ownerId must be read from the resource's trusted database row. A URL/body
 * owner field is not evidence of ownership. Every supplied restriction applies.
 */
export function authorize(principal, {
  roles = [],
  ownerId,
  requireMfa = false,
  mfaMaxAgeMs = 5 * 60 * 1000,
} = {}, nowMs = Date.now()) {
  if (!principal || typeof principal.id !== 'string' || !principal.id
    || !Array.isArray(principal.roles)) throw new SecurityCoreError(401, 'AUTH_REQUIRED');
  if (!Array.isArray(roles) || roles.some(role => typeof role !== 'string' || !ROLE.test(role))
    || typeof requireMfa !== 'boolean'
    || !Number.isSafeInteger(mfaMaxAgeMs) || mfaMaxAgeMs <= 0
    || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new SecurityCoreError(403, 'FORBIDDEN');
  }
  const ownerRestricted = ownerId !== undefined;
  // A valid session alone never implies permission to call an unconfigured route.
  if ((!roles.length && !ownerRestricted)
    || (roles.length && !roles.some(role => principal.roles.includes(role)))
    || (ownerRestricted && (typeof ownerId !== 'string' || !ownerId || ownerId !== principal.id))) {
    throw new SecurityCoreError(403, 'FORBIDDEN');
  }
  // Administrative sessions always need a fresh second factor, even on an
  // owner-scoped route. Callers cannot accidentally omit this protection.
  if (requireMfa || principal.roles.includes('admin') || roles.includes('admin')) {
    const verifiedAt = principal.mfaVerifiedAt;
    if (!Number.isSafeInteger(verifiedAt) || verifiedAt < 0 || verifiedAt > nowMs
      || nowMs - verifiedAt >= mfaMaxAgeMs) {
      throw new SecurityCoreError(403, 'MFA_REQUIRED');
    }
  }
  return principal;
}
