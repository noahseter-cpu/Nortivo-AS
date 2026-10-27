import { isAdmin, json } from './_utils.mjs';
import { sameOrigin } from './_ticket-security.mjs';
import { privateContent } from '../private/content-loader.mjs';

export function createHandler({ loadProjects = privateContent.projects } = {}) {
return async function handler(event) {
  if (!isAdmin(event)) return json(401, { error: 'Not signed in.', code: 'NOT_SIGNED_IN' });
  if (!sameOrigin(event)) return json(403, { error: 'Request origin is not allowed.', code: 'FORBIDDEN' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  try {
    const projects = await loadProjects();
    return json(200, { projects }, { 'X-Robots-Tag': 'noindex, nofollow' });
  } catch { return json(503, { error: 'Private workspace is temporarily unavailable.', code: 'UNAVAILABLE' }); }
};
}
export const handler = createHandler();
