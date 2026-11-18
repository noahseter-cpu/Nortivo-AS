// Netlify uses .js ES modules for edge functions; no package or external request is needed.
// API: https://docs.netlify.com/build/edge-functions/api/
// Routing: https://docs.netlify.com/build/edge-functions/declarations/
const legacyPaths = ['/', '/products/', '/support/', '/admin/', '/privacy/', '/about/', '/services/', '/contact/', '/restaurant/', '/studio/', '/arc/', '/studio/services/', '/reviews/', '/terminal/', '/pricing/', '/portfolio/'];
const supported = value => value === 'nb' || value === 'en';
const companyOrigin = 'https://nortivo.no';
const investmentOrigin = 'https://invest.nortivo.no';
const companyHosts = new Set(['nortivo.no', 'www.nortivo.no']);
const platformPages = ['terminal', 'pricing', 'portfolio'];
const companyPages = ['products', 'support', 'privacy', 'about', 'services', 'contact', 'restaurant', 'studio', 'arc', 'studio/services', 'reviews', 'report-2026'];
const routeVariants = pages => pages.flatMap(page => ['', '/en', '/nb'].flatMap(prefix => [`${prefix}/${page}`, `${prefix}/${page}/`, `${prefix}/${page}/index.html`]));
const platformPaths = new Set(routeVariants(platformPages));
const companyPaths = new Set(routeVariants(companyPages));
const platformPage = path => /\/(terminal|pricing|portfolio)(?:\/index\.html|\/)?$/.exec(path)?.[1];
const investmentRoots = ['/', '/index.html', '/en', '/en/', '/en/index.html', '/nb', '/nb/', '/nb/index.html'];
const adminFunctions = ['/admin-login', '/admin-logout', '/admin-tickets', '/admin-projects', '/admin-vibb', '/reply-ticket'].map(path => `/.netlify/functions${path}`);
const accountTabs = ['account', 'billing', 'security'];
const workspaces = ['terminal', 'portfolio'];

function safeReturnPath(value) {
  // A destination is a local platform entry with optional account context,
  // never an arbitrary URL, fragment, encoded path or open-ended query.
  if (!/^\/(?:en\/|nb\/)?(?:portfolio|terminal|pricing)\/$/.test(value.split('?')[0])) return false;
  const url = new URL(value, investmentOrigin);
  if (url.hash) return false;
  const seen = new Set();
  for (const [key, choice] of url.searchParams) {
    if (seen.has(key) || !(key === 'tab' && accountTabs.includes(choice) || key === 'workspace' && workspaces.includes(choice))) return false;
    seen.add(key);
  }
  return true;
}

// Only non-secret journey and campaign values cross the hostname boundary.
// Verification/reset tokens remain in URL fragments, never query parameters.
function safeQueries(source) {
  const output = new URLSearchParams();
  const choices = {lang:['en','nb'],locale:['en','nb'],tier:['portfolio','pro'],interval:['month','year'],auth:['login','signup','forgot','reset'],billing:['pending','canceled','cancelled'],broker:['connected'],mode:['sample','provider'],intent:['terminal','portfolio','account','billing','checkout','login','signup','sample'],tab:accountTabs,workspace:workspaces};
  for (const [key, value] of source) {
    if (value.length > 500 || /[\u0000-\u001f\\]/.test(value)) continue;
    if (Object.hasOwn(choices, key) && choices[key].includes(value)) output.append(key, value);
    else if (['returnPath', 'returnTo'].includes(key) && safeReturnPath(value)) output.append(key, value);
    else if (/^(?:source|ref|view|project|utm_source|utm_medium|utm_campaign|utm_term|utm_content)$/.test(key) && value.length <= 200) output.append(key, value);
  }
  return output;
}

function redirect(url, explicit, {crossHost=false}={}) {
  if (crossHost) url.search = safeQueries(url.searchParams).toString();
  url.searchParams.delete('lang');
  // HTTP requests do not contain URL fragments. A redirect without a new
  // fragment lets the browser carry the original verification/reset fragment.
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

function savedLanguage(request) {
  const entry = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith('nortivo_language='));
  try { return entry ? decodeURIComponent(entry.slice('nortivo_language='.length)) : ''; } catch { return ''; }
}

export default function languageRedirect(request, context = {}, env = globalThis.Netlify?.env) {
  const url = new URL(request.url);
  const investment = url.origin === investmentOrigin;
  // Never serve the private administration surface from the application host.
  // Server callbacks and platform APIs are deliberately outside this rule.
  const adminPath = /^(?:\/(?:en|nb))?\/admin(?:\/|$)/.test(url.pathname);
  if (investment && (adminFunctions.some(path => url.pathname === path || url.pathname.startsWith(`${path}/`)) || adminPath && !['GET', 'HEAD'].includes(request.method))) return new Response(null, {status:404,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
  if (!['GET', 'HEAD'].includes(request.method)) return;
  const explicit = url.searchParams.get('lang');
  const saved = savedLanguage(request);
  const pathLanguage = /^\/(en|nb)(?:\/|$)/.exec(url.pathname)?.[1];
  const queryLanguage = url.searchParams.get('locale');
  const language = supported(explicit) ? explicit : pathLanguage || (supported(queryLanguage) ? queryLanguage : supported(saved) ? saved : context.geo?.country?.code === 'NO' ? 'nb' : 'en');
  if (investment) {
    if (investmentRoots.includes(url.pathname)) { url.pathname = `/${language}/terminal/`; return redirect(url, explicit); }
    if (platformPaths.has(url.pathname)) { const page = platformPage(url.pathname),path=`/${language}/${page}/`; if (url.pathname === path) return; url.pathname=path; return redirect(url, explicit); }
    if (companyPaths.has(url.pathname) || adminPath) { const target = new URL(url.pathname, companyOrigin); target.search=url.search; return redirect(target, explicit, {crossHost:true}); }
    return;
  }
  // Keep old entry points usable until DNS, TLS, assets, APIs and callbacks on
  // invest.nortivo.no have actually been verified. Runtime flag defaults off.
  if (companyHosts.has(url.hostname) && env?.get?.('PRODUCT_PLATFORM_MIGRATION_READY') === 'true' && platformPaths.has(url.pathname)) {
    const page = platformPage(url.pathname),target=new URL(`/${language}/${page}/`, investmentOrigin); target.search=url.search; return redirect(target, explicit, {crossHost:true});
  }
  if (!legacyPaths.includes(url.pathname)) return;
  url.pathname = `/${language}${url.pathname}`;
  return redirect(url, explicit);
}

// Do not opt into manual edge caching: this decision depends on each visitor.
// HEAD is not accepted by Netlify's method-filter manifest schema. The handler
// above gates GET/HEAD itself, so omit the optional deployment-level filter.
export const config = { path: [...new Set([...legacyPaths, ...platformPaths, ...companyPaths, ...investmentRoots, '/admin', '/admin/*', '/en/admin', '/en/admin/*', '/nb/admin', '/nb/admin/*', ...adminFunctions.flatMap(path => [path, `${path}/*`])])], onError: 'bypass' };
