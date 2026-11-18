import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMasterPreviewServer} from '../scripts/preview-master.mjs';

function read(port,host,url,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{Host:`${host}:${port}`}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
  });req.on('error',reject);req.end();
 });
}
test('combined local preview preserves complete HTML and isolates public hosts',async()=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'nortivo-master-review-test-'));
 // Explicit synthetic fixtures and no production credentials/provider access.
 const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const preview=await createMasterPreviewServer({fixtures:true,port,dataDir});
 try{
  await new Promise(resolve=>preview.server.listen(port,'127.0.0.1',resolve));
  const security=await read(port,'security.localhost','/en/');
  assert.equal(security.status,200);assert.equal(Number(security.headers['content-length']),security.body.byteLength);
  assert.match(security.body.toString(),/<footer[\s\S]*?Nortivo[\s\S]*?<\/footer>/);assert.match(security.body.toString(),/<\/html>\s*$/);
  assert.match(security.body.toString(),new RegExp(`http://nortivo.localhost:${port}/en/`));
  const invest=await read(port,'invest.localhost','/nb/');assert.equal(invest.status,200);assert.match(invest.body.toString().replace(/<[^>]+>/g,' '),/Analyser\s+markedet/i);assert.doesNotMatch(invest.body.toString(),/product-client\.js/);
  const canonical=await read(port,'korvnt.localhost','/nb/');assert.equal(canonical.status,200);assert.match(canonical.body.toString(),/data-workflow-business="korvnt"/);
  assert.match(canonical.body.toString(),new RegExp(`rel="canonical" href="http://korvnt.localhost:${port}/nb/"`));
  const parent=await read(port,'nortivo.localhost','/nb/security/');assert.equal(parent.status,200);assert.match(parent.body.toString(),/datterselskap/);assert.notEqual(parent.body.toString(),canonical.body.toString());
  const asset=await read(port,'korvnt.localhost','/assets/brand/korvnt-aperture.png');assert.equal(asset.status,200);assert.ok(asset.body.length>100000);
  const session=await read(port,'korvnt.localhost','/.netlify/functions/korvnt-service?action=workflow-session');assert.equal(session.status,200);assert.match(session.headers['set-cookie'].join(';'),/^korvnt_workflow_local=/);assert.doesNotMatch(session.headers['set-cookie'].join(';'),/Domain=/i);
  assert.equal(JSON.parse(session.body).business,'korvnt');
  for(const url of ['/en/admin/','/.netlify/functions/terminal?action=session','/.local/master-preview/fixtures-v1/credentials.private.json'])assert.ok((await read(port,'security.localhost',url)).status>=400);
  assert.equal((await read(port,'untrusted.example','/en/')).status,403);
 }finally{
  await new Promise(resolve=>preview.server.close(resolve));await rm(dataDir,{recursive:true,force:true});
 }
});
