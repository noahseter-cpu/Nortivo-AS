import { createSupabaseStore } from '../terminal/store.mjs';
import { snapshot,createInitialState } from '../terminal/engine.mjs';
import crypto from 'node:crypto';
import { TerminalError,fail,header,sessionSecret,token,sha256,csrfToken,equalToken,cookieToken,cookie,requireSameOrigin,requestOrigin,parseBody,clientIdentifier,response,isLocalRuntime,GUEST_TTL,SESSION_TTL,GUEST_SESSION_TTL,workspaceSession,workspaceRateLimiter,authorizeWorkspaceRecord,authorizeWorkspaceAdmin,secureWorkspaceResponse } from '../terminal/security.mjs';
import { ensureAccount,handlePublicAuth,handleAccount,emailReady } from './auth.mjs';
import { deriveEntitlements,requireEntitlement } from './entitlements.mjs';
import { isOwnerContext } from './owner.mjs';
import { handleMfa,requireStepUp,mfaConfigured } from './mfa.mjs';
import { getPlanCatalog } from './plans.mjs';
import { handleBilling,billingReady,stripeMode } from './billing.mjs';
import { getBrokerStatus } from './broker.mjs';
const PUBLIC_AUTH=new Set(['signup','login','product-forgot','product-reset','product-verify']);
const GETS=new Set(['session','product','product-plans','product-watchlist','product-reminders','product-sessions','product-portfolio','product-catalog','product-quotes','product-news','product-calendar','product-ai-usage','product-broker-status','product-broker-orders','product-broker-callback','product-strategy','product-health','integrations','market','news','calendar','export','product-portfolio-export']);
const POSTS=new Set(['signup','login','logout','guest','product-forgot','product-reset','product-verify','product-resend','product-change-password','product-revoke','product-select-plan','product-deletion-request','product-mfa-enroll','product-mfa-confirm','product-mfa-stepup','product-mfa-disable','product-checkout','product-portal','product-change-preview','product-change','product-cancel','product-resume','product-refresh','product-portfolio','product-watchlist','product-reminders','product-ai','product-broker-connect','product-broker-sync','product-broker-disconnect','product-broker-consent','product-broker-order','product-broker-cancel','product-broker-stop','product-strategy','product-backtest','product-scan','product-health-probe','command','broker']);
const ACCOUNT=new Set(['product-resend','product-change-password','product-sessions','product-revoke','product-select-plan','product-deletion-request']);
const BILLING=new Set(['product-checkout','product-portal','product-change-preview','product-change','product-cancel','product-resume','product-refresh']);
const ALIASES={'product-pricing':'product-plans','product-auth-resend':'product-resend','product-auth-recover':'product-forgot','product-auth-reset':'product-reset','product-auth-verify':'product-verify','product-auth-password':'product-change-password','product-auth-sessions':'product-sessions','product-auth-session-revoke':'product-revoke'};
export function createProductHandler({store:providedStore,env,now,fetcher,testEmail,stripe,legacyHandler}) {
 let legacyStore=providedStore;
 const runProduct=async event=>{try{
  const method=String(event.httpMethod||event.method||'GET').toUpperCase(),params=event.queryStringParameters||Object.fromEntries(new URL(event.rawUrl).searchParams);const action=ALIASES[params.action]||params.action||'session';
  if(!['GET','POST'].includes(method)||!(method==='GET'?GETS:POSTS).has(action))fail('NOT_FOUND','Workspace action not found.',404);
  if(action==='product-broker-callback')requestOrigin(event,env);else requireSameOrigin(event,env,method==='POST');const origin=new URL(event.rawUrl).origin,secret=sessionSecret(env),time=now();legacyStore||=createSupabaseStore(env,fetcher);
  const store=legacyStore.product,ip=clientIdentifier(event,secret);if(!store)fail('STORAGE_MIGRATION_REQUIRED','The product database migration is required.',503);
  const rate=workspaceRateLimiter(legacyStore,secret,time);
  await rate('product-request',ip,600,300000);const body=method==='POST'?parseBody(event):null,raw=cookieToken(event),sessionHash=raw?sha256(raw):null,user=raw?await workspaceSession(event,legacyStore,time):null;
  if(action==='logout'){
   if(!raw)fail('AUTH_REQUIRED','Sign in to your account.',401);
   if(!equalToken(header(event,'x-csrf-token'),csrfToken(raw,secret)))fail('CSRF_FAILED','Refresh your session and try again.',403);
   await legacyStore.deleteSession(sessionHash);
   return response(200,{ok:true},{'Set-Cookie':cookie('',0,isLocalRuntime(env))});
  }
  let oauthCookie='';
  const ctx={store,legacyStore,user,sessionHash,env,now:time,clock:now,fetcher,origin,ip,rate,testEmail,stripe,method,event,requestHeaders:event.headers||{},setOAuthCookie(value){if(typeof value!=='string'||value.length>1000||/[\r\n]/.test(value))throw new Error('Invalid OAuth cookie envelope.');oauthCookie=value;}};
  if(['product-health','product-health-probe'].includes(action)){if(!user)fail('AUTH_REQUIRED','Sign in to your account.',401);await authorizeWorkspaceAdmin(user,env,store,sessionHash,time);}
  function integrationResponse(result){const extra=oauthCookie?{'Set-Cookie':oauthCookie}:{};return result?.statusCode?{...result,headers:{...extra,...result.headers}}:response(200,result,extra);}
  // These promises live for one request only. Every new request still reads its
  // session and account afresh; no owner/MFA/risk/entitlement state is cached globally.
  const accountReads=new Map(),brokerReads=new Map(),readinessReads=new Map();
  function accountFor(actor){if(!accountReads.has(actor.id))accountReads.set(actor.id,ensureAccount({...ctx,user:actor}).then(account=>{authorizeWorkspaceRecord(actor,account.ownerId,time);return account;}));return accountReads.get(actor.id);}
  function brokerFor(target){const key=target.user.id;if(!brokerReads.has(key))brokerReads.set(key,getBrokerStatus(target));return brokerReads.get(key);}
  if(user?.kind==='user'){ctx.account=(await accountFor(user)).value;ctx.entitlements=deriveEntitlements(ctx.account,time);}
  const integrationModule=await import('./providers.mjs');ctx.providers=integrationModule.getProviders?await integrationModule.getProviders(ctx):await integrationModule.createProductProviders?.(env,fetcher,store);
  async function readinessFor(target){const key=target.account||target.user||null;if(!readinessReads.has(key))readinessReads.set(key,Promise.all([integrationModule.getIntegrationReadiness(target,target.user?.id?{brokerStatus:brokerFor(target)}:{}),store.get('provider_health','email')]).then(([state,mail])=>({...state,email:{configured:emailReady(env),permissionsReady:emailReady(env),reachable:mail?.value.reachable===true?true:null,freshness:mail?.value.reachable===true?'current':'unavailable',reason:emailReady(env)?'Delivery awaits verification.':'Email delivery is not configured.'}})));target.readiness=await readinessReads.get(key);return target.readiness;}
  const capabilities={productEnabled:true,signupEnabled:emailReady(env)||Boolean(testEmail&&env.PRODUCT_TEST_MODE==='true'),guestEnabled:true,demoReadOnly:true,admin:isOwnerContext(ctx)||Boolean(user?.kind==='user'&&(env.PRODUCT_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).includes(user.id)),emailVerification:emailReady(env),passwordRecovery:emailReady(env),mfa:mfaConfigured(env)};
  if(action==='product-plans'){await readinessFor(ctx);const catalog=getPlanCatalog();return response(200,{...catalog,ready:billingReady(ctx,'portfolio').ready,availability:{portfolio:billingReady(ctx,'portfolio'),pro:billingReady(ctx,'pro')},readiness:ctx.readiness,capabilities});}
  if(method==='POST'&&user&&!equalToken(header(event,'x-csrf-token'),csrfToken(raw,secret)))fail('CSRF_FAILED','The security token expired. Refresh and try again.',403);
  async function productSnapshot(actor,sessionToken=raw){
   if(actor.kind==='guest')return {user:{id:actor.id,kind:'guest',emailVerified:false},selectedPlan:null,billing:{status:'none',ready:false},entitlements:{features:[],tier:'none',paidUntil:null,reason:'sample_read_only'},readiness:await readinessFor({...ctx,user:actor,account:undefined,entitlements:undefined}),portfolios:[],broker:{connections:[],liveReleaseEnabled:false},ai:{remainingRequests:0,requestLimit:0,remainingTokens:0,tokenLimit:0,resetAt:null},onboarding:{step:'register',returnPath:'/en/portfolio/'},capabilities,csrfToken:csrfToken(sessionToken,secret)};
   const a=await accountFor(actor),c={...ctx,user:actor,account:a.value};c.entitlements=deriveEntitlements(a.value,time);c.providers=integrationModule.getProviders(c);c.requireFeature=feature=>requireEntitlement(a.value,feature,time);c.requireStepUp=scope=>requireStepUp(c,scope);
   const {listPortfolios}=await import('./portfolio-service.mjs'),readiness=readinessFor(c),[data,portfolioData,mfa]=await Promise.all([integrationModule.getIntegrationSnapshot(c,{readiness,broker:brokerFor(c)}),listPortfolios(c,{fetchPrices:false}),store.get('mfa',actor.id)]),entitlements=deriveEntitlements(a.value,time),portfolios=Array.isArray(portfolioData)?portfolioData:portfolioData.portfolios||[];
   return {user:{id:actor.id,kind:'user',email:actor.email,name:actor.name||'',emailVerified:Boolean(a.value.emailVerified)},selectedPlan:a.value.selectedPlan||null,billing:{mode:stripeMode(env),status:'none',...a.value.billing,ready:billingReady(c,a.value.selectedPlan?.tier||'portfolio').ready},entitlements,readiness:data.readiness,ai:data?.ai||{remainingRequests:0,requestLimit:0,remainingTokens:0,tokenLimit:0,resetAt:null},portfolios,broker:data?.broker||{connections:[],liveReleaseEnabled:false},onboarding:{step:!a.value.emailVerified?'verify':entitlements.tier==='none'?'checkout':portfolios.length?'ready':'first-holding',returnPath:a.value.returnPath||'/en/portfolio/'},capabilities:{...capabilities,admin:isOwnerContext(c)||Boolean((env.PRODUCT_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).includes(actor.id)),mfaEnabled:Boolean(mfa?.value.enabled)},csrfToken:csrfToken(sessionToken,secret)};
  }
  async function issue(actor){const ttl=actor.kind==='guest'?GUEST_SESSION_TTL:SESSION_TTL,newToken=token();await legacyStore.productCreateSession({token_hash:sha256(newToken),user_id:actor.id,created_at:time,expires_at:time+ttl});if(raw)await legacyStore.deleteSession(sessionHash);accountReads.delete(actor.id);const product=await productSnapshot({...actor,session_expires_at:time+ttl},newToken);const record=await legacyStore.getState(actor.id);return response(200,{user:product.user,csrfToken:product.csrfToken,state:snapshot(record.state,{now:time}),revision:record.revision,product,capabilities},{'Set-Cookie':cookie(newToken,ttl,isLocalRuntime(env))});}
  if(PUBLIC_AUTH.has(action)){await rate('product-auth',ip,24,900000);const result=await handlePublicAuth(ctx,action,body,issue);return result?.statusCode?result:response(200,result);}
  if(action==='product-broker-callback'){const {handleBrokerCallback}=await import('./broker.mjs');return integrationResponse(await handleBrokerCallback(ctx,params));}
  if(action==='guest'){await rate('product-guest',ip,12,86400000);if(user)return response(200,{product:await productSnapshot(user),csrfToken:csrfToken(raw,secret),capabilities});const guest={id:crypto.randomUUID(),kind:'guest',created_at:time,expires_at:time+GUEST_TTL};await legacyStore.createUser(guest,createInitialState({now:time}));return issue(guest);}
  if(!user)fail('AUTH_REQUIRED','Sign in to your account.',401);await rate('product-user',user.id,1200,300000);
  if(action==='product')return response(200,await productSnapshot(user));
  if(action==='session'){const old=await legacyHandler(event);if(old.statusCode!==200)return old;const data=JSON.parse(old.body),product=await productSnapshot(user);return response(200,{...data,user:product.user,capabilities,product,storage:{...data.storage,description:user.kind==='guest'?'Read-only sample preview. Sample data does not transfer to an account.':'Private account storage. Account history and export remain available after subscription expiry.'}});}
  if(action==='command'||action==='broker')fail('DEMO_READ_ONLY','Sample replay is read-only. Use your subscribed workspace for account actions.',403);
  if(['market','news','calendar','integrations','export'].includes(action)){if(method!=='GET')fail('METHOD_NOT_ALLOWED','Use GET.',405);if(['market','news','calendar'].includes(action)&&params.mode==='provider')fail('PRODUCT_ACTION_REQUIRED','Use the account market-data controls.',403);return legacyHandler(event);}
  if(user.kind!=='user')fail('ACCOUNT_REQUIRED','Create or sign in to an account.',403);
  ctx.requireFeature=feature=>requireEntitlement(ctx.account,feature,time);ctx.requireStepUp=scope=>requireStepUp(ctx,scope);
  if(ACCOUNT.has(action))return response(200,await handleAccount(ctx,action,body));
  if(action.startsWith('product-mfa-')){await rate('product-mfa',user.id,10,300000);return response(200,await handleMfa(ctx,action,body));}
  if(BILLING.has(action)){await rate('product-billing',user.id,30,300000);await readinessFor(ctx);return response(200,await handleBilling(ctx,action,body));}
  let result;
  if(action.startsWith('product-portfolio')){const {handlePortfolio}=await import('./portfolio-service.mjs');result=await handlePortfolio(ctx,action,body,params);}
  else result=await integrationModule.handleIntegrations(ctx,action,body,params);
  return integrationResponse(result);
 }catch(error){const known=error instanceof TerminalError||(typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{2,60}$/.test(error.code)&&Number.isInteger(error.status)&&error.status>=400&&error.status<500);return response(known?error.status:503,{error:{code:known?error.code:'WORKSPACE_UNAVAILABLE',message:known?error.message:'Your action was not confirmed. Retry with the same request ID.'}},error?.status===429?{'Retry-After':String(error.retryAfter||1)}:{});}};
 return async event=>secureWorkspaceResponse(await runProduct(event),event);
}
