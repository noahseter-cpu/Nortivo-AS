// Explicit smoke test for an owner-authorized hosted release. Creates two isolated
// fictional guest workspaces; it never enables signup, providers or real brokerage.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const origin = new URL(process.argv[2] || '').origin;
assert.match(origin, /^https:\/\/(?:nortivo\.no|[a-z0-9-]+\.netlify\.app)$/);
const endpoint = `${origin}/.netlify/functions/terminal`;
const checks = [];
async function request(client, action, {method='GET', body, csrf=true, expected=200, requestOrigin=origin}={}) {
  const headers = {Origin:requestOrigin};
  if (client.cookie) headers.Cookie = client.cookie;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    if (csrf && client.csrfToken) headers['X-CSRF-Token'] = client.csrfToken;
  }
  const response = await fetch(`${endpoint}?action=${action}`, {
    method, headers, body:body === undefined ? undefined : JSON.stringify(body),
    signal:AbortSignal.timeout(30_000), redirect:'error',
  });
  const setCookie = response.headers.get('set-cookie');
  const text = await response.text();
  let data;
  try { data=JSON.parse(text); } catch { throw new Error(`${action}: non-JSON HTTP ${response.status}`); }
  assert.equal(response.status, expected, `${action}: HTTP ${response.status}; code ${data?.error?.code || 'none'}`);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  if (setCookie && expected === 200) {
    assert.match(setCookie, /HttpOnly/i);assert.match(setCookie, /Secure/i);assert.match(setCookie, /SameSite=Strict/i);
    client.cookie=setCookie.split(';')[0];
  }
  if (data.csrfToken) client.csrfToken=data.csrfToken;
  return data;
}
const command = (client, command, requestId=crypto.randomUUID()) => request(client,'command',{method:'POST',body:{requestId,command}});
const a={}, b={};
const first=await request(a,'guest',{method:'POST',body:{}});
const second=await request(b,'guest',{method:'POST',body:{}});
assert.notEqual(first.user.id,second.user.id);
assert.equal(first.state.account.startingCashMinor,10_000_000);
assert.equal(first.state.account.currency,'USD');
assert.equal(first.state.replay.mode,'sample');assert.equal(first.state.replay.execution,'paper');
assert.equal(first.capabilities.signupEnabled,false);
checks.push('two isolated hosted guest workspaces; secure cookies; explicit sample/paper mode; signup gated');

await request(a,'command',{method:'POST',csrf:false,body:{requestId:crypto.randomUUID(),command:{type:'notifications_read'}},expected:403});
await request(a,'command',{method:'POST',requestOrigin:'https://example.invalid',body:{requestId:crypto.randomUUID(),command:{type:'notifications_read'}},expected:403});
checks.push('missing CSRF and foreign origin rejected');

await command(a,{type:'select_symbol',symbol:'AMD'});
await Promise.all([
  command(a,{type:'settings_update',settings:{timezone:'UTC'}}),
  command(a,{type:'settings_update',risk:{maxTradesPerDay:21}}),
]);
const concurrent=await request(a,'session');
assert.equal(concurrent.state.settings.timezone,'UTC');assert.equal(concurrent.state.risk.maxTradesPerDay,21);
checks.push('concurrent private changes survive actual PostgreSQL CAS');

const requestId=crypto.randomUUID();
const order={type:'order_submit',symbol:'AMD',side:'buy',orderType:'market',quantity:2,confirmed:true};
await Promise.all([command(a,order,requestId),command(a,order,requestId)]);
const pending=await request(a,'session');
assert.equal(pending.state.orders.length,1);assert.equal(pending.state.orders[0].status,'pending');
assert.equal(pending.state.fills.length,0);
await request(b,'command',{method:'POST',body:{requestId:crypto.randomUUID(),command:{type:'order_cancel',orderId:pending.state.orders[0].id}},expected:404});
await command(a,{type:'replay_advance',steps:1});
const filled=await request(a,'session');
assert.equal(filled.state.orders.length,1);assert.equal(filled.state.orders[0].status,'filled');
assert.equal(filled.state.fills.length,1);
const fill=filled.state.fills[0];
assert.equal(fill.symbol,'AMD');assert.equal(fill.quantity,2);
assert.equal(filled.state.account.cashMinor,10_000_000-fill.grossMinor-fill.feeMinor);
assert.equal(filled.state.ledger.reduce((sum,e)=>sum+e.amountMinor,0),filled.state.account.cashMinor);
assert.equal(filled.state.account.equityMinor-filled.state.account.startingCashMinor,filled.state.account.realizedPnlMinor+filled.state.account.unrealizedPnlMinor);
const unchanged=await request(b,'session');
assert.equal(unchanged.state.orders.length,0);assert.equal(unchanged.state.account.cashMinor,10_000_000);
checks.push('duplicate submission creates one next-bar fill; fee/ledger reconcile; another owner cannot cancel or see it');

const exportResponse=await fetch(`${endpoint}?action=export`,{headers:{Cookie:a.cookie,Origin:origin},signal:AbortSignal.timeout(30_000)});
assert.equal(exportResponse.status,200);assert.match(exportResponse.headers.get('content-type') || '',/csv/);
assert.match(await exportResponse.text(),/AMD/);
await request(a,'broker',{method:'POST',body:{},expected:503});
checks.push('private CSV works; real brokerage endpoint remains disabled');

await request(a,'logout',{method:'POST',body:{}});
await request(a,'session',{expected:401});
await request(b,'session');
await request(b,'logout',{method:'POST',body:{}});
checks.push('logout revokes only its own session');

// Never print cookies, CSRF tokens, identifiers or response bodies.
console.log(JSON.stringify({origin,passed:true,checks},null,2));
