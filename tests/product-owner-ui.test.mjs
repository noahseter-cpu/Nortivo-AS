import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as core from '../dist/assets/product-core.js';

const source = (await readFile(new URL('../dist/assets/product-client.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export async function startProduct', 'async function startProduct');

function harness({ owner = true, locale = 'en', billing = { status: 'none' }, usage = {}, ready = true } = {}) {
  const form = {
    elements: { tier: { value: 'pro', options: [{ value: 'portfolio' }, { value: 'pro' }] }, interval: { value: 'month' } },
    querySelector: () => ({}), addEventListener() {},
  };
  const nodes = new Map([['#billing-plan-form', form], ['#billing-readiness-note', {}], ['#billing-plan-disclosure', {}]]);
  const context = vm.createContext({ ...core, esc: core.escapeHtml, MarketChart: class {}, URL, URLSearchParams, Intl, Set, Map, Date,
    console, crypto: webcrypto,
    location: { pathname: `/${locale}/portfolio/`, search: '', origin: 'https://invest.nortivo.no', assign: () => {} },
    history: { replaceState() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    document: { querySelector: selector => nodes.get(selector) || null, documentElement: {} },
    setTimeout, clearTimeout,
  });
  vm.runInContext(source, context);
  vm.runInContext(`root={classList:{remove(){},add(){}},querySelector:()=>null};dialog={open:false};
    shell=html=>{globalThis.markup=html;};destroyChart=()=>{};footer=()=>'';
    bindForm=selector=>{globalThis.boundForms=(globalThis.boundForms||[]).concat(selector);};`, context);
  const snapshot = {
    user: { id: 'owner-ui-fixture', kind: 'user', email: 'fixture@example.test', name: 'Fixture', emailVerified: true },
    entitlements: { tier: 'pro', features: ['portfolio.write', 'market.read', 'ai.basic', 'ai.advanced'],
      ...(owner ? { reason: 'owner', billingExempt: true, unlimited: true } : { reason: 'paid' }) },
    billing,
    ai: { remainingRequests: null, requestLimit: null, remainingTokens: null, tokenLimit: null, resetAt: null, unlimited: owner, ...usage },
    readiness: { ai: { configured: ready, permissionsReady: ready, reachable: ready, freshness: ready ? 'current' : 'unavailable' } },
    capabilities: { admin: owner },
  };
  context.fixtureSnapshot = snapshot;
  vm.runInContext('snapshot=fixtureSnapshot;catalog={ready:false,capabilities:{signupEnabled:true}};', context);
  return { context, run: code => vm.runInContext(code, context) };
}

test('owner billing view grants access without checkout, renewal claims or subscription forms', async () => {
  const h = harness();
  await h.run("accountPage('billing')");
  assert.match(h.context.markup, /Owner access/);
  assert.match(h.context.markup, /No subscription required/);
  assert.match(h.context.markup, /Unlimited owner requests/);
  assert.doesNotMatch(h.context.markup, /No active subscription|No paid access|billing-plan-form|secure checkout|Cancel at period end/);
  assert.equal(h.context.boundForms, undefined);
  assert.match(h.run('subscriptionNotice()'), /No Nortivo subscription is required/);
});

test('owner billing and AI copy supports Norwegian without advertising a paid subscription', async () => {
  const h = harness({ locale: 'nb' });
  await h.run("accountPage('billing')");
  assert.match(h.context.markup, /Eiertilgang/);
  assert.match(h.context.markup, /Du trenger ikke abonnement/);
  assert.match(h.run('aiPanel(true)'), /Eierforespørsler: Ubegrenset/);
  assert.doesNotMatch(h.run('aiPanel(true)'), /Forespørsler igjen|Infinity|null/);
});

test('existing Stripe records remain visible and manageable independently of owner access', async () => {
  const billing = { status: 'active', tier: 'portfolio', interval: 'year', customerId: 'cus_fixture', subscriptionId: 'sub_fixture',
    currentPeriodEnd: Date.parse('2027-11-18T12:00:00Z'), cancelAtPeriodEnd: true };
  const h = harness({ billing });
  await h.run("accountPage('billing')");
  assert.match(h.context.markup, /Existing billing/);
  assert.match(h.context.markup, /Nothing has been cancelled automatically/);
  assert.match(h.context.markup, /Nortivo Portfolio/);
  assert.match(h.context.markup, /Keep subscription/);
  assert.match(h.context.markup, /Invoices & payment method/);
  assert.doesNotMatch(h.context.markup, /billing-plan-form/);
  assert.equal(h.context.fixtureSnapshot.billing.subscriptionId, 'sub_fixture');
  assert.equal(h.context.fixtureSnapshot.billing.cancelAtPeriodEnd, true);
});

test('owner has no software AI request ceiling but provider availability still controls submission', () => {
  const healthy = harness();
  const html = healthy.run('aiPanel(true)');
  assert.match(html, /Owner requests: Unlimited/);
  assert.doesNotMatch(html.match(/<button type="submit"[^>]*>/)?.[0] || '', /disabled/);
  const unavailable = harness({ ready: false });
  assert.match(unavailable.run('aiPanel(true)').match(/<button type="submit"[^>]*>/)?.[0] || '', /disabled/);
  assert.match(unavailable.run('aiPanel(true)'), /Service unavailable/);
});

test('ordinary paid customers retain quota display and subscription management', async () => {
  const h = harness({ owner: false, billing: { status: 'active', tier: 'pro', interval: 'month', subscriptionId: 'sub_customer' },
    usage: { remainingRequests: 0, requestLimit: 200, resetAt: Date.parse('2026-12-01T00:00:00Z') } });
  await h.run("accountPage('billing')");
  assert.match(h.context.markup, /Your subscription|Paid access/);
  assert.match(h.context.markup, /billing-plan-form/);
  assert.match(h.run('aiPanel(true)'), /Remaining requests: 0 \/ 200/);
  assert.doesNotMatch(h.run('aiPanel(true)'), /Owner requests|Unlimited/);
});

test('an admin capability or email address alone never displays owner access', () => {
  const h = harness({ owner: false });
  h.run("snapshot.capabilities.admin=true;snapshot.user.email='owner@example.test';snapshot.ai.unlimited=true;");
  assert.equal(h.run('owner()'), false);
  assert.doesNotMatch(h.run('aiPanel(true)'), /Owner requests|Unlimited/);
  h.run("snapshot.entitlements.reason='owner';snapshot.entitlements.billingExempt=true;snapshot.user.emailVerified=false;");
  assert.equal(h.run('owner()'), false);
});

test('owner pricing opens its workspace and never starts checkout from a stale action', async () => {
  const h = harness();
  h.run('renderPricing()');
  assert.match(h.context.markup, /Owner access/);
  assert.match(h.context.markup, /data-product="workspace"/);
  assert.doesNotMatch(h.context.markup, /data-product="choose-plan"/);
  h.run("accountPage=async tab=>{globalThis.openedAccountTab=tab;};post=async()=>{throw new Error('Checkout must not run for an owner.');};");
  await h.run('checkout()');
  assert.equal(h.context.openedAccountTab, 'billing');
});

test('real chart shows escaped source coverage beside its original quote timestamp', () => {
  const h = harness();
  h.run(`resolution='1m';selectedInstrument={id:'XNAS:AAPL:USD',symbol:'AAPL',venue:'XNAS',currency:'USD',name:'Apple'};
    marketData={source:'Nortivo Data · Alpaca IEX (single venue)',quote:{symbol:'AAPL',price:'100',currency:'USD',asOf:'2026-11-18T19:17:00Z',freshness:'current',coverage:'IEX single venue <not consolidated>'},bars:[{time:'2026-11-18T19:16:00Z',open:'99',high:'101',low:'98',close:'100',volume:'10'}]};`);
  const html = h.run('productionChartPanel()');
  assert.match(html, /Nortivo Data · Alpaca IEX \(single venue\)/);
  assert.match(html, /IEX single venue &lt;not consolidated&gt;/);
  assert.match(html, /As of:/);
  assert.doesNotMatch(html, /<not consolidated>/);
});
