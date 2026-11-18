import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../dist/assets/product-core.js';

const source = (await readFile(new URL('../dist/assets/product-client.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace('export async function startProduct', 'async function startProduct');
const response = data => ({ ok: true, status: 200, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness(route) {
  const requests = [];
  const context = vm.createContext({ ...core, esc: core.escapeHtml, MarketChart: class {}, URL, URLSearchParams, Intl, Set, Map, Date, AbortController,
    location: { origin: 'https://invest.nortivo.no', pathname: '/en/terminal/', search: '' },
    sessionStorage: { getItem: () => null, setItem() {} },
    document: { querySelector: () => null, documentElement: {} }, console, setTimeout, clearTimeout,
    fetch: (url, options) => { const request = { url: new URL(url), options }; requests.push(request); return route(request.url, options); },
  });
  vm.runInContext(source, context);
  vm.runInContext('globalThis.__setResolution=value=>{resolution=value}', context);
  return { context, requests, run: code => vm.runInContext(code, context) };
}

test('rapid instrument changes keep only the newest quote and news response', async () => {
  const firstQuote = deferred(), firstNews = deferred(), secondQuote = deferred(), secondNews = deferred();
  const h = harness(url => {
    const action = url.searchParams.get('action'), symbol = url.searchParams.get('symbol') || '';
    if (action === 'product-quotes') return url.searchParams.get('instrumentId')?.includes('AAPL') ? firstQuote.promise : secondQuote.promise;
    if (action === 'product-news') return symbol === 'AAPL' ? firstNews.promise : secondNews.promise;
    throw new Error(`unexpected ${action}`);
  });
  h.run(`renderTerminal=()=>{};notify=()=>{};terminalMode='provider';`);
  const first = h.run(`selectMarket({id:'XNAS:AAPL:USD',symbol:'AAPL',name:'Apple'})`);
  const second = h.run(`selectMarket({id:'XNAS:MSFT:USD',symbol:'MSFT',name:'Microsoft'})`);
  await flush();
  secondQuote.resolve(response({ quote: { instrumentId: 'XNAS:MSFT:USD', price: '500' } }));
  secondNews.resolve(response({ items: [{ id: 'msft-newest' }] }));
  await second;
  firstQuote.resolve(response({ quote: { instrumentId: 'XNAS:AAPL:USD', price: '100' } }));
  firstNews.resolve(response({ items: [{ id: 'aapl-stale' }] }));
  await first;
  assert.equal(h.run('selectedInstrument.symbol'), 'MSFT');
  assert.equal(h.run('marketData.quote.instrumentId'), 'XNAS:MSFT:USD');
  assert.equal(h.run('news[0].id'), 'msft-newest');
});

test('chart becomes visible after quote without waiting for optional news', async () => {
  const quote = deferred(), news = deferred(), h = harness(url => url.searchParams.get('action') === 'product-quotes'
    ? quote.promise : news.promise);
  let renders = 0;
  h.run(`globalThis.renders=0;renderTerminal=()=>{globalThis.renders++};notify=()=>{};terminalMode='provider';`);
  const pending = h.run(`selectMarket({id:'XNAS:AAPL:USD',symbol:'AAPL',name:'Apple'})`);
  await flush();
  quote.resolve(response({ quote: { instrumentId: 'XNAS:AAPL:USD', price: '100' } }));
  await flush();
  await flush();
  assert.equal(h.context.renders > 0, true);
  // The unresolved optional news request must not prevent the chart render.
  assert.equal(h.requests.some(request => request.url.searchParams.get('action') === 'product-news'), true);
  news.resolve(response({ items: [] }));
  await pending;
});

test('rapid timeframe changes do not let an older quote replace the selected resolution', async () => {
  const oldQuote = deferred(), newQuote = deferred();
  let quoteCalls = 0;
  const h = harness(url => url.searchParams.get('action') === 'product-quotes'
    ? (++quoteCalls === 1 ? oldQuote.promise : newQuote.promise) : response({ items: [] }));
  h.run(`renderTerminal=()=>{};notify=()=>{};terminalMode='provider';selectedInstrument={id:'XNAS:AAPL:USD',symbol:'AAPL'};__setResolution('1m');`);
  const old = h.run(`selectMarket(selectedInstrument)`);
  h.run(`__setResolution('5m')`);
  const newer = h.run(`selectMarket(selectedInstrument)`);
  await flush();
  newQuote.resolve(response({ quote: { instrumentId: 'XNAS:AAPL:USD', resolution: '5m', price: '105' } }));
  await newer;
  oldQuote.resolve(response({ quote: { instrumentId: 'XNAS:AAPL:USD', resolution: '1m', price: '101' } }));
  await old;
  assert.equal(h.run('marketData.quote.price'), '105');
});

test('terminal boot reuses the broker snapshot instead of issuing a duplicate status read', async () => {
  const h = harness(url => {
    const action = url.searchParams.get('action');
    if (action === 'product-broker-status') throw new Error('duplicate broker status read');
    if (action === 'product-strategy') return response({ strategies: [] });
    if (action === 'product-broker-orders') return response({ intents: [] });
    if (action === 'product-watchlist') return response({ instruments: [] });
    return response({ items: [], events: [], reminders: [] });
  });
  h.run(`terminalMode='sample';snapshot={broker:{connections:[{id:'paper-1'}]}};brokerStatus=null;loadContext=async()=>{};`);
  await h.run('loadTerminalData({initial:true})');
  assert.equal(h.requests.some(request => request.url.searchParams.get('action') === 'product-broker-status'), false);
});

test('a normal refresh still fetches fresh broker status after an initial boot', async () => {
  let brokerReads = 0;
  const h = harness(url => {
    const action = url.searchParams.get('action');
    if (action === 'product-broker-status') { brokerReads++; return response({ connections: [{ id: 'fresh' }] }); }
    if (action === 'product-strategy') return response({ strategies: [] });
    if (action === 'product-broker-orders') return response({ intents: [] });
    if (action === 'product-watchlist') return response({ instruments: [] });
    return response({ items: [], events: [], reminders: [] });
  });
  h.run(`terminalMode='sample';snapshot={broker:{connections:[{id:'cached'}]}};brokerStatus=snapshot.broker;loadContext=async()=>{};`);
  await h.run('loadTerminalData()');
  assert.equal(brokerReads, 1);
  assert.equal(h.run('brokerStatus.connections[0].id'), 'fresh');
});

test('a delayed watchlist cannot auto-select or repaint over account and billing screens', async () => {
  const watchlist = deferred(); let selections = 0, renders = 0;
  const h = harness(url => {
    const action = url.searchParams.get('action');
    if (action === 'product-watchlist') return watchlist.promise;
    if (action === 'product-strategy') return response({ strategies: [] });
    if (action === 'product-broker-orders') return response({ intents: [] });
    return response({ items: [], events: [], reminders: [] });
  });
  h.run(`globalThis.selections=0;globalThis.renders=0;location.pathname='/en/portfolio/';surface='account';terminalMode='provider';snapshot={broker:{connections:[]}};brokerStatus=null;loadContext=async()=>{};selectMarket=()=>{globalThis.selections++};renderTerminal=()=>{globalThis.renders++};`);
  const pending = h.run('loadTerminalData({initial:true})');
  await flush();
  watchlist.resolve(response({ instruments: [{ id: 'XNAS:AAPL:USD', symbol: 'AAPL' }] }));
  await pending;
  assert.equal(h.context.selections, 0);
  assert.equal(h.context.renders, 0);
  assert.equal(h.run('surface'), 'account');
});

test('late background responses are discarded after the normal workspace clear', async () => {
  const delayedWatchlist = deferred(), delayedStrategy = deferred();
  const h = harness(url => {
    const action = url.searchParams.get('action');
    if (action === 'product-watchlist') return delayedWatchlist.promise;
    if (action === 'product-strategy') return delayedStrategy.promise;
    if (action === 'product-broker-orders') return response({ intents: [] });
    return response({ items: [], events: [], reminders: [] });
  });
  h.run(`surface='workspace';terminalMode='provider';snapshot={broker:{connections:[]}};brokerStatus=null;loadContext=async()=>{};`);
  const pending = h.run('loadTerminalData({initial:true})');
  await flush();
  h.run('clearPrivateWorkspace()');
  delayedWatchlist.resolve(response({ instruments: [{ id: 'XNAS/AAPL', symbol: 'AAPL' }] }));
  delayedStrategy.resolve(response({ strategies: [{ id: 'late-private-strategy' }] }));
  await pending;
  assert.equal(h.run('watchlist.length'), 0);
  assert.equal(h.run('strategies.length'), 0);
  assert.equal(h.run('selectedInstrument'), null);
});

test('interactive chart/navigation reads remain concurrent while mutations stay serialized', () => {
  assert.match(source, /const concurrent=\[[^\]]*terminal-view/);
  assert.match(source, /const concurrent=\[[^\]]*product-timeframe/);
  assert.match(source, /const concurrent=\[[^\]]*account/);
  assert.match(source, /const concurrent=\[[^\]]*billing/);
  assert.doesNotMatch(source.match(/const concurrent=\[[^\]]*\]/)?.[0] || '', /checkout|product-broker-order|product-portfolio/);
});

test('queued background render preserves a newly focused unsent AI field', async () => {
  const h = harness(() => response({ items: [] }));
  h.run(`globalThis.renders=0;globalThis.aiField={value:''};root={contains:()=>true,querySelector:()=>globalThis.aiField};dialog={open:false};surface='workspace';terminalMode='provider';renderTerminal=()=>{globalThis.renders++};document.activeElement={tagName:'BUTTON'};queueTerminalRender();document.activeElement={tagName:'TEXTAREA'};`);
  await flush();
  assert.equal(h.context.renders, 0);
  h.run(`document.activeElement={tagName:'BUTTON'};queueTerminalRender();`);
  await flush();
  assert.equal(h.context.renders, 1);
  h.run(`aiField.value='unsent question';queueTerminalRender();`);
  await flush();
  assert.equal(h.context.renders, 1);
  h.run(`aiField.value='';queueTerminalRender();`);
  await flush();
  assert.equal(h.context.renders, 2);
});

test('portfolio callers still await optional context loading', async () => {
  const feeds = deferred();
  const h = harness(url => ['product-news', 'product-calendar'].includes(url.searchParams.get('action')) ? feeds.promise : response({ reminders: [] }));
  h.run(`location.pathname='/en/portfolio/';summary={holdings:[]};selectedInstrument=null;loadReminders=async()=>{}`);
  const pending = h.run('loadContext()');
  await flush();
  const completed = await Promise.race([pending.then(() => true), Promise.resolve(false)]);
  assert.equal(completed, false);
  feeds.resolve(response({ items: [], events: [] }));
  await pending;
});

test('same market read key is deduplicated briefly and cleared after session expiry', async () => {
  const quote = deferred(); let quoteCalls = 0;
  const h = harness(url => url.searchParams.get('action') === 'product-quotes'
    ? (++quoteCalls, quote.promise) : response({ items: [] }));
  h.run(`root={classList:{remove(){},add(){}},querySelector:()=>null,innerHTML:''};dialog={open:false};renderTerminalEntry=()=>{};authScreen=()=>{};renderTerminal=()=>{};notify=()=>{};terminalMode='provider';`);
  const first = h.run(`selectMarket({id:'XNAS:AAPL:USD',symbol:'AAPL',name:'Apple'})`);
  await flush();
  quote.resolve(response({ quote: { instrumentId: 'XNAS:AAPL:USD', price: '100' } }));
  await first;
  const second = h.run(`selectMarket({id:'XNAS:AAPL:USD',symbol:'AAPL',name:'Apple'})`);
  await second;
  assert.equal(quoteCalls, 1);
  h.run(`clearPrivateWorkspace()`);
  assert.equal(h.run('marketReadCache.size'), 0);
});
