import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultDist = path.join(projectRoot, 'dist');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
const defaultHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
const within = (root, target) => { const relative = path.relative(root, target); return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };

// Pure request-to-response helper lets tests exercise routes without opening a port.
export async function previewResponse({ url = '/', method = 'GET' } = {}, distDir = defaultDist) {
  const headers = { ...defaultHeaders };
  const result = (status, body, contentType = 'text/plain; charset=utf-8') => {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    return { status, headers: { ...headers, 'Content-Type': contentType, 'Content-Length': String(buffer.byteLength) }, body: method === 'HEAD' ? Buffer.alloc(0) : buffer };
  };
  let pathname;
  try { pathname = decodeURIComponent(url.split('?')[0]); } catch { return result(400, 'Invalid path.'); }
  if (!pathname.startsWith('/') || pathname.includes('\\') || /[\0:"<>|*]/.test(pathname)
    || pathname.split('/').some(segment => segment === '..' || segment === '.')) return result(404, 'Not found.');
  if (pathname.startsWith('/.netlify/functions/')) {
    return result(503, JSON.stringify({ error: 'Support is not connected in this local preview. No ticket was created and no email was sent.', code: 'LOCAL_PREVIEW' }), 'application/json; charset=utf-8');
  }
  if (!['GET', 'HEAD'].includes(method)) { headers.Allow = 'GET, HEAD'; return result(405, 'Method not allowed.'); }
  if (pathname.split('/').some(segment => segment.startsWith('.'))) return result(404, 'Not found.');
  if (/^\/(?:nb\/|en\/)?(?:support|admin)(?:\/|$)/.test(pathname)) headers['X-Robots-Tag'] = 'noindex, nofollow';
  try {
    const root = await realpath(distDir);
    let target = path.resolve(root, `.${pathname}`);
    if (!within(root, target)) return result(404, 'Not found.');
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    target = await realpath(target);
    // Resolve links/junctions too: lexical traversal checks alone do not contain Windows paths.
    if (!within(root, target) || !(await stat(target)).isFile()) return result(404, 'Not found.');
    return result(200, await readFile(target), mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream');
  } catch {
    try {
      const root = await realpath(distDir);
      const fallback = await realpath(path.join(root, '404.html'));
      if (within(root, fallback)) return result(404, await readFile(fallback), 'text/html; charset=utf-8');
    } catch { /* A project without a 404 page still returns an honest 404. */ }
    return result(404, 'Not found.');
  }
}

export function createPreviewServer({ distDir = defaultDist } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const result = await previewResponse(request, distDir);
      response.writeHead(result.status, result.headers);
      response.end(result.body);
    } catch {
      response.writeHead(500, { ...defaultHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Local preview is unavailable.');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const portFlag = process.argv.indexOf('--port');
  const port = portFlag === -1 ? 4399 : Number(process.argv[portFlag + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port with an integer between 1 and 65535.');
  const server = createPreviewServer();
  server.on('error', error => { console.error(`Local preview failed: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port} (support services are not connected)`));
}
