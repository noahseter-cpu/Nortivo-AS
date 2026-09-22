// Netlify uses .js ES modules for edge functions; no package or external request is needed.
// API: https://docs.netlify.com/build/edge-functions/api/
// Routing: https://docs.netlify.com/build/edge-functions/declarations/
const legacyPaths = ['/', '/products/', '/support/', '/admin/', '/privacy/', '/about/', '/services/', '/contact/', '/restaurant/'];
const supported = value => value === 'nb' || value === 'en';

function savedLanguage(request) {
  const entry = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith('nortivo_language='));
  try { return entry ? decodeURIComponent(entry.slice('nortivo_language='.length)) : ''; } catch { return ''; }
}

export default function languageRedirect(request, context = {}) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method) || !legacyPaths.includes(url.pathname)) return;
  const explicit = url.searchParams.get('lang');
  const saved = savedLanguage(request);
  const language = supported(explicit) ? explicit : supported(saved) ? saved : context.geo?.country?.code === 'NO' ? 'nb' : 'en';
  url.pathname = `/${language}${url.pathname}`;
  url.searchParams.delete('lang');
  // HTTP requests do not contain URL fragments. The browser carries any original fragment across this redirect.
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.href,
      'Cache-Control': 'private, no-store',
      'CDN-Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': 'no-store',
      Vary: 'Cookie',
      ...(supported(explicit) ? { 'Set-Cookie': `nortivo_language=${explicit}; Path=/; Max-Age=31536000; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}` } : {}),
    },
  });
}

// Do not opt into manual edge caching: this decision depends on each visitor.
// HEAD is not accepted by Netlify's method-filter manifest schema. The handler
// above gates GET/HEAD itself, so omit the optional deployment-level filter.
export const config = { path: legacyPaths, onError: 'bypass' };
