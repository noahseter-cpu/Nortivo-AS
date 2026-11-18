import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createCoreAdminFixture} from './helpers/core-admin.mjs';
import {createKorvntService} from '../netlify/functions/korvnt-service.mjs';
import {createKorvntInbox} from '../netlify/functions/korvnt-inbox.mjs';
import {createWorkflowInbox} from '../netlify/functions/workflow-inbox.mjs';
import {createTerminalHandler} from '../netlify/functions/terminal.mjs';
import {createAdminSecurity} from '../netlify/security-core/admin.mjs';

const parent='https://nortivo.no',standalone='https://korvnt.no';
const key=()=>randomBytes(32).toString('base64');
const services=['cybersecurity','website-security','account-security','website-design','asset-recovery'];
const submit=(kind=services[0])=>({op:'submit',confirmed:true,requestId:randomUUID(),brief:{kind,email:'fixture@example.invalid',summary:'Please review this synthetic request.'}});
const send=(text,id)=>({op:'send',requestId:randomUUID(),text,...(id?{id}:{})});

async function fixture(t) {
  let time=Date.now();
  const now=()=>time,fx=await createCoreAdminFixture({now});t.after(fx.close);
  const env={...fx.env,KORVNT_SITE_READY:'true',KORVNT_SESSION_SECRET:key(),WORKFLOW_VAULT_CURRENT:'parent',WORKFLOW_VAULT_KEYS:JSON.stringify({parent:key()}),KORVNT_VAULT_CURRENT:'daughter',KORVNT_VAULT_KEYS:JSON.stringify({daughter:key()}),KORVNT_OPERATOR_USER_IDS:fx.userId};
  const lines=[];
  const options={store:fx.store,env,now,auditSink:line=>lines.push(line),fetcher:async()=>{throw Error('No external access');}};
  const endpoints={terminal:createTerminalHandler(options),'korvnt-service':createKorvntService(options),'korvnt-inbox':createKorvntInbox(options),'workflow-inbox':createWorkflowInbox(options),'admin-session':createAdminSecurity(options).session};
  async function call(endpoint,action,body,auth={},origin=endpoint==='korvnt-service'?standalone:parent,extra={}) {
    const query=action?'?action=workflow-'+action:'';
    const event={rawUrl:origin+'/.netlify/functions/'+endpoint+query,httpMethod:body?'POST':'GET',headers:{origin,'content-type':'application/json','x-nf-client-connection-ip':'synthetic',cookie:auth.cookie||'','x-csrf-token':auth.csrf||'',...extra},...(body?{body:JSON.stringify(body)}:{})};
    const result=await endpoints[endpoint](event);
    return {status:result.statusCode,body:JSON.parse(result.body),headers:result.headers};
  }
  async function boot(endpoint,origin,cookie) {
    const res=await call(endpoint,'session',null,{cookie},origin);
    assert.equal(res.status,200,JSON.stringify(res.body));
    return {scope:res.body.scope,csrf:res.body.csrfToken,cookie:res.headers['Set-Cookie']?.split(';')[0]||cookie,result:res};
  }
  return {fx,env,options,call,boot,lines,admin:{cookie:fx.cookie,csrf:fx.csrfToken},advance:ms=>time+=ms};
}

test('KORVNT accepts five minimal enquiries and keeps contact, messages, guest proofs and receipts encrypted in daughter-only namespaces',async t=>{
  const c=await fixture(t),g=await c.boot('korvnt-service');
  assert.equal(g.result.body.business,'korvnt');assert.equal(g.result.body.mode,'guest');
  assert.match(g.result.headers['Set-Cookie'],/^__Host-korvnt_workflow=/);assert.doesNotMatch(g.result.headers['Set-Cookie'],/Domain=/i);
  for(const kind of services){
    const body=submit(kind);const [a,b]=await Promise.all([c.call('korvnt-service','request',body,g),c.call('korvnt-service','request',body,g)]);
    assert.equal(a.status,200,JSON.stringify(a.body));assert.deepEqual(a.body,b.body);assert.match(a.body.ref,/^KR-[A-F0-9]{16}$/);
    assert.equal((await c.call('korvnt-inbox',null,{op:'request',ref:a.body.ref},c.admin)).body.brief.kind,kind);
    assert.equal((await c.call('korvnt-service','request',{op:'track',ref:a.body.ref},g)).body.brief,undefined);
    assert.ok(!c.lines.join('').includes(a.body.proof));
  }
  for(const ns of ['threads','requests','receipts','index']){
    const records=await c.fx.store.product.list('korvnt_'+ns,{});
    assert.ok(records.length>0);assert.ok(records.every(r=>r.value.algorithm==='aes-256-gcm' && r.value.keyId==='daughter'));
    assert.ok(!JSON.stringify(records).includes('fixture@example.invalid'));assert.ok(!JSON.stringify(records).includes('synthetic request.'));
    assert.equal((await c.fx.store.product.list('workflow_'+ns,{})).length,0);
  }
  const parentList=await c.call('workflow-inbox',null,{op:'list',kind:'requests'},c.admin);
  assert.deepEqual(parentList.body.items,[]);assert.ok(!c.lines.join('').includes(g.cookie));
});

test('a parent cookie, private record ID, staff cookie and forged business fields cannot read the other company',async t=>{
  const c=await fixture(t),n=await c.boot('terminal'),k=await c.boot('korvnt-service',standalone,n.cookie+'; '+c.admin.cookie);
  assert.equal(k.result.body.business,'korvnt');assert.equal(k.result.body.verifiedEmail,null);assert.notEqual(k.scope,n.scope);
  const a=(await c.call('terminal','chat',send('Parent only sample'),n)).body;
  const b=(await c.call('korvnt-service','chat',send('Daughter only sample'),k)).body;
  for(const [endpoint,id,auth] of [['terminal',b.threadId,n],['korvnt-service',a.threadId,k]])
    assert.equal((await c.call(endpoint,'chat',{op:'read',id},auth)).status,404);
  for(const [endpoint,id] of [['workflow-inbox',b.threadId],['korvnt-inbox',a.threadId]])
    assert.equal((await c.call(endpoint,null,{op:'read',id},c.admin)).status,404);
  assert.equal((await c.call('korvnt-service','chat',{op:'read',id:a.threadId,business:'nortivo'},k)).status,400);
  assert.equal((await c.call('korvnt-service','chat',send('forged'),n)).status,401);
  assert.equal((await c.call('korvnt-service','chat',{op:'claim',requestId:randomUUID()},k)).status,404);
  assert.equal((await c.call('korvnt-service','request',submit('bot'),k)).status,400);
});

test('cross-host, CSRF, foreign grant, mutation, file and sensitive credential attempts fail closed',async t=>{
  const c=await fixture(t),g=await c.boot('korvnt-service'),b=submit();
  for(const origin of [parent,'https://invest.nortivo.no','https://www.korvnt.no','https://untrusted.invalid'])
    assert.equal((await c.call('korvnt-service','session',null,{},origin)).status,403);
  for(const name of ['korvnt-inbox','workflow-inbox','admin-session']){
    const res=await c.call(name,null,name==='admin-session'?null:{op:'list',kind:'threads'},c.admin,standalone);
    assert.equal(res.status,403);
  }
  assert.equal((await c.call('terminal','session',null,{},standalone)).status,403);
  for(const headers of [{origin:parent},{origin:''},{'sec-fetch-site':'cross-site'},{'x-csrf-token':'wrong'}])
    assert.equal((await c.call('korvnt-service','request',b,g,standalone,headers)).status,403);
  for(const extra of [{files:[]},{attachments:['evidence']},{seedPhrase:'synthetic'},{privateKey:'synthetic'},{business:'nortivo'}])
    assert.equal((await c.call('korvnt-service','request',{...b,brief:{...b.brief,...extra}},g)).status,400);
  assert.equal((await c.call('korvnt-service','request',{...b,brief:{...b.brief,summary:'password: synthetic-only'}},g)).status,400);
  assert.equal((await c.call('korvnt-service','request',b,g,standalone,{'content-type':'multipart/form-data'})).status,415);
  assert.equal((await c.call('korvnt-service','request',{...b,brief:{...b.brief,summary:'a'.repeat(25000)}},g)).status,413);
  assert.equal((await c.fx.store.product.list('korvnt_requests',{})).length,0);
  c.env.KORVNT_SITE_READY='false';assert.equal((await c.call('korvnt-service','session',null)).status,503);
});

test('KORVNT follow-up, tracking, presence and authorization require the current business and fresh named MFA',async t=>{
  const c=await fixture(t),g=await c.boot('korvnt-service'),second=await c.boot('korvnt-service');
  const req=(await c.call('korvnt-service','request',submit(),g)).body;
  assert.equal((await c.call('korvnt-service','request',{op:'track',ref:req.ref},second)).status,404);
  const follow={op:'followup',ref:req.ref,text:'Synthetic follow-up from KORVNT',state:'needs_information',requestId:randomUUID()};
  assert.equal((await c.call('korvnt-inbox',null,follow,c.admin)).status,200);
  const tracked=await c.call('korvnt-service','request',{op:'track',ref:req.ref,proof:req.proof},second);
  assert.equal(tracked.body.state,'needs_information');assert.equal(tracked.body.threadId,null);
  const hist=await c.call('korvnt-service','chat',{op:'read',id:req.threadId},g);assert.equal(hist.body.thread.messages.at(-1).role,'operator');
  const on={op:'availability',available:true},list={op:'list',kind:'threads'};
  assert.equal((await c.call('korvnt-inbox',null,on,c.admin)).status,200);
  assert.equal((await c.call('korvnt-service','session',null,g)).body.availability,'online');
  assert.equal((await c.call('terminal','session',null)).body.availability,'asynchronous');
  c.env.KORVNT_OPERATOR_USER_IDS='';assert.equal((await c.call('korvnt-inbox',null,list,c.admin)).status,403);
  assert.equal((await c.call('korvnt-service','session',null,g)).body.availability,'asynchronous');
  assert.equal((await c.call('workflow-inbox',null,list,c.admin)).status,200);
  c.env.KORVNT_OPERATOR_USER_IDS=c.fx.userId;c.advance(5*60000);assert.equal((await c.call('korvnt-inbox',null,list,c.admin)).status,403);
  await c.fx.store.deleteSession(c.fx.sessionHash);assert.equal((await c.call('korvnt-inbox',null,list,c.admin)).status,401);
});

test('cross-company ciphertext or missing independent configuration cannot silently fall back to Nortivo data or keys',async t=>{
  const c=await fixture(t),g=await c.boot('korvnt-service'),n=await c.boot('terminal');
  const kmsg=(await c.call('korvnt-service','chat',send('Private daughter text'),g)).body;
  const nmsg=(await c.call('terminal','chat',send('Private parent text'),n)).body;
  const a=await c.fx.store.product.get('korvnt_threads','t:'+kmsg.threadId),b=await c.fx.store.product.get('workflow_threads','t:'+nmsg.threadId);
  await c.fx.store.product.transact([{ns:'korvnt_threads',key:a.key,ownerId:a.ownerId,expectedVersion:a.version,value:b.value}]);
  assert.equal((await c.call('korvnt-service','chat',{op:'read',id:kmsg.threadId},g)).status,503);
  const evt={httpMethod:'GET',rawUrl:standalone+'/.netlify/functions/korvnt-service?action=workflow-session',headers:{}};
  for(const change of [{KORVNT_SESSION_SECRET:c.env.TERMINAL_SESSION_SECRET},{KORVNT_VAULT_KEYS:undefined},{KORVNT_VAULT_KEYS:c.env.WORKFLOW_VAULT_KEYS,KORVNT_VAULT_CURRENT:c.env.WORKFLOW_VAULT_CURRENT}]){
    const res=await createKorvntService({...c.options,env:{...c.env,...change}})(evt);assert.equal(res.statusCode,503);
  }
});

test('KORVNT guest logout revokes the server credential and leaves the parent guest session independent',async t=>{
  const c=await fixture(t),g=await c.boot('korvnt-service'),n=await c.boot('terminal');
  const {threadId}= (await c.call('korvnt-service','chat',send('Logout fixture'),g)).body;
  assert.equal((await c.call('korvnt-service','session-end',{},g,standalone,{'x-csrf-token':''})).status,403);
  assert.equal((await c.call('korvnt-service','chat',{op:'read',id:threadId},g)).status,200);
  const stopped=await c.call('korvnt-service','session-end',{},g);assert.equal(stopped.status,200);assert.equal(stopped.body.ended,true);
  assert.match(stopped.headers['Set-Cookie'],/Max-Age=0/);
  assert.equal((await c.call('korvnt-service','chat',{op:'read',id:threadId},g)).status,401);
  const restored=await c.boot('korvnt-service',standalone,g.cookie);assert.notEqual(restored.scope,g.scope);assert.deepEqual(restored.result.body.threads,[]);
  assert.equal((await c.call('terminal','session',null,n)).body.scope,n.scope);
});
