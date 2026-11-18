// Explicit local synthetic fixture server. Never imported by Netlify or the normal preview server.
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as OTPAuth from 'otpauth';
import { previewResponse } from './serve.mjs';
import { createHandler as createLogin } from '../netlify/functions/admin-login.mjs';
import { createHandler as createLogout } from '../netlify/functions/admin-logout.mjs';
import { createHandler as createSession } from '../netlify/functions/admin-session.mjs';
import { createHandler as createProjects } from '../netlify/functions/admin-projects.mjs';
import { createHandler as createVibb } from '../netlify/functions/admin-vibb.mjs';
import { parseBody } from '../netlify/functions/_utils.mjs';
import { createAdminSecurity, adminError, adminJson } from '../netlify/security-core/admin.mjs';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { hashPassword } from '../netlify/terminal/auth.mjs';
import { createInitialState } from '../netlify/terminal/engine.mjs';
import { handleMfa } from '../netlify/product/mfa.mjs';
import { SecurityCoreError, securityHeaders } from '../services/security-core/src/index.mjs';
import { readLocalContentKey } from './private-content-key.mjs';

export async function createPrivateAdminFixtureServer({ fixtures = false, port = 4400, readContentKey = readLocalContentKey } = {}) {
  if (!fixtures) throw new Error('Use explicit fixtures:true or --fixtures. This server is for synthetic UI checks only.');
  if (process.env.NETLIFY === 'true' || process.env.CONTEXT === 'production' || process.env.NODE_ENV === 'production') throw new Error('The synthetic admin server cannot run in a hosted production runtime.');
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Use a port between 1024 and 65535.');
  const origin = `http://127.0.0.1:${port}`;

  // Do not load .env. Discard inherited provider credentials before any private fixture content runs.
  for (const name of Object.keys(process.env)) {
    if (/^(?:SUPABASE_|RESEND_|SUPPORT_|GROQ_|STRIPE_|ALPACA_|FINNHUB_|TWELVE_|TRADINGECONOMICS_|OPENAI_|PRODUCT_|BROKER_|TERMINAL_|SECURITY_CORE_|ADMIN_|NORTIVO_PRIVATE_CONTENT_KEY$|URL$|DEPLOY_|CONTEXT$)/.test(name)) delete process.env[name];
  }
  if (typeof readContentKey !== 'function') throw new Error('Supply a local content-key reader.');
  process.env.NORTIVO_PRIVATE_CONTENT_KEY = await readContentKey();
  process.env.NETLIFY_DEV = 'true';
  process.env.URL = origin;

  const userId = crypto.randomUUID();
  const password = crypto.randomBytes(24).toString('base64url');
  const email = 'admin-preview@example.invalid';
  const env = {
    NETLIFY_DEV: 'true', URL: origin,
    SECURITY_CORE_ADMIN_KEY: crypto.randomBytes(48).toString('base64url'),
    PRODUCT_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url'),
    PRODUCT_ADMIN_USER_IDS: userId
  };
  const store = await createLocalStore(':memory:');
  try {
    const createdAt = Date.now();
    const user = { id: userId, kind: 'user', email, name: 'Synthetic administrator', password_hash: await hashPassword(password), created_at: createdAt, expires_at: null };
    await store.createUser(user, createInitialState({ now: createdAt }));
    const account = { emailVerified: true };
    const saved = await store.product.transact([{ ns: 'accounts', key: userId, ownerId: userId, expectedVersion: null, value: account }]);
    if (saved.status !== 'applied') throw new Error('Synthetic administrator could not be initialized.');
    const context = () => ({ store: store.product, legacyStore: store, user, account, env, now: Date.now() });
    const enrollment = await handleMfa(context(), 'product-mfa-enroll', { password });
    const time = Date.now();
    const authenticator = new OTPAuth.TOTP({ issuer: 'Nortivo', label: email, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(enrollment.secret) });
    const confirmed = await handleMfa({ ...context(), now: time }, 'product-mfa-confirm', { code: authenticator.generate({ timestamp: time }) });

    const security = createAdminSecurity({ store, env });
    const authorizeAdmin = security.requireAdmin;
    const login = createLogin({ security }), logout = createLogout({ security }), session = createSession({ security });
    const projects = createProjects({ authorizeAdmin }), vibb = createVibb({ authorizeAdmin });
    const ticket = { id: 'synthetic-preview', ticket_number: 'NT-2026-DEMO42', name: 'Synthetic preview', email: 'preview@example.invalid', subject: 'Synthetic support ticket - local preview only', message: 'This is local fixture data. No customer ticket is connected and no email will be sent.', status: 'open', created_at: '2026-10-27T10:00:00Z', updated_at: '2026-10-27T10:00:00Z' };
    const replies = [];

    async function fixtureTickets(event, functionName) {
      await authorizeAdmin(event, { routeId: `fixture-${functionName}`, mutation: event.httpMethod !== 'GET' });
      if (functionName === 'reply-ticket') {
        if (event.httpMethod !== 'POST') return adminJson(405, { error: 'Use POST.' }, { Allow: 'POST' });
        const input = parseBody(event);
        if (input.id !== ticket.id || typeof input.message !== 'string' || input.message.trim().length < 2 || input.message.length > 4000) return adminJson(400, { error: 'Invalid synthetic reply.' });
        const updatedAt = new Date().toISOString();
        replies.push({ body: input.message, created_at: updatedAt });
        ticket.status = 'answered'; ticket.updated_at = updatedAt;
        return adminJson(200, { ok: true });
      }
      if (event.httpMethod === 'PATCH') {
        const input = parseBody(event);
        if (input.id !== ticket.id || !['open', 'closed', 'answered'].includes(input.status)) return adminJson(400, { error: 'Invalid synthetic status.' });
        ticket.status = input.status; ticket.updated_at = new Date().toISOString();
        return adminJson(200, { ticket });
      }
      if (event.httpMethod !== 'GET') return adminJson(405, { error: 'Use GET or PATCH.' }, { Allow: 'GET, PATCH' });
      if (event.queryStringParameters.view === 'operations') return adminJson(200, { operations: { checkedAt: new Date().toISOString(), configurationOnly: true, productEnabled: false, purchasesOpen: false, purchasesStatus: 'unavailable', services: [] } });
      if (event.queryStringParameters.id) return event.queryStringParameters.id === ticket.id ? adminJson(200, { ticket, replies }) : adminJson(404, { error: 'Synthetic ticket not found.' });
      return adminJson(200, { tickets: Number(event.queryStringParameters.offset || 0) === 0 ? [ticket] : [], page: { limit: 200, offset: Number(event.queryStringParameters.offset || 0), hasMore: false, nextOffset: null } });
    }

    const server = http.createServer(async (request, response) => {
      try {
        if (request.headers.host !== `127.0.0.1:${port}`) { response.writeHead(403, securityHeaders()); response.end(); return; }
        const url = new URL(request.url, origin);
        if (url.origin !== origin) { response.writeHead(403, securityHeaders()); response.end(); return; }
        const chunks = []; let length = 0;
        for await (const chunk of request) {
          length += chunk.length;
          if (length > 24000) { response.writeHead(413, { ...securityHeaders(), Connection: 'close' }); response.end(); return; }
          chunks.push(chunk);
        }
        const event = { path: url.pathname, rawUrl: url.href, httpMethod: request.method,
          headers: { ...request.headers, 'x-nf-client-connection-ip': request.socket.remoteAddress || 'local', 'x-forwarded-proto': 'http' },
          body: Buffer.concat(chunks).toString('utf8'), isBase64Encoded: false, queryStringParameters: Object.fromEntries(url.searchParams) };
        const functionName = url.pathname.startsWith('/.netlify/functions/') ? url.pathname.slice('/.netlify/functions/'.length) : '';
        let result;
        if (functionName === 'admin-login') result = await login(event);
        else if (functionName === 'admin-logout') result = await logout(event);
        else if (functionName === 'admin-session') result = await session(event);
        else if (functionName === 'admin-projects') result = await projects(event);
        else if (url.pathname === '/admin/projects/vibb' || url.pathname.startsWith('/admin/projects/vibb/') || functionName === 'admin-vibb' || functionName.startsWith('admin-vibb/')) result = await vibb(event);
        else if (['admin-tickets', 'reply-ticket'].includes(functionName)) result = await fixtureTickets(event, functionName);
        else {
          const preview = await previewResponse(request);
          response.writeHead(preview.status, { ...securityHeaders({ api: false }), ...preview.headers }); response.end(preview.body); return;
        }
        response.writeHead(result.statusCode, result.headers);
        response.end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
      } catch (error) {
        const result = adminError(error instanceof SecurityCoreError ? error : new SecurityCoreError(503, 'UNAVAILABLE'));
        response.writeHead(result.statusCode, result.headers); response.end(result.body);
      }
    });
    server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxRequestsPerSocket = 100;
    let closed = false;
    const closeStore = () => { if (!closed) { closed = true; store.close(); } };
    server.once('close', closeStore);
    return { server, origin, credentials: { email, password, recoveryCodes: confirmed.recoveryCodes }, dispose: () => { if (server.listening) server.close(); else closeStore(); } };
  } catch (error) { store.close(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv.includes('--fixtures')) throw new Error('Run explicitly with --fixtures. This server is for local synthetic UI checks only.');
  const portFlag = process.argv.indexOf('--port');
  const port = portFlag < 0 ? 4400 : Number(process.argv[portFlag + 1]);
  const { server, origin, credentials } = await createPrivateAdminFixtureServer({ fixtures: true, port });
  server.on('error', () => { console.error('Synthetic admin preview could not start. Check the local port.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`LOCAL SYNTHETIC FIXTURES ONLY: ${origin}/en/admin/`);
    console.log(`Synthetic administrator email: ${credentials.email}`);
    console.log(`Ephemeral synthetic password: ${credentials.password}`);
    console.log(`One-use synthetic recovery codes (use one for each sign-in): ${credentials.recoveryCodes.join(' ')}`);
    console.log('Only process-local SQLite and synthetic support records are connected. No email, provider or trading execution is enabled. Restarting deletes every fixture identity and session. Secure cookie flags are retained.');
  });
}
