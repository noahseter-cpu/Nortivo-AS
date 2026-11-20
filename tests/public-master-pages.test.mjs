import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getPlanCatalog } from '../netlify/product/plans.mjs';
import { investPage } from '../scripts/public-pages/invest.mjs';
import { securityPage, parentSecurityPage } from '../scripts/public-pages/security.mjs';

const dist = new URL('../dist/', import.meta.url);
const read = file => readFile(new URL(file,dist), 'utf8');

for (const lang of ['en','nb']) {
  test(`Invest ${lang} is a complete public document, independent of account and terminal startup`,async()=>{
    const catalog=getPlanCatalog();
    const html=await read(`invest/${lang}/index.html`);
    assert.equal(html,investPage(lang,'home',catalog));
    for(const id of ['main','platform','systems','request','support','iv-preview-title']) assert.ok(html.includes(`id="${id}"`),id);
    assert.doesNotMatch(html,/data-nortivo-intake|nwf-launcher/);
    assert.equal(html.match(/<div data-nortivo-chat>/g)?.length,1);
    assert.ok(html.includes('<div hidden><div data-nortivo-chat></div></div>'));
    assert.match(html,/data-nortivo-chat-launch data-nortivo-topic="research"/);
    for (const url of [`/${lang}/request/`,`/${lang}/request/#track`,`/${lang}/support/`,`/${lang}/support/#questions`]) {
      assert.ok(html.includes(`href="${url}"`),url);
    }
    assert.match(html,/<section class="iv-offering" id="systems"><div class="iv-wrap">/);
    assert.ok(html.includes('/assets/invest/terminal-reference.jpg') && html.includes('/assets/brand/nortivo-approved.png'));
    assert.ok(html.includes(`https://nortivo.no/${lang}/report-2026/`));
    assert.ok(html.includes(`href="/${lang}/terminal/"`) && html.includes(`href="/${lang}/pricing/"`));
    assert.doesNotMatch(html,/src="[^"]*(?:terminal\/app|product-entry|product-client)\.js"/);
    for(const plan of catalog.plans){
      assert.ok(html.includes(`USD ${plan.prices.month.amount/100}</b>`));
      assert.ok(html.includes(`USD ${plan.prices.year.amount/100} /`));
      assert.ok(html.includes(`data-plan-availability="${plan.tier}"`));
    }
  });
  test(`${lang} dedicated requests keep the chosen service, a summary below the form and one support composer`,async()=>{
    for(const page of ['bot','engine','request']){
      const route=page==='request'?'request':'systems/'+page;
      const html=await read(`invest/${lang}/${route}/index.html`);
      assert.equal(html,investPage(lang,page,getPlanCatalog()));
      if (page!=='request') assert.ok(html.includes(`data-nortivo-intake data-service="${page}"`));
      assert.match(html,/<div class="iv-spec-paper">\s*<div data-nortivo-intake[^>]* id="track"><\/div>[\s\S]*?<section class="iv-brief-section"[^>]*><div data-nortivo-intake-summary><\/div><\/section>\s*<\/div><aside class="iv-spec-side">/);
      assert.match(html,/<section class="iv-spec-chat" id="support"[\s\S]*?<section class="iv-request-next"[\s\S]*?<ol>/);
      assert.equal(html.match(/<div data-nortivo-chat>/g)?.length,1);
      assert.doesNotMatch(html,/nwf-launcher/);
    }
    const html=await read(`invest/${lang}/support/index.html`);
    assert.equal(html.match(/<div data-nortivo-chat>/g)?.length,1);
    assert.doesNotMatch(html,/data-nortivo-intake|nwf-launcher/);
    assert.ok(html.includes('id="support-title"'));
    assert.ok(html.includes('id="questions"'));
    assert.equal(html.match(/<details><summary>/g)?.length,6);
  });
  test(`KORVNT ${lang} keeps the daughter-company site and parent integration page distinct`,async()=>{
    const standalone=await read(`korvnt/${lang}/index.html`),parent=await read(`${lang}/security/index.html`);
    assert.equal(standalone,securityPage(lang));assert.equal(parent,parentSecurityPage(lang));
    assert.ok(standalone.includes(`rel="canonical" href="https://korvnt.no/${lang}/"`));
    assert.ok(parent.includes(`rel="canonical" href="https://nortivo.no/${lang}/security/"`));
    assert.ok(standalone.includes('CONTROL<br>BY DESIGN.') && standalone.includes('korvnt-aperture.png'));
    const choices=standalone.slice(standalone.indexOf('class="ks-needs-list"'),standalone.indexOf('class="ks-assess-row"'));
    for(const id of ['enquiry','track','support']){
      assert.ok(choices.includes(`href="#${id}"`),id);
      assert.ok(standalone.includes(`<details id="${id}"`),id);
    }
    for(const kind of ['cybersecurity','website-security','account-security','website-design','asset-recovery']){
      assert.ok(standalone.includes(`data-service-kind="${kind}"`));
      assert.ok(parent.includes(`https://korvnt.no/${lang}/#service-${kind}`));
    }
    for(const html of [standalone,parent])for(const id of ['framework','controls','privacy','report-form','draft-output','download-draft'])assert.ok(html.includes(`id="${id}"`));
    assert.ok(standalone.includes('data-workflow-business="korvnt"') && standalone.includes('/assets/security-core/enquiry.js'));
    assert.doesNotMatch(parent,/data-workflow-business=|enquiry\.js/);
    assert.ok(standalone.includes('nortivo-approved.png') && standalone.includes('core-symbol.svg'));
  });
}
test('the public overview uses the catalog’s totals, monthly equivalents and annual discount',()=>{
  const catalog=getPlanCatalog();
  catalog.annualDiscountPercent=25;
  Object.assign(catalog.plans[0].prices.month,{amount:1600});
  Object.assign(catalog.plans[0].prices.year,{amount:14400,monthlyEquivalent:1200});
  for(const lang of ['en','nb']){
    const html=investPage(lang,'home',catalog);
    const plan=html.match(/<article class="iv-plan">([\s\S]*?)<\/article>/)?.[1];
    assert.match(plan,/USD 16<\/b>/);assert.match(plan,/USD 144 \/ (?:year|år)/);
    assert.match(plan,/USD 12 \/ (?:month|måned)/);
    assert.ok(html.includes(lang==='nb'?'25 % rabatt':'25% discount'));
  }
});
test('default Invest and security documents are complete English fallbacks',async()=>{
  assert.equal(await read('invest/index.html'),await read('invest/en/index.html'));
  assert.equal(await read('korvnt/index.html'),await read('korvnt/en/index.html'));
  assert.equal(await read('security/index.html'),await read('en/security/index.html'));
});
