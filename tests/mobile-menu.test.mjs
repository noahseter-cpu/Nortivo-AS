import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const site = readFileSync(new URL('../dist/assets/site.js', import.meta.url), 'utf8');
// Exercise the shipped controller without mocking the unrelated translation,
// form and routing code. This fixture models focus/state, not browser layout.
const controller = site.slice(site.indexOf("  const menuButton = document.querySelector('.menu-toggle');"),
  site.indexOf("  document.addEventListener('pointerdown'"));

class Style {
  values = new Map();
  getPropertyValue(name) { return this.values.get(name)?.[0] || ''; }
  getPropertyPriority(name) { return this.values.get(name)?.[1] || ''; }
  setProperty(name, value, priority = '') { this.values.set(name, [value, priority]); }
  removeProperty(name) { this.values.delete(name); }
}
class Element {
  constructor(tag, attrs = {}) {
    this.tagName = tag;
    this.attrs = { ...attrs };
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.style = new Style();
    this.hidden = false;
    this.rendered = true;
  }
  append(...children) {
    children.forEach(child => { child.parentElement = this; this.children.push(child); });
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  matches(selector) {
    const parts = selector.trim().split(/\s+/);
    if (parts.length > 1) return this.matches(parts.at(-1)) && Boolean(this.parentElement?.closest(parts.slice(0, -1).join(' ')));
    const tag = selector.match(/^[a-z]+/i)?.[0];
    if (tag && tag !== this.tagName) return false;
    const className = selector.match(/\.([\w-]+)/)?.[1];
    if (className && !(this.attrs.class || '').split(' ').includes(className)) return false;
    return [...selector.matchAll(/\[([\w-]+)\]/g)].every(([, name]) => name === 'hidden' ? this.hidden : name in this.attrs);
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [child, ...child.querySelectorAll('*')])
      .filter(child => selector === '*' || selector.split(',').some(part => child.matches(part)));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getClientRects() { return this.hidden || !this.rendered || this.parentElement?.getClientRects().length === 0 ? [] : [{}]; }
  addEventListener(name, listener) { this.listeners.set(name, [...this.listeners.get(name) || [], listener]); }
  emit(name, detail = {}) {
    const event = { target: this, detail: 0, preventDefault() { this.defaultPrevented = true; }, ...detail };
    for (const listener of this.listeners.get(name) || []) listener(event);
    return event;
  }
  focus() {
    let document = this;
    while (document.parentElement) document = document.parentElement;
    document.activeElement = this;
    document.emit('focusin', { target: this });
  }
}
function fixture({ animations = false, reduced = false, headerAttrs = {} } = {}) {
  const document = new Element('document');
  const html = document.documentElement = new Element('html');
  const body = document.body = new Element('body');
  const header = new Element('header', { class: 'site-header nt-header', ...headerAttrs });
  const brand = new Element('a', { class: 'brand', href: '/' });
  const desktopNav = new Element('nav', { class: 'desktop-nav' });
  const desktopLink = new Element('a', { href: '/en/research/' });
  const locale = new Element('button', { 'data-language': 'nb' });
  const toggle = new Element('button', { class: 'menu-toggle', 'aria-expanded': 'false' });
  const label = new Element('span', { 'data-i18n': 'nav.menu' });
  const menu = new Element('nav', { class: 'mobile-nav', 'aria-label': 'Main navigation' });
  const first = new Element('a', { href: '/en/research/' });
  const last = new Element('a', { href: '/en/report-2026/' });
  const main = new Element('main');
  const outside = new Element('button');
  const preInert = new Element('aside', { inert: 'existing' });
  document.append(html); html.append(body); body.append(header, main, preInert);
  header.append(brand, desktopNav, locale, toggle, menu); desktopNav.append(desktopLink);
  toggle.append(label); menu.append(first, last); main.append(outside);
  document.activeElement = toggle;
  menu.hidden = true;
  desktopNav.rendered = false;
  body.style.setProperty('overflow', 'auto', 'important');
  html.style.setProperty('overflow-x', 'hidden');
  html.style.setProperty('overflow-y', 'scroll', 'important');
  const media = new Map();
  const matchMedia = query => {
    if (!media.has(query)) media.set(query, { matches: query.includes('reduced-motion') ? reduced : false,
      listeners: [], addEventListener(_name, listener) { this.listeners.push(listener); },
      change(matches) { this.matches = matches; this.listeners.forEach(listener => listener({ matches })); } });
    return media.get(query);
  };
  const motions = [];
  if (animations) menu.animate = (_frames, options) => {
    const motion = { options, cancel() { this.cancelled = true; }, finish() { this.onfinish?.(); } };
    motions.push(motion);
    return motion;
  };
  const window = new Element('window');
  let language = 'en';
  const translate = key => ({ en: { 'nav.menu': 'Menu', 'nav.close': 'Close menu', 'nav.label': 'Main navigation' },
    nb: { 'nav.menu': 'Meny', 'nav.close': 'Lukk meny', 'nav.label': 'Hovedmeny' } })[language][key];
  vm.runInNewContext(controller, { document, window, matchMedia, translate });
  return { document, html, body, header, brand, desktopNav, desktopLink, locale, toggle, label, menu, first, last,
    main, outside, preInert, motions, window,
    setLanguage(next) { language = next; document.emit('nortivo:language'); },
    desktop() {
      desktopNav.rendered = true; toggle.rendered = false; menu.rendered = false;
      media.get('(min-width: 881px)').change(true);
    },
    reduce() { media.get('(prefers-reduced-motion: reduce)').change(true); },
  };
}

function assertRestored(f) {
  assert.equal(f.body.style.getPropertyValue('overflow'), 'auto');
  assert.equal(f.body.style.getPropertyPriority('overflow'), 'important');
  assert.equal(f.html.style.getPropertyValue('overflow'), '');
  assert.equal(f.html.style.getPropertyValue('overflow-x'), 'hidden');
  assert.equal(f.html.style.getPropertyValue('overflow-y'), 'scroll');
  assert.equal(f.html.style.getPropertyPriority('overflow-y'), 'important');
  assert.equal(f.main.getAttribute('inert'), null);
  assert.equal(f.preInert.getAttribute('inert'), 'existing');
}

test('keyboard opening focuses the first link, protects the page and Escape restores all prior state', () => {
  const f = fixture({ headerAttrs: { role: 'banner', 'aria-label': 'Nortivo header' } });
  f.toggle.emit('click');
  assert.equal(f.document.activeElement, f.first);
  assert.equal(f.menu.hidden, false);
  assert.equal(f.header.getAttribute('role'), 'dialog');
  assert.equal(f.header.getAttribute('aria-modal'), 'true');
  assert.equal(f.header.getAttribute('aria-label'), 'Main navigation');
  assert.equal(f.menu.tagName, 'nav');
  assert.equal(f.main.getAttribute('inert'), '');
  assert.equal(f.header.getAttribute('inert'), null);
  assert.equal(f.body.style.getPropertyValue('overflow'), 'hidden');
  assert.equal(f.label.textContent, 'Close menu');
  f.document.emit('keydown', { key: 'Escape' });
  assert.equal(f.menu.hidden, true);
  assert.equal(f.document.activeElement, f.toggle);
  assert.equal(f.header.getAttribute('role'), 'banner');
  assert.equal(f.header.getAttribute('aria-modal'), null);
  assert.equal(f.header.getAttribute('aria-label'), 'Nortivo header');
  assert.equal(f.label.textContent, 'Menu');
  assertRestored(f);
});

test('Tab wraps only at the modal boundary and language controls stay in the focus order', () => {
  const f = fixture();
  f.toggle.emit('click');
  f.last.focus();
  assert.equal(f.document.emit('keydown', { key: 'Tab' }).defaultPrevented, true);
  assert.equal(f.document.activeElement, f.brand);
  assert.equal(f.document.emit('keydown', { key: 'Tab', shiftKey: true }).defaultPrevented, true);
  assert.equal(f.document.activeElement, f.last);
  f.locale.focus();
  assert.equal(f.document.emit('keydown', { key: 'Tab' }).defaultPrevented, undefined);
  assert.equal(f.document.activeElement, f.locale);
  f.outside.focus();
  assert.equal(f.document.activeElement, f.brand);
});

test('language re-render closes and unlocks without moving focus away from the language control', () => {
  const f = fixture();
  f.toggle.emit('click');
  f.locale.focus();
  f.setLanguage('nb');
  assert.equal(f.menu.hidden, true);
  assert.equal(f.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(f.document.activeElement, f.locale);
  assert.equal(f.label.textContent, 'Meny');
  assert.equal(f.header.getAttribute('role'), null);
  assertRestored(f);
});

test('desktop resize restores focus to the equivalent visible link and clears mobile state', () => {
  const f = fixture();
  f.toggle.emit('click');
  f.desktop();
  assert.equal(f.menu.hidden, true);
  assert.equal(f.document.activeElement, f.desktopLink);
  assertRestored(f);
  f.toggle.emit('click');
  assert.equal(f.toggle.getAttribute('aria-expanded'), 'false');
});

test('pointer close is inaccessible and unlocked immediately; repeated toggles cancel pending motion', () => {
  const f = fixture({ animations: true });
  f.toggle.emit('click', { detail: 1 });
  assert.equal(f.document.activeElement, f.toggle);
  assert.equal(f.motions[0].options.duration, 220);
  f.toggle.emit('click', { detail: 1 });
  assert.equal(f.motions[0].cancelled, true);
  assert.equal(f.menu.hidden, false); // The visual exit can finish independently.
  assert.equal(f.menu.getAttribute('aria-hidden'), 'true');
  assert.equal(f.menu.getAttribute('inert'), '');
  assert.equal(f.toggle.getAttribute('aria-expanded'), 'false');
  assertRestored(f);
  f.toggle.emit('click', { detail: 1 });
  assert.equal(f.motions[1].cancelled, true);
  assert.equal(f.menu.getAttribute('inert'), null);
  f.motions[2].finish();
  assert.equal(f.menu.hidden, false);
  f.document.emit('keydown', { key: 'Escape' });
  assert.equal(f.menu.hidden, true);
  assertRestored(f);
});

test('reduced motion and page departure settle any pending transition and release the page', () => {
  const f = fixture({ animations: true });
  f.toggle.emit('click', { detail: 1 });
  f.reduce();
  assert.equal(f.motions[0].cancelled, true);
  assert.equal(f.menu.hidden, false);
  f.toggle.emit('click', { detail: 1 });
  assert.equal(f.menu.hidden, true);
  assert.equal(f.motions.length, 1);
  f.toggle.emit('click', { detail: 1 });
  f.window.emit('pagehide');
  assert.equal(f.menu.hidden, true);
  assertRestored(f);
});
