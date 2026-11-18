// Owner grants are operator-provisioned account records. Never derive them from
// an email address, signup/request body, billing metadata, or browser storage.
export function createOwnerGrant(now = Date.now()) {
  if (!Number.isSafeInteger(now) || now <= 0) throw new TypeError('A valid owner grant timestamp is required.');
  return { role: 'owner', active: true, grantedAt: now, grantedBy: 'operator' };
}

export function isOwnerAccount(account) {
  const grant = account?.access;
  return !account?.disabled && account?.emailVerified === true && grant?.role === 'owner' && grant.active === true
    && grant.grantedBy === 'operator' && Number.isSafeInteger(grant.grantedAt) && grant.grantedAt > 0;
}

export function isOwnerContext(ctx) {
  return ctx?.user?.kind === 'user' && isOwnerAccount(ctx.account);
}
