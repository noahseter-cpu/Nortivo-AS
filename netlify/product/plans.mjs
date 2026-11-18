import { fail } from '../terminal/security.mjs';
export const PRICES=Object.freeze({portfolio:{month:1000,year:9600},pro:{month:3000,year:28800}});
export function selectedPlan(input={}) {if(typeof input.tier!=='string'||!Object.hasOwn(PRICES,input.tier)||!['month','year'].includes(input.interval))fail('INVALID_PLAN','Choose Portfolio or Terminal Pro and monthly or annual billing.',400);return {tier:input.tier,interval:input.interval};}
export function priceId(env,tier,interval) {selectedPlan({tier,interval});const id=env[`STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`];if(typeof id!=='string'||!/^price_[A-Za-z0-9]+$/.test(id))fail('BILLING_NOT_READY','Subscriptions are not available for purchase yet.',503);return id;}
export function getPlanCatalog(){return {productEnabled:true,currency:'USD',annualDiscountPercent:20,plans:Object.entries(PRICES).map(([tier,prices])=>({tier,name:tier==='portfolio'?'Nortivo Portfolio':'Nortivo Terminal Pro',prices:{month:{amount:prices.month,interval:'month',currency:'USD'},year:{amount:prices.year,interval:'year',currency:'USD',monthlyEquivalent:prices.year/12,savings:prices.month*12-prices.year}}}))};}
export function validatedJourney(input={}) {
 const locale=['nb','en'].includes(input.locale)?input.locale:'en',plan=input.tier||input.interval?selectedPlan(input):null;
 const path=typeof input.returnPath==='string'?input.returnPath:'',expected=`/${locale}/${plan?.tier==='pro'?'terminal':'portfolio'}/`;
 const returnPath=plan?expected:/^\/(?:en|nb)\/(?:portfolio|terminal)\/$/.test(path)&&path.startsWith(`/${locale}/`)?path:expected;
 return {selectedPlan:plan,locale,returnPath};
}
