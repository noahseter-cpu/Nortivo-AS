import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {setImmediate as nextTurn} from 'node:timers/promises';
import * as core from '../dist/assets/admin-core.js';

const now=Date.parse('2026-11-18T12:00:00Z');
const ticket=(id,status='open',created='2026-11-16T10:00:00Z',updated=created)=>({id:String(id),ticket_number:'NT-'+id,name:'Customer '+id,email:'fixture'+id+'@example.test',subject:'Question '+id,message:'Synthetic request',status,created_at:created,updated_at:updated});

test('summary and 24-hour queue count only supplied records, with no invented unknown dates',()=>{
  const rows=[ticket(1),ticket(2,'answered'),ticket(3,'closed'),ticket(4,'open','2026-11-17T12:00:00Z'),ticket(5,'open','invalid'),ticket(6,'open','2026-11-19T00:00:00Z')];
  assert.deepEqual(core.summarizeTickets(rows,now),{total:6,open:4,answered:1,closed:1,older:1});
  assert.equal(core.isOlderOpen(rows[3],now),false);
  assert.equal(core.selectTickets(rows,{olderOnly:true},now)[0].id,'1');
});

test('inbox searches email, combines filters and sorts copies by creation or actual update',()=>{
  const rows=[ticket(1,'open','2026-11-16T10:00:00Z','2026-11-18T11:00:00Z'),ticket(2,'answered','2026-11-17T10:00:00Z'),ticket(3,'open','2026-11-18T10:00:00Z'),ticket(4,'open','invalid')];
  assert.deepEqual(core.selectTickets(rows,{query:'FIXTURE2@EXAMPLE.TEST'}).map(row=>row.id),['2']);
  assert.deepEqual(core.selectTickets(rows,{sort:'oldest'}).map(row=>row.id),['1','2','3','4']);
  assert.deepEqual(core.selectTickets(rows,{sort:'updated'}).map(row=>row.id),['1','3','2','4']);
  assert.deepEqual(core.selectTickets(rows,{status:'open',olderOnly:true},now).map(row=>row.id),['1']);
  assert.deepEqual(rows.map(row=>row.id),['1','2','3','4']);
});

test('older pages merge unique IDs with fresh overlapping records and preserve honest cap metadata',()=>{
  const merged=core.mergeTicketPages([ticket(1),ticket(2)],[ticket(2,'answered'),ticket(3)]);
  assert.equal(merged.length,3);assert.equal(merged[1].status,'answered');
  assert.deepEqual(core.ticketPage({limit:200,offset:100000,hasMore:true,nextOffset:null}),{limit:200,offset:100000,hasMore:true,nextOffset:null});
  assert.equal(core.ticketPage({nextOffset:'200'}).nextOffset,null);
});

// Small DOM fixture for controller state transitions, not a rendering or accessibility test.
class Element {
  constructor(tag='div',attrs={}) {this.tagName=tag.toLowerCase();this.attrs={...attrs};this.id=attrs.id||'';this.dataset={};this.children=[];this.parentNode=null;this.listeners=new Map();this.value='';this.hidden=false;this.disabled=false;this.checked=false;this._text='';}
  set textContent(value){this._text=String(value);this.replaceChildren();}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  get lastElementChild(){return this.children.at(-1);}
  get isConnected(){return this.tagName==='document'||!!this.parentNode?.isConnected;}
  append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}}
  replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];this.append(...children);}
  setAttribute(name,value){this.attrs[name]=String(value);}
  getAttribute(name){return this.attrs[name]??null;}
  removeAttribute(name){delete this.attrs[name];}
  addEventListener(name,callback){const callbacks=this.listeners.get(name)||[];callbacks.push(callback);this.listeners.set(name,callbacks);}
  emit(name){for(const callback of this.listeners.get(name)||[])callback({target:this,currentTarget:this,preventDefault(){}});}
  focus(){}
  matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector==='*')return true;const attr=selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);if(attr)return attr[1] in this.attrs&&(!attr[2]||this.attrs[attr[1]]===attr[2]);return this.tagName===selector;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
}
function harness(fetchImplementation) {
  const document=new Element('document'),body=new Element('body');document.append(body);document.body=body;
  const html=readFileSync(new URL('../dist/admin/index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g))body.append(new Element(match[1],{id:match[2]}));
  document.getElementById=id=>document.querySelector('#'+id);
  document.createElement=tag=>new Element(tag);
  document.createTextNode=value=>{const node=new Element('#text');node.textContent=value;return node;};
  document.getElementById('status-filter').value='all';document.getElementById('sort-order').value='newest';
  const submit=new Element('button',{type:'submit'});document.getElementById('login-form').append(submit);
  const copy={};
  const context=vm.createContext({...core,document,console,Intl,URL,AbortController,setTimeout,clearTimeout,
    fetch:fetchImplementation,Nortivo:{register:value=>Object.assign(copy,value),getLanguage:()=> 'en',translate:key=>copy.en?.[key]||key,applyTranslations(){}}});
  context.window=context;
  let source=readFileSync(new URL('../dist/assets/admin.js',import.meta.url),'utf8').replace(/^import .*\r?\n/,'');
  source=source.slice(0,source.lastIndexOf('  (async () => {'))+`globalThis.adminTest={showLogin,showDashboard,loadTickets,loadOperations,applyTickets,renderDetail,renderList,acceptSession,
    activate:id=>{activeId=id;},addOperation:id=>operations.add(id),draft:id=>drafts.get(id),
    state:()=>({tickets,activeId,operations:[...operations],listPending:!!listRequest,operationsPending:!!operationsRequest,authVersion})};})();`;
  vm.runInContext(source,context,{filename:'admin.js'});
  return {actions:context.adminTest,document,el:id=>document.getElementById(id)};
}
const response=data=>({ok:true,status:200,json:async()=>data});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

test('expiry releases pending IDs and lets a new list request win over an old completion',async()=>{
  const requests=[];const h=harness(()=>{const request=deferred();requests.push(request);return request.promise;});
  h.actions.addOperation('1');const old=h.actions.loadTickets(false);
  h.actions.showLogin('sessionExpired',false);
  assert.equal(h.actions.state().operations.length,0);
  const current=h.actions.loadTickets(false);assert.equal(requests.length,2);
  requests[0].resolve(response({tickets:[ticket('old')]}));await old;
  assert.equal(h.actions.state().listPending,true);
  requests[1].resolve(response({tickets:[ticket('new')],page:{limit:200,offset:0,hasMore:false,nextOffset:null}}));await current;
  assert.equal(h.actions.state().tickets[0].id,'new');assert.equal(h.actions.state().listPending,false);
});

test('an old operations read cannot clear a new configuration request after reauthentication',async()=>{
  const requests=[];const h=harness(()=>{const request=deferred();requests.push(request);return request.promise;});
  const old=h.actions.loadOperations();h.actions.showLogin('sessionExpired',false);const current=h.actions.loadOperations();
  requests[0].resolve(response({operations:{productEnabled:false,services:[]}}));await old;
  assert.equal(h.actions.state().operationsPending,true);
  requests[1].resolve(response({operations:{productEnabled:true,purchasesOpen:null,services:[],checkedAt:'2026-11-18T12:00:00Z'}}));await current;
  assert.match(h.el('operations-status').textContent,/Enabled in configuration/);
  assert.match(h.el('operations-status').textContent,/Not checked/);
});

test('successful reply updates its ticket without shrinking the loaded older-page window',async()=>{
  const requests=[];const updated=ticket(205,'answered');
  const h=harness(async(path,options={})=>{requests.push({path,options});return response(options.method==='POST'?{ok:true}:{ticket:updated,replies:[{body:'Synthetic reply',created_at:'2026-11-18T12:00:00Z'}]});});
  h.actions.acceptSession({ok:true,csrfToken:'a'.repeat(43)});
  const rows=Array.from({length:205},(_,index)=>ticket(index+1));
  h.actions.applyTickets({tickets:rows.slice(0,200),page:{limit:200,offset:0,hasMore:true,nextOffset:200}});
  h.actions.applyTickets({tickets:rows.slice(200),page:{limit:200,offset:200,hasMore:false,nextOffset:null}},true);
  h.actions.showDashboard();h.actions.activate('205');h.actions.renderDetail(rows[204],[]);
  h.el('search').value='fixture205@example.test';h.actions.renderList();
  h.el('reply-text').value='Synthetic reply';h.el('reply-text').emit('input');h.el('reply-text').closest('form').emit('submit');await nextTurn();
  assert.equal(h.actions.state().tickets.length,205);
  assert.equal(h.actions.state().tickets.find(item=>item.id==='205').status,'answered');
  assert.match(h.el('match-count').textContent,/1 of 205/);
  assert.equal(requests.length,2);assert.match(requests[1].path,/\?id=205/);
  assert.equal(h.actions.draft('205'),undefined);
});

test('a stale submitted reply never clears the new session draft or pending action',async()=>{
  const requests=[];const h=harness(()=>{const request=deferred();requests.push(request);return request.promise;});
  h.actions.acceptSession({ok:true,csrfToken:'a'.repeat(43)});
  const record=ticket(1);h.actions.applyTickets({tickets:[record]});h.actions.showDashboard();h.actions.activate('1');h.actions.renderDetail(record,[]);
  h.el('reply-text').value='Old submitted reply';h.el('reply-text').emit('input');h.el('reply-text').closest('form').emit('submit');
  h.actions.showLogin('sessionExpired',false);h.actions.applyTickets({tickets:[record]});h.actions.showDashboard();h.actions.activate('1');h.actions.renderDetail(record,[]);
  h.el('reply-text').value='New session draft';h.el('reply-text').emit('input');h.actions.addOperation('1');
  requests[0].resolve(response({ok:true}));await nextTurn();
  assert.equal(h.actions.draft('1'),'New session draft');assert.equal(h.el('reply-text').value,'New session draft');
  assert.equal(h.actions.state().operations.includes('1'),true);assert.equal(requests.length,1);
});
