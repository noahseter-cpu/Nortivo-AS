import test from 'node:test';
import assert from 'node:assert/strict';
import {cookie,requestOrigin,requireSameOrigin} from '../netlify/terminal/security.mjs';
import route, {config} from '../netlify/edge-functions/language.js';
import {readIntent} from '../dist/assets/product-core.js';
const investment='https://invest.nortivo.no';
const migration={get:key=>key==='PRODUCT_PLATFORM_MIGRATION_READY'?'true':undefined};

test('investment root renders the localized public homepage and leaves direct platform entry points available',()=>{
 const entry=new Request(`${investment}/?tier=pro&interval=year&locale=nb`);
 assert.equal(route(entry).href, `${investment}/invest/nb/index.html`);
 for(const locale of ['en','nb']){
  for(const path of [`/${locale}/`,`/${locale}/index.html`]){
   assert.equal(route(new Request(investment+path)).href,`${investment}/invest/${locale}/index.html`);
  }
  for(const page of ['support','systems/bot','systems/engine']){
   assert.equal(route(new Request(`${investment}/${locale}/${page}/`)).href,`${investment}/invest/${locale}/${page}/index.html`);
  }
  for(const page of ['terminal','pricing','portfolio']){
   assert.equal(route(new Request(`${investment}/${locale}/${page}/`)),undefined);
   assert.equal(new URL(route(new Request(`${investment}/${locale}/${page}`)).headers.get('Location')).pathname,`/${locale}/${page}/`);
  }
 }
 const choice=route(new Request(`${investment}/?lang=en`,{headers:{Cookie:'nortivo_language=nb'}}),{geo:{country:{code:'NO'}}});
 assert.equal(choice.href,`${investment}/invest/en/index.html`);
});

test('old platform entry redirects require the explicit ready flag and retain only safe journey values',()=>{
 assert.equal(route(new Request('https://nortivo.no/nb/terminal/')),undefined);
 assert.equal(new URL(route(new Request('https://nortivo.no/terminal/?lang=nb')).headers.get('Location')).origin,'https://nortivo.no');
 for(const host of ['nortivo.no','www.nortivo.no'])for(const prefix of ['', '/en','/nb'])for(const page of ['terminal','pricing','portfolio'])for(const suffix of ['','/','/index.html']){
  const result=route(new Request(`https://${host}${prefix}/${page}${suffix}?tier=pro&interval=year&locale=nb&returnPath=%2Fnb%2Fterminal%2F&auth=signup&ref=campaign&token=secret&email=private%40example.test&returnTo=https%3A%2F%2Fevil.test`),{},migration);
  assert.equal(result.status,307);const target=new URL(result.headers.get('Location'));
  assert.equal(target.origin,investment);assert.equal(target.pathname,`${prefix||'/nb'}/${page}/`);
  for(const [key,value] of Object.entries({tier:'pro',interval:'year',locale:'nb',returnPath:'/nb/terminal/',auth:'signup',ref:'campaign'}))assert.equal(target.searchParams.get(key),value);
  for(const key of ['token','email','returnTo'])assert.equal(target.searchParams.has(key),false);
  assert.equal(target.hash,'');
 }
 for(const method of ['GET','HEAD'])assert.equal(route(new Request('https://nortivo.no/en/pricing/',{method}),{},migration).status,307);
 const hostile=route(new Request('https://nortivo.no/en/pricing/?constructor=bad&__proto__=bad&toString=bad'),{},migration);assert.equal(hostile.status,307);assert.equal(new URL(hostile.headers.get('Location')).search,'');
 for(const path of ['/terminal/private/','/.netlify/functions/terminal?action=product-broker-callback&state=opaque&code=opaque','/.netlify/functions/stripe-webhook','/en/'])assert.equal(route(new Request(`https://nortivo.no${path}`),{},migration),undefined);
 assert.equal(route(new Request('https://nortivo.no/en/portfolio/',{method:'POST'}),{},migration),undefined);
 assert.equal(route(new Request('https://other.test/en/terminal/'),{},migration),undefined);
});

test('investment company documents return to the company host while data, assets and callbacks stay same-origin',()=>{
 for(const path of ['/nb/privacy/','/en/report-2026/','/products/','/en/admin/','/admin/projects/vibb/']){
  const result=route(new Request(`${investment}${path}`));assert.equal(new URL(result.headers.get('Location')).origin,'https://nortivo.no');
 }
 for(const path of ['/report-2026/summary.json','/report-2026/equity.csv','/assets/product-client.js','/terminal/chart.js','/.netlify/functions/terminal?action=product-broker-callback','/.netlify/functions/stripe-webhook'])assert.equal(route(new Request(`${investment}${path}`)),undefined);
 for(const method of ['GET','POST','DELETE'])for(const endpoint of ['admin-login','admin-logout','admin-tickets','admin-projects','admin-vibb','reply-ticket'])assert.equal(route(new Request(`${investment}/.netlify/functions/${endpoint}`,{method})).status,404);
 assert.equal(route(new Request(`${investment}/.netlify/functions/admin-vibb/projects/`,{method:'POST'})).status,404);
 assert.equal(route(new Request(`${investment}/admin/projects/vibb/`,{method:'POST'})).status,404);
 assert.equal(config.path,'/*','Unrecognized paths must also pass through the host boundary.');
});

test('migration and client agree on account tabs, originating workspace and safe nested auth destinations',()=>{
 for(const locale of ['en','nb'])for(const tab of ['account','billing','security'])for(const workspace of ['terminal','portfolio'])for(const nested of [false,true]){
  const returnPath=`/${locale}/portfolio/?tab=${tab}&workspace=${workspace}`;
  const query=new URLSearchParams({tier:'pro',interval:'year',locale,auth:'login',...(nested?{returnPath}:{tab,workspace})});
  const response=route(new Request(`https://nortivo.no/${locale}/portfolio/?${query}`),{},migration);
  const target=new URL(response.headers.get('Location'));
  assert.equal(target.origin,investment);
  assert.deepEqual(readIntent(target.search,locale),{tier:'pro',interval:'year',locale,returnPath});
 }
 for(const value of ['https://evil.test/','//evil.test/en/portfolio/','/en/%2e%2e/portfolio/','/en/portfolio/?tab=admin','/en/portfolio/?tab=billing&workspace=evil','/en/portfolio/?tab=account&tab=billing','/en/portfolio/?tab=billing&next=https://evil.test/','/en/portfolio/#reset=secret']){
  const query=new URLSearchParams({returnPath:value});
  const response=route(new Request(`https://nortivo.no/en/portfolio/?${query}`),{},migration);
  assert.equal(new URL(response.headers.get('Location')).searchParams.has('returnPath'),false);
 }
});

test('approved production origins never allow cross-origin mutations or shared domain cookies',()=>{
 for(const origin of ['https://nortivo.no','https://www.nortivo.no',investment]){
  const event={rawUrl:`${origin}/.netlify/functions/terminal`,headers:{origin}};
  assert.equal(requestOrigin(event,{}),origin);requireSameOrigin(event,{});
  assert.throws(()=>requireSameOrigin({...event,headers:{origin:'https://nortivo.no'===origin?investment:'https://nortivo.no'}},{}),e=>e.code==='INVALID_ORIGIN');
  assert.throws(()=>requireSameOrigin({...event,headers:{origin,'sec-fetch-site':'cross-site'}},{}),e=>e.code==='INVALID_ORIGIN');
 }
 for(const rawUrl of ['https://invest.nortivo.no.evil.test/','https://evil.invest.nortivo.no/','http://invest.nortivo.no/','https://invest.nortivo.no:444/','https://user:password@invest.nortivo.no/'])assert.throws(()=>requestOrigin({rawUrl},{}),e=>e.code==='INVALID_ORIGIN');
 const local={TERMINAL_LOCAL:'true',TERMINAL_ORIGIN:'http://127.0.0.1:4420'};
 assert.equal(requestOrigin({rawUrl:'https://preview-123.netlify.app/'},{TERMINAL_ORIGIN:'https://preview-123.netlify.app'}),'https://preview-123.netlify.app');
 assert.equal(requestOrigin({rawUrl:'http://127.0.0.1:4420/'},local),'http://127.0.0.1:4420');
 assert.throws(()=>requestOrigin({rawUrl:'http://127.0.0.1:4420/'},{...local,NETLIFY:'true'}),e=>e.code==='INVALID_ORIGIN');
 assert.throws(()=>requestOrigin({rawUrl:'http://evil.test/'},{TERMINAL_LOCAL:'true',TERMINAL_ORIGIN:'http://evil.test'}),e=>e.code==='INVALID_ORIGIN');
 const header=cookie('x'.repeat(43),60000);assert.match(header,/HttpOnly; Secure; SameSite=Strict/);assert.doesNotMatch(header,/\bDomain=/i);assert.match(header,/Path=\/\.netlify\/functions\/terminal;/);
});
