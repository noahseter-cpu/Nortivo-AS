// Review-only factory. Nothing in this file is registered as a deployed Function.
import { createSecurityCore, createSessionVerifier, createRateLimiter, createAuditLogger, terminalRateStore, terminalSessionLookup, netlifyHandler } from '../src/index.mjs';

export function createAccountSummaryEndpoint({ remoteTerminalStore, loadSessionRow, loadIdentity, loadAccount, auditSink, resolveClientId, origins, keys }) {
  const sentinel = createSecurityCore({
    origins,
    csrfKey: keys.csrf,
    verifySession: createSessionVerifier({ lookupSession: terminalSessionLookup({ loadSessionRow, loadIdentity }) }),
    consumeRate: createRateLimiter({ store: terminalRateStore(remoteTerminalStore), key: keys.rate }),
    audit: createAuditLogger({ sink: auditSink, key: keys.audit })
  });
  const guarded = sentinel.protect({
    id: 'account-summary', methods: ['GET'], access: { roles: ['user'] },
    // The database query is bound to verified identity, never a query/body owner claim.
    owner: async ({ principal }) => (await loadAccount(principal.id))?.ownerId,
    rate: { limit: 60, windowMs: 60000 }
  }, async ({ principal, csrfTokenFor }) => ({
    accountId: principal.id,
    csrfToken: csrfTokenFor(principal)
  }));
  return netlifyHandler(guarded, { resolveClientId });
}
