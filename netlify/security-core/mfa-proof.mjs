export const STEP_UP_MS = 10 * 60 * 1000;

export function verifiedMfaTime(proof, enrollment, subjectId, now, scopes, maxAge = STEP_UP_MS) {
  if (enrollment?.ownerId !== subjectId || enrollment.value?.enabled !== true || proof?.ownerId !== subjectId) return null;
  const { scope, verifiedAt, validUntil } = proof.value || {};
  if (!scopes.includes(scope) || !Number.isSafeInteger(verifiedAt) || verifiedAt < 0 || verifiedAt > now
    || now - verifiedAt >= maxAge || !Number.isSafeInteger(validUntil) || validUntil <= now) return null;
  return verifiedAt;
}
