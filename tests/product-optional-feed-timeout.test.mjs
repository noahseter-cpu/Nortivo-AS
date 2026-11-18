import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/assets/product-core.js';

const source=readFileSync(new URL('../dist/assets/product-client.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export async function startProduct','async function startProduct');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const response=data=>({ok:true,status:200,json:async()=>data});
const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
function harness(fetcher){
  const timers=new Map();let sequence=0;const requests=[];
  const context=vm.createContext({...core,esc:core.escapeHtml,MarketChart:class{},URL,URLSearchParams,Intl,Set,Map,Date,AbortController,
    location:{origin:'https://invest.nortivo.no',pathname:'/en/terminal/',search:''},
    sessionStorage:{getItem:()=>null},document:{querySelector:()=>null},
    setTimeout:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),
    fetch:(url,options)=>{requests.push({url:new URL(url),options});return fetcher(new URL(url),options);}});
  vm.runInContext(source,context);
  return {context,requests,timers,run:code=>vm.runInContext(code,context),expire:()=>{for(const {callback} of [...timers.values()])callback();}};
}

for(const action of ['product-news','product-calendar'])test(`${action} GET is bounded even when the transport ignores abort`,async()=>{
  const h=harness(()=>new Promise(()=>{}));const pending=h.run(`api('${action}')`);
  assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].delay,10000);
  assert.equal(h.requests[0].options.signal.aborted,false);
  h.expire();await assert.rejects(pending,error=>error.code==='OPTIONAL_FEED_TIMEOUT');
  assert.equal(h.requests[0].options.signal.aborted,true);assert.equal(h.timers.size,0);
});

test('the optional deadline includes an unresponsive response body',async()=>{
  const h=harness(async()=>({ok:true,status:200,json:()=>new Promise(()=>{})}));
  const pending=h.run(`api('product-news')`);await flush();h.expire();
  await assert.rejects(pending,error=>error.code==='OPTIONAL_FEED_TIMEOUT');assert.equal(h.timers.size,0);
});

test('fast optional feed reads preserve their exact data and clear the deadline',async()=>{
  const data={items:[{title:'Fixture original reporting',publishedAt:'2026-11-18T20:00:00Z'}]};
  const h=harness(async()=>response(data));assert.equal(await h.run(`api('product-news')`),data);
  assert.equal(h.timers.size,0);assert.equal(h.requests[0].options.signal.aborted,false);
});

test('ordinary reads, authentication, history, backtests and all mutations receive no optional deadline',async()=>{
  for(const [action,method] of [['session','GET'],['product','GET'],['product-quotes','GET'],['product-portfolio','GET'],['login','POST'],['product-backtest','POST'],['product-scan','POST'],['product-news','POST'],['product-calendar','POST'],['product-broker-order','POST']]){
    const reply=deferred(),h=harness(()=>reply.promise);const pending=h.run(`api('${action}',{method:'${method}',${method==='POST'?"body:{requestId:'fixture-request'}":''}})`);
    assert.equal(h.timers.size,0,action);assert.equal('signal' in h.requests[0].options,false,action);
    reply.resolve(response({ok:true}));assert.deepEqual(await pending,{ok:true});
  }
});

test('instrument selection renders the completed market chart after a slow optional news deadline',async()=>{
  const quote={quote:{instrumentId:'XNAS:NVDA:USD',price:'154.81',asOf:'2026-11-18T20:00:00Z'},bars:[]};
  const h=harness(async url=>url.searchParams.get('action')==='product-quotes'?response(quote):new Promise(()=>{}));
  h.run(`renderTerminal=()=>{globalThis.renders=(globalThis.renders||0)+1;};notify=()=>{};`);
  const pending=h.run(`selectMarket({id:'XNAS:NVDA:USD',symbol:'NVDA'})`);await flush();
  assert.equal(h.context.renders,1);h.expire();await pending;
  assert.equal(h.context.renders,2);assert.equal(h.run('marketData'),quote);
  assert.equal(h.run('selectedInstrument.symbol'),'NVDA');
});

test('startup context continues to reminders after both optional feeds stop responding',async()=>{
  const h=harness(async url=>url.searchParams.get('action')==='product-reminders'?response({reminders:[]}):new Promise(()=>{}));
  const pending=h.run('loadContext()');await flush();assert.equal(h.timers.size,2);h.expire();await pending;
  assert.equal(h.requests.at(-1).url.searchParams.get('action'),'product-reminders');assert.equal(h.timers.size,0);
});
