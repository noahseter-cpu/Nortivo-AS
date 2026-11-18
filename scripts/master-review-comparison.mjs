import {readFile} from 'node:fs/promises';
import path from 'node:path';

const comparisons = new Map([
  ['/_review/compare/korvnt', {slug: 'korvnt', title: 'KORVNT'}],
  ['/_review/compare/invest', {slug: 'invest', title: 'Nortivo Invest'}],
  ['/_review/compare/request', {slug: 'request', title: 'Custom system request'}]
]);

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow'
};

export async function masterComparisonResponse(pathname, root) {
  const target = comparisons.get(pathname);
  if (!target) return null;

  const {slug, title} = target;
  let reference, capture;
  try {
    [reference, capture] = await Promise.all([
      readFile(path.join(root, 'design-references', 'approved-master-20261118', slug + '-approved.png')),
      readFile(path.join(root, '.local', 'master-preview', 'evidence', 'approved-v2', slug + '-desktop.jpg'))
    ]);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    return {status: 404, headers, body: '<!doctype html><html lang="en"><meta charset="utf-8"><title>Comparison unavailable</title><h1>Comparison unavailable</h1><p>The reference or capture is missing.</p></html>'};
  }

  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Design comparison</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #eeede9; background: #171716; font: 14px/1.35 system-ui, sans-serif; }
    main { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 8px; }
    section { min-width: 0; }
    h1 { margin: 0; padding: 8px 8px 0; font-size: 16px; }
    h2 { margin: 0 0 6px; font-size: 13px; font-weight: 550; }
    img { display: block; width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <main>
    <section><h2>Approved reference</h2><img alt="${title} approved design" src="data:image/png;base64,${reference.toString('base64')}"></section>
    <section><h2>Local implementation</h2><img alt="${title} desktop capture" src="data:image/jpeg;base64,${capture.toString('base64')}"></section>
  </main>
</body>
</html>`;
  return {status: 200, headers, body};
}
