import { createOwnerBootstrapHandler } from '../product/owner-bootstrap.mjs';
import { openRuntimeValue } from '../product/runtime-envelope.mjs';
import { fail } from '../terminal/security.mjs';

export function loadOwnerBootstrapConfiguration(env = {}) {
  try {
    const raw = env.PRODUCT_OWNER_BOOTSTRAP_ENVELOPE;
    if (typeof raw !== 'string' || !raw || Buffer.byteLength(raw) > 65536) throw new Error();
    return openRuntimeValue(JSON.parse(raw), env, 'owner-bootstrap-v1');
  } catch {
    fail('OWNER_BOOTSTRAP_NOT_CONFIGURED', 'Owner provisioning is not configured.', 503);
  }
}

// Temporary deployment-only endpoint. Its fixed operator configuration, random
// header token, short expiry, atomic one-use receipt and audit are independent
// of public registration. This function is removed after verified provisioning.
export const handler = createOwnerBootstrapHandler({
  configuration: () => loadOwnerBootstrapConfiguration(process.env),
});
