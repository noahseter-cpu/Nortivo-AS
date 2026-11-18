import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../dist/assets/security-core/enquiry.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
class Control {
  constructor(tag='div',text=''){this.tag=tag;this.textContent=text;this.children=[];this.value='';this.listeners={};this.attrs={};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,f){this.listeners[k]=f;}
  querySelector(k){return this[k]||=(new Control());}
  scrollIntoView(){}
  async requestSubmit(){await this.listeners.submit({preventDefault(){}});}
}
test('a confirmed KORVNT receipt keeps its tracking proof outside DOM values until explicit reveal; tracking uses the private acknowledgment',async()=>{
  const token=randomBytes(32).toString('base64url'),ref='KR-0123456789ABCDEF';
  const nodes=Object.fromEntries(['ks-intake','ks-track','ks-feedback','ks-receipt','ks-tracked','ks-end-session','track','support','chat'].map(k=>[k,new Control()]));
  const form=nodes['ks-intake'],tracker=nodes['ks-track'],receipt=nodes['ks-receipt'];
  form.elements={kind:new Control(),email:new Control(),summary:new Control()};tracker.elements={ref:new Control(),proof:new Control()};
  const doc={querySelector:q=>q==='[data-korvnt-chat]'?nodes.chat:nodes[q.slice(1)],getElementById:id=>nodes[id],addEventListener(){},documentElement:{dataset:{workflowBusiness:'korvnt'}}};
  const calls=[];const ctx={document:doc,saved:{get:()=>({receipt:{proof:token,ref}}),set(){}},l:en=>en,mountChat(){},when:()=>'',stateLabel:x=>x,errorText:()=>'',el:(t,s)=>new Control(t,s),button:(s,f)=>Object.assign(new Control('button',s),{click:f}),api:async(a,b)=>{calls.push(b);return {ref,state:'received',followups:[]};}};
  vm.runInNewContext(source,ctx);
  const field=receipt.children.find(it=>it.tag==='label').children[0];
  const toggle=receipt.children.find(it=>it.textContent==='Show private key');
  assert.equal(field.type,'password');assert.equal(field.value,'');
  toggle.click();assert.equal(field.type,'text');assert.equal(field.value,token);
  toggle.click();assert.equal(field.type,'password');assert.equal(field.value,'');
  receipt.children.find(it=>it.textContent==='Check status').click();
  assert.equal(tracker.elements.proof.value,'');
  assert.equal(calls.length,1);assert.ok(calls[0].proof===token);
});
