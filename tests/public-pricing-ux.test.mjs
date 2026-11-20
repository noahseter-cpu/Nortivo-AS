import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../dist/assets/product-core.js';

const source=(await readFile(new URL('../dist/assets/product-client.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace('export async function startProduct','async function startProduct');

function fixture({kind='signed-out',locale='en',ready=false,registration=true,prices}={}){
  const writes=[],destinations=[],nodes=new Map();
  const form={elements:{tier:{value:'pro',options:[{value:'portfolio'},{value:'pro'}]},interval:{value:'year'}},querySelector:()=>({}),addEventListener(){}};
  nodes.set('#billing-plan-form',form);nodes.set('#billing-readiness-note',{});nodes.set('#billing-plan-disclosure',{});
  const context=vm.createContext({...core,esc:core.escapeHtml,MarketChart:class{},URL,URLSearchParams,Intl,Set,Map,Date,setTimeout,clearTimeout,
    location:{pathname:`/${locale}/pricing/`,origin:'https://invest.nortivo.no',search:'',assign:value=>destinations.push(value)},
    history:{replaceState(){}},sessionStorage:{getItem:()=>null,setItem:(key,value)=>writes.push({key,value})},
    document:{querySelector:selector=>nodes.get(selector)||null,documentElement:{}}});
  vm.runInContext(source,context);
  context.fixtureSnapshot={
    user:kind==='signed-out'?{kind:'guest'}:{kind:'user',emailVerified:true,id:'synthetic-customer'},
    entitlements:{tier:kind==='owner'||kind==='active'?'pro':'free',reason:kind==='owner'?'owner':'paid',billingExempt:kind==='owner',features:[]},
    billing:{status:kind==='expired'?'expired':kind==='active'?'active':'none'},
    capabilities:{signupEnabled:registration},ai:{},readiness:{}};
  context.fixtureCatalog={ready,capabilities:{signupEnabled:registration},availability:{portfolio:{ready},pro:{ready}},plans:prices||[
    {tier:'portfolio',prices:{month:{amount:1000},year:{amount:9600}}},
    {tier:'pro',prices:{month:{amount:3000},year:{amount:28800}}}]};
  vm.runInContext(`snapshot=fixtureSnapshot;catalog=fixtureCatalog;intent={tier:'pro',interval:'year',locale,returnPath:'/'+locale+'/terminal/'};
    root={classList:{add(){},remove(){}},querySelector:()=>null};dialog={open:false};
    shell=html=>{globalThis.markup=html;};footer=()=>'';destroyChart=()=>{};bindForm=()=>{};`,context);
  return {run:code=>vm.runInContext(code,context),context,writes,destinations,nodes};
}

test('public plan actions reflect signed-out, subscribed, expired, owner and closed-sale states',()=>{
  for(const [kind,label,action] of [['signed-out','Create free account','choose-plan'],['active','View subscription','pricing-billing'],['expired','View billing','pricing-billing'],['owner','Open workspace','workspace']]){
    const h=fixture({kind});h.run('renderPricing()');
    assert.match(h.context.markup,new RegExp(label));
    assert.match(h.context.markup,new RegExp(`data-product="${action}"`));
    if(kind!=='signed-out')assert.doesNotMatch(h.context.markup,/data-product="choose-plan"/);
    if(kind!=='owner')assert.match(h.context.markup,/Subscriptions are not open yet/);
  }
  const h=fixture({registration:false});h.run('renderPricing()');assert.match(h.context.markup,/Sign in to existing account/);
});

test('opening existing billing preserves selection, interval, locale and workspace without writing intent',()=>{
  const h=fixture({kind:'expired',locale:'nb'});h.run('renderPricing();openPricingBilling()');
  assert.equal(h.writes.length,0);
  assert.equal(h.destinations.length,1);
  const url=new URL(h.destinations[0],'https://invest.nortivo.no');
  assert.equal(url.pathname,'/nb/portfolio/');
  for(const [key,value]of Object.entries({tier:'pro',interval:'year',locale:'nb',tab:'billing',workspace:'terminal',returnPath:'/nb/terminal/'}))assert.equal(url.searchParams.get(key),value);
  h.run("surface='workspace';openPricingBilling()");assert.equal(h.destinations.length,1);
});

test('public annual totals, equivalents and savings follow changed server prices',()=>{
  const h=fixture({kind:'active',prices:[{tier:'portfolio',prices:{month:{amount:2000},year:{amount:18000}}},{tier:'pro',prices:{month:{amount:5000},year:{amount:42000}}}]});
  h.run('renderPricing()');
  assert.match(h.context.markup,/\$180/);assert.match(h.context.markup,/USD 15\/month/);assert.match(h.context.markup,/Save USD 60 per year \(25%\)/);
  assert.match(h.context.markup,/\$420/);assert.match(h.context.markup,/USD 35\/month/);assert.match(h.context.markup,/Save USD 180 per year \(30%\)/);
  assert.doesNotMatch(h.context.markup,/20%|USD 24\/month|USD 8\/month/);
});

test('public pricing distinguishes an unknown catalog from closed purchases and per-tier readiness',()=>{
  const h=fixture();
  h.run('catalog={capabilities:{signupEnabled:true}};renderPricing()');
  assert.match(h.context.markup,/Purchase availability is unconfirmed/);
  assert.doesNotMatch(h.context.markup,/Subscriptions are not open yet/);
  h.run("catalog={availability:{portfolio:{ready:true},pro:{ready:false}},capabilities:{signupEnabled:true}};renderPricing()");
  assert.equal(h.run("publicPurchaseState('portfolio')"),'open');
  assert.equal(h.run("publicPurchaseState('pro')"),'closed');
  assert.match(h.context.markup,/Purchases available for this plan/);
  assert.match(h.context.markup,/Purchases are not open for this plan/);
  assert.doesNotMatch(h.context.markup,/Subscriptions are not open yet/);
});

test('dedicated billing follows catalog while the terminal account disclosure stays unchanged',async()=>{
  const prices=[{tier:'portfolio',prices:{month:{amount:2000},year:{amount:18000}}},{tier:'pro',prices:{month:{amount:5000},year:{amount:42000}}}];
  const h=fixture({kind:'active',prices});
  h.context.location.pathname='/en/portfolio/';await h.run("accountPage('billing')");
  assert.match(h.nodes.get('#billing-plan-disclosure').textContent,/USD 35\/month equivalent/);
  h.context.location.pathname='/en/terminal/';await h.run("accountPage('billing')");
  assert.match(h.nodes.get('#billing-plan-disclosure').textContent,/USD 24\/month equivalent/);
});
