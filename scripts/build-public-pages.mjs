import path from 'node:path';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getPlanCatalog } from '../netlify/product/plans.mjs';
import { investPage } from './public-pages/invest.mjs';
import { securityPage, parentSecurityPage } from './public-pages/security.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const preview = path.join(root,'services/security-core/preview');
async function output(file, content) {
  await mkdir(path.dirname(file), {recursive:true});
  await writeFile(file, content, 'utf8');
}
export async function buildPublicPages(distDir = path.join(root,'dist')) {
  const catalog = getPlanCatalog();
  for (const lang of ['en','nb']) {
    for (const page of ['home','bot','engine','support','request']) {
      const route = page === 'home' ? '' : ['support','request'].includes(page) ? page : path.join('systems',page);
      const html = investPage(lang,page,catalog);
      await output(path.join(distDir,'invest',lang,route,'index.html'), html);
      if (lang === 'en' && page === 'home') await output(path.join(distDir,'invest/index.html'), html);
    }
    const html = securityPage(lang), parent=parentSecurityPage(lang);
    await output(path.join(distDir,'korvnt',lang,'index.html'),html);
    await output(path.join(distDir,lang,'security/index.html'), parent);
    if (lang === 'en') {
      await output(path.join(distDir,'security/index.html'), parent);
      await output(path.join(distDir,'korvnt/index.html'),html);
    }
  }
  const target = path.join(distDir,'assets/security-core');
  await mkdir(target,{recursive:true});
  for (const file of ['styles.css','type.css','preview.js','enquiry.js','core-symbol.svg']) {
    await copyFile(path.join(preview,file),path.join(target,file));
  }
}
// Keep the isolated KORVNT reference server self-contained, with the same
// reviewed text, report builder and navigation as the dedicated website.
export async function buildStandalonePreview(distDir = path.join(root,'dist')) {
  for (const [name,lang] of [['index','en'],['security','en'],['report','en'],['security-nb','nb']]) {
    const html = securityPage(lang,true);
    await output(path.join(preview,name+'.html'),name==='report'?html.replace('<body class="ks-site"','<body data-open-report class="ks-site"'):html);
  }
  await copyFile(path.join(distDir,'assets/brand/nortivo-approved.png'),path.join(preview,'nortivo-approved.png'));
  await copyFile(path.join(distDir,'assets/brand/korvnt-aperture.png'),path.join(preview,'korvnt-aperture.png'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await buildPublicPages();
  await buildStandalonePreview();
  console.log('Built bilingual Invest and KORVNT public pages and the local KORVNT reference.');
}
