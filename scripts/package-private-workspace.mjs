import { readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encryptContent, standaloneWorker } from '../netlify/private/content-crypto.mjs';
import { readLocalContentKey } from './private-content-key.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function packagePrivateWorkspace() {
  const key = await readLocalContentKey({ create: true });
  const { projects } = await import('../netlify/private/projects.mjs');
  const workerSource = await readFile(path.join(root, 'netlify/private/vibb-runtime.mjs'), 'utf8');
  standaloneWorker(workerSource);
  if (/\bgsk_[A-Za-z0-9]{16,}|\bsk-proj-[A-Za-z0-9_-]{16,}/.test(workerSource + JSON.stringify(projects))) throw new Error('Credential-shaped source was rejected.');
  const envelope = encryptContent({ version: 1, projects, workerSource }, key);
  const ciphertextModule = '// AES-256-GCM private package. Only ciphertext is safe to commit.\nexport default ' + JSON.stringify(envelope) + ';\n';
  await writeFile(path.join(root, 'netlify/private/encrypted-content.mjs'), ciphertextModule);
  const prior = JSON.parse(await readFile(path.join(root, 'docs/PRIVATE_VIBB_SNAPSHOT.json'), 'utf8'));
  const metadata = {
    format: 'nortivo-private-content-v1', algorithm: 'aes-256-gcm',
    sourceSha256: prior.sourceSha256, runtimeSha256: prior.runtimeSha256,
    encryptedPackageSha256: crypto.createHash('sha256').update(ciphertextModule).digest('hex'),
    assets: prior.assets,
  };
  await writeFile(path.join(root, 'docs/PRIVATE_VIBB_SNAPSHOT.json'), JSON.stringify(metadata, null, 2) + '\n');
  return { encrypted: true, localKeyFileExists: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(await packagePrivateWorkspace());
}
