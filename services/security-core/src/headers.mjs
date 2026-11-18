export const PREVIEW_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export function securityHeaders({ api = true, https = false } = {}) {
  return {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': api ? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" : PREVIEW_CSP,
    ...(https ? { 'Strict-Transport-Security': 'max-age=15552000' } : {})
  };
}

export function jsonResponse(status, value, { https = false, retryAfter, allow } = {}) {
  const headers = { ...securityHeaders({ https }), 'Content-Type': 'application/json; charset=utf-8' };
  if (Number.isSafeInteger(retryAfter) && retryAfter > 0) headers['Retry-After'] = String(retryAfter);
  if (allow) headers.Allow = allow;
  return new Response(JSON.stringify(value), { status, headers });
}
