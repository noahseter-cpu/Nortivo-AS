import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { corePrivateBrowserScript, injectCorePrivateBrowser } from '../netlify/security-core/private-browser.mjs';

function client({ accepted = true, token = 'x'.repeat(43) } = {}) {
  const calls = [];
  const window = { location: { origin: 'https://nortivo.no', href: 'https://nortivo.no/admin/projects/vibb/workspace.html' }, fetch: async (input, init) => {
    calls.push({ input, init });
    return String(input) === '/.netlify/functions/admin-session' ? { ok: accepted, json: async () => ({ csrfToken: token }) } : { ok: true };
  } };
  vm.runInNewContext(corePrivateBrowserScript, { window, Request, Headers, URL, Set, Error });
  return { window, calls };
}

test('private tutor mutation obtains current session token and attaches it only in a header', async () => {
  const c = client();
  await c.window.fetch('/admin/projects/vibb/api/tutor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(c.calls.length, 2);
  assert.equal(c.calls[0].input, '/.netlify/functions/admin-session');
  assert.equal(c.calls[0].init.cache, 'no-store');
  assert.equal(c.calls[1].init.headers.get('x-csrf-token'), 'x'.repeat(43));
  assert.equal(c.calls[1].init.headers.get('content-type'), 'application/json');
  assert.equal(c.calls[1].init.body, '{}');
  assert.doesNotMatch(String(c.calls[1].input), /xxxxx/);
});

test('cross-origin, unrelated and read-only requests receive no security token or interception', async () => {
  for (const [url, method] of [['https://elsewhere.invalid/admin/projects/vibb/api/tutor', 'POST'], ['/other', 'POST'], ['/admin/projects/vibb/api/tutor', 'GET']]) {
    const c = client(); await c.window.fetch(url, { method });
    assert.equal(c.calls.length, 1);
    assert.equal(c.calls[0].init.headers, undefined);
  }
});

test('expired session and malformed bootstrap response never send the tutor mutation', async () => {
  for (const options of [{ accepted: false }, { token: 'malformed' }]) {
    const c = client(options);
    await assert.rejects(c.window.fetch('/admin/projects/vibb/api/tutor', { method: 'POST', body: '{}' }));
    assert.equal(c.calls.length, 1);
  }
});

test('bridge preserves Request input headers and injects a single CSP-compatible external script', async () => {
  const c = client();
  const request = new Request('https://nortivo.no/admin/projects/vibb/api/tutor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  await c.window.fetch(request);
  assert.equal(c.calls[1].input, request);
  assert.equal(c.calls[1].init.headers.get('content-type'), 'application/json');
  const html = injectCorePrivateBrowser('<html><head><title>Private</title></head><body></body></html>');
  assert.match(html, /<head><script src="\/admin\/projects\/vibb\/core-csrf.js"><\/script>/);
  assert.equal(injectCorePrivateBrowser(html), html);
  assert.doesNotMatch(html, /csrfToken|xxxxx|<script>/);
});
