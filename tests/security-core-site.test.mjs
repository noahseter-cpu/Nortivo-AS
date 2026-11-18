import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderLocale } from '../scripts/build-locales.mjs';

test('locale build preserves the approved KORVNT Security label and local destination', () => {
  const source = '<html><head><title>Home</title></head><body><a href="/security/" data-security-link>Security</a></body></html>';
  const dictionary = { 'meta.home.title': 'Home', 'meta.home.description': 'Description' };
  for (const locale of ['nb','en']) {
    const result = renderLocale(source, dictionary, locale, 'home');
    assert.match(result, new RegExp(`href="/${locale}/security/" data-security-link>KORVNT Security</a>`));
  }
});
test('prepared website scope remains honest about deployment and exposes only public assets', async () => {
  for (const locale of ['', 'nb/', 'en/']) {
    const html = await readFile(new URL(`../dist/${locale}security/index.html`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /services\/security-core\/src|SUPABASE_SERVICE_ROLE_KEY|SECURITY_CORE_ADMIN_KEY|Nortivo Sentinel/);
    assert.match(html, /Nortivo KORVNT/);
    assert.match(html, /review|gjennomgang|gjennomgås|lokal/i);
  }
});
