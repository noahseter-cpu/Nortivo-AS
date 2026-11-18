import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalStore} from '../netlify/terminal/store-local.mjs';
import {handleStrategy} from '../netlify/product/execution-strategy.mjs';
import {processOrder,acquireAccountLease} from '../netlify/product/execution.mjs';

const USER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const now=Date.now();
const input={name:'Daily test',instrumentId:'XNAS:AAPL:USD',fast:20,slow:50,quantity:'1',connectionId:'',mode:'paper',enabled:false};
async function fixture(t){const legacy=await createLocalStore(':memory:');t.after(()=>legacy.close());return {store:legacy.product,user:{id:USER},now,env:{},requireFeature:async()=>{},fetcher:async()=>{throw Error('No network expected');}};}
async function put(ctx,ns,key,value,owner=USER){const row=await ctx.store.get(ns,key);await ctx.store.transact([{ns,key,ownerId:owner,expectedVersion:row?.version??null,value}]);}

test('strategy reads survive expiry and remain owner-isolated; new changes still require Pro',async t=>{
 const ctx=await fixture(t);
 const created=await handleStrategy(ctx,'product-strategy',{requestId:'create-strategy-fixture',strategy:input});
 await put(ctx,'strategies',`${OTHER}:private`,{name:'Other private strategy'},OTHER);
 ctx.requireFeature=async()=>{throw Object.assign(new Error('Expired'),{code:'UPGRADE_REQUIRED',status:403});};
 const result=await handleStrategy(ctx,'product-strategy',null);
 assert.equal(result.strategies.length,1);assert.equal(result.strategies[0].id,created.strategy.id);
 await assert.rejects(handleStrategy(ctx,'product-strategy',{requestId:'new-expired-strategy',strategy:input}),e=>e.code==='UPGRADE_REQUIRED');
});

test('lost-response retries and concurrent tabs create exactly one strategy version',async t=>{
 const ctx=await fixture(t),body={requestId:'same-strategy-request',strategy:input};
 const results=await Promise.all(Array.from({length:6},()=>handleStrategy(ctx,'product-strategy',body)));
 assert.equal(new Set(results.map(r=>r.strategy.id)).size,1);assert.ok(results.every(r=>r.strategy.version===1));
 assert.equal((await ctx.store.list('strategies',{ownerId:USER})).length,1);
 await assert.rejects(handleStrategy(ctx,'product-strategy',{...body,strategy:{...input,fast:10}}),e=>e.code==='IDEMPOTENCY_CONFLICT');
});

test('moving a strategy atomically stops its previous connection and blocks queued old-version entry',async t=>{
 const ctx=await fixture(t),id='33333333-3333-4333-8333-333333333333';
 await put(ctx,'strategies',`${USER}:${id}`,{...input,id,version:1,connectionId:'connection-a',enabled:true});
 await put(ctx,'broker_connections',`${USER}:connection-a`,{id:'connection-a',mode:'paper',status:'connected',strategyId:id,strategyVersion:1,automationEnabled:true});
 await put(ctx,'broker_connections',`${USER}:connection-b`,{id:'connection-b',mode:'paper',status:'connected',automationEnabled:false});
 const updated=await handleStrategy(ctx,'product-strategy',{requestId:'move-strategy-fixture',strategyId:id,strategy:{...input,connectionId:'connection-b',enabled:true}});
 assert.equal(updated.strategy.version,2);
 assert.equal((await ctx.store.get('broker_connections',`${USER}:connection-a`)).value.automationEnabled,false);
 await put(ctx,'order_intents',`${USER}:old-queued-entry`,{id:'old-queued-entry',connectionId:'connection-a',mode:'paper',status:'pending',automated:true,strategyVersion:1,expiresAt:now+60000});
 const row=await ctx.store.get('order_intents',`${USER}:old-queued-entry`),lease=await acquireAccountLease(ctx.store,USER,'test-worker',now);
 const outcome=await processOrder(ctx,row,lease,{});
 assert.equal(outcome.status,'rejected');assert.equal(outcome.errorCode,'AUTOMATION_STOPPED');
});
