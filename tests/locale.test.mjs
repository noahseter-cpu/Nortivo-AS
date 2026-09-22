import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { buildLocales, renderLocale, pages } from '../scripts/build-locales.mjs';
import { previewResponse } from '../scripts/serve.mjs';

// Netlify documents .js edge modules; importing as a data module avoids requiring package.json.
const edgeSource = await readFile(new URL('../netlify/edge-functions/language.js', import.meta.url), 'utf8');
const { default: redirect, config } = await import(`data:text/javascript;base64,${Buffer.from(edgeSource).toString('base64')}`);

const copy = {
  title: 'Trygt <innhold> & tekst', placeholder: 'Skriv "her" & mer', label: 'Norsk meny', hint: 'Se mer',
  nested: 'Do not destroy child markup', child: 'Barn',
};
for (const page of pages) {
  copy[`meta.${page}.title`] = `Norsk ${page} & Nortivo`;
  copy[`meta.${page}.description`] = `Beskrivelse av ${page} <uten HTML>`;
}
const fixtureHtml = `<!doctype html><html lang="en"><head><title>Old title</title><meta name="description" content="Old"/><meta property="og:title" content="Old"/><link rel="canonical" href="https://old.invalid/"/><link rel="alternate" hreflang="de" href="https://old.invalid/de/"/><link rel="stylesheet" href="/assets/site.css"/><script>const literal = '<title>Keep this</title><meta name="description" content="inside script">';</script></head><body><h1 data-i18n="title">English heading</h1><a href="/products/?ref=test&amp;mode=one#details">Products</a><a href="/#contact">Contact</a><a href="#local">Local</a><a href="/en/products/">Explicit English</a><a href="https://elsewhere.invalid/products/">External</a><img src="/assets/image.webp" alt="Image"/><div data-i18n="nested"><strong data-i18n="child">Child</strong><em>Keep markup</em></div><input value="customer &amp; message" data-i18n="title" placeholder="Placeholder" data-i18n-placeholder="placeholder"/><textarea data-i18n="title">Customer text &amp; text</textarea><div contenteditable="true" data-i18n="title">Editable text</div><nav aria-label="Menu" data-i18n-aria="label"></nav><button title="More" data-i18n-title="hint" data-i18n-aria-label="label">Button</button><button data-language="nb">NO</button><script src="/assets/site.js"></script></body></html>`;

async function fixture(t) {
  const base = path.resolve(tmpdir());
  const root = await mkdtemp(path.join(base, 'nortivo-locale-test-'));
  // Cleanup is restricted to the exact fresh test directory, never the repository.
  t.after(async () => {
    assert.equal(path.dirname(root), base);
    assert.ok(path.basename(root).startsWith('nortivo-locale-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const dist = path.join(root, 'dist');
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  await writeFile(path.join(dist, 'assets/site-copy.json'), JSON.stringify({ nb: copy, en: copy }));
  await writeFile(path.join(dist, 'assets/portal-copy.json'), JSON.stringify({ nb: { child: 'Portal barn' }, en: { child: 'Portal child' } }));
  for (const page of pages) {
    const file = path.join(dist, page === 'home' ? 'index.html' : `${page}/index.html`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, fixtureHtml);
  }
  return { root, dist };
}

test('locale build escapes text/attributes and preserves markup, scripts and form values', () => {
  const rendered = renderLocale(fixtureHtml, copy, 'nb', 'home');
  assert.match(rendered, /<html lang="nb">/);
  assert.match(rendered, /<h1 data-i18n="title">Trygt &lt;innhold&gt; &amp; tekst<\/h1>/);
  assert.match(rendered, /placeholder="Skriv &quot;her&quot; &amp; mer"/);
  assert.match(rendered, /value="customer &amp; message"/);
  assert.match(rendered, /<textarea data-i18n="title">Customer text &amp; text<\/textarea>/);
  assert.match(rendered, />Editable text<\/div>/);
  assert.match(rendered, /<strong data-i18n="child">Barn<\/strong><em>Keep markup<\/em>/);
  assert.ok(rendered.includes("const literal = '<title>Keep this</title><meta name=\"description\" content=\"inside script\">';"));
  assert.match(rendered, /<nav aria-label="Norsk meny"/);
  assert.match(rendered, /title="Se mer"[^>]+aria-label="Norsk meny"/);
  assert.match(rendered, /data-language="nb" aria-pressed="true"/);
});

test('locale build rewrites only legacy public links and keeps shared assets', () => {
  const rendered = renderLocale(fixtureHtml, copy, 'nb', 'products');
  assert.match(rendered, /href="\/nb\/products\/\?ref=test&amp;mode=one#details"/);
  assert.match(rendered, /href="\/nb\/#contact"/);
  for (const preserved of ['href="#local"', 'href="/en/products/"', 'href="https://elsewhere.invalid/products/"', 'src="/assets/image.webp"', 'src="/assets/site.js"', 'href="/assets/site.css"']) assert.ok(rendered.includes(preserved));
});

test('localized metadata has canonical, hreflang and correct noindex rules', () => {
  for (const page of pages) {
    const rendered = renderLocale(fixtureHtml, copy, 'nb', page);
    const route = page === 'home' ? '/' : `/${page}/`;
    assert.ok(rendered.includes(`<link rel="canonical" href="https://nortivo.no/nb${route}"`));
    for (const locale of ['nb', 'en']) assert.ok(rendered.includes(`hreflang="${locale}" href="https://nortivo.no/${locale}${route}"`));
    assert.ok(rendered.includes(`hreflang="x-default" href="https://nortivo.no${route}"`));
    assert.equal((rendered.match(/rel="canonical"/g) || []).length, 1);
    assert.ok(!rendered.includes('https://old.invalid'));
    assert.ok(rendered.includes(`content="Norsk ${page} &amp; Nortivo"`));
    assert.ok(rendered.includes('content="nb_NO"'));
    assert.equal(rendered.includes('name="robots" content="noindex, nofollow"'), ['support', 'admin'].includes(page));
  }
});

test('build creates all ten pages, merges portal keys, and does not duplicate assets or modify sources', async t => {
  const { dist } = await fixture(t);
  const outputs = await buildLocales({ distDir: dist });
  assert.equal(outputs.length, 10);
  assert.equal(await readFile(path.join(dist, 'index.html'), 'utf8'), fixtureHtml);
  const support = await readFile(path.join(dist, 'nb/support/index.html'), 'utf8');
  assert.match(support, /Portal barn/);
  assert.deepEqual((await readdir(path.join(dist, 'nb'))).sort(), ['admin', 'index.html', 'privacy', 'products', 'support']);
});

test('missing translations fail before any generated files are written', async t => {
  const { dist } = await fixture(t);
  await writeFile(path.join(dist, 'privacy/index.html'), fixtureHtml.replace('data-i18n="title"', 'data-i18n="missing.key"'));
  await assert.rejects(buildLocales({ distDir: dist }), /Missing nb translations in privacy: missing.key/);
  assert.ok(!(await readdir(dist)).includes('nb'));
});

test('edge selects explicit choice before cookie and country and persists only explicit choice', () => {
  const request = new Request('https://nortivo.no/products/?lang=en&ref=campaign', { headers: { Cookie: 'nortivo_language=nb' } });
  const result = redirect(request, { geo: { country: { code: 'NO' } } });
  assert.equal(result.status, 307);
  assert.equal(result.headers.get('Location'), 'https://nortivo.no/en/products/?ref=campaign');
  assert.match(result.headers.get('Set-Cookie'), /nortivo_language=en;.*SameSite=Lax; Secure/);
  const saved = redirect(new Request('https://nortivo.no/', { headers: { Cookie: 'nortivo_language=en' } }), { geo: { country: { code: 'NO' } } });
  assert.equal(saved.headers.get('Location'), 'https://nortivo.no/en/');
  assert.equal(saved.headers.get('Set-Cookie'), null);
});

test('edge uses Norway only without valid choice and defaults unknown countries to English', () => {
  const cases = [
    [{ geo: { country: { code: 'NO' } } }, 'nb'], [{ geo: { country: { code: 'SE' } } }, 'en'],
    [{}, 'en'], [{ geo: {} }, 'en'], [{ geo: { country: null } }, 'en'],
  ];
  for (const [context, expected] of cases) {
    const result = redirect(new Request('https://nortivo.no/support/?lang=invalid', { headers: { Cookie: 'nortivo_language=%ZZ' } }), context);
    assert.equal(result.headers.get('Location'), `https://nortivo.no/${expected}/support/`);
  }
});

test('edge has no shared caching, preserves other queries, and operates only on exact legacy GET/HEAD routes', () => {
  const result = redirect(new Request('https://nortivo.no/privacy/?one=a%20b&lang=nb&one=c', { method: 'HEAD' }));
  assert.equal(result.status, 307);
  const destination = new URL(result.headers.get('Location'));
  assert.deepEqual(destination.searchParams.getAll('one'), ['a b', 'c']);
  assert.equal(destination.searchParams.has('lang'), false);
  assert.equal(destination.hash, ''); // Real HTTP requests do not carry browser fragments.
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(result.headers.get('CDN-Cache-Control'), 'no-store');
  assert.equal(result.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
  assert.equal(result.headers.get('Vary'), 'Cookie');
  assert.equal(redirect(new Request('https://nortivo.no/support/', { method: 'POST' })), undefined);
  for (const route of ['/nb/', '/en/products/', '/assets/site.js', '/.netlify/functions/tickets', '/missing/', '/products']) assert.equal(redirect(new Request(`https://nortivo.no${route}`)), undefined);
  assert.deepEqual(config.path, ['/', '/products/', '/support/', '/admin/', '/privacy/']);
  assert.equal(config.cache, undefined);
  assert.equal(config.method, undefined, 'Do not emit unsupported HEAD in the Netlify manifest method filter');
});

test('local preview serves source/localized pages, MIME types, HEAD, robots and real 404s without redirect', async t => {
  const { dist } = await fixture(t);
  await buildLocales({ distDir: dist });
  await writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /admin/\n');
  await writeFile(path.join(dist, 'assets/site.css'), 'body { color: white; }');
  await writeFile(path.join(dist, '404.html'), '<h1>Page missing</h1>');
  for (const route of ['/', '/products', '/products/', '/nb/', '/en/support/', '/nb/privacy/']) {
    const result = await previewResponse({ url: route }, dist);
    assert.equal(result.status, 200);
    assert.equal(result.headers.Location, undefined);
    assert.equal(result.headers['Content-Type'], 'text/html; charset=utf-8');
  }
  const head = await previewResponse({ url: '/nb/admin/', method: 'HEAD' }, dist);
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.ok(Number(head.headers['Content-Length']) > 0);
  assert.equal(head.headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal((await previewResponse({ url: '/robots.txt' }, dist)).headers['Content-Type'], 'text/plain; charset=utf-8');
  assert.equal((await previewResponse({ url: '/assets/site.css' }, dist)).headers['Content-Type'], 'text/css; charset=utf-8');
  const missing = await previewResponse({ url: '/nb/not-a-route' }, dist);
  assert.equal(missing.status, 404);
  assert.match(missing.body.toString(), /Page missing/);
});

test('local support is an honest unavailable response and cannot perform writes', async t => {
  const { dist } = await fixture(t);
  for (const method of ['POST', 'GET', 'PATCH']) {
    const result = await previewResponse({ url: '/.netlify/functions/tickets', method }, dist);
    assert.equal(result.status, 503);
    assert.equal(JSON.parse(result.body).code, 'LOCAL_PREVIEW');
    assert.match(JSON.parse(result.body).error, /No ticket was created and no email was sent/);
  }
  assert.equal((await previewResponse({ url: '/support/', method: 'POST' }, dist)).status, 405);
});

test('local preview denies traversal, encoded traversal, Windows paths and linked directories outside dist', async t => {
  const { root, dist } = await fixture(t);
  for (const url of ['/../private.txt', '/%2e%2e/private.txt', '/%2e%2e%5cprivate.txt', '/C:/private.txt', '/%00', '/.env', '//../private.txt']) assert.equal((await previewResponse({ url }, dist)).status, 404);
  assert.equal((await previewResponse({ url: '/%ZZ' }, dist)).status, 400);
  const outside = path.join(root, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'secret.txt'), 'Must not be served');
  await symlink(outside, path.join(dist, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await previewResponse({ url: '/escape/secret.txt' }, dist);
  assert.equal(result.status, 404);
  assert.ok(!result.body.toString().includes('Must not be served'));
});
