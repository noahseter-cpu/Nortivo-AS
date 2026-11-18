import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const issues = [];
if (Object.keys(manifest.dependencies || {}).length) issues.push('Review new KORVNT runtime dependencies and lockfile.');
if (manifest.private !== true) issues.push('Keep this package private until release review.');
const sources = await readdir(path.join(root, 'src'));
for (const name of sources.filter(name => name.endsWith('.mjs'))) {
  const content = await readFile(path.join(root, 'src', name), 'utf8');
  for (const match of content.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.') && !match[1].startsWith('node:')) issues.push(`Review external import in ${name}.`);
  }
}
console.log(JSON.stringify({ status: issues.length ? 'review_required' : 'passed', checks: ['private package', 'no added third-party runtime packages', 'relative and Node builtin static imports'], limitations: 'Static checks do not prove absence of vulnerabilities or evaluate production configuration.', issues }, null, 2));
if (issues.length) process.exitCode = 1;
