import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTerminalHandler } from '../netlify/functions/terminal.mjs';
import { applyCommand } from '../netlify/terminal/engine.mjs';
import { createLocalStore } from '../netlify/terminal/store-local.mjs';
import { createSupabaseStore } from '../netlify/terminal/store.mjs';
import { createProviderAdapters, normalizeNews, normalizeCalendar, normalizeBars, brokerAdapter } from '../netlify/terminal/providers.mjs';
import { sha256, COMMAND_QUOTAS, commandDigest } from '../netlify/terminal/security.mjs';
import { createTerminalPreviewServer, CSP } from '../scripts/serve-terminal.mjs';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const ORIGIN = 'https://terminal.test';
const ENV = {TERMINAL_ORIGIN:ORIGIN,TERMINAL_SESSION_SECRET:'terminal-test-secret-of-at-least-thirty-two-characters',TERMINAL_ALLOW_SIGNUP:'true'};
async function removeTemporaryDirectory(directory) {
  const resolved = path.resolve(directory);
  const relative = path.relative(path.resolve(tmpdir()),resolved);
  if (!/^nortivo-terminal-[^/\\]+$/.test(relative)) throw new Error('Refusing cleanup outside the terminal test directory.');
  await rm(resolved,{recursive:true,force:true,maxRetries:3,retryDelay:30});
}
function client(handler) {
  let cookie = '', csrf = '';
  return {
    get cookie() { return cookie; },
    get csrf() { return csrf; },
    async request(action, body, {method = body === undefined ? 'GET' : 'POST',headers = {},params = {}} = {}) {
      const query = new URLSearchParams({action,...params});
      const response = await handler({httpMethod:method,rawUrl:`${ORIGIN}/.netlify/functions/terminal?${query}`,queryStringParameters:Object.fromEntries(query),headers:{origin:ORIGIN,'content-type':'application/json',cookie,'x-csrf-token':csrf,'x-nf-client-connection-ip':'192.0.2.1',...headers},...(body === undefined ? {} : {body:JSON.stringify(body)})});
      if (response.headers['Set-Cookie']) cookie = response.headers['Set-Cookie'].split(';')[0];
      const data = response.headers['Content-Type'].startsWith('application/json') ? JSON.parse(response.body) : response.body;
      if (data.csrfToken) csrf = data.csrfToken;
      return {status:response.statusCode,data,headers:response.headers};
    },
    command(command, requestId = crypto.randomUUID()) { return this.request('command',{requestId,command}); },
  };
}
async function fixture(t, options = {}) {
  const store = await createLocalStore(':memory:');
  t.after(() => store.close());
  const handler = createTerminalHandler({store,env:ENV,now:() => NOW,...options});
  return {store,handler,a:client(handler),b:client(handler)};
}
const signup = (browser,email) => browser.request('signup',{email,password:'a-valid-test-password'});

test('guest workspace is immediately usable, discloses virtual funds and unavailable services',async t => {
  const {a} = await fixture(t);
  assert.equal((await a.request('session')).status,401);
  const guest = await a.request('guest',{});
  assert.equal(guest.status,200);
  assert.equal(guest.data.user.kind,'guest');
  assert.equal(guest.data.state.account.cashMinor,10_000_000);
  assert.equal(guest.data.state.account.winRate,null);
  assert.equal(guest.data.state.replay.mode,'sample');
  assert.equal(guest.data.state.replay.execution,'paper');
  assert.match(guest.data.storage.description,/seven days/);
  for (const name of ['market','news','calendar','ai','brokerage']) assert.equal(guest.data.integrations[name].available,false);
  assert.match(guest.headers['Set-Cookie'],/HttpOnly/);
  assert.match(guest.headers['Set-Cookie'],/Secure/);
  assert.match(guest.headers['Set-Cookie'],/SameSite=Strict/);
  assert.equal((await a.request('session')).data.user.id,guest.data.user.id);
  assert.equal((await a.request('market',undefined,{params:{mode:'sample',symbol:'NVDA'}})).data.mode,'sample');
  const unavailable = await a.request('market',undefined,{params:{mode:'provider',symbol:'NVDA'}});
  assert.equal(unavailable.status,503);
  assert.equal(unavailable.data.error.code,'INTEGRATION_NOT_CONFIGURED');
});

test('accounts isolate settings, orders and exports even when a client sends another owner ID',async t => {
  const {a,b} = await fixture(t);
  const alice = await signup(a,'alice@terminal.test'), bob = await signup(b,'bob@terminal.test');
  assert.equal(alice.status,200); assert.equal(bob.status,200);
  assert.notEqual(alice.data.user.id,bob.data.user.id);
  await a.command({type:'settings_update',settings:{language:'nb'}});
  const order = await a.command({type:'order_submit',symbol:'NVDA',side:'buy',orderType:'market',quantity:1,confirmed:true});
  assert.equal(order.status,200);
  const foreign = await b.command({type:'order_cancel',orderId:order.data.result.orderId,userId:alice.data.user.id});
  assert.equal(foreign.status,404);
  const own = await b.request('session',undefined,{params:{userId:alice.data.user.id}});
  assert.equal(own.data.user.id,bob.data.user.id); assert.equal(own.data.state.settings.language,'en');
  assert.equal(own.data.state.orders.length,0);
  assert.equal((await b.request('export')).data.split('\r\n').filter(Boolean).length,1);
  assert.equal((await a.request('session')).data.state.orders.length,1);
});

test('hosted signup is disabled by default; capabilities preserve guest/login and local signup',async t => {
  const hostedEnv = {...ENV}; delete hostedEnv.TERMINAL_ALLOW_SIGNUP;
  const {a} = await fixture(t,{env:hostedEnv});
  const disabled = await signup(a,'disabled@terminal.test');
  assert.equal(disabled.status,403); assert.equal(disabled.data.error.code,'SIGNUP_DISABLED');
  assert.equal(disabled.data.capabilities.signupEnabled,false);
  const guest = await a.request('guest',{});
  assert.equal(guest.status,200); assert.equal(guest.data.capabilities.signupEnabled,false);
  assert.equal(guest.data.capabilities.guestEnabled,true); assert.equal(guest.data.user.emailVerified,false);
  assert.equal((await a.request('integrations')).data.capabilities.signupEnabled,false);
  const {a:local} = await fixture(t,{env:{...hostedEnv,TERMINAL_LOCAL:'true'}});
  const signed = await signup(local,'local-only@terminal.test');
  assert.equal(signed.status,200); assert.equal(signed.data.capabilities.signupEnabled,true);
  const conflict = await signup(local,'local-only@terminal.test');
  assert.equal(conflict.status,409); assert.equal(conflict.data.error.code,'ACCOUNT_UNAVAILABLE');
  assert.equal(conflict.data.error.message.includes('email'),false);
});

test('remote failed logins cannot lock an email out from a different connection',async t => {
  const {a,b} = await fixture(t);
  await signup(a,'victim@terminal.test');
  for (let attempt=0;attempt<8;attempt++) {
    const wrong = await b.request('login',{email:'victim@terminal.test',password:'incorrect-test-password'},{headers:{'x-nf-client-connection-ip':'192.0.2.99'}});
    assert.equal(wrong.status,401);
  }
  const denied = await b.request('login',{email:'victim@terminal.test',password:'incorrect-test-password'},{headers:{'x-nf-client-connection-ip':'192.0.2.99'}});
  assert.equal(denied.status,429); assert.equal(denied.headers['Retry-After'],'900');
  const valid = await a.request('login',{email:'victim@terminal.test',password:'a-valid-test-password'});
  assert.equal(valid.status,200); assert.equal(valid.data.user.email,'victim@terminal.test');
});

test('same-origin and CSRF rules reject forged mutations and logout revokes the server session',async t => {
  const {a} = await fixture(t);
  const forgedGuest = await a.request('guest',{}, {headers:{origin:'https://attacker.test'}});
  assert.equal(forgedGuest.status,403);
  await a.request('guest',{});
  assert.equal((await a.request('command',{requestId:'csrf-test-request',command:{type:'engine_start'}},{headers:{'x-csrf-token':''}})).status,403);
  assert.equal((await a.request('command',{requestId:'csrf-test-request',command:{type:'engine_start'}},{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await a.request('logout',{})).status,200);
  assert.equal((await a.request('session')).status,401);
});

test('concurrent order retry creates one order and one fill; conflicting request payload is rejected',async t => {
  const {a} = await fixture(t);
  await a.request('guest',{});
  const command = {type:'order_submit',symbol:'NVDA',side:'buy',orderType:'market',quantity:2,confirmed:true};
  const results = await Promise.all([a.command(command,'same-order-request'),a.command(command,'same-order-request')]);
  assert.ok(results.every(result => result.status===200));
  assert.equal(results[0].data.result.orderId,results[1].data.result.orderId);
  assert.equal((await a.request('session')).data.state.orders.length,1);
  const filled = await a.command({type:'replay_advance',steps:1});
  assert.equal(filled.data.state.fills.length,1);
  assert.equal(filled.data.state.positions[0].quantity,2);
  const retry = await a.command(command,'same-order-request');
  assert.equal(retry.data.state.fills.length,1); assert.equal(retry.data.duplicate,true);
  const conflict = await a.command({...command,quantity:3},'same-order-request');
  assert.equal(conflict.status,409); assert.equal(conflict.data.error.code,'REQUEST_ID_REUSED');
});

test('CAS retries preserve independent changes made concurrently from two tabs',async t => {
  const {a,b,handler} = await fixture(t);
  await a.request('guest',{});
  // Two requests share the same identity, just as tabs share an HttpOnly cookie.
  const make = (command,requestId) => handler({httpMethod:'POST',rawUrl:`${ORIGIN}/.netlify/functions/terminal?action=command`,queryStringParameters:{action:'command'},headers:{origin:ORIGIN,cookie:a.cookie,'content-type':'application/json','x-csrf-token':a.csrf},body:JSON.stringify({requestId,command})});
  const responses = await Promise.all([make({type:'settings_update',settings:{language:'nb'}},'parallel-language'),make({type:'watchlist_remove',symbol:'AMD'},'parallel-watchlist')]);
  assert.ok(responses.every(response => response.statusCode===200));
  const session = await a.request('session');
  assert.equal(session.data.state.settings.language,'nb'); assert.equal(session.data.state.watchlist.includes('AMD'),false); assert.equal(session.data.revision,2);
});

test('durable receipts prevent old commands from replaying after the engine receipt window is trimmed',async t => {
  const {a,store} = await fixture(t);
  const guest = await a.request('guest',{});
  const command = {type:'settings_update',settings:{language:'nb'}};
  await a.command(command,'permanent-old-request');
  let record = await store.getState(guest.data.user.id);
  for (let i=0;i<260;i++) {
    const requestId = `trim-window-${i}`;
    const nextCommand = i===259 ? {type:'settings_update',settings:{language:'en'}} : {type:'notifications_read'};
    const applied = applyCommand(record.state,nextCommand,requestId,{now:NOW});
    const committed = await store.commitCommand(guest.data.user.id,record.revision,applied.state,{requestId,digest:sha256(JSON.stringify(nextCommand)),result:applied.result,now:NOW});
    record = {state:applied.state,revision:committed.revision};
  }
  assert.equal(record.state.requestLog.some(item => item.id==='permanent-old-request'),false);
  const retry = await a.command(command,'permanent-old-request');
  assert.equal(retry.status,200); assert.equal(retry.data.duplicate,true);
  assert.equal(retry.data.state.settings.language,'en'); assert.equal(retry.data.revision,261);
});

test('atomic receipt quota bounds unique commands across tabs and retains old retries and export',async t => {
  const {a,store} = await fixture(t);
  const guest = await a.request('guest',{}), ownerId = guest.data.user.id;
  const command = {type:'notifications_read'}, digest = commandDigest(command);
  let record = await store.getState(ownerId);
  for (let index=0;index<COMMAND_QUOTAS.guest-1;index++) {
    const commit = await store.commitCommand(ownerId,record.revision,record.state,{requestId:`quota-fill-${index}`,digest,result:{saved:true},now:NOW});
    assert.equal(commit.status,'applied'); record.revision=commit.revision;
  }
  const last = await Promise.all([a.command(command,'quota-final-one'),a.command(command,'quota-final-two')]);
  assert.deepEqual(last.map(result => result.status).sort(),[200,409]);
  assert.equal(last.find(result => result.status===409).data.error.code,'WORKSPACE_COMMAND_LIMIT');
  const stored = await store.getState(ownerId);
  assert.equal(stored.commandCount,COMMAND_QUOTAS.guest); assert.equal(stored.revision,COMMAND_QUOTAS.guest);
  const retry = await a.command(command,'quota-fill-0');
  assert.equal(retry.status,200); assert.equal(retry.data.duplicate,true);
  assert.equal((await a.request('session')).data.storage.commandsRemaining,0);
  assert.equal((await a.request('export')).status,200);
});

test('new commands have a separate lower rate; duplicate receipts remain usable when it is exhausted',async t => {
  const {a} = await fixture(t); await a.request('guest',{});
  for (let index=0;index<90;index++) assert.equal((await a.command({type:'notifications_read'},`new-command-${index}`)).status,200);
  const rejected = await a.command({type:'notifications_read'},'new-command-over-limit');
  assert.equal(rejected.status,429); assert.equal(rejected.headers['Retry-After'],'60');
  assert.equal((await a.command({type:'notifications_read'},'new-command-0')).data.duplicate,true);
});

test('paper confirmation, insufficient funds and risk limits are enforced on the server',async t => {
  const {a} = await fixture(t);
  await a.request('guest',{});
  const order = {type:'order_submit',symbol:'NVDA',side:'buy',orderType:'market',quantity:100000,confirmed:true};
  assert.equal((await a.command({...order,confirmed:false})).status,400);
  const rejected = await a.command(order);
  assert.equal(rejected.status,200); assert.equal(rejected.data.result.status,'rejected');
  assert.equal(rejected.data.result.riskChecks.find(check => check.id==='cash').passed,false);
  assert.equal(rejected.data.state.account.cashMinor,10_000_000); assert.equal(rejected.data.state.fills.length,0);
  const live = await a.command({...order,quantity:1,executionMode:'live'});
  assert.equal(live.status,503); assert.equal(live.data.error.code,'BROKER_NOT_CONFIGURED');
  const invalid = await a.command({type:'settings_update',risk:{maxPositionBps:10000,maxExposureBps:100}});
  assert.equal(invalid.status,400); assert.equal((await a.request('session')).data.state.risk.maxExposureBps,6000);
});

test('file persistence survives restart; only hashed sessions and scrypt passwords are stored',async t => {
  const directory = await mkdtemp(path.join(tmpdir(),'nortivo-terminal-test-'));
  const filename = path.join(directory,'private.sqlite');
  let store = await createLocalStore(filename);
  t.after(async () => {store.close(); await removeTemporaryDirectory(directory);});
  let handler = createTerminalHandler({store,env:ENV,now:() => NOW});
  const a = client(handler); const signed = await signup(a,'persistent@terminal.test');
  assert.equal(signed.status,200);
  await a.command({type:'watchlist_remove',symbol:'AMD'},'persist-watchlist');
  const savedCookie = a.cookie, raw = savedCookie.split('=')[1];
  assert.equal(await store.getSession(raw,NOW),null);
  assert.equal((await store.getSession(sha256(raw),NOW)).id,signed.data.user.id);
  const user = await store.findUserByEmail('persistent@terminal.test');
  assert.match(user.password_hash,/^scrypt-v1\$32768\$8\$1\$/); assert.equal(user.password_hash.includes('a-valid-test-password'),false);
  store.close();
  const file = await readFile(filename);
  assert.equal(file.includes(Buffer.from(raw)),false); assert.equal(file.includes(Buffer.from('a-valid-test-password')),false);
  store = await createLocalStore(filename);
  handler = createTerminalHandler({store,env:ENV,now:() => NOW});
  const restored = await handler({httpMethod:'GET',rawUrl:`${ORIGIN}/.netlify/functions/terminal?action=session`,queryStringParameters:{action:'session'},headers:{cookie:savedCookie}});
  assert.equal(restored.statusCode,200); assert.equal(JSON.parse(restored.body).state.watchlist.includes('AMD'),false);
  const browser = client(handler);
  assert.equal((await browser.request('login',{email:'persistent@terminal.test',password:'a-valid-test-password'})).status,200);
  assert.equal((await browser.request('login',{email:'persistent@terminal.test',password:'incorrect-password-test'})).status,401);
});

test('rate limits persist across processes and expired guest identities cannot be restored',async t => {
  const directory = await mkdtemp(path.join(tmpdir(),'nortivo-terminal-limit-'));
  const filename = path.join(directory,'private.sqlite');
  let store = await createLocalStore(filename);
  t.after(async () => {store.close(); await removeTemporaryDirectory(directory);});
  assert.equal((await store.consumeRateLimit('test-limit',1,60_000,NOW)).allowed,true);
  store.close(); store = await createLocalStore(filename);
  assert.equal((await store.consumeRateLimit('test-limit',1,60_000,NOW)).allowed,false);
  assert.equal((await store.consumeRateLimit('test-limit',1,60_000,NOW+60001)).allowed,true);
  const a = client(createTerminalHandler({store,env:ENV,now:() => NOW})); await a.request('guest',{});
  const handler = createTerminalHandler({store,env:ENV,now:() => NOW+8*86400_000});
  const expired = await handler({httpMethod:'GET',rawUrl:`${ORIGIN}/.netlify/functions/terminal?action=session`,queryStringParameters:{action:'session'},headers:{cookie:a.cookie}});
  assert.equal(expired.statusCode,401);
});

test('persisted per-key rates count concurrent calls atomically and expose remaining retry time',async t => {
  const {store} = await fixture(t);
  const results = await Promise.all(Array.from({length:20},() => store.consumeRateLimit('concurrent-limit',5,15*60_000,NOW)));
  assert.equal(results.filter(result => result.allowed).length,5);
  assert.equal((await store.consumeRateLimit('concurrent-limit',5,15*60_000,NOW+31_001)).retryAfterMs,868999);
  assert.equal((await store.consumeRateLimit('another-key',1,60_000,NOW)).allowed,true);
  let clock = NOW;
  const a = client(createTerminalHandler({store,env:ENV,now:() => clock}));
  for (let attempt=0;attempt<8;attempt++) await a.request('login',{email:'missing@terminal.test',password:'incorrect-test-password'});
  clock+=31_001;
  const denied = await a.request('login',{email:'missing@terminal.test',password:'incorrect-test-password'});
  assert.equal(denied.status,429); assert.equal(denied.headers['Retry-After'],'869');
});

test('request limits, unavailable storage and internal errors return safe bounded errors',async t => {
  const {a,handler} = await fixture(t);
  assert.equal((await a.request('guest',{}, {method:'GET'})).status,405);
  const large = await a.request('guest',{value:'x'.repeat(25000)}); assert.equal(large.status,413);
  const malformed = await handler({httpMethod:'POST',rawUrl:`${ORIGIN}/.netlify/functions/terminal?action=guest`,queryStringParameters:{action:'guest'},headers:{origin:ORIGIN,'content-type':'application/json'},body:'{'});
  assert.equal(malformed.statusCode,400);
  const noStorage = client(createTerminalHandler({env:ENV}));
  const unavailable = await noStorage.request('guest',{}); assert.equal(unavailable.status,503); assert.equal(unavailable.data.error.code,'STORAGE_NOT_CONFIGURED');
  const badStore = client(createTerminalHandler({env:ENV,store:{consumeRateLimit:async () => {throw new Error('PRIVATE_SECRET_database_problem');}}}));
  assert.equal(JSON.stringify(await badStore.request('guest',{})).includes('PRIVATE_SECRET'),false);
  assert.throws(() => createSupabaseStore({...ENV,SUPABASE_URL:'http://unsafe.test',SUPABASE_SERVICE_ROLE_KEY:'test-key'}),/not configured correctly/);
});

test('provider requires independent credentials and entitlement; failures do not switch to sample',async () => {
  let calls = 0;
  const fetcher = async () => { calls++; throw new Error('PRIVATE_PROVIDER_CREDENTIAL'); };
  for (const env of [{FINNHUB_API_KEY:'fixture-only'},{TERMINAL_FINNHUB_COMMERCIAL_DISPLAY:'true'}]) {
    const adapters = createProviderAdapters({...env,TERMINAL_FINNHUB_CAPABILITIES:'market,news,calendar'},fetcher);
    await assert.rejects(() => adapters.news({},NOW),{code:'INTEGRATION_NOT_CONFIGURED'});
  }
  assert.equal(calls,0);
  const adapters = createProviderAdapters({FINNHUB_API_KEY:'fixture-only',TERMINAL_FINNHUB_COMMERCIAL_DISPLAY:'true',TERMINAL_FINNHUB_CAPABILITIES:'news'},fetcher);
  await assert.rejects(() => adapters.news({},NOW),error => error.code==='PROVIDER_UNAVAILABLE' && !error.message.includes('PRIVATE_PROVIDER'));
  await assert.rejects(() => brokerAdapter.submitOrder({}),{code:'BROKER_NOT_CONFIGURED'});
});

test('provider chronology flags stale quotes and deduplicates/sorts bars without filling gaps',async () => {
  const data = {
    'stock/profile2':{ticker:'NVDA',currency:'USD',country:'US'},
    quote:{c:100,pc:101,t:NOW/1000-600},
    'stock/candle':{s:'ok',t:[NOW/1000-600,NOW/1000-720,NOW/1000-600],o:[100,99,100],h:[101,100,101],l:[99,98,99],c:[100,99,100],v:[50,40,50]},
  };
  const adapters = createProviderAdapters({FINNHUB_API_KEY:'fixture-only',TERMINAL_FINNHUB_COMMERCIAL_DISPLAY:'true',TERMINAL_FINNHUB_CAPABILITIES:'market'},async url => new Response(JSON.stringify(data[new URL(url).pathname.replace('/api/v1/','')]),{headers:{'Content-Type':'application/json'}}));
  const market = await adapters.market({symbol:'NVDA'},NOW);
  assert.equal(market.stale,true); assert.equal(market.mode,'provider'); assert.equal(market.executionEligible,false);
  assert.equal(market.bars.length,2); assert.ok(market.bars[0].time<market.bars[1].time); assert.equal(market.delayMinutes,null);
  const cached = await adapters.market({symbol:'NVDA'},NOW+30_000);
  assert.equal(cached.fetchedAt,market.fetchedAt); assert.equal(cached.barsFetchedAt,market.barsFetchedAt);
  assert.throws(() => normalizeBars({...data['stock/candle'],c:[100,-1,100]},NOW),{code:'PROVIDER_INVALID_DATA'});
});

test('external news is safe text with source/time/link; calendar never invents missing actuals',() => {
  const article = {headline:'<b>Provider headline</b>',summary:'<script>doNotExecute()</script> article excerpt',source:'Fixture source',url:'https://example.test/article',datetime:NOW/1000-60,related:'NVDA',category:'general'};
  const news = normalizeNews([article,article,{...article,url:'javascript:alert(1)'},{...article,url:'https://example.test/future',datetime:NOW/1000+3600}],{now:NOW});
  assert.equal(news.length,1); assert.equal(news[0].title,'Provider headline'); assert.equal(news[0].summary.includes('<'),false); assert.equal(news[0].machineGenerated,false); assert.equal(news[0].sentiment,null);
  const events = normalizeCalendar({economicCalendar:[{event:'Test event',time:'2026-11-18T10:00:00Z',estimate:1.2,prev:1.1},{event:'Unzoned event',time:'2026-11-18 10:00:00',actual:0}]},NOW);
  assert.equal(events[0].actual,null); assert.equal(events[0].forecast,1.2); assert.equal(events[0].previous,1.1); assert.equal(events[0].status,'scheduled');
  assert.equal(events[1].time,null); assert.equal(events[1].actual,0);
});

test('standalone terminal server serves static pages/current CSP and leaves support disconnected',async t => {
  const store = await createLocalStore(':memory:'); t.after(() => store.close());
  const server = await createTerminalPreviewServer({port:4420,store,secret:ENV.TERMINAL_SESSION_SECRET});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const address = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(`${address}/en/`); assert.equal(page.status,200); assert.equal(page.headers.get('content-security-policy'),CSP);
  const support = await fetch(`${address}/.netlify/functions/tickets`); assert.equal(support.status,503);
  const guest = await fetch(`${address}/.netlify/functions/terminal?action=guest`,{method:'POST',headers:{origin:'http://127.0.0.1:4420','content-type':'application/json'},body:'{}'});
  assert.equal(guest.status,200); assert.equal((await guest.json()).state.replay.mode,'sample'); assert.equal(guest.headers.get('set-cookie').includes('Secure'),false);
});
