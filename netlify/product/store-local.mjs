import { validateChanges,validateKey } from './store.mjs';
import { fail } from '../terminal/security.mjs';

export function createProductLocalStore(db,transaction) {
  db.exec(`CREATE TABLE IF NOT EXISTS product_records(ns TEXT NOT NULL,key TEXT NOT NULL,owner_id TEXT NOT NULL,value TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,expires_at INTEGER,PRIMARY KEY(ns,key));CREATE INDEX IF NOT EXISTS product_records_owner ON product_records(owner_id,ns,key);`);
  const decode=row=>row&&row.value!=='null'?{key:row.key,value:JSON.parse(row.value),version:row.version,ownerId:row.owner_id,expiresAt:row.expires_at}:null;
  const raw=(ns,key)=>db.prepare('SELECT * FROM product_records WHERE ns=? AND key=?').get(ns,key);
  const get=(ns,key)=>decode(raw(ns,key));
  function apply(changes) {
    const sorted=validateChanges(changes);
    for(const c of sorted) {const old=get(c.ns,c.key);const stored=raw(c.ns,c.key);if(stored&&stored.owner_id!==c.ownerId) fail('RECORD_OWNER','Record ownership cannot change.',403);if((old?.version??null)!==c.expectedVersion)return {status:'conflict'};}
    const owners=[...new Set(sorted.map(c=>c.ownerId))];
    for(const owner of owners) {
      const count=db.prepare('SELECT count(*) count,coalesce(sum(length(CAST(value AS BLOB))),0) bytes FROM product_records WHERE owner_id=?').get(owner);
      const delta=sorted.filter(c=>c.ownerId===owner).reduce((n,c)=>n+(raw(c.ns,c.key)?0:1),0);
      const bytes=sorted.filter(c=>c.ownerId===owner).reduce((n,c)=>n+Buffer.byteLength(JSON.stringify(c.value))-(raw(c.ns,c.key)?Buffer.byteLength(raw(c.ns,c.key).value):0),0);
      if(count.count+delta>50000 || count.bytes+bytes>100_000_000) fail('ACCOUNT_STORAGE_LIMIT','Account storage limit reached. Existing history remains available.',409);
    }
    for(const c of sorted) {db.prepare('INSERT INTO product_records(ns,key,owner_id,value,version,expires_at) VALUES(?,?,?,?,1,?) ON CONFLICT(ns,key) DO UPDATE SET value=excluded.value,version=product_records.version+1,expires_at=excluded.expires_at').run(c.ns,c.key,c.ownerId,JSON.stringify(c.value),c.expiresAt??null);}
    return {status:'applied'};
  }
  return {
    async get(ns,key){validateKey(ns,key);return get(ns,key);},
    async list(ns,{ownerId,prefix='',limit=100,afterKey}={}){validateKey(ns,prefix||'_');if(!Number.isSafeInteger(limit)||limit<1||limit>1000)fail('INVALID_RECORD','Invalid owned list.',400);if(afterKey!=null)validateKey(ns,afterKey);return db.prepare(`SELECT * FROM product_records WHERE ns=? AND (? IS NULL OR owner_id=?) AND substr(key,1,?)=? AND value<>'null' AND (? IS NULL OR key>?) ORDER BY key LIMIT ?`).all(ns,ownerId??null,ownerId??null,prefix.length,prefix,afterKey??null,afterKey??null,limit).map(decode);},
    async transact(changes){return transaction(()=>apply(changes));},
    identity(input){return transaction(()=>{
      if(input.operation==='create'){
        const u=input.user;
        try {db.prepare('INSERT INTO terminal_users(id,kind,email,password_hash,name,created_at,expires_at) VALUES(?,?,?,?,?,?,NULL)').run(u.id,'user',u.email,u.password_hash,u.name||'',u.created_at);db.prepare('INSERT INTO terminal_states(user_id,state) VALUES(?,?)').run(u.id,JSON.stringify(input.state));}
        catch(error){if(/UNIQUE|CONSTRAINT/.test(error.message))fail('ACCOUNT_UNAVAILABLE','Account creation could not be completed. Try signing in or recovering your account.',409);throw error;}
      }
      const result=apply(input.changes);
      if(result.status!=='applied')throw Object.assign(new Error('Identity state changed.'),{code:'IDENTITY_CONFLICT',status:409});
      if(input.operation==='password') {const r=db.prepare('UPDATE terminal_users SET password_hash=? WHERE id=? AND password_hash=?').run(input.passwordHash,input.userId,input.expectedPasswordHash);if(!r.changes)throw Object.assign(new Error('Account security changed. Retry.'),{code:'IDENTITY_CONFLICT',status:409});db.prepare('DELETE FROM terminal_sessions WHERE user_id=?').run(input.userId);db.prepare("UPDATE product_records SET value='null',version=version+1 WHERE ns='mfa_sessions' AND owner_id=?").run(input.userId);}
      return result;
    });},
  };
}
