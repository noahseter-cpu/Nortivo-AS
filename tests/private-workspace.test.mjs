import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminSession } from '../netlify/functions/_utils.mjs';
import { handler as realCatalog, createHandler as createCatalog } from '../netlify/functions/admin-projects.mjs';
import { handler as realCourse, createHandler } from '../netlify/functions/admin-vibb.mjs';
import { createPrivateContentLoader, validatePrivateContent } from '../netlify/private/content-loader.mjs';
import { decryptContent, encryptContent } from '../netlify/private/content-crypto.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.ADMIN_SESSION_SECRET = 'synthetic-private-admin-secret-for-tests-only';
process.env.URL = 'https://nortivo.no';
delete process.env.DEPLOY_PRIME_URL;
delete process.env.DEPLOY_URL;
delete process.env.GROQ_API_KEY;
const syntheticKey = crypto.randomBytes(32).toString('base64');
process.env.NORTIVO_PRIVATE_CONTENT_KEY = syntheticKey;
const syntheticProjects = ['synthetic-course', 'synthetic-external'].map((id, index) => ({
  id, external: index === 1, href: index ? 'https://example.invalid/app' : '/admin/projects/vibb/',
  ...Object.fromEntries(['name', 'description', 'action', 'note'].map(field => [field, { nb: 'Syntetisk ' + field, en: 'Synthetic ' + field }])),
}));
const syntheticWorker = `export default { async fetch(request,env) {
  const path = new URL(request.url).pathname;
  const headers = {'Content-Type':'application/json'};
  if(path==='/api/tutor/status') return new Response(JSON.stringify({allowed:true,signedIn:true,configured:!!env.GROQ_API_KEY,signInPath:'/admin/?return=vibb'}),{headers});
  if(path==='/api/tutor') return new Response(JSON.stringify({error:'Groq is not configured in this synthetic test.'}),{status:503,headers});
  if(path==='/fonts/manrope-0.ttf') return new Response(request.method==='HEAD'?null:Uint8Array.from([0,1,0,0]),{headers:{'Content-Type':'font/ttf'}});
  if(path==='/tutor.js') return new Response("fetch('/admin/projects/vibb/api/tutor');",{headers:{'Content-Type':'text/javascript'}});
  return new Response('<base href="/admin/projects/vibb/"><a href="/admin/">Back to admin</a>',{headers:{'Content-Type':'text/html'}});
} };`;
const syntheticPackage = { version: 1, projects: syntheticProjects, workerSource: syntheticWorker };
const syntheticEnvelope = encryptContent(syntheticPackage, syntheticKey);
const loader = createPrivateContentLoader(syntheticEnvelope);
const catalog = createCatalog({ loadProjects: loader.projects });
const course = createHandler({ loadWorker: loader.worker });
const cookie = token => 'nortivo_admin=' + token;
const signed = () => cookie(createAdminSession());
const event = (pathname = '/admin/projects/vibb/', extra = {}) => ({
  path: pathname, rawUrl: 'https://nortivo.no' + pathname, httpMethod: 'GET', headers: {}, ...extra,
});
const decoded = result => result.isBase64Encoded ? Buffer.from(result.body, 'base64').toString('utf8') : result.body;
const withCookie = (pathname, token = signed(), extra = {}) => event(pathname, { ...extra, headers: { cookie: token, ...extra.headers } });
const expiredPayload = Buffer.from(JSON.stringify({ exp: Date.now() - 1000 })).toString('base64url');
const expired = cookie(expiredPayload + '.' + crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(expiredPayload).digest('base64url'));

test('catalog requires existing valid admin proof and rejects forged identity headers', async () => {
  for (const token of ['', 'nortivo_admin=fake.sig', expired]) {
    const response = await catalog(withCookie('/.netlify/functions/admin-projects', token, { headers: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'owner@example.invalid' } }));
    assert.equal(response.statusCode, 401);
    assert.doesNotMatch(response.body, /Vibb|practice room|noah-hverdag/);
  }
  const response = await catalog(withCookie('/.netlify/functions/admin-projects'));
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  const projects = JSON.parse(response.body).projects;
  assert.deepEqual(projects.map(item => item.id), ['synthetic-course', 'synthetic-external']);
  assert.equal(projects[1].href, 'https://example.invalid/app');
  assert.ok(projects.every(item => item.name.nb && item.name.en));
});

test('unsigned, forged and expired sessions cannot import private source or call its tutor', async () => {
  let calls = 0;
  const wrapper = createHandler({ loadWorker: () => { calls++; throw new Error('Must not load'); } });
  for (const token of ['', 'nortivo_admin=forged.sig', expired]) {
    for (const route of ['/', '/course-data.js', '/fonts/manrope-0.ttf', '/api/tutor/status', '/api/tutor']) {
      const response = await wrapper(withCookie('/admin/projects/vibb' + route, token, { httpMethod: route === '/api/tutor' ? 'POST' : 'GET', headers: { origin: 'https://nortivo.no', 'oai-authenticated-user-id': 'owner' } }));
      assert.equal(response.statusCode, route === '/' ? 302 : 401);
      assert.doesNotMatch(response.body, /VIBB_COURSE|MoodSummary|sourceVersion/);
      assert.match(response.headers['Cache-Control'], /no-store/);
    }
  }
  assert.equal(calls, 0);
});

test('valid admin can load encrypted synthetic HTML, JS, and binary fonts under private prefix', async () => {
  const index = await course(withCookie('/admin/projects/vibb/'));
  assert.equal(index.statusCode, 200);
  assert.match(decoded(index), /<base href="\/admin\/projects\/vibb\/">/);
  assert.match(decoded(index), /Back to admin/);
  assert.match(index.headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  const js = await course(withCookie('/admin/projects/vibb/tutor.js'));
  assert.match(decoded(js), /fetch\('\/admin\/projects\/vibb\/api\/tutor/);
  assert.doesNotMatch(decoded(js), /fetch\('\/api\/tutor|signin-with-chatgpt|Logg inn med ChatGPT/);
  const font = await course(withCookie('/admin/projects/vibb/fonts/manrope-0.ttf'));
  assert.equal(font.statusCode, 200);
  assert.equal(font.isBase64Encoded, true);
  assert.equal(Buffer.from(font.body, 'base64').readUInt32BE(0), 0x00010000);
  const head = await course(withCookie('/admin/projects/vibb/fonts/manrope-0.ttf', signed(), { httpMethod: 'HEAD' }));
  assert.equal(head.statusCode, 200);
  assert.equal(head.body, '');
});

test('valid admin status is authenticated and missing Groq is reported honestly', async () => {
  const response = await course(withCookie('/admin/projects/vibb/api/tutor/status'));
  assert.equal(response.statusCode, 200);
  const status = JSON.parse(decoded(response));
  assert.equal(status.allowed, true);
  assert.equal(status.signedIn, true);
  assert.equal(status.configured, false);
  assert.equal(status.signInPath, '/admin/?return=vibb');
  const tutor = await course(withCookie('/admin/projects/vibb/api/tutor', signed(), { httpMethod: 'POST', headers: { origin: 'https://nortivo.no', 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(tutor.statusCode, 503);
  assert.match(decoded(tutor), /Groq/);
});

test('wrapper injects internal identity only after auth and never forwards incoming identities or cookies', async () => {
  const wrapper = createHandler({ loadWorker: async () => ({ default: { fetch: async (request, env) => {
    assert.equal(request.headers.get('oai-authenticated-user-id'), 'nortivo-admin');
    assert.equal(request.headers.get('oai-authenticated-user-email'), env.VIBB_OWNER_EMAIL);
    assert.equal(request.headers.get('cookie'), null);
    assert.equal(request.headers.get('authorization'), null);
    assert.equal(new URL(request.url).pathname, '/api/tutor');
    assert.equal(request.headers.get('origin'), new URL(request.url).origin);
    return new Response('test', { status: 201 });
  } } }) });
  const response = await wrapper(withCookie('/.netlify/functions/admin-vibb/api/tutor', signed(), { httpMethod: 'POST', headers: { origin: 'https://nortivo.no', 'content-type': 'application/json', 'oai-authenticated-user-email': 'forged@example.invalid', authorization: 'forged' }, body: '{}' }));
  assert.equal(response.statusCode, 201);
});

test('traversal, arbitrary targets, unsupported methods and cross-origin requests never load runtime', async () => {
  let loads = 0;
  const wrapper = createHandler({ loadWorker: () => { loads++; throw new Error('Must not load'); } });
  for (const suffix of ['/../index.html', '/%2e%2e/index.html', '/%252e%252e/index.html', '/%2f%2fevil.invalid', '/https:%2f%2fevil.invalid', '/%5c..%5csecret', '/.env']) {
    const response = await wrapper(withCookie('/admin/projects/vibb' + suffix));
    assert.equal(response.statusCode, 404, suffix);
  }
  for (const headers of [{ origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await wrapper(withCookie('/admin/projects/vibb/course-data.js', signed(), { headers }))).statusCode, 403);
    assert.equal((await catalog(withCookie('/.netlify/functions/admin-projects', signed(), { headers }))).statusCode, 403);
  }
  assert.equal((await wrapper(withCookie('/admin/projects/vibb/api/tutor', signed(), { httpMethod: 'POST', body: '{}' }))).statusCode, 403);
  assert.equal((await wrapper(withCookie('/admin/projects/vibb/index.html', signed(), { httpMethod: 'POST', headers: { origin: 'https://nortivo.no' } }))).statusCode, 405);
  assert.equal((await wrapper(withCookie('/admin/projects/vibb/api/tutor', signed(), { httpMethod: 'POST', headers: { origin: 'https://nortivo.no' }, body: 'a'.repeat(24001) }))).statusCode, 413);
  assert.equal(loads, 0);
});

test('private package decrypts, rejects wrong keys and detects authenticated ciphertext tampering', async () => {
  assert.deepEqual(decryptContent(syntheticEnvelope, syntheticKey), syntheticPackage);
  assert.throws(() => decryptContent(syntheticEnvelope, undefined), /Private content unavailable/);
  assert.throws(() => decryptContent(syntheticEnvelope, crypto.randomBytes(32).toString('base64')), /Private content unavailable/);
  const bytes = Buffer.from(syntheticEnvelope.ciphertext, 'base64'); bytes[3] ^= 1;
  assert.throws(() => decryptContent({ ...syntheticEnvelope, ciphertext: bytes.toString('base64') }, syntheticKey), /Private content unavailable/);
  assert.throws(() => validatePrivateContent({ ...syntheticPackage, workerSource: 'import x from "node:fs"; export default x;' }), /Private content unavailable/);
  assert.throws(() => validatePrivateContent({ ...syntheticPackage, workerSource: 'export default import("node:fs");' }), /Private content unavailable/);
});

test('missing or changed keys fail closed even after cached success, without affecting admin proof', async () => {
  await loader.projects();
  try {
    for (const key of [undefined, crypto.randomBytes(32).toString('base64')]) {
      if (key) process.env.NORTIVO_PRIVATE_CONTENT_KEY = key; else delete process.env.NORTIVO_PRIVATE_CONTENT_KEY;
      for (const handler of [catalog, realCatalog, course, realCourse]) {
        const pathname = handler === catalog || handler === realCatalog ? '/.netlify/functions/admin-projects' : '/admin/projects/vibb/';
        const result = await handler(withCookie(pathname));
        assert.equal(result.statusCode, 503);
        assert.doesNotMatch(result.body, /decrypt|cipher|authentication tag|NORTIVO_PRIVATE_CONTENT_KEY|sourceVersion/);
      }
      assert.equal((await realCatalog(event('/.netlify/functions/admin-projects'))).statusCode, 401);
    }
  } finally { process.env.NORTIVO_PRIVATE_CONTENT_KEY = syntheticKey; }
  assert.equal((await catalog(withCookie('/.netlify/functions/admin-projects'))).statusCode, 200);
});

test('Git publication candidates exclude plaintext registry, runtime and local key; public bundles have no private source', () => {
  const candidates = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/);
  for (const file of ['netlify/private/vibb-runtime.mjs', 'netlify/private/projects.mjs', '.env.private-workspace.local']) assert.ok(!candidates.includes(file), file);
  assert.ok(candidates.includes('netlify/private/encrypted-content.mjs'));
  assert.equal(existsSync(path.join(root, 'netlify/functions/_vibb-runtime.mjs')), false);
  assert.equal(existsSync(path.join(root, 'netlify/functions/_private-projects.mjs')), false);
  for (const handler of ['admin-vibb', 'admin-projects']) assert.doesNotMatch(readFileSync(path.join(root, 'netlify/functions/' + handler + '.mjs'), 'utf8'), /from ['"]\.\.\/private\/(?:vibb-runtime|projects)\.mjs|import\(['"]\.\.\/private\/(?:vibb-runtime|projects)\.mjs/);
  const ciphertext = readFileSync(path.join(root, 'netlify/private/encrypted-content.mjs'), 'utf8');
  assert.doesNotMatch(ciphertext, /VIBB_COURSE|MoodSummary|sourceVersion|workerSource|learner|NORTIVO_PRIVATE_CONTENT_KEY=/);
  const walk = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)]);
  for (const file of walk(path.join(root, 'dist')).filter(file => /\.(?:js|json|html)$/.test(file))) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /VIBB_COURSE|VIBB_OWNER_EMAIL|private-course\.invalid|nortivo-admin@private\.invalid|\/admin\/projects\/vibb\//, path.relative(root, file));
  }
});
