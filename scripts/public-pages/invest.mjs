const logo = '/assets/brand/nortivo-approved.png';
const preview = '/assets/invest/terminal-reference.jpg';
const symbol = '/assets/security-core/core-symbol.svg';
const iconPaths = {
  arrow: '<path d="M4 10h12m-5-5 5 5-5 5"/>',
  external: '<path d="M5 15 15 5M6 5h9v9"/>',
  expand: '<path d="M3 8V3h5m4 0h5v5m0 4v5h-5m-4 0H3v-5"/>',
  close: '<path d="m4 4 12 12m0-12L4 16"/>',
  chat: '<path d="M17 4H3v10h4v3l4-3h6z"/>',
  report: '<path d="M5 2h7l3 3v13H5zM8 8h4m-4 3h4m-4 3h3"/>',
  ledger: '<path d="M3 3h14v14H3zM3 7h14M8 7v10"/>',
  chart: '<path d="M3 16h14M6 4v9m4-10v8m4-5v8"/><path d="M5 6h2v4H5zm4-2h2v5H9zm4 4h2v3h-2z"/>',
  menu: '<path d="M3 6h14M3 13h14"/>'
};
export function icon(name) {
  return `<svg class="iv-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
}
export function investPage(lang, page, catalog) {
  const t = (en, nb) => lang === 'nb' ? nb : en;
  const base = `/${lang}/`, company = `https://nortivo.no${base}`, security = `https://korvnt.no${base}`;
  const path = page === 'home' ? '' : ['support','request'].includes(page) ? page+'/' : `systems/${page}/`;
  const terminal = base+'terminal/', portfolio = base+'portfolio/', pricing = base+'pricing/';
  const request = base+'request/';
  const dedicated = ['bot','engine','request'].includes(page);
  const account = portfolio+'?tab=account&amp;workspace=terminal';
  const title = {home:t('Market research and trading systems','Markedsanalyse og handelssystemer'),bot:t('Custom crypto bots','Skreddersydde kryptoboter'),engine:t('Custom trading engines','Skreddersydde handelsmotorer'),support:t('Customer support','Kundestøtte'),request:t('Custom system request','Prosjektforespørsel')}[page];
  const desc = t('Explore the Nortivo trading terminal, compare Portfolio and Terminal Pro, or discuss the requirements for your own trading system.','Utforsk Nortivos handelsterminal, sammenlign Portfolio og Terminal Pro, eller beskriv kravene til ditt eget handelssystem.');
  const homeLink = (hash) => (page === 'home' ? '' : base) + hash;
  const link = (label, url, style = 'link', glyph = 'arrow', attrs='') => `<a class="iv-${style}" href="${url}" ${attrs}>${label}${glyph ? icon(glyph) : ''}</a>`;
  const brand = `<a class="iv-brand" href="${base}" aria-label="Nortivo Invest"><img src="${logo}" alt="" width="41" height="41"><b>NORTIVO</b><span>Invest</span></a>`;
  const langSwitch = `<div class="iv-lang" aria-label="${t('Language','Språk')}">${['nb','en'].map(l => `<a href="/${l}/${path}" lang="${l}" hreflang="${l}"${l === lang ? ' aria-current="true"' : ''}>${l==='nb'?'NO':'EN'}</a>`).join('')}</div>`;
  const navlinks = [
    [t('Platform','Plattform'),homeLink('#platform')],[t('Custom systems','Skreddersøm'),page==='home'?'#systems':request],
    [t('Plans','Abonnement'),pricing],[t('Support','Kundestøtte'),page==='support'?'#support':base+'support/']
  ].map(([label,href])=>`<a href="${href}"${dedicated && href===request || page==='support' && href==='#support' ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const openTerminal = t('Open terminal','Åpne terminalen');
  const accountLabel=t('Sign in / Account','Logg inn / Konto');
  const header = `<a class="iv-skip" href="#main">${t('Skip to content','Hopp til innhold')}</a>
<header class="iv-header"><div class="iv-wrap iv-header-inner">${brand}<nav class="iv-nav" aria-label="${t('Main navigation','Hovedmeny')}">${navlinks}</nav><div class="iv-tools">${langSwitch}<a class="iv-account" href="${account}">${accountLabel}</a>${link(openTerminal,terminal,'header-action',null)}<button class="iv-menu-button" type="button" aria-expanded="false" aria-controls="iv-mobile-nav">${icon('menu')}<span>${t('Menu','Meny')}</span></button></div></div><nav hidden class="iv-mobile-nav iv-wrap" id="iv-mobile-nav" aria-label="${t('Mobile navigation','Mobilmeny')}">${navlinks}<a href="${account}">${accountLabel}</a>${link(openTerminal,terminal,'primary','external')}</nav></header>`;
  const badge = `<a class="iv-devbadge" href="${security}"><img src="${symbol}" alt="" width="21" height="24">KORVNT <span>— ${t('In development','Under utvikling')}</span></a>`;
  const footer = `<footer class="iv-footer"><div class="iv-wrap"><div class="iv-footer-main"><div>${brand}<p>${t('Investment research and trading technology.','Investeringsanalyse og handelsteknologi.')}<br>Lillestrøm, Norge</p></div><nav aria-label="${t('Footer navigation','Bunnmeny')}"><a href="${company}">Nortivo</a><a href="${company}report-2026/">${t('Trading report','Handelsrapport')}</a><a href="${company}privacy/">${t('Privacy','Personvern')}</a><a href="${base}support/">${t('Customer support','Kundestøtte')}</a></nav></div><div class="iv-footer-bottom"><small>© 2026 Nortivo</small>${badge}</div></div></footer>`;
  const serviceNames = {bot:t('AI-assisted crypto bot','KI-assistert kryptobot'),engine:t('Custom trading engine','Egen handelsmotor')};
  const serviceDescriptions = {
    bot:t('Define the signals, strategy rules and risk controls your crypto bot should use.','Beskriv signalene, strategireglene og risikogrensene kryptoboten skal bruke.'),
    engine:t('Scope an engine around your market data, strategy and required integrations.','En skreddersydd motor for dine markedsdata, din strategi og nødvendige integrasjoner.')
  };
  const chatMount = `<div data-nortivo-chat></div><noscript>${t('Enable JavaScript to open your conversation.','Aktiver JavaScript for å åpne samtalen.')}</noscript>`;
  const support = `<section class="iv-section iv-wrap iv-grid" id="support" aria-labelledby="support-title"><div class="iv-five"><h1 id="support-title">${t('Talk to Nortivo.','Snakk med Nortivo.')}</h1><p class="iv-lead">${t('Get help with an account, a workspace or an existing project request. Return in this browser to continue your conversation.','Få hjelp med en konto, plattformen eller en forespørsel. Kom tilbake i samme nettleser for å fortsette samtalen.')}</p></div><div class="iv-seven">${chatMount}</div></section>`;
  const requestSection = `<section class="iv-spec" id="request" aria-labelledby="request-title">
    <header class="iv-spec-head"><div class="iv-wrap"><h1 id="request-title">${t('Describe your system.','Beskriv systemet ditt.')}</h1><p>${t('An idea is enough to start. We can define the requirements together.','En idé er nok til å starte. Vi avklarer kravene sammen.')}</p></div></header>
    <div class="iv-spec-body"><div class="iv-spec-grid"><div class="iv-spec-paper">
      <div data-nortivo-intake${['bot','engine'].includes(page) ? ` data-service="${page}"` : ''} id="track"></div>
      <noscript>${t('Enable JavaScript to open your draft, track a request or submit a brief.','Aktiver JavaScript for å åpne utkastet, spore en forespørsel eller sende prosjektbeskrivelsen.')}</noscript>
      <section class="iv-brief-section" aria-label="${t('Project summary','Prosjektoppsummering')}"><div data-nortivo-intake-summary></div></section>
    </div><aside class="iv-spec-side">
      <section class="iv-spec-chat" id="support" aria-label="${t('Project support','Prosjektstøtte')}">${chatMount}</section>
      <section class="iv-request-next" aria-labelledby="next-steps"><h3 id="next-steps">${t('What happens next?','Hva skjer videre?')}</h3><ol>
        <li>${t('We review your brief.','Vi leser prosjektbeskrivelsen.')}</li><li>${t('We clarify the scope with you.','Vi avklarer omfanget sammen.')}</li><li>${t('You decide whether to proceed with a proposal.','Du vurderer et eventuelt tilbud.')}</li>
      </ol><p>${t('Submitting a request starts a review. It does not activate trading.','Forespørselen starter en avklaring. Den aktiverer ikke handel.')}</p></section>
    </aside></div></div></section>`;
  const previewFigure = `<section class="iv-wrap iv-capture" id="platform" aria-labelledby="iv-preview-heading"><div class="iv-capture-bar"><h2 id="iv-preview-heading">Terminal Pro</h2><span>${t('Read-only example','Skrivebeskyttet eksempel')}</span></div><figure class="iv-preview">
    <a class="iv-preview-image" href="${preview}" data-enlarge aria-label="${t('Enlarge the complete terminal preview','Forstørr forhåndsvisningen av hele terminalen')}"><img width="1920" height="1061" src="${preview}" alt="${t('Complete desktop Terminal Pro reference with a watchlist, candlestick chart, news and risk controls.','Hele designreferansen for Terminal Pro med overvåkingsliste, kursgraf, nyheter og risikopaneler.')}"></a>
    <figcaption><a class="iv-enlarge" href="${preview}" data-enlarge>${icon('expand')}${t('Enlarge preview','Forstørr bildet')}</a><span>${t('Design reference · fictional market data','Designreferanse · fiktive markedsdata')}</span></figcaption></figure>
    <dialog class="iv-preview-dialog" aria-labelledby="iv-preview-title"><div class="iv-dialog-bar"><h2 id="iv-preview-title">Terminal Pro · ${t('Design reference','Designreferanse')}</h2><button class="iv-dialog-close" autofocus type="button">${icon('close')}${t('Close','Lukk')}</button></div><p>${t('Fictional market sample. Scroll within the image to inspect the full-size layout.','Fiktive markedsdata. Rull i bildet for å se visningen i full størrelse.')}</p><div class="iv-dialog-image" tabindex="0" aria-label="${t('Scrollable full-size reference','Rullbart bilde i full størrelse')}"><img src="${preview}" alt="${t('Complete terminal reference in its original proportions.','Hele terminalreferansen i originale proporsjoner.')}" width="1920" height="1061"></div></dialog></section>`;
  const headline = t(['Research','markets.','Build your','system.'],['Analyser','markedet.','Bygg ditt','system.']);
  const hero = `<section class="iv-opening" aria-labelledby="iv-h1"><div class="iv-wrap">
    <div class="iv-mast"><b>Nortivo Invest</b><span aria-hidden="true"></span><b>${t('Market research','Markedsanalyse')}</b></div>
    <div class="iv-hero"><h1 id="iv-h1">${headline.map(part=>`<span>${part}</span>`).join(' ')}</h1>
    <div class="iv-hero-aside"><p>${t('Market research, portfolio records and strategy development. Explore the platform or tell us what you want to build.','Markedsanalyse, porteføljeoversikt og strategiutvikling. Bruk plattformen, eller fortell oss hva du vil bygge.')}</p>
    <div class="iv-actions">${link(openTerminal,terminal,'primary')}${link(t('Request a custom system','Be om et eget system'),request,'secondary')}</div>
    ${link(t('2026 trading report — results, risk and methodology','Handelsrapport 2026 — resultater, risiko og metode'),company+'report-2026/','report','arrow')}</div></div></div></section>${previewFigure}`;
  const workflows = {
    portfolio:t('Keep a manual record of trades and holdings. Review transaction history, corrections and values in their original currencies.','Før handler og beholdninger manuelt. Se transaksjonshistorikk, korrigeringer og verdier i opprinnelig valuta.'),
    pro:t('Work with watchlists, price charts and strategy signals. Source, venue and freshness labels show what the connected provider can supply.','Arbeid med overvåkingslister, kursgrafer og strategisignaler. Kilde, handelsplass og tidsstempel viser hvilke data leverandøren tilbyr.')
  };
  const plans = `<section class="iv-section iv-wrap" id="plans" aria-labelledby="platform-title"><div class="iv-section-heading"><h2 id="platform-title">${t('Choose your workspace.','Velg arbeidsområde.')}</h2>${link(t('Compare plans','Sammenlign abonnementer'),pricing)}</div><div class="iv-plan-grid">${catalog.plans.map(plan => {
    const isPro = plan.tier === 'pro', {month,year} = plan.prices;
    const amount = price => new Intl.NumberFormat(lang==='nb'?'nb-NO':'en-US',{maximumFractionDigits:2}).format(price / 100);
    return `<article class="iv-plan">${icon(isPro?'chart':'ledger')}<h3>${isPro?'Terminal Pro':'Portfolio'}</h3><p>${workflows[plan.tier]}</p><div class="iv-price"><b>${month.currency} ${amount(month.amount)}</b> / ${t('month','måned')} <span>${year.currency} ${amount(year.amount)} / ${t('year','år')} · ${t('equivalent to','tilsvarer')} ${year.currency} ${amount(year.monthlyEquivalent)} / ${t('month','måned')}</span></div><small data-plan-availability="${plan.tier}">${t('See plans for purchase availability.','Se kjøpstilgjengelighet på abonnementssiden.')}</small>${link(isPro?openTerminal:t('Explore Portfolio','Utforsk Portfolio'),isPro?terminal:portfolio)}</article>`;
  }).join('')}</div><p class="iv-fine">${t(`Annual subscriptions are billed upfront with a ${catalog.annualDiscountPercent}% discount. Paid workspace access and provider connections require separate permissions.`,`Årsabonnement betales på forskudd med ${catalog.annualDiscountPercent} % rabatt. Betalt tilgang og leverandørtilkoblinger krever egne tillatelser.`)}</p></section>`;
  const systems = `<section class="iv-offering" id="systems"><div class="iv-wrap"><div class="iv-services"><h2>${t('From an idea to a testable system.','Fra idé til testbart system.')}</h2><div class="iv-service-list">${['bot','engine'].map(kind=>`<article><div><h3>${serviceNames[kind]}</h3><p>${serviceDescriptions[kind]}</p></div>${link(kind==='bot'?t('Request a crypto bot','Forespør kryptobot'):t('Request a trading engine','Forespør handelsmotor'),base+'systems/'+kind+'/','primary')}</article>`).join('')}
    <p class="iv-service-note">${t('We scope each request before development starts. Submitting a brief does not activate trading.','Vi avklarer omfanget før utviklingen starter. En forespørsel aktiverer ikke handel.')}</p></div></div>
    <a class="iv-invite" id="request" href="${request}"><b>${t('Still defining your requirements?','Er kravene fortsatt uavklarte?')}</b><span aria-hidden="true"></span><strong>${t('Start a project request','Start en prosjektforespørsel')} ${icon('arrow')}</strong></a></div></section>`;
  const resources = `<aside class="iv-section iv-wrap iv-resources" aria-label="${t('Research and related services','Analyse og tilknyttede tjenester')}">
    <section><h2>${t('Research and guidance.','Analyse og veiledning.')}</h2><p>${t('Discuss a market, a method or a risk assumption. Our research and educational guides cover how strategies work and their limitations. Personalized investment recommendations fall outside this service.','Still spørsmål om et marked, en metode eller en risikoforutsetning. Våre analyser og guider forklarer hvordan strategier virker og hvilke begrensninger de har. Tjenesten omfatter ikke personlige investeringsanbefalinger.')}</p>
    ${link(t('Discuss a research question','Still et analysespørsmål'),base+'support/','link','arrow','data-nortivo-chat-launch data-nortivo-topic="research"')}</section>
    <section><h2>KORVNT</h2><p>${t('Nortivo’s daughter company is developing services for cybersecurity, websites, account security and assistance after cybercrime. Its security framework also supports Nortivo’s applications.','Nortivos datterselskap utvikler tjenester for cybersikkerhet, nettsteder, kontosikkerhet og bistand etter nettkriminalitet. Sikkerhetsrammeverket brukes også i Nortivos applikasjoner.')}</p>${link(t('Explore KORVNT','Utforsk KORVNT'),security,'link','external')}</section>
  </aside>`;
  const homeHelp = `<section class="iv-section iv-home-help" id="support" aria-labelledby="home-help-title"><div class="iv-wrap iv-grid">
    <div class="iv-five"><h2 id="home-help-title">${t('Talk to Nortivo.','Snakk med Nortivo.')}</h2></div>
    <div class="iv-seven"><p class="iv-lead">${t('Get help with an account, your workspace or an existing request. Leave private keys, passwords and financial records out of your message.','Få hjelp med kontoen, arbeidsområdet eller en forespørsel. Utelat private nøkler, passord og økonomiske opplysninger fra meldingen.')}</p>
    ${link(t('Contact support','Kontakt kundestøtte'),base+'support/','primary','arrow','data-nortivo-chat-launch')}
    ${link(t('Track an existing request','Spor en tidligere forespørsel'),request+'#track')}
    ${link(t('Common questions','Vanlige spørsmål'),base+'support/#questions','link',null)}
    <div hidden><div data-nortivo-chat></div></div></div></div></section>`;
  const faq = [
    [t('What does a free account include?','Hva følger med en gratis konto?'),t('A verified account gives you an identity for account settings and supported customer services. Paid workspace access depends on the permissions on your account. An eligible owner can open either workspace directly.','En bekreftet konto gir deg tilgang til kontoinnstillinger og tilgjengelige kundetjenester. Tilgang til betalte arbeidsområder avhenger av rettighetene på kontoen. Eiere med tildelt tilgang kan åpne begge arbeidsområdene direkte.')],
    [t('When can I purchase a plan?','Når kan jeg kjøpe et abonnement?'),t('The plans page checks billing readiness. Prices are in USD and yearly charges are paid in advance. Checkout opens only when the payment integration is ready.','Abonnementssiden kontrollerer om betaling er tilgjengelig. Prisene er i USD, og årsabonnement betales på forskudd. Kassen åpnes når betalingsløsningen er klar.')],
    [t('Which market tools are available?','Hvilke markedsverktøy er tilgjengelige?'),t('The terminal shows the selected provider, coverage and timestamps. News, calendar, AI, brokerage and execution each depend on their own connection and permissions.','Terminalen viser valgt leverandør, dekning og tidsstempel. Nyheter, kalender, KI, megler og ordreutførelse har hver sine tilkoblinger og tillatelser.')],
    [t('What happens after a project request?','Hva skjer etter en prosjektforespørsel?'),t('An operator can review your brief, clarify requirements and discuss a proposal. The request alone creates no order or delivery commitment.','En operatør kan vurdere beskrivelsen, avklare krav og diskutere et tilbud. Forespørselen alene gir ingen bestilling eller leveringsavtale.')],
    [t('How do I follow a support conversation?','Hvordan følger jeg en supportsamtale?'),t('Open Support in the same browser to read sent messages and replies in your conversation history.','Åpne Kundestøtte i samme nettleser for å lese sendte meldinger og svar i samtalehistorikken.')],
    [t('Does signing in authorize trading?','Gir innlogging tillatelse til handel?'),t('Live execution requires separate broker authorization, trading permissions and enabled release controls. Exploring the sample or requesting a system places no orders.','Reell handel krever separat meglerautorisasjon, handelstillatelser og aktiverte kontroller. Du kan utforske eksemplet eller be om et system uten å legge inn ordrer.')]
  ];
  const faqs = `<section class="iv-section iv-wrap iv-grid" id="questions"><div class="iv-five"><h2>${t('Common questions.','Vanlige spørsmål.')}</h2></div><div class="iv-seven iv-faq">${faq.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#101111"><meta name="description" content="${desc}"><title>${title} — Nortivo Invest</title><link rel="canonical" href="https://invest.nortivo.no${base}${path}"><link rel="alternate" hreflang="en" href="https://invest.nortivo.no/en/${path}"><link rel="alternate" hreflang="nb" href="https://invest.nortivo.no/nb/${path}"><link rel="icon" type="image/png" href="${logo}">${page==='support'?'':'<link rel="preload" as="image" fetchpriority="high" href="/assets/brand/invest-titanium.png">'}<link rel="stylesheet" href="/assets/invest/public.css"><link rel="stylesheet" href="/assets/workflows.css"><script defer src="/assets/invest/public.js"></script><script type="module" src="/assets/workflows.js"></script></head><body class="iv-site ${dedicated?'iv-workspace-page':page==='home'?'iv-home':'iv-support-page'}">${header}<main id="main">${page==='home'?hero+systems+plans+resources+homeHelp:page==='support'?support+faqs:requestSection}</main>${footer}</body></html>\n`;
}


