import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { commandDigest, equalToken, fail } from '../terminal/security.mjs';

export const THREAD = 'workflow_threads', REQUEST = 'workflow_requests', INDEX = 'workflow_index', RECEIPT = 'workflow_receipts';
export const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const referencePatterns = {nortivo:/^NR-[A-F0-9]{16}$/,korvnt:/^KR-[A-F0-9]{16}$/};
const denied = () => fail('NOT_FOUND', 'The requested record is unavailable.', 404);
export const invalid = () => fail('INVALID_BODY', 'Check the fields in your request.', 400);
const conflict = () => fail('CONFLICT', 'This record changed. Refresh and retry.', 409);
export const digest = value => createHash('sha256').update(value).digest('hex');
export function fields(object, allowed) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(key => !allowed.includes(key))) invalid();
}
export function line(value, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) invalid();
  return value.trim();
}
function oneOf(value, options) { if (!options.includes(value)) invalid(); return value; }
function uuid(value) { if (typeof value !== 'string' || !uuidPattern.test(value)) invalid(); return value; }
function reference(value,business) { if (typeof value !== 'string' || !referencePatterns[business].test(value)) invalid(); return value; }
const pending = (ns, key, ownerId, data) => ({ ns, key, ownerId, version: null, data });
const seqKey = (id, seq) => 'm:' + id + ':' + String(seq).padStart(8, '0');
export function repository(store, vault, business='nortivo') {
  // All pre-existing workflow_* rows and their original cryptographic purpose belong to Nortivo.
  // Trusted factory configuration chooses the physical namespaces before any read, list or write.
  const names=new Map([THREAD,REQUEST,INDEX,RECEIPT].map(ns=>[ns,business==='nortivo'?ns:ns.replace('workflow_','korvnt_')]));
  if(!Object.hasOwn(referencePatterns,business)) throw Error('Invalid workflow business.');
  const context=(ns,key,ownerId)=>({purpose:(business==='nortivo'?'workflow.':'korvnt.workflow.')+ns.slice(9),recordId:key,ownerId});
  const physical=ns=>{ if(!names.has(ns))throw Error('Unknown workflow namespace.');return names.get(ns); };
  const decode = (ns,row) => row && ({ ns, key:row.key, version:row.version, ownerId:row.ownerId, data:vault.open(row.value, context(ns,row.key,row.ownerId)) });
  return {
    get: async (ns,key) => decode(ns,await store.get(physical(ns),key)),
    list: async (ns,params) => (await store.list(physical(ns),params)).map(row=>decode(ns,row)),
    transact: rows => store.transact(rows.map(({ns,key,ownerId,version,data})=>({ns:physical(ns),key,ownerId,expectedVersion:version,value:data===null?null:vault.seal(data,context(ns,key,ownerId))}))),
  };
}

async function index(ctx, actor = ctx.actor) {
  return await ctx.db.get(INDEX,actor) || pending(INDEX,actor,actor,{ threads:[] });
}
async function thread(ctx,id,subject = ctx.actor) {
  const row = await ctx.db.get(THREAD,'t:' + uuid(id));
  if (!row || (!ctx.operator && row.data.subject !== subject)) denied();
  return row;
}
function header(row) {
  const {id,createdAt,updatedAt,state,count,requests} = row.data;
  return {id,createdAt,updatedAt,state,count,requests};
}
async function history(ctx,row,before) {
  const ceiling = before == null ? row.data.count + 1 : before;
  if (!Number.isSafeInteger(ceiling) || ceiling < 1 || ceiling > row.data.count + 1) invalid();
  const start = Math.max(1,ceiling - 40);
  const size = ceiling - start;
  const page = size ? await ctx.db.list(THREAD,{prefix:'m:'+row.data.id+':',afterKey:seqKey(row.data.id,start-1),limit:size}) : [];
  return {...header(row),messages:page.map(item=>item.data),earlier:start > 1 ? start : null};
}
async function current(ctx,id,changes,openRequired=false) {
  if (id) return thread(ctx,id);
  const owned = await index(ctx);
  if (owned.data.threads.length) {
    const existing=await thread(ctx,owned.data.threads.at(-1));
    if (!openRequired || existing.data.state==='open') return existing;
  }
  return newThread(ctx,owned,changes);
}
function newThread(ctx,owned,changes) {
  if(owned.data.threads.length>=32) fail('THREAD_LIMIT','This workspace has reached its conversation limit.',409);
  const threadId = randomUUID();
  const row = pending(THREAD,'t:'+threadId,ctx.actor,{id:threadId,subject:ctx.actor,createdAt:ctx.time,updatedAt:ctx.time,state:'open',count:0,requests:[]});
  owned.data.threads.push(threadId);
  changes.push(owned);
  return row;
}
function append(ctx,row,role,body,changes) {
  if (row.data.count >= 10000) fail('THREAD_LIMIT','This conversation has reached its message limit.',409);
  const seq = ++row.data.count;
  const entry = {seq,role,text:body,time:ctx.time};
  row.data.updatedAt = ctx.time;
  changes.push(pending(THREAD,seqKey(row.data.id,seq),row.ownerId,entry));
  return entry;
}

// The receipt and mutation share one compare-and-swap transaction. If the acknowledgment
// was lost, a retry returns the original result. No email is sent by this application.
async function once(ctx, action, body, work) {
  uuid(body.requestId);
  const owner = ctx.actor, key = digest([owner,action,body.requestId].join(':')), checksum = commandDigest(body);
  for (let attempt=0; attempt<6; attempt++) {
    const receipt = await ctx.db.get(RECEIPT,key);
    if (receipt) {
      if (receipt.data.checksum !== checksum) fail('IDEMPOTENCY_CONFLICT','Use the original submission to retry.',409);
      // Check access again: a guest receipt must not become a back door after a claim.
      if (receipt.data.guardThread) await thread(ctx,receipt.data.guardThread);
      return receipt.data.result;
    }
    const changes = [];
    const {result,guardThread=null,notification=null} = await work(changes);
    changes.push(pending(RECEIPT,key,owner,{checksum,result,guardThread,notification,time:ctx.time}));
    if ((await ctx.db.transact(changes)).status === 'applied') return result;
  }
  conflict();
}
function enquiryText(input,max,min=1) {
  const text=line(input,max,min);
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:seed phrase|recovery phrase|private key|password|passord|seedfrase|privatnøkkel|api[_ -]?key)\s*[:=]\s*\S|\b(?:0x)?[0-9a-f]{64}\b/i.test(text))
    fail('SENSITIVE_INPUT','Remove private credentials or evidence and provide a short general description.',400);
  return text;
}
function sent(ctx,row,changes,text,role) {
  if (row.data.state === 'closed') fail('THREAD_CLOSED','This conversation is closed.',409);
  const message = append(ctx,row,role,ctx.business==='korvnt'?enquiryText(text,2400):line(text,2400),changes);
  changes.push(row);
  return {guardThread:row.data.id,result:{threadId:row.data.id,message},notification:{recipient:role==='customer'?'operator':'customer',event:'message_saved'}};
}
export async function sessionView(ctx) {
  const mine = await index(ctx);
  const hasGuest = ctx.user && ctx.guest && (await index(ctx,ctx.guest)).data.threads.length > 0;
  return {mode:ctx.user?'account':'guest',scope:ctx.actor,threads:mine.data.threads,canClaim:Boolean(hasGuest)};
}
export async function chat(ctx,b) {
  switch (b.op) {
    case 'read': {
      fields(b,['op','id','before']);
      const id = b.id || (await index(ctx)).data.threads.at(-1);
      return {thread:id ? await history(ctx,await thread(ctx,id),b.before) : null};
    }
    case 'send':
      fields(b,['op','requestId','id','text']);
      return once(ctx,'customer-message',b,async changes=>sent(ctx,await current(ctx,b.id,changes),changes,b.text,'customer'));
    case 'start':
      fields(b,['op','requestId']);
      return once(ctx,'start-conversation',b,async changes=>{
        const fresh=ctx.business==='korvnt'?await current(ctx,null,changes,true):newThread(ctx,await index(ctx),changes);
        if(fresh.version===null) changes.push(fresh);
        return {guardThread:fresh.data.id,result:{threadId:fresh.data.id}};
      });
    case 'claim':
      fields(b,['op','requestId']);
      if (!ctx.user || !ctx.guest) denied();
      return once(ctx,'claim',b,async changes=>{
        const guestIndex=await index(ctx,ctx.guest), mine=await index(ctx);
        if (!guestIndex.data.threads.length || mine.data.threads.length>=32) denied();
        const row=await thread(ctx,guestIndex.data.threads.at(-1),ctx.guest);
        // Guest possession is required even when a verified account email matches.
        for (const ref of row.data.requests) {
          const req=await ctx.db.get(REQUEST,ref);
          if (!req || req.data.brief.email !== ctx.email) denied();
        }
        row.data.subject=ctx.actor;
        mine.data.threads.push(row.data.id); guestIndex.data.threads.pop();
        changes.push(row,mine,guestIndex);
        return {guardThread:row.data.id,result:{threadId:row.data.id}};
      });
    default: invalid();
  }
}

const common = ['kind','goal','existing','integration','analysis','rules','execution','safeguards','name','email','deliverable','budget','timeframe'];
function brief(input,ctx) {
  if(ctx.business==='korvnt') {
    fields(input,['kind','email','summary']);
    const kind=oneOf(input.kind,['cybersecurity','website-security','account-security','website-design','asset-recovery']);
    const email=line(input.email,160).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))invalid();
    return {kind,email,summary:enquiryText(input.summary,800,8)};
  }
  const kind = oneOf(input?.kind,['bot','engine']);
  const detail = kind==='bot'?'market':'components';
  fields(input,[...common,detail]);
  const b = {kind,goal:line(input.goal,1800,8),existing:line(input.existing,800),integration:line(input.integration,500),
    analysis:oneOf(input.analysis,['none','research','undecided']),rules:oneOf(input.rules,['existing','design','undecided']),
    execution:oneOf(input.execution,['analysis','paper','future','undecided']),safeguards:line(input.safeguards,800),
    [detail]:line(input[detail],500),name:line(input.name,120),email:line(input.email,160).toLowerCase(),
    deliverable:line(input.deliverable,800),budget:line(input.budget,160),timeframe:line(input.timeframe,160)};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) invalid();
  if (ctx.user && b.email !== ctx.email) fail('CONTACT_MISMATCH','Use the verified email for this account.',400);
  return b;
}
const requestInfo = row => ({ref:row.key,kind:row.data.brief.kind,state:row.data.state,createdAt:row.data.createdAt,updatedAt:row.data.updatedAt,followups:row.data.followups});
async function ownedRequest(ctx,ref,proof) {
  const row = await ctx.db.get(REQUEST,reference(ref,ctx.business));
  if (!row) denied();
  const original = await ctx.db.get(THREAD,'t:'+row.data.sourceThread);
  if (!original) denied();
  const accountBound = original.data.subject !== original.ownerId || row.data.accountBound;
  const isMine = original.data.subject === ctx.actor;
  if (!isMine && (accountBound || typeof proof !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(proof) || !equalToken(digest(proof),row.data.proofHash))) denied();
  return {...requestInfo(row),threadId:isMine ? row.data.threadId : null};
}
export async function project(ctx,b) {
  if (b.op==='track') {
    fields(b,['op','ref','proof']);
    return ownedRequest(ctx,b.ref,b.proof);
  }
  if (b.op!=='submit') invalid();
  const serviceEnquiry=ctx.business==='korvnt';
  const allowed=['op','requestId','brief','confirmed'];
  if(!serviceEnquiry) allowed.push('linkThreadId');
  fields(b,allowed);
  if (b.confirmed!==true) invalid();
  if ('linkThreadId' in b) uuid(b.linkThreadId);
  const details=brief(b.brief,ctx);
  return once(ctx,'project-submit',b,async changes=>{
    let t;
    if(serviceEnquiry) t=await current(ctx,null,changes,true);
    else if(b.linkThreadId) t=await thread(ctx,b.linkThreadId);
    else t=newThread(ctx,await index(ctx),changes);
    if(t.data.state!=='open') fail('THREAD_CLOSED','This conversation is closed.',409);
    if (t.data.requests.length>=20) fail('REQUEST_LIMIT','This conversation has reached its request limit.',409);
    const ref=(ctx.business==='korvnt'?'KR-':'NR-')+randomBytes(8).toString('hex').toUpperCase(), proof=randomBytes(32).toString('base64url');
    const row=pending(REQUEST,ref,ctx.actor,{brief:details,state:'received',createdAt:ctx.time,updatedAt:ctx.time,proofHash:digest(proof),sourceThread:t.data.id,threadId:t.data.id,accountBound:Boolean(ctx.user),followups:[]});
    t.data.requests.push(ref);
    append(ctx,t,'system','request_received:'+ref,changes);
    changes.push(t,row);
    return {guardThread:t.data.id,result:{...requestInfo(row),proof:ctx.user?null:proof,threadId:t.data.id},notification:{recipient:'operator',event:'project_received'}};
  });
}

const transitions = {received:['reviewing','needs_information','closed'],reviewing:['needs_information','closed'],needs_information:['reviewing','closed'],closed:['reviewing']};
export async function inbox(ctx,b) {
  switch (b.op) {
    case 'list': {
      fields(b,['op','kind','after']);
      const isRequest=oneOf(b.kind,['threads','requests'])==='requests';
      if (b.after && !(isRequest?referencePatterns[ctx.business]:/^t:[a-f0-9-]{36}$/).test(b.after)) invalid();
      const prefix=isRequest?(ctx.business==='korvnt'?'KR-':'NR-'):'t:';
      const rows=await ctx.db.list(isRequest?REQUEST:THREAD,{prefix,limit:26,afterKey:b.after});
      return {items:rows.slice(0,25).map(row=>isRequest?requestInfo(row):header(row)),next:rows.length>25?rows[24].key:null};
    }
    case 'read': fields(b,['op','id','before']); return {thread:await history(ctx,await thread(ctx,b.id),b.before)};
    case 'request': {
      fields(b,['op','ref']);
      const row=await ctx.db.get(REQUEST,reference(b.ref,ctx.business)); if (!row) denied();
      return {...requestInfo(row),brief:row.data.brief,threadId:row.data.threadId,allowed:transitions[row.data.state]};
    }
    case 'reply':
      fields(b,['op','requestId','id','text']);
      return once(ctx,'operator-reply',b,async changes=>sent(ctx,await thread(ctx,b.id),changes,b.text,'operator'));
    case 'state':
      fields(b,['op','requestId','id','state']);
      return once(ctx,'thread-state',b,async changes=>{
        const row=await thread(ctx,b.id); row.data.state=oneOf(b.state,['open','closed']);
        append(ctx,row,'system','thread_'+row.data.state,changes); changes.push(row);
        return {result:header(row)};
      });
    case 'followup':
      fields(b,['op','requestId','ref','state','text','threadId']);
      return once(ctx,'project-followup',b,async changes=>{
        const row=await ctx.db.get(REQUEST,reference(b.ref,ctx.business)); if (!row) denied();
        if (b.state!==row.data.state && !transitions[row.data.state].includes(b.state)) conflict();
        const t=await thread(ctx,b.threadId||row.data.threadId);
        const original=await thread(ctx,row.data.sourceThread);
        if (t.data.subject!==original.data.subject) denied();
        if (row.data.followups.length>=40) fail('REQUEST_LIMIT','This project has reached its follow-up limit.',409);
        const note=ctx.business==='korvnt'?enquiryText(b.text,800):line(b.text,800);
        row.data.threadId=t.data.id; row.data.state=b.state; row.data.updatedAt=ctx.time;
        row.data.followups.push({time:ctx.time,text:note,state:b.state});
        append(ctx,t,'operator',row.key+' · '+note,changes);
        changes.push(row,t);
        return {result:requestInfo(row),notification:{recipient:'customer',event:'project_followup_saved'}};
      });
    default: invalid();
  }
}
