import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setImmediate as nextTurn } from 'node:timers/promises';
import * as core from '../dist/assets/admin-core.js';

const controller = readFileSync(new URL('../dist/assets/admin.js', import.meta.url), 'utf8').replace(/^import .*\r?\n/, '');
const page = readFileSync(new URL('../dist/admin/index.html', import.meta.url), 'utf8');
const token = 'a'.repeat(43);
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

// A synthetic DOM for request/state behavior; rendering is checked separately.
class Element {
  constructor(tag = 'div', attrs = {}) { this.tagName = tag; this.attrs = { ...attrs }; this.id = attrs.id || ''; this.dataset = {}; this.children = []; this.listeners = new Map(); this.value = ''; this.hidden = false; this.disabled = false; this.checked = false; this._text = ''; }
  set textContent(value) { this._text = String(value); this.replaceChildren(); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  get lastElementChild() { return this.children.at(-1); }
  get isConnected() { return this.tagName === 'document' || Boolean(this.parentNode?.isConnected); }
  append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(name, callback) { const values = this.listeners.get(name) || []; values.push(callback); this.listeners.set(name, values); }
  async emit(name) { await Promise.all((this.listeners.get(name) || []).map(callback => callback({ target: this, currentTarget: this, preventDefault() {} }))); }
  focus() { this.focused = true; }
  matches(selector) { if (selector.startsWith('#')) return this.id === selector.slice(1); const attr = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/); if (attr) return attr[1] in this.attrs && (!attr[2] || this.attrs[attr[1]] === attr[2]); return this.tagName === selector; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
}

function harness(fetchImplementation, { startup = false } = {}) {
  const document = new Element('document'), body = new Element('body'); document.append(body); document.body = body;
  for (const match of page.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)) body.append(new Element(match[1], { id: match[2] }));
  document.getElementById = id => document.querySelector('#' + id);
  document.createElement = tag => new Element(tag);
  document.createTextNode = value => { const item = new Element('#text'); item.textContent = value; return item; };
  const el = id => document.getElementById(id);
  el('status-filter').value = 'all'; el('sort-order').value = 'newest';
  el('login-form').append(new Element('button', { type: 'submit' }));
  el('login-form').reset = () => { for (const id of ['admin-email', 'password', 'admin-security-code']) el(id).value = ''; };
  const copy = {}, calls = [];
  const context = vm.createContext({ ...core, document, Intl, URL, AbortController, setTimeout, clearTimeout,
    fetch: (path, options) => { calls.push({ path, options }); return fetchImplementation(path, options); },
    Nortivo: { register: value => Object.assign(copy, value), getLanguage: () => 'en', translate: key => copy.en?.[key] || key, applyTranslations() {} } });
  context.window = context;
  const start = controller.lastIndexOf('  (async () => {');
  const expose = `globalThis.adminTest={api,acceptSession,showLogin,getToken:()=>csrfToken};`;
  const source = startup ? controller.slice(0, start) + expose + controller.slice(start) : controller.slice(0, start) + expose + '})();';
  vm.runInContext(source, context);
  return { actions: context.adminTest, el, calls };
}

test('page refresh restores a server CSRF token before loading private ticket data', async () => {
  const h = harness(async path => response(path.endsWith('admin-session') ? { ok: true, csrfToken: token, admin: { id: 'fixture-admin' } } : { tickets: [] }), { startup: true });
  await nextTurn();
  assert.equal(h.calls.length, 2);
  assert.match(h.calls[0].path, /\/admin-session$/);
  assert.match(h.calls[1].path, /\/admin-tickets\?/);
  assert.equal(h.actions.getToken(), token);
});

test('unverified session response never loads tickets or accepts a malformed token', async () => {
  for (const value of [{ ok: true }, { ok: true, csrfToken: 'bad' }]) {
    const h = harness(async () => response(value), { startup: true });
    await nextTurn();
    assert.equal(h.calls.length, 1); assert.equal(h.actions.getToken(), '');
  }
});

test('named sign-in submits authenticator and recovery factors in distinct fields', async () => {
  for (const [code, expectedField] of [['012345', 'code'], ['recoveryCode12345', 'recoveryCode']]) {
    const h = harness(async path => response(path.endsWith('admin-login') ? { ok: true, csrfToken: token } : { tickets: [] }));
    h.el('admin-email').value = 'operator@example.test'; h.el('password').value = 'Synthetic password only'; h.el('admin-security-code').value = code;
    await h.el('login-form').emit('submit');
    const submitted = h.calls.find(call => call.path.endsWith('admin-login'));
    const data = JSON.parse(submitted.options.body);
    assert.equal(data.email, 'operator@example.test'); assert.equal(data[expectedField], code);
    assert.equal(data[expectedField === 'code' ? 'recoveryCode' : 'code'], undefined);
    assert.equal(submitted.options.headers['x-csrf-token'], undefined);
    assert.equal(h.actions.getToken(), token);
    assert.equal(h.el('admin-security-code').value, '');
  }
});

test('missing email, password or second factor never sends a login request', async () => {
  for (const missing of ['admin-email', 'password', 'admin-security-code']) {
    const h = harness(async () => { throw Error('No request should be sent.'); });
    h.el('admin-email').value = 'operator@example.test'; h.el('password').value = 'Synthetic password'; h.el('admin-security-code').value = '012345'; h.el(missing).value = '';
    await h.el('login-form').emit('submit'); assert.equal(h.calls.length, 0);
    assert.equal(h.el(missing).getAttribute('aria-invalid'), 'true');
  }
});

test('all private mutations carry the current in-memory CSRF token and expiration clears it', async () => {
  const h = harness(async () => response({ ok: true })); h.actions.acceptSession({ ok: true, csrfToken: token });
  for (const [path, method] of [['admin-tickets', 'PATCH'], ['reply-ticket', 'POST'], ['admin-logout', 'POST']]) await h.actions.api(path, { method, headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.ok(h.calls.every(call => call.options.headers['x-csrf-token'] === token));
  h.actions.showLogin('', false); assert.equal(h.actions.getToken(), '');
  await assert.rejects(h.actions.api('reply-ticket', { method: 'POST', body: '{}' }), { code: 'CSRF_REQUIRED' });
  assert.equal(h.calls.length, 3);
});

test('stale MFA or rejected CSRF clears private state and requires fresh sign-in', async () => {
  for (const code of ['MFA_REQUIRED', 'CSRF_FAILED']) {
    const h = harness(async () => response({ code }, 403)); h.actions.acceptSession({ ok: true, csrfToken: token });
    await assert.rejects(h.actions.api('admin-tickets'));
    assert.equal(h.actions.getToken(), ''); assert.equal(h.el('dashboard').hidden, true); assert.equal(h.el('login-card').hidden, false);
  }
});

test('English and Norwegian forms provide named account and MFA fields without inline scripts', () => {
  for (const name of ['admin', 'en/admin', 'nb/admin']) {
    const html = readFileSync(new URL(`../dist/${name}/index.html`, import.meta.url), 'utf8');
    for (const id of ['admin-email', 'admin-security-code', 'admin-email-error', 'admin-code-error', 'admin-security-help']) assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1);
    assert.match(html, /autocomplete="username"/); assert.match(html, /autocomplete="one-time-code"/);
    assert.doesNotMatch(html, /\son(?:click|submit|input)=/i);
  }
  assert.doesNotMatch(controller, /localStorage|sessionStorage|document\.cookie/);
});
