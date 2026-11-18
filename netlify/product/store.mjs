import { fail } from '../terminal/security.mjs';

export const NAMESPACES = new Set(['accounts','portfolios','receipts','tokens','billing_customers','billing_events','billing_checkout','billing_previews','ai_usage','ai_requests','broker_connections','broker_states','order_intents','broker_events','strategies','jobs','worker_health','mfa','mfa_sessions','audit','mail_outbox','provider_health','provider_meter','provider_cache','worker_leases']);
export function validateChanges(changes) {
  if (!Array.isArray(changes) || !changes.length || changes.length>32 || Buffer.byteLength(JSON.stringify(changes))>4_000_000) fail('INVALID_RECORD','Invalid transaction size.',400);
  const seen=new Set();
  for (const c of changes) {
    validateKey(c.ns,c.key);
    if (typeof c.ownerId!=='string' || !/^(?:[a-f0-9-]{36}|system)$/.test(c.ownerId) || !(c.expectedVersion===null || Number.isSafeInteger(c.expectedVersion)&&c.expectedVersion>0) || !(c.value===null || c.value&&typeof c.value==='object'&&!Array.isArray(c.value)) || (c.expiresAt!=null && (!Number.isSafeInteger(c.expiresAt)||c.expiresAt<0))) fail('INVALID_RECORD','Invalid owned record.',400);
    if (c.value && Buffer.byteLength(JSON.stringify(c.value))>(c.ns==='portfolios'?2_000_000:250_000)) fail('RECORD_LIMIT','This record reached its storage limit.',409);
    const identity=`${c.ns}\0${c.key}`;
    if(seen.has(identity)) fail('INVALID_RECORD','A transaction contains duplicate records.',400);
    seen.add(identity);
  }
  return [...changes].sort((a,b)=>`${a.ns}:${a.key}`.localeCompare(`${b.ns}:${b.key}`));
}
export function validateKey(ns,key) { if(!NAMESPACES.has(ns)||typeof key!=='string'||!key.length||key.length>256||/[\u0000-\u001f]/.test(key)) fail('INVALID_RECORD','Invalid record address.',400); }
export function createProductRemoteStore(request) {
  return {
    async get(ns,key) { validateKey(ns,key); return request('rpc/product_get',{method:'POST',body:{p_ns:ns,p_key:key}}); },
    async list(ns,{ownerId,prefix='',limit=100,afterKey}={}) { validateKey(ns,prefix||'_'); if(!Number.isSafeInteger(limit)||limit<1||limit>1000) fail('INVALID_RECORD','Invalid owned list.',400); if(afterKey!=null)validateKey(ns,afterKey);return request(afterKey==null?'rpc/product_list':'rpc/product_list_page',{method:'POST',body:{p_ns:ns,p_owner:ownerId??null,p_prefix:prefix,p_limit:limit,...(afterKey==null?{}:{p_after:afterKey})}}); },
    async transact(changes) { return request('rpc/product_transact',{method:'POST',body:{p_changes:validateChanges(changes)}}); },
  };
}
