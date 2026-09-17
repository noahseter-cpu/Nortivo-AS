import { json } from './_utils.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  return json(200, { ok: true }, {
    'Set-Cookie': 'nortivo_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure',
  });
}
