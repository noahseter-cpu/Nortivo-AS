"use strict";
(() => {
  const copy = {
  "nb": {
    "admin.title": "Supportadministrasjon — Nortivo",
    "admin.skip": "Hopp til innhold",
    "admin.navigation": "Hovedmeny",
    "admin.home": "Hjem",
    "admin.customerSupport": "Kundesupport",
    "admin.menu": "Meny",
    "admin.heading": "Supportadministrasjon",
    "admin.lead": "Logg inn for å lese og besvare supportsaker hos Nortivo.",
    "admin.password": "Administratorpassord",
    "admin.signIn": "Logg inn",
    "admin.tickets": "Supportsaker",
    "admin.workspaceIntro": "Les henvendelser, svar på e-post og oppdater status.",
    "admin.refresh": "Oppdater",
    "admin.signOut": "Logg ut",
    "admin.summary": "Saksoversikt",
    "admin.open": "Åpne",
    "admin.answered": "Besvart",
    "admin.closed": "Lukket",
    "admin.total": "Totalt",
    "admin.workspace": "Arbeidsområde for supportsaker",
    "admin.search": "Søk i saker",
    "admin.searchPlaceholder": "Nummer, navn eller emne",
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
    "admin.sessionExpired": "Økten er utløpt. Logg inn igjen.",
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
    "admin.replySent": "Svaret er sendt på e-post.",
    "admin.replyInvalid": "Skriv et svar på minst 2 tegn.",
    "admin.updating": "Oppdaterer status…",
    "admin.statusUpdated": "Sakens status er oppdatert.",
    "admin.sent": "Sendt",
    "admin.replies": "Tidligere svar",
    "admin.loaded": "Sakslisten er oppdatert.",
    "admin.replyFailed": "Svaret kunne ikke sendes. Utkastet er beholdt. Prøv igjen.",
    "admin.statusOpen": "Åpen",
    "meta.admin.title": "Supportadministrasjon — Nortivo",
    "meta.admin.description": "Logg inn for å lese og besvare supportsaker hos Nortivo."
  },
  "en": {
    "admin.title": "Support Admin — Nortivo",
    "admin.skip": "Skip to content",
    "admin.navigation": "Main navigation",
    "admin.home": "Home",
    "admin.customerSupport": "Customer support",
    "admin.menu": "Menu",
    "admin.heading": "Support admin",
    "admin.lead": "Sign in to view and answer Nortivo support tickets.",
    "admin.password": "Admin password",
    "admin.signIn": "Sign in",
    "admin.tickets": "Support tickets",
    "admin.workspaceIntro": "Read requests, reply by email and manage their status.",
    "admin.refresh": "Refresh",
    "admin.signOut": "Sign out",
    "admin.summary": "Ticket summary",
    "admin.open": "Open",
    "admin.answered": "Answered",
    "admin.closed": "Closed",
    "admin.total": "Total",
    "admin.workspace": "Ticket workspace",
    "admin.search": "Search tickets",
    "admin.searchPlaceholder": "Number, name or subject",
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
    "admin.sessionExpired": "Your session has expired. Sign in again.",
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
    "admin.replySent": "Reply sent by email.",
    "admin.replyInvalid": "Write a reply of at least 2 characters.",
    "admin.updating": "Updating status…",
    "admin.statusUpdated": "Ticket status updated.",
    "admin.sent": "Sent",
    "admin.replies": "Previous replies",
    "admin.loaded": "Ticket list refreshed.",
    "admin.replyFailed": "The reply could not be sent. Your draft has been kept. Try again.",
    "admin.statusOpen": "Open",
    "meta.admin.title": "Support Admin — Nortivo",
    "meta.admin.description": "Sign in to read and answer Nortivo support tickets."
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
  const formatDate = value => new Intl.DateTimeFormat(site.getLanguage() === "nb" ? "nb-NO" : "en-GB", {dateStyle:"medium", timeStyle:"short", timeZone:"Europe/Oslo"}).format(new Date(value));
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
    el("dashboard").hidden = true;
    el("login-card").hidden = false;
    if (key) message(el("login-message"), key, key === "signedOut" ? "success" : "error");
    if (focus) el("password").focus();
  }
  async function api(path, options = {}, context = "general") {
    const version = authVersion;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch("/.netlify/functions/" + path, {credentials:"same-origin", cache:"no-store", signal:controller.signal, ...options});
      const data = await response.json().catch(() => ({}));
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
    const status = states.has(value) ? value : "open";
    return translated("span", "status " + status, status === "open" ? "statusOpen" : status);
  }
  function updateStats() {
    el("open-count").textContent = tickets.filter(item => item.status === "open").length;
    el("answered-count").textContent = tickets.filter(item => item.status === "answered").length;
    el("total-count").textContent = tickets.length;
  }
  function renderList() {
    const focusedId = document.activeElement?.dataset.ticketId;
    const query = el("search").value.trim().toLocaleLowerCase(site.getLanguage());
    const filter = el("status-filter").value;
    const filtered = tickets.filter(ticket => {
      const search = [ticket.ticket_number, ticket.name, ticket.email, ticket.subject].join(" ").toLocaleLowerCase(site.getLanguage());
      return (filter === "all" || ticket.status === filter) && search.includes(query);
    });
    const list = el("tickets");
    list.replaceChildren();
    if (!filtered.length) {
      list.append(translated("div", "empty", tickets.length ? "noMatches" : "noTickets"));
      return;
    }
    for (const ticket of filtered) {
      const button = node("button", "ticket-item" + (ticket.id === activeId ? " active" : ""));
      button.type = "button";
      button.dataset.ticketId = ticket.id;
      button.setAttribute("aria-controls", "ticket-detail");
      button.setAttribute("aria-current", ticket.id === activeId ? "true" : "false");
      const top = node("div", "ticket-item-top");
      top.append(node("strong", "", ticket.ticket_number), statusBadge(ticket.status));
      button.append(top, node("p", "", ticket.subject), node("small", "", ticket.name + " · " + formatDate(ticket.created_at)));
      button.addEventListener("click", () => openTicket(ticket.id, true));
      list.append(button);
      if (focusedId === ticket.id) button.focus({preventScroll:true});
    }
  }
  async function loadTickets(announce = true) {
    if (listRequest) return listRequest;
    const version = authVersion;
    const refresh = el("refresh-button");
    refresh.disabled = true;
    if (announce) message(el("dashboard-message"), "loading");
    el("tickets").setAttribute("aria-busy", "true");
    listRequest = (async () => {
      try {
        const data = await api("admin-tickets?language=" + site.getLanguage());
        if (version !== authVersion) return false;
        tickets = Array.isArray(data.tickets) ? data.tickets : [];
        updateStats();
        renderList();
        if (announce) message(el("dashboard-message"), "loaded", "success");
        return true;
      } catch (error) {
        if (version === authVersion) message(el("dashboard-message"), errorKey(error), "error");
        return false;
      } finally {
        listRequest = null;
        refresh.disabled = false;
        el("tickets").removeAttribute("aria-busy");
      }
    })();
    return listRequest;
  }
  function renderDetail(ticket, replies) {
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
      notices.set(ticket.id, {key, tone});
      if (activeId === ticket.id && el("reply-message")) message(el("reply-message"), key, tone);
    }
    async function mutate(kind) {
      if (operations.has(ticket.id)) return;
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
        operations.delete(ticket.id);
        const loaded = await loadTickets(false);
        if (loaded && activeId === ticket.id && !el("dashboard").hidden) await openTicket(ticket.id, false);
      } catch (failure) {
        setNotice(kind === "reply" && failure.status !== 401 ? "replyFailed" : errorKey(failure), "error");
      } finally {
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
      el("login-card").hidden = true;
      el("dashboard").hidden = false;
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
  el("refresh-button").addEventListener("click", () => loadTickets());
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
    for (const item of document.querySelectorAll("[data-date]")) item.textContent = (item.dataset.datePrefix ? t(item.dataset.datePrefix) + " " : "") + formatDate(item.dataset.date);
  });
  site.applyTranslations();
  document.title = t("title");
  (async () => {
    const version = authVersion;
    try {
      const data = await api("admin-tickets?language=" + site.getLanguage(), {}, "session-check");
      if (version !== authVersion) return;
      tickets = Array.isArray(data.tickets) ? data.tickets : [];
      el("login-card").hidden = true;
      el("dashboard").hidden = false;
      updateStats();
      renderList();
    } catch (error) {
      if (version === authVersion && error.status !== 401) message(el("login-message"), errorKey(error), "error");
    }
  })();
})();
