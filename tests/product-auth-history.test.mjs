import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createInitialState } from '../netlify/terminal/engine.mjs';
import { ensureAccount,sendToken,handlePublicAuth } from '../netlify/product/auth.mjs';
const NOW=Date.parse('2026-11-18T12:00:00Z'),ID='c3333333-3333-4333-8333-333333333333';
test('token generation ignores more than100 historical links; failed recovery delivery never reveals account existence',async t=>{
 const legacyStore=await createLocalStore(':memory:');t.after(()=>legacyStore.close());const user={id:ID,kind:'user',email:'fixture@example.test',password_hash:'unused-fixture-hash',created_at:NOW,expires_at:null};await legacyStore.createUser(user,createInitialState({now:NOW}));const emails=[];const ctx={legacyStore,store:legacyStore.product,user,env:{PRODUCT_TEST_MODE:'true'},now:NOW,origin:'https://terminal.test',ip:'test',rate:async()=>{},testEmail:async m=>emails.push(m)};const a=await ensureAccount(ctx);
 for(let i=0;i<110;i++)await ctx.store.transact([{ns:'tokens',key:`verify:${String(i).padStart(64,'0')}`,ownerId:ID,expectedVersion:null,value:{purpose:'verify',expiresAt:NOW-1}}]);
 await sendToken(ctx,'verify',user,a.value);const first=new URL(emails[0].url).hash.slice('#verify='.length);await sendToken(ctx,'verify',user,a.value);const second=new URL(emails[1].url).hash.slice('#verify='.length);await assert.rejects(()=>handlePublicAuth({...ctx,user:null},'product-verify',{token:first}),e=>e.code==='TOKEN_INVALID');await handlePublicAuth({...ctx,user:null},'product-verify',{token:second});
 const failing={...ctx,user:null,testEmail:async()=>{throw new Error('fixture delivery failure');}};
 const known=await handlePublicAuth(failing,'product-forgot',{email:user.email});const unknown=await handlePublicAuth(failing,'product-forgot',{email:'unknown@example.test'});assert.deepEqual(known,unknown);assert.equal((await ctx.store.list('audit',{ownerId:ID})).some(r=>r.value.kind==='account_email_delivery_unconfirmed'),true);
});


test('internal ordered cursor pages do not omit records beyond the first1000',async t=>{
 const legacyStore=await createLocalStore(':memory:');t.after(()=>legacyStore.close());const store=legacyStore.product;
 for(let start=0;start<1010;start+=30){const changes=[];for(let n=start;n<Math.min(start+30,1010);n++)changes.push({ns:'order_intents',key:`${ID}:${String(n).padStart(5,'0')}`,ownerId:ID,expectedVersion:null,value:{status:n===1009?'pending':'filled'}});await store.transact(changes);}
 const first=await store.list('order_intents',{ownerId:ID,limit:1000});assert.equal(first.length,1000);const second=await store.list('order_intents',{ownerId:ID,limit:1000,afterKey:first.at(-1).key});assert.equal(second.length,10);assert.equal(second.at(-1).value.status,'pending');assert.equal(new Set([...first,...second].map(r=>r.key)).size,1010);
});
