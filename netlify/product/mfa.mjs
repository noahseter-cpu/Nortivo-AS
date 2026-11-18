import crypto from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { fail,sha256,token } from '../terminal/security.mjs';
import { verifyPassword } from '../terminal/auth.mjs';
export function mfaConfigured(env){const k=env.PRODUCT_ENCRYPTION_KEY;return typeof k==='string'&&/^[-_A-Za-z0-9]{43}=?$/.test(k)&&Buffer.from(k,'base64url').length===32;}
function key(env){const k=env.PRODUCT_ENCRYPTION_KEY;if(typeof k!=='string'||!/^[-_A-Za-z0-9]{43}=?$/.test(k))fail('MFA_NOT_CONFIGURED','Additional account security is not configured.',503);const b=Buffer.from(k,'base64url');if(b.length!==32)fail('MFA_NOT_CONFIGURED','Additional account security is not configured.',503);return b;}
function seal(value,env,owner){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(env),iv);c.setAAD(Buffer.from(`nortivo:mfa:${owner}`));return [iv,c.update(value,'utf8'),c.final(),c.getAuthTag()].map(x=>x.toString('base64url')).join('.');}
function open(value,env,owner){const [iv,data,final,tag]=value.split('.').map(x=>Buffer.from(x,'base64url'));const d=crypto.createDecipheriv('aes-256-gcm',key(env),iv);d.setAAD(Buffer.from(`nortivo:mfa:${owner}`));d.setAuthTag(tag);return Buffer.concat([d.update(data),d.update(final),d.final()]).toString('utf8');}
const totp=(secret,label)=>new OTPAuth.TOTP({issuer:'Nortivo',label,algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)});
export async function consumeMfa(ctx,input,{scope='security',pending=false}={}) {
 const record=await ctx.store.get('mfa',ctx.user.id);const v=record?.value;
 if(!v||(!v.enabled&&!pending))fail('MFA_REQUIRED','Set up additional account security first.',403);
 let next={...v},accepted=false;
 if(!pending&&typeof input.recoveryCode==='string') {const hash=sha256(input.recoveryCode.replace(/\s/g,''));const i=(v.recoveryHashes||[]).indexOf(hash);if(i>=0){next.recoveryHashes=v.recoveryHashes.filter((_,n)=>n!==i);accepted=true;}}
 else if(typeof input.code==='string'&&/^\d{6}$/.test(input.code)){const t=totp(open(v.secret,ctx.env,ctx.user.id),ctx.user.email);const delta=t.validate({token:input.code,timestamp:ctx.now,window:1});const counter=Math.floor(ctx.now/30000)+(delta??0);if(delta!==null&&counter>(v.lastCounter??-1)){accepted=true;next.lastCounter=counter;}}
 if(!accepted)fail('MFA_INVALID','The security code was not accepted. Use a new code or a recovery code.',403);
 const changes=[{ns:'mfa',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:record.version,value:next}];
 if(ctx.sessionHash&&!pending){const old=await ctx.store.get('mfa_sessions',ctx.sessionHash);changes.push({ns:'mfa_sessions',key:ctx.sessionHash,ownerId:ctx.user.id,expectedVersion:old?.version??null,value:{scope,validUntil:ctx.now+600000},expiresAt:ctx.now+600000});}
 if((await ctx.store.transact(changes)).status!=='applied')fail('MFA_RETRY','Account security changed. Retry with a new code.',409);
 return next;
}
export async function requireStepUp(ctx,scope) {const r=await ctx.store.get('mfa_sessions',ctx.sessionHash);if(!r||r.ownerId!==ctx.user.id||r.value.validUntil<=ctx.now||!(r.value.scope===scope||r.value.scope==='security'||r.value.scope==='execution'&&scope==='broker'))fail('STEP_UP_REQUIRED','Confirm an authenticator or recovery code before this sensitive action.',403);}
export async function handleMfa(ctx,action,body) {
 if(action==='product-mfa-enroll'){
  if(!ctx.account.emailVerified)fail('EMAIL_VERIFICATION_REQUIRED','Verify your email first.',403);
  if(!await verifyPassword(body.password||'',ctx.user.password_hash))fail('PASSWORD_INVALID','Current password was not accepted.',403);
  const old=await ctx.store.get('mfa',ctx.user.id);if(old?.value.enabled)fail('MFA_ENABLED','Additional security is already enabled.',409);
  const t=new OTPAuth.TOTP({issuer:'Nortivo',label:ctx.user.email,algorithm:'SHA1',digits:6,period:30,secret:new OTPAuth.Secret({size:20})});
  const value={enabled:false,secret:seal(t.secret.base32,ctx.env,ctx.user.id),createdAt:ctx.now,lastCounter:-1};
  if((await ctx.store.transact([{ns:'mfa',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:old?.version??null,value,expiresAt:ctx.now+600000}])).status!=='applied')fail('MFA_RETRY','Retry security setup.',409);
  return {secret:t.secret.base32,uri:t.toString(),expiresAt:ctx.now+600000};
 }
 if(action==='product-mfa-confirm'){
  const r=await ctx.store.get('mfa',ctx.user.id);if(!r||r.value.enabled||r.expiresAt<=ctx.now)fail('MFA_EXPIRED','Restart security setup.',400);
  await consumeMfa(ctx,body,{pending:true});const fresh=await ctx.store.get('mfa',ctx.user.id);const codes=Array.from({length:8},()=>token().slice(0,16));
  if((await ctx.store.transact([{ns:'mfa',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:fresh.version,value:{...fresh.value,enabled:true,recoveryHashes:codes.map(sha256)}}])).status!=='applied')fail('MFA_RETRY','Retry security setup.',409);
  return {enabled:true,recoveryCodes:codes};
 }
 if(action==='product-mfa-stepup'){const scope=['broker','execution','security'].includes(body.scope)?body.scope:'security';await consumeMfa(ctx,body,{scope});return {ok:true,scope,expiresAt:ctx.now+600000};}
 if(action==='product-mfa-disable'){
  if(!await verifyPassword(body.password||'',ctx.user.password_hash))fail('PASSWORD_INVALID','Current password was not accepted.',403);
  await consumeMfa(ctx,body);const r=await ctx.store.get('mfa',ctx.user.id);
  if((await ctx.store.transact([{ns:'mfa',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:r.version,value:null}])).status!=='applied')fail('MFA_RETRY','Retry security update.',409);
  await ctx.legacyStore.revokeSessions(ctx.user.id);return {ok:true,signInRequired:true};
 }
 fail('NOT_FOUND','Security action not found.',404);
}
