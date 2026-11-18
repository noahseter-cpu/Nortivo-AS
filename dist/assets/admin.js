import {isOlderOpen,summarizeTickets,selectTickets,mergeTicketPages,ticketPage} from './admin-core.js';
"use strict";
(() => {
  const copy = {
  "nb": {
    "admin.title": "Supportarbeidsområde — Nortivo",
    "admin.skip": "Hopp til innhold",
    "admin.navigation": "Hovedmeny",
    "admin.home": "Hjem",
    "admin.customerSupport": "Kundesupport",
    "admin.menu": "Meny",
    "admin.heading": "Nortivo administrasjon",
    "admin.lead": "Logg inn for å håndtere kundesupport og se tjenesteoppsettet.",
    "admin.password": "Administratorpassord",
    "admin.signIn": "Logg inn",
    "admin.tickets": "Supportsaker",
    "admin.workspaceIntro": "Les henvendelser, svar på e-post og oppdater status.",
    "admin.refresh": "Oppdater",
    "admin.signOut": "Logg ut",
    "admin.summary": "Oversikt over innlastede saker",
    "admin.open": "Åpne",
    "admin.answered": "Besvart",
    "admin.closed": "Lukket",
    "admin.total": "Totalt",
    "admin.workspace": "Arbeidsområde for supportsaker",
    "admin.search": "Søk i saker",
    "admin.searchPlaceholder": "Nummer, navn, e-post eller emne",
    "admin.status": "Status",
    "admin.all": "Alle statuser",
    "admin.selectTicket": "Velg en sak for å lese og svare.",
    "admin.founded": "Grunnlagt av",
    "admin.noTickets": "Ingen supportsaker ennå.",
    "admin.noMatches": "Ingen saker samsvarer med søket. Prøv et annet søk eller en annen status.",
    "admin.loading": "Henter saker…",
    "admin.loadingTicket": "Henter saken…",
    "admin.signingIn": "Logger inn…",
    "admin.signingOut": "Logger ut…",
    "admin.signedOut": "Du er logget ut.",
    "admin.passwordRequired": "Skriv inn administratorpassordet.",
    "admin.wrongPassword": "Feil passord. Prøv igjen.",
    "admin.sessionExpired": "Økten er utløpt. Logg inn igjen. Utkastene er beholdt. Innsendte endringer kan fortsatt bli fullført; sjekk saken og e-postaktiviteten før du prøver igjen.",
    "admin.loginUnavailable": "Innlogging er midlertidig utilgjengelig. Prøv igjen senere.",
    "admin.network": "Serveren kunne ikke nås. Sjekk tilkoblingen og prøv igjen.",
    "admin.error": "Handlingen kunne ikke fullføres. Prøv igjen.",
    "admin.rateLimited": "For mange forsøk. Vent litt og prøv igjen.",
    "admin.notFound": "Denne saken ble ikke funnet. Oppdater sakslisten.",
    "admin.unavailable": "Tjenesten er midlertidig utilgjengelig. Prøv igjen senere.",
    "admin.replyLabel": "Svar på e-post",
    "admin.replyPlaceholder": "Skriv svaret ditt til kunden…",
    "admin.replyHelp": "Svaret sendes til kundens e-postadresse. Inntil 4 000 tegn.",
    "admin.sendReply": "Send svar på e-post",
    "admin.close": "Lukk sak",
    "admin.reopen": "Åpne saken igjen",
    "admin.sendingReply": "Sender svar…",
    "admin.replySent": "Svaret er lagret. E-postleverandøren har godtatt sendingen; levering til innboksen er ikke bekreftet.",
    "admin.replyInvalid": "Skriv et svar på minst 2 tegn.",
    "admin.updating": "Oppdaterer status…",
    "admin.statusUpdated": "Sakens status er oppdatert.",
    "admin.sent": "Registrert",
    "admin.replies": "Tidligere svar",
    "admin.loaded": "Sakslisten er oppdatert.",
    "admin.replyFailed": "Svaret kunne ikke bekreftes. Utkastet er beholdt. Sjekk e-postaktiviteten før du prøver igjen.",
    "admin.statusOpen": "Åpen",
    "meta.admin.title": "Supportarbeidsområde — Nortivo",
    "meta.admin.description": "Logg inn for å håndtere kundesupport og se tjenesteoppsettet.",
    "admin.privateWorkspace": "Supportarbeidsområde",
    "admin.privateIntro": "Kundehenvendelser, svar og tjenesteoppsett.",
    "admin.workspaceChoice": "Velg arbeidsområde",
    "admin.newTab": "Åpnes i en ny fane.",
    "admin.overview": "Oversikt",
    "admin.inbox": "Innboks",
    "admin.operations": "Drift",
    "admin.overviewTitle": "Support i korte trekk",
    "admin.overviewIntro": "Velg en status for å åpne de samsvarende innlastede sakene.",
    "admin.openInbox": "Åpne innboksen",
    "admin.viewTickets": "Se saker",
    "admin.totalLoaded": "Totalt innlastet",
    "admin.olderTitle": "Åpne i mer enn 24 timer",
    "admin.olderHelp": "Sakens alder siden opprettelse. Gjenåpnede saker er med.",
    "admin.viewQueue": "Se køen",
    "admin.recentTitle": "Nylig oppdatert",
    "admin.recentHelp": "Svar og statusendringer oppdaterer en sak.",
    "admin.sort": "Sortering",
    "admin.newest": "Nyeste først",
    "admin.oldest": "Eldste først",
    "admin.lastUpdated": "Sist oppdatert",
    "admin.olderFilter": "Åpne i mer enn 24 timer",
    "admin.clearFilters": "Nullstill filtre",
    "admin.loadOlder": "Hent eldre saker",
    "admin.loadingOlder": "Henter eldre saker…",
    "admin.operationsIntro": "Tjenesteoppsett og direkte tilgang til driftsverktøyene dine.",
    "admin.configuration": "Tjenesteoppsett",
    "admin.configurationHelp": "Kun oppsett. En lagret innstilling bekrefter ikke tilkobling, leverandørtillatelse eller levering. Ingen tjenestetester kjøres her.",
    "admin.operatingTools": "Driftsverktøy",
    "admin.toolsHelp": "Disse åpner den faktiske tjenesten i en ny fane. Hver tjeneste har egen innlogging.",
    "admin.mainWebsite": "Bedriftens nettside",
    "admin.investmentPlatform": "Investeringsplattform",
    "admin.deployments": "Netlify-publiseringer",
    "admin.emailLogs": "E-postaktivitet",
    "admin.showPassword": "Vis",
    "admin.hidePassword": "Skjul",
    "admin.scope": "{count} innlastede saker · tellingene gjelder kun disse registreringene. Oppdater henter den nyeste siden på nytt.",
    "admin.scopeMore": "Eldre saker finnes. Hent flere i innboksen.",
    "admin.scopeEnd": "Slutten av den tilgjengelige sakslisten.",
    "admin.scopeCapped": "Grensen for tilgjengelige sider er nådd. Dette er ikke en telling av hele historikken.",
    "admin.refreshed": "Sist oppdatert: {time} · Europe/Oslo",
    "admin.notRefreshed": "Ikke oppdatert ennå.",
    "admin.matches": "{matches} av {total} innlastede saker",
    "admin.noOlder": "Ingen innlastede åpne saker er mer enn 24 timer gamle.",
    "admin.olderLoaded": "{count} innlastede åpne saker eldre enn 24 timer",
    "admin.updatedAt": "Oppdatert {time}",
    "admin.loadingOperations": "Leser tjenesteoppsettet…",
    "admin.configurationChecked": "Oppsett lest: {time} · Europe/Oslo",
    "admin.configured": "Konfigurert · tilkobling ikke kontrollert",
    "admin.notConfigured": "Ikke konfigurert",
    "admin.purchaseUnavailable": "Utilgjengelig med gjeldende oppsett",
    "admin.notChecked": "Ikke kontrollert",
    "admin.productEnabled": "Plattformprodukt",
    "admin.enabled": "Aktivert i oppsettet",
    "admin.disabled": "Deaktivert i oppsettet",
    "admin.purchases": "Nye kjøp",
    "admin.updated": "Oppdatert",
    "admin.checkingSession": "Kontrollerer administratorøkten…",
    "admin.unknownStatus": "Ukjent status",
    "admin.retryTicket": "Prøv saken igjen",
    "admin.refreshAfterWriteFailed": "Endringen ble lagret, men saken kunne ikke oppdateres. Prøv Oppdater før du gjør en ny endring.",
    "admin.serviceMarket": "Markedsdata",
    "admin.serviceNews": "Nyheter",
    "admin.serviceCalendar": "Økonomisk kalender",
    "admin.serviceAi": "KI-forklaringer",
    "admin.serviceBroker": "Megler",
    "admin.serviceEmail": "E-post",
    "admin.servicePayments": "Betaling"
  },
  "en": {
    "admin.title": "Support Workspace — Nortivo",
    "admin.skip": "Skip to content",
    "admin.navigation": "Main navigation",
    "admin.home": "Home",
    "admin.customerSupport": "Customer support",
    "admin.menu": "Menu",
    "admin.heading": "Nortivo administration",
    "admin.lead": "Sign in to manage customer support and view service configuration.",
    "admin.password": "Admin password",
    "admin.signIn": "Sign in",
    "admin.tickets": "Support tickets",
    "admin.workspaceIntro": "Read requests, reply by email and manage their status.",
    "admin.refresh": "Refresh",
    "admin.signOut": "Sign out",
    "admin.summary": "Loaded ticket summary",
    "admin.open": "Open",
    "admin.answered": "Answered",
    "admin.closed": "Closed",
    "admin.total": "Total",
    "admin.workspace": "Ticket workspace",
    "admin.search": "Search tickets",
    "admin.searchPlaceholder": "Number, name, email or subject",
    "admin.status": "Status",
    "admin.all": "All statuses",
    "admin.selectTicket": "Select a ticket to read and answer it.",
    "admin.founded": "Founded by",
    "admin.noTickets": "No support tickets yet.",
    "admin.noMatches": "No tickets match. Try a different search or status.",
    "admin.loading": "Loading tickets…",
    "admin.loadingTicket": "Loading ticket…",
    "admin.signingIn": "Signing in…",
    "admin.signingOut": "Signing out…",
    "admin.signedOut": "You are signed out.",
    "admin.passwordRequired": "Enter the admin password.",
    "admin.wrongPassword": "Incorrect password. Try again.",
    "admin.sessionExpired": "Your session has expired. Sign in again. Drafts are retained. Submitted changes may still complete; check the ticket and email activity before retrying.",
    "admin.loginUnavailable": "Sign-in is temporarily unavailable. Try again later.",
    "admin.network": "The server could not be reached. Check your connection and try again.",
    "admin.error": "The action could not be completed. Try again.",
    "admin.rateLimited": "Too many attempts. Wait a little and try again.",
    "admin.notFound": "This ticket was not found. Refresh the ticket list.",
    "admin.unavailable": "The service is temporarily unavailable. Try again later.",
    "admin.replyLabel": "Email reply",
    "admin.replyPlaceholder": "Write your reply to the customer…",
    "admin.replyHelp": "Your reply is sent to the customer’s email address. Up to 4,000 characters.",
    "admin.sendReply": "Send email reply",
    "admin.close": "Close ticket",
    "admin.reopen": "Reopen ticket",
    "admin.sendingReply": "Sending reply…",
    "admin.replySent": "Reply saved. The email provider accepted the send request; inbox delivery is not confirmed.",
    "admin.replyInvalid": "Write a reply of at least 2 characters.",
    "admin.updating": "Updating status…",
    "admin.statusUpdated": "Ticket status updated.",
    "admin.sent": "Recorded",
    "admin.replies": "Previous replies",
    "admin.loaded": "Ticket list refreshed.",
    "admin.replyFailed": "The reply could not be confirmed. Your draft is retained. Check email activity before retrying.",
    "admin.statusOpen": "Open",
    "meta.admin.title": "Support Workspace — Nortivo",
    "meta.admin.description": "Sign in to manage customer support and view service configuration.",
    "admin.privateWorkspace": "Support workspace",
    "admin.privateIntro": "Customer requests, replies and service configuration.",
    "admin.workspaceChoice": "Choose workspace",
    "admin.newTab": "Opens in a new tab.",
    "admin.overview": "Overview",
    "admin.inbox": "Inbox",
    "admin.operations": "Operations",
    "admin.overviewTitle": "Support at a glance",
    "admin.overviewIntro": "Choose a status to open the matching loaded tickets.",
    "admin.openInbox": "Open inbox",
    "admin.viewTickets": "View tickets",
    "admin.totalLoaded": "Total loaded",
    "admin.olderTitle": "Open for more than 24 hours",
    "admin.olderHelp": "Ticket age since creation. Reopened tickets are included.",
    "admin.viewQueue": "View queue",
    "admin.recentTitle": "Recently updated",
    "admin.recentHelp": "Replies and status changes update a ticket.",
    "admin.sort": "Sort",
    "admin.newest": "Newest first",
    "admin.oldest": "Oldest first",
    "admin.lastUpdated": "Last updated",
    "admin.olderFilter": "Open more than 24 hours",
    "admin.clearFilters": "Clear filters",
    "admin.loadOlder": "Load older tickets",
    "admin.loadingOlder": "Loading older tickets…",
    "admin.operationsIntro": "Service configuration and direct access to your operating tools.",
    "admin.configuration": "Service configuration",
    "admin.configurationHelp": "Configuration only. A saved setting does not confirm connectivity, provider permission or delivery. No service probes run here.",
    "admin.operatingTools": "Operating tools",
    "admin.toolsHelp": "These open the actual service in a new tab. Each service manages its own sign-in.",
    "admin.mainWebsite": "Company website",
    "admin.investmentPlatform": "Investment platform",
    "admin.deployments": "Netlify deployments",
    "admin.emailLogs": "Email activity",
    "admin.showPassword": "Show",
    "admin.hidePassword": "Hide",
    "admin.scope": "{count} loaded tickets · counts cover these records only. Refresh reloads the newest page.",
    "admin.scopeMore": "Older tickets are available. Load more from the inbox.",
    "admin.scopeEnd": "End of the available ticket list.",
    "admin.scopeCapped": "The supported page limit is reached. This is not a complete-history count.",
    "admin.refreshed": "Last refreshed: {time} · Europe/Oslo",
    "admin.notRefreshed": "Not refreshed yet.",
    "admin.matches": "{matches} of {total} loaded tickets",
    "admin.noOlder": "No loaded open tickets are more than 24 hours old.",
    "admin.olderLoaded": "{count} loaded open tickets older than 24 hours",
    "admin.updatedAt": "Updated {time}",
    "admin.loadingOperations": "Reading service configuration…",
    "admin.configurationChecked": "Configuration read: {time} · Europe/Oslo",
    "admin.configured": "Configured · connection not checked",
    "admin.notConfigured": "Not configured",
    "admin.purchaseUnavailable": "Unavailable with current configuration",
    "admin.notChecked": "Not checked",
    "admin.productEnabled": "Platform product",
    "admin.enabled": "Enabled in configuration",
    "admin.disabled": "Disabled in configuration",
    "admin.purchases": "New purchases",
    "admin.updated": "Updated",
    "admin.checkingSession": "Checking your admin session…",
    "admin.unknownStatus": "Unknown status",
    "admin.retryTicket": "Retry ticket",
    "admin.refreshAfterWriteFailed": "The change was saved, but the ticket could not be refreshed. Retry Refresh before making another change.",
    "admin.serviceMarket": "Market data",
    "admin.serviceNews": "News",
    "admin.serviceCalendar": "Economic calendar",
    "admin.serviceAi": "AI explanations",
    "admin.serviceBroker": "Brokerage",
    "admin.serviceEmail": "Email",
    "admin.servicePayments": "Payments"
  }
};
  const site = window.Nortivo;
  site.register(copy);
  const t = key => site.translate("admin." + key);
  const el = id => document.getElementById(id);
  const states = new Set(["open", "answered", "closed"]);
  const drafts = new Map();
  const operations = new Set();
  const notices = new Map();
  let tickets = [];
  let activeId = null;
  let detailVersion = 0;
  let authVersion = 0;
  let listRequest = null;
  let loginBusy = false;
  let logoutBusy = false;
  let workspaceView = "overview";
  let page = ticketPage();
  let refreshedAt = null;
  let operationsData = null;
  let operationsRequest = null;
  let listGeneration = 0;
  let configurationGeneration = 0;
  const formatDate = value => {const parsed=new Date(value);return Number.isFinite(parsed.getTime())?new Intl.DateTimeFormat(site.getLanguage() === "nb" ? "nb-NO" : "en-GB", {dateStyle:"medium", timeStyle:"short", timeZone:"Europe/Oslo"}).format(parsed):"—";};
  const text = (key,values={}) => t(key).replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??""));
  function node(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }
  function translated(tag, className, key) {
    const item = node(tag, className, t(key));
    item.dataset.i18n = "admin." + key;
    return item;
  }
  function message(target, key, tone = "") {
    target.className = "message" + (tone ? " " + tone : "");
    if (key) { target.dataset.i18n = "admin." + key; target.textContent = t(key); }
    else { delete target.dataset.i18n; target.textContent = ""; }
  }
  function dateNode(value, prefix = "") {
    const item = node("span", "reply-meta");
    item.dataset.date = value;
    item.dataset.datePrefix = prefix;
    item.textContent = (prefix ? t(prefix) + " " : "") + formatDate(value);
    return item;
  }
  function showLogin(key, focus = true) {
    authVersion++;
    listGeneration++;
    configurationGeneration++;
    listRequest=null;
    operationsRequest=null;
    operations.clear();
    notices.clear();
    el("refresh-button").disabled=false;
    el("load-more-button").disabled=false;
    operationsData = null;
    refreshedAt = null;
    page = ticketPage();
    tickets = [];
    activeId = null;
    detailVersion++;
    el("older-queue").replaceChildren();
    el("recent-queue").replaceChildren();
    el("operations-status").replaceChildren();
    el("tickets").replaceChildren();
    el("ticket-detail").replaceChildren();
    updateStats();
    el("dashboard").hidden = true;
    el("login-card").hidden = false;
    message(el("login-message"), key || "", key === "signedOut" ? "success" : "error");
    el("operations-checked").textContent="";
    if (focus) el("password").focus();
  }
  function selectWorkspace(view, focus = false) {
    workspaceView = ["overview","inbox","operations"].includes(view) ? view : "overview";
    for (const name of ["overview","inbox","operations"]) {
      el(name+"-panel").hidden = name !== workspaceView;
      el(name+"-choice").setAttribute("aria-pressed",String(name === workspaceView));
    }
    if (focus) el(workspaceView+"-title").focus({preventScroll:true});
    if (workspaceView === "operations" && !operationsData) void loadOperations();
  }
  function showDashboard() {
    el("login-card").hidden = true;
    el("dashboard").hidden = false;
    selectWorkspace("overview");
  }
  function openInbox(status="all") {
    el("search").value="";
    el("status-filter").value=status==="older"?"open":states.has(status)?status:"all";
    el("older-filter").checked=status==="older";
    el("sort-order").value=status==="older"?"oldest":"newest";
    renderList();
    selectWorkspace("inbox",true);
  }
  function queueButton(ticket, updated=false) {
    const button=node("button","admin-queue-item");button.type="button";
    const heading=node("div","admin-queue-top");heading.append(node("strong","",ticket.subject),statusBadge(ticket.status));
    button.append(heading,node("span","admin-muted",ticket.ticket_number+" · "+ticket.name),node("small","admin-muted",updated?text("updatedAt",{time:formatDate(ticket.updated_at||ticket.created_at)}):formatDate(ticket.created_at)));
    button.addEventListener("click",()=>{openInbox(updated?"all":"older");void openTicket(ticket.id,true);});
    return button;
  }
  function renderOverview() {
    const older=selectTickets(tickets,{olderOnly:true,sort:"oldest"}),recent=selectTickets(tickets,{sort:"updated"});
    el("older-queue").replaceChildren(...older.slice(0,6).map(ticket=>queueButton(ticket)));
    if(!older.length)el("older-queue").append(translated("p","admin-queue-empty","noOlder"));
    el("older-title").textContent=t("olderTitle")+" · "+older.length;
    el("recent-queue").replaceChildren(...recent.slice(0,6).map(ticket=>queueButton(ticket,true)));
    if(!recent.length)el("recent-queue").append(translated("p","admin-queue-empty","noTickets"));
  }
  function renderOperations() {
    const target=el("operations-status");target.replaceChildren();
    if(!operationsData)return;
    const list=node("dl","admin-config-list");
    const row=(label,value)=>{const entry=node("div");entry.append(node("dt","",label),node("dd","",value));list.append(entry);};
    row(t("productEnabled"),operationsData.productEnabled===true?t("enabled"):operationsData.productEnabled===false?t("disabled"):t("notChecked"));
    row(t("purchases"),operationsData.purchasesOpen===false?t("purchaseUnavailable"):t("notChecked"));
    const names={market:"serviceMarket",news:"serviceNews",calendar:"serviceCalendar",ai:"serviceAi",broker:"serviceBroker",email:"serviceEmail",payments:"servicePayments"};
    for(const service of operationsData.services||[])row(names[service.id]?t(names[service.id]):String(service.label||service.id),service.configured===true?t("configured"):t("notConfigured"));
    target.append(list);
    el("operations-checked").textContent=operationsData.checkedAt?text("configurationChecked",{time:formatDate(operationsData.checkedAt)}):"";
  }
  async function loadOperations() {
    if(operationsRequest)return operationsRequest;
    const version=authVersion,generation=++configurationGeneration;el("refresh-button").disabled=true;el("operations-status").setAttribute("aria-busy","true");
    el("operations-status").replaceChildren(translated("p","message","loadingOperations"));
    operationsRequest=(async()=>{try{const data=await api("admin-tickets?view=operations");if(version!==authVersion)return;operationsData=data.operations||null;renderOperations();if(!operationsData)throw new Error("Invalid configuration response");}
      catch(error){if(version===authVersion){const failure=node("p");message(failure,errorKey(error),"error");el("operations-status").replaceChildren(failure);}}
      finally{if(generation===configurationGeneration){operationsRequest=null;el("refresh-button").disabled=false;el("operations-status").removeAttribute("aria-busy");}}})();
    return operationsRequest;
  }
  async function api(path, options = {}, context = "general") {
    const version = authVersion;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch("/.netlify/functions/" + path, {credentials:"same-origin", cache:"no-store", signal:controller.signal, ...options});
      const data = await response.json().catch(() => ({}));
      if (version !== authVersion) throw Object.assign(new Error("Session changed"),{status:401,code:"STALE_SESSION"});
      if (!response.ok) {
        if (response.status === 401 && context === "general" && version === authVersion) showLogin("sessionExpired");
        throw Object.assign(new Error("Request failed"), {status:response.status, code:data.code});
      }
      return data;
    } finally { clearTimeout(timeout); }
  }
  const json = (method, body) => ({method, headers:{"Content-Type":"application/json"}, body:JSON.stringify({...body, language:site.getLanguage()})});
  function errorKey(error, context = "") {
    if (error.status === 401) return context === "login" ? "wrongPassword" : "sessionExpired";
    if (error.status === 429) return "rateLimited";
    if (error.status === 404) return "notFound";
    if (error.status === 503 || error.status >= 500) return context === "login" ? "loginUnavailable" : "unavailable";
    return error.status ? "error" : "network";
  }
  function statusBadge(value) {
    return translated("span","status "+(states.has(value)?value:"unknown"),value==="open"?"statusOpen":states.has(value)?value:"unknownStatus");
  }
  function updateStats() {
    const counts=summarizeTickets(tickets);
    for(const status of ["open","answered","closed"])el(status+"-count").textContent=counts[status];
    el("total-count").textContent=counts.total;
    el("ticket-scope").textContent=text("scope",{count:counts.total});
    el("refreshed-at").textContent=refreshedAt?text("refreshed",{time:formatDate(refreshedAt)}):t("notRefreshed");
    const canLoad=page.hasMore&&Number.isSafeInteger(page.nextOffset);
    el("load-more-button").hidden=!canLoad;
    el("list-scope").textContent=page.hasMore?canLoad?t("scopeMore"):t("scopeCapped"):t("scopeEnd");
    renderOverview();
  }
  function renderList() {
    const focusedId=document.activeElement?.dataset.ticketId;
    const filtered=selectTickets(tickets,{query:el("search").value,status:el("status-filter").value,olderOnly:el("older-filter").checked,sort:el("sort-order").value,language:site.getLanguage()});
    el("match-count").textContent=text("matches",{matches:filtered.length,total:tickets.length});
    const hasFilters=!!el("search").value||el("status-filter").value!=="all"||el("older-filter").checked||el("sort-order").value!=="newest";
    el("clear-filters").disabled=!hasFilters;
    const list=el("tickets");list.replaceChildren();
    if(!filtered.length){list.append(translated("div","empty",tickets.length?"noMatches":"noTickets"));return;}
    for(const ticket of filtered){
      const button=node("button","ticket-item"+(ticket.id===activeId?" active":""));button.type="button";button.dataset.ticketId=ticket.id;
      button.setAttribute("aria-controls","ticket-detail");button.setAttribute("aria-current",ticket.id===activeId?"true":"false");
      const top=node("div","ticket-item-top");top.append(node("strong","",ticket.ticket_number),statusBadge(ticket.status));
      button.append(top,node("p","",ticket.subject),node("small","",ticket.name+" · "+ticket.email),node("small","",formatDate(el("sort-order").value==="updated"?ticket.updated_at||ticket.created_at:ticket.created_at)));
      button.addEventListener("click",()=>openTicket(ticket.id,true));list.append(button);if(focusedId===ticket.id)button.focus({preventScroll:true});
    }
  }
  function applyTickets(data,append=false){
    if(!Array.isArray(data.tickets))throw new Error("Invalid ticket response");
    tickets=mergeTicketPages(append?tickets:[],data.tickets);page=ticketPage(data.page);refreshedAt=Date.now();updateStats();renderList();
  }
  async function loadTickets(announce = true, append = false) {
    if (listRequest) return listRequest;
    if(append&&(!page.hasMore||!Number.isSafeInteger(page.nextOffset)))return false;
    const version = authVersion,generation=++listGeneration;
    const refresh = el("refresh-button");
    refresh.disabled = true;
    el("load-more-button").disabled=true;
    if (announce) message(el("dashboard-message"), "loading");
    el("tickets").setAttribute("aria-busy", "true");
    listRequest = (async () => {
      try {
        const offset=append?page.nextOffset:0;
        const data = await api("admin-tickets?language=" + site.getLanguage()+"&offset="+offset);
        if (version !== authVersion) return false;
        applyTickets(data,append);
        if (announce) message(el("dashboard-message"), "loaded", "success");
        return true;
      } catch (error) {
        if (version === authVersion) message(el("dashboard-message"), errorKey(error), "error");
        return false;
      } finally {
        if(generation===listGeneration){listRequest = null;
        refresh.disabled = false;
        el("load-more-button").disabled=false;
        el("tickets").removeAttribute("aria-busy");}
      }
    })();
    return listRequest;
  }
  function renderDetail(ticket, replies) {
    const detailAuth=authVersion;
    const detail = el("ticket-detail");
    detail.replaceChildren();
    const head = node("div", "detail-head");
    const heading = node("div");
    const title = node("h2", "", ticket.subject);
    title.id = "detail-title";
    title.tabIndex = -1;
    heading.append(node("span", "ticket-number", ticket.ticket_number), title);
    head.append(heading, statusBadge(ticket.status));
    const meta = node("p", "detail-meta");
    meta.append(document.createTextNode(ticket.name + " · " + ticket.email + " · "), dateNode(ticket.created_at));
    meta.lastElementChild.className = "";
    const original = node("div", "original-message", ticket.message);
    detail.append(head, meta, original);
    if (replies.length) {
      const replyList = node("section", "admin-replies reply-list");
      replyList.append(translated("h3", "replies-heading", "replies"));
      for (const item of replies) {
        const reply = node("article", "reply");
        reply.append(dateNode(item.created_at, "sent"), node("p", "", item.body));
        replyList.append(reply);
      }
      detail.append(replyList);
    }
    const box = node("form", "reply-box");
    box.method = "post";
    box.noValidate = true;
    const label = translated("label", "", "replyLabel");
    label.htmlFor = "reply-text";
    const textarea = node("textarea");
    textarea.id = "reply-text";
    textarea.name = "reply";
    textarea.required = true;
    textarea.minLength = 2;
    textarea.maxLength = 4000;
    textarea.placeholder = t("replyPlaceholder");
    textarea.dataset.i18nPlaceholder = "admin.replyPlaceholder";
    textarea.value = drafts.get(ticket.id) || "";
    textarea.setAttribute("aria-describedby", "reply-help reply-error");
    textarea.addEventListener("input", () => {
      drafts.set(ticket.id, textarea.value);
      if (textarea.value.trim().length >= 2) {
        textarea.removeAttribute("aria-invalid");
        error.hidden = true;
      }
    });
    const help = translated("p", "field-help", "replyHelp");
    help.id = "reply-help";
    const error = translated("p", "field-error", "replyInvalid");
    error.id = "reply-error";
    error.hidden = true;
    const actions = node("div", "form-actions");
    const send = translated("button", "button", "sendReply");
    send.type = "submit";
    const close = translated("button", "button secondary", ticket.status === "closed" ? "reopen" : "close");
    close.type = "button";
    actions.append(send, close);
    const notice = node("p", "message");
    notice.id = "reply-message";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.setAttribute("aria-atomic", "true");
    const existingNotice = notices.get(ticket.id);
    if (existingNotice) message(notice, existingNotice.key, existingNotice.tone);
    function busy(value) {
      send.disabled = value;
      close.disabled = value;
      textarea.readOnly = value;
      box.setAttribute("aria-busy", String(value));
    }
    busy(operations.has(ticket.id));
    function setNotice(key, tone = "") {
      if(detailAuth!==authVersion)return;
      notices.set(ticket.id, {key, tone});
      if (activeId === ticket.id && el("reply-message")) message(el("reply-message"), key, tone);
    }
    async function mutate(kind) {
      const auth=authVersion;
      if(detailAuth!==auth||operations.has(ticket.id))return;
      if (kind === "reply" && (textarea.value.trim().length < 2 || textarea.value.length > 4000)) {
        error.hidden = false;
        textarea.setAttribute("aria-invalid", "true");
        textarea.focus();
        return;
      }
      const draft = textarea.value;
      drafts.set(ticket.id, draft);
      operations.add(ticket.id);
      busy(true);
      setNotice(kind === "reply" ? "sendingReply" : "updating");
      try {
        if (kind === "reply") {
          await api("reply-ticket", json("POST", {id:ticket.id, message:draft}));
          drafts.delete(ticket.id);
          textarea.value = "";
          if (activeId === ticket.id && el("reply-text")) el("reply-text").value = "";
          setNotice("replySent", "success");
        } else {
          await api("admin-tickets", json("PATCH", {id:ticket.id, status:ticket.status === "closed" ? "open" : "closed"}));
          setNotice("statusUpdated", "success");
        }
        try {
          const updated=await api("admin-tickets?id="+encodeURIComponent(ticket.id)+"&language="+site.getLanguage());
          if(auth!==authVersion)return;
          if(!updated.ticket)throw new Error("Invalid ticket response");
          tickets=mergeTicketPages(tickets,[updated.ticket]);updateStats();renderList();
          if(activeId===ticket.id&&!el("dashboard").hidden)renderDetail(updated.ticket,updated.replies||[]);
        }catch(refreshError){if(auth===authVersion)message(el("dashboard-message"),"refreshAfterWriteFailed","error");}
      } catch (failure) {
        if(auth!==authVersion)return;
        setNotice(kind === "reply" && failure.status !== 401 ? "replyFailed" : errorKey(failure), "error");
      } finally {
        if(auth!==authVersion)return;
        operations.delete(ticket.id);
        if (box.isConnected) busy(false);
        if (activeId === ticket.id) {
          const current = el("reply-text");
          if (current) {
            current.readOnly = false;
            current.closest("form").setAttribute("aria-busy", "false");
            current.closest("form").querySelectorAll("button").forEach(button => { button.disabled = false; });
          }
        }
      }
    }
    box.addEventListener("submit", event => { event.preventDefault(); mutate("reply"); });
    close.addEventListener("click", () => mutate("status"));
    box.append(label, textarea, help, error, actions, notice);
    detail.append(box);
  }
  async function openTicket(id, focus = false) {
    const version = ++detailVersion;
    const auth = authVersion;
    activeId = id;
    renderList();
    el("ticket-detail").setAttribute("aria-busy", "true");
    el("ticket-detail").replaceChildren(translated("div", "empty", "loadingTicket"));
    try {
      const data = await api("admin-tickets?id=" + encodeURIComponent(id) + "&language=" + site.getLanguage());
      if (version !== detailVersion || auth !== authVersion) return;
      if (!data.ticket) throw new Error("Invalid response");
      renderDetail(data.ticket, data.replies || []);
      if (focus) el("detail-title").focus({preventScroll:false});
    } catch (error) {
      if (version !== detailVersion || auth !== authVersion) return;
      const failure = node("p", "message error");
      message(failure, errorKey(error), "error");
      el("ticket-detail").replaceChildren(failure);
    } finally {
      if (version === detailVersion) el("ticket-detail").setAttribute("aria-busy", "false");
    }
  }
  el("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (loginBusy) return;
    const form = event.currentTarget;
    const password = el("password");
    if (!password.value) {
      const error = el("password-error");
      error.hidden = false;
      error.dataset.i18n = "admin.passwordRequired";
      error.textContent = t("passwordRequired");
      password.setAttribute("aria-invalid", "true");
      password.focus();
      return;
    }
    loginBusy = true;
    authVersion++;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    message(el("login-message"), "signingIn");
    try {
      await api("admin-login", json("POST", {password:password.value}), "login");
      form.reset();
      showDashboard();
      el("dashboard-title").focus();
      await loadTickets();
    } catch (error) {
      message(el("login-message"), errorKey(error, "login"), "error");
      password.focus();
    } finally {
      loginBusy = false;
      button.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
  el("password").addEventListener("input", () => {
    el("password").removeAttribute("aria-invalid");
    el("password-error").hidden = true;
  });
  el("refresh-button").addEventListener("click",()=>workspaceView==="operations"?loadOperations():loadTickets());
  for(const view of ["overview","inbox","operations"])el(view+"-choice").addEventListener("click",()=>selectWorkspace(view,true));
  document.querySelectorAll("[data-inbox-shortcut]").forEach(button=>button.addEventListener("click",()=>openInbox(button.dataset.inboxShortcut)));
  el("load-more-button").addEventListener("click",()=>loadTickets(true,true));
  el("clear-filters").addEventListener("click",()=>{el("search").value="";el("status-filter").value="all";el("older-filter").checked=false;el("sort-order").value="newest";renderList();el("search").focus();});
  el("sort-order").addEventListener("change",renderList);
  el("older-filter").addEventListener("change",renderList);
  el("password-visibility").addEventListener("click",()=>{const show=el("password").type==="password";el("password").type=show?"text":"password";el("password-visibility").setAttribute("aria-pressed",String(show));el("password-visibility").dataset.i18n="admin."+(show?"hidePassword":"showPassword");el("password-visibility").textContent=t(show?"hidePassword":"showPassword");});
  el("search").addEventListener("input", renderList);
  el("status-filter").addEventListener("change", renderList);
  el("logout-button").addEventListener("click", async () => {
    if (logoutBusy) return;
    logoutBusy = true;
    el("logout-button").disabled = true;
    message(el("dashboard-message"), "signingOut");
    try {
      await api("admin-logout", json("POST", {}));
      authVersion++;
      detailVersion++;
      activeId = null;
      tickets = [];
      drafts.clear();
      notices.clear();
      el("tickets").replaceChildren();
      el("ticket-detail").replaceChildren(translated("div", "empty", "selectTicket"));
      updateStats();
      showLogin("signedOut");
    } catch (error) {
      message(el("dashboard-message"), errorKey(error), "error");
    } finally {
      logoutBusy = false;
      el("logout-button").disabled = false;
    }
  });
  document.addEventListener("nortivo:language", () => {
    document.title = t("title");
    renderList();
    updateStats();
    if(operationsData)renderOperations();
    for (const item of document.querySelectorAll("[data-date]")) item.textContent = (item.dataset.datePrefix ? t(item.dataset.datePrefix) + " " : "") + formatDate(item.dataset.date);
  });
  site.applyTranslations();
  document.title = t("title");
  (async () => {
    const version=authVersion;message(el("login-message"),"checkingSession");
    try{const data=await api("admin-tickets?language="+site.getLanguage()+"&offset=0",{},"session-check");if(version!==authVersion)return;applyTickets(data);message(el("login-message"),"");showDashboard();}
    catch(error){if(version!==authVersion)return;if(error.status===401)showLogin("",false);else message(el("login-message"),errorKey(error),"error");}
  })();
})();
