// Explicit local-only fixture server. Never imported by Netlify or the normal preview server.
import http from 'node:http';
import crypto from 'node:crypto';
import { previewResponse } from './serve.mjs';
import { handler as login } from '../netlify/functions/admin-login.mjs';
import { handler as logout } from '../netlify/functions/admin-logout.mjs';
import { handler as projects } from '../netlify/functions/admin-projects.mjs';
import { handler as vibb } from '../netlify/functions/admin-vibb.mjs';
import { isAdmin, json, parseBody } from '../netlify/functions/_utils.mjs';
import { sameOrigin } from '../netlify/functions/_ticket-security.mjs';
import { readLocalContentKey } from './private-content-key.mjs';

if (!process.argv.includes('--fixtures')) throw new Error('Run explicitly with --fixtures. This server is for local synthetic UI checks only.');
const portFlag = process.argv.indexOf('--port');
const port = portFlag < 0 ? 4400 : Number(process.argv[portFlag + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
const origin = `http://127.0.0.1:${port}`;
// Discard inherited production/service configuration, then create ephemeral auth for this process.
for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'SUPPORT_FROM_EMAIL', 'GROQ_API_KEY', 'GROQ_MODEL', 'VIBB_OWNER_EMAIL', 'URL', 'DEPLOY_PRIME_URL', 'DEPLOY_URL', 'CONTEXT', 'ADMIN_SESSION_SECRET', 'ADMIN_PASSWORD', 'NORTIVO_PRIVATE_CONTENT_KEY']) delete process.env[name];
process.env.NORTIVO_PRIVATE_CONTENT_KEY = await readLocalContentKey();
process.env.ADMIN_SESSION_SECRET = crypto.randomBytes(48).toString('base64url');
process.env.ADMIN_PASSWORD = crypto.randomBytes(12).toString('base64url');
process.env.NETLIFY_DEV = 'true';
process.env.URL = origin;
const ticket = { id: 'synthetic-preview', ticket_number: 'NT-2026-DEMO42', name: 'Synthetic preview', email: 'preview@example.invalid', subject: 'Synthetic support ticket — local preview only', message: 'This is local fixture data. No customer ticket is connected and no email will be sent.', status: 'open', created_at: '2026-10-27T10:00:00Z' };
const replies = [];
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    let body = '';
    for await (const chunk of request) { body += chunk.toString(); if (Buffer.byteLength(body) > 24000) { response.writeHead(413); response.end(); return; } }
    const event = { path: url.pathname, rawUrl: url.href, httpMethod: request.method, headers: request.headers, body, queryStringParameters: Object.fromEntries(url.searchParams) };
    let result;
    const functionName = url.pathname.replace('/.netlify/functions/', '');
    if (functionName === 'admin-login') result = await login(event);
    else if (functionName === 'admin-logout') result = await logout(event);
    else if (functionName === 'admin-projects') result = await projects(event);
    else if (url.pathname.startsWith('/admin/projects/vibb/')) result = await vibb(event);
    else if (url.pathname === '/admin/projects/vibb') result = { statusCode: 301, headers: { Location: '/admin/projects/vibb/' }, body: '' };
    else if (['admin-tickets', 'reply-ticket'].includes(functionName)) {
      if (!isAdmin(event)) result = json(401, { error: 'Not signed in.' });
      else if (!sameOrigin(event, { required: request.method !== 'GET' })) result = json(403, { error: 'Forbidden.' });
      else if (functionName === 'reply-ticket' && request.method === 'POST') {
        const input = parseBody(event);
        if (input.id !== ticket.id || typeof input.message !== 'string' || input.message.trim().length < 2) result = json(400, { error: 'Invalid synthetic reply.' });
        else { replies.push({ body: input.message, created_at: new Date().toISOString() }); ticket.status = 'answered'; result = json(200, { ok: true }); }
      } else if (request.method === 'PATCH') {
        const input = parseBody(event);
        if (input.id !== ticket.id || !['open', 'closed', 'answered'].includes(input.status)) result = json(400, { error: 'Invalid synthetic status.' });
        else { ticket.status = input.status; result = json(200, { ticket }); }
      } else result = json(200, event.queryStringParameters.id ? { ticket, replies } : { tickets: [ticket] });
    } else {
      const preview = await previewResponse(request);
      response.writeHead(preview.status, preview.headers);
      response.end(preview.body);
      return;
    }
    response.writeHead(result.statusCode, result.headers);
    response.end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
  } catch { response.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); response.end('Local fixture error.'); }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`LOCAL FIXTURES ONLY: ${origin}/en/admin/`);
  console.log(`Ephemeral preview password: ${process.env.ADMIN_PASSWORD}`);
  console.log('Synthetic support records only; no email, database or Groq requests. All preview sessions expire on server restart.');
});
