import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createTerminalHandler } from '../netlify/functions/terminal.mjs';
import { createInitialState } from '../netlify/terminal/engine.mjs';
import { sha256,csrfToken } from '../netlify/terminal/security.mjs';

const NOW=Date.parse('2026-11-18T12:00:00Z'),ORIGIN='https://terminal.test',USER='a1111111-1111-4111-8111-111111111111';
async function fixture(t,{admin=false,paid=true}={}){
 const store=await createLocalStore(':memory:');t.after(()=>store.close());
 await store.createUser({id:USER,kind:'user',email:'oauth-fixture@example.test',password_hash:'unused-fixture-hash',created_at:NOW,expires_at:null},createInitialState({now:NOW}));
 await store.product.transact([{ns:'accounts',key:USER,ownerId:USER,expectedVersion:null,value:{emailVerified:true,locale:'nb',billing:paid?{tier:'pro',status:'active',paidUntil:NOW+86400000}:{status:'none',paidUntil:null}}}]);
 const raw=crypto.randomBytes(32).toString('base64url'),hash=sha256(raw);
 await store.createSession({token_hash:hash,user_id:USER,created_at:NOW,expires_at:NOW+86400000});
 await store.product.transact([{ns:'mfa_sessions',key:hash,ownerId:USER,expectedVersion:null,value:{scope:'broker',validUntil:NOW+600000}}]);
 const env={PRODUCT_ENABLED:'true',PRODUCT_TEST_MODE:'true',TERMINAL_ORIGIN:ORIGIN,TERMINAL_SESSION_SECRET:'a-fixture-session-secret-with-thirty-two-characters',PRODUCT_ADMIN_USER_IDS:admin?USER:'',ALPACA_OAUTH_CLIENT_ID:'fixture-client',ALPACA_OAUTH_CLIENT_SECRET:'fixture-server-only',ALPACA_OAUTH_REDIRECT_URI:`${ORIGIN}/.netlify/functions/terminal?action=product-broker-callback`,PRODUCT_ALPACA_PAPER_COMMERCIAL_APPROVAL:'true',PRODUCT_ALPACA_APPROVAL_REFERENCE:'fixture-approved-reference',PRODUCT_BROKER_TOKEN_KEY:Buffer.alloc(32,42).toString('base64')};
 let calls=0;
 const fetcher=async url=>{calls++;return new Response(JSON.stringify(url.includes('/oauth/token')?{access_token:'fixture-broker-token',token_type:'bearer',scope:'trading'}:{id:'account-fixture-01',status:'ACTIVE',account_number:'FAKE000001',currency:'USD'}),{status:200});};
 const handler=createTerminalHandler({store,env,now:()=>NOW,fetcher});
 async function request(action,body,{headers={},params={}}={}){const query=new URLSearchParams({action,...params});return handler({httpMethod:body===undefined?'GET':'POST',rawUrl:`${ORIGIN}/.netlify/functions/terminal?${query}`,queryStringParameters:Object.fromEntries(query),headers:{origin:ORIGIN,'content-type':'application/json',cookie:`nortivo_terminal=${raw}`,'x-csrf-token':csrfToken(raw,env.TERMINAL_SESSION_SECRET),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
 async function begin({operator=false}={}){
  const result=operator?await request('product-health-probe',{requestId:crypto.randomUUID(),services:['broker_oauth_paper']}):await request('product-broker-connect',{requestId:crypto.randomUUID(),mode:'paper'});
  assert.equal(result.statusCode,200,result.body);const data=JSON.parse(result.body),url=operator?data.results.broker_oauth_paper.authorizationUrl:data.authorizationUrl;assert.ok(url,result.body);
  const setCookie=result.headers['Set-Cookie'];assert.equal(typeof setCookie,'string');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/Secure/i);assert.match(setCookie,/SameSite=Lax/i);assert.ok(!setCookie.startsWith('nortivo_terminal='));
  return {state:new URL(url).searchParams.get('state'),cookie:setCookie.split(';')[0],setCookie};
 }
 const callback=(start,headers={})=>request('product-broker-callback',undefined,{params:{state:start.state,code:'fixture-oauth-code'},headers:{origin:'',referer:'https://app.alpaca.markets/','sec-fetch-site':'cross-site',cookie:start.cookie,...headers}});
 return {store,env,request,begin,callback,hash,get calls(){return calls;}};
}

test('main OAuth flow attaches browser-bound Lax cookie and returns clearing 303 without the Strict session cookie',async t=>{
 const f=await fixture(t),start=await f.begin();
 const missing=await f.callback(start,{cookie:''});assert.ok(missing.statusCode>=400);assert.equal(f.calls,0);
 const cookieName=start.cookie.split('=')[0],wrong=await f.callback(start,{cookie:`${cookieName}=${'x'.repeat(43)}`});assert.ok(wrong.statusCode>=400);assert.equal(f.calls,0);
 const result=await f.callback(start);assert.equal(result.statusCode,303,result.body);assert.equal(new URL(result.headers.Location,ORIGIN).href,`${ORIGIN}/nb/terminal/?broker=connected`);assert.equal(result.headers['Referrer-Policy'],'no-referrer');assert.match(result.headers['Set-Cookie'],/Max-Age=0/i);assert.equal(f.calls,2);
 const replay=await f.callback(start);assert.ok(replay.statusCode>=400);assert.equal(f.calls,2);
 const forbidden=await f.request('product-plans',undefined,{headers:{origin:'',referer:'https://app.alpaca.markets/','sec-fetch-site':'cross-site',cookie:start.cookie}});assert.equal(forbidden.statusCode,403);
});

test('main OAuth callback rejects a revoked originating session before contacting the broker',async t=>{
 const f=await fixture(t),start=await f.begin();await f.store.deleteSession(f.hash);const result=await f.callback(start);assert.ok(result.statusCode>=400);assert.equal(f.calls,0);assert.equal((await f.store.product.list('broker_connections',{ownerId:USER})).length,0);
});

test('main OAuth callback rechecks entitlement loss after authorization began',async t=>{
 const f=await fixture(t),start=await f.begin(),a=await f.store.product.get('accounts',USER);await f.store.product.transact([{ns:'accounts',key:USER,ownerId:USER,expectedVersion:a.version,value:{...a.value,billing:{...a.value.billing,paidUntil:NOW-1}}}]);const result=await f.callback(start);assert.ok(result.statusCode>=400);assert.equal(f.calls,0);
});

test('owner bootstrap probe preserves the cookie hook without granting a subscription',async t=>{
 const f=await fixture(t,{admin:true,paid:false}),start=await f.begin({operator:true});const result=await f.callback(start);assert.equal(result.statusCode,303,result.body);assert.equal(f.calls,2);assert.equal((await f.store.product.get('accounts',USER)).value.billing.status,'none');
});

test('operator bootstrap callback rechecks server-managed administrator status',async t=>{
 const f=await fixture(t,{admin:true,paid:false}),start=await f.begin({operator:true});f.env.PRODUCT_ADMIN_USER_IDS='';const result=await f.callback(start);assert.ok(result.statusCode>=400);assert.equal(f.calls,0);
});
