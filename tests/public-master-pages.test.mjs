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
    assert.ok(html.includes('data-nortivo-chat') && html.includes('data-nortivo-intake-summary'));
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
  test(`both ${lang} service pages carry the matching request kind and an actual conversation mount`,async()=>{
    for(const kind of ['bot','engine']){
      const html=await read(`invest/${lang}/systems/${kind}/index.html`);
      assert.equal(html,investPage(lang,kind,getPlanCatalog()));
      assert.ok(html.includes(`data-nortivo-intake data-service="${kind}"`));
      assert.ok(html.includes('<div data-nortivo-chat></div>'));
    }
    const html=await read(`invest/${lang}/support/index.html`);
    assert.ok(html.includes('<div data-nortivo-chat></div>'));
    assert.ok(html.includes('data-nortivo-chat-launch'));
    assert.ok(html.includes('id="support-title"'));
  });
  test(`KORVNT ${lang} keeps the daughter-company site and parent integration page distinct`,async()=>{
    const standalone=await read(`korvnt/${lang}/index.html`),parent=await read(`${lang}/security/index.html`);
    assert.equal(standalone,securityPage(lang));assert.equal(parent,parentSecurityPage(lang));
    assert.ok(standalone.includes(`rel="canonical" href="https://korvnt.no/${lang}/"`));
    assert.ok(parent.includes(`rel="canonical" href="https://nortivo.no/${lang}/security/"`));
    assert.ok(standalone.includes('CONTROL<br>BY DESIGN.') && standalone.includes('korvnt-aperture.png'));
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
test('default Invest and security documents are complete English fallbacks',async()=>{
  assert.equal(await read('invest/index.html'),await read('invest/en/index.html'));
  assert.equal(await read('korvnt/index.html'),await read('korvnt/en/index.html'));
  assert.equal(await read('security/index.html'),await read('en/security/index.html'));
});
