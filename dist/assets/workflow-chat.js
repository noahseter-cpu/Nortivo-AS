import {el,button,formField,l,api,connect,session,saved,onIdentityChange,errorText,messageNode,stateLabel} from './workflow-client.js';

export function mountChat(home) {
  const inSpec=Boolean(home.closest('.iv-spec'));
  const root=el('div',null,'nwf-card nwf-chat');
  const heading=el('h3',inSpec?l('Ask Nortivo','Spør Nortivo'):l('Support conversation','Samtale med kundestøtte'));
  const headingRow=el('div',null,'iv-chat-heading'), presence=el('span',null,'iv-presence');
  if(inSpec){headingRow.append(heading,presence);presence.hidden=true;}
  home.append(root);

  const offline=l('Leave a message for the support team.','Legg igjen en melding til kundestøtte.');
  const availability=el('p',offline,'nwf-muted'), controls=el('div',null,'nwf-line');
  const linked=el('p',null,'nwf-muted'), history=el('ol',null,'nwf-history');
  const earlier=button(l('Earlier messages','Tidligere meldinger'),()=>load({older:true}),'nwf-link');
  const status=el('p',null,'nwf-status');status.setAttribute('role','status');
  const form=el('form'), input=el('textarea');input.rows=3;input.maxLength=2400;input.required=true;
  const send=el('button',l('Send message','Send melding'),'nwf-primary');send.type='submit';
  const actions=el('div',null,'nwf-actions');
  const refresh=button(l('Refresh','Oppdater'),()=>load({fresh:true,manual:true}),'nwf-link');
  actions.append(send,refresh);form.append(formField(l('Your message','Meldingen din'),input),actions);
  const privacy=el('p',l('Leave out passwords, keys and account balances.','Utelat passord, nøkler og kontosaldo.'),'nwf-muted');
  root.append(inSpec?headingRow:heading,availability,controls,linked,earlier,history,form,status,privacy);
  earlier.hidden=linked.hidden=true;

  let selected=null, messages=[], before=null, loaded=false, threadState=null, readVersion=0, reading=false, selectionVersion=0;
  let drafts=new Map(), references=new Map(), availabilityExpiry, feedbackText='',feedbackAction=null,feedbackKey;
  function composer(id=selected){
    const key=id||'';
    if(!drafts.has(key)) drafts.set(key,{draft:'',pending:null});
    return drafts.get(key);
  }
  function stash(){
    if(!session)return;
    const composers=Object.fromEntries([...drafts].filter(([,entry])=>entry.draft||entry.pending).map(([key,{draft,pending}])=>[key,{draft,pending}]));
    saved.set(session.scope+'.chat',{selected,composers});
  }
  input.addEventListener('input',()=>{composer().draft=input.value;stash();});

  function feedback(text='',action=null,key){
    if(text===feedbackText && action===feedbackAction && key===feedbackKey)return;
    feedbackText=text;feedbackAction=action;feedbackKey=key;
    status.textContent=text;
    if(action)status.append(' ',action);
  }
  let previousContext;
  function threadLabel(id,index){
    return references.get(id)?.join(' · ')||l('Conversation ','Samtale ')+(index+1);
  }
  function showContext(force=false){
    const index=session?.threads.indexOf(selected)??-1;
    const detail={threadId:loaded?selected:null,open:loaded&&threadState==='open',requests:loaded?[...(references.get(selected)||[])]:[],
      label:loaded&&index>=0?threadLabel(selected,index):''};
    const key=JSON.stringify(detail);
    if(force||key!==previousContext){
      previousContext=key;
      document.dispatchEvent(new CustomEvent('nortivo:workflow-chat-context',{detail}));
    }
  }
  function resetView(){
    readVersion++;selectionVersion++;reading=false;
    messages=[];before=null;threadState=null;loaded=false;
    history.replaceChildren();earlier.hidden=linked.hidden=true;
    feedback();showComposer();showContext();
  }
  function select(id){
    if(id!==selected){selected=id;resetView();stash();}
    updateOptions();
  }
  function restore(){
    // Input typed before the first bootstrap belongs only to this new view, never to a later identity.
    const unsaved=!previouslyConnected?composer().draft:'';
    previouslyConnected=true;
    const item=session?saved.get(session.scope+'.chat')||{}:{};
    drafts=new Map(Object.entries(item.composers||{}));references=new Map();
    selected=session?.threads.includes(item.selected)?item.selected:null;
    if(!item.composers&&(item.pending||item.draft)){
      // Older clients saved a single composer. Preserve the original pending command for replay.
      const key=item.pending?.id||selected||'';
      drafts.set(key,{pending:item.pending||null,draft:item.draft||''});
    }
    if(unsaved&&!composer().draft)composer().draft=unsaved;
    picker.replaceChildren();pickerField.hidden=true;claim.hidden=true;
    clearTimeout(availabilityExpiry);presence.hidden=true;availability.textContent=offline;
    resetView();
  }

  const picker=el('select');
  const pickerField=formField(l('Conversation history','Samtalehistorikk'),picker);
  picker.onchange=()=>{select(picker.value||null);void load();};
  const claim=button(l('Link this browser’s guest conversation to my verified account','Knytt nettleserens gjestesamtale til min bekreftede konto'),async()=>{
    const scope=session?.scope;
    claim.disabled=true;
    try{
      const result=await api('chat',{op:'claim',requestId:crypto.randomUUID()});
      if(scope!==session?.scope)return;
      select(result.threadId);await load({fresh:true});
    }catch(error){if(scope===session?.scope)feedback(errorText(error));}
    finally{claim.disabled=false;}
  },'nwf-link');
  pickerField.hidden=claim.hidden=true;controls.append(pickerField,claim);
  function updateOptions(){
    const includeUnconfirmed=Boolean(drafts.get('')?.pending);
    const ids=includeUnconfirmed?['',...(session?.threads||[])]:session?.threads||[];
    pickerField.hidden=ids.length<2;
    const old=Array.from(picker.options);
    // Keep the actual focusable select and unchanged options, even during a background poll.
    if(!pickerField.hidden){
      ids.forEach((id,i)=>{
        const option=old[i]||el('option');
        const label=id?threadLabel(id,includeUnconfirmed?i-1:i):l('Unconfirmed message','Ubekreftet melding');
        if(option.value!==id)option.value=id;
        if(option.textContent!==label)option.textContent=label;
        if(!old[i])picker.append(option);
      });
      for(const option of old.slice(ids.length))option.remove();
      picker.value=selected??(includeUnconfirmed?'':ids.at(-1));
    }
    claim.hidden=!session?.canClaim;
  }
  function updateAvailability(){
    clearTimeout(availabilityExpiry);
    const remaining=(session?.availabilityValidUntil||0)-performance.now();
    const online=session?.availability==='online'&&remaining>0;
    const unknown=session?.availability==='unknown';
    const text=online?l('Online · A support operator is available.','Pålogget · En medarbeider er tilgjengelig.'):
      unknown?l('Availability could not be checked.','Tilgjengeligheten kunne ikke sjekkes.'):offline;
    if(availability.textContent!==text)availability.textContent=text;
    presence.hidden=!inSpec||unknown;
    if(!presence.hidden){
      const label=online?l('Online','Pålogget'):l('Offline','Frakoblet');
      if(presence.textContent!==label)presence.textContent=label;
      presence.dataset.state=online?'online':'offline';
    }
    if(online)availabilityExpiry=setTimeout(updateAvailability,remaining);
  }
  const retry=button(l('Retry same message','Prøv samme melding igjen'),()=>transmit(),'nwf-link');
  const start=button(l('Start a new conversation','Start en ny samtale'),async()=>{
    const scope=session?.scope,view=selectionVersion;
    start.disabled=true;
    try{
      const res=await api('chat',{op:'start',requestId:crypto.randomUUID()});
      if(scope!==session?.scope||view!==selectionVersion)return;
      select(res.threadId);await load({fresh:true});
    }catch(error){if(scope===session?.scope&&view===selectionVersion)feedback(errorText(error));}
    finally{start.disabled=false;}
  },'nwf-link');
  start.hidden=true;actions.append(start);
  function showComposer(){
    const entry=composer();
    if(input.value!==entry.draft)input.value=entry.draft;
    const closed=threadState==='closed';
    start.hidden=!closed;
    input.disabled=closed&&!entry.draft;input.readOnly=closed||Boolean(entry.sending);send.disabled=closed||Boolean(entry.sending);
    if(entry.sending)feedback(l('Sending…','Sender …'));
    else if(entry.pending)feedback(l('Last message has no confirmation. Retry to check or send it.','Siste melding mangler bekreftelse. Prøv igjen for å sjekke eller sende.'),retry);
    else if(closed)feedback(stateLabel('closed'));
    else if(feedbackAction===retry||feedbackText===stateLabel('closed'))feedback();
  }
  let previouslyConnected=false;
  onIdentityChange(restore);
  if(session)restore();

  function applyHistory(t,older){
    const page=t?.messages||[],oldLast=messages.at(-1)?.seq||0;
    const scroll=history.scrollTop, oldHeight=history.scrollHeight;
    const atBottom=oldHeight-scroll-history.clientHeight<20;
    if(!messages.length||page.length&&page[0].seq>oldLast+1){
      if(!loaded||page.length){
        messages=page;
        history.replaceChildren(...messages.map(message=>messageNode(message)));
        if(!messages.length)history.append(el('li',l('Your conversation will appear here.','Samtalen din vil vises her.'),'nwf-empty'));
      }
    }else if(older){
      const preceding=page.filter(message=>message.seq<messages[0].seq);
      messages=[...preceding,...messages];history.prepend(...preceding.map(message=>messageNode(message)));
    }else{
      const additions=page.filter(message=>message.seq>oldLast);
      if(additions.length){messages.push(...additions);history.append(...additions.map(message=>messageNode(message)));}
    }
    before=messages[0]?.seq>1?messages[0].seq:null;earlier.hidden=!before;
    if(older)history.scrollTop=scroll+history.scrollHeight-oldHeight;
    else if(atBottom)history.scrollTop=history.scrollHeight;
    return loaded&&!older&&page.some(message=>message.seq>oldLast&&message.role==='operator');
  }

  async function load({older=false,fresh=false,manual=false}={}){
    if(older&&!before)return;
    const atStart=selectionVersion;
    // Bootstrap may restore the first identity; all other context changes invalidate this read.
    if(!session){
      try{await connect();}catch(error){if(!session)feedback(errorText(error));return;}
      if(!session||selectionVersion>atStart+1)return;
      fresh=false; // This bootstrap already contains current identity and availability.
    }
    const generation=++readVersion,scope=session.scope;
    reading=true;
    try{
      if(fresh)await connect(true);
      if(generation!==readVersion||session?.scope!==scope)return;
      updateOptions();updateAvailability();
      if(!selected&&composer().pending){
        // A first send can lose its acknowledgement. Only its original receipt identifies
        // the destination, even when a different case has since become the latest thread.
        loaded=true;showComposer();showContext();return;
      }
      const id=selected||session.threads.at(-1)||null;
      const result=await api('chat',{op:'read',...(id?{id}:{}),...(older?{before}:{})});
      if(generation!==readVersion||session?.scope!==scope)return;
      const t=result.thread;
      if(id&&t?.id!==id)return;
      if(!selected&&t){
        // A restored, id-less send keeps its original command body (including the missing id).
        if(drafts.has('')&&!drafts.has(t.id))drafts.set(t.id,drafts.get(''));
        drafts.delete('');selected=t.id;stash();
      }
      if(t&&!session.threads.includes(t.id))session.threads.push(t.id);
      const newReply=applyHistory(t,older);
      loaded=true;threadState=t?.state||null;
      if(t)references.set(t.id,t.requests||[]);
      const refs=references.get(selected)||[];
      linked.hidden=!refs.length;
      const caption=refs.length?(refs.length===1?l('Linked request: ','Tilknyttet forespørsel: '):l('Linked requests: ','Tilknyttede forespørsler: '))+refs.join(' · '):'';
      if(linked.textContent!==caption)linked.textContent=caption;
      if(!composer().pending&&!composer().sending&&threadState!=='closed'){
        if(newReply)feedback(l('New support reply received.','Nytt svar fra kundestøtte.'),null,t.count??messages.at(-1)?.seq);
        else if(manual)feedback(l('History refreshed.','Historikken er oppdatert.'));
      }
      updateOptions();showComposer();showContext();
    }catch(error){
      if(generation!==readVersion||session?.scope!==scope)return;
      clearTimeout(availabilityExpiry);presence.hidden=true;availability.textContent=l('Availability could not be checked.','Tilgjengeligheten kunne ikke sjekkes.');
      if(!composer().pending)feedback(errorText(error));
      showComposer();
    }finally{if(generation===readVersion)reading=false;}
  }
  async function transmit(){
    const entry=composer(),submitted=entry.pending,id=selected,scope=session?.scope;
    if(!submitted||entry.sending||!scope)return;
    readVersion++;reading=false;
    entry.sending=true;showComposer();
    try{
      const result=await api('chat',submitted);
      if(scope!==session?.scope)return;
      entry.pending=null;
      if(entry.draft.trim()===submitted.text)entry.draft='';
      if(!session.threads.includes(result.threadId))session.threads.push(result.threadId);
      if(!id&&drafts.get('')===entry){
        drafts.delete('');
        if(!drafts.has(result.threadId))drafts.set(result.threadId,entry);
        if(!selected)select(result.threadId);
      }
      stash();
      if(composer()===entry)feedback(l('Message confirmed.','Meldingen er bekreftet.'));
    }catch(error){
      if(scope!==session?.scope)return;
      if(error.code==='THREAD_CLOSED'){entry.pending=null;stash();}
      if(composer()===entry)feedback(errorText(error));
    }
    finally{
      entry.sending=false;
      if(scope===session?.scope&&composer()===entry){showComposer();await load();}
    }
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    const view=selectionVersion,wasConnected=Boolean(session);
    try{
      await connect();
      if(wasConnected&&view!==selectionVersion)return;
      const entry=composer();
      if(!entry.pending){
        const text=input.value.trim();if(!text||threadState==='closed')return;
        entry.draft=input.value;
        const id=selected||session.threads.at(-1);
        if(id&&!selected){drafts.set(id,entry);drafts.delete('');select(id);}
        entry.pending={op:'send',text,requestId:crypto.randomUUID(),...(id?{id}:{})};stash();
      }
      await transmit();
    }catch(error){feedback(errorText(error));}
  };

  const dialog=el('dialog',null,'nwf-dialog nwf-chat-dialog');dialog.setAttribute('aria-label',l('Support conversation','Samtale med kundestøtte'));
  const close=button(l('Close conversation','Lukk samtalen'),()=>dialog.close(),'nwf-close');dialog.append(close);document.body.append(dialog);
  let trigger;
  dialog.addEventListener('close',()=>{home.append(root);trigger?.focus();});
  document.addEventListener('click',event=>{
    const source=event.target.closest('[data-nortivo-chat-launch]');if(!source)return;
    event.preventDefault();trigger=source;dialog.append(root);if(!dialog.open)dialog.showModal();
    void load({fresh:true}).then(()=>{
      if(dialog.open&&source===trigger&&source.dataset.nortivoTopic==='research'&&!input.value&&!composer().pending){
        input.value=l('I have a research enquiry about ','Jeg har et spørsmål om analyse av ');composer().draft=input.value;stash();
      }
    });
    input.focus();
  });
  document.addEventListener('nortivo:workflow-thread',event=>{select(event.detail);void load();});
  document.addEventListener('nortivo:workflow-chat-context-request',()=>{showContext(true);if(!loaded&&!reading&&!home.closest('[hidden]'))void load();});
  const visible=()=>!document.hidden&&(dialog.open||!home.closest('[hidden]')&&home.getBoundingClientRect().bottom>0&&home.getBoundingClientRect().top<innerHeight);
  const background=()=>{if(visible()&&!reading&&!composer().sending)void load({fresh:true});};
  window.addEventListener('online',background);
  window.addEventListener('pageshow',e=>{if(e.persisted)background();});
  document.addEventListener('visibilitychange',()=>{if(visible())background();});
  setInterval(()=>{if(visible())background();},20000);
  const observer=new IntersectionObserver(items=>{if(items.some(i=>i.isIntersecting)&&visible()&&!loaded&&!reading)void load();});observer.observe(home);
}
