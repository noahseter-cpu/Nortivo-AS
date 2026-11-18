import crypto from 'node:crypto';
import { createInitialState, applyCommand, snapshot } from '../terminal/engine.mjs';
import { createSupabaseStore } from '../terminal/store.mjs';
import { credentials, hashPassword, verifyPassword } from '../terminal/auth.mjs';
import { createProviderAdapters, integrationStatus, brokerAdapter } from '../terminal/providers.mjs';
import { TerminalError, fail, header, sessionSecret, token, sha256, csrfToken, equalToken, cookieToken, cookie, requireSameOrigin, parseBody, clientIdentifier, commandDigest, response, isLocalRuntime, COMMAND_QUOTAS, terminalCapabilities, GUEST_TTL, SESSION_TTL, GUEST_SESSION_TTL, workspaceSession, workspaceRateLimiter, authorizeWorkspaceRecord, secureWorkspaceResponse } from '../terminal/security.mjs';
import { createProductHandler } from '../product/service.mjs';
import { loadOwnerMarketEnvironment } from '../product/runtime-owner-market.mjs';

const CUSTOMER_WORKFLOWS = new Set(['workflow-session', 'workflow-chat', 'workflow-request']);
const GET_ACTIONS = new Set(['session','integrations','market','news','calendar','export']);
const POST_ACTIONS = new Set(['guest','signup','login','logout','command','broker']);
function csvCell(value) {
  if (value == null) return '""';
  const text = String(value);
  return `"${(typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text).replace(/"/g,'""')}"`;
}
function exportTrades(state) {
  const fields = ['id','orderId','time','symbol','side','quantity','priceMinor','grossMinor','feeMinor','realizedPnlMinor','currency'];
  return fields.join(',') + '\r\n' + (state.fills || []).map(fill => {
    const row = {...fill,currency:state.account?.currency || 'USD',realizedPnlMinor:fill.side === 'sell' ? (state.closedTrades || []).filter(trade => trade.exitOrderId===fill.orderId).reduce((sum,trade) => sum+trade.pnlMinor,0) : null};
    return fields.map(key => csvCell(row[key])).join(',');
  }).join('\r\n') + '\r\n';
}

export function createTerminalHandler({ store: providedStore, env = process.env, now = () => Date.now(), fetcher = fetch, testEmail, stripe, auditSink } = {}) {
  env = loadOwnerMarketEnvironment(env);
  let store = providedStore;
  const adapters = createProviderAdapters(env,fetcher);
  const productHandler=env.PRODUCT_ENABLED==='true'?createProductHandler({store:providedStore,env,now,fetcher,testEmail,stripe,legacyHandler:createTerminalHandler({store:providedStore,env:{...env,PRODUCT_ENABLED:'false'},now,fetcher,auditSink})}):null;
  let workflowHandler;
  async function runTerminal(event = {}) {
    try {
      const action = event.queryStringParameters?.action || new URL(event.rawUrl).searchParams.get('action') || 'session';
      if (CUSTOMER_WORKFLOWS.has(action)) {
        if (!workflowHandler) {
          const { createWorkflowHandler } = await import('../conversations/handler.mjs');
          workflowHandler = createWorkflowHandler({ store: providedStore, env, now, fetcher, auditSink });
        }
        return await workflowHandler(event);
      }
      if (productHandler) return await productHandler(event);
      const method = String(event.httpMethod || event.method || 'GET').toUpperCase();
      if (!GET_ACTIONS.has(action) && !POST_ACTIONS.has(action)) fail('NOT_FOUND','Trading workspace action not found.',404);
      const expected = GET_ACTIONS.has(action) ? 'GET' : 'POST';
      if (method !== expected) return response(405,{error:{code:'METHOD_NOT_ALLOWED',message:`Use ${expected} for this action.`}},{Allow:expected});
      requireSameOrigin(event,env,method === 'POST');
      const secret = sessionSecret(env);
      store ||= createSupabaseStore(env,fetcher);
      const time = now();
      const ip = clientIdentifier(event,secret);
      const rate = workspaceRateLimiter(store, secret, time);
      await rate('request',ip,600,5*60_000);
      const body = method === 'POST' ? parseBody(event) : null;
      const rawToken = cookieToken(event);
      const session = rawToken ? await workspaceSession(event,store,time) : null;
      const getRecord = async (id,actor = session) => {
        if (actor) authorizeWorkspaceRecord(actor,id,time);
        const record = await store.getState(id);
        if (!record) fail('STATE_UNAVAILABLE','Your workspace could not be loaded.',503);
        return record;
      };
      const sessionData = async (user, value) => {
        const record = await getRecord(user.id,user);
        return {
          user:{id:user.id,kind:user.kind,...(user.email ? {email:user.email} : {}),...(user.name ? {name:user.name} : {}),emailVerified:false},
          csrfToken:csrfToken(value,secret),state:snapshot(record.state,{now:time}),revision:record.revision,integrations:integrationStatus(env),capabilities:terminalCapabilities(env),
          storage:{kind:user.kind === 'guest' ? 'guest' : 'account',expiresAt:user.kind === 'guest' ? new Date(user.expires_at).toISOString() : null,sessionExpiresAt:new Date(user.session_expires_at).toISOString(),commandsUsed:record.commandCount,commandLimit:COMMAND_QUOTAS[user.kind],commandsRemaining:Math.max(0,COMMAND_QUOTAS[user.kind]-record.commandCount),description:user.kind === 'guest' ? 'Separate server-stored sandbox; expires after seven days. This browser session lasts one day. Guest data does not transfer to an account.' : 'Private server-stored paper workspace. Sign in to restore it; sessions expire after seven days. Email verification and password recovery are not connected.'},
        };
      };
      async function issue(user) {
        const ttl = user.kind === 'guest' ? GUEST_SESSION_TTL : SESSION_TTL;
        const newToken = token();
        await store.createSession({token_hash:sha256(newToken),user_id:user.id,created_at:time,expires_at:time+ttl});
        if (rawToken) await store.deleteSession(sha256(rawToken));
        return response(200,await sessionData({...user,session_expires_at:time+ttl},newToken),{'Set-Cookie':cookie(newToken,ttl,isLocalRuntime(env))});
      }
      if (action === 'guest') {
        await rate('guest',ip,12,24*60*60_000);
        if (session) return response(200,await sessionData(session,rawToken));
        const user = {id:crypto.randomUUID(),kind:'guest',created_at:time,expires_at:time+GUEST_TTL};
        await store.createUser(user,createInitialState({now:time}));
        return issue(user);
      }
      if (action === 'signup' || action === 'login') {
        await rate('auth-ip',ip,24,15*60_000);
        if (action === 'signup' && !terminalCapabilities(env).signupEnabled) fail('SIGNUP_DISABLED','Account creation is not enabled here. Use a guest sandbox or sign in to an existing account.',403);
        const {email,password,name} = credentials(body);
        // A remote connection cannot consume a global victim-email bucket.
        await rate('auth-account-connection',`${email}:${ip}`,8,15*60_000);
        const found = await store.findUserByEmail(email);
        if (action === 'signup') {
          const passwordHash = await hashPassword(password);
          if (found) fail('ACCOUNT_UNAVAILABLE','Account creation could not be completed. Try signing in or use a guest sandbox.',409);
          const user = {id:crypto.randomUUID(),kind:'user',email,name,password_hash:passwordHash,created_at:time,expires_at:null};
          await store.createUser(user,createInitialState({now:time}));
          return issue(user);
        }
        if (!await verifyPassword(password,found?.password_hash)) fail('LOGIN_FAILED','Email or password was not accepted.',401);
        return issue(found);
      }
      if (!session) fail('AUTH_REQUIRED','Open a guest sandbox or sign in to your workspace.',401);
      if (method === 'POST' && !equalToken(header(event,'x-csrf-token'),csrfToken(rawToken,secret))) fail('CSRF_FAILED','The workspace security token expired. Refresh and try again.',403);
      await rate('user',session.id,1200,5*60_000);
      if (action === 'session') return response(200,await sessionData(session,rawToken));
      if (action === 'logout') {
        await store.deleteSession(sha256(rawToken));
        return response(200,{ok:true},{'Set-Cookie':cookie('',0,isLocalRuntime(env))});
      }
      if (action === 'broker') return await brokerAdapter.submitOrder();
      if (action === 'integrations') return response(200,{integrations:integrationStatus(env),capabilities:terminalCapabilities(env)});
      if (['market','news','calendar'].includes(action)) {
        const params = event.queryStringParameters || Object.fromEntries(new URL(event.rawUrl).searchParams);
        if (!params.mode) return response(200,{integration:integrationStatus(env)[action],modeRequired:true});
        if (!['sample','provider'].includes(params.mode)) fail('INVALID_DATA_MODE','Select sample or provider data explicitly.',400);
        if (params.mode === 'sample') {
          const state = snapshot((await getRecord(session.id)).state,{now:time});
          if (action === 'market') {
            const symbol = params.symbol || state.settings?.selectedSymbol || state.watchlist[0];
            if (!Object.hasOwn(state.markets,symbol)) fail('INVALID_SYMBOL','Select a sample instrument.',400);
            return response(200,{mode:'sample',source:state.replay.source,asOf:state.replay.asOf,symbol,...state.markets[symbol]});
          }
          const records = action === 'news' ? state.news : state.calendar;
          const items = action === 'news' ? records.filter(item => (!params.symbol || item.symbol === params.symbol || item.symbols?.includes(params.symbol)) && (!params.category || item.category === params.category)) : records;
          return response(200,{mode:'sample',source:state.replay.source,asOf:state.replay.asOf,[action === 'news' ? 'items' : 'events']:items});
        }
        await rate('provider-user',session.id,30,60_000);
        await rate('provider-total','finnhub',90,60_000);
        return response(200,await adapters[action](params,time));
      }
      if (action === 'export') {
        const record = await getRecord(session.id);
        return {statusCode:200,headers:{...response(200,{}).headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Nortivo-paper-trades.csv"'},body:exportTrades(snapshot(record.state,{now:time}))};
      }
      if (action === 'command') {
        const {requestId,command} = body;
        if (typeof requestId !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(requestId) || !command || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string') fail('INVALID_COMMAND','Provide a command and a unique 8–128 character request ID.',400);
        if (command.mode === 'live' || command.execution === 'live' || command.executionMode === 'live' || command.type.startsWith('broker_')) return await brokerAdapter.submitOrder();
        const digest = commandDigest(command);
        const previous = await store.getReceipt(session.id,requestId);
        if (previous) {
          if (previous.digest !== digest) fail('REQUEST_ID_REUSED','This request ID belongs to a different command.',409);
          const record = await getRecord(session.id);
          return response(200,{state:snapshot(record.state,{now:time}),result:previous.result,revision:record.revision,duplicate:true});
        }
        await rate('new-command',session.id,90,60_000);
        for (let attempt = 0; attempt < 4; attempt++) {
          const record = await getRecord(session.id);
          const applied = applyCommand(record.state,command,requestId,{now:time});
          if (Buffer.byteLength(JSON.stringify(applied.state)) > 8_000_000) fail('WORKSPACE_LIMIT','This workspace reached its storage limit. Export your history before opening another sandbox.',409);
          const committed = await store.commitCommand(session.id,record.revision,applied.state,{requestId,digest,result:applied.result ?? null,now:time});
          if (committed.status === 'conflict') continue;
          if (committed.status === 'quota') fail('WORKSPACE_COMMAND_LIMIT','This workspace reached its command storage limit. Its prior records and export remain available.',409);
          if (committed.status === 'duplicate' && committed.digest !== digest) fail('REQUEST_ID_REUSED','This request ID belongs to a different command.',409);
          const latest = await getRecord(session.id);
          return response(200,{state:snapshot(latest.state,{now:time}),result:committed.status === 'duplicate' ? committed.result : applied.result,revision:latest.revision,duplicate:committed.status === 'duplicate'});
        }
        fail('STATE_CONFLICT','Another tab changed this workspace. Retry the same action with its original request ID.',409);
      }
      fail('NOT_FOUND','Trading workspace action not found.',404);
    } catch (error) {
      // Known errors contain user-facing engine/security text. Never expose SQL, provider bodies, stack traces, or secrets.
      const known = error instanceof TerminalError || (typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{2,60}$/.test(error.code) && Number.isInteger(error.status) && error.status >= 400 && error.status < 500);
      return response(known ? error.status : 503,{error:{code:known ? error.code : 'WORKSPACE_UNAVAILABLE',message:known ? error.message : 'Trading workspace is temporarily unavailable. Your action was not confirmed; retry with the same request ID.'},capabilities:terminalCapabilities(env)},error?.status === 429 ? {'Retry-After':String(error.retryAfter || 1)} : {});
    }
  }
  return async function terminalHandler(event = {}) { return secureWorkspaceResponse(await runTerminal(event),event); };
}
export const handler = createTerminalHandler();
