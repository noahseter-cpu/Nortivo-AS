import {createHmac, randomUUID} from 'node:crypto';
import {createDataVault} from '../security-core/vault.mjs';
import {createAdminSecurity, adminError} from '../security-core/admin.mjs';
import {createAuditLogger, SecurityCoreError} from '../../services/security-core/src/index.mjs';
import {createSupabaseStore} from '../terminal/store.mjs';
import {COOKIE, TerminalError, clientIdentifier, cookieToken, csrfToken, equalToken, fail, header, isLocalRuntime, parseBody, response, secureWorkspaceResponse, token, workspaceRateLimiter, workspaceSession} from '../terminal/security.mjs';
import {INDEX, chat, digest, fields, inbox, project, repository, sessionView} from './model.mjs';
import {availability,recordAvailability} from './presence.mjs';
import {businessSecret,canOperateKorvnt,workflowOrigin} from './tenancy.mjs';

function mac(secret,purpose,value) {
  return createHmac('sha256',secret).update('nortivo:workflow:v1:'+purpose+':').update(value).digest('base64url');
}
function guestOwner(raw,business) {
  const h=digest(business+':workflow:guest:v1:'+raw).slice(0,32);
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
async function guestCookie(event,c,bootstrap) {
  const {env,db,time,rate,client,business}=c;
  const local=isLocalRuntime(env);
  const name=local?business+'_workflow_local':'__Host-'+business+'_workflow';
  const values=header(event,'cookie').split(';').map(part=>part.trim()).filter(part=>part.split('=')[0]===name);
  if (header(event,'cookie').length>8192 || values.length>1) fail('AUTH_REQUIRED','Refresh this session.',401);
  if (values.length) {
    const raw=values[0].slice(name.length+1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw) || Buffer.from(raw,'base64url').toString('base64url')!==raw) fail('AUTH_REQUIRED','Refresh this session.',401);
    const record=await db.get(INDEX,'g:'+digest(raw));
    if (record && record.data.expiresAt>time && record.data.issuedAt<=time &&
        (business==='nortivo' || record.data.origin===new URL(event.rawUrl).origin)) return {raw};
    if (!bootstrap) fail('AUTH_REQUIRED','The guest session has expired.',401);
  }
  if (!bootstrap) return {};
  await rate('workflow-issue-guest',client,40,3600000);
  const raw=token();
  const issued={ns:INDEX,key:'g:'+digest(raw),ownerId:guestOwner(raw,business),version:null,data:{issuedAt:time,expiresAt:time+2592000000,...(business==='korvnt'?{origin:new URL(event.rawUrl).origin}:{})}};
  if ((await db.transact([issued])).status!=='applied') fail('UNAVAILABLE','Please retry session creation.',503);
  return {raw,set:name+'='+raw+'; Path=/; HttpOnly; '+(local?'':'Secure; ')+'SameSite=Strict; Max-Age=2592000'};
}
async function customer(event,c,bootstrap) {
  const guest=await guestCookie(event,c,bootstrap);
  const hasIdentity=c.business==='nortivo' && header(event,'cookie').split(';').some(part=>part.trim().split('=')[0]===COOKIE);
  const session=hasIdentity?await workspaceSession(event,c.store,c.time):null;
  if (hasIdentity && !session) fail('AUTH_REQUIRED','Sign in again to access this workspace.',401);
  let user=null,email=null;
  if (session?.kind==='user') {
    const account=await c.store.product.get('accounts',session.id);
    if (!account || account.ownerId!==session.id || account.value.emailVerified!==true || account.value.disabled) fail('FORBIDDEN','A current verified account is required.',403);
    user=session.id; email=session.email.toLowerCase();
  }
  if (!user && !guest.raw) fail('AUTH_REQUIRED','Open the workspace to start a session.',401);
  const expected=user?csrfToken(cookieToken(event),c.secret):mac(c.secret,'csrf',guest.raw);
  if (!bootstrap && !equalToken(header(event,'x-csrf-token'),expected)) fail('CSRF_FAILED','Refresh this session and retry.',403);
  const guestId=guest.raw?guestOwner(guest.raw,c.business):null;
  return {actor:user || guestId,user,email,guest:guestId,guestKey:guest.raw?'g:'+digest(guest.raw):null,csrf:expected,set:guest.set};
}

async function endGuest(ctx,body) {
  fields(body,[]);
  const row=await ctx.db.get(INDEX,ctx.guestKey);
  if(!row || row.ownerId!==ctx.actor) fail('AUTH_REQUIRED','Refresh this session.',401);
  if((await ctx.db.transact([{...row,data:null}])).status!=='applied') fail('CONFLICT','Refresh this session.',409);
  return {ended:true};
}

function publicError(error) {
  if (error instanceof SecurityCoreError) return adminError(error);
  const known=error instanceof TerminalError;
  const status=known?error.status:503;
  return response(status,{code:known?error.code:'UNAVAILABLE',error:known?error.message:'The workspace is temporarily unavailable. Retry the same submission.'},
    status===429?{'Retry-After':String(error.retryAfter||1)}:{});
}

export function createWorkflowHandler({store:providedStore,env=process.env,now=Date.now,fetcher=fetch,auditSink=line=>console.info(line),operator=false,business='nortivo'}={}) {
  if(!['nortivo','korvnt'].includes(business)) throw Error('Unknown workflow business.');
  let store=providedStore,vault,admin;
  return async function handle(event) {
    let audit,route='workflow-access',actor,client;
    const done=result=>secureWorkspaceResponse(result,event);
    try {
      const action=operator?'workflow-inbox':event.queryStringParameters?.action || new URL(event.rawUrl).searchParams.get('action');
      const end=business==='korvnt' && !operator && action==='workflow-session-end';
      if ((!end && !['workflow-session','workflow-chat','workflow-request','workflow-inbox'].includes(action)) || (!operator && action==='workflow-inbox')) fail('NOT_FOUND','Unknown action.',404);
      route=business==='korvnt'?action.replace('workflow-','korvnt-'):action;
      const bootstrap=action==='workflow-session', method=bootstrap?'GET':'POST';
      if (event.httpMethod!==method) return done(response(405,{code:'METHOD_NOT_ALLOWED'},{Allow:method}));
      workflowOrigin(event,env,business,operator,bootstrap);
      const secret=businessSecret(env,business), time=now();
      audit=createAuditLogger({key:mac(secret,'audit','v1'),sink:auditSink,now});
      client=clientIdentifier(event,secret);
      store ||= createSupabaseStore(env,fetcher);
      const rate=workspaceRateLimiter(store,secret,time);
      await rate('workflow-connection',client,180,60_000);
      if(!vault){
        const keys=JSON.parse(business==='korvnt'?env.KORVNT_VAULT_KEYS:env.WORKFLOW_VAULT_KEYS);
        if(business==='korvnt' && env.WORKFLOW_VAULT_KEYS){
          const parentKeys=new Set(Object.values(JSON.parse(env.WORKFLOW_VAULT_KEYS)));
          if(Object.values(keys).some(key=>parentKeys.has(key))) fail('UNAVAILABLE','The service is temporarily unavailable.',503);
        }
        vault=createDataVault({keys,currentKeyId:business==='korvnt'?env.KORVNT_VAULT_CURRENT:env.WORKFLOW_VAULT_CURRENT});
      }
      const db=repository(store.product,vault,business);
      let identity;
      if (operator) {
        admin ||=createAdminSecurity({store,env,now,auditSink});
        const principal=await admin.requireAdmin(event,{routeId:route,mutation:true});
        if(business==='korvnt' && !canOperateKorvnt(env,principal.id)) fail('FORBIDDEN','This inbox requires company-specific staff access.',403);
        identity={actor:principal.id,operator:true,adminSessionHash:principal.sessionHash};
      } else identity=await customer(event,{store,db,env,time,secret,rate,client,business},bootstrap);
      actor=identity.actor;
      const body=bootstrap?null:parseBody(event);
      // Read polling and write budgets are deliberately independent. All owners have a write budget.
      const write=end || body && ['start','send','submit','claim','reply','state','followup','availability'].includes(body.op);
      if (write) {
        await rate('workflow-write-ip',client,48,60_000);
        await rate('workflow-write-subject',actor,24,60_000);
      }
      if (body?.op==='track') await rate('workflow-track',client,30,60_000);
      if (write) await audit({event:'request_allowed',decision:'allow',routeId:route+'-attempt',status:200,reason:'AUTHORIZED',clientId:client,subjectId:actor,requestId:randomUUID()});
      const ctx={...identity,db,store,env,time,business};
      const result=bootstrap?{business,...await sessionView(ctx),...await availability(ctx).catch(()=>({availability:'unknown',availabilityLeaseMs:0})),csrfToken:identity.csrf,verifiedEmail:identity.email}
        :end?await endGuest(ctx,body)
        :operator && body.op==='availability'?await recordAvailability(ctx,body)
        :operator?await inbox(ctx,body):action==='workflow-chat'?await chat(ctx,body):await project(ctx,body);
      await audit({event:'request_allowed',decision:'allow',routeId:route,status:200,reason:'AUTHORIZED',clientId:client,subjectId:actor,requestId:randomUUID()});
      const local=isLocalRuntime(env);
      const set=end?(local?'korvnt_workflow_local':'__Host-korvnt_workflow')+'=; Path=/; HttpOnly; '+(local?'':'Secure; ')+'SameSite=Strict; Max-Age=0':identity.set;
      return done(response(200,result,set?{'Set-Cookie':set}:{}));
    } catch (error) {
      const res=publicError(error);
      if (audit) {
        try { await audit({event:res.statusCode>=500?'dependency_unavailable':'request_denied',decision:'deny',routeId:route,status:res.statusCode,reason:res.statusCode>=500?'UNAVAILABLE':res.statusCode===429?'RATE_LIMITED':'FORBIDDEN',clientId:client,...(actor?{subjectId:actor}:{}),requestId:randomUUID()}); }
        catch { return done(response(503,{code:'UNAVAILABLE',error:'The workspace is temporarily unavailable.'})); }
      }
      return done(res);
    }
  };
}
