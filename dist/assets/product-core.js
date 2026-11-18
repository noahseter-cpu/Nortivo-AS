// Display helpers only. Ledger, tax, FX and billing calculations belong to the server.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function localeFromPath(pathname) { return pathname.startsWith('/nb/') ? 'nb' : 'en'; }
export function registrationAvailable(publicCatalog, accountSnapshot) {
  return (publicCatalog?.capabilities ?? accountSnapshot?.capabilities)?.signupEnabled === true;
}
export function internalPath(value, fallback = '/en/portfolio/') {
  return typeof value === 'string' && /^\/(?:en\/|nb\/)?(?:portfolio|terminal|pricing)\/(?:[?#].*)?$/.test(value) && !/[\\\r\n]/.test(value) ? value : fallback;
}
export function readIntent(search, locale = 'en', saved = {}) {
  const query = new URLSearchParams(search);
  const tier = (query.has('tier') ? query.get('tier') : saved?.tier) === 'pro' ? 'pro' : 'portfolio';
  const interval = (query.has('interval') ? query.get('interval') : saved?.interval) === 'year' ? 'year' : 'month';
  const fallback = `/${locale}/${tier === 'pro' ? 'terminal' : 'portfolio'}/`;
  const accountTab = ['account','billing','security'].includes(query.get('tab')) ? query.get('tab') : null;
  const workspace = ['terminal','portfolio'].includes(query.get('workspace')) ? query.get('workspace') : null;
  const target = accountTab ? `/${locale}/portfolio/?tab=${accountTab}${workspace ? '&workspace='+workspace : ''}` : internalPath(query.get('returnPath') || query.get('returnTo') || saved?.returnPath, fallback);
  return {tier, interval, locale, returnPath:target.replace(/^\/(en|nb)\//, `/${locale}/`)};
}
export function intentPath(name, chosen, mode) {
  const locale = chosen?.locale === 'nb' ? 'nb' : 'en';
  const intent = readIntent(new URLSearchParams(chosen), locale);
  const route = ['portfolio', 'terminal', 'pricing'].includes(name) ? name : 'portfolio';
  const query = new URLSearchParams(intent);
  if (['signup', 'login'].includes(mode)) query.set('auth', mode);
  return `/${locale}/${route}/?${query}`;
}
export function safeAuthDraft(data = {}) {
  return {email:typeof data.email === 'string' ? data.email.slice(0,160) : '', name:typeof data.name === 'string' ? data.name.slice(0,80) : ''};
}
export function safeWebUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function decimalText(value, locale = 'en', maxDigits = 8) {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return '—';
  const [whole, fraction = ''] = raw.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'nb' ? '\u00a0' : ',');
  const digits = fraction.slice(0, maxDigits).replace(/0+$/, '');
  return grouped + (digits ? (locale === 'nb' ? ',' : '.') + digits : '');
}
export function moneyText(value, currency = 'USD', locale = 'en') {
  const text = decimalText(value, locale, 8);
  return text === '—' ? text : `${text} ${/^[A-Z]{3}$/.test(currency) ? currency : ''}`.trim();
}
export function dataState(state, included = true) {
  if (!state || !state.configured || !state.permissionsReady) return 'unavailable';
  if (state.connected === false && state.authorizationRequired) return 'connect';
  if (state.reachable === false) return 'unavailable';
  if (state.reachable !== true) return 'unverified';
  if (state.freshness === 'stale') return 'stale';
  if (['closed', 'market_closed'].includes(state.freshness)) return 'closed';
  if (state.freshness === 'delayed') return 'delayed';
  if (!included || state.planIncluded === false) return 'upgrade';
  return 'current';
}
