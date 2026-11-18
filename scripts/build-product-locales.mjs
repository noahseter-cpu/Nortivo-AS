import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Product applications own their bilingual runtime; emit static, indexable
// pricing shells and private application routes without duplicating assets.
export async function buildProductLocales(distDir) {
  const outputs = [];
  for (const page of ['pricing', 'portfolio']) {
    let source;
    try { source = await readFile(path.join(distDir, page, 'index.html'), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const locale of ['nb', 'en']) {
      const name = page === 'pricing' ? locale === 'nb' ? 'Abonnementer' : 'Plans' : locale === 'nb' ? 'Portefølje' : 'Portfolio';
      const canonical = `https://invest.nortivo.no/${locale}/${page}/`;
      let html = source.replace(/(<html\b[^>]*\blang=")[^"]+/, `$1${locale}`)
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${name} — Nortivo</title>`)
        .replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '')
        .replace('</head>', `<link rel="canonical" href="${canonical}">\n<link rel="alternate" hreflang="nb" href="https://invest.nortivo.no/nb/${page}/">\n<link rel="alternate" hreflang="en" href="https://invest.nortivo.no/en/${page}/">\n</head>`);
      if (locale === 'nb') for (const [english, norwegian] of Object.entries({
        'Skip to workspace': 'Hopp til arbeidsområdet', 'Opening your portfolio…': 'Åpner porteføljen din…',
        'Your private portfolio needs JavaScript. Records remain on the server.': 'Den private porteføljen trenger JavaScript. Opplysningene blir på serveren.',
        'Return to Nortivo': 'Tilbake til Nortivo', 'Portfolio and Terminal Pro': 'Portfolio og Terminal Pro',
        'Nortivo Portfolio: USD 10 monthly or USD 96 annually (USD 8 per month equivalent). Nortivo Terminal Pro: USD 30 monthly or USD 288 annually (USD 24 per month equivalent). Annual prices save 20% and are charged upfront. No free trial.': 'Nortivo Portfolio: USD 10 per måned eller USD 96 per år (tilsvarer USD 8 per måned). Nortivo Terminal Pro: USD 30 per måned eller USD 288 per år (tilsvarer USD 24 per måned). Årsprisene gir 20 % rabatt og betales samlet på forhånd. Ingen gratis prøveperiode.',
        'Checking subscription availability…': 'Kontrollerer hvilke abonnementer som er tilgjengelige…',
        'Subscription selection needs JavaScript.': 'Abonnementsvalget trenger JavaScript.', 'Contact support': 'Kontakt support',
      })) html = html.replaceAll(english, norwegian);
      html = html.replaceAll('href="/en/"', `href="https://nortivo.no/${locale}/"`)
        .replaceAll('href="/en/support/"', `href="https://nortivo.no/${locale}/support/"`)
        .replaceAll('href="/nb/"', `href="https://nortivo.no/${locale}/"`)
        .replaceAll('href="/nb/support/"', `href="https://nortivo.no/${locale}/support/"`);
      const output = path.join(distDir, locale, page, 'index.html');
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, html);
      outputs.push(output);
    }
  }
  return outputs;
}
