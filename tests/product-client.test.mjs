import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationAvailable } from '../dist/assets/product-core.js';

test('public registration capability is available before an email delivery probe', () => {
  const catalog = {
    ready: false,
    capabilities: { signupEnabled: true, emailVerification: true },
    readiness: { email: { configured: true, reachable: null } },
  };
  assert.equal(registrationAvailable(catalog, null), true);
});

test('public registration capability takes precedence over an older account snapshot', () => {
  assert.equal(registrationAvailable(
    { capabilities: { signupEnabled: false } },
    { capabilities: { signupEnabled: true } },
  ), false);
  assert.equal(registrationAvailable(
    { capabilities: { signupEnabled: true } },
    { capabilities: { signupEnabled: false } },
  ), true);
});

test('registration falls back to an account capability only if the public capability is absent', () => {
  assert.equal(registrationAvailable(null, { capabilities: { signupEnabled: true } }), true);
  assert.equal(registrationAvailable(null, null), false);
});
