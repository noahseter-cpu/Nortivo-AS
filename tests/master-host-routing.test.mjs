import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {applicationRoute,applicationHost} from '../netlify/routing/application-routes.mjs';
import languageRedirect from '../netlify/edge-functions/language.js';

test('every discoverable Netlify edge module has a callable default handler',async()=>{
 const directory=new URL('../netlify/edge-functions/',import.meta.url);
 const entries=(await readdir(directory,{withFileTypes:true})).filter(entry=>entry.isFile() && /\.(?:js|mjs|ts|mts)$/.test(entry.name));
 assert.ok(entries.some(entry=>entry.name==='language.js'),'The language edge entry must be present.');
 for(const entry of entries){
  const {default:handler}=await import(new URL(entry.name,directory));
  assert.ok(typeof handler==='function'||typeof handler?.fetch==='function',entry.name+' must default-export a function or an object with a fetch handler.');
 }
});
test('Invest roots serve their own public homepage without terminal initialization or authentication redirects',()=>{
 for(const locale of ['en','nb']){
  const route=applicationRoute(`https://invest.nortivo.no/${locale}/`);assert.equal(route.kind,'rewrite');assert.equal(route.path,`/invest/${locale}/index.html`);
  const result=languageRedirect(new Request(`https://invest.nortivo.no/${locale}/`));assert.ok(result instanceof URL);assert.equal(result.pathname,route.path);
 }
 assert.equal(applicationRoute('https://invest.nortivo.no/nb/systems/bot/').path,'/invest/nb/systems/bot/index.html');
 assert.equal(applicationRoute('https://invest.nortivo.no/en/support/').path,'/invest/en/support/index.html');
 assert.equal(applicationRoute('https://invest.nortivo.no/en/terminal/').kind,'pass');
});
test('standalone KORVNT and optional compatibility names keep their own routes and activation gates',()=>{
 const ready={korvntReady:true,korvntAliasReady:true};
 for(const host of ['korvnt.no','www.korvnt.no','security.nortivo.no','korvnt.nortivo.no']){
  assert.equal(applicationRoute('https://'+host+'/en/').status,503);
  const live=applicationRoute('https://'+host+'/nb/',ready);
  if(host==='korvnt.no')assert.equal(live.path,'/korvnt/nb/index.html');
  else {
   assert.equal(applicationRoute('https://'+host+'/en/',{korvntReady:true}).status,503);
   assert.equal(live.status,308);assert.equal(new URL(live.location).origin,'https://korvnt.no');
  }
 }
 for(const host of ['security.localhost','korvnt.localhost'])assert.equal(applicationRoute('http://'+host+':4490/en/',{preview:true}).path,'/korvnt/en/index.html');
 for(const path of ['/security/','/en/security/','/nb/security/']){
  assert.equal(applicationRoute('https://nortivo.no'+path,{...ready,redirectSecurityPaths:true}).kind,'pass');
  assert.equal(languageRedirect(new Request('https://nortivo.no'+path),{},{get:()=> 'true'}),undefined);
 }
 assert.equal(applicationRoute('https://invest.nortivo.no/en/request/').path,'/invest/en/request/index.html');
});
test('KORVNT returns the exact approved locale document at the edge after host and readiness checks',async()=>{
 const enabled={get:key=>key==='KORVNT_SITE_READY'?'true':undefined};
 const origin='https://korvnt.no';
 for(const locale of ['en','nb']){
  const publicUrl=origin+'/'+locale+'/';
  const file='/korvnt/'+locale+'/index.html';
  const approved=await readFile(new URL('../dist'+file,import.meta.url));
  assert.ok(approved.toString().includes('data-surface="korvnt"'));
  assert.ok(approved.toString().includes('href="'+publicUrl+'"'));
  for(const path of ['/'+locale+'/','/?lang='+locale,'/'+locale+'/index.html','/'+locale+'/security/']){
   const response=languageRedirect(new Request(origin+path),{},enabled);
   assert.ok(response instanceof Response);
   assert.equal(response.status,200);
   assert.equal(response.headers.get('content-language'),locale);
   assert.match(response.headers.get('content-type'),/^text\/html; charset=utf-8$/i);
   assert.match(response.headers.get('cache-control'),/no-store/);
   assert.equal(response.headers.get('netlify-cdn-cache-control'),'no-store');
   assert.equal(response.headers.get('x-content-type-options'),'nosniff');
   assert.match(response.headers.get('strict-transport-security'),/max-age=[1-9]/);
   assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
   assert.equal(response.headers.get('set-cookie'),null);
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),approved);
  }
  const head=languageRedirect(new Request(publicUrl,{method:'HEAD'}),{},enabled);
  assert.equal(head.status,200);assert.equal(head.body,null);
  assert.equal(head.headers.get('content-language'),locale);
  for(const method of ['GET','HEAD']){
   assert.equal(languageRedirect(new Request(publicUrl,{method}),{},{}).status,503);
   assert.equal(languageRedirect(new Request(origin+file,{method}),{},enabled).status,404);
  }
  assert.equal(languageRedirect(new Request(publicUrl,{method:'POST'}),{},enabled).status,404);
 }
});

test('standalone and alias origin boundaries allow public resources and exact service methods; only parent permits its private inbox',()=>{
 const ready={korvntReady:true,korvntAliasReady:true};
 for(const host of ['korvnt.no','www.korvnt.no','security.nortivo.no','korvnt.nortivo.no'])for(const path of ['/en/admin/','/nb/terminal/','/en/portfolio/','/.netlify/functions/terminal','/.netlify/functions/korvnt-inbox','/.netlify/functions/admin-session','/.local/runtime.json','/services/security-core/docs/operations.md','/assets/admin.js','/%61dmin/']){
  const route=applicationRoute('https://'+host+path,ready);assert.equal(route.kind,'deny');assert.equal(route.status,404);
 }
 const fn='/.netlify/functions/korvnt-service';
 for(const m of ['GET','POST'])assert.equal(applicationRoute('https://korvnt.no'+fn,{...ready,method:m}).kind,'pass');
 for(const m of ['PUT','DELETE','OPTIONS'])assert.equal(applicationRoute('https://korvnt.no'+fn,{...ready,method:m}).status,404);
 for(const host of ['www.korvnt.no','security.nortivo.no','korvnt.nortivo.no','nortivo.no','invest.nortivo.no'])assert.equal(applicationRoute('https://'+host+fn,ready).status,404);
 for(const asset of ['security-core/styles.css','security-core/enquiry.js','workflow-client.js','workflows.css'])assert.equal(applicationRoute('https://korvnt.no/assets/'+asset,ready).kind,'pass');
 assert.equal(applicationRoute('https://invest.nortivo.no/.netlify/functions/korvnt-inbox',ready).status,404);
 assert.equal(applicationRoute('https://nortivo.no/.netlify/functions/korvnt-inbox',ready).kind,'pass');
 assert.equal(applicationHost('evil-invest.localhost',{preview:true}),null);
});
test('alias redirect drops supplied personal information and admits only a language preference',()=>{
 const env={get:key=>['KORVNT_SITE_READY','KORVNT_ALIAS_READY'].includes(key)?'true':undefined};
 const response=languageRedirect(new Request('https://www.korvnt.no/nb/?lang=nb&token=fixture-secret&ref=private-brief&email=private%40example.test'),{},env);
 assert.equal(response.status,308);const target=new URL(response.headers.get('Location'));assert.equal(target.hostname,'korvnt.no');assert.equal(target.pathname,'/nb/');assert.equal(target.search,'?lang=nb');
 assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
