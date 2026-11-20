const nb = /^(nb|no)/i.test(document.documentElement.lang);
export const workflowBusiness=document.documentElement.dataset.workflowBusiness==='korvnt'?'korvnt':'nortivo';
const storagePrefix=workflowBusiness+'.workflow.v1.';
export const l = (en,no) => nb ? no : en;
export const when = value => new Intl.DateTimeFormat(nb?'nb-NO':'en-GB',{dateStyle:'short',timeStyle:'short'}).format(value);
export function el(tag,text,css) {
  const item=document.createElement(tag);
  if (text!=null) item.textContent=text;
  if (css) item.className=css;
  return item;
}
export function button(text,click,css='') {
  const item=el('button',text,css); item.type='button'; item.addEventListener('click',click); return item;
}
export function formField(label,control) {
  const wrap=el('label',null,'nwf-field'); wrap.append(el('span',label),control); return wrap;
}
export function announce(node,text) {node.textContent=text;}
const unsavedInTab=new Map();
export const saved = {
  get(key) {
    if(unsavedInTab.has(key))return JSON.parse(unsavedInTab.get(key));
    try {return JSON.parse(sessionStorage.getItem(storagePrefix+key));} catch {return null;}
  },
  set(key,value) {
    const encoded=JSON.stringify(value??null);
    try {
      if(value==null)sessionStorage.removeItem(storagePrefix+key);
      else sessionStorage.setItem(storagePrefix+key,encoded);
      unsavedInTab.delete(key);
      return true;
    }catch{
      // Keep the newest value (including a removal) over any stale tab storage.
      unsavedInTab.set(key,encoded);
      return false;
    }
  }
};
export let session=null;
let loading;
const changes=new Set();
export function onIdentityChange(f) {changes.add(f);}
async function request(action,data) {
  const caller=session;
  const settings={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)};
  if (data) Object.assign(settings,{method:'POST',headers:{...settings.headers,'Content-Type':'application/json','X-CSRF-Token':session?.csrfToken||''},body:JSON.stringify(data)});
  const endpoint=workflowBusiness==='korvnt'?'korvnt-service':'terminal';
  const res=await fetch('/.netlify/functions/'+endpoint+'?action=workflow-'+action,settings);
  const obj=await res.json();
  if(!res.ok){
    if(caller && session?.scope===caller.scope && session.csrfToken===caller.csrfToken && (res.status===401 || res.status===403&&['FORBIDDEN','CSRF_FAILED'].includes(obj.code))){
      const old=session;session=null;for(const update of changes)update(null,old);
    }
    throw Object.assign(new Error('Workflow request failed'),{status:res.status,code:obj.code});
  }
  return obj;
}
export async function connect(fresh=false) {
  if(session&&!fresh) return session;
  const started=performance.now();
  if(!loading) loading=request('session').then(next=>{
    next.availabilityValidUntil=started+Math.min(45000,Number(next.availabilityLeaseMs)||0);
    if(next.business!==workflowBusiness||typeof next.csrfToken!=='string'||!next.scope) throw Error('Invalid response');
    const old=session;session=next;
    if(old?.scope!==next.scope)for(const update of changes)update(next,old);
    return next;
  }).finally(()=>{loading=null;});
  return loading;
}
export async function api(action,data) {await connect(); return request(action,data);}
export function errorText(error) {
  if (error?.status===401 || error?.status===403) return l('Your session changed. Reload the page to continue.','Økten din er endret. Last siden på nytt for å fortsette.');
  if (error?.status===429) return l('Too many requests. Wait a minute and try again.','For mange forespørsler. Vent litt og prøv igjen.');
  if (error?.status===404) return l('No record is available with these details.','Ingen oppføring er tilgjengelig med disse opplysningene.');
  if (error?.code==='THREAD_CLOSED')return l('This conversation is closed.','Denne samtalen er avsluttet.');
  if (error?.status===409) return l('The record changed. Refresh and retry.','Oppføringen er endret. Oppdater og prøv igjen.');
  if (error?.status===400) return l('Check the entered fields and try again.','Sjekk feltene og prøv igjen.');
  return l('Could not confirm the request. Reconnect and try again.','Fikk ikke bekreftet forespørselen. Koble til og prøv igjen.');
}
export const stateLabel=s=>({received:l('Received','Mottatt'),reviewing:l('Under review','Til vurdering'),needs_information:l('More information needed','Behov for avklaring'),closed:l('Closed','Avsluttet'),open:l('Open','Åpen')})[s]||s;
export function messageText(message,business=workflowBusiness) {
  if(message.role!=='system')return message.text;
  if(message.text.startsWith('request_received:'))return (business==='korvnt'?l('Service enquiry received','Forespørsel mottatt'):l('Project request received','Prosjektforespørsel mottatt'))+' · '+message.text.split(':')[1];
  return message.text==='thread_closed'?l('Conversation closed','Samtalen er avsluttet'):l('Conversation reopened','Samtalen er åpnet igjen');
}
export function messageNode(message,business=workflowBusiness) {
  const item=el('li',null,'nwf-message nwf-'+message.role), head=el('div',null,'nwf-byline');
  const company=business==='korvnt'?'KORVNT':'Nortivo';
  head.append(el('strong',({customer:l('Customer','Kunde'),operator:company+l(' support · Human',' kundestøtte · Person'),system:l('System','System')})[message.role]),el('time',when(message.time)));
  item.append(head,el('p',messageText(message,business)));return item;
}
