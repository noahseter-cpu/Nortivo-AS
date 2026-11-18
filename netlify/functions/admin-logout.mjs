import { adminSecurity } from '../security-core/admin.mjs';

export function createHandler({ security = adminSecurity } = {}) {
  return event => security.logout(event);
}
export const handler = createHandler();
