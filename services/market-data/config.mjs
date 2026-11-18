import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, integer } from './core.mjs';

export const SERVICE_DIR = dirname(fileURLToPath(import.meta.url));
export function readConfig(env = process.env, { baseDir = SERVICE_DIR } = {}) {
  const localDir = join(baseDir, '.local');
  mkdirSync(localDir, { recursive: true, mode: 0o700 });
  const tokenFile = join(localDir, 'access-token');
  let apiToken = env.DATA_API_TOKEN;
  if (!apiToken) {
    if (existsSync(tokenFile)) apiToken = readFileSync(tokenFile, 'utf8').trim();
    else { apiToken = randomBytes(32).toString('base64url'); writeFileSync(tokenFile, apiToken + '\n', { flag: 'wx', mode: 0o600 }); }
  }
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(apiToken)) throw new ApiError('requires_configuration', 'DATA_API_TOKEN must contain 32-256 letters, digits, underscores or hyphens.', 503);
  return {
    host: '127.0.0.1',
    port: integer(env.DATA_PORT, { name: 'DATA_PORT', min: 1024, max: 65535, fallback: 4435 }),
    apiToken, tokenFile,
    cachePath: resolve(env.DATA_CACHE_PATH || join(localDir, 'cache.sqlite')),
    warehousePath: resolve(env.DATA_WAREHOUSE_PATH || join(localDir, 'warehouse.sqlite')),
    secUserAgent: env.SEC_USER_AGENT || '',
    fredKey: env.FRED_API_KEY || '',
    alpacaKey: env.APCA_API_KEY_ID || '',
    alpacaSecret: env.APCA_API_SECRET_KEY || '',
  };
}
