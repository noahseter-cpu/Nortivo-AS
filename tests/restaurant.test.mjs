import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = {window:{},Intl,Date};
vm.runInNewContext(read('dist/assets/restaurant-model.js'), context);
const model = context.window.LuneDemo;
test('restaurant dates reject impossible days and accept leap days', () => {
  for (const date of ['', '2026-02-29', '2026-04-31', '2026-13-01', '22/09/2026']) assert.equal(model.parseDate(date), null);
  assert.ok(model.parseDate('2028-02-29'));
});
test('restaurant schedule closes Sunday and Monday and changes weekend slots', () => {
  assert.equal(model.times('2026-09-27').length, 0);
  assert.equal(model.times('2026-09-28').length, 0);
  assert.equal(model.times('2026-09-22')[0], '17:00');
  assert.equal(model.times('2026-09-25')[0], '16:00');
});
test('booking uses Oslo local day and rejects past dates, invalid guests and unavailable slots', () => {
  assert.equal(model.today(new Date('2026-09-21T22:30:00Z')), '2026-09-22');
  const selection = {date:'2026-09-22',guests:2,time:'18:00'};
  assert.equal(model.valid(selection,'2026-09-22'), true);
  for (const change of [{date:'2026-09-21'},{date:'2026-09-27'},{guests:0},{guests:7},{guests:1.5},{time:'16:00'},{time:''}]) assert.equal(model.valid({...selection,...change},'2026-09-22'), false);
});
test('restaurant is explicitly fictional and contains no reservation network or personal-data fields', () => {
  const html=read('dist/restaurant/index.html');
  assert.match(html,/Fictional restaurant/);
  assert.match(html,/<fieldset disabled>/);
  assert.doesNotMatch(html,/<input[^>]+type="(?:email|tel|password)"/);
  assert.doesNotMatch(read('dist/assets/restaurant.js'),/fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});
test('homepage stays brief and all new pages have one main heading', () => {
  const home=read('dist/index.html');
  assert.doesNotMatch(home,/<form|class="career|id="contact"/);
  assert.match(read('dist/nb/index.html'),/data-i18n="studio.headline"\s*>Nettsider og apper\.</);
  for(const route of ['about','services','contact','restaurant']) assert.equal((read(`dist/${route}/index.html`).match(/<h1\b/g)||[]).length,1);
});
test('company homepage shows both real projects and honest private-test/demo context', () => {
  for(const lang of ['nb','en']) {
    const html=read(`dist/${lang}/index.html`);
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert.match(html,/class="studio-projects"/);
    assert.match(html,/lune-table\.webp/);
    assert.match(html,/arc-desktop\.webp/);
    assert.match(html,/data-i18n="studio.luneStatus"/);
    assert.match(html,/data-i18n="status"/);
    assert.match(html,/data-i18n="home.screenCaption"/);
    assert.match(html,new RegExp(`href="/${lang}/restaurant/"`));
    assert.match(html,new RegExp(`href="/${lang}/products/#app-view"`));
    assert.match(html,new RegExp(`href="/${lang}/contact/"`));
    assert.doesNotMatch(html,/<iframe|<form|Vibb|vibb|data-arc-example/);
  }
});

test('public studio styling remains separate from the private workspace and restaurant identity', () => {
  for(const lang of ['nb','en']) {
    for(const route of ['','products/','services/','about/','contact/','support/','privacy/']) {
      assert.match(read(`dist/${lang}/${route}index.html`),/href="\/assets\/studio-refresh\.css"/);
    }
    for(const route of ['restaurant','admin']) {
      assert.doesNotMatch(read(`dist/${lang}/${route}/index.html`),/href="\/assets\/studio-refresh\.css"/);
    }
  }
  assert.match(read('dist/products/index.html'),/id="app-view"/);
  assert.match(read('dist/assets/studio-refresh.css'),/prefers-reduced-motion:reduce/);
});

test('support retains the same complete desktop and mobile header as home in both languages', () => {
  for (const lang of ['nb','en']) {
    const header = html => html.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
    assert.equal(header(read(`dist/${lang}/support/index.html`)), header(read(`dist/${lang}/index.html`)));
    const home = read(`dist/${lang}/index.html`);
    assert.match(home,new RegExp(`href="/${lang}/products/#app-view"`));
  }
});

test('refined restaurant preserves truthful imagery and native keyboard time choices', () => {
  const html=read('dist/restaurant/index.html');
  assert.match(html,/lune-interior\.webp/);
  assert.match(html,/lune-table\.webp/);
  assert.match(html,/class="booking-slots"/);
  assert.match(html,/id="selection-preview" role="status"/);
  const code=read('dist/assets/restaurant.js');
  assert.match(code,/input\.type = 'radio'/);
  assert.match(code,/input\.required = true/);
  assert.match(code,/document\.documentElement\.dataset\.input === 'pointer'/);
  assert.match(code,/reducedMotion\.matches/);
  assert.match(JSON.parse(read('dist/assets/lune-interior.webp.json')).prompt,/fictional/);
});

test('Lune editorial typography is scoped and controls retain explicit readable ink', () => {
  const css=read('dist/assets/restaurant.css');
  assert.match(css,/font-family:Gloock/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.vegetarian-control\{[^}]*color:var\(--lune-ink\)/);
  assert.match(css,/\.booking-fields label,\.booking-slots legend\{[^}]*color:var\(--lune-ink\)/);
  assert.doesNotMatch(read('dist/assets/site.css'),/Gloock/);
  assert.match(read('dist/assets/fonts/Gloock-OFL.txt'),/SIL OPEN FONT LICENSE/);
});

test('restaurant refinement avoids repeated imagery and keeps both language headings concise', () => {
  const html=read('dist/restaurant/index.html');
  assert.equal((html.match(/<img /g)||[]).length,2);
  assert.doesNotMatch(html,/class="lune-taste"|class="lune-room-detail"/);
  assert.match(read('dist/nb/restaurant/index.html'),/>På menyen<\/h2>/);
  assert.match(read('dist/en/restaurant/index.html'),/>Find a table<\/h2>/);
});
