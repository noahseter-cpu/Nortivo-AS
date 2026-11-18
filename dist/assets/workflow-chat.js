import {el,button,formField,l,api,connect,session,saved,onIdentityChange,errorText,messageNode,stateLabel} from './workflow-client.js';

export function mountChat(home) {
  const inSpec=Boolean(home.closest('.iv-spec'));
  const root=el('div',null,'nwf-card nwf-chat'), heading=el('h3',inSpec?l('Ask Nortivo','Spør Nortivo'):l('Support conversation','Samtale med kundestøtte'));
  const headingRow=el('div',null,'iv-chat-heading'), presence=el('span',null,'iv-presence');
  if(inSpec){headingRow.append(heading,presence);presence.hidden=true;}
  home.append(root);
  const availability=el('p',l('Leave a message for the support team.','Legg igjen en melding til kundestøtte.'),'nwf-muted');
  const controls=el('div',null,'nwf-line'), history=el('ol',null,'nwf-history');
  const earlier=button(l('Earlier messages','Tidligere meldinger'),()=>load(true),'nwf-link');
  const status=el('p',null,'nwf-status');status.setAttribute('role','status');
  const form=el('form'), input=el('textarea');input.rows=3;input.maxLength=2400;input.required=true;
  const send=el('button',l('Send message','Send melding'),'nwf-primary');send.type='submit';
  const actions=el('div',null,'nwf-actions');
  const refresh=button(l('Refresh','Oppdater'),()=>load(false,true),'nwf-link');
  actions.append(send,refresh);form.append(formField(l('Your message','Meldingen din'),input),actions);
  const privacy=el('p',l('Leave out passwords, keys and account balances.','Utelat passord, nøkler og kontosaldo.'),'nwf-muted');
  root.append(inSpec?headingRow:heading,availability,controls,earlier,history,form,status,privacy);earlier.hidden=true;
  let selected=null, next=null, messages=[], version=0, saving=false, pending=null,loaded=false,availabilityExpiry;
  const stash=()=>{if(session)saved.set(session.scope+'.chat',{selected,pending,draft:input.value});};
  input.addEventListener('input',stash);
  const reset=()=>{
    version++;const item=session?saved.get(session.scope+'.chat')||{}:{};
    selected=item.selected||null;pending=item.pending||null;input.value=item.draft||'';messages=[];
    history.replaceChildren();controls.replaceChildren();status.textContent='';earlier.hidden=true;presence.hidden=true;loaded=false;
  };
  onIdentityChange(reset);
  function controlsFor(){
    controls.replaceChildren();
    clearTimeout(availabilityExpiry);
    const remaining=(session?.availabilityValidUntil||0)-performance.now();
    const offline=l('Leave a message for the support team.','Legg igjen en melding til kundestøtte.');
    presence.hidden=true;
    if(session?.availability==='online'&&remaining>0){
      availability.textContent=l('Online · A support operator is available.','Pålogget · En medarbeider er tilgjengelig.');
      if(inSpec){presence.textContent=l('Online','Pålogget');presence.dataset.state='online';presence.hidden=false;}
      availabilityExpiry=setTimeout(()=>{availability.textContent=offline;presence.hidden=true;},remaining);
    }else {
      availability.textContent=session?.availability==='unknown'?l('Availability could not be checked.','Tilgjengeligheten kunne ikke sjekkes.'):offline;
      if(inSpec&&session?.availability==='asynchronous'){
        presence.textContent=l('Offline','Frakoblet');presence.dataset.state='offline';presence.hidden=false;
      }
    }
    if(session?.threads.length>1){
      const pick=el('select');session.threads.forEach((id,i)=>{const o=el('option',l('Conversation ','Samtale ')+(i+1));o.value=id;pick.append(o);});
      pick.value=selected||session.threads.at(-1);
      pick.onchange=()=>{selected=pick.value;pending=null;input.value='';stash();void load();};
      controls.append(formField(l('Conversation history','Samtalehistorikk'),pick));
    }
    if(session?.canClaim) controls.append(button(l('Link this browser’s guest conversation to my verified account','Knytt nettleserens gjestesamtale til min bekreftede konto'),async()=>{
      try{const result=await api('chat',{op:'claim',requestId:crypto.randomUUID()});selected=result.threadId;await connect(true);await load();}
      catch(error){status.textContent=errorText(error);}
    },'nwf-link'));
  }
  function pendingView() {
    if(!pending)return;
    status.textContent=l('Last message has no confirmation. Retry to check or send it.','Siste melding mangler bekreftelse. Prøv igjen for å sjekke eller sende.');
    status.append(' ',button(l('Retry same message','Prøv samme melding igjen'),()=>transmit(),'nwf-link'));
  }
  async function load(older=false,fresh=false) {
    try {
      await connect(fresh);controlsFor();const gen=++version;
      const result=await api('chat',{op:'read',...(selected?{id:selected}:{}),...(older&&next?{before:next}:{})});
      if(gen!==version || saving)return;
      loaded=true;const t=result.thread;
      if(t)selected=t.id;
      if(t?.id && !session.threads.includes(t.id))session.threads.push(t.id);
      const scroll=history.scrollTop, oldHeight=history.scrollHeight, atBottom=history.scrollHeight-history.scrollTop-history.clientHeight<20;
      const newest=t?.messages||[];
      messages=older?[...newest,...messages]:messages.length&&newest.length&&messages.at(-1).seq>=newest[0].seq-1?
        [...messages.filter(m=>m.seq<newest[0].seq),...newest]:newest;
      next=messages[0]?.seq>1?messages[0].seq:null;earlier.hidden=!next;
      history.replaceChildren(...messages.map(message=>messageNode(message)));
      if(!messages.length) history.append(el('li',l('Your conversation will appear here.','Samtalen din vil vises her.'),'nwf-empty'));
      if(older) history.scrollTop=scroll+history.scrollHeight-oldHeight;else if(atBottom)history.scrollTop=history.scrollHeight;
      send.disabled=t?.state==='closed';input.disabled=send.disabled;
      if(t?.state==='closed'){
        status.textContent=stateLabel('closed');
        const start=button(l('Start a new conversation','Start en ny samtale'),async()=>{
          start.disabled=true;
          try{const res=await api('chat',{op:'start',requestId:crypto.randomUUID()});selected=res.threadId;status.textContent='';await load(false,true);}
          catch(error){status.textContent=errorText(error);}finally{start.disabled=false;}
        },'nwf-link');status.append(' ',start);
      }
      else if(!pending && fresh)status.textContent=l('History refreshed.','Historikken er oppdatert.');
      stash();pendingView();
    } catch(error){presence.hidden=true;availability.textContent=l('Availability could not be checked.','Tilgjengeligheten kunne ikke sjekkes.');status.textContent=errorText(error);pendingView();}
  }
  async function transmit() {
    if(saving||!pending)return;
    saving=true;send.disabled=true;input.readOnly=true;version++;
    status.textContent=l('Sending…','Sender …');
    try{
      const scope=session?.scope, submitted=pending;
      const result=await api('chat',submitted);
      if(!scope||scope!==session?.scope)return;
      selected=result.threadId;pending=null;
      if(input.value.trim()===submitted.text)input.value='';
      status.textContent=l('Message confirmed.','Meldingen er bekreftet.');stash();
    }catch(error){status.textContent=errorText(error);pendingView();}
    finally{saving=false;send.disabled=false;input.readOnly=false;}
    await load();
  }
  form.onsubmit=async event=>{
    event.preventDefault();if(saving)return;
    try{await connect();if(!pending){const text=input.value.trim();if(!text)return;pending={op:'send',text,requestId:crypto.randomUUID(),...(selected?{id:selected}:{})};stash();}await transmit();}
    catch(error){status.textContent=errorText(error);}
  };
  const dialog=el('dialog',null,'nwf-dialog nwf-chat-dialog');dialog.setAttribute('aria-label',l('Support conversation','Samtale med kundestøtte'));
  const close=button(l('Close conversation','Lukk samtalen'),()=>dialog.close(),'nwf-close');dialog.append(close);document.body.append(dialog);
  let trigger;
  dialog.addEventListener('close',()=>{home.append(root);trigger?.focus();});
  document.addEventListener('click',event=>{
    const source=event.target.closest('[data-nortivo-chat-launch]');if(!source)return;event.preventDefault();trigger=source;
    dialog.append(root);if(!dialog.open)dialog.showModal();void load(false,true).then(()=>{
      if(source.dataset.nortivoTopic==='research'&&!input.value&&!pending){input.value=l('I have a research enquiry about ','Jeg har et spørsmål om analyse av ');stash();}
    });
    input.focus();
  });
  document.addEventListener('nortivo:workflow-thread',event=>{selected=event.detail;void load();});
  const visible=()=>!document.hidden&&(dialog.open||home.getBoundingClientRect().bottom>0&&home.getBoundingClientRect().top<innerHeight);
  window.addEventListener('online',()=>load(false,true));
  window.addEventListener('pageshow',e=>{if(e.persisted)void load(false,true);});
  document.addEventListener('visibilitychange',()=>{if(visible())void load(false,true);});
  setInterval(()=>{if(visible()&&!saving)void load(false,true);},20000);
  const observer=new IntersectionObserver(items=>{if(items.some(i=>i.isIntersecting)&&!loaded)void load();});observer.observe(home);
}
