import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { fail } from './security.mjs';

const scrypt = promisify(crypto.scrypt);
const PARAMETERS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export function credentials(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) fail('INVALID_CREDENTIALS', 'Enter a valid email address.', 400);
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 256) fail('INVALID_CREDENTIALS', 'Use a password with 12–256 characters.', 400);
  const name = typeof body.name === 'string' ? body.name.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80) : '';
  return { email, password, name };
}
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, PARAMETERS);
  return `scrypt-v1$32768$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}
const DUMMY_SALT = Buffer.alloc(16, 17);
export async function verifyPassword(password, encoded) {
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  const valid = parts.length === 6 && parts[0] === 'scrypt-v1' && parts[1] === '32768' && parts[2] === '8' && parts[3] === '1' && /^[A-Za-z0-9_-]{22}$/.test(parts[4]) && /^[A-Za-z0-9_-]{86}$/.test(parts[5]);
  const derived = await scrypt(password, valid ? Buffer.from(parts[4], 'base64url') : DUMMY_SALT, 64, PARAMETERS);
  return valid && crypto.timingSafeEqual(derived, Buffer.from(parts[5], 'base64url'));
}
