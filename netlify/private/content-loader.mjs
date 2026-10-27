import crypto from 'node:crypto';
import encryptedContent from './encrypted-content.mjs';
import { contentKey, decryptContent, standaloneWorker } from './content-crypto.mjs';

export function validatePrivateContent(value) {
  if (value?.version !== 1 || !Array.isArray(value.projects) || value.projects.length > 50) throw new Error('Private content unavailable.');
  standaloneWorker(value.workerSource);
  const ids = new Set();
  for (const project of value.projects) {
    if (!project || !/^[a-z0-9-]+$/.test(project.id) || ids.has(project.id) || typeof project.external !== 'boolean' || typeof project.href !== 'string') throw new Error('Private content unavailable.');
    ids.add(project.id);
    if (project.external ? !/^https:\/\/[^\s]+$/.test(project.href) : !project.href.startsWith('/admin/projects/')) throw new Error('Private content unavailable.');
    for (const field of ['name', 'description', 'action', 'note']) for (const language of ['nb', 'en']) {
      if (typeof project[field]?.[language] !== 'string' || project[field][language].length > 2000) throw new Error('Private content unavailable.');
    }
  }
  return value;
}

// Cache only in server memory. Missing or changed keys never reuse a prior decrypted value.
export function createPrivateContentLoader(envelope = encryptedContent) {
  let cachedFingerprint;
  let cachedContent;
  let cachedWorker;
  function load() {
    const key = process.env.NORTIVO_PRIVATE_CONTENT_KEY;
    contentKey(key);
    const fingerprint = crypto.createHash('sha256').update(key).digest('hex');
    if (fingerprint !== cachedFingerprint) {
      const value = validatePrivateContent(decryptContent(envelope, key));
      cachedContent = value;
      cachedWorker = null;
      cachedFingerprint = fingerprint;
    }
    return cachedContent;
  }
  return {
    projects: async () => load().projects,
    worker: async () => {
      const content = load();
      // The authenticated GCM package is trusted code. It must be a standalone module:
      // no imports, filesystem resolution, URL forwarding or plaintext build inputs.
      if (!cachedWorker) cachedWorker = import('data:text/javascript;base64,' + Buffer.from(content.workerSource).toString('base64'));
      return cachedWorker;
    },
  };
}

export const privateContent = createPrivateContentLoader();
