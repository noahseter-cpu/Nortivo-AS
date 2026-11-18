import {api,connect,l,el,button,when,stateLabel,errorText,saved} from '/assets/workflow-client.js';
import {mountChat} from '/assets/workflow-chat.js';

const intake=document.querySelector('#ks-intake');
const tracker=document.querySelector('#ks-track');
const feedback=document.querySelector('#ks-feedback');
const receipt=document.querySelector('#ks-receipt');
const tracked=document.querySelector('#ks-tracked');
const chat=document.querySelector('[data-korvnt-chat]');
const cacheKey='korvnt.enquiry.v1';
const draft=saved.get(cacheKey)||{};
let pending=draft.pending||null,confirmed=draft.receipt||null,sending=false;
function values(){return {kind:intake.elements.kind.value,summary:intake.elements.summary.value,email:intake.elements.email.value};}
function store(){saved.set(cacheKey,{fields:values(),pending,receipt:confirmed});}
const panel=id=>document.getElementById(id);
function open(id){const target=panel(id);target.open=true;target.scrollIntoView({block:'start'});}
function follow(threadId){
  open('support');
  if(threadId)document.dispatchEvent(new CustomEvent('nortivo:workflow-thread',{detail:threadId}));
}
function showReceipt(){
  receipt.replaceChildren();
  intake.hidden=Boolean(confirmed);
  if(!confirmed)return;
  receipt.append(el('h3',l('Enquiry received','Forespørselen er mottatt')),el('p',confirmed.ref));
  if(confirmed.proof){
    const label=el('label',l('Private tracking key. Save it with your reference.','Privat sporingsnøkkel. Lagre den sammen med referansen.'));
    const key=el('input');key.type='password';key.readOnly=true;key.autocomplete='off';key.id='ks-saved-proof';key.placeholder='••••••••';
    const show=button(l('Show private key','Vis privat nøkkel'),()=>{
      const hidden=key.type==='password';
      key.type=hidden?'text':'password';key.value=hidden?confirmed.proof:'';
      show.textContent=hidden?l('Hide private key','Skjul privat nøkkel'):l('Show private key','Vis privat nøkkel');
      show.setAttribute('aria-expanded',String(hidden));
    },'ks-link');
    show.setAttribute('aria-controls',key.id);show.setAttribute('aria-expanded','false');
    label.append(key);receipt.append(label,show);
  }
  receipt.append(button(l('Check status','Sjekk status'),()=>{open('track');tracker.elements.ref.value=confirmed.ref;tracker.elements.proof.value='';tracker.requestSubmit();},'ks-primary'),
    button(l('Open linked conversation','Åpne tilknyttet samtale'),()=>follow(confirmed.threadId),'ks-link'),
    button(l('Start another enquiry','Start en ny forespørsel'),()=>{confirmed=null;pending=null;intake.reset();store();showReceipt();feedback.textContent='';intake.elements.kind.focus();},'ks-link'));
}
function updateLock(){
  for(const key of ['kind','email','summary'])intake.elements[key].disabled=Boolean(pending)||sending;
  const submit=intake.querySelector('[type=submit]');submit.disabled=sending;
  submit.textContent=pending?l('Retry the saved enquiry','Prøv den lagrede forespørselen igjen'):l('Send enquiry →','Send forespørsel →');
}
async function submit(event){
  event.preventDefault();if(sending||confirmed)return;
  const brief=pending?.brief||values();
  if(!pending&&(brief.summary.trim().length<8 || !brief.kind || !intake.reportValidity())){feedback.textContent=l('Describe your needs in at least eight characters.','Beskriv behovet med minst åtte tegn.');return;}
  pending||={op:'submit',requestId:crypto.randomUUID(),confirmed:true,brief};
  sending=true;store();updateLock();feedback.textContent=l('Submitting…','Sender …');
  try{
    await connect();confirmed=await api('request',pending);pending=null;feedback.textContent='';intake.reset();store();showReceipt();
    if(confirmed.threadId)document.dispatchEvent(new CustomEvent('nortivo:workflow-thread',{detail:confirmed.threadId}));
  }catch(error){
    if([400,413,415].includes(error?.status))pending=null;
    store();feedback.textContent=errorText(error);
  }finally{sending=false;updateLock();}
}
if(intake && tracker && chat && document.documentElement.dataset.workflowBusiness==='korvnt'){
  mountChat(chat);
  intake.querySelector('fieldset').disabled=false;tracker.querySelector('fieldset').disabled=false;
  for(const key of ['kind','email','summary'])intake.elements[key].value=draft.fields?.[key]||'';
  intake.addEventListener('input',store);intake.addEventListener('submit',submit);showReceipt();updateLock();
  document.addEventListener('click',e=>{
    const source=e.target.closest('[data-service-kind]');if(!source||confirmed||pending)return;
    intake.elements.kind.value=source.dataset.serviceKind;store();
  });
  const end=panel('ks-end-session');
  end.addEventListener('click',async()=>{
    end.disabled=true;
    try{
      const identity=await connect();
      await api('session-end',{});
      saved.set(cacheKey,null);saved.set(identity.scope+'.chat',null);
      location.replace(location.pathname);
    }catch(error){tracked.textContent=errorText(error);end.disabled=false;}
  });
  tracker.addEventListener('submit',async event=>{
    event.preventDefault();const btn=tracker.querySelector('button');if(btn.disabled)return;btn.disabled=true;
    try{
      const ref=tracker.elements.ref.value.trim().toUpperCase();
      const proof=tracker.elements.proof.value.trim() || (confirmed?.ref===ref?confirmed.proof:'');
      const data=await api('request',{op:'track',ref,...(proof?{proof}:{})});
      tracked.replaceChildren(el('strong',stateLabel(data.state)),el('p',data.ref+' · '+when(data.updatedAt)));
      for(const note of data.followups||[])tracked.append(el('p',when(note.time)+' · '+note.text));
      if(data.threadId)tracked.append(button(l('Open linked conversation','Åpne tilknyttet samtale'),()=>follow(data.threadId),'ks-link'));
    }catch(error){tracked.textContent=errorText(error);}finally{btn.disabled=false;}
  });
}

