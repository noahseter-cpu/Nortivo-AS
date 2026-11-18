import { fail } from '../terminal/security.mjs';
import { isOwnerAccount } from './owner.mjs';
export const FEATURES=Object.freeze({portfolio:['portfolio.write','market.read','news.read','calendar.read','ai.basic'],pro:['portfolio.write','market.read','news.read','calendar.read','ai.basic','ai.advanced','strategy.write','backtest.run','scan.run','broker.connect','order.submit','automation.run']});
export function deriveEntitlements(account={},now=Date.now()) {
 const billing=account.billing||{},paidUntil=Number(billing.paidUntil)||0,owner=isOwnerAccount(account);
 const tier=owner?'pro':!account.disabled&&account.emailVerified===true&&paidUntil>now&&Number(billing.currentPeriodStart||0)<=now&&['portfolio','pro'].includes(billing.tier)?billing.tier:'none';
 return {tier,features:[...(FEATURES[tier]||[])].filter(f=>!account.deletionRequest||!['broker.connect','order.submit','automation.run','strategy.write'].includes(f)),paidUntil:owner?null:paidUntil||null,reason:owner?'owner':account.disabled?'account_disabled':account.emailVerified!==true?'email_verification_required':tier==='none'?'subscription_required':'paid',...(owner?{billingExempt:true,unlimited:true}:{})};
}
export function requireEntitlement(account,feature,now=Date.now()) {const e=deriveEntitlements(account,now);if(!e.features.includes(feature))fail(!account?.emailVerified?'EMAIL_VERIFICATION_REQUIRED':'UPGRADE_REQUIRED',!account?.emailVerified?'Verify your email before using paid features.':'This feature requires an active subscription that includes it.',403);return e;}
