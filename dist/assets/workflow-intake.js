import {l,el,button,formField,when,api,connect,session,saved,onIdentityChange,errorText,stateLabel} from './workflow-client.js';

const steps=[l('Goal','Mål'),l('Requirements','Krav'),l('Project details','Prosjektdetaljer'),l('Review','Gjennomgang')];
const kinds={bot:l('Crypto trading bot','Kryptobot'),engine:l('Custom trading engine','Egen handelsmotor')};
const undecided=l('Undecided','Uavklart');
const labels={
  kind:l('System type','Systemtype'),goal:l('What should the system help you do?','Hva skal systemet hjelpe deg med?'),
  existing:l('Existing idea, strategy or system','Eksisterende idé, strategi eller system'),market:l('Crypto market or exchange to explore','Kryptomarked eller børs du vil undersøke'),components:l('Engine components you need','Motorkomponentene du trenger'),
  integration:l('Data sources or integrations','Datakilder eller integrasjoner'),analysis:l('Role of AI-assisted analysis','Rolle for KI-assistert analyse'),rules:l('Deterministic strategy rules','Faste strategiregler'),execution:l('Execution intentions','Ønsker om ordreutførelse'),safeguards:l('Risk limits and safeguards','Risikogrenser og sikkerhetstiltak'),name:l('Contact name','Kontaktnavn'),email:l('Contact email','E-post for kontakt'),
  deliverable:l('Expected deliverable','Ønsket leveranse'),budget:l('Indicative budget','Omtrentlig budsjett'),timeframe:l('Preferred timeframe','Ønsket tidsramme')
};
const options={kind:kinds,analysis:{undecided,none:l('No AI component','Ingen KI-komponent'),research:l('Research and analysis only','Kun analyse og research')},
  rules:{undecided,existing:l('Use my existing rules','Bruk mine eksisterende regler'),design:l('Scope rules with Nortivo','Avklare regler med Nortivo')},
  execution:{undecided,analysis:l('Analysis only','Kun analyse'),paper:l('Paper simulation','Simulert handel'),future:l('Discuss future execution requirements','Diskutere krav til eventuell ordreutførelse')}};
const max={goal:1800,existing:800,market:500,components:500,integration:500,safeguards:800,name:120,email:160,deliverable:800,budget:160,timeframe:160};
const groups=data=>[['kind','goal','existing'],[data.kind==='engine'?'components':'market','integration','analysis','rules','execution','safeguards'],['name','email','deliverable','budget','timeframe']];
const display=(key,val)=>options[key]?.[val]||val||'—';
export function briefField(field, value) {
  return {label:labels[field] || field, answer:display(field,value)};
}
const unset=value=>!value||value==='undecided'||['undecided','uavklart'].includes(String(value).toLowerCase());
const blanks=()=>({kind:'',goal:'',existing:'',analysis:'undecided',rules:'undecided',execution:'undecided',name:'',email:'',deliverable:'',budget:'',timeframe:'',market:'',components:'',integration:'',safeguards:''});

function draftBook(record) {
  if(record?.version===2 && record.drafts)return record;
  const activeKind=[record?.data?.kind,record?.locked?.brief?.kind,record?.receipt?.kind].find(k=>kinds[k])||'general';
  return {version:2,activeKind,drafts:record?{[activeKind]:record}:{}};
}
function hasWork(draft){
  return Boolean(draft && (draft.receipt || draft.locked || draft.step || Object.entries(draft.data||{}).some(([k,v])=>!['kind','email'].includes(k) && !unset(v))));
}

export function mountIntake(home,summary) {
  const specification=Boolean(home.closest('.iv-spec'));
  const root=el('div',null,'nwf-card nwf-intake');home.append(root);
  const notice=el('p',null,'nwf-status');notice.setAttribute('role','status');
  let data=blanks(),step=0,furthest=0,receipt=null,requestId=null,locked=null,busy=false,trackOpen=false,ready=false;
  let book=draftBook(null),slot='general',entryChoice=null,persisted=false,storageNote=null,availableThread='',threadLabel='',chosenThread='',syncChoice=null;
  let trackOnEntry=specification && globalThis.location?.hash==='#track';
  const key=()=>session.scope+'.intake';
  const storageText=()=>persisted?l('Draft saved in this browser tab.','Utkastet er lagret i denne nettleserfanen.'):l('Tab storage is unavailable. Your draft lasts only while this page stays open.','Fanen kan ikke lagre utkastet. Det beholdes bare så lenge denne siden er åpen.');
  function stash(){
    if(!ready||!session)return;
    book.drafts[slot]={data:{...data},step,furthest,receipt,requestId,locked};
    book.activeKind=slot;persisted=saved.set(key(),book);
    if(storageNote)storageNote.textContent=storageText();
  }
  function restore(to, draft=book.drafts[to]||{}){
    slot=to;data={...blanks(),...draft.data};
    if(kinds[to])data.kind=to;
    step=draft.step||0;furthest=draft.furthest||0;receipt=draft.receipt||null;
    requestId=draft.requestId||crypto.randomUUID();locked=draft.locked||null;chosenThread='';
    if(session.verifiedEmail)data.email=session.verifiedEmail;
  }
  function identityChanged(){
    ready=false;trackOpen=false;entryChoice=null;notice.textContent='';availableThread='';threadLabel='';chosenThread='';syncChoice=null;
    if(!session){data=blanks();step=0;furthest=0;receipt=null;locked=null;book=draftBook(null);render();return;}
    book=draftBook(saved.get(key()));
    const routeKind=home.dataset.service;
    if(kinds[routeKind] && routeKind!==book.activeKind && hasWork(book.drafts[book.activeKind])){
      entryChoice={previous:book.activeKind,wanted:routeKind};
    }
    restore(entryChoice?book.activeKind:kinds[routeKind]?routeKind:book.activeKind);
    ready=true;
    if(entryChoice || (!receipt&&!locked))stash();
    if(trackOnEntry){trackOnEntry=false;track();}else render();
  }
  function switchKind(to){
    if(!kinds[to]||slot===to)return;
    stash();
    // An untyped first draft can carry its goal into its first choice. A named
    // system draft retains its own fields, submission ID and receipt.
    const general=slot==='general'&&!book.drafts[to]?book.drafts.general:null;
    if(general)delete book.drafts.general;
    restore(to,general||book.drafts[to]);
    trackOpen=false;stash();
    if(home.dataset.service)syncViewPath(to);
    render();
    root.querySelector('input[name=kind]:checked')?.focus();
  }
  function briefName(k){return kinds[k]||l('General request','Generell forespørsel');}
  function briefPath(k,locale=document.documentElement.lang){
    return (locale==='nb'?'/nb/':'/en/')+(k==='general'?'request/':'systems/'+k+'/');
  }
  function syncViewPath(k){
    if(!specification || !globalThis.history)return;
    const route=k||home.dataset.service||'general',fragment=trackOpen?'#track':'';
    if(k){home.dataset.service=k==='general'?'':k;document.title=briefName(k)+' — Nortivo Invest';}
    const url=new URL(location.href);
    url.pathname=briefPath(route);url.hash=fragment;
    history.replaceState(history.state,'',url);
    for(const link of document.querySelectorAll('.iv-lang a[hreflang],head link[hreflang],head link[rel="canonical"]')){
      const target=new URL(link.href);target.pathname=briefPath(route,link.hreflang||document.documentElement.lang);
      target.hash=link.matches('.iv-lang a')?fragment:'';link.href=target.href;
    }
  }
  function openStored(k,event){
    if(persisted){
      book.activeKind=k;persisted=saved.set(key(),book);
      if(persisted)return; // Follow the real service URL, preserving Back and language switching.
    }
    event.preventDefault();entryChoice=null;restore(k);stash();syncViewPath(k);render();root.querySelector('h3')?.focus();
  }
  function chooseEntry(){
    const {previous,wanted}=entryChoice;
    const title=el('h3',l('Which brief would you like to open?','Hvilket utkast vil du åpne?'));title.tabIndex=-1;
    const info=el('p',l('This link is for ','Denne inngangen gjelder ')+briefName(wanted)+l('. You already have a brief for ','. Du har allerede et utkast for ')+briefName(previous)+'.');
    const requested=hasWork(book.drafts[wanted])?l('Continue ','Fortsett med '):l('Start a separate brief for ','Start et eget utkast for ');
    const wantedAction=button(requested+briefName(wanted),()=>{
      entryChoice=null;restore(wanted);stash();render();root.querySelector('h3')?.focus();
    },'nwf-primary');
    const previousLink=el('a',l('Continue ','Fortsett med ')+briefName(previous),'nwf-link');
    previousLink.href=briefPath(previous);previousLink.addEventListener('click',event=>openStored(previous,event));
    const actions=el('div',null,'nwf-entry-actions');actions.append(wantedAction,previousLink);
    root.append(title,info,actions);
  }
  function otherDrafts(){
    const other=Object.keys(book.drafts).filter(k=>k!==slot && hasWork(book.drafts[k]));
    if(!other.length)return;
    const region=el('div',null,'nwf-other-drafts');
    region.append(el('strong',l('Current brief: ','Åpent utkast: ')+briefName(slot)));
    for(const k of other){
      const link=el('a',l('Switch to ','Bytt til ')+briefName(k));
      link.href=briefPath(k);link.addEventListener('click',event=>openStored(k,event));
      region.append(link);
    }
    return region;
  }
  document.addEventListener('nortivo:workflow-chat-context',event=>{
    const {threadId,open,label,requests}=event.detail||{};
    const next=ready && open===true && typeof threadId==='string'?threadId:'';
    if(next!==availableThread)chosenThread='';
    availableThread=next;threadLabel=next?(label || (Array.isArray(requests)?requests.join(', '):'')):'';syncChoice?.();
  });
  onIdentityChange(identityChanged);
  function updateSummary(){
    if(!summary)return;
    summary.replaceChildren();
    summary.hidden=Boolean(entryChoice&&!trackOpen);
    if(summary.hidden)return;
    if(trackOpen||receipt){
      summary.append(el('h3',l('Following your request','Følg forespørselen din')));
      if(receipt && !trackOpen){
        summary.append(el('p',l('Nortivo has received your project brief for scoping. Keep the reference so you can return to this request.','Nortivo har mottatt prosjektbeskrivelsen for vurdering. Ta vare på referansen slik at du kan finne forespørselen igjen.')));
      }
      summary.append(el('p',l('Use the tracking form to see the latest status, read questions from the operator and open the linked conversation.','Bruk sporingsskjemaet for å se siste status, lese spørsmål fra operatøren og åpne den tilknyttede samtalen.')));
      return;
    }
    if(specification){
      summary.append(el('h3',l('Your project brief','Din prosjektbrief')));
      const table=el('dl',null,'iv-brief-table');
      const fields=[
        ['kind',l('System','System')],['analysis',l('AI','KI')],['execution',l('Execution','Utførelse')],
        data.kind==='engine'?['components',l('Components','Komponenter')]:['market',l('Market / exchange','Marked / børs')]
      ];
      for(const [field,label] of fields){
        const answer=unset(data[field])?l('To be clarified','Må avklares'):display(field,data[field]);
        const pair=el('div');pair.append(el('dt',label),el('dd',answer));table.append(pair);
      }
      summary.append(table);
      if(step===3){
        const unresolved=groups(data).flat().filter(field=>unset(data[field]));
        if(unresolved.length)summary.append(el('h4',l('Still to clarify','Gjenstår å avklare')),el('p',unresolved.map(field=>labels[field]).join(' · ')));
        summary.append(el('p',l('Nortivo will receive this brief for scoping. No order or trading permission is created.','Nortivo mottar beskrivelsen for å avklare omfanget. Innsendingen gir ingen bestilling eller handelstillatelse.'),'iv-brief-note'));
      }
      return;
    }
    summary.append(el('h3',l('Your project brief','Din prosjektbeskrivelse')));
    const picks=['kind','analysis','rules','execution'].filter(k=>!unset(data[k]));
    summary.append(el('p',picks.length?picks.map(k=>display(k,data[k])).join(' · '):l('Your choices appear here as you go.','Valgene dine vises her underveis.')));
    const unresolved=groups(data).flat().filter(k=>unset(data[k]));
    summary.append(el('h4',l('Still to clarify','Gjenstår å avklare')),el('p',unresolved.length?unresolved.map(k=>labels[k]).join(' · '):l('No open fields.','Alle felt er avklart.')));
    summary.append(el('h4',l('After submission','Etter innsending')),el('p',l('Nortivo receives your brief for scoping. Return with your reference to read questions and status updates.','Nortivo mottar beskrivelsen for å avklare omfanget. Bruk referansen for å lese spørsmål og statusoppdateringer.')));
    const help=button(l('Ask support','Spør kundestøtte'),()=>{},'nwf-link');help.dataset.nortivoChatLaunch='';summary.append(help);
  }
  function changeStep(next,focus=true){
    const form=root.querySelector('.nwf-stage');
    if(next>step && form && !form.reportValidity())return;
    if(next<step && form && !form.checkValidity())furthest=step;
    step=next;furthest=Math.max(furthest,next);notice.textContent='';stash();render();
    if(focus)root.querySelector('h3')?.focus();
  }
  function edit(key){
    if(key==='kind'&&specification){
      const field=el('fieldset',null,'nwf-type-options');
      field.append(el('legend',labels.kind));
      const choices=el('div');
      for(const [value,title] of Object.entries(kinds)){
        const input=el('input');input.type='radio';input.name='kind';input.value=value;input.required=true;input.checked=data.kind===value;
        const label=el('label');label.append(input,el('span',title));choices.append(label);
        input.addEventListener('change',()=>{
          switchKind(value);
        });
      }
      field.append(choices);return field;
    }
    let control;
    if(options[key]) {
      control=el('select');
      if(key==='kind'){const initial=el('option',l('Choose system','Velg system'));initial.value='';control.append(initial);}
      for(const [v,title] of Object.entries(options[key])){const op=el('option',title);op.value=v;control.append(op);}
    } else if(['goal','existing','safeguards','deliverable'].includes(key)){control=el('textarea');control.rows=key==='goal'?3:2;}
    else {control=el('input');control.type=key==='email'?'email':'text';}
    control.name=key;control.value=data[key]||'';control.required=true;if(max[key])control.maxLength=max[key];
    if(key==='email'){control.autocomplete='email';if(session?.verifiedEmail)control.readOnly=true;}
    if(key==='name')control.autocomplete='name';
    if(key==='goal')control.minLength=8;
    control.addEventListener('input',()=>{
      if(key==='kind'){switchKind(control.value);return;}
      data[key]=control.value;requestId=crypto.randomUUID();stash();updateSummary();
    });
    if(!options[key]&&!['goal','name','email'].includes(key)){
      const unsure=button(l('Mark undecided','Marker som uavklart'),()=>{control.value=undecided;control.dispatchEvent(new Event('input'));},'nwf-small');
      const block=el('div',null,'nwf-edit');
      if(specification){
        block.classList.add('nwf-field');
        const line=el('div',null,'nwf-field-toolbar'),label=el('label',labels[key]);
        control.id='nwf-brief-'+key;label.htmlFor=control.id;
        unsure.setAttribute('aria-label',l('Mark undecided','Marker som uavklart')+' · '+labels[key]);
        line.append(label,unsure);block.append(line,control);
      }else block.append(formField(labels[key],control),unsure);
      return block;
    }
    return formField(labels[key],control);
  }
  function review(form){
    for(const [i,keys] of groups(data).entries()){
      const editLabel=l('Edit ','Rediger ')+steps[i].toLowerCase();
      const line=el('div',null,'nwf-review-title');line.append(el('h4',steps[i]),button(editLabel,()=>changeStep(i),'nwf-link'));form.append(line);
      const dl=el('dl',null,'nwf-review');
      for(const k of keys){dl.append(el('dt',labels[k]),el('dd',display(k,data[k])));}form.append(dl);
    }
    const linkCheck=el('input');linkCheck.type='checkbox';linkCheck.name='linkConversation';linkCheck.id='nwf-link-conversation';
    const linkLabel=el('label',l('Use my open support conversation for this request','Bruk min åpne støttesamtale til denne forespørselen'));linkLabel.htmlFor=linkCheck.id;
    const linkHint=el('p',null,'nwf-muted');linkHint.id='nwf-link-conversation-help';linkCheck.setAttribute('aria-describedby',linkHint.id);
    const linkCopy=el('div');linkCopy.append(linkLabel,linkHint);
    const linkRow=el('div',null,'nwf-check nwf-conversation-choice');linkRow.append(linkCheck,linkCopy);
    form.append(linkRow);
    syncChoice=()=>{
      linkCheck.disabled=!availableThread;linkCheck.checked=Boolean(availableThread && chosenThread===availableThread);
      linkHint.textContent=availableThread?(threadLabel?threadLabel+'. ':'')+l('Leave unchecked to start a separate private conversation for this request.','La feltet stå tomt for å starte en egen privat samtale om forespørselen.'):l('Open a support conversation to link it here. Otherwise, this request starts its own private conversation.','Åpne en støttesamtale for å knytte den til forespørselen. Ellers får forespørselen en egen privat samtale.');
    };
    linkCheck.addEventListener('change',()=>{chosenThread=linkCheck.checked?availableThread:'';});
    syncChoice();
    document.dispatchEvent(new CustomEvent('nortivo:workflow-chat-context-request'));
    const ok=el('input');ok.type='checkbox';ok.required=true;ok.name='confirm';ok.id='nwf-confirm-brief';
    const label=el('label',l('Send this brief to request scoping or a proposal.','Send denne beskrivelsen for å be om avklaring eller tilbud.'));
    label.htmlFor=ok.id;
    const help=el('p',l('Financial access and trading require separate authorization.','Finansiell tilgang og handel krever egen godkjenning.'),'nwf-muted');
    help.id='nwf-confirm-brief-help';ok.setAttribute('aria-describedby',help.id);
    const copy=el('div');copy.append(label,help);
    const agree=el('div',null,'nwf-check');agree.append(ok,copy);form.append(agree);
  }
  async function submit(){
    if(busy || !ready)return;
    busy=true;
    if(!locked){
      const brief=Object.fromEntries(groups(data).flat().map(k=>[k,data[k].trim()]));
      locked={op:'submit',requestId,brief,confirmed:true};
      if(chosenThread && availableThread===chosenThread)locked.linkThreadId=chosenThread;
      stash();
    }
    const scope=session.scope;
    render();notice.textContent=l('Submitting…','Sender …');
    try {
      const res=await api('request',locked);
      if(scope!==session?.scope)return;
      receipt=res;locked=null;data=blanks();step=0;furthest=0;chosenThread='';stash();
      document.dispatchEvent(new CustomEvent('nortivo:workflow-thread',{detail:res.threadId}));
      notice.textContent=l('Submission confirmed.','Innsendingen er bekreftet.');
    } catch(error){
      if(scope!==session?.scope)return;
      const rejectedLink=Boolean(locked?.linkThreadId && (error.status===404 || ['THREAD_CLOSED','REQUEST_LIMIT'].includes(error.code)));
      const capacity=error.code==='THREAD_LIMIT';
      if(error.status===400 || error.status===403 || rejectedLink || capacity){locked=null;requestId=crypto.randomUUID();chosenThread='';stash();}
      if(capacity)notice.textContent=l('The conversation limit was reached. Choose an available open conversation or contact support. Your answers are kept.','Samtalegrensen er nådd. Velg en tilgjengelig åpen samtale eller kontakt kundestøtte. Svarene dine er beholdt.');
      else if(rejectedLink)notice.textContent=l('That conversation is no longer available for this request. Review your conversation choice and submit again.','Samtalen er ikke lenger tilgjengelig for forespørselen. Se over valget og send inn på nytt.');
      else notice.textContent=errorText(error);
    } finally{busy=false;render();}
  }
  function track(reference='',savedProof=''){
    trackOpen=true;syncViewPath();root.replaceChildren();updateSummary();
    const title=el('h3',l('Track a project request','Spor en prosjektforespørsel'));root.append(title);
    const form=el('form'), ref=el('input'), secret=el('input'), result=el('div',null,'nwf-track-result');
    ref.name='reference';ref.maxLength=19;ref.required=true;ref.value=reference;ref.autocomplete='off';
    secret.name='trackingProof';secret.type='password';secret.maxLength=43;secret.autocomplete='off';
    form.append(formField(l('Project reference','Prosjektreferanse'),ref),formField(l('Private tracking key (optional on the original browser or account)','Privat sporingsnøkkel (valgfri i opprinnelig nettleser eller konto)'),secret));
    const look=el('button',l('Check status','Sjekk status'),'nwf-primary');look.type='submit';
    form.append(look);root.append(form,result,button(l('Back to project request','Tilbake til prosjektforespørselen'),()=>{trackOpen=false;syncViewPath();render();},'nwf-link'));
    result.setAttribute('role','status');
    form.onsubmit=async e=>{e.preventDefault();look.disabled=true;
      try {
        const requestedRef=ref.value.trim().toUpperCase();
        const proof=secret.value.trim()||(requestedRef===reference?savedProof:'');
        const res=await api('request',{op:'track',ref:requestedRef,...(proof?{proof}:{})});
        result.replaceChildren(el('strong',stateLabel(res.state)),el('p',when(res.updatedAt)));
        for(const note of res.followups)result.append(el('p',when(note.time)+' · '+note.text));
        if(res.threadId){const h=button(l('Open linked conversation','Åpne tilknyttet samtale'),()=>document.dispatchEvent(new CustomEvent('nortivo:workflow-thread',{detail:res.threadId})),'nwf-link');h.dataset.nortivoChatLaunch='';result.append(h);}
      }catch(err){result.textContent=errorText(err);}finally{look.disabled=false;}
    };
  }
  function render(){
    if(trackOpen)return;
    root.replaceChildren();storageNote=null;syncChoice=null;updateSummary();
    if(!ready){
      root.append(el('p',l('Opening project workspace…','Åpner prosjektområdet …')),notice,button(l('Retry','Prøv igjen'),()=>init(),'nwf-link'));return;
    }
    if(entryChoice){chooseEntry();return;}
    if(receipt){
      root.append(el('h3',l('Project request received','Prosjektforespørselen er mottatt')),el('p',receipt.ref,'nwf-ref'));
      if(receipt.proof){
        const proof=el('input');proof.type='password';proof.readOnly=true;proof.autocomplete='off';proof.placeholder='••••••••';
        const showLabel=l('Show private key','Vis privat nøkkel'),hideLabel=l('Hide private key','Skjul privat nøkkel');
        const toggle=button(showLabel,()=>{
          const reveal=proof.type==='password';
          proof.type=reveal?'text':'password';proof.value=reveal?receipt.proof:'';
          toggle.textContent=reveal?hideLabel:showLabel;
          toggle.setAttribute('aria-expanded',String(reveal));
        },'nwf-link');
        proof.id='nwf-saved-tracking-key';toggle.setAttribute('aria-controls',proof.id);toggle.setAttribute('aria-expanded','false');
        root.append(formField(l('Private tracking key. Save it with your reference.','Privat sporingsnøkkel. Lagre den sammen med referansen.'),proof),toggle);
      }
      root.append(el('p',stateLabel(receipt.state)+' · '+when(receipt.createdAt)),button(l('Track this request','Spor forespørselen'),()=>track(receipt.ref,receipt.proof),'nwf-primary'),
        button(l('Start another brief','Start en ny beskrivelse'),()=>{restore(slot,{});stash();render();},'nwf-link'),notice);return;
    }
    if(locked){
      root.append(el('h3',l('Confirm project submission','Bekreft innsending')),el('p',l('The saved brief is ready to check with the original submission reference.','Den lagrede beskrivelsen kan sjekkes med samme innsendingsreferanse.')));
      const retry=button(l('Retry same submission','Prøv samme innsending igjen'),submit,'nwf-primary');retry.disabled=busy;root.append(retry,notice);return;
    }
    const alternatives=otherDrafts();if(alternatives)root.append(alternatives);
    const flow=el('div',null,'nwf-intake-flow'),rail=el('div',null,'nwf-step-rail'),stage=el('div',null,'nwf-stage-body');
    const span=el('p',l('Step ','Trinn ')+(step+1)+l(' of 4',' av 4'),'nwf-step-label');
    const title=el('h3',steps[step],'iv-step-heading');title.tabIndex=-1;
    const nav=el('nav',null,'nwf-steps');nav.setAttribute('aria-label',l('Project request steps','Trinn i prosjektforespørselen'));
    steps.forEach((s,i)=>{
      const dest=button(null,()=>changeStep(i));dest.append(el('span',s,'nwf-step-name'));dest.disabled=i>furthest;
      dest.setAttribute('aria-label',s);
      dest.dataset.step=String(i+1).padStart(2,'0');
      if(i===step)dest.setAttribute('aria-current','step');
      if(i!==step && i<=furthest)dest.className=i<furthest?'nwf-complete':'nwf-visited';
      nav.append(dest);
    });
    rail.append(span,nav);stage.append(title);flow.append(rail,stage);root.append(flow);
    const form=el('form');form.method='post';form.className='nwf-stage';
    if(step<3){
      if(specification&&step===1)form.append(edit('kind'));
      for(const key of groups(data)[step]){
        const field=edit(key);
        if(specification&&['market','components','integration','analysis','rules','name','email','budget','timeframe'].includes(key))field.classList.add('nwf-half');
        form.append(field);
      }
    }else review(form);
    if(step===1)form.append(el('p',l('Describe requirements only. Keep credentials, API keys and seed phrases private.','Beskriv bare kravene. Hold passord, API-nøkler og gjenopprettingsfraser private.'),'nwf-muted'));
    if(specification&&step===1){
      const intent=el('div',null,'nwf-workflow-intent');
      intent.append(el('strong',l('Proposed workflow','Ønsket arbeidsflyt')),el('p',l('Data → Rules → Risk checks → Simulation','Data → Regler → Risikokontroll → Simulering')));
      form.append(intent);
    }
    const actions=el('div',null,'nwf-actions');
    if(step)actions.append(button(l('Back','Tilbake'),()=>changeStep(step-1),'nwf-secondary'));
    const nextText=step===3?l('Submit project request','Send prosjektforespørsel'):specification?l('Continue to ','Videre til ')+steps[step+1].toLowerCase():l('Continue','Fortsett');
    const next=el('button',nextText,'nwf-primary');next.type='submit';actions.append(next);form.append(actions);
    form.onsubmit=event=>{event.preventDefault();if(step<3)changeStep(step+1);else void submit();};
    stage.append(form,notice);
    storageNote=el('p',storageText(),'nwf-muted nwf-storage-note');
    root.append(storageNote,button(l('Track an existing request','Spor en tidligere forespørsel'),()=>track(),'nwf-link'));
  }
  document.addEventListener('click',async e=>{
    const trigger=e.target.closest('[data-nortivo-service], [data-nortivo-track]');if(!trigger)return;
    try{
      await connect();
      if(trigger.hasAttribute('data-nortivo-track')){e.preventDefault();track();home.scrollIntoView();return;}
      const kind=trigger.dataset.nortivoService;if(!kinds[kind]||locked||receipt)return;
      switchKind(kind);home.scrollIntoView();
    }catch(err){notice.textContent=errorText(err);}
  });
  globalThis.addEventListener?.('hashchange',()=>{
    if(!specification || globalThis.location.hash!=='#track')return;
    if(ready)track();else trackOnEntry=true;
  });
  async function init(){try{await connect();if(session&&!ready)identityChanged();}catch(error){notice.textContent=errorText(error);render();}}
  render();void init();
}
