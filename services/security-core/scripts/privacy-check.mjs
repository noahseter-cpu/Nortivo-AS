import { realpath, readdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Emit only relative paths and finding classes. Sensitive file types are flagged without opening them.
const selected = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../../../dist/', import.meta.url));
// `services` is a real public marketing route; it must not be classified as server source by name alone.
const blockedDirectories = new Set(['.git', '.local', 'node_modules', 'netlify', 'supabase', 'tests']);
const sensitiveName = name => /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx|sqlite|sqlite3|db)$/i.test(name)
  || /^(?:projects|vibb-runtime|encrypted-content|owner-(?:market|bootstrap)-sealed)\.mjs$/i.test(name)
  || /\.private\.(?:json|txt|log|zip)$/i.test(name);
const publicText = /\.(?:html?|css|m?js|json|svg|xml|txt|map)$/i;
const credentialMarker = /-----BEGIN (?:OPENSSH |RSA |EC |ENCRYPTED )?PRIVATE KEY-----|\b(?:sk_(?:live|test)_|rk_live_|sb_secret_|sk-(?:proj-|svcacct-)|ghp_)[A-Za-z0-9_-]{18,}/;
let textFilesChecked = 0;
async function inspectText(filename, relative) {
  const handle = await open(filename, 'r');
  try {
    const file = await handle.stat(), limit = 4 * 1024 * 1024;
    if (!file.isFile() || file.size > limit) {
      findings.push({ path:relative, reason:'large_or_changed_text_asset_requires_review' });
      return;
    }
    const content = Buffer.alloc(file.size + 1);
    const { bytesRead } = await handle.read(content, 0, content.length, 0);
    if (bytesRead !== file.size) findings.push({ path:relative, reason:'changed_text_asset_requires_review' });
    else if (credentialMarker.test(content.toString('utf8', 0, bytesRead))) findings.push({ path:relative, reason:'credential_marker_in_public_text' });
    textFilesChecked++;
  } finally { await handle.close(); }
}
const findings = [];
let checkedFiles = 0;
try {
  const root = await realpath(selected);
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name), relative = path.relative(root, absolute).replaceAll(path.sep, '/');
      if (entry.isSymbolicLink()) { findings.push({ path: relative, reason: 'symbolic_link_requires_review' }); continue; }
      if (entry.isDirectory()) {
        if (blockedDirectories.has(entry.name) || /(?:^|\/)services\/(?:security-core|market-data)$/.test(relative)) findings.push({ path: relative, reason: 'server_or_private_directory_in_publish_tree' });
        else await walk(absolute);
      } else if (entry.isFile()) {
        checkedFiles++;
        if (checkedFiles > 50000) throw new Error('capacity');
        if (sensitiveName(entry.name)) findings.push({ path: relative, reason: 'sensitive_file_type_in_publish_tree' });
        else if (publicText.test(entry.name) || ['_headers', '_redirects'].includes(entry.name)) await inspectText(absolute, relative);
      }
    }
  }
  await walk(root);
  console.log(JSON.stringify({ status: findings.length ? 'review_required' : 'passed', checkedFiles, textFilesChecked, findings,
    scope: 'Publish-tree filenames, directories, links and selected credential markers in text assets. Binary contents, marker-free credentials and hosted policies require separate review.' }, null, 2));
  if (findings.length) process.exitCode = 1;
} catch {
  console.error('The publish boundary could not be checked. Provide an existing local publish directory.');
  process.exitCode = 1;
}
