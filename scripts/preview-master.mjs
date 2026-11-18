// Explicit, isolated local review. No production secrets, provider requests or deployment commands.
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {previewResponse} from './serve.mjs';
import {createMasterFixtures} from './master-preview-fixtures.mjs';
import {masterComparisonResponse} from './master-review-comparison.mjs';
import {createTerminalHandler} from '../netlify/functions/terminal.mjs';
import {createWorkflowInbox} from '../netlify/functions/workflow-inbox.mjs';
import {createKorvntService} from '../netlify/functions/korvnt-service.mjs';
import {createKorvntInbox} from '../netlify/functions/korvnt-inbox.mjs';
import {createAdminSecurity,adminJson,adminError} from '../netlify/security-core/admin.mjs';
import {securityHeaders} from '../services/security-core/src/headers.mjs';
import {applicationRoute,applicationHost,REVIEW_HOSTS} from '../netlify/edge-functions/application-routes.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localizeDocument(html,port){
 const origins={company:`http://${REVIEW_HOSTS.company}:${port}`,invest:`http://${REVIEW_HOSTS.invest}:${port}`,security:`http://${REVIEW_HOSTS.korvnt}:${port}`};
 // Only navigation/resource attributes are rewritten. Report facts, metadata and script text remain intact.
 html=html.replace(/\b(href|src|action)=(['"])(https:\/\/(?:www\.)?nortivo\.no|https:\/\/invest\.nortivo\.no|https:\/\/(?:security|korvnt)\.nortivo\.no|https:\/\/(?:www\.)?korvnt\.no)([^'"<>]*)\2/g,(whole,attr,quote,origin,suffix)=>{
  const kind=origin.includes('invest.')?'invest':origin.includes('korvnt')||origin.includes('security.')?'security':'company';return `${attr}=${quote}${origins[kind]}${suffix}${quote}`;
 });
 for(const name of Object.keys(origins))html=html.replace(new RegExp(`<meta\\b(?=[^>]*name=["']nortivo-${name}-origin["'])[^>]*>`,'gi'),'');
 return html.replace(/<head\b[^>]*>/i,tag=>tag+Object.entries(origins).map(([name,value])=>`<meta name="nortivo-${name}-origin" content="${escape(value)}">`).join(''));
}
export async function createMasterPreviewServer({fixtures=false,port=4490,dataDir=path.join(root,'.local/master-preview'),distDir=path.join(root,'dist')}={}){
 if(!fixtures)throw Error('The combined preview requires explicit local fixtures.');
 if(['true'].includes(process.env.NETLIFY)||process.env.CONTEXT==='production'||process.env.NODE_ENV==='production')throw Error('Local review is prohibited in a production runtime.');
 if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Use a local review port between 1024 and 65535.');
 const local=await createMasterFixtures({dataDir}),handlers=new Map();
 const allowedHosts=new Set([...Object.values(REVIEW_HOSTS),'localhost','127.0.0.1']);
 const baseHeaders={...securityHeaders({https:false,api:false}),'Cache-Control':'private, no-store','X-Nortivo-Review':'isolated-local-fixtures','X-Robots-Tag':'noindex, nofollow'};
 const blockedFetch=async()=>{throw Error('External providers are disabled in the local review.');};
 function context(origin){
  if(handlers.has(origin))return handlers.get(origin);
  const currentHost=new URL(origin).hostname;
  const korvntOrigin=[REVIEW_HOSTS.korvnt,REVIEW_HOSTS.security].includes(currentHost)?origin:`http://${REVIEW_HOSTS.korvnt}:${port}`;
  const env={...local.env,URL:origin,TERMINAL_ORIGIN:origin,KORVNT_ORIGIN:korvntOrigin};
  const admin=createAdminSecurity({store:local.store,env,auditSink:local.auditSink});
  const value={admin,terminal:createTerminalHandler({store:local.store,env,fetcher:blockedFetch,testEmail:local.captureEmail,auditSink:local.auditSink}),inbox:createWorkflowInbox({store:local.store,env,auditSink:local.auditSink}),korvnt:createKorvntService({store:local.store,env,fetcher:blockedFetch,auditSink:local.auditSink}),korvntInbox:createKorvntInbox({store:local.store,env,auditSink:local.auditSink})};
  handlers.set(origin,value);return value;
 }
 async function overview(event,ctx){
  await ctx.admin.requireAdmin(event,{routeId:'local-review-ticket-overview',mutation:event.httpMethod!=='GET'});
  if(event.httpMethod!=='GET')return adminJson(404,{error:'No legacy email ticket is connected to this local review.'});
  if(event.queryStringParameters.view==='operations')return adminJson(200,{operations:{checkedAt:new Date().toISOString(),configurationOnly:true,productEnabled:true,purchasesOpen:false,purchasesStatus:'unavailable',services:[]}});
  return adminJson(200,{tickets:[],page:{limit:200,offset:0,hasMore:false,nextOffset:null}});
 }
 const server=http.createServer(async(request,response)=>{
  try{
   const host=String(request.headers.host||'');let authority;try{authority=new URL('http://'+host);}catch{throw Error('Invalid host.');}
   if(!allowedHosts.has(authority.hostname)||authority.port!==String(port)||authority.username||authority.password){response.writeHead(403,baseHeaders);response.end();return;}
   const origin=authority.origin,url=new URL(request.url,origin);
   if(url.origin!==origin){response.writeHead(403,baseHeaders);response.end();return;}
   const surface=applicationHost(url.hostname,{preview:true});
   if(surface==='company'&&request.method==='GET'&&url.pathname.startsWith('/_review/compare/')){
    const comparison=await masterComparisonResponse(url.pathname,root);
    if(comparison){response.writeHead(comparison.status,{...baseHeaders,...comparison.headers});response.end(comparison.body);return;}
   }
   const route=applicationRoute(url,{preview:true,language:/^\/nb(?:\/|$)/.test(url.pathname)?'nb':'en',method:request.method});
   if(route?.kind==='deny'){response.writeHead(route.status,baseHeaders);response.end();return;}
   if(route?.kind==='redirect'){response.writeHead(route.status,{...baseHeaders,Location:route.location});response.end();return;}
   // Company account links always cross to the independent local investment origin.
   if(surface==='company'&&/^\/(en|nb)\/(terminal|portfolio|pricing)(?:\/|$)/.test(url.pathname)&&['GET','HEAD'].includes(request.method)){
    const destination=new URL(url);destination.hostname=REVIEW_HOSTS.invest;response.writeHead(307,{...baseHeaders,Location:destination.href});response.end();return;
   }
   if(url.pathname.startsWith('/.netlify/functions/')){
    if(!['company','invest','korvnt','security'].includes(surface)){response.writeHead(404,baseHeaders);response.end();return;}
    const chunks=[];let length=0;for await(const chunk of request){length+=chunk.length;if(length>24000){response.writeHead(413,{...baseHeaders,Connection:'close'});response.end(JSON.stringify({error:'The local request is too large.'}));return;}chunks.push(chunk);}
    const event={httpMethod:request.method,path:url.pathname,rawUrl:url.href,headers:{...request.headers,'x-nf-client-connection-ip':request.socket.remoteAddress||'local'},queryStringParameters:Object.fromEntries(url.searchParams),body:Buffer.concat(chunks).toString('utf8'),isBase64Encoded:false};
    const name=url.pathname.slice('/.netlify/functions/'.length),ctx=context(origin);let result;
    if(['korvnt','security'].includes(surface)&&name==='korvnt-service')result=await ctx.korvnt(event);
    else if(['korvnt','security'].includes(surface))result=adminJson(404,{error:'This service is not available on this website.'});
    else if(surface==='company'&&name==='korvnt-inbox')result=await ctx.korvntInbox(event);
    else if(name==='terminal')result=await ctx.terminal(event);
    else if(surface==='company'&&name==='admin-login')result=await ctx.admin.login(event);
    else if(surface==='company'&&name==='admin-session')result=await ctx.admin.session(event);
    else if(surface==='company'&&name==='admin-logout')result=await ctx.admin.logout(event);
    else if(surface==='company'&&name==='workflow-inbox')result=await ctx.inbox(event);
    else if(surface==='company'&&['admin-tickets','reply-ticket'].includes(name))result=await overview(event,ctx);
    else if(['tickets','ticket-access'].includes(name))result=adminJson(503,{error:'Email tickets are disconnected in local review. Use the local conversation workspace; no email has been sent.',code:'LOCAL_EMAIL_DISABLED'});
    else result=adminJson(404,{error:'This operation is not part of the isolated local review.'});
    response.writeHead(result.statusCode,{...baseHeaders,...result.headers});response.end(result.isBase64Encoded?Buffer.from(result.body,'base64'):result.body);return;
   }
   const pathname=route?.kind==='rewrite'?route.path:url.pathname;
   const staticResult=await previewResponse({url:pathname+url.search,method:request.method,headers:request.headers},distDir);
   let body=staticResult.body;
   if(staticResult.status===200&&String(staticResult.headers?.['Content-Type']||staticResult.headers?.['content-type']||'').includes('text/html'))body=localizeDocument(Buffer.isBuffer(body)?body.toString('utf8'):String(body),port);
   const staticHeaders={...baseHeaders,...staticResult.headers,'Cache-Control':'private, no-store'};
   // Origin substitution changes HTML byte length; retaining the source length truncates the footer.
   if(request.method!=='HEAD')staticHeaders['Content-Length']=String(Buffer.byteLength(body));
   response.writeHead(staticResult.status,staticHeaders);response.end(request.method==='HEAD'?'':body);
  }catch(error){const safe=adminError(error);response.writeHead(safe.statusCode,{...baseHeaders,...safe.headers});response.end(safe.body);}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxRequestsPerSocket=100;
 server.once('close',()=>local.dispose());
 return {server,port,origins:Object.fromEntries(Object.entries(REVIEW_HOSTS).map(([name,host])=>[name,`http://${host}:${port}`])),credentialsFile:local.credentialsFile,dispose:()=>server.listening?server.close():local.dispose()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const index=process.argv.indexOf('--port'),port=index<0?4490:Number(process.argv[index+1]);
 const review=await createMasterPreviewServer({fixtures:process.argv.includes('--fixtures'),port});
 review.server.on('error',()=>{console.error('The local master preview could not start.');process.exitCode=1;});
 review.server.listen(port,'127.0.0.1',async()=>{
  await mkdir(path.join(root,'.local/master-preview'),{recursive:true});
  await writeFile(path.join(root,'.local/master-preview/preview-state.json'),JSON.stringify({startedAt:new Date().toISOString(),localOnly:true,productionChanged:false,origins:review.origins,credentialsFile:review.credentialsFile},null,2)+'\n');
  console.log('Isolated Nortivo review: '+Object.values(review.origins).join(' · '));
  console.log('Private synthetic sign-in details: '+review.credentialsFile);
 });
 process.stdin.on('data',value=>{if(String(value).trim()==='stop')review.dispose();});
}
