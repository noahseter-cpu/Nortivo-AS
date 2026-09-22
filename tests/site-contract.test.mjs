import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const read = file => readFileSync(path.join(dist, file), 'utf8');
const pageFiles = ['index.html', 'products/index.html', 'support/index.html', 'admin/index.html', 'privacy/index.html', '404.html'];
const sources = new Map(pageFiles.map(file => [file, read(file)]));
const siteCopy = JSON.parse(read('assets/site-copy.json'));
const portalCopy = JSON.parse(read('assets/portal-copy.json'));
const dictionaries = Object.fromEntries(['nb', 'en'].map(lang => [lang, { ...siteCopy[lang], ...portalCopy[lang] }]));
const siteCode = read('assets/site.js');
const contactCode = read('assets/contact.js');

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/\s+([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
    .map(match => [match[1], match[2] ?? match[3] ?? match[4] ?? '']));
}
function tags(source, name = '[A-Za-z][\\w:-]*') {
  return [...source.matchAll(new RegExp(`<(${name})\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi'))]
    .map(match => ({ name: match[1].toLowerCase(), attrs: attributes(match[0]), raw: match[0] }));
}
function ids(source) { return tags(source).filter(tag => tag.attrs.id).map(tag => tag.attrs.id); }

// Deliberately small DOM fixture for script contracts. It does not claim to test
// browser rendering, native validation, layout, screen readers or real services.
class Element {
  constructor(tag = 'div', attrs = {}) {
    this.tagName = tag.toLowerCase();
    this.attrs = { ...attrs };
    this.dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.children = [];
    this.listeners = new Map();
    this.value = '';
    this.validity = { valid: true };
    this.hidden = false;
    this.disabled = false;
    this._text = '';
  }
  get id() { return this.attrs.id; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this._text = ''; this.children = []; this.append(...children); }
  focus() { this.focused = true; }
  addEventListener(name, callback) {
    const existing = this.listeners.get(name) || [];
    this.listeners.set(name, [...existing, callback]);
  }
  async emit(name, detail = {}) {
    const event = { type: name, target: this, currentTarget: this, preventDefault() {}, ...detail };
    for (const callback of this.listeners.get(name) || []) await callback(event);
  }
  dispatchEvent(event) { for (const callback of this.listeners.get(event.type) || []) callback(event); }
  matches(selector) {
    const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
    if (tag && this.tagName !== tag.toLowerCase()) return false;
    const id = selector.match(/#([\w-]+)/)?.[1];
    if (id && this.id !== id) return false;
    const className = selector.match(/\.([\w-]+)/)?.[1];
    if (className && !(this.attrs.class || '').split(' ').includes(className)) return false;
    for (const match of selector.matchAll(/\[([\w:-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      if (!(match[1] in this.attrs)) return false;
      if (match[2] !== undefined && this.attrs[match[1]] !== match[2]) return false;
    }
    return true;
  }
  querySelectorAll(selector) {
    const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    return descendants.filter(child => selector === '*' || selector.split(',').some(part => child.matches(part.trim())));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
}

function documentFixture(nodes = [], page = 'home', country = '') {
  const document = new Element('document');
  document.documentElement = new Element('html', { 'data-country-language': country });
  document.body = new Element('body', { 'data-page': page });
  document.append(document.documentElement);
  document.documentElement.append(document.body);
  document.body.append(...nodes);
  document.getElementById = id => document.querySelector('#' + id);
  document.createElement = tag => new Element(tag);
  document.createTextNode = value => { const node = new Element('#text'); node.textContent = value; return node; };
  return document;
}

function loadSite({ url = 'https://nortivo.no/', saved = '', country = '', nodes = [], deniedStorage = false } = {}) {
  const document = documentFixture(nodes, 'home', country);
  const location = new URL(url);
  const storage = new Map(saved ? [['nortivo-site-language', saved]] : []);
  const context = {
    document, location, URL, console,
    localStorage: {
      getItem(key) { if (deniedStorage) throw new Error('Storage blocked'); return storage.get(key) || null; },
      setItem(key, value) { if (deniedStorage) throw new Error('Storage blocked'); storage.set(key, value); },
    },
    history: { replaceState(_state, _title, target) { location.href = new URL(target, location).href; } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    matchMedia: () => ({ addEventListener() {} }),
    fetch: () => { throw new Error('Network calls are forbidden in site tests'); },
  };
  context.window = context;
  vm.runInNewContext(siteCode, context, { filename: 'site.js' });
  return { ...context, storage, site: context.Nortivo };
}

function loadContact(fetchImplementation) {
  const form = new Element('form', { id: 'contact-form' });
  const submit = new Element('button', { type: 'submit' });
  submit.append(new Element('span'));
  const feedback = new Element('div', { id: 'contact-feedback' });
  const fields = [
    ['contact-name', 'name', 'Synthetic test user'],
    ['contact-email', 'email', 'synthetic@example.invalid'],
    ['contact-message', 'message', 'A synthetic project request used only in tests.'],
    ['project-type', 'type', 'web'], ['company', 'company', ''],
  ].map(([id, name, value]) => {
    const element = new Element('input', { id, name });
    element.value = value;
    return element;
  });
  form.elements = Object.fromEntries(fields.map(field => [field.getAttribute('name'), field]));
  form.append(...fields, submit);
  const errorNodes = ['contact-name', 'contact-email', 'contact-message'].map(id => new Element('span', { id: id + '-error' }));
  const document = documentFixture([form, feedback, ...errorNodes]);
  const requests = [];
  let language = 'en';
  const context = {
    document, console, AbortController, setTimeout, clearTimeout,
    fetch: async (...args) => { requests.push(args); return fetchImplementation(...args); },
    Nortivo: { getLanguage: () => language, translate: key => dictionaries[language][key] },
  };
  context.window = context;
  vm.runInNewContext(contactCode, context, { filename: 'contact.js' });
  return { form, submit, feedback, document, requests,
    setLanguage(value) { language = value; document.dispatchEvent({ type: 'nortivo:language' }); },
  };
}
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('source dictionaries have matching complete Bokmål and English keys', () => {
  for (const copy of [siteCopy, portalCopy]) {
    assert.deepEqual(Object.keys(copy.nb).sort(), Object.keys(copy.en).sort());
    for (const locale of ['nb', 'en']) for (const [key, value] of Object.entries(copy[locale])) {
      assert.equal(typeof value, 'string', key);
      assert.ok(value.trim(), key);
    }
  }
  for (const [file, source] of sources) for (const { attrs } of tags(source)) {
    for (const [attribute, key] of Object.entries(attrs)) {
      if (/^data-i18n(?:-(?:placeholder|aria|aria-label|title|alt))?$/.test(attribute)) {
        for (const locale of ['nb', 'en']) assert.equal(typeof dictionaries[locale][key], 'string', `${file}: ${locale}.${key}`);
      }
    }
  }
});

test('source pages have unique IDs, complete label/ARIA references and safe form defaults', () => {
  for (const [file, source] of sources) {
    const identifiers = ids(source);
    assert.equal(new Set(identifiers).size, identifiers.length, `${file}: duplicate ID`);
    for (const { name, attrs } of tags(source)) {
      for (const attribute of ['for', 'aria-controls', 'aria-describedby', 'aria-labelledby']) {
        for (const target of (attrs[attribute] || '').split(/\s+/).filter(Boolean)) assert.ok(identifiers.includes(target), `${file}: missing ${attribute} target ${target}`);
      }
      if (name === 'form') assert.equal(attrs.method?.toLowerCase(), 'post', `${file}: default GET can expose form values`);
    }
  }
});

test('local navigation links and same-page/cross-page fragments resolve', () => {
  for (const [file, source] of sources) for (const { attrs } of tags(source, 'a')) {
    const href = attrs.href;
    assert.ok(href && href !== '#', `${file}: empty navigation link`);
    const relative = file === 'index.html' ? '/' : '/' + file.replace(/index\.html$/, '');
    const url = new URL(href, 'https://nortivo.no' + relative);
    if (url.origin !== 'https://nortivo.no') continue;
    const normalized = url.pathname.replace(/^\/(nb|en)(?=\/)/, '');
    const target = normalized.endsWith('/') ? normalized.slice(1) + 'index.html' : normalized.slice(1);
    assert.ok(existsSync(path.join(dist, target)), `${file}: missing route ${href}`);
    if (url.hash) assert.ok(ids(read(target)).includes(decodeURIComponent(url.hash.slice(1))), `${file}: missing anchor ${href}`);
  }
});

test('all referenced local assets exist and shipped imagery/fonts have valid file signatures', () => {
  const assets = new Set();
  for (const source of sources.values()) for (const { name, attrs } of tags(source)) {
    for (const key of ['src', 'srcset']) {
      for (const candidate of (attrs[key] || '').split(',')) {
        const target = candidate.trim().split(/\s+/)[0];
        if (target?.startsWith('/assets/')) assets.add(target);
      }
    }
    if (name === 'link' && ['stylesheet', 'icon'].includes(attrs.rel) && attrs.href?.startsWith('/')) assets.add(attrs.href);
  }
  for (const css of ['assets/site.css', 'assets/portal-v2.css']) for (const match of read(css).matchAll(/url\(["']?([^\)"']+)["']?\)/g)) {
    if (match[1].startsWith('/')) assets.add(match[1]);
  }
  for (const asset of assets) {
    const file = path.join(dist, asset.slice(1));
    assert.ok(existsSync(file), `Missing ${asset}`);
    const bytes = readFileSync(file);
    assert.ok(bytes.length > 0, `Empty ${asset}`);
    if (asset.endsWith('.webp')) {
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', asset);
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', asset);
      assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, `${asset}: truncated WebP`);
    }
    if (asset.endsWith('.png')) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset);
    if (asset.endsWith('.svg')) assert.match(bytes.toString(), /<svg\b[^>]*xmlns=/, asset);
    if (asset.endsWith('.ttf')) assert.equal(bytes.readUInt32BE(0), 0x00010000, asset);
    if (asset.endsWith('.js')) assert.doesNotThrow(() => new vm.Script(bytes.toString(), { filename: asset }));
  }
});

test('all source pages load shared UI before their page behavior and keep admin private', () => {
  for (const [file, source] of sources) {
    const scripts = tags(source, 'script');
    assert.equal(scripts[0]?.attrs.src, '/assets/site.js', file);
    assert.ok(scripts.every(script => Object.hasOwn(script.attrs, 'defer')), `${file}: scripts must preserve execution order`);
    const header = source.match(/<header\b[\s\S]*?<\/header>/i)?.[0] || '';
    assert.doesNotMatch(header, /href=["']\/(?:nb\/|en\/)?admin\//i, `${file}: public admin navigation`);
    assert.match(source, /Noah J\.C\. Sæter/, `${file}: founder attribution`);
  }
  assert.match(sources.get('admin/index.html'), /name="robots"\s+content="noindex, nofollow"/);
});

test('language priority is explicit query, explicit route, saved preference, country signal, English', () => {
  const cases = [
    [{ url: 'https://nortivo.no/en/?lang=nb', saved: 'en', country: 'en' }, 'nb'],
    [{ url: 'https://nortivo.no/nb/', saved: 'en', country: 'en' }, 'nb'],
    [{ saved: 'en', country: 'nb' }, 'en'],
    [{ country: 'nb' }, 'nb'],
    [{ country: 'NO' }, 'en'],
    [{ url: 'https://nortivo.no/?lang=invalid', saved: 'invalid' }, 'en'],
    [{ deniedStorage: true, country: 'nb' }, 'nb'],
  ];
  for (const [input, expected] of cases) {
    const { site, document } = loadSite(input);
    assert.equal(site.getLanguage(), expected);
    assert.equal(document.documentElement.lang, expected);
  }
});

test('language changes translate content and attributes, preserve drafts, update links and persist choice', () => {
  const title = new Element('h1', { 'data-i18n': 'test.title' });
  const input = new Element('textarea', { 'data-i18n-placeholder': 'test.placeholder' });
  input.value = 'Synthetic unsent draft æøå';
  const label = new Element('nav', { 'data-i18n-aria': 'test.label' });
  const image = new Element('img', { 'data-i18n-alt': 'test.alt' });
  const local = new Element('a', { href: '/support/?keep=1#form' });
  const external = new Element('a', { href: 'https://example.invalid/support/' });
  const fragment = new Element('a', { href: '#contact' });
  const canonical = new Element('link', { rel: 'canonical', href: 'https://nortivo.no/en/' });
  const nb = new Element('button', { 'data-language': 'nb' });
  const en = new Element('button', { 'data-language': 'en' });
  const fixture = loadSite({ url: 'https://nortivo.no/en/?keep=1#contact', nodes: [title, input, label, image, local, external, fragment, canonical, nb, en] });
  const events = [];
  fixture.document.addEventListener('nortivo:language', event => events.push(event.detail.language));
  fixture.site.register({ nb: { 'test.title': 'Tittel', 'test.placeholder': 'Skriv her', 'test.label': 'Meny', 'test.alt': 'Bilde' }, en: { 'test.title': 'Title', 'test.placeholder': 'Write here', 'test.label': 'Navigation', 'test.alt': 'Image' } });
  fixture.site.setLanguage('nb');
  assert.equal(title.textContent, 'Tittel');
  assert.equal(input.getAttribute('placeholder'), 'Skriv her');
  assert.equal(label.getAttribute('aria-label'), 'Meny');
  assert.equal(image.getAttribute('alt'), 'Bilde');
  assert.equal(input.value, 'Synthetic unsent draft æøå');
  assert.equal(local.getAttribute('href'), '/nb/support/?keep=1#form');
  assert.equal(external.getAttribute('href'), 'https://example.invalid/support/');
  assert.equal(fragment.getAttribute('href'), '#contact');
  assert.equal(canonical.getAttribute('href'), 'https://nortivo.no/nb/');
  assert.equal(nb.getAttribute('aria-pressed'), 'true');
  assert.equal(en.getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.storage.get('nortivo-site-language'), 'nb');
  assert.match(fixture.document.cookie, /nortivo_language=nb; Path=\/;.*SameSite=Lax; Secure/);
  assert.equal(fixture.location.pathname, '/nb/');
  assert.equal(fixture.location.hash, '#contact');
  assert.deepEqual(events, ['nb']);
  fixture.site.setLanguage('xx');
  assert.equal(fixture.site.getLanguage(), 'nb');
});

test('embedded shared dictionary matches the canonical copy in both languages', () => {
  const { site } = loadSite();
  for (const locale of ['nb', 'en']) {
    site.setLanguage(locale);
    for (const [key, value] of Object.entries(siteCopy[locale])) assert.equal(site.translate(key), value, locale + '.' + key);
  }
});

test('mobile navigation exposes state and Escape closes it while restoring focus', async () => {
  const toggle = new Element('button', { class: 'menu-toggle', 'aria-expanded': 'false' });
  const menu = new Element('nav', { class: 'mobile-nav' });
  menu.hidden = true;
  const { document } = loadSite({ nodes: [toggle, menu] });
  await toggle.emit('click');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(menu.hidden, false);
  await document.emit('keydown', { key: 'Escape' });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.hidden, true);
  assert.equal(toggle.focused, true);
});

test('contact validation prevents requests and focuses the first invalid field', async () => {
  const fixture = loadContact(() => { throw new Error('Must not fetch invalid forms'); });
  fixture.form.elements.name.value = '';
  fixture.form.elements.email.validity.valid = false;
  fixture.form.elements.message.value = 'short';
  await fixture.form.emit('submit');
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.form.elements.name.focused, true);
  assert.equal(fixture.form.elements.email.getAttribute('aria-invalid'), 'true');
  assert.match(fixture.feedback.textContent, /highlighted/);
});

test('contact does not show success for failed, malformed or network responses and keeps the draft', async t => {
  const failures = [
    ['HTTP failure', () => response({ ticket: { ticket_number: 'NT-2026-TEST42' } }, 503)],
    ['missing saved ticket', () => response({ ok: true })],
    ['invalid JSON', () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } })],
    ['network failure', () => { throw new Error('Synthetic network error'); }],
  ];
  for (const [name, implementation] of failures) await t.test(name, async () => {
    const fixture = loadContact(implementation);
    const draft = fixture.form.elements.message.value;
    await fixture.form.emit('submit');
    assert.match(fixture.feedback.textContent, /could not be sent/);
    assert.doesNotMatch(fixture.feedback.textContent, /has been received/);
    assert.equal(fixture.form.elements.message.value, draft);
    assert.equal(fixture.submit.disabled, false);
  });
});

test('contact sends a real JSON POST once, waits for saved ticket and localizes success without losing draft', async () => {
  let resolveRequest;
  const fixture = loadContact(() => new Promise(resolve => { resolveRequest = resolve; }));
  const first = fixture.form.emit('submit');
  await fixture.form.emit('submit');
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.submit.disabled, true);
  assert.doesNotMatch(fixture.feedback.textContent, /has been received/);
  const [endpoint, options] = fixture.requests[0];
  assert.equal(endpoint, '/.netlify/functions/tickets');
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.headers['Content-Type'], 'application/json');
  const payload = JSON.parse(options.body);
  assert.equal(payload.email, 'synthetic@example.invalid');
  assert.equal(payload.language, 'en');
  assert.match(payload.subject, /Project enquiry/);
  resolveRequest(response({ ticket: { ticket_number: 'NT-2026-TEST42' }, confirmationSent: true }, 201));
  await first;
  assert.match(fixture.feedback.textContent, /has been received/);
  assert.match(fixture.feedback.textContent, /NT-2026-TEST42/);
  const draft = fixture.form.elements.message.value;
  fixture.setLanguage('nb');
  assert.match(fixture.feedback.textContent, /mottatt/);
  assert.equal(fixture.form.elements.message.value, draft);
  assert.equal(fixture.feedback.querySelector('a').href, '/nb/support/');
  await fixture.form.emit('submit');
  assert.equal(fixture.requests.length, 1, 'A saved ticket must not be sent twice without editing');
});

test('saved contact tickets honestly report confirmation-email delivery failure', async () => {
  const fixture = loadContact(() => response({ ticket: { ticket_number: 'NT-2026-TEST42' }, confirmationSent: false }, 201));
  await fixture.form.emit('submit');
  assert.match(fixture.feedback.textContent, /saved.*confirmation email could not be sent/);
  assert.match(fixture.feedback.textContent, /NT-2026-TEST42/);
  assert.equal(fixture.submit.disabled, true);
});
