import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalStore} from '../netlify/terminal/store-local.mjs';
import {createInitialState} from '../netlify/terminal/engine.mjs';
import {sha256} from '../netlify/terminal/security.mjs';
import {createOwnerGrant} from '../netlify/product/owner.mjs';
import {createProductHandler} from '../netlify/product/service.mjs';
import {getProviders} from '../netlify/product/providers.mjs';

// Explicit local fixtures. Advancing this clock simulates RTT without waiting or contacting a provider.
const START=Date.parse('2026-11-18T20:19:44.823Z');
const ORIGIN='https://invest.nortivo.no';
const USER='a1111111-1111-4111-8111-111111111111';
const RAW=Buffer.alloc(32,21).toString('base64url');
const ENV={PRODUCT_ENABLED:'true',TERMINAL_ORIGIN:ORIGIN,TERMINAL_SESSION_SECRET:'fixture-session-secret-at-least-thirty-two-characters',
  PRODUCT_OWNER_MARKET_PROVIDER:'nortivo',APCA_API_KEY_ID:'fixture-key-only',APCA_API_SECRET_KEY:'fixture-secret-only'};
async function fixture(t,{sourceTimestamp='2026-11-18T20:19:48.527Z',assetLatency=1000,tradeLatency=4000}={}) {
  let current=START;
  const legacy=await createLocalStore(':memory:');t.after(()=>legacy.close());
  const user={id:USER,kind:'user',email:'owner-clock@example.test',created_at:START-86400000};
  const account={emailVerified:true,access:createOwnerGrant(START-86400000),billing:{status:'none',paidUntil:null}};
  await legacy.createUser(user,createInitialState({now:START}));
  await legacy.createSession({token_hash:sha256(RAW),user_id:USER,created_at:START-1000,expires_at:START+3600000});
  await legacy.product.transact([{ns:'accounts',key:USER,ownerId:USER,expectedVersion:null,value:account}]);
  const sessionTimes=[];const getSession=legacy.getSession.bind(legacy);
  legacy.getSession=(hash,now)=>{sessionTimes.push(now);return getSession(hash,now);};
  const fetcher=async value=>{
    const url=new URL(value);
    if(url.hostname==='paper-api.alpaca.markets'&&url.pathname==='/v2/assets/AAPL'){
      current+=assetLatency;return Response.json({id:'fixture-AAPL',class:'us_equity',exchange:'NASDAQ',symbol:'AAPL',name:'Apple Inc.',status:'active'});
    }
    if(url.hostname==='data.alpaca.markets'&&url.pathname==='/v2/stocks/AAPL/trades/latest'){
      current+=tradeLatency;return Response.json({symbol:'AAPL',trade:{p:100.25,s:10,t:sourceTimestamp,i:42}});
    }
    throw new Error('Unexpected fixture destination.');
  };
  const clock=()=>current;
  return {legacy,user,account,fetcher,clock,sessionTimes,sourceTimestamp};
}
function quoteRequest(){return {httpMethod:'GET',rawUrl:`${ORIGIN}/.netlify/functions/terminal?action=product-quotes&instrumentId=XNAS%3AAAPL%3AUSD`,
  headers:{origin:ORIGIN,cookie:`nortivo_terminal=${RAW}`},queryStringParameters:{action:'product-quotes',instrumentId:'XNAS:AAPL:USD'}};}

test('handler market receipt advances across network RTT while source and authorization times remain unchanged',async t=>{
  const f=await fixture(t);
  const handler=createProductHandler({store:f.legacy,env:ENV,now:f.clock,fetcher:f.fetcher,legacyHandler:()=>{throw new Error('Legacy path is not expected.');}});
  const response=await handler(quoteRequest());assert.equal(response.statusCode,200,response.body);
  const {quote}=JSON.parse(response.body);
  assert.equal(quote.sourceTimestamp,f.sourceTimestamp);
  assert.equal(quote.asOf,new Date(f.sourceTimestamp).toISOString());
  assert.equal(quote.receivedAt,new Date(START+5000).toISOString());
  assert.ok(Date.parse(quote.receivedAt)>=Date.parse(quote.sourceTimestamp));
  assert.equal(quote.freshness,'current');
  assert.deepEqual(f.sessionTimes,[START]);
});

test('handler freshness uses completion time so a quote can become stale during an in-flight request',async t=>{
  const sourceTimestamp=new Date(START-1000).toISOString();
  const f=await fixture(t,{sourceTimestamp,assetLatency:0,tradeLatency:121000});
  const handler=createProductHandler({store:f.legacy,env:ENV,now:f.clock,fetcher:f.fetcher,legacyHandler:()=>{throw new Error('Unexpected legacy call.');}});
  const response=await handler(quoteRequest());assert.equal(response.statusCode,200,response.body);
  const {quote}=JSON.parse(response.body);
  assert.equal(quote.sourceTimestamp,sourceTimestamp);
  assert.equal(quote.receivedAt,new Date(START+121000).toISOString());
  assert.equal(quote.freshness,'stale');
  assert.deepEqual(f.sessionTimes,[START]);
});

test('direct provider fixtures retain an explicitly supplied fixed context time',async t=>{
  const f=await fixture(t,{sourceTimestamp:new Date(START-1000).toISOString()});
  const providers=getProviders({env:ENV,user:f.user,account:f.account,store:f.legacy.product,fetcher:f.fetcher,now:START});
  const {quote}=await providers.quotes({instrumentId:'XNAS:AAPL:USD'});
  assert.equal(quote.receivedAt,new Date(START).toISOString());
});

test('provider contexts without an injected function or fixed time use the advancing wall clock',async t=>{
  const f=await fixture(t);t.mock.method(Date,'now',f.clock);
  const providers=getProviders({env:ENV,user:f.user,account:f.account,store:f.legacy.product,fetcher:f.fetcher});
  const {quote}=await providers.quotes({instrumentId:'XNAS:AAPL:USD'});
  assert.equal(quote.receivedAt,new Date(START+5000).toISOString());
  assert.equal(quote.sourceTimestamp,f.sourceTimestamp);
});
