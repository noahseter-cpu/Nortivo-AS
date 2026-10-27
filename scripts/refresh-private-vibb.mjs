import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { packagePrivateWorkspace } from './package-private-workspace.mjs';
import { buildPrivateVibbApp } from './build-private-vibb-app.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = '/admin/projects/vibb/';
const defaultSource = 'C:/Users/noahn/Documents/ChatGPT/tobias/output/vibb-kurs/interaktiv/dist/server/index.js';

export async function refreshPrivateVibb(sourcePath = defaultSource) {
  const source = await readFile(sourcePath, 'utf8');
  const start = source.indexOf('\nconst assets=');
  const end = source.indexOf(';\nconst catalog=', start);
  if (start < 0 || end < 0 || !source.endsWith('export default createWorker(assets,catalog);\n')) throw new Error('Unsupported compiled Vibb Worker. Rebuild the source project first.');
  const assets = JSON.parse(source.slice(start + '\nconst assets='.length, end));
  for (const name of ['/index.html', '/tutor.js']) if (!assets[name]?.body) throw new Error(`Missing required course asset: ${name}`);
  const practice = await buildPrivateVibbApp(assets);
  Object.assign(assets, practice.assets);
  for (const name of ['workspace.html', 'workspace.css', 'workspace.js', 'course-preview.css', 'course-preview.js']) {
    const type = name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript';
    assets['/' + name] = { type: type + '; charset=utf-8', body: (await readFile(path.join(root, 'scripts/private-vibb-ui', name))).toString('base64') };
  }
  const transform = (name, operation) => {
    assets[name].body = Buffer.from(operation(Buffer.from(assets[name].body, 'base64').toString('utf8'))).toString('base64');
  };
  transform('/index.html', html => html.replace(/<head>/i, `<head>\n<base href="${prefix}">\n<meta name="robots" content="noindex, nofollow">\n<link rel="stylesheet" href="${prefix}admin-return.css">`)
    .replace('</head>', '<link rel="stylesheet" href="course-preview.css"></head>')
    .replace('</body>', '<script src="course-preview.js"></script></body>')
    .replace(/<body([^>]*)>/i, `<body$1><a class="admin-return" href="/admin/">Tilbake til admin / Back to admin</a>`));
  transform('/tutor.js', js => js.replaceAll('/api/tutor', prefix + 'api/tutor')
    .replaceAll('/signin-with-chatgpt?return_to=%2F%23assistant', '/admin/?return=vibb')
    .replaceAll('Logg inn med ChatGPT', 'Logg inn hos Nortivo'));
  // Other absolute course assets stay under the authenticated prefix too.
  for (const [name, asset] of Object.entries(assets)) {
    if (!name.startsWith('/app/') && /\.(?:html|css|js)$/.test(name)) transform(name, text => text
      .replace(/(["'(])\/(fonts|moods)\//g, `$1${prefix}$2/`));
  }
  assets['/admin-return.css'] = {
    type: 'text/css; charset=utf-8',
    body: Buffer.from('.admin-return{display:block;padding:10px 20px;background:#07131f;color:#d8e9ff;font:600 13px/1.5 Manrope,sans-serif;text-decoration:underline;text-underline-offset:3px}.admin-return:focus-visible{outline:3px solid #98ceff;outline-offset:-4px}').toString('base64'),
  };
  // Replace legacy recovery links returned by the Worker as well as the client.
  const runtime = (source.slice(0, start) + '\nconst assets=' + JSON.stringify(assets) + source.slice(end))
    .replaceAll('/signin-with-chatgpt?return_to=%2F%23assistant', '/admin/?return=vibb');
  if (/\bgsk_[A-Za-z0-9]{16,}|\bsk-proj-[A-Za-z0-9_-]{16,}/.test(runtime)) throw new Error('Credential-shaped text found. Private snapshot was not written.');
  const destination = path.join(root, 'netlify/private/vibb-runtime.mjs');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, '// Private Vibb build. Refresh with scripts/refresh-private-vibb.mjs; never copy to dist.\n' + runtime, 'utf8');
  const metadata = {
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    runtimeSha256: crypto.createHash('sha256').update(runtime).digest('hex'),
    assets: Object.keys(assets).length,
    basePath: prefix,
    practiceVersion: practice.version,
    practiceSourceSha256: practice.sourceHash,
  };
  await writeFile(path.join(root, 'docs/PRIVATE_VIBB_SNAPSHOT.json'), JSON.stringify(metadata, null, 2) + '\n');
  await packagePrivateWorkspace();
  return { refreshed: true, encrypted: true, localKeyFileExists: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(await refreshPrivateVibb(process.argv[2] || defaultSource));
}
