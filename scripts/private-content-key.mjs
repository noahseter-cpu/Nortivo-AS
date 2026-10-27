import { readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentKey } from '../netlify/private/content-crypto.mjs';

export const keyFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.private-workspace.local');
// Read exactly this file/key; do not evaluate .env text or read any provider configuration.
export async function readLocalContentKey({ create = false } = {}) {
  let text;
  try { text = await readFile(keyFile, 'utf8'); }
  catch (error) {
    if (!create || error.code !== 'ENOENT') throw new Error('Local private content key is unavailable.');
    const value = crypto.randomBytes(32).toString('base64');
    try { await writeFile(keyFile, 'NORTIVO_PRIVATE_CONTENT_KEY=' + value + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (writeError) { if (writeError.code !== 'EEXIST') throw new Error('Local private content key could not be created.'); }
    text = await readFile(keyFile, 'utf8');
  }
  const matches = [...text.matchAll(/^NORTIVO_PRIVATE_CONTENT_KEY=([A-Za-z0-9+/=]+)\r?$/gm)];
  if (matches.length !== 1) throw new Error('Local private content key is invalid.');
  const value = matches[0][1];
  contentKey(value);
  return value;
}
