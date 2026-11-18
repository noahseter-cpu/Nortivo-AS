import {el,button,formField,l,when,stateLabel,errorText,messageNode} from './workflow-client.js';
import {briefField} from './workflow-intake.js';

export function mountWorkflowInbox(root,send,{business='nortivo'}={}) {
  if(!['nortivo','korvnt'].includes(business))throw Error('Unknown workflow business.');
  const korvnt=business==='korvnt';
  const call=body=>send(body,korvnt?'korvnt-inbox':'workflow-inbox');
  const renderMessage=message=>messageNode(message,business);
  const tabs=el('div',null,'nwf-queue-tabs'),list=el('div',null,'nwf-inbox-list'),detail=el('article'),notice=el('p',null,'nwf-status');
  notice.setAttribute('role','status');root.className='nwf-inbox';root.replaceChildren(tabs,list,notice,detail);
  let kind='threads',listVersion=0,detailVersion=0,selected=null,available=false,signaling=false;
  const active=()=>!document.hidden&&root.isConnected&&!root.closest('[hidden]');
  const availability=button('',()=>checkIn(!available),'nwf-link');tabs.append(availability);
  const label=()=>{availability.textContent=available?l('Go offline','Gå frakoblet'):l('Be available for chat','Vær tilgjengelig for chat');availability.setAttribute('aria-pressed',String(available));};
  label();
  async function checkIn(value){
    if(signaling)return;
    signaling=true;availability.disabled=true;
    try{await call({op:'availability',available:value});available=value;}
    catch(e){available=false;notice.textContent=errorText(e);}
    finally{signaling=false;availability.disabled=false;label();}
  }
  const timer=setInterval(()=>{if(available)void checkIn(active());},15000);
  const visibility=()=>{if(available&&!active())void checkIn(false);};
  document.addEventListener('visibilitychange',visibility);
  async function showList(after) {
    const n=++listVersion, type=kind;
    if(!after)list.replaceChildren();
    try{
      const data=await call({op:'list',kind:type,...(after?{after}:{})});if(n!==listVersion)return;
      for(const item of data.items){
        const id=item.ref||item.id;
        const label=item.ref||l('Conversation','Samtale')+' '+id.slice(0,8);
        list.append(button(label+' · '+stateLabel(item.state)+' · '+when(item.updatedAt),()=>show(id),'nwf-row'));
      }
      if(!list.children.length)list.append(el('p',l('The queue is empty.','Køen er tom.')));
      if(data.next){const more=button(l('Load more','Last inn flere'),()=>{more.remove();void showList(data.next);},'nwf-link');list.append(more);}
    }catch(e){if(n===listVersion)notice.textContent=errorText(e);}
  }
  for(const [type,title] of [['threads',l('Conversations','Samtaler')],['requests',korvnt?l('Service enquiries','Tjenesteforespørsler'):l('Project requests','Prosjektforespørsler')]]){
    tabs.append(button(title,()=>{kind=type;detailVersion++;selected=null;detail.replaceChildren();notice.textContent='';void showList();}));
  }
  async function mutate(body,control) {
    control.disabled=true;notice.textContent=l('Saving…','Lagrer …');
    try{await call(body);notice.textContent=l('Saved.','Lagret.');return true;}
    catch(e){notice.textContent=errorText(e);return false;}
    finally{control.disabled=false;}
  }
  function compose(row){
    const form=el('form'), input=el('textarea'),action=el('button',l('Send reply','Send svar'),'nwf-primary');
    input.required=true;input.maxLength=2400;input.rows=3;action.type='submit';
    form.append(formField(l('Reply to customer','Svar til kunden'),input),action);
    let attempt=null;
    form.onsubmit=async event=>{
      event.preventDefault();if(action.disabled||!input.value.trim())return;
      if(!attempt || attempt.text!==input.value.trim())attempt={op:'reply',id:row.id,text:input.value.trim(),requestId:crypto.randomUUID()};
      if(await mutate(attempt,action))await show(row.id);
    };
    return form;
  }
  function followup(row){
    const form=el('form'), target=el('input'),note=el('textarea'),state=el('select');
    target.value=row.threadId;target.required=true;target.maxLength=36;
    note.maxLength=800;note.required=true;
    for(const s of [row.state,...row.allowed]){const o=el('option',stateLabel(s));o.value=s;state.append(o);}
    const save=el('button',l('Save follow-up','Lagre oppfølging'),'nwf-primary');save.type='submit';
    form.append(formField(l('Conversation ID (same customer)','Samtale-ID (samme kunde)'),target),formField(l('Request status','Forespørselsstatus'),state),
      formField(l('Update visible to the customer','Oppdatering synlig for kunden'),note),save);
    let attempt=null,previous='';
    form.onsubmit=async e=>{e.preventDefault();if(save.disabled)return;
      const input={op:'followup',ref:row.ref,state:state.value,text:note.value.trim(),threadId:target.value.trim()};
      const signature=JSON.stringify(input);if(signature!==previous){attempt={...input,requestId:crypto.randomUUID()};previous=signature;}
      if(await mutate(attempt,save))await show(row.ref);
    };return form;
  }
  async function show(id){
    const n=++detailVersion;selected=id;const type=kind;detail.replaceChildren();notice.textContent='';
    try{
      const data=await call(type==='threads'?{op:'read',id}:{op:'request',ref:id});if(n!==detailVersion)return;
      if(type==='threads'){
        const row=data.thread;detail.append(el('h3',l('Conversation','Samtale')),el('p',row.id),el('p',stateLabel(row.state)));
        const hist=el('ol',null,'nwf-history');hist.append(...row.messages.map(renderMessage));detail.append(hist);
        let earlier=row.earlier;
        if(earlier){const more=button(l('Earlier messages','Tidligere meldinger'),async()=>{more.disabled=true;try{
          const page=await call({op:'read',id,before:earlier});if(n!==detailVersion)return;
          hist.prepend(...page.thread.messages.map(renderMessage));earlier=page.thread.earlier;if(!earlier)more.remove();
        }catch(e){notice.textContent=errorText(e);}finally{more.disabled=false;}},'nwf-link');detail.prepend(more);}
        if(row.state==='open')detail.append(compose(row));
        const toggle={op:'state',id,state:row.state==='open'?'closed':'open',requestId:crypto.randomUUID()};
        const change=button(row.state==='open'?l('Close conversation','Avslutt samtale'):l('Reopen conversation','Gjenåpne samtale'),async()=>{if(await mutate(toggle,change))await show(id);},'nwf-link');detail.append(change);
        for(const ref of row.requests)detail.append(button(ref,()=>{kind='requests';void showList();void show(ref);},'nwf-link'));
      } else {
        detail.append(el('h3',data.ref),el('p',stateLabel(data.state)+' · '+when(data.updatedAt)));
        const dl=el('dl',null,'nwf-review');
        for(const [field,value] of Object.entries(data.brief)){
          const {label,answer}=korvnt?serviceField(field,value):briefField(field,value);
          dl.append(el('dt',label),el('dd',answer));
        }
        detail.append(dl);
        for(const note of data.followups)detail.append(el('p',when(note.time)+' · '+note.text));
        detail.append(button(l('Open linked conversation','Åpne tilknyttet samtale'),()=>{kind='threads';void showList();void show(data.threadId);},'nwf-link'),followup(data));
      }
    }catch(e){if(n===detailVersion)notice.textContent=errorText(e);}
  }
  void showList();
  return {refresh(){void showList();if(selected)void show(selected);},clear(){listVersion++;detailVersion++;available=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);root.replaceChildren();}};
}

function serviceField(field,value){
  const fields={kind:l('Service','Tjeneste'),summary:l('Summary','Kort beskrivelse'),email:l('Contact email','E-postadresse')};
  const services={cybersecurity:l('Cybersecurity','Cybersikkerhet'),'website-security':l('Website security','Nettsidesikkerhet'),'account-security':l('Account security','Kontosikkerhet'),'website-design':l('Website building and design','Nettsidebygging og design'),'asset-recovery':l('Asset-recovery assistance','Bistand ved tap etter nettkriminalitet')};
  return {label:fields[field]||field,answer:field==='kind'?(services[value]||value):value};
}
export {mountWorkflowInbox as mountOperator};
