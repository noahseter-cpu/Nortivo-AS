import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const appBase = '/admin/projects/vibb/app';
const defaultDependencies = 'C:/Users/noahn/Documents/ChatGPT/tobias/output/vibb-kurs/ovingsprosjekt/node_modules';

// Compile the exact source catalog the learner reads, without editing the school project.
export async function buildPrivateVibbApp(courseAssets, dependencyRoot = defaultDependencies) {
  const context = vm.createContext({ window: {} });
  for (const name of ['course-data.js', 'course-setup.js']) {
    const file = courseAssets['/' + name];
    if (!file) throw new Error('The course source catalog is missing.');
    vm.runInContext(Buffer.from(file.body, 'base64').toString('utf8'), context);
  }
  const course = context.window.VIBB_COURSE;
  const sources = course.sources;
  const packageInfo = JSON.parse(sources['package.json']);
  for (const name of ['react', 'react-dom', 'react-router', 'vite']) {
    const installed = JSON.parse(await readFile(path.join(dependencyRoot, name, 'package.json'), 'utf8'));
    const expected = packageInfo.dependencies?.[name] || packageInfo.devDependencies?.[name];
    if (installed.version !== expected) throw new Error('The preview dependency version differs from the course: ' + name);
  }
  const temporaryParent = path.join(root, '.netlify');
  await mkdir(temporaryParent, { recursive: true });
  const temporary = await mkdtemp(path.join(temporaryParent, 'vibb-practice-'));
  const output = path.join(temporary, 'build');
  for (const [name, original] of Object.entries(sources)) {
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.split('/').includes('..')) throw new Error('Invalid source path.');
    if (!/\.(jsx|js|css)$/.test(name) && name !== 'index.html') continue;
    if (name.startsWith('tests/')) continue;
    const target = path.join(temporary, name === 'index.html' ? name : 'src/' + name);
    let text = original;
    if (name === 'main.jsx') {
      if (text.split('<BrowserRouter>').length !== 2) throw new Error('Unsupported React Router entry point.');
      text = text.replace('<BrowserRouter>', '<BrowserRouter basename="' + appBase + '">');
    }
    if (name === 'moods.js') text = text.replaceAll("'/moods/", "'" + appBase + '/moods/');
    if (name === 'storage/browserStorage.js') {
      if (!text.includes("const storageKey = 'vibb-mvp2-entries'")) throw new Error('Unsupported practice storage key.');
      text = text.replace("const storageKey = 'vibb-mvp2-entries'", "const storageKey = 'vibb-nortivo-practice-v1'");
    }
    if (name === 'index.html') {
      text = text.replace('href="/moods/good.svg"', 'href="' + appBase + '/moods/good.svg"');
      text = text.replace('</head>', '<link rel="stylesheet" href="' + appBase + '/practice-note.css"></head>');
      text = text.replace('<body>', '<body><p class="practice-copy-note">Øvingskopi · egne øvingsdata</p>');
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
  }
  await writeFile(path.join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  const { build } = await import(pathToFileURL(path.join(dependencyRoot, 'vite/dist/node/index.js')).href);
  await build({
    root: temporary, configFile: false, base: appBase + '/', publicDir: false, logLevel: 'error',
    esbuild: { jsx: 'automatic' },
    resolve: { alias: ['react-dom', 'react-router', 'react'].map(name => ({ find: name, replacement: path.join(dependencyRoot, name) })) },
    build: { outDir: output, emptyOutDir: false, sourcemap: false, assetsInlineLimit: 0 },
  });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
  const assets = {};
  async function collect(folder, relative = '') {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory()) await collect(path.join(folder, item.name), name);
      else {
        const type = types[path.extname(name)];
        if (!type) throw new Error('Unsupported preview build asset.');
        assets['/app/' + name] = { type, body: (await readFile(path.join(folder, item.name))).toString('base64') };
      }
    }
  }
  await collect(output);
  for (const [name, asset] of Object.entries(courseAssets)) if (name.startsWith('/moods/')) assets['/app' + name] = asset;
  assets['/app/practice-note.css'] = { type: types['.css'], body: Buffer.from('.practice-copy-note{font:12px/1.5 Arial,sans-serif;margin:0 0 18px;padding:8px 0;border-bottom:1px solid #d9ddd3;color:#58676a}').toString('base64') };
  for (const route of ['/app', '/app/', '/app/history', '/app/history/', '/app/about', '/app/about/']) assets[route] = assets['/app/index.html'];
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(sources)).digest('hex');
  return { assets, version: course.version, sourceHash };
}
