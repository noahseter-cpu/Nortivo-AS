import { json } from './_utils.mjs';
import { sameOrigin } from './_ticket-security.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  if (!sameOrigin(event, { required: true })) return json(403, { error: 'Request origin is not allowed.', code: 'FORBIDDEN' });
  return json(200, { ok: true }, {
    'Set-Cookie': 'nortivo_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure',
  });
}
