import { spawnSync } from 'node:child_process';
import { readdir, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const core = fileURLToPath(new URL('../', import.meta.url));
const repository = fileURLToPath(new URL('../../../', import.meta.url));
try { await stat(path.join(repository, 'netlify/functions/terminal.mjs')); }
catch { console.error('Run integration verification inside the full Nortivo repository. Standalone library tests remain available.'); process.exit(1); }

const evidence = path.join(core, 'evidence');
await mkdir(evidence, { recursive: true });
const rootTests = (await readdir(path.join(repository, 'tests'))).filter(name => name.endsWith('.test.mjs')).sort();
const coreTests = (await readdir(path.join(core, 'tests'))).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(core, 'tests', name));
function run(files) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: repository, encoding: 'utf8', timeout: 120000, maxBuffer: 8_000_000, windowsHide: true });
  const text = `${result.stdout || ''}${result.stderr || ''}`;
  const count = name => Number(text.match(new RegExp(`^# ${name} (\\d+)$`, 'm'))?.[1] || 0);
  return { text, exitCode: result.status, total: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'), failureTitles: [...text.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]) };
}

const integration = run([...rootTests.filter(name => name.startsWith('security-core-') || name.startsWith('workflow') || name.startsWith('newworkflow-')).map(name => path.join(repository, 'tests', name)), ...coreTests]);
await writeFile(path.join(evidence, 'integration-tests.tap'), integration.text);
const { text: ignored, ...integrationSummary } = integration;
let regressionSummary = { status: 'not_requested' };
if (process.argv.includes('--full')) {
  const regression = run(rootTests.map(name => path.join(repository, 'tests', name)));
  await writeFile(path.join(evidence, 'repository-tests.tap'), regression.text);
  const known = [
    { title: 'local preview denies traversal, encoded traversal, Windows paths and linked directories outside dist', code: 'EPERM', file: 'locale.test.mjs', reason: 'Sandbox denies creation of the test directory symlink.' },
    { title: 'standalone terminal server serves static pages/current CSP and leaves support disconnected', code: 'EACCES', file: 'terminal-server.test.mjs', reason: 'Sandbox denies the test loopback HTTP connection.' }
  ];
  const blocked = [];
  for (const item of known) {
    if (!regression.failureTitles.includes(item.title)) continue;
    // Isolate the failed case so another test's error can never classify it as an environment blocker.
    const literalTitle = item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const detail = spawnSync(process.execPath, ['--test', '--test-reporter=spec', `--test-name-pattern=^${literalTitle}$`, path.join(repository, 'tests', item.file)], { cwd: repository, encoding: 'utf8', timeout: 30000, maxBuffer: 1_000_000, windowsHide: true });
    const diagnostic = `${detail.stdout || ''}${detail.stderr || ''}`;
    if (diagnostic.includes(item.code)) blocked.push(item);
  }
  const { text, ...counts } = regression;
  regressionSummary = { ...counts, status: regression.exitCode === 0 ? 'passed' : blocked.length > 0 && blocked.length === regression.failed && blocked.length === regression.failureTitles.length ? 'environment_blocked' : 'failed', blocked };
}
const privacy = spawnSync(process.execPath, [path.join(core, 'scripts/privacy-check.mjs')], { cwd: repository, encoding: 'utf8', timeout: 10000, windowsHide: true });
await writeFile(path.join(evidence, 'publish-boundary.json'), privacy.stdout || '{}');
const sourcePaths = [
  'netlify/security-core/admin.mjs', 'netlify/security-core/private-browser.mjs', 'netlify/security-core/vault.mjs',
  'netlify/functions/_utils.mjs', 'netlify/functions/_ticket-security.mjs', 'netlify/functions/terminal.mjs',
  'netlify/functions/tickets.mjs', 'netlify/functions/ticket-access.mjs', 'netlify/functions/admin-login.mjs',
  'netlify/functions/admin-session.mjs', 'netlify/functions/admin-logout.mjs', 'netlify/functions/admin-tickets.mjs',
  'netlify/functions/admin-projects.mjs', 'netlify/functions/admin-vibb.mjs', 'netlify/functions/reply-ticket.mjs',
  'netlify/terminal/security.mjs', 'netlify/terminal/store.mjs', 'netlify/terminal/store-local.mjs',
  'netlify/product/service.mjs', 'netlify/product/mfa.mjs', 'netlify/security-core/mfa-proof.mjs',
  'netlify/product/auth.mjs', 'netlify/product/entitlements.mjs', 'netlify/product/owner.mjs', 'netlify/product/ai.mjs',
  'netlify/product/store.mjs', 'netlify/product/broker.mjs', 'netlify/conversations/handler.mjs',
  'netlify/conversations/model.mjs', 'netlify/conversations/presence.mjs', 'netlify/conversations/tenancy.mjs',
  'netlify/functions/workflow-inbox.mjs','netlify/functions/korvnt-service.mjs','netlify/functions/korvnt-inbox.mjs',
  'netlify/routing/application-routes.mjs','netlify/edge-functions/language.js',
  'supabase/workflows.sql', 'scripts/build-locales.mjs', 'scripts/preview-private-admin.mjs'
];
const hashes = {};
for (const name of sourcePaths) hashes[name] = createHash('sha256').update(await readFile(path.join(repository, name))).digest('hex');
const result = {
  generatedAt: new Date().toISOString(), node: process.version, brand: 'Nortivo KORVNT', release: '0.2.0',
  integration: { ...integrationSummary, status: integration.exitCode === 0 ? 'passed' : 'failed' },
  repositoryRegression: regressionSummary,
  publishBoundary: { status: privacy.status === 0 ? 'passed' : 'failed', exitCode: privacy.status },
  deploymentPerformed: false, productionDataMigrated: false, accountProvisioningPerformed: false,
  sourceSha256: hashes,
  remainingEvidence: ['Production identity/MFA setup and hosted route/cookie behavior.', 'Remote shared-store atomicity and trusted platform IP provenance.', 'Durable restricted logs, retention, alert delivery and backup restore.', 'Release-time advisory recheck, runtime/platform patch review and trademark/name clearance.']
};
await writeFile(path.join(evidence, 'integration-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, sourceSha256: `${sourcePaths.length} source hashes recorded in evidence` }, null, 2));
if (integration.exitCode !== 0 || privacy.status !== 0 || (process.argv.includes('--full') && regressionSummary.status !== 'passed')) process.exitCode = 1;
