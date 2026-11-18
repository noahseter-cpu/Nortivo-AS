import crypto from 'node:crypto';
import { createLocalStore } from '../../netlify/terminal/store-local.mjs';
import { createAdminSecurity } from '../../netlify/security-core/admin.mjs';

// An authoritative in-memory SQLite account/session/MFA repository. This helper
// never accepts a legacy signed cookie, browser role header or arbitrary token.
export async function createCoreAdminFixture({ now = () => Date.now() } = {}) {
  const store = await createLocalStore(':memory:');
  const time = now();
  const userId = crypto.randomUUID();
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const sessionHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const env = {
    URL: 'https://nortivo.no', CONTEXT: 'production',
    TERMINAL_SESSION_SECRET: 'synthetic-core-admin-fixture-secret-at-least-32-bytes',
    ADMIN_SESSION_SECRET: 'synthetic-core-admin-fixture-secret-at-least-32-bytes',
    PRODUCT_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url'),
    PRODUCT_ADMIN_USER_IDS: userId,
  };
  await store.createUser({ id: userId, kind: 'user', email: 'admin-fixture@example.invalid', name: 'Synthetic administrator', created_at: time - 1000, expires_at: null }, {});
  await store.createSession({ token_hash: sessionHash, user_id: userId, created_at: time - 1000, expires_at: time + 8 * 60 * 60 * 1000 - 1000 });
  await store.product.transact([
    { ns: 'accounts', key: userId, ownerId: userId, expectedVersion: null, value: { emailVerified: true } },
    { ns: 'mfa', key: userId, ownerId: userId, expectedVersion: null, value: { enabled: true } },
    { ns: 'mfa_sessions', key: sessionHash, ownerId: userId, expectedVersion: null, value: { scope: 'admin', verifiedAt: time, validUntil: time + 600000 }, expiresAt: time + 600000 },
  ]);
  const security = createAdminSecurity({ store, env, now, auditSink: async () => {} });
  const cookie = `__Host-nortivo_admin_core=${rawToken}`;
  const response = await security.session({ httpMethod: 'GET', rawUrl: 'https://nortivo.no/.netlify/functions/admin-session', headers: { cookie, origin: 'https://nortivo.no', 'x-nf-client-connection-ip': 'synthetic-admin-fixture' } });
  if (response.statusCode !== 200) throw Error('Synthetic admin fixture did not satisfy current security policy.');
  const csrfToken = JSON.parse(response.body).csrfToken;
  return Object.freeze({
    store, security, env, userId, sessionHash, cookie, csrfToken,
    authorizeAdmin: security.requireAdmin,
    headers: (extra = {}) => ({ cookie, 'x-csrf-token': csrfToken, 'x-nf-client-connection-ip': 'synthetic-admin-fixture', ...extra }),
    close: () => store.close(),
  });
}
