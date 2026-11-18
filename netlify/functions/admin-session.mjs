import { adminSecurity } from '../security-core/admin.mjs';

export function createHandler({ security = adminSecurity } = {}) {
  return event => security.session(event);
}
export const handler = createHandler();
