import { createAdminSession, json, parseBody, passwordMatches } from './_utils.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  try {
    const body = parseBody(event);
    if (!passwordMatches(body.password)) return json(401, { error: 'Wrong admin password.' });
    const secure = event.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return json(200, { ok: true }, {
      'Set-Cookie': `nortivo_admin=${encodeURIComponent(createAdminSession())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`,
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: 'Admin login is not configured yet.' });
  }
}
