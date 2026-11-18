// Optional full-browser smoke. Supply an installed Playwright module and Chromium executable.
// Only this loopback server is allowed. SQLite, credentials, and encryption keys are ephemeral.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {createCoreAdminFixture} from './helpers/core-admin.mjs';
import {createTerminalHandler} from '../netlify/functions/terminal.mjs';
import {createWorkflowInbox} from '../netlify/functions/workflow-inbox.mjs';
import {createAdminSecurity} from '../netlify/security-core/admin.mjs';
import {securityHeaders} from '../services/security-core/src/index.mjs';

const {chromium}=await import(process.env.WORKFLOW_PLAYWRIGHT_MODULE?pathToFileURL(process.env.WORKFLOW_PLAYWRIGHT_MODULE):'playwright');
const fx=await createCoreAdminFixture(),dist=fileURLToPath(new URL('../dist/',import.meta.url));
const noExternal=async()=>{throw Error('External providers are disabled.');};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.webp':'image/webp'};
let terminal,inbox,admin,origin,browser;
let dropChat=true;
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin);
    if(url.origin!==origin||req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}
    if(url.pathname.startsWith('/.netlify/functions/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const evt={httpMethod:req.method,headers:{...req.headers,'x-nf-client-connection-ip':'browser-fixture'},rawUrl:url.href,queryStringParameters:Object.fromEntries(url.searchParams),body:Buffer.concat(chunks).toString()};
      const name=url.pathname.split('/').at(-1);
      let result;
      if (name==='terminal')result=await terminal(evt);
      else if (name==='workflow-inbox')result=await inbox(evt);
      else if(name==='admin-session')result=await admin.session(evt);
      else if(name==='admin-tickets'){await admin.requireAdmin(evt,{routeId:'browser-fixture'});result={statusCode:200,headers:{'Content-Type':'application/json'},body:'{"tickets":[]}'};}
      else {res.writeHead(404);res.end();return;}
      if(dropChat&&url.searchParams.get('action')==='workflow-chat'&&req.method==='POST'&&JSON.parse(evt.body).op==='send'&&result.statusCode===200){
        dropChat=false;res.writeHead(503,{'Content-Type':'application/json'});res.end('{"code":"UNAVAILABLE"}');return;
      }
      res.writeHead(result.statusCode,result.headers);res.end(result.body);return;
    }
    let name=url.pathname;
    if(name==='/admin/')name='/admin/index.html';
    else if(name==='/en/'||name==='/nb/'||name.includes('/systems/')||name.includes('/support/'))name='/invest'+name+'index.html';
    const file=path.resolve(dist,'.'+name);
    if(!file.startsWith(dist)){res.writeHead(404);res.end();return;}
    const asset=await readFile(file);
    res.writeHead(200,{...securityHeaders({api:false}),'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(asset);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
origin='http://127.0.0.1:'+server.address().port;
const env={...fx.env,URL:origin,TERMINAL_ORIGIN:origin,TERMINAL_LOCAL:'true',NETLIFY_DEV:'true',CONTEXT:'dev',PRODUCT_ENABLED:'true',WORKFLOW_VAULT_KEYS:JSON.stringify({local:randomBytes(32).toString('base64')}),WORKFLOW_VAULT_CURRENT:'local'};
const config={store:fx.store,env,fetcher:noExternal,auditSink:()=>{}};
terminal=createTerminalHandler(config);inbox=createWorkflowInbox(config);admin=createAdminSecurity(config);
try{
  browser=await chromium.launch({headless:true,...(process.env.WORKFLOW_BROWSER_EXE?{executablePath:process.env.WORKFLOW_BROWSER_EXE}:{})});
  const context=await browser.newContext({viewport:{width:1365,height:900},reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();const issues=[];
  page.on('pageerror',err=>issues.push(err.name));page.setDefaultTimeout(7000);
  await page.goto(origin+'/en/');
  await page.locator('.nwf-launcher').click();
  const panel=page.locator('.nwf-chat-dialog[open]');
  const bounds=await panel.boundingBox();assert.ok(bounds.width>=400 && bounds.width<=440);assert.ok(bounds.height<=580);
  await panel.getByLabel('Your message').fill('Synthetic browser question');
  await panel.getByRole('button',{name:'Send message'}).click();
  await panel.getByRole('button',{name:'Retry same message'}).click();
  await panel.getByText('Synthetic browser question',{exact:true}).waitFor();
  assert.equal(await panel.locator('.nwf-customer').count(),1);
  await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  assert.ok(await page.locator('.nwf-launcher').evaluate(e=>e===document.activeElement));
  await page.reload();await page.locator('[data-nortivo-chat]').scrollIntoViewIfNeeded();
  await page.locator('[data-nortivo-chat]').getByText('Synthetic browser question',{exact:true}).waitFor();
  await page.locator('[data-nortivo-service="bot"]').click();const intake=page.locator('[data-nortivo-intake]');
  assert.equal(await intake.locator('[name=kind]').inputValue(),'bot');
  await intake.locator('[name=goal]').fill('A local, synthetic test goal for browser review.');
  await intake.locator('[name=existing]').fill('Undecided');await intake.getByRole('button',{name:'Continue'}).click();
  await intake.locator('[name=market]').fill('Synthetic crypto market');await intake.locator('[name=integration]').fill('Undecided');await intake.locator('[name=safeguards]').fill('Paper mode only');
  await page.reload();await intake.locator('[name=market]').waitFor();assert.equal(await intake.locator('[name=market]').inputValue(),'Synthetic crypto market');
  await intake.locator('[name=execution]').selectOption('paper');await intake.getByRole('button',{name:'Continue'}).click();
  for(const [key,value] of Object.entries({name:'Local fixture',email:'browser@example.invalid',deliverable:'Test scope',budget:'Undecided',timeframe:'Undecided'}))await intake.locator('[name='+key+']').fill(value);
  await intake.getByRole('button',{name:'Continue'}).click();await intake.getByRole('button',{name:'Edit',exact:true}).first().click();
  assert.equal(await intake.locator('[name=kind]').inputValue(),'bot');
  for(let i=0;i<3;i++)await intake.getByRole('button',{name:'Continue'}).click();
  await intake.locator('[name=confirm]').check();await intake.getByRole('button',{name:'Submit project request'}).click();
  await intake.getByRole('heading',{name:'Project request received'}).waitFor();const ref=await intake.locator('.nwf-ref').textContent();
  const staff=await browser.newContext();await staff.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await staff.addCookies([{name:'__Host-nortivo_admin_core',value:fx.cookie.split('=')[1],url:'https://127.0.0.1/',secure:true,httpOnly:true,sameSite:'Strict'}]);
  const operatorPage=await staff.newPage();operatorPage.setDefaultTimeout(7000);operatorPage.on('pageerror',err=>issues.push(err.name));
  await operatorPage.goto(origin+'/admin/');await operatorPage.locator('#workflow-choice').click();
  const queue=operatorPage.locator('#workflow-app');await queue.locator('.nwf-row').first().click();
  await queue.getByLabel('Reply to customer').fill('Synthetic operator reply');await queue.getByRole('button',{name:'Send reply'}).click();
  await queue.getByText('Synthetic operator reply',{exact:true}).waitFor();
  await queue.getByRole('button',{name:'Project requests',exact:true}).click();await queue.locator('.nwf-row').filter({hasText:ref}).click();
  await queue.getByLabel('Request status').selectOption('needs_information');await queue.getByLabel('Update visible to the customer').fill('Please clarify requirements for paper tests.');
  await queue.getByRole('button',{name:'Save follow-up'}).click();await queue.getByText(/Please clarify requirements for paper tests/).first().waitFor();
  await intake.getByRole('button',{name:'Track this request'}).click();await intake.getByRole('button',{name:'Check status'}).click();await intake.getByText('More information needed',{exact:true}).waitFor();
  await intake.getByRole('button',{name:'Open linked conversation'}).click();await panel.getByText('Synthetic operator reply',{exact:true}).waitFor();
  for(const width of [768,390,320]){
    await page.setViewportSize({width,height:720});const rect=await panel.boundingBox();
    assert.ok(rect.x>=0&&rect.width<=width&&rect.y>=0&&rect.height<=720);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.keyboard.press('Escape');
  const phone=await browser.newContext({viewport:{width:390,height:844}});await phone.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const nb=await phone.newPage();await nb.goto(origin+'/nb/systems/engine/');
  await nb.locator('[name=goal]').fill('Lokal test av handelsmotor');assert.equal(await nb.locator('[name=kind]').inputValue(),'engine');
  await nb.locator('[name=existing]').fill('Uavklart');await nb.getByRole('button',{name:'Fortsett'}).click();
  await nb.locator('[name=components]').waitFor();assert.equal(await nb.locator('[name=market]').count(),0);
  assert.deepEqual(issues,[]);
  console.log('PASS browser: real guest send/lost acknowledgement/retry/reload, keyboard focus, four-stage bot draft/edit/submit, protected operator reply and follow-up, secure tracking, responsive 1365/768/390/320 and Norwegian engine fields. No external requests allowed.');
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));fx.close();
}
