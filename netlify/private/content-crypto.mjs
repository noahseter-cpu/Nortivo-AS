import crypto from 'node:crypto';

const aad = Buffer.from('nortivo-private-content:v1', 'utf8');
const unavailable = () => new Error('Private content unavailable.');
export function standaloneWorker(source) {
  if (typeof source !== 'string' || !source.length || source.length > 8000000) throw unavailable();
  let executable = source;
  const assetsStart = source.indexOf('\nconst assets=');
  if (assetsStart >= 0) {
    const catalogStart = source.indexOf(';\nconst catalog=', assetsStart);
    const ending = ';\nexport default createWorker(assets,catalog);\n';
    if (catalogStart < 0 || !source.endsWith(ending)) throw unavailable();
    // Only JSON data may occupy the generated asset/catalog region. Import examples
    // inside course strings are data, not executable module dependencies.
    JSON.parse(source.slice(assetsStart + '\nconst assets='.length, catalogStart));
    JSON.parse(source.slice(catalogStart + ';\nconst catalog='.length, -ending.length));
    executable = source.slice(0, assetsStart);
  }
  if (/^\s*import\s|\bimport\s*\(|\bimport\.meta|\bexport\s+[^;\n]*\sfrom\s/m.test(executable)) throw unavailable();
  return source;
}
export function contentKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw unavailable();
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw unavailable();
  return key;
}
export function encryptContent(value, encodedKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', contentKey(encodedKey), iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
export function decryptContent(envelope, encodedKey) {
  try {
    if (envelope?.version !== 1 || envelope.algorithm !== 'aes-256-gcm') throw unavailable();
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    if (iv.length !== 12 || tag.length !== 16 || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > 16000000) throw unavailable();
    const decipher = crypto.createDecipheriv('aes-256-gcm', contentKey(encodedKey), iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
  } catch { throw unavailable(); }
}
