import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createCoreAdminFixture} from './helpers/core-admin.mjs';
import {createTerminalHandler} from '../netlify/functions/terminal.mjs';
import {createWorkflowInbox} from '../netlify/functions/workflow-inbox.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createLocalStore} from '../netlify/terminal/store-local.mjs';
import {project,digest,RECEIPT,THREAD} from '../netlify/conversations/model.mjs';
import {commandDigest} from '../netlify/terminal/security.mjs';

const origin='https://nortivo.no';
const uuid=()=>randomUUID();
const hash=s=>createHash('sha256').update(s).digest('hex');
const raw=()=>randomBytes(32).toString('base64url');
const blank={kind:'bot',goal:'Research a synthetic crypto market for a class.',existing:'Undecided',market:'Synthetic market',integration:'Undecided',analysis:'research',rules:'design',execution:'paper',safeguards:'Paper only',name:'Fixture Customer',email:'guest@example.invalid',deliverable:'Prototype scope',budget:'Undecided',timeframe:'Undecided'};
const send=(text,id)=>({op:'send',text,requestId:uuid(),...(id?{id}:{})});
const submit=(brief=blank)=>({op:'submit',brief,confirmed:true,requestId:uuid()});
async function setup(t) {
  let clock=Date.now();
  const now=()=>clock;
  const fx=await createCoreAdminFixture({now});t.after(fx.close);
  const env={...fx.env,PRODUCT_ENABLED:'true',WORKFLOW_VAULT_KEYS:JSON.stringify({test:randomBytes(32).toString('base64')}),WORKFLOW_VAULT_CURRENT:'test'};
  const logs=[];let broken=false;
  const sink=line=>{ if(broken)throw Error('fixture sink outage');logs.push(line); };
  const opts={store:fx.store,env,now,auditSink:sink,fetcher:async()=>{throw Error('External provider calls are disabled.');}};
  const handler=createTerminalHandler(opts), admin=createWorkflowInbox(opts);
  const adminAuth={cookie:fx.cookie,csrf:fx.csrfToken};
  async function call(route,body,auth={},override={}){
    const isAdmin=route==='inbox',method=body===undefined?'GET':'POST';
    const evt={rawUrl:origin+'/.netlify/functions/'+(isAdmin?'workflow-inbox':'terminal?action=workflow-'+route),httpMethod:method,
      queryStringParameters:isAdmin?{}:{action:'workflow-'+route},...(body===undefined?{}:{body:JSON.stringify(body)}),
      ...override,headers:{'x-nf-client-connection-ip':'local-fixture',origin,'content-type':'application/json',cookie:auth.cookie||'','x-csrf-token':auth.csrf||'',...override.headers}};
    const response=await (isAdmin?admin:handler)(evt);
    return {status:response.statusCode,body:JSON.parse(response.body),headers:response.headers};
  }
  async function boot(cookie=''){
    const result=await call('session',undefined,{cookie});assert.equal(result.status,200,JSON.stringify(result.body));
    return {cookie:[cookie,result.headers['Set-Cookie']?.split(';')[0]].filter(Boolean).join('; '),csrf:result.body.csrfToken,scope:result.body.scope,view:result.body};
  }
  async function account(email='signed-'+uuid()+'@example.invalid'){
    const id=uuid(),token=raw(),sessionHash=hash(token);
    await fx.store.createUser({id,kind:'user',email,name:'Local fixture',created_at:now(),expires_at:null},{});
    await fx.store.createSession({token_hash:sessionHash,user_id:id,created_at:now(),expires_at:now()+3600000});
    await fx.store.product.transact([{ns:'accounts',key:id,ownerId:id,expectedVersion:null,value:{emailVerified:true}}]);
    return {id,email,sessionHash,cookie:'nortivo_terminal='+token};
  }
  return {fx,env,logs,call,adminAuth,boot,account,advance:n=>clock+=n,breakAudit:()=>broken=true};
}

test('actual terminal and operator handlers exchange messages, paginate customer history, capture notifications locally, persist state and replay safe acknowledgements',async t=>{
  const c=await setup(t),guest=await c.boot();
  const message=send('A unique synthetic support question');
  const replies=await Promise.all(Array.from({length:5},()=>c.call('chat',message,guest)));
  for(const res of replies){assert.equal(res.status,200,JSON.stringify(res.body));assert.deepEqual(res.body,replies[0].body);}
  const id=replies[0].body.threadId;
  assert.equal((await c.call('chat',{...message,text:'changed'},guest)).status,409);
  const response={op:'reply',requestId:uuid(),id,text:'A synthetic human reply'};
  assert.equal((await c.call('inbox',response,c.adminAuth)).status,200);
  assert.equal((await c.call('inbox',response,c.adminAuth)).status,200);
  const history=await c.call('chat',{op:'read',id},guest);
  assert.deepEqual(history.body.thread.messages.map(v=>v.role),['customer','operator']);
  assert.ok(history.body.thread.messages.every(v=>Number.isSafeInteger(v.time)));
  assert.equal((await c.call('chat',{op:'read',id,before:2},guest)).body.thread.messages.length,1);
  assert.equal((await c.call('inbox',{op:'list',kind:'threads'},c.adminAuth)).body.items.length,1);
  assert.equal((await c.call('inbox',{op:'state',id,state:'closed',requestId:uuid()},c.adminAuth)).status,200);
  assert.equal((await c.call('chat',send('More',id),guest)).status,409);
  assert.equal((await c.call('chat',{op:'read',id},guest)).body.thread.state,'closed');
  const rows=await c.fx.store.product.list('workflow_receipts',{});
  assert.equal(rows.length,3);assert.ok(rows.every(r=>r.value.algorithm==='aes-256-gcm'));
  for(const value of [message.text,response.text,guest.cookie,guest.csrf,id])assert.ok(!c.logs.join('').includes(value));
  assert.match(history.headers['Cache-Control'],/no-store/);
  const next=await c.call('chat',{op:'start',requestId:uuid()},guest);assert.equal(next.status,200);assert.notEqual(next.body.threadId,id);
  const resumed=await c.call('chat',{op:'read'},guest);assert.equal(resumed.body.thread.id,next.body.threadId);assert.equal(resumed.body.thread.state,'open');
});

test('project submission and retrieval keep the tracking proof private, handle both services, allow authorized project follow-up, and deny cross-customer relinking',async t=>{
  const c=await setup(t),a=await c.boot(),b=await c.boot();
  const req=submit();
  const [one,two]=await Promise.all([c.call('request',req,a),c.call('request',req,a)]);
  assert.equal(one.status,200,JSON.stringify(one.body));assert.deepEqual(one.body,two.body);
  const {ref,threadId,proof}=one.body;assert.match(ref,/^NR-[A-F0-9]{16}$/);assert.match(proof,/^[A-Za-z0-9_-]{43}$/);
  assert.equal((await c.call('request',{op:'track',ref},b)).status,404);
  assert.equal((await c.call('request',{op:'track',ref,proof},b)).body.threadId,null);
  assert.equal((await c.call('request',{op:'track',ref,proof:'invalid'},b)).status,404);
  const other=await c.call('chat',send('Other customer thread'),b);
  const upd={op:'followup',ref,threadId,state:'needs_information',text:'Please clarify the paper test universe.',requestId:uuid()};
  assert.equal((await c.call('inbox',{...upd,threadId:other.body.threadId},c.adminAuth)).status,404);
  assert.equal((await c.call('inbox',{...upd,state:'accepted'},c.adminAuth)).status,409);
  assert.equal((await c.call('inbox',upd,c.adminAuth)).status,200);
  const track=await c.call('request',{op:'track',ref,proof},b);
  assert.equal(track.body.followups.length,1);assert.equal(track.body.state,'needs_information');assert.equal(track.body.brief,undefined);
  const hist=await c.call('chat',{op:'read',id:threadId},a);assert.equal(hist.body.thread.messages[1].text,ref+' · '+upd.text);
  const {market,...rest}=blank;
  assert.equal((await c.call('request',submit({...rest,kind:'engine',components:'Backtesting'}),a)).status,200);
  assert.equal((await c.call('request',submit({...blank,kind:'engine'}),a)).status,400);
  assert.equal((await c.call('request',{...submit(),confirmed:false},a)).status,400);
  for(const ns of ['workflow_threads','workflow_requests','workflow_receipts','workflow_index']){
    const records=await c.fx.store.product.list(ns,{});assert.ok(records.every(r=>r.value.algorithm==='aes-256-gcm'));
    const stored=JSON.stringify(records);for(const privateValue of [blank.email,blank.goal,proof,upd.text])assert.ok(!stored.includes(privateValue));
  }
});

test('verified account claim requires browser proof and matching verified project contact, ends guest and bearer access, and does not restore access to revoked accounts/sessions',async t=>{
  const c=await setup(t),guest=await c.boot(),other=await c.boot(),sent=send('Private example');
  const result=await c.call('chat',sent,guest),req={...submit(),linkThreadId:result.body.threadId};
  const project=await c.call('request',req,guest),{threadId,proof,ref}=project.body;
  const wrongAccount=await c.account(),wrong=await c.boot(wrongAccount.cookie+'; '+guest.cookie);
  assert.equal((await c.call('chat',{op:'claim',requestId:uuid()},wrong)).status,404);
  const right=await c.account(blank.email),withoutProof=await c.boot(right.cookie);
  assert.equal((await c.call('chat',{op:'claim',requestId:uuid()},withoutProof)).status,404);
  const verified=await c.boot(right.cookie+'; '+guest.cookie);
  assert.equal((await c.call('chat',{op:'claim',requestId:uuid()},verified)).status,200);
  for(const who of [guest,other,wrong]){
    assert.equal((await c.call('chat',{op:'read',id:result.body.threadId},who)).status,404);
    assert.equal((await c.call('request',{op:'track',ref,proof},who)).status,404);
  }
  assert.equal((await c.call('chat',sent,guest)).status,404);
  assert.equal((await c.call('request',req,guest)).status,404);
  assert.equal((await c.call('chat',{op:'read',id:threadId},verified)).status,200);
  await c.fx.store.product.transact([{ns:'accounts',key:right.id,ownerId:right.id,expectedVersion:1,value:{emailVerified:true,disabled:true}}]);
  assert.equal((await c.call('chat',{op:'read',id:threadId},verified)).status,403);
  await c.fx.store.deleteSession(right.sessionHash);
  assert.equal((await c.call('chat',{op:'read',id:threadId},verified)).status,401);
});

test('Invest requests create separate case threads unless an owned open conversation is explicitly selected',async t=>{
  const c=await setup(t),owner=await c.boot(),stranger=await c.boot();
  const support=(await c.call('chat',send('A reported support question'),owner)).body.threadId;
  const foreign=(await c.call('chat',send('Separate customer contact'),stranger)).body.threadId;
  const separate=submit();
  const first=await c.call('request',separate,owner);
  assert.equal(first.status,200);assert.notEqual(first.body.threadId,support);
  const next=await c.call('request',submit(),owner);
  assert.equal(next.status,200);assert.notEqual(next.body.threadId,first.body.threadId);
  assert.deepEqual((await c.call('chat',{op:'read',id:support},owner)).body.thread.requests,[]);
  assert.deepEqual((await c.call('request',separate,owner)).body,first.body);
  const linked={...submit(),linkThreadId:support};
  const [one,two]=await Promise.all([c.call('request',linked,owner),c.call('request',linked,owner)]);
  assert.equal(one.status,200);assert.equal(one.body.threadId,support);assert.deepEqual(one.body,two.body);
  assert.deepEqual((await c.call('chat',{op:'read',id:support},owner)).body.thread.requests,[one.body.ref]);
  assert.equal((await c.call('request',{...linked,linkThreadId:first.body.threadId},owner)).status,409);
  assert.equal((await c.call('request',{...submit(),linkThreadId:foreign},owner)).status,404);
  assert.equal((await c.call('request',{...submit(),linkThreadId:null},owner)).status,400);
  assert.equal((await c.call('request',{op:'track',ref:one.body.ref,proof:one.body.proof},stranger)).body.threadId,null);
  await c.call('inbox',{op:'state',id:support,state:'closed',requestId:uuid()},c.adminAuth);
  assert.equal((await c.call('request',{...submit(),linkThreadId:support},owner)).status,409);
  // The original receipt survives closure. A retry must not consult current link eligibility.
  assert.deepEqual((await c.call('request',linked,owner)).body,one.body);
});

test('a pre-link-field receipt still resolves to its original support thread and rechecks ownership',async()=>{
  const actor=uuid(),id=uuid(),body=submit();
  const receipt={ref:'NR-1111111111111111',threadId:id,state:'received',proof:raw()};
  let subject=actor;
  const db={get:async(ns,key)=>{
    if(ns===RECEIPT&&key===digest([actor,'project-submit',body.requestId].join(':')))
      return {data:{checksum:commandDigest(body),guardThread:id,result:receipt}};
    if(ns===THREAD&&key==='t:'+id)return {data:{id,subject,state:'closed'}};
    assert.fail('Legacy replay must never create a new case.');
  }};
  assert.deepEqual(await project({business:'nortivo',actor,db},body),receipt);
  subject=uuid();
  await assert.rejects(project({business:'nortivo',actor,db},body),error=>error.code==='NOT_FOUND');
});

test('starting from an older closed conversation creates one new thread even when a newer case is open',async t=>{
  const c=await setup(t),guest=await c.boot();
  const older=(await c.call('chat',send('Older customer contact'),guest)).body.threadId;
  const newer=(await c.call('request',submit(),guest)).body.threadId;
  assert.notEqual(older,newer);
  await c.call('inbox',{op:'state',id:older,state:'closed',requestId:uuid()},c.adminAuth);
  assert.equal((await c.call('chat',{op:'read',id:older},guest)).body.thread.state,'closed');
  const command={op:'start',requestId:uuid()};
  const [first,retry]=await Promise.all([c.call('chat',command,guest),c.call('chat',command,guest)]);
  assert.equal(first.status,200);assert.deepEqual(retry.body,first.body);
  const id=first.body.threadId;
  assert.notEqual(id,older);assert.notEqual(id,newer);
  const fresh=(await c.call('chat',{op:'read',id},guest)).body.thread;
  assert.equal(fresh.state,'open');assert.deepEqual(fresh.requests,[]);assert.deepEqual(fresh.messages,[]);
});

test('reject foreign origins, malformed or unsupported payloads, missing CSRF, customer impersonation, missing MFA and stale/revoked operator sessions',async t=>{
  const c=await setup(t),g=await c.boot(),m=send('Synthetic');
  for(const headers of [{origin:'https://elsewhere.invalid'},{origin:''},{'sec-fetch-site':'cross-site'}])assert.equal((await c.call('chat',m,g,{headers})).status,403);
  assert.equal((await c.call('chat',m,{cookie:g.cookie})).status,403);
  assert.equal((await c.call('chat',m,g,{headers:{'content-type':'text/plain'}})).status,415);
  assert.equal((await c.call('chat',m,g,{body:'{'})).status,400);
  assert.equal((await c.call('chat',m,g,{body:'x'.repeat(24001)})).status,413);
  assert.equal((await c.call('chat',{...m,role:'operator'},g)).status,400);
  assert.equal((await c.call('chat',{...m,attachments:['private']},g)).status,400);
  assert.equal((await c.call('chat',{...m,text:''},g)).status,400);
  const op={op:'list',kind:'threads'};
  assert.equal((await c.call('inbox',op,g)).status,401);
  assert.equal((await c.call('inbox',op,{cookie:c.adminAuth.cookie})).status,403);
  const expired=await c.fx.store.product.get('mfa_sessions',c.fx.sessionHash);
  await c.fx.store.product.transact([{ns:'mfa_sessions',key:c.fx.sessionHash,ownerId:c.fx.userId,expectedVersion:expired.version,value:null}]);
  assert.equal((await c.call('inbox',op,c.adminAuth)).status,403);
  await c.fx.store.deleteSession(c.fx.sessionHash);assert.equal((await c.call('inbox',op,c.adminAuth)).status,401);
});

test('atomic subject budget survives concurrent writes and recovers, and the database enforces guest expiry',async t=>{
  const c=await setup(t),g=await c.boot(),m=send('Only one logical message');
  const results=await Promise.all(Array.from({length:26},()=>c.call('chat',m,g)));
  assert.equal(results.filter(r=>r.status===200).length,24);
  assert.equal(results.filter(r=>r.status===429).length,2);
  c.advance(60001);
  assert.equal((await c.call('chat',m,g)).status,200);
  c.advance(30*86400000);
  assert.equal((await c.call('chat',{op:'read'},g)).status,401);
  const renewed=await c.call('session',undefined,g);assert.equal(renewed.status,200);assert.notEqual(renewed.body.scope,g.scope);
  assert.deepEqual(renewed.body.threads,[]);
});

test('operator availability requires an explicit fresh named MFA session and expires or disappears after revocation',async t=>{
  const c=await setup(t),g=await c.boot();
  assert.equal(g.view.availability,'asynchronous');
  const b={op:'availability',available:true};
  assert.equal((await c.call('inbox',b,g)).status,401);
  assert.equal((await c.call('inbox',b,c.adminAuth)).status,200);
  const online=await c.call('session',undefined,g);assert.equal(online.body.availability,'online');assert.equal(online.body.availabilityLeaseMs,45000);
  assert.ok(!JSON.stringify(online.body).includes(c.fx.sessionHash));assert.ok(!JSON.stringify(online.body).includes(c.fx.userId));
  c.advance(45001);assert.equal((await c.call('session',undefined,g)).body.availability,'asynchronous');
  assert.equal((await c.call('inbox',b,c.adminAuth)).status,200);
  await c.fx.store.deleteSession(c.fx.sessionHash);
  assert.equal((await c.call('session',undefined,g)).body.availability,'asynchronous');
});

test('sealed guest conversation and identity survive a file-backed SQLite close and reopen',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nortivo-workflow-test-'));
  const file=path.join(dir,'workflow.sqlite');let store=await createLocalStore(file);
  t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});
  const env={URL:origin,PRODUCT_ENABLED:'true',TERMINAL_SESSION_SECRET:raw(),WORKFLOW_VAULT_KEYS:JSON.stringify({test:randomBytes(32).toString('base64')}),WORKFLOW_VAULT_CURRENT:'test'};
  const make=()=>createTerminalHandler({store,env,auditSink:()=>{},fetcher:async()=>{throw Error('Unexpected network');}});
  let handler=make();
  async function call(op,body={},cookie='',csrf='') {
    return handler({httpMethod:op==='session'?'GET':'POST',rawUrl:origin+'/.netlify/functions/terminal?action=workflow-'+op,headers:{cookie,origin,'content-type':'application/json','x-csrf-token':csrf},...(op==='session'?{}:{body:JSON.stringify(body)})});
  }
  const bootstrap=await call('session');assert.equal(bootstrap.statusCode,200);
  const cookie=bootstrap.headers['Set-Cookie'].split(';')[0], csrf=JSON.parse(bootstrap.body).csrfToken;
  const message=send('Persist through local restart');
  const result=await call('chat',message,cookie,csrf);assert.equal(result.statusCode,200);
  store.close();store=await createLocalStore(file);handler=make();
  assert.equal((await call('chat',message,cookie,csrf)).body,result.body);
  const history=await call('chat',{op:'read'},cookie,csrf);
  assert.equal(JSON.parse(history.body).thread.messages.length,1);
});

test('vault rejects context swaps and tampered data at the handler, and dependency failures are bounded',async t=>{
  const c=await setup(t),g=await c.boot(),s=await c.call('chat',send('Private ciphertext path'),g);
  const key='t:'+s.body.threadId,row=await c.fx.store.product.get('workflow_threads',key);
  const messages=await c.fx.store.product.list('workflow_threads',{prefix:'m:'});
  await c.fx.store.product.transact([{ns:'workflow_threads',key,ownerId:row.ownerId,expectedVersion:row.version,value:messages[0].value}]);
  let r=await c.call('chat',{op:'read',id:s.body.threadId},g);assert.equal(r.status,503);assert.ok(!JSON.stringify(r.body).includes(row.value.keyId));
  const updated=await c.fx.store.product.get('workflow_threads',key),tag=Buffer.from(row.value.tag,'base64');tag[0]^=1;
  await c.fx.store.product.transact([{ns:'workflow_threads',key,ownerId:row.ownerId,expectedVersion:updated.version,value:{...row.value,tag:tag.toString('base64')}}]);
  assert.equal((await c.call('chat',{op:'read',id:s.body.threadId},g)).status,503);
  c.breakAudit();
  const before=(await c.fx.store.product.list('workflow_requests',{})).length;
  assert.equal((await c.call('request',submit(),g)).status,503);
  assert.equal((await c.fx.store.product.list('workflow_requests',{})).length,before);
  c.fx.store.consumeRateLimit=async()=>{throw Error('secret fixture dependency diagnostic');};
  r=await c.call('session',undefined,g);assert.equal(r.status,503);
  assert.ok(!JSON.stringify(r.body).includes('diagnostic'));
});
