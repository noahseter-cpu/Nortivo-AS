import { createAdminSession, json, parseBody, passwordMatches } from './_utils.mjs';
import { errorResponse, language } from './_support-language.mjs';
import { header, rateLimit, sameOrigin } from './_ticket-security.mjs';

export async function handler(event) {
  let locale = language(event.queryStringParameters?.language);
  if (event.httpMethod !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', locale, { Allow: 'POST' });
  if (!sameOrigin(event, { required: true })) return errorResponse(403, 'FORBIDDEN', locale);
  if (!rateLimit(event, 'admin-login', { ipLimit: 10 })) return errorResponse(429, 'TOO_MANY_REQUESTS', locale, { 'Retry-After': '900' });
  try {
    let body;
    try { body = parseBody(event); } catch { return errorResponse(400, 'BAD_REQUEST', locale); }
    locale = language(body.language);
    if (!passwordMatches(body.password)) return errorResponse(401, 'NOT_SIGNED_IN', locale);
    const secure = header(event, 'x-forwarded-proto') === 'https' ? '; Secure' : '';
    return json(200, { ok: true }, {
      'Set-Cookie': `nortivo_admin=${encodeURIComponent(createAdminSession())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`,
    });
  } catch {
    console.error('Admin login is unavailable.');
    return errorResponse(503, 'UNAVAILABLE', locale);
  }
}
