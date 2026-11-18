import Stripe from 'stripe';
import crypto from 'node:crypto';
import { fail,commandDigest,sha256 } from '../terminal/security.mjs';
import { selectedPlan,PRICES,priceId } from './plans.mjs';
export const STRIPE_API_VERSION='2026-10-28.endive';
const MODES=['test','live'];
export function stripeMode(env){return MODES.includes(env.STRIPE_MODE)?env.STRIPE_MODE:'test';}
export function createStripe(env){const mode=stripeMode(env),key=env.STRIPE_SECRET_KEY;if(typeof key!=='string'||!key.startsWith(`sk_${mode}_`))fail('BILLING_NOT_READY','Subscriptions are not configured for purchase.',503);return new Stripe(key,{apiVersion:STRIPE_API_VERSION,maxNetworkRetries:2,timeout:10000});}
function client(ctx){return ctx.stripe&&ctx.env.PRODUCT_TEST_MODE==='true'?ctx.stripe:createStripe(ctx.env);}
function validId(body){if(typeof body.requestId!=='string'||!/^[A-Za-z0-9_.:-]{8,128}$/.test(body.requestId))fail('INVALID_REQUEST_ID','Provide a unique request ID.',400);return body.requestId;}
function assertPrice(p,env,tier,interval,{active=false}={}){if(!p||(active&&!p.active)||p.livemode!==(stripeMode(env)==='live')||p.currency!=='usd'||p.unit_amount!==PRICES[tier][interval]||p.recurring?.interval!==interval||p.recurring?.interval_count!==1||p.type!=='recurring')fail('INVALID_BILLING_CATALOG','The subscription price configuration needs attention.',503);}
function matchPlan(env,price){for(const tier of Object.keys(PRICES))for(const interval of ['month','year'])if(env[`STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`]===price)return {tier,interval};return null;}
const sid=v=>typeof v==='string'?v:v?.id;
async function customerSubscriptions(stripe,customer){
 const result=[];let cursor;
 for(let page=0;page<100;page++){
  const rows=await stripe.subscriptions.list({customer,status:'all',limit:100,...(cursor?{starting_after:cursor}:{})});
  result.push(...rows.data);
  if(!rows.has_more)return result;
  const next=rows.data.at(-1)?.id;
  if(!next||next===cursor)fail('BILLING_PENDING','The subscription history could not be fully confirmed. Contact support.',409);
  cursor=next;
 }
 fail('BILLING_PENDING','The subscription history needs merchant review before another checkout.',409);
}
export function billingReady(ctx,tier='portfolio'){
 const r=ctx.readiness||{},configured=Boolean(ctx.env.STRIPE_SECRET_KEY?.startsWith(`sk_${stripeMode(ctx.env)}_`)&&ctx.env.STRIPE_WEBHOOK_SECRET&&ctx.env.STRIPE_PORTAL_CONFIGURATION);
 const readyState=s=>Boolean(s&&s.configured&&s.permissionsReady&&s.reachable===true&&!['stale','unavailable'].includes(s.freshness));
 const required=['market','news','calendar','ai','email',...(tier==='pro'?['broker','worker']:[])];
 let prices=true;try{const ids=[];for(const t of Object.keys(PRICES))for(const i of ['month','year'])ids.push(priceId(ctx.env,t,i));if(new Set(ids).size!==4)prices=false;}catch{prices=false;}
 const missing=required.filter(k=>!readyState(r[k]));if(tier==='pro'&&r.broker?.purchasable!==true&&!missing.includes('broker'))missing.push('broker');if(tier==='pro'&&r.strategy?.supported!==true)missing.push('strategy');return {ready:configured&&prices&&missing.length===0,configured:configured&&prices,missing};
}
async function customerFor(ctx,stripe){
 const mode=stripeMode(ctx.env),key=`${mode}:${ctx.user.id}`;let old=await ctx.store.get('billing_customers',key);if(old)return old.value.customerId;
 const customer=await stripe.customers.create({email:ctx.user.email,name:ctx.user.name||undefined,metadata:{nortivo_user:ctx.user.id,nortivo_mode:mode}},{idempotencyKey:`nortivo:${mode}:customer:${ctx.user.id}`});
 if(customer.livemode!==(mode==='live'))fail('BILLING_MODE_MISMATCH','Billing configuration needs attention.',503);
 const result=await ctx.store.transact([{ns:'billing_customers',key,ownerId:ctx.user.id,expectedVersion:null,value:{customerId:customer.id,mode}},{ns:'billing_customers',key:`${mode}:customer:${customer.id}`,ownerId:ctx.user.id,expectedVersion:null,value:{userId:ctx.user.id,mode}}]);
 if(result.status==='conflict'){old=await ctx.store.get('billing_customers',key);if(!old||old.value.customerId!==customer.id)fail('BILLING_CONFLICT','Billing setup is still being confirmed.',409);}return customer.id;
}
async function mapping(ctx){const r=await ctx.store.get('billing_customers',`${stripeMode(ctx.env)}:${ctx.user.id}`);if(!r||r.ownerId!==ctx.user.id)fail('NO_SUBSCRIPTION','No subscription is connected to this account.',404);return r.value.customerId;}
async function verifyPrices(ctx,stripe){for(const tier of Object.keys(PRICES))for(const interval of ['month','year']){const p=await stripe.prices.retrieve(priceId(ctx.env,tier,interval));assertPrice(p,ctx.env,tier,interval,{active:true});}}
async function ownedSub(ctx,stripe){const a=await ctx.store.get('accounts',ctx.user.id),customer=await mapping(ctx);const id=a?.value.billing?.subscriptionId;if(!id)fail('NO_SUBSCRIPTION','No active subscription is connected to this account.',404);const s=await stripe.subscriptions.retrieve(id,{expand:['latest_invoice','items.data.price']});if(sid(s.customer)!==customer||s.metadata?.nortivo_user!==ctx.user.id||s.livemode!==(stripeMode(ctx.env)==='live'))fail('BILLING_OWNER','Subscription ownership could not be verified.',403);return s;}
export async function reconcileSubscription(ctx,stripe,subscription,{eventId=null}={}){
 const customer=sid(subscription.customer),mode=stripeMode(ctx.env),map=await ctx.store.get('billing_customers',`${mode}:customer:${customer}`);
 if(!map||map.ownerId!==subscription.metadata?.nortivo_user||subscription.livemode!==(mode==='live'))fail('BILLING_OWNER','Subscription ownership could not be verified.',403);
 const userId=map.ownerId,items=subscription.items?.data||[];if(items.length!==1||items[0].quantity!==1)fail('INVALID_SUBSCRIPTION','The subscription configuration needs attention.',409);
 const item=items[0],plan=matchPlan(ctx.env,sid(item.price));if(!plan)fail('INVALID_SUBSCRIPTION','The subscription price is not supported.',409);assertPrice(item.price,ctx.env,plan.tier,plan.interval);
 let invoice=subscription.latest_invoice;if(typeof invoice==='string')invoice=await stripe.invoices.retrieve(invoice);
 const start=Number(item.current_period_start??subscription.current_period_start)*1000,end=Number(item.current_period_end??subscription.current_period_end)*1000;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start)fail('INVALID_SUBSCRIPTION','The subscription dates need attention.',409);
 let lines=invoice?.lines?.data||[];
 if(invoice?.lines?.has_more&&stripe.invoices.listLineItems)lines=(await stripe.invoices.listLineItems(invoice.id,{limit:100})).data;
 const paidCoverageEnd=lines.reduce((covered,line)=>{const detail=line.parent?.subscription_item_details;return sid(detail?.subscription||line.subscription)===subscription.id&&detail?.subscription_item===item.id&&sid(line.pricing?.price_details?.price)===sid(item.price)&&line.currency==='usd'&&line.amount>=0&&Number.isSafeInteger(line.period?.end)?Math.max(covered,line.period.end*1000):covered;},0);
 for(let attempt=0;attempt<5;attempt++){
  const a=await ctx.store.get('accounts',userId);if(!a)fail('BILLING_OWNER','The subscription account was not found.',403);const previous=a.value.billing||{};
  if(previous.lastReconciledAt>ctx.now){if(eventId){const e=await ctx.store.get('billing_events',`${mode}:${eventId}`);if(!e)await ctx.store.transact([{ns:'billing_events',key:`${mode}:${eventId}`,ownerId:userId,expectedVersion:null,value:{status:'processed',subscriptionId:subscription.id,processedAt:ctx.now,staleObservation:true}}]);}return {billing:previous,staleObservation:true};}
  if(previous.subscriptionId&&previous.subscriptionId!==subscription.id&&previous.paidUntil>ctx.now)fail('OVERLAPPING_SUBSCRIPTION','Another subscription is already connected. Contact support.',409);
  const paid=invoice?.status==='paid'&&invoice?.amount_remaining===0&&paidCoverageEnd>=end&&!subscription.pending_update&&subscription.status==='active';
  const billing={...previous,mode,subscriptionId:subscription.id,customerId:customer,status:subscription.status,tier:paid?plan.tier:previous.tier||null,interval:paid?plan.interval:previous.interval||plan.interval,paidUntil:paid?end:previous.paidUntil||null,currentPeriodStart:start,currentPeriodEnd:end,cancelAtPeriodEnd:Boolean(subscription.cancel_at_period_end),nextCharge:subscription.cancel_at_period_end?null:end,changePending:subscription.pending_update?{kind:'payment_pending',expiresAt:subscription.pending_update.expires_at*1000}:previous.changePending?.kind==='scheduled'&&subscription.schedule&&previous.changePending.effectiveAt>ctx.now?previous.changePending:null,lastReconciledAt:ctx.now};
  const changes=[{ns:'accounts',key:userId,ownerId:userId,expectedVersion:a.version,value:{...a.value,billing}}];
  if(eventId){const e=await ctx.store.get('billing_events',`${mode}:${eventId}`);if(e?.value.status==='processed')return {duplicate:true,billing:previous};changes.push({ns:'billing_events',key:`${mode}:${eventId}`,ownerId:userId,expectedVersion:e?.version??null,value:{status:'processed',subscriptionId:subscription.id,processedAt:ctx.now}});}
  if((await ctx.store.transact(changes)).status==='applied')return {billing};
 }
 fail('BILLING_CONFLICT','Subscription confirmation is busy. Retry shortly.',409);
}
async function operation(ctx,action,body,work){
 const requestId=validId(body),key=`${ctx.user.id}:billing:${requestId}`,digest=commandDigest({action,...body});let r=await ctx.store.get('receipts',key);
 if(r){if(r.value.digest!==digest)fail('REQUEST_ID_REUSED','This request ID belongs to a different billing action.',409);if(r.value.result)return {...r.value.result,duplicate:true};}
 else {const claim=await ctx.store.transact([{ns:'receipts',key,ownerId:ctx.user.id,expectedVersion:null,value:{digest,status:'pending',createdAt:ctx.now}}]);if(claim.status==='conflict')fail('BILLING_PENDING','This billing action is already being confirmed. Retry with its original request ID.',409);r=await ctx.store.get('receipts',key);}
 const setProgress=async progress=>{for(let i=0;i<5;i++){const current=await ctx.store.get('receipts',key);if(current.value.status==='complete')return current.value.progress;if((await ctx.store.transact([{ns:'receipts',key,ownerId:ctx.user.id,expectedVersion:current.version,value:{...current.value,progress}}])).status==='applied')return progress;}fail('BILLING_PENDING','Billing progress is still being confirmed. Retry with the same request ID.',409);};
 const result=await work(`nortivo:${stripeMode(ctx.env)}:${sha256(key)}`,{progress:r.value.progress,setProgress});const fresh=await ctx.store.get('receipts',key);
 if((await ctx.store.transact([{ns:'receipts',key,ownerId:ctx.user.id,expectedVersion:fresh.version,value:{digest,status:'complete',createdAt:r.value.createdAt,result}}])).status!=='applied')fail('BILLING_PENDING','Billing confirmation is still pending. Retry with its original request ID.',409);return result;
}
export async function handleBilling(ctx,action,body={}){
 const stripe=client(ctx);
 if(action==='product-checkout')return operation(ctx,action,body,async idem=>{
  if(!ctx.account.emailVerified)fail('EMAIL_VERIFICATION_REQUIRED','Verify your email before checkout.',403);const plan=selectedPlan(body);if(!billingReady(ctx,plan.tier).ready)fail('BILLING_NOT_READY','This plan is not available for purchase until its required services are verified.',503);
  await verifyPrices(ctx,stripe);const customer=await customerFor(ctx,stripe),existing=await customerSubscriptions(stripe,customer);
  if(existing.some(s=>!['canceled','incomplete_expired'].includes(s.status)))fail('SUBSCRIPTION_EXISTS','Manage your existing subscription from account billing.',409);
  const currentAccount=await ctx.store.get('accounts',ctx.user.id),purchased=currentAccount?.value.billing;
  if(currentAccount?.ownerId!==ctx.user.id)fail('BILLING_OWNER','Billing account ownership could not be verified.',403);
  if(['portfolio','pro'].includes(purchased?.tier)&&Number(purchased.paidUntil)>ctx.now)fail('SUBSCRIPTION_EXISTS','Your purchased access is still valid. Manage it from account billing before starting another subscription.',409);
  const key=`${stripeMode(ctx.env)}:${ctx.user.id}`;let record=await ctx.store.get('billing_checkout',key);
  let replaceCheckout=!record||record.value.expiresAt<=ctx.now;
  if(record?.value.sessionId){
   const previous=await stripe.checkout.sessions.retrieve(record.value.sessionId);
   if(previous.status==='open'&&previous.expires_at*1000>ctx.now)return {url:previous.url,pending:true};
   if(previous.status==='complete'){
    // A completed historical checkout must not trap a canceled customer. A
    // missing/in-flight subscription still remains pending, never a new charge.
    const prior=existing.find(s=>s.id===sid(previous.subscription));
    if(!prior||!['canceled','incomplete_expired'].includes(prior.status))fail('BILLING_PENDING','Your payment is being confirmed. Refresh your subscription status.',409);
    replaceCheckout=true;
   }else if(previous.status==='expired'||previous.expires_at*1000<=ctx.now)replaceCheckout=true;
   else fail('BILLING_PENDING','The earlier checkout is still being confirmed.',409);
  }
  if(replaceCheckout){const v={idempotencyKey:idem,plan,expiresAt:ctx.now+86400000};const res=await ctx.store.transact([{ns:'billing_checkout',key,ownerId:ctx.user.id,expectedVersion:record?.version??null,value:v}]);if(res.status!=='applied')fail('BILLING_PENDING','Another checkout is being confirmed. Retry shortly.',409);record=await ctx.store.get('billing_checkout',key);}
  if(record.value.plan.tier!==plan.tier||record.value.plan.interval!==plan.interval)fail('CHECKOUT_EXISTS','Finish or wait for your existing checkout before choosing another plan.',409);
  const locale=ctx.account.locale==='nb'?'nb':'en',returnPath=ctx.account.returnPath||`/${locale}/${plan.tier==='pro'?'terminal':'portfolio'}/`;
  const checkout=await stripe.checkout.sessions.create({mode:'subscription',customer,line_items:[{price:priceId(ctx.env,plan.tier,plan.interval),quantity:1}],payment_method_types:['card'],client_reference_id:ctx.user.id,metadata:{nortivo_user:ctx.user.id,nortivo_mode:stripeMode(ctx.env)},subscription_data:{metadata:{nortivo_user:ctx.user.id,nortivo_mode:stripeMode(ctx.env)}},allow_promotion_codes:false,locale:locale==='nb'?'nb':'en',success_url:`${ctx.origin}${returnPath}?billing=pending`,cancel_url:`${ctx.origin}/${locale}/pricing/?billing=canceled`,expires_at:Math.floor(record.value.expiresAt/1000)},{idempotencyKey:record.value.idempotencyKey});
  await ctx.store.transact([{ns:'billing_checkout',key,ownerId:ctx.user.id,expectedVersion:record.version,value:{...record.value,sessionId:checkout.id}}]);return {url:checkout.url,pending:true};
 });
 if(action==='product-portal')return operation(ctx,action,body,async idem=>{const customer=await mapping(ctx);const portal=await stripe.billingPortal.sessions.create({customer,configuration:ctx.env.STRIPE_PORTAL_CONFIGURATION,return_url:`${ctx.origin}/${ctx.account.locale==='nb'?'nb':'en'}/portfolio/`},{idempotencyKey:idem});return {url:portal.url};});
 if(action==='product-refresh')return operation(ctx,action,body,async()=>{
  const customer=await mapping(ctx),list=await customerSubscriptions(stripe,customer);const active=list.filter(s=>!['canceled','incomplete_expired'].includes(s.status));if(active.length>1)fail('OVERLAPPING_SUBSCRIPTION','Multiple subscriptions need merchant review. No extra access was granted.',409);const s=active[0]||list[0];if(!s)return {status:'none'};return reconcileSubscription(ctx,stripe,await stripe.subscriptions.retrieve(s.id,{expand:['latest_invoice','items.data.price']}));
 });
 if(action==='product-change-preview'){
  await verifyPrices(ctx,stripe);
  const target=selectedPlan(body),s=await ownedSub(ctx,stripe),item=s.items.data[0],old=matchPlan(ctx.env,sid(item.price));if(s.status!=='active')fail('BILLING_PAYMENT_REQUIRED','Resolve the current subscription payment before changing plans.',409);if(s.pending_update||s.schedule)fail('BILLING_CHANGE_PENDING','Resolve the pending subscription change first.',409);
  const immediate=target.tier==='pro'&&old.tier==='portfolio';let invoice=null;const prorationDate=Math.floor(ctx.now/1000);
  if(immediate)invoice=await stripe.invoices.createPreview({customer:sid(s.customer),subscription:s.id,subscription_details:{items:[{id:item.id,price:priceId(ctx.env,target.tier,target.interval)}],proration_behavior:'always_invoice',proration_date:prorationDate}});
  const id=crypto.randomUUID(),value={subscriptionId:s.id,itemId:item.id,oldPrice:sid(item.price),target,immediate,prorationDate,amountDue:invoice?.amount_due??null,currency:'USD',effectiveAt:immediate?ctx.now:item.current_period_end*1000,expiresAt:ctx.now+600000};await ctx.store.transact([{ns:'billing_previews',key:`${ctx.user.id}:${id}`,ownerId:ctx.user.id,expectedVersion:null,value,expiresAt:value.expiresAt}]);return {previewId:id,...value};
 }
 if(action==='product-change')return operation(ctx,action,body,async (idem,op)=>{
  await verifyPrices(ctx,stripe);
  const plan=selectedPlan(body);let progress=op.progress;
  const s=await ownedSub(ctx,stripe),item=s.items.data[0];
  if(!progress){
   const p=await ctx.store.get('billing_previews',`${ctx.user.id}:${body.previewId}`);if(!p||p.ownerId!==ctx.user.id||p.value.expiresAt<=ctx.now||p.value.target.tier!==plan.tier||p.value.target.interval!==plan.interval)fail('PREVIEW_EXPIRED','Preview the subscription change again.',409);
   if(s.status!=='active'||s.id!==p.value.subscriptionId||sid(item.price)!==p.value.oldPrice||s.pending_update||s.schedule)fail('BILLING_CHANGED','Your subscription changed. Preview it again.',409);
   if(!billingReady(ctx,plan.tier).ready)fail('BILLING_NOT_READY','The selected plan services are not ready.',503);
   progress=await op.setProgress({...p.value,kind:p.value.immediate?'upgrade':'schedule',periodEnd:item.current_period_end});
  }
  if(s.id!==progress.subscriptionId||progress.target.tier!==plan.tier||progress.target.interval!==plan.interval)fail('BILLING_CHANGED','The subscription change no longer matches this request.',409);
  if(progress.kind==='upgrade'){
   const changed=await stripe.subscriptions.update(s.id,{items:[{id:progress.itemId,price:priceId(ctx.env,plan.tier,plan.interval)}],payment_behavior:'pending_if_incomplete',proration_behavior:'always_invoice',proration_date:progress.prorationDate,expand:['latest_invoice','items.data.price']},{idempotencyKey:idem});
   const result=await reconcileSubscription(ctx,stripe,changed);return {...result,paymentRequired:Boolean(changed.pending_update),paymentUrl:changed.pending_update?changed.latest_invoice?.hosted_invoice_url||null:null};
  }
  const schedule=await stripe.subscriptionSchedules.create({from_subscription:s.id},{idempotencyKey:`${idem}:schedule`});
  if(s.schedule&&sid(s.schedule)!==schedule.id)fail('BILLING_CHANGED','Another subscription schedule exists. Contact support.',409);
  if(progress.scheduleId&&progress.scheduleId!==schedule.id)fail('BILLING_CHANGED','The pending billing schedule changed.',409);
  progress=await op.setProgress({...progress,scheduleId:schedule.id,phaseStart:progress.phaseStart??schedule.current_phase.start_date});
  await stripe.subscriptionSchedules.update(schedule.id,{end_behavior:'release',proration_behavior:'none',phases:[{start_date:progress.phaseStart,end_date:progress.periodEnd,items:[{price:progress.oldPrice,quantity:1}],proration_behavior:'none'},{start_date:progress.periodEnd,items:[{price:priceId(ctx.env,plan.tier,plan.interval),quantity:1}],duration:{interval:plan.interval,interval_count:1},proration_behavior:'none'}]},{idempotencyKey:`${idem}:phases`});
  for(let attempt=0;attempt<5;attempt++){const a=await ctx.store.get('accounts',ctx.user.id);if((await ctx.store.transact([{ns:'accounts',key:ctx.user.id,ownerId:ctx.user.id,expectedVersion:a.version,value:{...a.value,billing:{...a.value.billing,changePending:{kind:'scheduled',...plan,effectiveAt:progress.periodEnd*1000,scheduleId:schedule.id}}}}])).status==='applied')return {scheduled:true,effectiveAt:progress.periodEnd*1000,...plan};}
  fail('BILLING_PENDING','The scheduled change is being confirmed. Retry with the same request ID.',409);
 });
 if(action==='product-cancel'||action==='product-resume')return operation(ctx,action,body,async idem=>{const s=await ownedSub(ctx,stripe);if(s.schedule)await stripe.subscriptionSchedules.release(sid(s.schedule),{preserve_cancel_date:false},{idempotencyKey:`${idem}:release`});return reconcileSubscription(ctx,stripe,await stripe.subscriptions.update(s.id,{cancel_at_period_end:action==='product-cancel',expand:['latest_invoice','items.data.price']},{idempotencyKey:idem}));});
 fail('NOT_FOUND','Billing action not found.',404);
}
export async function processStripeEvent(ctx,stripe,event){
 const mode=stripeMode(ctx.env);if(event.livemode!==(mode==='live'))fail('BILLING_MODE_MISMATCH','Webhook mode did not match.',400);
 const prior=await ctx.store.get('billing_events',`${mode}:${event.id}`);if(prior?.value.status==='processed')return {received:true,duplicate:true};
 let subscriptionId;const object=event.data?.object;
 if(event.type.startsWith('customer.subscription.'))subscriptionId=object.id;
 else if(event.type.startsWith('invoice.'))subscriptionId=sid(object.parent?.subscription_details?.subscription||object.subscription);
 else if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')subscriptionId=sid(object.subscription);
 else return {received:true,ignored:true};
 if(!subscriptionId)return {received:true,ignored:true};
 const canonical=await stripe.subscriptions.retrieve(subscriptionId,{expand:['latest_invoice','items.data.price']});await reconcileSubscription(ctx,stripe,canonical,{eventId:event.id});return {received:true};
}
