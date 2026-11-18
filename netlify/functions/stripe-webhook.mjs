import { createSupabaseStore } from '../terminal/store.mjs';
import { createStripe,processStripeEvent } from '../product/billing.mjs';
import { header,response,TerminalError } from '../terminal/security.mjs';
export function createStripeWebhookHandler({store:providedStore,env=process.env,now=()=>Date.now(),fetcher=fetch,stripe:injectedStripe}={}){let legacyStore=providedStore;return async event=>{try{
 if(env.PRODUCT_ENABLED!=='true')return response(404,{error:{code:'PRODUCT_DISABLED',message:'Subscriptions are not enabled.'}});
 if(event.httpMethod!=='POST')return response(405,{error:{code:'METHOD_NOT_ALLOWED',message:'Use POST.'}},{Allow:'POST'});
 const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64'):Buffer.from(event.body||'','utf8');if(raw.length>1000000)return response(413,{error:{code:'INVALID_BODY',message:'Webhook body is too large.'}});
 const stripe=injectedStripe&&env.PRODUCT_TEST_MODE==='true'?injectedStripe:createStripe(env);let payload;try{payload=stripe.webhooks.constructEvent(raw,header(event,'stripe-signature'),env.STRIPE_WEBHOOK_SECRET,300);}catch{return response(400,{error:{code:'INVALID_SIGNATURE',message:'Webhook signature was not accepted.'}});}
 legacyStore||=createSupabaseStore(env,fetcher);return response(200,await processStripeEvent({store:legacyStore.product,env,now:now()},stripe,payload));
 }catch(error){return response(error instanceof TerminalError&&error.status<500?error.status:503,{error:{code:'WEBHOOK_UNCONFIRMED',message:'Webhook processing was not confirmed. Retry delivery.'}});}};}
export const handler=createStripeWebhookHandler();
