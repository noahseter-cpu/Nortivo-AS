import crypto from 'node:crypto';
import { fail } from '../terminal/security.mjs';
import { SYSTEM_OWNER } from './providers-core.mjs';

export const approvalBytes = value => Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'signature').sort(([a], [b]) => a.localeCompare(b)))));
export function verifiedApproval(value, env, now) {
  if (!value || !env.PRODUCT_BROKER_APPROVAL_PUBLIC_KEY || !value.signature || !Number.isSafeInteger(value.verifiedAt) || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt <= value.verifiedAt || value.verifiedAt > now || now - value.verifiedAt > 30 * 86400000) return false;
  try { return crypto.verify(null, approvalBytes(value), env.PRODUCT_BROKER_APPROVAL_PUBLIC_KEY.replace(/\\n/g, '\n'), Buffer.from(value.signature, 'base64')); } catch { return false; }
}
export async function liveRelease(ctx) {
  if (ctx.env.PRODUCT_LIVE_TRANSMISSION_ENABLED !== 'true' || !ctx.env.PRODUCT_RELEASE_BUILD_ID) return { enabled: false, reason: 'Live transmission is not enabled for this release.' };
  const row = await ctx.store.get('jobs', 'broker_live_release'), record = row?.value;
  const enabled = Boolean(row?.ownerId === SYSTEM_OWNER && verifiedApproval(record, ctx.env, ctx.now) && record.type === 'broker_live_release' && record.appClientId === ctx.env.ALPACA_OAUTH_CLIENT_ID && record.buildId === ctx.env.PRODUCT_RELEASE_BUILD_ID && record.commercialApprovalReference?.length >= 8 && record.brokerApprovalReference?.length >= 8 && record.securityReviewReference?.length >= 8 && record.sandboxEvidenceReference?.length >= 8 && Array.isArray(record.countries) && record.countries.length && record.countries.every(c => /^[A-Z]{2}$/.test(c)) && record.automationApproved === true);
  return { enabled, reason: enabled ? 'Signed broker release evidence is current for this application and build.' : 'Live release evidence is missing, expired or does not match this build.', countries: enabled ? record.countries : [], expiresAt: enabled ? record.expiresAt : null };
}
export async function requireLiveRelease(ctx, connection = null, { automation = false } = {}) {
  const release = await liveRelease(ctx);
  if (!release.enabled) fail('LIVE_RELEASE_BLOCKED', release.reason, 403);
  if (connection) {
    const row = await ctx.store.get('jobs', `broker_eligibility:${connection.accountId}`), record = row?.value;
    if (row?.ownerId !== connection.ownerId || !verifiedApproval(record, ctx.env, ctx.now) || record.type !== 'broker_account_eligibility' || record.ownerId !== connection.ownerId || record.accountId !== connection.accountId || !release.countries.includes(record.country) || !record.brokerApprovalReference || automation && record.automationApproved !== true) fail('BROKER_COUNTRY_NOT_VERIFIED', 'The broker has not verified this account and country for the approved Nortivo service.', 403);
    if (!connection.liveConsent || !connection.liveConsent.acceptedAt || connection.liveConsent.accountId !== connection.accountId) fail('LIVE_CONSENT_REQUIRED', 'Review and explicitly enable this live brokerage account first.', 403);
  }
  return release;
}
