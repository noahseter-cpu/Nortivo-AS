import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const source=(await readFile(new URL('../dist/assets/workflow-chat.js',import.meta.url),'utf8'))
  .replace(/^import [^\n]+\n/,'').replace('export function mountChat','function mountChat');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function delayed(){
  let resolve,reject;
  const promise=new Promise((done,failed)=>{resolve=done;reject=failed;});
  return {promise,resolve,reject};
}
class Events {
  constructor(){this.listeners=new Map();}
  addEventListener(type,cb){this.listeners.set(type,[...(this.listeners.get(type)||[]),cb]);}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);}
}
class Element extends Events {
  constructor(tag,text='',css=''){
    super();this.tag=tag;this.text=text||'';this.css=css;this.children=[];this.attributes={};this.dataset={};
    this.value='';this.hidden=false;this.open=false;this.scrollTop=0;this.scrollHeight=0;this.clientHeight=0;this.writes=0;
  }
  set textContent(value){this.text=value;this.children=[];this.writes++;}
  get textContent(){return this.text;}
  get options(){return this.children;}
  append(...items){for(const item of items){if(item instanceof Element){item.remove();item.parent=this;}this.children.push(item);}}
  prepend(...items){this.children.unshift(...items);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(key,value){this.attributes[key]=value;}
  focus(){this.focused=true;}
  closest(){return null;}
  getBoundingClientRect(){return {bottom:700,top:10};}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent({type:'close'});}
}
function records(id,n){
  return Array.from({length:n},(_,i)=>({seq:i+1,time:i+10,role:'customer',text:id+' '+(i+1)}));
}
function fixture({ids=['a','b'],stored={},hidden=false,connected=true}={}){
  const win=new Events(),doc=new Events(),home=new Element('main'),nodes=[],sent=[],reads=[],events=[],intervals=[];
  home.closest=selector=>selector==='[hidden]'&&hidden?home:null;
  doc.body=new Element('body');doc.hidden=false;
  const storage=new Map(Object.entries(stored));
  const historyById=new Map([['a',records('A',70)],['b',records('B',54)]]);
  let firstRead=null,sendDelay=null,failSend=false,observed,onIdentity,connects=0;
  const closedIds=new Set();
  const identity={scope:'customer',threads:[...ids],availability:'asynchronous'};
  function element(tag,text,css){const node=new Element(tag,text,css);nodes.push(node);return node;}
  const context={
    home,document:doc,window:win,innerHeight:800,crypto:webcrypto,performance,setTimeout,clearTimeout,
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},
    IntersectionObserver:class{constructor(cb){observed=()=>cb([{isIntersecting:true}]);}observe(){}},
    setInterval:fn=>intervals.push(fn),session:connected?identity:null,
    el:element,l:en=>en,stateLabel:value=>value,messageNode:message=>element('li',message.text),errorText:()=> 'Could not confirm.',
    button:(label,fn,css)=>{const node=element('button',label,css);node.click=fn;return node;},
    formField:(label,node)=>{const field=element('label',label);field.append(node);return field;},
    onIdentityChange:fn=>{onIdentity=fn;},
    saved:{get:key=>structuredClone(storage.get(key)),set:(key,value)=>storage.set(key,structuredClone(value))},
    connect:async()=>{connects++;if(!context.session){context.session=identity;onIdentity(identity);}return context.session;},
    api:async(_name,body)=>{
      if(body.op==='send'){
        sent.push(structuredClone(body));
        const delayedSend=sendDelay;sendDelay=null;
        if(delayedSend)return delayedSend.promise;
        if(closedIds.has(body.id))throw Object.assign(new Error('This conversation is closed.'),{code:'THREAD_CLOSED'});
        if(failSend){failSend=false;throw Error('offline');}
        return {threadId:body.id||'a'};
      }
      assert.equal(body.op,'read');
      reads.push(structuredClone(body));const chained=firstRead;firstRead=null;
      if(chained)return chained.promise;
      const id=body.id||ids.at(-1);
      if(!id)return {thread:null};
      return response(id,body.before);
    }
  };
  function response(id,before){
    const messages=historyById.get(id)||[],end=before?before-1:messages.length;
    return {thread:{id,count:messages.length,state:closedIds.has(id)?'closed':'open',requests:id==='a'?['NR-1111111111111111']:[],messages:messages.slice(Math.max(0,end-40),end)}};
  }
  doc.addEventListener('nortivo:workflow-chat-context',event=>events.push(structuredClone(event.detail)));
  vm.runInNewContext(source,context);context.mountChat(home);
  const find=fn=>nodes.find(fn);
  const input=find(n=>n.tag==='textarea'),picker=find(n=>n.tag==='select'),history=find(n=>n.css==='nwf-history'),status=find(n=>n.css==='nwf-status'),form=find(n=>n.tag==='form');
  const switchTo=async id=>{picker.value=id;picker.onchange();await tick();};
  const type=text=>{input.value=text;input.dispatchEvent({type:'input'});};
  return {doc,win,input,picker,history,status,events,sent,reads,intervals,storage,response,historyById,
    open:async()=>{observed();await tick();},poll:async()=>{intervals[0]();await tick();},find,
    switchTo,type,send:()=>form.onsubmit({preventDefault(){}}),
    earlier:()=>find(n=>n.text==='Earlier messages').click(),retry:()=>find(n=>n.text==='Retry same message').click(),
    holdRead:()=>firstRead=delayed(),holdSend:()=>sendDelay=delayed(),fail:()=>{failSend=true;},closedIds,
    changeIdentity(next){context.session=next;onIdentity(next);},connects:()=>connects
  };
}

test('switching clears old history and cursor, rejects delayed reads, preserves the picker and keeps quiet polls quiet',async()=>{
  const h=fixture({stored:{'customer.chat':{selected:'a',draft:'',pending:null}}});
  await h.open();await h.earlier();
  assert.equal(h.history.children.length,70);
  assert.equal(h.picker.options[0].textContent,'NR-1111111111111111');
  const delayedA=h.holdRead();const oldRead=h.find(n=>n.text==='Refresh').click();await tick();
  await h.switchTo('b');assert.equal(h.history.children.length,40);
  assert.ok(h.history.children.every(item=>item.text.startsWith('B ')));
  delayedA.resolve(h.response('a'));await oldRead;
  assert.ok(h.history.children.every(item=>item.text.startsWith('B ')));
  await h.earlier();assert.equal(h.reads.at(-1).before,15);assert.equal(h.history.children.length,54);
  const option=h.picker.options[0],first=h.history.children[0],priorWrites=h.status.writes;
  h.picker.focus();await h.poll();await h.poll();
  assert.equal(h.picker.options[0],option);assert.equal(h.history.children[0],first);
  assert.equal(h.status.writes,priorWrites);
  const current=h.historyById.get('b');current.push({seq:55,text:'new operator reply',role:'operator'});
  await h.poll();assert.equal(h.status.text,'New support reply received.');
  const writes=h.status.writes;await h.poll();assert.equal(h.status.writes,writes);
  assert.equal(h.events.at(-1).threadId,'b');
});

test('per-thread drafts, original failed-send IDs and in-flight acknowledgements survive selection changes',async()=>{
  const h=fixture({stored:{'customer.chat':{selected:'a',draft:'legacy typed question',pending:null}}});
  await h.open();assert.equal(h.input.value,'legacy typed question');
  h.fail();await h.send();const original=h.sent[0];assert.equal(original.id,'a');assert.ok(original.requestId);
  await h.switchTo('b');assert.equal(h.input.value,'');h.type('unfinished B');
  await h.switchTo('a');assert.equal(h.input.value,'legacy typed question');
  const held=h.holdSend(),retry=h.retry();await tick();assert.deepEqual(h.sent[1],original);
  await h.switchTo('b');assert.equal(h.input.value,'unfinished B');
  held.resolve({threadId:'a'});await retry;assert.equal(h.picker.value,'b');assert.equal(h.input.value,'unfinished B');
  assert.ok(h.history.children.every(item=>item.text.startsWith('B ')));
  const persisted=h.storage.get('customer.chat');
  assert.equal(persisted.composers.b.draft,'unfinished B');assert.equal(persisted.composers.a,undefined);
  const restored=fixture({stored:{'customer.chat':persisted}});await restored.open();assert.equal(restored.input.value,'unfinished B');
});

test('id-less legacy retry is never displayed in or rewritten to the newest unrelated conversation',async()=>{
  const pending={op:'send',requestId:'fixture-id-unchanged',text:'lost first acknowledgement'};
  const h=fixture({stored:{'customer.chat':{selected:null,draft:pending.text,pending}}});
  await h.open();assert.equal(h.input.value,pending.text);assert.equal(h.reads.length,0);
  await h.switchTo('b');assert.equal(h.input.value,'');
  await h.switchTo('');assert.equal(h.input.value,pending.text);await h.retry();
  assert.deepEqual(h.sent[0],pending);assert.equal(h.picker.value,'a');assert.equal(h.input.value,'');
});

test('a read started before the first send cannot assign the uncertain composer to a different case',async()=>{
  const h=fixture({ids:[]});
  const oldRead=h.holdRead();await h.open();
  const confirmation=h.holdSend();h.type('My first question');
  const delivery=h.send();await tick();
  oldRead.resolve(h.response('b'));await tick();
  assert.equal(h.events.at(-1).threadId,null);
  assert.equal(h.storage.get('customer.chat').composers[''].pending.text,'My first question');
  confirmation.resolve({threadId:'a'});await delivery;
  assert.equal(h.events.at(-1).threadId,'a');
  assert.equal(h.storage.get('customer.chat').selected,'a');
});

test('a definitive closed-case rejection preserves copyable text and clears the failed retry command',async()=>{
  const h=fixture({stored:{'customer.chat':{selected:'a',draft:'',pending:null}}});
  await h.open();h.type('Unsent case-specific note');h.closedIds.add('a');await h.send();
  assert.equal(h.input.value,'Unsent case-specific note');assert.equal(h.input.readOnly,true);assert.equal(h.input.disabled,false);
  assert.equal(h.storage.get('customer.chat').composers.a.pending,null);
  assert.equal(h.find(n=>n.text==='Start a new conversation').hidden,false);
  assert.equal(h.status.text,'closed');
});

test('a late response from a prior actor cannot repopulate history, draft or case context',async()=>{
  const h=fixture({stored:{'customer.chat':{selected:'a',draft:'private A',pending:null}}});
  await h.open();
  const held=h.holdRead(),read=h.find(n=>n.text==='Refresh').click();await tick();
  h.changeIdentity({scope:'other',threads:[],availability:'asynchronous'});
  held.resolve(h.response('a'));await read;
  assert.equal(h.history.children.length,0);assert.equal(h.input.value,'');assert.equal(h.events.at(-1).threadId,null);
});

test('hidden homepage chat stays dormant through visibility, reconnect and resume; launch creates the first session',async()=>{
  const h=fixture({hidden:true,connected:false});await h.open();await h.poll();
  h.win.dispatchEvent({type:'online'});h.win.dispatchEvent({type:'pageshow',persisted:true});
  h.doc.dispatchEvent({type:'visibilitychange'});await tick();
  assert.equal(h.connects(),0);assert.equal(h.reads.length,0);
  const trigger={dataset:{},closest:()=>trigger,focus(){}};
  h.doc.dispatchEvent({type:'click',target:trigger,preventDefault(){}});await tick();
  assert.equal(h.connects(),1);assert.equal(h.reads.length,1);
});
