import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createLocalStore} from '../netlify/terminal/store-local.mjs';
import {createInitialState} from '../netlify/terminal/engine.mjs';
import {createTerminalHandler} from '../netlify/functions/terminal.mjs';
import {createNortivoDataProviders} from '../netlify/product/providers-nortivo.mjs';
import {createOwnerGrant} from '../netlify/product/owner.mjs';
import {sha256,csrfToken} from '../netlify/terminal/security.mjs';

const USER='a1111111-1111-4111-8111-111111111111',NOW=Date.parse('2026-11-18T19:00:00Z'),ORIGIN='https://invest.nortivo.no';
const ENV={PRODUCT_ENABLED:'true',TERMINAL_ORIGIN:ORIGIN,TERMINAL_SESSION_SECRET:'a-fixture-session-secret-with-thirty-two-characters',PRODUCT_OWNER_MARKET_PROVIDER:'nortivo',APCA_API_KEY_ID:'fixture-public-metadata-key',APCA_API_SECRET_KEY:'fixture-public-metadata-secret'};
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
async function fixture(t,{limit=180}={}){
 const legacy=await createLocalStore(':memory:');t.after(()=>legacy.close());let time=NOW;
 await legacy.createUser({id:USER,kind:'user',email:'performance-fixture@example.test',password_hash:'unused-fixture-hash',created_at:NOW,expires_at:null},createInitialState({now:NOW}));
 await legacy.product.transact([{ns:'accounts',key:USER,ownerId:USER,expectedVersion:null,value:{emailVerified:true,access:createOwnerGrant(NOW),billing:{status:'none',paidUntil:null}}}]);
 const raw=crypto.randomBytes(32).toString('base64url'),hash=sha256(raw);await legacy.createSession({token_hash:hash,user_id:USER,created_at:NOW,expires_at:NOW+86400000});
 const counts=new Map(),upstream=[];let activeReads=0,peakReads=0;
 for(const method of ['get','list','transact']){
  const original=legacy.product[method].bind(legacy.product);
  legacy.product[method]=async(...args)=>{
   const key=method==='transact'?'transact':method+':'+args[0]+(method==='get'?':'+args[1]:'');
   counts.set(key,(counts.get(key)||0)+1);
   if(method!=='transact'){activeReads++;peakReads=Math.max(peakReads,activeReads);await new Promise(resolve=>setImmediate(resolve));}
   try{return await original(...args);}finally{if(method!=='transact')activeReads--;}
  };
 }
 const fetcher=async value=>{
  const url=new URL(value);upstream.push(url.pathname);
  if(url.pathname==='/v2/assets')return json([{id:'fixture-asset',class:'us_equity',exchange:'NASDAQ',symbol:'AAPL',name:'Apple Inc.',status:'active'}]);
  if(url.pathname.startsWith('/v2/assets/'))return json({id:'fixture-asset',class:'us_equity',exchange:'NASDAQ',symbol:'AAPL',name:'Apple Inc.',status:'active'});
  if(url.pathname.endsWith('/trades/latest'))return json({symbol:'AAPL',trade:{p:100,s:10,t:new Date(time-2000).toISOString(),i:42}});
  if(url.pathname.endsWith('/bars'))return json({symbol:'AAPL',bars:[{t:new Date(time-600000).toISOString(),o:100,h:102,l:99,c:101,v:20,n:10,vw:100.5}],next_page_token:null});
  throw Error('Unexpected fixture network request.');
 };
 const env={...ENV,PRODUCT_ALPACA_CREDITS_PER_MINUTE:String(limit)},handler=createTerminalHandler({store:legacy,env,now:()=>time,fetcher});
 const request=async(action,{params={},headers={},body}={})=>{
  const query=new URLSearchParams({action,...params});
  return handler({httpMethod:body===undefined?'GET':'POST',rawUrl:ORIGIN+'/.netlify/functions/terminal?'+query,queryStringParameters:Object.fromEntries(query),headers:{origin:ORIGIN,cookie:'nortivo_terminal='+raw,'content-type':'application/json','x-csrf-token':csrfToken(raw,env.TERMINAL_SESSION_SECRET),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 };
 return {legacy,env,fetcher,request,counts,upstream,hash,advance(ms){time+=ms;},clock:()=>time,get peakReads(){return peakReads;}};
}

test('snapshot reads account/market/broker once and overlaps independent evidence reads',async t=>{
 const f=await fixture(t);const result=await f.request('product');assert.equal(result.statusCode,200);
 assert.equal(f.counts.get('get:accounts:'+USER),1);
 assert.equal(f.counts.get('get:provider_health:owner_market'),1);
 assert.equal(f.counts.get('list:broker_connections'),1);
 assert.equal(f.counts.get('get:ai_usage:'+USER+':2026-11'),1);
 assert.equal([...f.counts].reduce((sum,[key,value])=>sum+(key==='transact'?0:value),0),12);
 assert.ok(f.peakReads>=3);assert.equal(f.upstream.length,0);
 const data=JSON.parse(result.body);assert.equal(data.entitlements.reason,'owner');assert.equal(data.capabilities.admin,true);
});

test('chart request skips unrelated readiness and repeats neither account nor public listing lookups',async t=>{
 const f=await fixture(t),params={instrumentId:'XNAS:AAPL:USD',resolution:'5min'};
 assert.equal((await f.request('product-quotes',{params})).statusCode,200);
 assert.equal(f.counts.get('get:accounts:'+USER),1);
 for(const scope of ['news','calendar','ai','broker','email'])assert.equal(f.counts.has('get:provider_health:'+scope),false);
 assert.equal(f.counts.has('list:broker_connections'),false);assert.equal(f.counts.has('get:worker_health:executor'),false);
 assert.equal(f.counts.get('transact'),4,'Three actual upstream attempts plus one validated market success.');
 f.counts.clear();
 assert.equal((await f.request('product-quotes',{params})).statusCode,200);
 assert.equal(f.counts.get('get:accounts:'+USER),1);assert.equal(f.counts.get('transact'),3,'Warm metadata still meters both real market reads and records validated success.');
 assert.equal(f.upstream.filter(path=>path.startsWith('/v2/assets/')).length,1);
 assert.equal(f.upstream.filter(path=>path.endsWith('/trades/latest')).length,2);
 assert.equal(f.upstream.filter(path=>path.endsWith('/bars')).length,2);
});

test('public metadata reuse never caches owner grants, sessions, CSRF or customer market permissions',async t=>{
 const f=await fixture(t),params={instrumentId:'XNAS:AAPL:USD'};
 assert.equal((await f.request('product-quotes',{params})).statusCode,200);
 const record=await f.legacy.product.get('accounts',USER);
 await f.legacy.product.transact([{ns:'accounts',key:USER,ownerId:USER,expectedVersion:record.version,value:{...record.value,access:{...record.value.access,active:false}}}]);
 const before=f.upstream.length;f.counts.clear();
 const revoked=await f.request('product-quotes',{params});assert.equal(revoked.statusCode,403);assert.equal(JSON.parse(revoked.body).error.code,'UPGRADE_REQUIRED');assert.equal(f.upstream.length,before);assert.equal(f.counts.get('get:accounts:'+USER),1);
 const csrf=await f.request('product-mfa-enroll',{body:{},headers:{'x-csrf-token':'wrong'}});assert.equal(csrf.statusCode,403);assert.equal(JSON.parse(csrf.body).error.code,'CSRF_FAILED');
 const foreign=await f.request('product-quotes',{params,headers:{origin:'https://other.test'}});assert.equal(foreign.statusCode,403);
 await f.legacy.deleteSession(f.hash);
 const expired=await f.request('product-quotes',{params});assert.equal(expired.statusCode,401);assert.equal(JSON.parse(expired.body).error.code,'AUTH_REQUIRED');assert.equal(f.upstream.length,before);
});

test('listing cache expires, separates credentials/MIC and never promotes catalog evidence into a current quote',async t=>{
 const f=await fixture(t);
 const provider=()=>createNortivoDataProviders({env:f.env,fetcher:f.fetcher,store:f.legacy.product,clock:f.clock});
 await provider().catalog({q:'AAPL'});await provider().catalog({q:'Apple'});
 assert.equal(f.upstream.filter(path=>path==='/v2/assets').length,1);
 assert.equal(await f.legacy.product.get('provider_health','owner_market'),null,'Directory metadata is not a verified quote.');
 await provider().quotes({instrumentId:'XNAS:AAPL:USD'});await provider().quotes({instrumentId:'XNAS:AAPL:USD'});
 assert.equal(f.upstream.filter(path=>path.startsWith('/v2/assets/')).length,1);
 const rotated=createNortivoDataProviders({env:{...f.env,APCA_API_SECRET_KEY:'different-fixture-secret'},fetcher:f.fetcher,store:f.legacy.product,clock:f.clock});
 await rotated.quotes({instrumentId:'XNAS:AAPL:USD'});
 assert.equal(f.upstream.filter(path=>path.startsWith('/v2/assets/')).length,2);
 const before=f.upstream.filter(path=>path.endsWith('/trades/latest')).length;
 await assert.rejects(()=>provider().quotes({instrumentId:'XNYS:AAPL:USD'}),{code:'UNSUPPORTED_INSTRUMENT'});
 assert.equal(f.upstream.filter(path=>path.endsWith('/trades/latest')).length,before);
 f.advance(60001);await provider().quotes({instrumentId:'XNAS:AAPL:USD'});
 assert.equal(f.upstream.filter(path=>path.startsWith('/v2/assets/')).length,4);
});

test('parallel quote/chart reads retain the atomic provider budget',async t=>{
 const f=await fixture(t,{limit:2});
 const result=await f.request('product-quotes',{params:{instrumentId:'XNAS:AAPL:USD',resolution:'5min'}});
 assert.equal(result.statusCode,429);assert.equal(JSON.parse(result.body).error.code,'PROVIDER_RATE_LIMIT');assert.equal(f.upstream.length,2);
});
