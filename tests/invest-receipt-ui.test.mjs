import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const intakeSource=(await readFile(new URL('../dist/assets/workflow-intake.js',import.meta.url),'utf8'))
  .replace(/^import [^\n]+\n/, '').replace(/^export function /gm,'function ');

class Element {
  constructor(tag,text=''){
    this.tag=tag;this.textContent=text;this.value='';this.children=[];this.attributes={};this.dataset={};
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this.attributes[name]=value;}
  closest(){return null;}
  find(predicate){
    if(predicate(this))return this;
    for(const child of this.children){const match=child.find(predicate);if(match)return match;}
  }
}

test('Invest receipts hide the private key until reveal and track the matching saved reference without filling a control', async()=>{
  const home=new Element('div'),calls=[];
  const proof=randomBytes(32).toString('base64url'),ref='NT-0123456789ABCDEF';
  const context={
    l:en=>en,el:(tag,text)=>new Element(tag,text),
    button:(text,click)=>Object.assign(new Element('button',text),{click}),
    formField:(text,control)=>{const label=new Element('label',text);label.append(control);return label;},
    document:{addEventListener(){}},crypto:webcrypto,session:{scope:'test'},
    saved:{get:()=>({receipt:{ref,proof,state:'received',createdAt:'2026-01-01T00:00:00Z'}})},
    connect:async()=>{},onIdentityChange:listener=>listener(),stateLabel:x=>x,when:()=>'',errorText:()=> 'Read failed',
    api:async(_action,body)=>{calls.push(body);return {state:'received',followups:[]};}
  };
  vm.runInNewContext(intakeSource,context);
  context.mountIntake(home,null);

  const key=home.find(node=>node.tag==='input');
  const toggle=home.find(node=>node.textContent==='Show private key');
  assert.equal(key.type,'password');assert.equal(key.value,'');assert.ok(key.placeholder.length);
  assert.equal(toggle.attributes['aria-controls'],key.id);
  toggle.click();assert.equal(key.type,'text');assert.ok(key.value===proof);assert.equal(toggle.attributes['aria-expanded'],'true');
  toggle.click();assert.equal(key.type,'password');assert.equal(key.value,'');assert.equal(toggle.attributes['aria-expanded'],'false');

  home.find(node=>node.textContent==='Track this request').click();
  const tracker=home.find(node=>node.tag==='form');
  const input=tracker.find(node=>node.name==='trackingProof'),reference=tracker.find(node=>node.name==='reference');
  assert.equal(input.value,'');assert.equal(reference.value,ref);
  const submit=()=>tracker.onsubmit({preventDefault(){}});
  await submit();assert.equal(calls[0].ref,ref);assert.ok(calls[0].proof===proof);assert.equal(input.value,'');
  reference.value='NT-ABCDEF0123456789';
  await submit();assert.equal(calls[1].ref,reference.value);assert.ok(!Object.hasOwn(calls[1],'proof'));
  input.value=randomBytes(32).toString('base64url');
  await submit();assert.equal(calls[2].ref,reference.value);assert.ok(calls[2].proof===input.value);
});
