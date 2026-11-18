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

export function mountIntake(home,summary) {
  const specification=Boolean(home.closest('.iv-spec'));
  const root=el('div',null,'nwf-card nwf-intake');home.append(root);
  const notice=el('p',null,'nwf-status');notice.setAttribute('role','status');
  let data=blanks(),step=0,furthest=0,receipt=null,requestId=null,locked=null,busy=false,trackOpen=false,ready=false;
  const key=()=>session.scope+'.intake';
  function stash(){if(ready&&session)saved.set(key(),{data,step,furthest,receipt,requestId,locked});}
  onIdentityChange(()=>{
    if(!session){ready=false;data=blanks();step=0;receipt=null;locked=null;trackOpen=false;notice.textContent='';render();return;}
    const draft=saved.get(key())||{};data={...blanks(),...draft.data};step=draft.step||0;furthest=draft.furthest||0;receipt=draft.receipt||null;requestId=draft.requestId||crypto.randomUUID();locked=draft.locked||null;
    if(!data.kind && kinds[home.dataset.service])data.kind=home.dataset.service;
    if(session.verifiedEmail)data.email=session.verifiedEmail;
    ready=true;trackOpen=false;notice.textContent='';render();
  });
  function updateSummary(){
    if(!summary)return;
    summary.replaceChildren();
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
        table.append(el('dt',label),el('dd',answer));
      }
      summary.append(table,el('p',l('Draft in this browser tab.','Utkast i denne nettleserfanen.'),'iv-brief-note'));
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
    step=next;furthest=Math.max(furthest,next);notice.textContent='';stash();render();
    if(focus)root.querySelector(specification ? '[aria-current=step]' : 'h3')?.focus();
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
          data.kind=value;requestId=crypto.randomUUID();stash();updateSummary();
          if(step===1){render();root.querySelector('input[name=kind]:checked')?.focus();}
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
      const line=el('div',null,'nwf-review-title');line.append(el('h4',steps[i]),button(l('Edit','Rediger'),()=>changeStep(i),'nwf-link'));form.append(line);
      const dl=el('dl',null,'nwf-review');
      for(const k of keys){dl.append(el('dt',labels[k]),el('dd',display(k,data[k])));}form.append(dl);
    }
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
      locked={op:'submit',requestId,brief,confirmed:true};stash();
    }
    const scope=session.scope;
    render();notice.textContent=l('Submitting…','Sender …');
    try {
      const res=await api('request',locked);
      if(scope!==session?.scope)return;
      receipt=res;locked=null;data=blanks();step=0;furthest=0;stash();
      document.dispatchEvent(new CustomEvent('nortivo:workflow-thread',{detail:res.threadId}));
      notice.textContent=l('Submission confirmed.','Innsendingen er bekreftet.');
    } catch(error){
      if(error.status===400||error.status===403){locked=null;stash();}
      notice.textContent=errorText(error);
    } finally{busy=false;render();}
  }
  function track(reference='',savedProof=''){
    trackOpen=true;root.replaceChildren();updateSummary();
    const title=el('h3',l('Track a project request','Spor en prosjektforespørsel'));root.append(title);
    const form=el('form'), ref=el('input'), secret=el('input'), result=el('div',null,'nwf-track-result');
    ref.name='reference';ref.maxLength=19;ref.required=true;ref.value=reference;ref.autocomplete='off';
    secret.name='trackingProof';secret.type='password';secret.maxLength=43;secret.autocomplete='off';
    form.append(formField(l('Project reference','Prosjektreferanse'),ref),formField(l('Private tracking key (optional on the original browser or account)','Privat sporingsnøkkel (valgfri i opprinnelig nettleser eller konto)'),secret));
    const look=el('button',l('Check status','Sjekk status'),'nwf-primary');look.type='submit';
    form.append(look);root.append(form,result,button(l('Back to project request','Tilbake til prosjektforespørselen'),()=>{trackOpen=false;render();},'nwf-link'));
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
    root.replaceChildren();updateSummary();
    if(!ready){
      root.append(el('p',l('Opening project workspace…','Åpner prosjektområdet …')),notice,button(l('Retry','Prøv igjen'),()=>init(),'nwf-link'));return;
    }
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
        button(l('Start another brief','Start en ny beskrivelse'),()=>{receipt=null;data=blanks();data.email=session?.verifiedEmail||'';requestId=crypto.randomUUID();stash();render();},'nwf-link'),notice);return;
    }
    if(locked){
      root.append(el('h3',l('Confirm project submission','Bekreft innsending')),el('p',l('The saved brief is ready to check with the original submission reference.','Den lagrede beskrivelsen kan sjekkes med samme innsendingsreferanse.')));
      const retry=button(l('Retry same submission','Prøv samme innsending igjen'),submit,'nwf-primary');retry.disabled=busy;root.append(retry,notice);return;
    }
    const span=el('div',null,'nwf-step-label');span.append(el('span',l('Step ','Trinn ')+(step+1)+' / 4'));
    const title=el('h3',steps[step],specification?'iv-step-heading':'');title.tabIndex=-1;root.append(span,title);
    const nav=el('nav',null,'nwf-steps');nav.setAttribute('aria-label',l('Project request steps','Trinn i prosjektforespørselen'));
    steps.forEach((s,i)=>{const dest=button(s,()=>changeStep(i));dest.disabled=i>furthest||i>step;if(i===step)dest.setAttribute('aria-current','step');nav.append(dest);});root.append(nav);
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
    root.append(form,notice,el('p',l('Draft saved in this browser tab.','Utkastet lagres i denne nettleserfanen.'),'nwf-muted'),button(l('Track an existing request','Spor en tidligere forespørsel'),()=>track(),'nwf-link'));
  }
  document.addEventListener('click',async e=>{
    const trigger=e.target.closest('[data-nortivo-service], [data-nortivo-track]');if(!trigger)return;
    try{
      await connect();
      if(trigger.hasAttribute('data-nortivo-track')){e.preventDefault();track();home.scrollIntoView();return;}
      const kind=trigger.dataset.nortivoService;if(!kinds[kind]||locked||receipt)return;
      data.kind=kind;trackOpen=false;changeStep(0,false);home.scrollIntoView();
    }catch(err){notice.textContent=errorText(err);}
  });
  async function init(){try{await connect();}catch(error){notice.textContent=errorText(error);render();}}
  render();void init();
}
