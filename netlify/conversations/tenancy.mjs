import {fail,header,isLocalRuntime,requireSameOrigin,sessionSecret} from '../terminal/security.mjs';

const canonical='https://korvnt.no';
const localCustomerHosts=new Set(['korvnt.localhost','security.localhost']);
const companyHosts=new Set(['https://nortivo.no','https://www.nortivo.no']);
const localCompanyHosts=new Set(['localhost','127.0.0.1','[::1]','nortivo.localhost']);
const denied=()=>fail('INVALID_ORIGIN','Use this service from its own website.',403);

export function workflowOrigin(event,env,business,operator,bootstrap) {
  let url;
  try { url=new URL(event.rawUrl); } catch { denied(); }
  if (url.username || url.password) denied();
  const local=isLocalRuntime(env) && env.NETLIFY_DEV==='true';
  if(operator) {
    if(!companyHosts.has(url.origin) && !(local&&url.protocol==='http:'&&localCompanyHosts.has(url.hostname))) denied();
    return requireSameOrigin(event,env,true);
  }
  if(business==='nortivo') return requireSameOrigin(event,env,!bootstrap);
  if(local) {
    if(url.protocol!=='http:' || !localCustomerHosts.has(url.hostname) || env.KORVNT_ORIGIN!==url.origin) denied();
  } else {
    if(url.origin!==canonical || (env.KORVNT_ORIGIN && env.KORVNT_ORIGIN!==canonical)) denied();
    if(env.KORVNT_SITE_READY!=='true') fail('UNAVAILABLE','This service is awaiting activation.',503);
  }
  const origin=header(event,'origin');
  if(header(event,'sec-fetch-site')==='cross-site' || ((!bootstrap || origin) && origin!==url.origin)) denied();
}

export function businessSecret(env,business) {
  if(business==='nortivo') return sessionSecret(env);
  const key=env.KORVNT_SESSION_SECRET;
  if(typeof key!=='string' || Buffer.byteLength(key)<32 || Buffer.byteLength(key)>1024 || key===env.TERMINAL_SESSION_SECRET)
    fail('UNAVAILABLE','The service is temporarily unavailable.',503);
  return key;
}

export function canOperateKorvnt(env,subjectId) {
  return typeof subjectId==='string' && String(env.KORVNT_OPERATOR_USER_IDS||'').split(',').some(id=>id.trim()===subjectId);
}
