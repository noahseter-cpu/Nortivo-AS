import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createDataVault, DataProtectionError } from '../netlify/security-core/vault.mjs';

const key = () => randomBytes(32).toString('base64');
const context = Object.freeze({ purpose: 'private-note', ownerId: 'user-a', recordId: 'note-1' });
function fixture(options = {}) { return createDataVault({ keys: { primary: key() }, currentKeyId: 'primary', ...options }); }
function denied(operation) {
  assert.throws(operation, error => error instanceof DataProtectionError && error.code === 'DATA_PROTECTION_UNAVAILABLE'
    && error.status === 503 && error.message === 'Protected data is unavailable.');
}

test('Security Core vault round-trips JSON without exposing plaintext in an envelope', () => {
  const vault = fixture();
  for (const value of [{ privateNote: 'Synthetic private value', count: 12, flags: [true, false, null] }, 'text', null, 12]) {
    const sealed = vault.seal(value, context);
    assert.equal(sealed.version, 1);
    assert.equal(sealed.algorithm, 'aes-256-gcm');
    assert.equal(Object.isFrozen(sealed), true);
    assert.equal(Buffer.from(sealed.iv, 'base64').length, 12);
    assert.equal(Buffer.from(sealed.tag, 'base64').length, 16);
    assert.deepEqual(vault.open(sealed, context), value);
    assert.doesNotMatch(JSON.stringify(sealed), /Synthetic private value/);
  }
});

test('ciphertext, tag, nonce and envelope metadata tampering are rejected generically', () => {
  const vault = fixture(); const envelope = vault.seal({ secret: 'synthetic-value' }, context);
  for (const field of ['iv', 'tag', 'ciphertext']) {
    const bytes = Buffer.from(envelope[field], 'base64'); bytes[0] ^= 1;
    denied(() => vault.open({ ...envelope, [field]: bytes.toString('base64') }, context));
  }
  for (const changes of [{ version: 2 }, { algorithm: 'aes-128-gcm' }, { keyId: 'unknown' }, { extra: 'unexpected' }, { iv: envelope.iv + '=' }, { tag: '' }, { ciphertext: '' }]) {
    denied(() => vault.open({ ...envelope, ...changes }, context));
  }
});

test('ownership, purpose and record binding prevent ciphertext swaps', () => {
  const vault = fixture(); const envelope = vault.seal({ note: 'synthetic' }, context);
  for (const altered of [{ ...context, ownerId: 'user-b' }, { ...context, recordId: 'note-2' }, { ...context, purpose: 'broker-token' }]) {
    denied(() => vault.open(envelope, altered));
  }
  denied(() => vault.open(envelope, { ...context, ownerId: 'user-a:note-1', recordId: 'x' }));
  denied(() => vault.open(envelope, { ...context, ownerId: '', recordId: '' }));
  denied(() => vault.open(envelope, { ...context, ignored: 'unexpected' }));
});

test('wrong keys and same-material key-id substitution cannot decrypt', () => {
  const first = key();
  const vault = createDataVault({ keys: { old: first, next: first }, currentKeyId: 'old' });
  const sealed = vault.seal('synthetic-private-record', context);
  denied(() => vault.open({ ...sealed, keyId: 'next' }, context));
  denied(() => createDataVault({ keys: { old: key() }, currentKeyId: 'old' }).open(sealed, context));
});

test('each seal uses a fresh randomly generated 96-bit nonce', () => {
  const vault = fixture(); const nonces = new Set(), ciphertexts = new Set();
  for (let i = 0; i < 128; i++) {
    const sealed = vault.seal({ same: 'synthetic' }, context);
    nonces.add(sealed.iv); ciphertexts.add(sealed.ciphertext);
  }
  assert.equal(nonces.size, 128); assert.equal(ciphertexts.size, 128);
});

test('explicit key-ring rotation reads old records and reseals under the current key', () => {
  const oldKey = key(), nextKey = key();
  const old = createDataVault({ keys: { old: oldKey }, currentKeyId: 'old' });
  const original = old.seal({ note: 'synthetic' }, context);
  const rotating = createDataVault({ keys: { old: oldKey, next: nextKey }, currentKeyId: 'next' });
  assert.deepEqual(rotating.open(original, context), { note: 'synthetic' });
  const rewritten = rotating.reseal(original, context);
  assert.equal(rewritten.keyId, 'next'); assert.notEqual(rewritten.iv, original.iv);
  const currentOnly = createDataVault({ keys: { next: nextKey }, currentKeyId: 'next' });
  assert.deepEqual(currentOnly.open(rewritten, context), { note: 'synthetic' });
  denied(() => currentOnly.open(original, context));
  assert.equal(original.keyId, 'old');
});

test('strict key encoding, incomplete key rings and invalid contexts fail without values', () => {
  const valid = key();
  for (const options of [undefined, {}, { keys: {}, currentKeyId: 'primary' }, { keys: { primary: valid }, currentKeyId: 'missing' },
    { keys: { primary: valid.replace(/=$/, '') }, currentKeyId: 'primary' }, { keys: { primary: randomBytes(16).toString('base64') }, currentKeyId: 'primary' },
    { keys: { primary: 'SYNTHETIC_SECRET_DO_NOT_LEAK' }, currentKeyId: 'primary' }, { keys: { primary: valid }, currentKeyId: 'primary', maxPlaintextBytes: 0 }]) {
    denied(() => createDataVault(options));
  }
  const vault = fixture();
  for (const invalid of [null, {}, { ...context, purpose: '../private' }, { ...context, ownerId: 'line\nbreak' }]) denied(() => vault.seal('synthetic', invalid));
});

test('bounded JSON contract rejects oversized, cyclic, executable and prototype-shaped data', () => {
  const vault = fixture({ maxPlaintextBytes: 100 });
  denied(() => vault.seal('x'.repeat(101), context));
  const cyclic = {}; cyclic.self = cyclic;
  for (const invalid of [cyclic, undefined, NaN, Infinity, { v: undefined }, new Date(), { toJSON() { return 'secret'; } }, JSON.parse('{"__proto__":{"v":1}}')]) {
    denied(() => vault.seal(invalid, context));
  }
  let getterCalled = false;
  const getter = {}; Object.defineProperty(getter, 'secret', { enumerable: true, get() { getterCalled = true; return 'private'; } });
  denied(() => vault.seal(getter, context)); assert.equal(getterCalled, false);
});

test('publish check permits public pages and reports sensitive filenames and text markers without leaking content', async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(temporaryRoot, 'nortivo-privacy-check-'));
  const script = fileURLToPath(new URL('../services/security-core/scripts/privacy-check.mjs', import.meta.url));
  try {
    await mkdir(path.join(directory, 'services'));
    await writeFile(path.join(directory, 'services/index.html'), '<p>Public services</p>');
    const clean = spawnSync(process.execPath, [script, directory], { encoding: 'utf8', windowsHide: true });
    assert.equal(clean.status, 0); assert.equal(JSON.parse(clean.stdout).status, 'passed');
    await writeFile(path.join(directory, '.env.production'), 'SYNTHETIC_DO_NOT_PRINT');
    const flagged = spawnSync(process.execPath, [script, directory], { encoding: 'utf8', windowsHide: true });
    assert.equal(flagged.status, 1);
    assert.equal(JSON.parse(flagged.stdout).findings[0].path, '.env.production');
    assert.doesNotMatch(flagged.stdout + flagged.stderr, /SYNTHETIC_DO_NOT_PRINT/);
    const marker = 'ghp_' + 'FixtureTextNeverPrint'.repeat(2);
    await writeFile(path.join(directory, 'unsafe.js'), 'const marker = "' + marker + '";');
    const scan = spawnSync(process.execPath, [script, directory], { encoding:'utf8', windowsHide:true });
    assert.equal(scan.status,1);
    assert.ok(JSON.parse(scan.stdout).findings.some(row=>row.path==='unsafe.js' && row.reason==='credential_marker_in_public_text'));
    assert.equal((scan.stdout+scan.stderr).includes(marker),false);
  } finally {
    const resolved = await realpath(directory);
    assert.ok(resolved.startsWith(temporaryRoot + path.sep));
    await rm(resolved, { recursive: true, force: true });
  }
});
