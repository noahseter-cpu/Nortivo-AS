import { spawnSync } from 'node:child_process';
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = (await readdir(path.join(root, 'tests'))).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(root, 'tests', name));
const tests = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true });
const check = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs')], { cwd: root, encoding: 'utf8', timeout: 10000, windowsHide: true });
const plain = `${tests.stdout || ''}${tests.stderr || ''}`.replace(/\u001b\[[0-9;]*m/g, '');
const manual = JSON.parse(await readFile(path.join(root, 'evidence/manual-review.json'), 'utf8'));
const hashes = {};
for (const name of ['index.html', 'security.html', 'report.html', 'styles.css', 'preview.js']) hashes[name] = createHash('sha256').update(await readFile(path.join(root, 'preview', name))).digest('hex');
const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  testFiles: files.map(file => path.basename(file)),
  tests: { passed: tests.status === 0, exitCode: tests.status, total: Number(plain.match(/\btests\s+(\d+)/)?.[1] || 0), failures: Number(plain.match(/\bfail\s+(\d+)/)?.[1] || 0) },
  offlineCheck: { passed: check.status === 0, exitCode: check.status },
  manualReviewRecord: 'manual-review.json',
  preview: { assetHashes: hashes, matchesRecordedReview: Object.entries(hashes).every(([name, digest]) => manual.previewAssetHashes[name] === digest), httpBrowserValidation: false },
  deploymentPerformedByThisScript: false,
  limitations: ['Synthetic local tests do not establish protection of existing live endpoints.', 'Remote shared-store atomicity, trusted IP provenance, log durability and notification delivery unverified.', 'No production backup restore or live penetration test performed.']
};
await mkdir(path.join(root, 'evidence'), { recursive: true });
await writeFile(path.join(root, 'evidence/tests.txt'), plain);
await writeFile(path.join(root, 'evidence/offline-check.json'), check.stdout || '{}');
await writeFile(path.join(root, 'evidence/verification.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
if (tests.status !== 0 || check.status !== 0) process.exitCode = 1;
