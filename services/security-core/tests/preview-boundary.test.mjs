import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../scripts/preview.mjs';

// Exercise the real HTTP request listener without opening a socket in the restricted sandbox.
async function invoke(url, { method = 'GET', host = '127.0.0.1:4486', headers = {} } = {}) {
  const server = createPreviewServer({ sink() {} });
  const listener = server.listeners('request')[0];
  const result = {};
  const res = {
    writeHead(status, values) { result.status = status; result.headers = values; },
    end(body) { result.body = body?.toString() || ''; }
  };
  await listener({ url, method, headers: { host, ...headers }, socket: { remoteAddress: '127.0.0.1' } }, res);
  return result;
}

test('preview serves every page and local asset with CSP while denying source and traversal', async () => {
  for (const url of ['/', '/security.html', '/report.html', '/styles.css', '/preview.js', '/core-symbol.svg']) {
    const result = await invoke(url);
    assert.equal(result.status, 200, url);
    assert.match(result.headers['Content-Security-Policy'], /form-action 'none'/);
    assert.equal(result.headers['X-Frame-Options'], 'DENY');
    assert.match(result.headers['Cache-Control'], /no-store/);
  }
  for (const url of ['/%2e%2e%2fpackage.json', '/src/sessions.mjs', '/.env.example', '/README.md', '/missing.html']) {
    assert.equal((await invoke(url)).status, 404, url);
  }
});
test('preview denies DNS-rebinding Host values and state-changing static requests', async () => {
  assert.equal((await invoke('/', { host: 'attacker.test:4486' })).status, 403);
  assert.equal((await invoke('/', { method: 'POST' })).status, 405);
  const head = await invoke('/security.html', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.body, '');
});
test('reference API declares development and cannot be elevated by spoofed headers', async () => {
  const status = await invoke('/api/status');
  assert.equal(status.status, 200);
  assert.equal(JSON.parse(status.body).data.productionIntegrated, false);
  for (const url of ['/api/private', '/api/admin']) {
    const result = await invoke(url, { headers: { 'x-role': 'admin', 'x-user-id': 'noah', 'x-forwarded-for': 'trusted' } });
    assert.equal(result.status, 401);
    assert.equal(JSON.parse(result.body).error.code, 'AUTH_REQUIRED');
  }
});
