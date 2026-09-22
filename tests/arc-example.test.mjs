import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code=readFileSync(new URL('../dist/assets/arc-example.js',import.meta.url),'utf8');
function fixture(){
  const elements=new Map();
  const root={querySelector(selector){
    if(!elements.has(selector)) elements.set(selector,{hidden:true,dataset:{},attrs:{},listeners:{},textContent:'',focus(){this.focused=true;},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.listeners[k]=v;}});
    return elements.get(selector);
  }};
  vm.runInNewContext(code,{Intl,document:{querySelectorAll:()=>[root]},window:{Nortivo:{translate:k=>k}}});
  return selector=>root.querySelector(`[data-example-${selector}]`);
}
test('website example records exactly one illustrative expense and resets without accumulation',()=>{
  const el=fixture();
  assert.equal(el('add').hidden,false);
  const amount=name=>Number(el(name).textContent.replace(/[^0-9]/g,''));
  assert.equal(amount('spent'),1800);
  assert.equal(amount('remaining'),3200);
  el('add').listeners.click();
  el('add').listeners.click();
  assert.equal(amount('spent'),2050);
  assert.equal(amount('remaining'),2950);
  assert.equal(el('feedback').dataset.i18n,'demo.arc.after');
  assert.equal(el('add').attrs['aria-disabled'],'true');
  el('reset').listeners.click();
  assert.equal(amount('remaining'),3200);
  assert.equal(el('reset').hidden,true);
  assert.equal(el('add').focused,true);
});
test('illustration has no network, storage, date, random or personal-data dependency',()=>{
  assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|indexedDB|localStorage|sessionStorage|Math\.random|new Date/);
});
