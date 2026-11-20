import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const readAsset=name=>readFile(new URL('../dist/assets/'+name,import.meta.url),'utf8');
const client=(await readAsset('workflow-client.js')).replace(/^export /gm,'');
const intake=(await readAsset('workflow-intake.js')).replace(/^import [^\n]+\n/,'').replace(/^export /gm,'');
const labelled=(root,label)=>root.find(n=>n.textContent===label || n.attrs['aria-label']===label);
const field=(root,name)=>root.find(n=>n.name===name);
const settle=()=>new Promise(resolve=>setImmediate(resolve));

class Node extends EventTarget {
  constructor(tag,text='',classes=''){
    super();this.tag=tag;this.textContent=text;this.className=classes;this.dataset={};this.attrs={};this.children=[];this.value='';
    this.classList={add:s=>{this.className+=' '+s;}};
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(key,value){this.attrs[key]=String(value);}
  find(match){
    if(match(this))return this;
    for(const node of this.children){const found=node.find(match);if(found)return found;}
  }
  closest(selector){return selector==='.iv-spec'?this:null;}
  querySelector(selector){
    if(selector.startsWith('.'))return this.find(n=>n.className.split(' ').includes(selector.slice(1)));
    if(selector==='input[name=kind]:checked')return this.find(n=>n.name==='kind'&&n.checked);
    return this.find(n=>n.tag===selector);
  }
  focus(){this.focused=true;}
  click(){this.dispatchEvent(new Event('click',{cancelable:true}));}
  checkValidity(){return this.valid!==false;}
  reportValidity(){return this.checkValidity();}
}

const makeTab=initial=>{
  const values=new Map();
  if(initial)values.set('guest.intake',JSON.stringify(initial));
  return {enabled:true,get:key=>JSON.parse(values.get(key)||'null'),set(key,value){values.set(key,JSON.stringify(value));return this.enabled;}};
};
function mount({tab=makeTab(),kind='',lang='en',hash='',api=async()=>({threadId:'new',ref:'example',state:'received',createdAt:0})}={}){
  const home=new Node('div'),summary=new Node('div'),document=new EventTarget(),listeners=[];
  home.dataset.service=kind;document.documentElement={lang};
  const page=new URL('https://invest.example/'+lang+'/'+(kind?'systems/'+kind+'/':'request/')+hash);
  const links=['en','nb'].map(locale=>({href:'https://invest.example/'+locale+'/request/',hreflang:locale,matches:()=>true}));
  document.querySelectorAll=()=>links;
  const hooks={l:(en,nb)=>lang==='nb'?nb:en,el:(tag,text,css)=>new Node(tag,text,css),
    formField:(label,control)=>{const outer=new Node('label',label);outer.append(control);return outer;},
    button:(text,click,css)=>{const node=new Node('button',text,css);node.addEventListener('click',click);return node;},
    document,location:page,history:{replaceState(_state,_unused,url){page.href=url.href;}},URL,Event,CustomEvent,
    crypto:webcrypto,session:{scope:'guest'},saved:tab,connect:async()=>{},onIdentityChange:f=>{listeners.push(f);f();},
    stateLabel:s=>s,when:()=>'',errorText:()=> 'Retry',api};
  vm.runInNewContext(intake,hooks);
  hooks.mountIntake(home,summary);
  return {home,summary,document,page,links,hooks};
}

test('separate service entry offers an explicit choice and preserves previous answers across locale and reload',()=>{
  const tab=makeTab({data:{kind:'bot',goal:'Previous bot goal',market:'Existing exchange'},step:1,furthest:1});
  const {home,summary}=mount({tab,kind:'engine',lang:'nb'});
  assert.ok(labelled(home,'Hvilket utkast vil du åpne?'));assert.equal(summary.hidden,true);
  assert.equal(labelled(home,'Fortsett med Kryptobot').href,'/nb/systems/bot/');
  labelled(home,'Start et eget utkast for Egen handelsmotor').click();
  assert.equal(field(home,'goal').value,'');
  const goal=field(home,'goal');goal.value='New engine goal';goal.dispatchEvent(new Event('input'));
  const reloaded=mount({tab,kind:'engine',lang:'en'});
  assert.equal(field(reloaded.home,'goal').value,'New engine goal');
  const previous=labelled(reloaded.home,'Switch to Crypto trading bot');previous.click();
  assert.equal(previous.href,'/en/systems/bot/');
  const reopened=mount({tab,kind:'bot'});assert.equal(field(reopened.home,'market').value,'Existing exchange');
  const engine=reopened.home.find(n=>n.name==='kind' && n.value==='engine');engine.dispatchEvent(new Event('change'));
  assert.equal(field(reopened.home,'goal').value,'New engine goal');
  assert.equal(reopened.page.pathname,'/en/systems/engine/');assert.match(reopened.links[1].href,/\/nb\/systems\/engine\/$/);
});

test('legacy receipt uses its system type after blanked submission data; #track and language links contain view only',()=>{
  const tab=makeTab({data:{kind:''},receipt:{kind:'bot',state:'received',ref:'N-example',proof:'private-fixture',createdAt:0}});
  const view=mount({tab,kind:'bot'});
  assert.ok(labelled(view.home,'Project request received'));
  labelled(view.home,'Track this request').click();
  assert.equal(field(view.home,'trackingProof').value,'');assert.equal(view.page.hash,'#track');
  assert.equal(view.links[1].href,'https://invest.example/nb/systems/bot/#track');
  labelled(view.home,'Back to project request').click();assert.equal(view.page.hash,'');
  assert.equal(view.links[1].href,'https://invest.example/nb/systems/bot/');
  assert.ok(field(mount({tab,kind:'bot',hash:'#track'}).home,'trackingProof'));
});

function readyReview(options={}){
  const tab=makeTab({data:{kind:'engine',goal:'A testable system'},step:3,furthest:3});
  return mount({tab,...options});
}
const context=(doc,id,label)=>doc.dispatchEvent(new CustomEvent('nortivo:workflow-chat-context',{detail:{threadId:id,open:true,label}}));
const submit=home=>home.querySelector('.nwf-stage').onsubmit({preventDefault(){}});
test('review links only with specific consent for the current conversation',async()=>{
  for(const mode of ['separate','link','changed']){
    const calls=[];
    const {home,document}=readyReview({api:async(_action,body)=>{calls.push(body);return {ref:'example',threadId:'result',state:'received',createdAt:0};}});
    const optIn=field(home,'linkConversation');assert.equal(optIn.disabled,true);
    context(document,'thread-one','Conversation 1');assert.equal(optIn.checked,false);
    assert.ok(home.find(n=>n.textContent?.startsWith('Conversation 1.')));
    if(mode!=='separate'){optIn.checked=true;optIn.dispatchEvent(new Event('change'));}
    if(mode==='changed'){context(document,'thread-two','Conversation 2');assert.equal(optIn.checked,false);}
    submit(home);await settle();assert.equal(calls.length,1);
    if(mode==='link')assert.equal(calls[0].linkThreadId,'thread-one');
    else assert.equal(Object.hasOwn(calls[0],'linkThreadId'),false);
  }
});

test('review edit buttons name each stage; invalid changes cannot be skipped through the step navigation',()=>{
  const {home}=readyReview();
  for(const text of ['Edit goal','Edit requirements','Edit project details'])assert.ok(labelled(home,text));
  labelled(home,'Edit requirements').click();assert.ok(labelled(home,'Step 2 of 4'));
  const form=home.querySelector('.nwf-stage');form.valid=false;
  labelled(home,'Review').click();assert.ok(labelled(home,'Step 2 of 4'));
  labelled(home,'Goal').click();assert.ok(labelled(home,'Step 1 of 4'));assert.equal(labelled(home,'Review').disabled,true);
});

test('confirmed thread capacity rejection restores answers; transport failure retains the exact retry command',async()=>{
  const calls=[];
  const {home}=readyReview({api:async(_action,body)=>{
    calls.push(body);
    if(calls.length===1)throw Object.assign(Error(),{status:409,code:'THREAD_LIMIT'});
    if(calls.length===2)throw Error('connection lost');
    return {ref:'example',state:'received',createdAt:0,threadId:'new'};
  }});
  submit(home);await settle();assert.ok(labelled(home,'Edit goal'));
  assert.ok(home.find(n=>n.textContent?.startsWith('The conversation limit was reached.')));
  submit(home);await settle();labelled(home,'Retry same submission').click();await settle();
  assert.notEqual(calls[0].requestId,calls[1].requestId);assert.deepEqual(calls[1],calls[2]);
  assert.equal(calls[2].brief.goal,'A testable system');assert.ok(labelled(home,'Project request received'));
});

test('tab storage failures preserve the latest in-page value and removal over stale browser data',()=>{
  let blocked=false;const contents=new Map();
  const env={document:{documentElement:{lang:'en',dataset:{}}},sessionStorage:{
    setItem(k,v){if(blocked)throw Error();contents.set(k,v);},getItem:k=>contents.get(k)||null,
    removeItem(k){if(blocked)throw Error();contents.delete(k);}
  }};
  const saved=vm.runInNewContext(client+'\nsaved',env);
  assert.equal(saved.set('draft',{goal:'older'}),true);blocked=true;
  assert.equal(saved.set('draft',{goal:'current'}),false);assert.equal(saved.get('draft').goal,'current');
  assert.equal(saved.set('draft',null),false);assert.equal(saved.get('draft'),null);
  blocked=false;assert.equal(saved.set('draft',{goal:'restored'}),true);assert.equal(saved.get('draft').goal,'restored');
  const tab=makeTab();tab.enabled=false;
  const {home}=mount({tab});assert.ok(home.find(n=>n.textContent?.startsWith('Tab storage is unavailable.')));
});

test('a late authorization failure from an earlier actor leaves the current actor connected',async()=>{
  let waitForResponse;
  const env={document:{documentElement:{lang:'en',dataset:{}}},AbortSignal,performance,
    fetch:()=>new Promise(resolve=>{waitForResponse=resolve;})};
  const tools=vm.runInNewContext(client+'\n({request,read:()=>session,change:value=>{session=value;},onIdentityChange})',env);
  const identity=scope=>({scope,csrfToken:'synthetic-'+scope});
  let invalidations=0;tools.onIdentityChange(()=>invalidations++);
  tools.change(identity('A'));const oldCall=tools.request('chat',{op:'history'});
  tools.change(identity('B'));
  const reject=()=>waitForResponse({ok:false,status:401,json:async()=>({code:'FORBIDDEN'})});
  reject();await assert.rejects(oldCall);assert.equal(tools.read().scope,'B');assert.equal(invalidations,0);
  const currentCall=tools.request('chat',{op:'history'});reject();await assert.rejects(currentCall);
  assert.equal(tools.read(),null);assert.equal(invalidations,1);
});
