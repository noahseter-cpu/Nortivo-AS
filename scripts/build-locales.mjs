import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pages = ['home', 'products', 'support', 'admin', 'privacy'];
export const locales = ['nb', 'en'];
const rawTextTags = new Set(['script', 'style', 'textarea']);
const protectedTextTags = new Set(['input', 'textarea', 'script', 'style']);

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function decodeAttribute(value) {
  return value.replace(/&(amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (whole, entity) => {
    const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
    if (!entity.startsWith('#')) return named[entity.toLowerCase()];
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : whole;
  });
}

function attributes(tag) {
  const result = new Map();
  const start = tag.match(/^<\/?[\w:-]+/)?.[0].length || 0;
  const pattern = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  pattern.lastIndex = start;
  for (const match of tag.matchAll(pattern)) result.set(match[1].toLowerCase(), {
    value: decodeAttribute(match[2] ?? match[3] ?? match[4] ?? ''), start: match.index, end: match.index + match[0].length,
  });
  return result;
}

function setAttribute(tag, name, value) {
  const existing = attributes(tag).get(name.toLowerCase());
  const replacement = ` ${name}="${escapeHtml(value)}"`;
  return existing ? tag.slice(0, existing.start) + replacement + tag.slice(existing.end) : tag.replace(/\s*\/?>$/, end => replacement + end);
}

function tokenize(source) {
  const tokens = [];
  const pattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z](?:[^>"']|"[^"]*"|'[^']*')*>/g;
  let match;
  while ((match = pattern.exec(source))) {
    const name = match[0].match(/^<\/?([\w:-]+)/)?.[1].toLowerCase();
    const token = { start: match.index, end: pattern.lastIndex, text: match[0], name, closing: /^<\//.test(match[0]) };
    tokens.push(token);
    // JavaScript, CSS and textarea content must never be parsed as translatable HTML.
    if (name && !token.closing && rawTextTags.has(name)) {
      const closing = new RegExp(`</${name}\\s*>`, 'ig');
      closing.lastIndex = pattern.lastIndex;
      const found = closing.exec(source);
      if (!found) throw new Error(`Unclosed ${name} element.`);
      tokens.push({ start: found.index, end: closing.lastIndex, text: found[0], name, closing: true });
      pattern.lastIndex = closing.lastIndex;
    }
  }
  return tokens;
}

function pagePath(page) { return page === 'home' ? '/' : `/${page}/`; }

function localizeHref(href, locale) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const match = href.match(/^([^?#]*)([?#][\s\S]*)?$/);
  const pathname = match[1];
  const normalized = pathname === '/' ? '/' : `${pathname.replace(/\/$/, '')}/`;
  if (!pages.some(page => pagePath(page) === normalized)) return href;
  return `/${locale}${normalized}${match[2] || ''}`;
}

export function renderLocale(source, dictionary, locale, page, origin = 'https://nortivo.no') {
  if (!locales.includes(locale) || !pages.includes(page)) throw new Error('Unsupported locale or page.');
  const canonicalOrigin = new URL(origin).origin;
  if (!/^https?:$/.test(new URL(origin).protocol)) throw new Error('Invalid canonical origin.');
  const tokens = tokenize(source);
  const changes = [];
  const missing = new Set();
  const translate = key => {
    if (typeof dictionary[key] !== 'string') { missing.add(key); return undefined; }
    return dictionary[key];
  };
  const translatedAttributes = [
    ['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria', 'aria-label'],
    ['data-i18n-aria-label', 'aria-label'], ['data-i18n-title', 'title'], ['data-i18n-alt', 'alt'],
  ];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.name || token.closing) continue;
    const attrs = attributes(token.text);
    let replacement = token.text;
    if (token.name === 'html') replacement = setAttribute(replacement, 'lang', locale);
    for (const [sourceName, destination] of translatedAttributes) {
      const key = attrs.get(sourceName)?.value;
      if (key !== undefined) {
        const value = translate(key);
        if (value !== undefined) replacement = setAttribute(replacement, destination, value);
      }
    }
    if (token.name === 'a' && attrs.has('href')) replacement = setAttribute(replacement, 'href', localizeHref(attrs.get('href').value, locale));
    if (attrs.has('data-language')) replacement = setAttribute(replacement, 'aria-pressed', String(attrs.get('data-language').value === locale));
    const key = attrs.get('data-i18n')?.value;
    const next = tokens[index + 1];
    // Only marked leaf text is replaced; nested markup and form values survive.
    if (key !== undefined && !protectedTextTags.has(token.name) && !attrs.has('contenteditable')) {
      const value = translate(key);
      if (value !== undefined && next?.closing && next.name === token.name) changes.push({ start: token.end, end: next.start, value: escapeHtml(value) });
    }
    if (replacement !== token.text) changes.push({ start: token.start, end: token.end, value: replacement });
  }
  const title = translate(`meta.${page}.title`);
  const description = translate(`meta.${page}.description`);
  if (missing.size) throw new Error(`Missing ${locale} translations in ${page}: ${[...missing].join(', ')}`);
  let html = source;
  for (const change of changes.sort((a, b) => b.start - a.start)) html = html.slice(0, change.start) + change.value + html.slice(change.end);

  // Remove actual head elements, not tag-like literals inside scripts or styles.
  const metadataChanges = [];
  const renderedTokens = tokenize(html);
  let insideHead = false;
  for (let index = 0; index < renderedTokens.length; index++) {
    const token = renderedTokens[index];
    if (token.name === 'head') insideHead = !token.closing;
    if (!insideHead || token.closing) continue;
    if (token.name === 'title' && renderedTokens[index + 1]?.name === 'title' && renderedTokens[index + 1].closing) {
      metadataChanges.push({ start: token.start, end: renderedTokens[index + 1].end });
    }
    if (!['meta', 'link'].includes(token.name)) continue;
    const attrs = attributes(token.text);
    const name = attrs.get('name')?.value.toLowerCase();
    const property = attrs.get('property')?.value.toLowerCase();
    const rel = attrs.get('rel')?.value.toLowerCase();
    if (['description', 'robots'].includes(name) || ['og:title', 'og:description', 'og:url', 'og:locale', 'og:locale:alternate'].includes(property)
      || rel === 'canonical' || (rel === 'alternate' && attrs.has('hreflang'))) metadataChanges.push({ start: token.start, end: token.end });
  }
  for (const change of metadataChanges.sort((a, b) => b.start - a.start)) html = html.slice(0, change.start) + html.slice(change.end);
  const base = pagePath(page);
  const canonical = `${canonicalOrigin}/${locale}${base}`;
  const metadata = [
    `<title>${escapeHtml(title)}</title>`, `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    ...locales.map(lang => `<link rel="alternate" hreflang="${lang}" href="${canonicalOrigin}/${lang}${base}" />`),
    `<link rel="alternate" hreflang="x-default" href="${canonicalOrigin}${base}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`, `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${canonical}" />`, `<meta property="og:locale" content="${locale === 'nb' ? 'nb_NO' : 'en_GB'}" />`,
    `<meta property="og:locale:alternate" content="${locale === 'nb' ? 'en_GB' : 'nb_NO'}" />`,
    ...(['support', 'admin'].includes(page) ? ['<meta name="robots" content="noindex, nofollow" />'] : []),
  ].join('\n    ');
  if (!/<head\b[^>]*>/i.test(html)) throw new Error(`Missing head element in ${page}.`);
  return html.replace(/<head\b[^>]*>/i, tag => `${tag}\n    ${metadata}`);
}

export async function buildLocales({ distDir = path.join(projectRoot, 'dist'), origin = 'https://nortivo.no' } = {}) {
  const siteCopy = JSON.parse(await readFile(path.join(distDir, 'assets/site-copy.json'), 'utf8'));
  const portalCopy = JSON.parse(await readFile(path.join(distDir, 'assets/portal-copy.json'), 'utf8'));
  const dictionaries = Object.fromEntries(locales.map(locale => [locale, { ...siteCopy[locale], ...portalCopy[locale] }]));
  // Validate and render every source first, so incomplete inputs do not produce half a build.
  const outputs = [];
  for (const page of pages) {
    const relative = page === 'home' ? 'index.html' : `${page}/index.html`;
    const source = await readFile(path.join(distDir, relative), 'utf8');
    for (const locale of locales) outputs.push({ path: path.join(distDir, locale, relative), html: renderLocale(source, dictionaries[locale], locale, page, origin) });
  }
  for (const output of outputs) {
    await mkdir(path.dirname(output.path), { recursive: true });
    await writeFile(output.path, output.html, 'utf8');
  }
  return outputs.map(output => output.path);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(`Built ${(await buildLocales()).length} localized pages.`); }
  catch (error) { console.error(`Locale build failed: ${error.message}`); process.exitCode = 1; }
}
