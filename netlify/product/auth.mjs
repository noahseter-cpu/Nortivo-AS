import crypto from 'node:crypto';
import { credentials,hashPassword,verifyPassword } from '../terminal/auth.mjs';
import { token,sha256,fail,commandDigest } from '../terminal/security.mjs';
import { createInitialState } from '../terminal/engine.mjs';
import { validatedJourney } from './plans.mjs';
import { consumeMfa } from './mfa.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const emailReady=env=>Boolean(env.RESEND_API_KEY&&(env.AUTH_FROM_EMAIL||env.SUPPORT_FROM_EMAIL));
export async function ensureAccount(ctx) {let r=await ctx.store.get('accounts',ctx.user.id);if(!r){const value={emailVerified:false,createdAt:ctx.user.created_at,selectedPlan:null,locale:'en',returnPath:'/en/portfolio/',billing:{status:'none',paidUntil:null}};await ctx.store.transact([{ns:'accounts',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:null,value}]);r=await ctx.store.get('accounts',ctx.user.id);}if(r?.ownerId!==ctx.user.id)fail('RECORD_OWNER','Account ownership could not be verified.',403);if(r.value.disabled || ctx.user.disabled || (ctx.user.expires_at != null && (!Number.isSafeInteger(Number(ctx.user.expires_at)) || Number(ctx.user.expires_at) <= ctx.now)))fail('AUTH_REQUIRED','This account is unavailable.',401);return r;}
export async function deliver(ctx,to,raw,purpose,locale) {
 const nb=locale==='nb',url=`${ctx.origin}/${nb?'nb':'en'}/portfolio/#${purpose==='verify'?'verify':'reset'}=${encodeURIComponent(raw)}`;
 const subject=purpose==='verify'?(nb?'Bekreft e-postadressen din':'Verify your email address'):(nb?'Tilbakestill passordet ditt':'Reset your password');
 const text=`${subject}\n\n${url}\n\n${nb?'Lenken er personlig og kan brukes én gang. Hvis du ikke ba om dette, kan du ignorere meldingen.':'This personal link can be used once. If you did not request this, ignore this message.'}`;
 if(ctx.testEmail&&ctx.env.PRODUCT_TEST_MODE==='true')return ctx.testEmail({to,subject,text,url,purpose});
 if(!emailReady(ctx.env))fail('EMAIL_NOT_CONFIGURED','Account email delivery is not configured.',503);
 let r;try {r=await ctx.fetcher('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${ctx.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`auth/${sha256(raw)}`},body:JSON.stringify({from:ctx.env.AUTH_FROM_EMAIL||ctx.env.SUPPORT_FROM_EMAIL,to:[to],subject,text,html:`<p>${esc(subject)}</p><p><a href="${esc(url)}">${esc(subject)}</a></p><p>${esc(text.split('\n\n').at(-1))}</p>`})});const data=await r.json();if(!r.ok||typeof data.id!=='string')throw new Error();}
 catch {fail('EMAIL_DELIVERY_FAILED','The email could not be delivered. Try sending a new link.',503);}
 const health=await ctx.store.get('provider_health','email');await ctx.store.transact([{ns:'provider_health',key:'email',ownerId:'00000000-0000-4000-8000-000000000001',expectedVersion:health?.version??null,value:{reachable:true,checkedAt:ctx.now}}]);
}
export async function sendToken(ctx,purpose,user,account) {
 const raw=token(),hash=sha256(raw),current=await ensureAccount({...ctx,user}),expiresAt=ctx.now+(purpose==='verify'?86400000:1800000);
 const changes=[{ns:'accounts',key:user.id,ownerId:user.id,expectedVersion:current.version,value:{...current.value,authTokens:{...current.value.authTokens,[purpose]:{hash,expiresAt}}}},{ns:'tokens',key:`${purpose}:${hash}`,ownerId:user.id,expectedVersion:null,value:{purpose,createdAt:ctx.now,expiresAt},expiresAt}];
 const previousHash=current.value.authTokens?.[purpose]?.hash;
 if(previousHash){const previous=await ctx.store.get('tokens',`${purpose}:${previousHash}`);if(previous)changes.push({ns:'tokens',key:previous.key,ownerId:user.id,expectedVersion:previous.version,value:{purpose,consumedAt:ctx.now}});}
 if((await ctx.store.transact(changes)).status!=='applied')fail('IDENTITY_CONFLICT','Account security changed. Request a new link.',409);
 await deliver(ctx,user.email,raw,purpose,account.locale||'en');
}
const generic={ok:true,message:'If an eligible account exists, a personal link will be emailed. Check your inbox.'};
const registrationReply={ok:true,message:'If registration can be completed, a verification link will be emailed. Then sign in to continue.'};
async function recordDeliveryFailure(ctx,purpose){try{await ctx.store.transact([{ns:'audit',key:`${ctx.user.id}:email-failed:${crypto.randomUUID()}`,ownerId:ctx.user.id,expectedVersion:null,value:{kind:'account_email_delivery_unconfirmed',purpose,createdAt:ctx.now}}]);}catch{/* Account existence must not be revealed by recovery diagnostics. */}}
export async function handlePublicAuth(ctx,action,body,issue) {
 if(action==='signup'||action==='login'){
  const {email,password,name}=credentials(body);await ctx.rate('auth-account-connection',`${email}:${ctx.ip}`,8,900000);const found=await ctx.legacyStore.findUserByEmail(email);
  if(action==='login'){
   if(!await verifyPassword(password,found?.password_hash))fail('LOGIN_FAILED','Email or password was not accepted.',401);
   const r=await ensureAccount({...ctx,user:found});
   const mfa=await ctx.store.get('mfa',found.id);if(mfa?.value.enabled)await consumeMfa({...ctx,user:found,sessionHash:null},body);
   if(body.tier){const journey=validatedJourney(body);await ctx.store.transact([{ns:'accounts',key:found.id,ownerId:found.id,expectedVersion:r.version,value:{...r.value,...journey}}]);}
   return issue(found);
  }
  if(!emailReady(ctx.env)&&!(ctx.testEmail&&ctx.env.PRODUCT_TEST_MODE==='true'))fail('EMAIL_NOT_CONFIGURED','Account registration will open when verification email is available.',503);
  if(found){await verifyPassword(password,null);return registrationReply;}
  const user={id:crypto.randomUUID(),kind:'user',email,name,password_hash:await hashPassword(password),created_at:ctx.now,expires_at:null};
  const account={emailVerified:false,createdAt:ctx.now,...validatedJourney(body),billing:{status:'none',paidUntil:null}};
  await ctx.legacyStore.productIdentity({operation:'create',user,state:createInitialState({now:ctx.now}),changes:[{ns:'accounts',key:user.id,ownerId:user.id,expectedVersion:null,value:account}]});
  try {await sendToken({...ctx,user},'verify',user,account);}catch {await recordDeliveryFailure({...ctx,user},'verify');}
  return registrationReply;
 }
 if(action==='product-forgot'){
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>160)fail('INVALID_EMAIL','Enter a valid email address.',400);
  await ctx.rate('recovery-account-connection',`${email}:${ctx.ip}`,3,3600000);const found=await ctx.legacyStore.findUserByEmail(email);
  if(found){try{const a=await ensureAccount({...ctx,user:found});await sendToken({...ctx,user:found},'reset',found,{...a.value,locale:['en','nb'].includes(body.locale)?body.locale:a.value.locale});}catch{await recordDeliveryFailure({...ctx,user:found},'reset');}}return generic;
 }
 if(action==='product-verify'||action==='product-reset'){
  if(typeof body.token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(body.token))fail('TOKEN_INVALID','This link is invalid, expired or already used.',400);
  const purpose=action==='product-verify'?'verify':'reset',r=await ctx.store.get('tokens',`${purpose}:${sha256(body.token)}`);
  if(!r||r.value.purpose!==purpose||r.value.consumedAt||r.value.expiresAt<=ctx.now)fail('TOKEN_INVALID','This link is invalid, expired or already used.',400);
  if(ctx.user&&ctx.user.kind!=='guest'&&ctx.user.id!==r.ownerId)fail('TOKEN_OWNER','Sign out before using a link for another account.',403);
  const user=await ctx.legacyStore.findUserById(r.ownerId);if(!user)fail('TOKEN_INVALID','This link is invalid, expired or already used.',400);const a=await ensureAccount({...ctx,user});
  if(a.value.authTokens?.[purpose]?.hash!==sha256(body.token))fail('TOKEN_INVALID','This link is invalid, expired or already used.',400);
  const changes=[{ns:'tokens',key:r.key,ownerId:user.id,expectedVersion:r.version,value:{purpose,consumedAt:ctx.now}},{ns:'accounts',key:user.id,ownerId:user.id,expectedVersion:a.version,value:{...a.value,authTokens:{...a.value.authTokens,[purpose]:null},...(purpose==='verify'?{emailVerified:true,verifiedAt:ctx.now}:{passwordChangedAt:ctx.now})}}];
  if(purpose==='reset'){credentials({email:user.email,password:body.password});await ctx.legacyStore.productIdentity({operation:'password',userId:user.id,expectedPasswordHash:user.password_hash,passwordHash:await hashPassword(body.password),changes});return {ok:true,signInRequired:true};}
  const result=await ctx.legacyStore.productIdentity({operation:'update',changes});if(result.status!=='applied')fail('TOKEN_INVALID','This link is invalid, expired or already used.',400);return {ok:true,emailVerified:true,returnPath:a.value.returnPath,locale:a.value.locale,selectedPlan:a.value.selectedPlan};
 }
 fail('NOT_FOUND','Account action not found.',404);
}
export async function handleAccount(ctx,action,body={}) {
 if(action==='product-resend'){await ctx.rate('resend',ctx.user.id,3,3600000);if(!ctx.account.emailVerified)await sendToken(ctx,'verify',ctx.user,ctx.account);return generic;}
 if(action==='product-change-password'){
  if(!await verifyPassword(body.currentPassword||'',ctx.user.password_hash))fail('PASSWORD_INVALID','Current password was not accepted.',403);
  const m=await ctx.store.get('mfa',ctx.user.id);if(m?.value.enabled)await ctx.requireStepUp('security');credentials({email:ctx.user.email,password:body.password});
  const a=await ctx.store.get('accounts',ctx.user.id);await ctx.legacyStore.productIdentity({operation:'password',userId:ctx.user.id,expectedPasswordHash:ctx.user.password_hash,passwordHash:await hashPassword(body.password),changes:[{ns:'accounts',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:a.version,value:{...a.value,passwordChangedAt:ctx.now}}]});return {ok:true,signInRequired:true};
 }
 if(action==='product-sessions')return {sessions:(await ctx.legacyStore.listSessions(ctx.user.id,ctx.now)).map(s=>({id:s.token_hash,createdAt:Number(s.created_at),expiresAt:Number(s.expires_at),current:s.token_hash===ctx.sessionHash}))};
 if(action==='product-revoke'){if(body.all!==true&& !/^[a-f0-9]{64}$/.test(body.sessionId||''))fail('INVALID_SESSION','Select a session to revoke.',400);await ctx.legacyStore.revokeSessions(ctx.user.id,body.all===true?null:body.sessionId);return {ok:true,signInRequired:body.all===true||body.sessionId===ctx.sessionHash};}
 if(action==='product-deletion-request'){
  if(!/^[A-Za-z0-9_.:-]{8,128}$/.test(body.requestId||''))fail('INVALID_REQUEST_ID','Provide a unique request ID.',400);
  const a=await ctx.store.get('accounts',ctx.user.id),key=`${ctx.user.id}:deletion:${sha256(body.requestId)}`,prior=await ctx.store.get('audit',key);if(prior)return {...prior.value.result,duplicate:true};
  const broker=await ctx.store.list('broker_connections',{ownerId:ctx.user.id,limit:100});const result={requested:true,status:'review_required',requestedAt:ctx.now,subscriptionMustBeResolved:Boolean(a.value.billing?.subscriptionId),brokerConnectionsToReview:broker.filter(r=>!r.value.disconnectedAt).length,recordsRetained:true,message:'Your request is recorded. Export your records, cancel recurring billing and stop or disconnect your broker from account settings. Support will review account and retention requirements before deletion.'};
  const c=await ctx.store.transact([{ns:'accounts',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:a.version,value:{...a.value,deletionRequest:{status:'review_required',requestedAt:ctx.now}}},{ns:'audit',key,ownerId:ctx.user.id,expectedVersion:null,value:{kind:'account_deletion_requested',createdAt:ctx.now,result}}]);if(c.status!=='applied')fail('ACCOUNT_CONFLICT','Retry the same deletion request.',409);return result;
 }
 if(action==='product-select-plan'){const a=await ctx.store.get('accounts',ctx.user.id),journey=validatedJourney(body);if(!journey.selectedPlan)fail('INVALID_PLAN','Choose a plan.',400);if((await ctx.store.transact([{ns:'accounts',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:a.version,value:{...a.value,...journey}}])).status!=='applied')fail('ACCOUNT_CONFLICT','Retry your plan selection.',409);return {ok:true,...journey};}
 fail('NOT_FOUND','Account action not found.',404);
}
