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
  assert.match(read('dist/nb/index.html'),/data-i18n="hero.action"\s*>Produkter</);
  for(const route of ['about','services','contact','restaurant']) assert.equal((read(`dist/${route}/index.html`).match(/<h1\b/g)||[]).length,1);
});
