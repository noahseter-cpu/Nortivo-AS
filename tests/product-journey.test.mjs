import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as core from '../dist/assets/product-core.js';

test('annual selection and a safe localized destination survive pricing and auth links', () => {
  const saved={tier:'pro',interval:'year',returnPath:'/en/terminal/?view=research'};
  const picked=core.readIntent('', 'nb', saved);
  assert.deepEqual(picked,{tier:'pro',interval:'year',locale:'nb',returnPath:'/nb/terminal/?view=research'});
  const link=new URL(core.intentPath('pricing',picked),'https://invest.nortivo.no');
  assert.equal(link.pathname,'/nb/pricing/');
  assert.equal(link.searchParams.get('interval'),'year');
  assert.equal(link.searchParams.get('returnPath'),picked.returnPath);
  assert.equal(core.readIntent('?interval=month','nb',saved).interval,'month');
  assert.equal(new URL(core.intentPath('portfolio',picked,'signup'),'https://invest.nortivo.no').searchParams.get('auth'),'signup');
});

test('journey inputs allow only product routes, supported tabs and known query fields', () => {
  const malicious=core.readIntent('?tier=pro&interval=year&returnPath=https://outside.test/','en');
  assert.equal(malicious.returnPath,'/en/terminal/');
  assert.equal(core.intentPath('https://outside.test',malicious).startsWith('/en/portfolio/'),true);
  assert.equal(core.readIntent('?tab=billing&workspace=terminal','en').returnPath,'/en/portfolio/?tab=billing&workspace=terminal');
  assert.equal(core.readIntent('?tab=security&workspace=https://outside.test','nb').returnPath,'/nb/portfolio/?tab=security');
  const query=new URL(core.intentPath('pricing',{...malicious,token:'private',password:'private'}),'https://invest.nortivo.no').searchParams;
  assert.equal(query.has('token'),false);
  assert.equal(query.has('password'),false);
});

test('auth drafts never retain credentials, recovery codes, tokens or arbitrary fields', () => {
  assert.deepEqual(core.safeAuthDraft({email:'customer@example.test',name:'Customer',password:'private',code:'123456',token:'private'}),{email:'customer@example.test',name:'Customer'});
  assert.equal(core.safeAuthDraft({email:'x'.repeat(200)}).email.length,160);
  assert.equal(core.safeAuthDraft({email:{},name:null}).email,'');
});

const source=(await readFile(new URL('../dist/assets/product-client.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace('export async function startProduct','async function startProduct');
function clientHarness(search='') {
  const saved=new Map();
  const context=vm.createContext({...core,esc:core.escapeHtml,MarketChart:class{},URL,URLSearchParams,Intl,Set,Map,Date,console,crypto:webcrypto,
    location:{pathname:'/en/portfolio/',search,origin:'https://invest.nortivo.no',assign:()=>{}},
    sessionStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
    document:{querySelector:()=>null,documentElement:{}},
    FormData:class extends Map {constructor(form){super(Object.entries(form.fields));}},
    setTimeout,clearTimeout,
  });
  vm.runInContext(source,context);
  vm.runInContext(`root={querySelector:()=>null};dialog={open:false};`,context);
  return {context,run:code=>vm.runInContext(code,context),saved};
}

test('actual auth screens retain email and optional name through sign in, signup and recovery', () => {
  const h=clientHarness('?tier=pro&interval=year');
  h.run(`catalog={ready:false,capabilities:{signupEnabled:true}};shell=content=>{globalThis.markup=content;};bindForm=()=>{};
    root.querySelector=selector=>selector==='#product-auth-form'?{fields:{email:'journey@example.test',name:'Local journey fixture',password:'not-retained',code:'123456'}}:null;
    authScreen('login');`);
  assert.match(h.context.markup,/name="email"[^>]*value="journey@example.test"/);
  h.run(`root.querySelector=()=>null;authScreen('signup');`);
  assert.match(h.context.markup,/name="name"[^>]*value="Local journey fixture"/);
  assert.match(h.context.markup,/name="email"[^>]*value="journey@example.test"/);
  assert.match(h.context.markup,/password-guidance/);
  assert.match(h.context.markup,/Subscriptions are not open yet/);
  assert.doesNotMatch(h.context.markup,/not-retained|value="123456"/);
  h.run(`locale='nb';authScreen('signup');`);
  assert.match(h.context.markup,/name="email"[^>]*value="journey@example.test"/);
  assert.match(h.context.markup,/name="name"[^>]*value="Local journey fixture"/);
  h.run(`authScreen('forgot');`);
  assert.match(h.context.markup,/name="email"[^>]*value="journey@example.test"/);
  assert.doesNotMatch(h.context.markup,/name="password"/);
});

test('session expiry clears stale private data and requests login once without replaying a write', async () => {
  const h=clientHarness('?tier=pro&interval=year');
  let calls=0;
  h.context.fetch=async()=>{calls++;return {ok:false,status:401,json:async()=>({error:{code:'AUTH_REQUIRED'}})};};
  h.run(`snapshot={user:{id:'fixture',kind:'user',email:'customer@example.test'},csrfToken:'old',entitlements:{tier:'pro'}};
    portfolio={private:true};summary={private:true};brokerStatus={private:true};news=[{private:true}];reminders=[{private:true}];
    authScreen=mode=>{globalThis.loginMode=mode;globalThis.loginRequests=(globalThis.loginRequests||0)+1;};`);
  await assert.rejects(h.run(`api('product-portfolio',{method:'POST',body:{requestId:'fixture-write'}})`),error=>error.code==='AUTH_REQUIRED');
  assert.equal(calls,1);
  assert.equal(h.context.loginMode,'login');
  assert.equal(h.context.loginRequests,1);
  assert.equal(h.run('snapshot===null&&session===null&&portfolio===null&&summary===null&&brokerStatus===null&&news.length===0&&reminders.length===0'),true);
  assert.equal(h.run('authDraft.email'),'customer@example.test');
  assert.equal(JSON.parse(h.saved.get('nortivo.product.intent')).interval,'year');
});

test('an old successful response cannot repopulate the workspace after session expiry', async () => {
  const h=clientHarness();let finishOld;
  h.context.fetch=async url=>new URL(url).searchParams.get('action')==='old-request'
    ?new Promise(resolve=>{finishOld=()=>resolve({ok:true,status:200,json:async()=>({private:true})});})
    :{ok:false,status:401,json:async()=>({error:{code:'AUTH_REQUIRED'}})};
  h.run(`snapshot={user:{id:'fixture',kind:'user'},entitlements:{tier:'pro'}};authScreen=()=>{};`);
  const old=h.run(`api('old-request')`);
  await assert.rejects(h.run(`api('expired-request')`),error=>error.code==='AUTH_REQUIRED');
  finishOld();
  await assert.rejects(old,error=>error.code==='AUTH_REQUIRED');
});

test('pricing labels its own switcher and puts the actual annual charge first', () => {
  const h=clientHarness('?tier=pro&interval=year');
  h.run(`catalog={ready:false,capabilities:{signupEnabled:true},plans:[{tier:'portfolio',prices:{year:{amount:9600}}},{tier:'pro',prices:{year:{amount:28800}}}]};
    root.classList={add:()=>{}};shell=content=>{globalThis.markup=content;};renderPricing();`);
  assert.match(h.context.markup,/\$96<small> \/ year/);
  assert.match(h.context.markup,/\$288<small> \/ year/);
  assert.match(h.run(`productSwitcher('pricing')`),/<summary>Plans &amp; pricing|<summary>Plans & pricing/);
  assert.match(h.run(`productSwitcher('pricing')`),/interval=year/);
});

test('a plan change displays the server preview recurring amount independently of local catalog totals', () => {
  const h=clientHarness();
  h.run(`showDialog=(title,body)=>{globalThis.markup=body;};bindForm=()=>{};
    showPlanPreview({amountDue:1200,currency:'USD',effectiveAt:1795000000000,expiresAt:1795000600000,
      futureRecurring:{amountMinor:28750,currency:'USD',interval:'year',intervalCount:1}}, {tier:'pro',interval:'year'});`);
  assert.match(h.context.markup,/Future recurring charge/);
  assert.match(h.context.markup,/287\.5 USD \/ year/);
  assert.match(h.context.markup,/Charge due now/);
});

test('account bookmarks recover billing and preserve the original terminal workspace', () => {
  const h=clientHarness('?tab=billing&workspace=terminal&tier=pro&interval=year');
  assert.equal(h.run('intent.returnPath'),'/en/portfolio/?tab=billing&workspace=terminal');
  assert.equal(h.run('accountWorkspace()'),'terminal');
  assert.match(h.run(`productHref('pricing')`),/interval=year/);
  assert.match(h.run(`productHref('pricing')`),/returnPath=%2Fen%2Fportfolio%2F%3Ftab%3Dbilling%26workspace%3Dterminal/);
});
