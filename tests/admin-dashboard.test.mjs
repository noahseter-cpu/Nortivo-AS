import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler as createTicketsHandler} from '../netlify/functions/admin-tickets.mjs';
import {createCoreAdminFixture} from './helpers/core-admin.mjs';
const fixture = await createCoreAdminFixture();
test.after(() => fixture.close());
const createHandler = options => createTicketsHandler({...options, authorizeAdmin: fixture.authorizeAdmin});

// Isolated fixture process only; no real account, database or provider is used.
process.env.ADMIN_SESSION_SECRET='synthetic-admin-dashboard-session-secret-long-enough';
process.env.URL='https://nortivo.no';
delete process.env.DEPLOY_PRIME_URL;
delete process.env.DEPLOY_URL;
delete process.env.NETLIFY_DEV;
const NOW=Date.parse('2026-11-18T19:00:00Z');
const body=result=>JSON.parse(result.body);
const event=(params={},extra={})=>({httpMethod:'GET',rawUrl:'https://nortivo.no/.netlify/functions/admin-tickets',queryStringParameters:params,headers:{origin:'https://nortivo.no','content-type':'application/json',...fixture.headers()},...extra});
beforeEach(t=>{t.mock.method(globalThis,'fetch',async()=>{throw Error('External requests are forbidden in admin dashboard fixtures.');});t.mock.method(console,'error',()=>{});});

test('ticket pages retain the tickets shape, use a stable order and consume only one 201-row probe',async()=>{
 const rows=Array.from({length:201},(_,index)=>({id:`ticket-${200-index}`,created_at:'2026-11-18T12:00:00Z',subject:index===200?'probe-only-row':'Fixture ticket',status:'open'}));
 const queries=[];
 const handler=createHandler({query:async path=>{queries.push(path);return rows;}});
 const result=await handler(event({offset:'200',limit:'999999'}));
 assert.equal(result.statusCode,200);assert.equal(result.headers['Cache-Control'],'no-store');
 const data=body(result);assert.equal(data.tickets.length,200);assert.equal(data.tickets.some(ticket=>ticket.subject==='probe-only-row'),false);
 assert.deepEqual(data.page,{limit:200,offset:200,hasMore:true,nextOffset:400});assert.equal(queries.length,1);
 const params=new URL(queries[0],'https://database.invalid/').searchParams;
 assert.equal(params.get('order'),'created_at.desc,id.desc');assert.equal(params.get('limit'),'201');assert.equal(params.get('offset'),'200');
});

test('final/empty ticket pages and maximum offset expose honest bounded pagination',async()=>{
 for(const size of [0,199,200]){
  const handler=createHandler({query:async()=>Array.from({length:size},(_,id)=>({id}))});
  const data=body(await handler(event()));assert.equal(data.tickets.length,size);assert.deepEqual(data.page,{limit:200,offset:0,hasMore:false,nextOffset:null});
 }
 const handler=createHandler({query:async()=>Array.from({length:201},(_,id)=>({id}))});
 const data=body(await handler(event({offset:'100000'})));assert.deepEqual(data.page,{limit:200,offset:100000,hasMore:true,nextOffset:null});
});

test('invalid and excessive offsets fail before storage while bounded integer offsets remain valid',async()=>{
 let queries=0;const handler=createHandler({query:async()=>{queries++;return [];}});
 for(const offset of ['', '-1', '1.5', '1e3', '01', ' 200', '100001', '999999999999999999999', 'NaN', 200, ['200']]){
  const result=await handler(event({offset}));assert.equal(result.statusCode,400);assert.equal(body(result).code,'INVALID_OFFSET');
 }
 assert.equal(queries,0);
 for(const offset of ['0','200','99999','100000'])assert.equal((await handler(event({offset}))).statusCode,200);
 assert.equal(queries,4);
});

test('ticket detail and PATCH retain the existing contracts',async()=>{
 const calls=[],ticket={id:'fixture-id',status:'open'},replies=[{body:'Fixture reply'}];
 const handler=createHandler({query:async(path,options)=>{calls.push({path,options});return path.startsWith('ticket_replies?')?replies:[options?{...ticket,status:'closed'}:ticket];}});
 const detail=body(await handler(event({id:'fixture-id',offset:'invalid'})));assert.deepEqual(detail,{ticket,replies});assert.equal(calls.length,2);
 const updated=await handler(event({}, {httpMethod:'PATCH',body:JSON.stringify({id:'fixture-id',status:'closed'})}));assert.equal(updated.statusCode,200);assert.equal(body(updated).ticket.status,'closed');
 assert.equal(calls.at(-1).options.method,'PATCH');assert.equal(JSON.parse(calls.at(-1).options.body).status,'closed');
 const prior=calls.length;assert.equal((await handler(event({}, {httpMethod:'PATCH',body:JSON.stringify({id:'fixture-id',status:'deleted'})}))).statusCode,400);assert.equal(calls.length,prior);
});

test('ticket pages and operations require real admin proof and same-origin requests before any storage',async()=>{
 let queries=0;const handler=createHandler({query:async()=>{queries++;return [];},env:{PRODUCT_ENABLED:'true'},now:()=>NOW});
 for(const params of [{},{view:'operations'}]){
  for(const headers of [{},{cookie:'nortivo_admin=forged.signature'},{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.invalid'}])assert.equal((await handler(event(params,{headers}))).statusCode,401);
  const valid=event(params);
  for(const headers of [{...valid.headers,origin:'https://evil.test'},{...valid.headers,'sec-fetch-site':'cross-site'},{...valid.headers,origin:'https://invest.nortivo.no'}])assert.equal((await handler(event(params,{headers}))).statusCode,403);
 }
 assert.equal(queries,0);
});

test('operations returns only configuration facts, performs no storage/probes and never exposes secret values',async t=>{
 const secret='SYNTHETIC_PRIVATE_VALUE_NOT_FOR_RESPONSE';
 const env={PRODUCT_ENABLED:'true',TWELVE_DATA_API_KEY:secret,RESEND_API_KEY:secret,SUPPORT_FROM_EMAIL:'Private sender <private@example.invalid>',ADMIN_PASSWORD:secret,SUPABASE_SERVICE_ROLE_KEY:secret,PRODUCT_PROVIDER_RIGHTS_JSON:JSON.stringify({market:{provider:'twelve',documentRef:secret,validUntil:'2099-01-01',externalDisplay:true,markets:['US'],coverage:secret}})};
 let queries=0;const handler=createHandler({query:async()=>{queries++;throw Error(secret);},env,now:()=>NOW});
 const result=await handler(event({view:'operations'}));assert.equal(result.statusCode,200);assert.equal(queries,0);assert.equal(globalThis.fetch.mock.calls.length,0);
 const data=body(result);assert.deepEqual(Object.keys(data),['operations']);const info=data.operations;
 assert.equal(info.configurationOnly,true);assert.equal(info.checkedAt,new Date(NOW).toISOString());assert.equal(info.productEnabled,true);assert.equal(info.purchasesOpen,false);assert.equal(info.purchasesStatus,'unavailable');
 assert.deepEqual(info.services.map(service=>service.id),['market','news','calendar','ai','broker','email','payments']);
 assert.equal(info.services.find(service=>service.id==='market').configured,true);assert.equal(info.services.find(service=>service.id==='news').configured,false);
 for(const service of info.services){assert.deepEqual(Object.keys(service).sort(),['configured','id','label','reachability','status']);assert.equal(service.reachability,'not_checked');assert.equal(service.status,service.configured?'configured':'not_configured');}
 for(const forbidden of [secret,'private@example.invalid','ADMIN_PASSWORD','SUPABASE_SERVICE_ROLE_KEY','documentRef','providerAttempts','unresolvedOrders','accounts'])assert.equal(result.body.includes(forbidden),false);
});

test('complete configuration still never claims purchases or connections were verified',async()=>{
 const rights=Object.fromEntries([['market','twelve'],['news','finnhub'],['calendar','tradingeconomics']].map(([capability,provider])=>[capability,{provider,documentRef:'synthetic-approved-reference',validUntil:'2099-01-01',externalDisplay:true,markets:[capability==='calendar'?'global':'US']}]));
 const env={PRODUCT_ENABLED:'true',TWELVE_DATA_API_KEY:'synthetic',FINNHUB_API_KEY:'synthetic',TRADING_ECONOMICS_API_KEY:'synthetic',OPENAI_API_KEY:'synthetic',RESEND_API_KEY:'synthetic',SUPPORT_FROM_EMAIL:'Support <fixture@example.invalid>',PRODUCT_PROVIDER_RIGHTS_JSON:JSON.stringify(rights),STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_WEBHOOK_SECRET:'synthetic',STRIPE_PORTAL_CONFIGURATION:'bpc_synthetic',STRIPE_PRICE_PORTFOLIO_MONTH:'price_pm',STRIPE_PRICE_PORTFOLIO_YEAR:'price_py',STRIPE_PRICE_PRO_MONTH:'price_tm',STRIPE_PRICE_PRO_YEAR:'price_ty'};
 const handler=createHandler({query:async()=>{throw Error('No database access permitted');},env,now:()=>NOW});
 const info=body(await handler(event({view:'operations'}))).operations;
 assert.equal(info.purchasesOpen,null);assert.equal(info.purchasesStatus,'not_checked');assert.ok(info.services.every(service=>service.reachability==='not_checked'));
 const disabled=createHandler({query:async()=>[],env:{...env,PRODUCT_ENABLED:'false'},now:()=>NOW});assert.equal(body(await disabled(event({view:'operations'}))).operations.purchasesOpen,false);
});

test('unsupported administration views and storage errors remain bounded and private',async()=>{
 let queries=0;const handler=createHandler({query:async()=>{queries++;throw Error('SYNTHETIC_DATABASE_SECRET');}});
 assert.equal((await handler(event({view:'users'}))).statusCode,400);assert.equal(queries,0);
 const result=await handler(event());assert.equal(result.statusCode,503);assert.equal(body(result).code,'UNAVAILABLE');assert.equal(result.body.includes('SYNTHETIC_DATABASE_SECRET'),false);
});
