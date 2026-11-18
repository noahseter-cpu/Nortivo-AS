import { json } from './_utils.mjs';
import { sameOrigin } from './_ticket-security.mjs';
import { privateContent } from '../private/content-loader.mjs';
import { requireAdmin, adminError } from '../security-core/admin.mjs';

export function createHandler({ loadProjects = privateContent.projects, authorizeAdmin = requireAdmin } = {}) {
return async function handler(event) {
  try { await authorizeAdmin(event, { routeId: 'admin-projects', mutation: false }); }
  catch (error) { return adminError(error); }
  if (!sameOrigin(event)) return json(403, { error: 'Request origin is not allowed.', code: 'FORBIDDEN' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  try {
    const projects = await loadProjects();
    return json(200, { projects }, { 'X-Robots-Tag': 'noindex, nofollow' });
  } catch { return json(503, { error: 'Private workspace is temporarily unavailable.', code: 'UNAVAILABLE' }); }
};
}
export const handler = createHandler();
