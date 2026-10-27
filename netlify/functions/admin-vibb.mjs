import { isAdmin, json } from './_utils.mjs';
import { sameOrigin } from './_ticket-security.mjs';
import { privateContent } from '../private/content-loader.mjs';

export const PRIVATE_PREFIX = '/admin/projects/vibb';
const functionPrefix = '/.netlify/functions/admin-vibb';
const virtualOrigin = 'https://private-course.invalid';
// This is an internal Worker identity, never a real email or a browser-supplied identity.
const ownerEmail = 'nortivo-admin@private.invalid';
const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'",
};

function coursePath(event) {
  // Never accept a target URL or path from a query parameter or forwarded host.
  const rawPath = event.rawUrl?.match(/^https?:\/\/[^/]+([^?#]*)/)?.[1];
  const pathname = rawPath?.startsWith(PRIVATE_PREFIX + '/') || rawPath === PRIVATE_PREFIX ? rawPath : event.path;
  if (typeof pathname !== 'string') return null;
  const prefix = [PRIVATE_PREFIX, functionPrefix].find(value => pathname === value || pathname.startsWith(value + '/'));
  if (!prefix) return null;
  let suffix;
  try { suffix = decodeURIComponent(pathname.slice(prefix.length) || '/'); } catch { return null; }
  if (suffix.includes('\\') || /[\0-\x20%?#:]/.test(suffix)
    || suffix.split('/').some(part => part === '.' || part === '..' || part.startsWith('.'))
    || suffix.includes('//')) return null;
  return suffix;
}

export function createHandler({ loadWorker = privateContent.worker } = {}) {
  return async event => {
    // All course bytes, metadata and tutor actions share the existing signed admin cookie.
    if (!isAdmin(event)) {
      const documentPaths = ['/', '/workspace.html', '/app', '/app/', '/app/history', '/app/history/', '/app/about', '/app/about/'];
      const isDocument = documentPaths.includes(coursePath(event));
      if (isDocument && event.httpMethod === 'GET') return { statusCode: 302, headers: { ...privateHeaders, Location: '/admin/?return=vibb' }, body: '' };
      return json(401, { error: 'Økten er utløpt. Logg inn igjen. / Your session expired. Sign in again.', code: 'NOT_SIGNED_IN', signInPath: '/admin/?return=vibb' }, privateHeaders);
    }
    if (!sameOrigin(event, { required: event.httpMethod === 'POST' })) return json(403, { error: 'Request origin is not allowed.', code: 'FORBIDDEN' }, privateHeaders);
    const suffix = coursePath(event);
    if (!suffix) return json(404, { error: 'Not found.' }, privateHeaders);
    if (!['GET', 'HEAD', 'POST'].includes(event.httpMethod) || (event.httpMethod === 'POST' && suffix !== '/api/tutor')) {
      return json(405, { error: 'Method not allowed.' }, { ...privateHeaders, Allow: 'GET, HEAD' });
    }
    if (event.body && Buffer.byteLength(event.body) > (event.isBase64Encoded ? 32000 : 24000)) return json(413, { error: 'Request too large.' }, privateHeaders);
    const body = event.httpMethod === 'POST' ? Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8') : undefined;
    if (body?.length > 24000) return json(413, { error: 'Request too large.' }, privateHeaders);
    try {
      // Construct clean headers; incoming oai-* headers, cookies and authorization are never forwarded.
      const headers = new Headers({
        'oai-authenticated-user-id': 'nortivo-admin',
        'oai-authenticated-user-email': ownerEmail,
        origin: virtualOrigin,
      });
      const contentType = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
      if (contentType) headers.set('content-type', contentType);
      const request = new Request(virtualOrigin + suffix, { method: event.httpMethod, headers, ...(body ? { body } : {}) });
      const worker = (await loadWorker()).default;
      const response = await worker.fetch(request, {
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GROQ_MODEL: process.env.GROQ_MODEL,
        VIBB_OWNER_EMAIL: ownerEmail,
      });
      const responseHeaders = {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        ...privateHeaders,
      };
      // Only the trusted practice app can be framed, and only on this origin.
      // Course/workspace pages retain denied framing. Authentication is unchanged.
      if (suffix === '/app' || suffix.startsWith('/app/')) {
        responseHeaders['X-Frame-Options'] = 'SAMEORIGIN';
        responseHeaders['Content-Security-Policy'] = privateHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'", "frame-ancestors 'self'");
      }
      return {
        statusCode: response.status, headers: responseHeaders,
        body: event.httpMethod === 'HEAD' ? '' : Buffer.from(await response.arrayBuffer()).toString('base64'),
        isBase64Encoded: true,
      };
    } catch {
      return json(503, { error: 'Øvingsrommet er midlertidig utilgjengelig. / The practice room is temporarily unavailable.', code: 'UNAVAILABLE' }, privateHeaders);
    }
  };
}

export const handler = createHandler();
