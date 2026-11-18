// The public and operator hosts use the same source tree with separate allowlists.
export const APPLICATION_HOSTS=Object.freeze({company:'nortivo.no',invest:'invest.nortivo.no',korvnt:'korvnt.no',korvntWww:'www.korvnt.no',security:'security.nortivo.no',securityAlias:'korvnt.nortivo.no'});
export const REVIEW_HOSTS=Object.freeze({company:'nortivo.localhost',invest:'invest.localhost',security:'security.localhost',korvnt:'korvnt.localhost'});
const supported=value=>value==='en'||value==='nb';
const publicAsset=/^\/(?:favicon\.png|assets\/security-core\/(?:styles\.css|type\.css|core-symbol\.svg|preview\.js|enquiry\.js)|assets\/brand\/(?:korvnt-aperture\.png|nortivo-approved\.png)|assets\/(?:workflow-chat\.js|workflow-client\.js|workflows\.css)|assets\/fonts\/[A-Za-z0-9_-]+\.(?:woff2|ttf))$/;
const documents=new Set(['/','/index.html','/en','/en/','/en/index.html','/nb','/nb/','/nb/index.html']);
const introduction=/^\/(?:en\/|nb\/)?security(?:\/index\.html|\/)?$/;
const endpoint='/.netlify/functions/korvnt-service';
const staffEndpoint='/.netlify/functions/korvnt-inbox';
export function applicationHost(hostname,{preview=false}={}){
 const map=preview?REVIEW_HOSTS:APPLICATION_HOSTS;
 if(hostname===map.company||(!preview&&hostname==='www.nortivo.no')||(preview&&['localhost','127.0.0.1','[::1]'].includes(hostname)))return 'company';
 return Object.keys(map).find(name=>name!=='company'&&hostname===map[name])||null;
}
export function isKorvntHostname(hostname){
 return ['korvnt.no','www.korvnt.no','korvnt.nortivo.no','security.nortivo.no','korvnt.localhost','security.localhost'].includes(hostname.toLowerCase().replace(/\.$/,''));
}
export function applicationRoute(input,{preview=false,korvntReady=false,korvntAliasReady=false,language='en',method='GET'}={}){
 const url=input instanceof URL?input:new URL(input),surface=applicationHost(url.hostname,{preview});
 const deny=(status=404)=>({kind:'deny',status,surface});
 if(!surface)return isKorvntHostname(url.hostname)?deny():null;
 const locale=/^\/(en|nb)(?:\/|$)/.exec(url.pathname)?.[1]||(supported(language)?language:'en');
 let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{return deny(400);}
 if(/[\\\u0000-\u001f]/.test(decoded))return deny(400);
 const read=method==='GET'||method==='HEAD';
 if(isKorvntHostname(url.hostname)){
  const alias=!preview&&surface!=='korvnt';
  const home=documents.has(decoded)||introduction.test(decoded),asset=publicAsset.test(decoded);
  if(!preview&&(url.protocol!=='https:'||url.port))return deny();
  if(decoded===endpoint && !alias && ['GET','POST'].includes(method)){
   return preview||korvntReady?{kind:'pass',surface}:deny(503);
  }
  if(!read||(!home&&!asset))return deny();
  if(!preview && (!korvntReady || (alias && !korvntAliasReady)))return deny(503);
  if(alias){
   const target=new URL(home?'/'+locale+'/':decoded,'https://korvnt.no');
   if(supported(url.searchParams.get('lang')))target.searchParams.set('lang',url.searchParams.get('lang'));
   // An explicit fragment prevents the browser from carrying a private fragment across hosts.
   target.hash='top';
   return {kind:'redirect',status:308,location:target.href,surface};
  }
  if(asset)return {kind:'pass',surface};
  return {kind:'rewrite',path:'/korvnt/'+locale+'/index.html',surface,locale};
 }
 if(decoded===endpoint || (decoded===staffEndpoint && surface!=='company') || /^\/korvnt(?:\/|$)/i.test(decoded))return deny();
 if(surface!=='invest'||!read)return {kind:'pass',surface};
 if(documents.has(decoded))return {kind:'rewrite',path:'/invest/'+locale+'/index.html',surface,locale};
 const service=/^\/(en|nb)\/(support|request|systems\/(?:bot|engine))(?:\/index\.html|\/)?$/.exec(decoded);
 if(service)return {kind:'rewrite',path:'/invest/'+service[1]+'/'+service[2]+'/index.html',surface,locale:service[1]};
 return {kind:'pass',surface};
}
