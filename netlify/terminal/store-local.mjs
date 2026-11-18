// This module is imported only by the standalone local server and tests, never the Netlify function.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { TerminalError, COMMAND_QUOTAS } from './security.mjs';
import { createProductLocalStore } from '../product/store-local.mjs';

export async function createLocalStore(filename) {
  const { DatabaseSync } = await import('node:sqlite');
  if (filename !== ':memory:') await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS terminal_users (id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('guest','user')),email TEXT UNIQUE,password_hash TEXT,name TEXT,created_at INTEGER NOT NULL,expires_at INTEGER);
    CREATE TABLE IF NOT EXISTS terminal_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES terminal_users(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS terminal_states (user_id TEXT PRIMARY KEY REFERENCES terminal_users(id) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS terminal_receipts (user_id TEXT NOT NULL REFERENCES terminal_users(id) ON DELETE CASCADE,request_id TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,request_id));
    CREATE TABLE IF NOT EXISTS terminal_rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS terminal_sessions_expiry ON terminal_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS terminal_users_expiry ON terminal_users(expires_at);
    CREATE INDEX IF NOT EXISTS terminal_limits_expiry ON terminal_rate_limits(until);
    `);
  // Additive v2 migration preserves all existing paper states and receipts.
  if (!db.prepare('PRAGMA table_info(terminal_states)').all().some(column => column.name==='receipt_count')) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('ALTER TABLE terminal_states ADD COLUMN receipt_count INTEGER NOT NULL DEFAULT 0 CHECK(receipt_count >= 0)');
      db.exec('UPDATE terminal_states SET receipt_count=(SELECT count(*) FROM terminal_receipts WHERE terminal_receipts.user_id=terminal_states.user_id)');
      db.exec('PRAGMA user_version=2; COMMIT;');
    } catch (error) {db.exec('ROLLBACK');db.close();throw error;}
  }
  const transaction = work => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const cleanup = now => {
    db.prepare('DELETE FROM terminal_sessions WHERE expires_at <= ?').run(now);
    db.prepare('DELETE FROM terminal_users WHERE kind = ? AND expires_at <= ?').run('guest', now);
    db.prepare('DELETE FROM terminal_rate_limits WHERE until <= ?').run(now);
  };
  const product=createProductLocalStore(db,transaction);
  return {
    product,
    async productIdentity(input) { return product.identity(input); },
    async productCreateSession(session) {return transaction(()=>{db.prepare('DELETE FROM terminal_sessions WHERE user_id=? AND expires_at<=?').run(session.user_id,session.created_at);db.prepare('DELETE FROM terminal_sessions WHERE user_id=? AND token_hash IN (SELECT token_hash FROM terminal_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 49)').run(session.user_id,session.user_id);db.prepare('INSERT INTO terminal_sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run(session.token_hash,session.user_id,session.created_at,session.expires_at);});},
    async findUserById(id) { return db.prepare('SELECT * FROM terminal_users WHERE id=?').get(id)||null; },
    async listSessions(userId,now) { return db.prepare('SELECT token_hash,created_at,expires_at FROM terminal_sessions WHERE user_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 100').all(userId,now); },
    async revokeSessions(userId,hash=null) { if(hash) db.prepare('DELETE FROM terminal_sessions WHERE user_id=? AND token_hash=?').run(userId,hash);else db.prepare('DELETE FROM terminal_sessions WHERE user_id=?').run(userId); },
    kind: 'local-sqlite',
    async createUser(user, state) {
      try {
        transaction(() => {
          db.prepare('INSERT INTO terminal_users (id,kind,email,password_hash,name,created_at,expires_at) VALUES (?,?,?,?,?,?,?)').run(user.id,user.kind,user.email || null,user.password_hash || null,user.name || '',user.created_at,user.expires_at || null);
          db.prepare('INSERT INTO terminal_states (user_id,state) VALUES (?,?)').run(user.id, JSON.stringify(state));
        });
      } catch (error) {
        if (error.code?.includes('CONSTRAINT') || /UNIQUE constraint/.test(error.message)) throw new TerminalError('ACCOUNT_UNAVAILABLE', 'Account creation could not be completed. Try signing in or use a guest sandbox.', 409);
        throw error;
      }
    },
    async findUserByEmail(email) { return db.prepare('SELECT * FROM terminal_users WHERE email = ? AND kind = ?').get(email, 'user') || null; },
    async createSession(session) { db.prepare('INSERT INTO terminal_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)').run(session.token_hash,session.user_id,session.created_at,session.expires_at); },
    async getSession(hash, now) {
      cleanup(now);
      return db.prepare('SELECT u.*,s.created_at AS session_created_at,s.expires_at AS session_expires_at FROM terminal_sessions s JOIN terminal_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND (u.expires_at IS NULL OR u.expires_at>?)').get(hash,now,now) || null;
    },
    async deleteSession(hash) { db.prepare('DELETE FROM terminal_sessions WHERE token_hash=?').run(hash); },
    async getState(userId) {
      const row = db.prepare('SELECT revision,state,receipt_count FROM terminal_states WHERE user_id=?').get(userId);
      return row ? { revision: row.revision, state: JSON.parse(row.state), commandCount:row.receipt_count } : null;
    },
    async getReceipt(userId, requestId) {
      const row = db.prepare('SELECT digest,result FROM terminal_receipts WHERE user_id=? AND request_id=?').get(userId,requestId);
      return row ? { digest: row.digest, result: JSON.parse(row.result) } : null;
    },
    async commitCommand(userId, revision, state, receipt) {
      return transaction(() => {
        const previous = db.prepare('SELECT digest,result FROM terminal_receipts WHERE user_id=? AND request_id=?').get(userId,receipt.requestId);
        if (previous) return { status: 'duplicate', digest: previous.digest, result: JSON.parse(previous.result) };
        const owner = db.prepare('SELECT s.receipt_count,u.kind FROM terminal_states s JOIN terminal_users u ON u.id=s.user_id WHERE s.user_id=?').get(userId);
        if (owner && owner.receipt_count>=COMMAND_QUOTAS[owner.kind]) return {status:'quota',limit:COMMAND_QUOTAS[owner.kind]};
        const update = db.prepare('UPDATE terminal_states SET state=?, revision=revision+1,receipt_count=receipt_count+1 WHERE user_id=? AND revision=?').run(JSON.stringify(state),userId,revision);
        if (!update.changes) return { status: 'conflict' };
        db.prepare('INSERT INTO terminal_receipts (user_id,request_id,digest,result,created_at) VALUES (?,?,?,?,?)').run(userId,receipt.requestId,receipt.digest,JSON.stringify(receipt.result),receipt.now);
        return { status: 'applied', revision: revision + 1 };
      });
    },
    async consumeRateLimit(key, limit, windowMs, now) {
      return transaction(() => {
        let row = db.prepare('UPDATE terminal_rate_limits SET count=CASE WHEN until<=? THEN 1 ELSE MIN(count+1,1000000) END,until=CASE WHEN until<=? THEN ? ELSE until END WHERE key=? RETURNING count,until').get(now,now,now+windowMs,key);
        if (!row) {
          cleanup(now);
          if (db.prepare('SELECT count(*) AS count FROM terminal_rate_limits').get().count >= 10000) {
            const first = db.prepare('SELECT MIN(until) AS until FROM terminal_rate_limits').get();
            return {allowed:false,retryAfterMs:Math.max(1,first.until-now)};
          }
          row = db.prepare('INSERT INTO terminal_rate_limits (key,count,until) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<=? THEN 1 ELSE MIN(count+1,1000000) END,until=CASE WHEN until<=? THEN ? ELSE until END RETURNING count,until').get(key,now+windowMs,now,now,now+windowMs);
        }
        return {allowed:row.count<=limit,retryAfterMs:row.count<=limit ? 0 : Math.max(1,row.until-now)};
      });
    },
    close() { db.close(); },
  };
}
