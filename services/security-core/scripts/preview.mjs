import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createSecurityCore, createSessionVerifier, createRateLimiter, createMemoryRateStore, createAuditLogger, securityHeaders } from '../src/index.mjs';

const previewDir = fileURLToPath(new URL('../preview/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
export function createPreviewServer({ port = 4486, sink = line => process.stdout.write(`${line}\n`) } = {}) {
  if (process.env.NETLIFY === 'true' || process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production') throw new Error('Preview is local only.');
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Use a port between 1024 and 65535.');
  const origin = `http://127.0.0.1:${port}`;
  const sentinel = createSecurityCore({ origins: [origin], production: false, csrfKey: randomBytes(32),
    verifySession: createSessionVerifier({ lookupSession: async () => null }),
    consumeRate: createRateLimiter({ store: createMemoryRateStore(), key: randomBytes(32), production: false }),
    audit: createAuditLogger({ key: randomBytes(32), sink }) });
  const status = sentinel.protect({ id: 'preview-status', public: true, methods: ['GET'] }, () => ({ name: 'Nortivo KORVNT', status: 'in_development', productionIntegrated: false }));
  const privateRoute = sentinel.protect({ id: 'preview-private', methods: ['GET'], access: { roles: ['user'] } }, () => ({}));
  const admin = sentinel.protect({ id: 'preview-admin', methods: ['GET'], access: { roles: ['admin'] } }, () => ({}));
  const server = http.createServer(async (req, res) => {
    const headers = securityHeaders({ api: false });
    try {
      if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403, headers); res.end('Origin is not permitted.'); return; }
      const url = new URL(req.url, origin);
      if (['/api/status', '/api/private', '/api/admin'].includes(url.pathname)) {
        const handler = url.pathname === '/api/status' ? status : url.pathname === '/api/admin' ? admin : privateRoute;
        // No account/login fixtures or real credentials exist in this reference server.
        const response = await handler(new Request(url, { method: req.method, headers: req.headers }), { clientId: req.socket.remoteAddress });
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); res.end(); return; }
      const selected = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\//, '');
      const candidate = path.resolve(previewDir, selected);
      const root = await realpath(previewDir);
      const resolved = await realpath(candidate);
      if (!resolved.startsWith(`${root}${path.sep}`) || !mime[path.extname(resolved)] || !(await stat(resolved)).isFile()) throw new Error();
      const content = await readFile(resolved);
      res.writeHead(200, { ...headers, 'Content-Type': mime[path.extname(resolved)] }); res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(404, headers); res.end('Page unavailable in this local preview.'); }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.maxRequestsPerSocket = 100;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const flag = process.argv.indexOf('--port');
  const port = flag >= 0 ? Number(process.argv[flag + 1]) : 4486;
  const server = createPreviewServer({ port });
  server.on('error', () => { console.error('Preview could not start; check the local port.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Nortivo KORVNT local preview: http://127.0.0.1:${port}/`));
}
