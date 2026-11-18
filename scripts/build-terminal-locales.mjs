import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function buildTerminalLocales(distDir) {
  let source;
  try { source = await readFile(path.join(distDir, 'terminal/index.html'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const outputs = [];
  for (const locale of ['en', 'nb']) {
    const title = locale === 'nb' ? 'Nortivo Trading Platform — Papirhandel' : 'Nortivo Trading Platform — Paper trading';
    let html = source.replace(/(<html\b[^>]*\blang=")[^"]+/, `$1${locale}`)
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
    html = html.replace('</head>', `<link rel="canonical" href="https://invest.nortivo.no/${locale}/terminal/">\n<link rel="alternate" hreflang="nb" href="https://invest.nortivo.no/nb/terminal/">\n<link rel="alternate" hreflang="en" href="https://invest.nortivo.no/en/terminal/">\n</head>`);
    html = html
      .replaceAll('href="/en/"', `href="https://nortivo.no/${locale}/"`)
      .replaceAll('href="/nb/"', `href="https://nortivo.no/${locale}/"`);
    if (locale === 'nb') html = html
      .replaceAll('Skip to workspace', 'Hopp til arbeidsområdet')
      .replaceAll('Opening your workspace…', 'Åpner arbeidsområdet ditt…')
      .replaceAll('The trading workspace needs JavaScript. Your account records stay on the server.', 'Handelsarbeidsområdet trenger JavaScript. Kontoregistreringene dine forblir på serveren.')
      .replaceAll('Return to Nortivo', 'Tilbake til Nortivo')
      ;
    if (!/<meta name="robots"/.test(html)) html = html.replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>');
    const output = path.join(distDir, locale, 'terminal/index.html');
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, html);
    outputs.push(output);
  }
  return outputs;
}
