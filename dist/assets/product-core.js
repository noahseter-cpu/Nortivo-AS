// Display helpers only. Ledger, tax, FX and billing calculations belong to the server.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function localeFromPath(pathname) { return pathname.startsWith('/nb/') ? 'nb' : 'en'; }
export function registrationAvailable(publicCatalog, accountSnapshot) {
  return (publicCatalog?.capabilities ?? accountSnapshot?.capabilities)?.signupEnabled === true;
}
export function internalPath(value, fallback = '/en/portfolio/') {
  return typeof value === 'string' && /^\/(?:en\/|nb\/)?(?:portfolio|terminal|pricing)\/(?:[?#].*)?$/.test(value) && !/[\\\r\n]/.test(value) ? value : fallback;
}
export function readIntent(search, locale = 'en') {
  const query = new URLSearchParams(search);
  const tier = query.get('tier') === 'pro' ? 'pro' : 'portfolio';
  const interval = query.get('interval') === 'year' ? 'year' : 'month';
  return {tier, interval, locale, returnPath:internalPath(query.get('returnPath') || query.get('returnTo'), `/${locale}/${tier === 'pro' ? 'terminal' : 'portfolio'}/`)};
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
