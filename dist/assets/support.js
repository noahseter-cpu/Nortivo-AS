"use strict";
(() => {
  // Remove bearer links from the address bar before starting any network request.
  const fragment = new URLSearchParams(location.hash.slice(1));
  let accessToken = fragment.get("access");
  if (fragment.has("access")) history.replaceState(null, "", location.pathname + location.search);
  const copy = {
  "nb": {
    "support.title": "Support — Nortivo",
    "support.skip": "Hopp til innhold",
    "support.navigation": "Hovedmeny",
    "support.home": "Hjem",
    "support.products": "Produkter",
    "support.nav": "Support",
    "support.menu": "Meny",
    "support.heading": "Hva kan vi hjelpe deg med?",
    "support.lead": "Få hjelp med et Nortivo-produkt eller et prosjekt. Fortell oss hva du trenger, så svarer vi på e-post.",
    "support.step1Title": "Send inn saken",
    "support.step1": "Ta med produktnavnet og hva du trenger hjelp med.",
    "support.step2Title": "Ta vare på saksnummeret",
    "support.step2": "Du får det her med en gang saken er lagret.",
    "support.step3Title": "Følg samtalen",
    "support.step3": "Få svar på e-post, eller åpne saken sikkert her.",
    "support.privacy": "Ikke ta med passord, betalingsopplysninger eller andre sensitive opplysninger.",
    "support.portal": "Nortivo supportportal",
    "support.options": "Supportalternativer",
    "support.newTab": "Ny sak",
    "support.lookupTab": "Finn sak",
    "support.createHeading": "Opprett en supportsak",
    "support.required": "Alle feltene må fylles ut.",
    "support.name": "Navn",
    "support.email": "E-post",
    "support.subject": "Emne",
    "support.messageLabel": "Hva trenger du hjelp med?",
    "support.messageHelp": "Ta med hva du forventet, og hva som skjedde. Inntil 4 000 tegn.",
    "support.send": "Send sak",
    "support.open": "Åpen",
    "support.answered": "Besvart",
    "support.closed": "Lukket",
    "support.received": "Saken er mottatt",
    "support.receivedBody": "Ta vare på saksnummeret. Bruk det sammen med e-postadressen din for å få en sikker lenke til saken.",
    "support.follow": "Finn denne saken",
    "support.findHeading": "Finn saken din",
    "support.findIntro": "Skriv inn saksnummeret og e-postadressen du brukte. Vi sender en sikker lenke på e-post, slik at bare du kan åpne saken.",
    "support.ticketNumber": "Saksnummer",
    "support.sendLink": "Send meg en sikker lenke",
    "support.replies": "Svar fra Nortivo",
    "support.founded": "Grunnlagt av",
    "support.invalidName": "Skriv inn navnet ditt.",
    "support.invalidEmail": "Skriv inn en gyldig e-postadresse.",
    "support.invalidSubject": "Skriv et emne på minst 3 tegn.",
    "support.invalidMessage": "Beskriv saken med minst 10 tegn.",
    "support.invalidNumber": "Bruk saksnummeret du fikk, for eksempel NT-2026-ABC123.",
    "support.checkFields": "Se over de markerte feltene og prøv igjen.",
    "support.sending": "Sender saken…",
    "support.created": "Saken din er lagret.",
    "support.requesting": "Ber om en sikker lenke…",
    "support.linkSent": "Hvis saksnummeret og e-postadressen stemmer, får du en sikker lenke på e-post. Se også i søppelpost. Lenken er gyldig i 15 minutter.",
    "support.verifying": "Bekrefter lenken din…",
    "support.loading": "Henter saken…",
    "support.loaded": "Saken er åpnet sikkert.",
    "support.invalidAccess": "Lenken er ugyldig eller utløpt. Be om en ny lenke nedenfor.",
    "support.expiredSession": "Tilgangen har utløpt. Be om en ny sikker lenke.",
    "support.notFound": "Denne saken er ikke lenger tilgjengelig. Opprett en ny sak hvis du trenger hjelp.",
    "support.rateLimited": "For mange forsøk. Vent litt og prøv igjen.",
    "support.unavailable": "Support er midlertidig utilgjengelig. Prøv igjen senere. Teksten din er beholdt.",
    "support.network": "Vi fikk ikke kontakt med serveren. Sjekk tilkoblingen og prøv igjen. Teksten din er beholdt.",
    "support.error": "Forespørselen kunne ikke fullføres. Prøv igjen. Teksten din er beholdt.",
    "support.createdDate": "Opprettet",
    "support.sender": "Nortivo Support",
    "support.noReplies": "Ingen svar ennå. Vi sender svaret til e-postadressen du oppga.",
    "support.createdDeliveryWarning": "Saken er lagret, men bekreftelsen på e-post kunne ikke sendes. Ta vare på saksnummeret.",
    "meta.support.title": "Support — Nortivo",
    "meta.support.description": "Få hjelp fra Nortivo. Opprett en supportsak eller følg en eksisterende sak med sikker tilgang."
  },
  "en": {
    "support.title": "Support — Nortivo",
    "support.skip": "Skip to content",
    "support.navigation": "Main navigation",
    "support.home": "Home",
    "support.products": "Products",
    "support.nav": "Support",
    "support.menu": "Menu",
    "support.heading": "How can we help?",
    "support.lead": "Get help with a Nortivo product or a project. Tell us what you need, and we’ll reply by email.",
    "support.step1Title": "Send your request",
    "support.step1": "Include the product and what you need help with.",
    "support.step2Title": "Keep your ticket number",
    "support.step2": "You’ll see it here as soon as your request is saved.",
    "support.step3Title": "Follow the conversation",
    "support.step3": "Receive replies by email, or securely open your ticket here.",
    "support.privacy": "Please leave out passwords, payment details and other sensitive information.",
    "support.portal": "Nortivo support portal",
    "support.options": "Support options",
    "support.newTab": "New ticket",
    "support.lookupTab": "Find ticket",
    "support.createHeading": "Create a support ticket",
    "support.required": "All fields are required.",
    "support.name": "Name",
    "support.email": "Email",
    "support.subject": "Subject",
    "support.messageLabel": "What do you need help with?",
    "support.messageHelp": "Include what you expected and what happened. Up to 4,000 characters.",
    "support.send": "Send ticket",
    "support.open": "Open",
    "support.answered": "Answered",
    "support.closed": "Closed",
    "support.received": "Ticket received",
    "support.receivedBody": "Save your ticket number. You can use it with your email address to request a secure link to your ticket.",
    "support.follow": "Find this ticket",
    "support.findHeading": "Find your ticket",
    "support.findIntro": "Enter your ticket number and the email address you used. We’ll email a secure link so only you can open it.",
    "support.ticketNumber": "Ticket number",
    "support.sendLink": "Email me a secure link",
    "support.replies": "Replies from Nortivo",
    "support.founded": "Founded by",
    "support.invalidName": "Enter your name.",
    "support.invalidEmail": "Enter a valid email address.",
    "support.invalidSubject": "Enter a subject of at least 3 characters.",
    "support.invalidMessage": "Describe your request in at least 10 characters.",
    "support.invalidNumber": "Use the ticket number you received, for example NT-2026-ABC123.",
    "support.checkFields": "Check the highlighted fields and try again.",
    "support.sending": "Sending your ticket…",
    "support.created": "Your ticket has been saved.",
    "support.requesting": "Requesting a secure link…",
    "support.linkSent": "If the ticket number and email match, you’ll receive a secure link by email. Check your spam folder too. The link is valid for 15 minutes.",
    "support.verifying": "Verifying your link…",
    "support.loading": "Loading your ticket…",
    "support.loaded": "Your ticket is securely open.",
    "support.invalidAccess": "This link is invalid or has expired. Request a new link below.",
    "support.expiredSession": "Your access has expired. Request a new secure link.",
    "support.notFound": "This ticket is no longer available. Create a new ticket if you need help.",
    "support.rateLimited": "Too many attempts. Wait a little and try again.",
    "support.unavailable": "Support is temporarily unavailable. Try again later. Your text has been kept.",
    "support.network": "We couldn’t reach the server. Check your connection and try again. Your text has been kept.",
    "support.error": "Your request could not be completed. Try again. Your text has been kept.",
    "support.createdDate": "Created",
    "support.sender": "Nortivo Support",
    "support.noReplies": "No replies yet. We’ll send our reply to the email address you provided.",
    "support.createdDeliveryWarning": "Your ticket is saved, but the confirmation email could not be sent. Keep your ticket number.",
    "meta.support.title": "Support — Nortivo",
    "meta.support.description": "Get help from Nortivo. Create a support ticket or securely follow an existing request."
  }
};
  const site = window.Nortivo;
  site.register(copy);
  const t = key => site.translate("support." + key);
  const el = id => document.getElementById(id);
  const statusKeys = new Set(["open", "answered", "closed"]);
  let currentTicket = null;
  let createdEmail = "";
  let creationBusy = false;
  let lookupBusy = false;
  const formatDate = value => new Intl.DateTimeFormat(site.getLanguage() === "nb" ? "nb-NO" : "en-GB", {dateStyle:"medium", timeStyle:"short", timeZone:"Europe/Oslo"}).format(new Date(value));
  function textState(node, key, tone = "") {
    node.className = "message" + (tone ? " " + tone : "");
    if (key) { node.dataset.i18n = "support." + key; node.textContent = t(key); }
    else { delete node.dataset.i18n; node.textContent = ""; }
  }
  function fieldError(input, key) {
    const error = el(input.id + "-error");
    input.setAttribute("aria-invalid", String(Boolean(key)));
    error.hidden = !key;
    if (key) { error.dataset.i18n = "support." + key; error.textContent = t(key); }
    else { delete error.dataset.i18n; error.textContent = ""; input.removeAttribute("aria-invalid"); }
  }
  const validators = {
    name: input => input.value.trim().length >= 1 && input.value.length <= 80 ? "" : "invalidName",
    email: input => input.value.trim() && input.validity.valid ? "" : "invalidEmail",
    subject: input => input.value.trim().length >= 3 && input.value.length <= 140 ? "" : "invalidSubject",
    message: input => input.value.trim().length >= 10 && input.value.length <= 4000 ? "" : "invalidMessage",
    "ticket-number": input => /^NT-\d{4}-[A-Z0-9]{6}$/i.test(input.value.trim()) ? "" : "invalidNumber",
    "lookup-email": input => input.value.trim() && input.validity.valid ? "" : "invalidEmail"
  };
  function validate(form) {
    let first = null;
    for (const input of form.querySelectorAll("[required]")) {
      const key = validators[input.id](input);
      fieldError(input, key);
      if (key && !first) first = input;
    }
    if (first) first.focus();
    return !first;
  }
  for (const [id, check] of Object.entries(validators)) {
    el(id).addEventListener("input", () => {
      if (el(id).getAttribute("aria-invalid") === "true") fieldError(el(id), check(el(id)));
    });
  }
  function showPanel(name, focus = false) {
    const isNew = name === "new";
    for (const [prefix, selected] of [["new", isNew], ["lookup", !isNew]]) {
      const tab = el(prefix + "-tab");
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      el(prefix + "-panel").hidden = !selected;
      if (focus && selected) tab.focus();
    }
  }
  for (const name of ["new", "lookup"]) el(name + "-tab").addEventListener("click", () => showPanel(name));
  document.querySelector('[role="tablist"]').addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const name = event.key === "Home" ? "new" : event.key === "End" ? "lookup" : el("new-tab").getAttribute("aria-selected") === "true" ? "lookup" : "new";
    showPanel(name, true);
  });
  async function request(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch("/.netlify/functions/" + path, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
        ...(body ? {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...body, language:site.getLanguage()})} : {})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error("Request failed"), {status:response.status, code:data.code});
      return data;
    } finally { clearTimeout(timeout); }
  }
  function errorKey(error) {
    if (error.code === "INVALID_ACCESS") return "invalidAccess";
    if (error.status === 401) return "expiredSession";
    if (error.status === 404) return "notFound";
    if (error.status === 429) return "rateLimited";
    if (error.status === 503) return "unavailable";
    if (error.status === 400) return "checkFields";
    return error.status ? "error" : "network";
  }
  function renderTicket() {
    if (!currentTicket) return;
    const {ticket, replies = []} = currentTicket;
    const state = statusKeys.has(ticket.status) ? ticket.status : "open";
    el("result-number").textContent = ticket.ticket_number;
    el("result-status").className = "status " + state;
    el("result-status").textContent = t(state);
    el("result-subject").textContent = ticket.subject;
    el("result-date").textContent = t("createdDate") + " " + formatDate(ticket.created_at);
    el("result-body").textContent = ticket.message;
    const list = el("result-replies");
    list.replaceChildren();
    if (!replies.length) {
      const empty = document.createElement("p");
      empty.className = "no-replies";
      empty.textContent = t("noReplies");
      list.append(empty);
    }
    for (const item of replies) {
      const reply = document.createElement("article");
      reply.className = "reply";
      const meta = document.createElement("span");
      meta.className = "reply-meta";
      meta.textContent = t("sender") + " · " + formatDate(item.created_at);
      const body = document.createElement("p");
      body.textContent = item.body;
      reply.append(meta, body);
      list.append(reply);
    }
    el("ticket-result").hidden = false;
  }
  el("ticket-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (creationBusy) return;
    const form = event.currentTarget;
    if (!validate(form)) { textState(el("form-message"), "checkFields", "error"); return; }
    creationBusy = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    el("created-ticket").hidden = true;
    textState(el("form-message"), "sending");
    try {
      const payload = Object.fromEntries(new FormData(form));
      const data = await request("tickets", payload);
      if (!data.ticket?.ticket_number) throw new Error("Invalid response");
      createdEmail = payload.email.trim();
      el("created-number").textContent = data.ticket.ticket_number;
      el("created-ticket").hidden = false;
      textState(el("form-message"), data.confirmationSent === false ? "createdDeliveryWarning" : "created", "success");
      form.reset();
      if (!el("new-panel").hidden) el("created-ticket").focus();
    } catch (error) {
      textState(el("form-message"), errorKey(error), "error");
    } finally {
      creationBusy = false;
      button.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
  el("follow-ticket").addEventListener("click", () => {
    el("ticket-number").value = el("created-number").textContent;
    el("lookup-email").value = createdEmail;
    showPanel("lookup");
    el("ticket-number").focus();
  });
  el("lookup-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (lookupBusy) return;
    const form = event.currentTarget;
    if (!validate(form)) { textState(el("lookup-message"), "checkFields", "error"); return; }
    lookupBusy = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    el("ticket-result").hidden = true;
    currentTicket = null;
    textState(el("lookup-message"), "requesting");
    try {
      await request("ticket-access", {action:"request", ticketNumber:el("ticket-number").value.trim().toUpperCase(), email:el("lookup-email").value.trim()});
      textState(el("lookup-message"), "linkSent", "success");
    } catch (error) {
      textState(el("lookup-message"), errorKey(error), "error");
    } finally {
      lookupBusy = false;
      button.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
  async function verifyAccess() {
    if (!accessToken) return;
    showPanel("lookup");
    lookupBusy = true;
    const button = el("lookup-form").querySelector('[type="submit"]');
    button.disabled = true;
    el("lookup-form").setAttribute("aria-busy", "true");
    textState(el("lookup-message"), "verifying");
    const token = accessToken;
    accessToken = null;
    try {
      const access = await request("ticket-access", {action:"verify", token});
      if (!access.ticketNumber) throw new Error("Invalid response");
      el("ticket-number").value = access.ticketNumber;
      el("lookup-email").value = access.email || "";
      textState(el("lookup-message"), "loading");
      const query = new URLSearchParams({ticketNumber:access.ticketNumber, language:site.getLanguage()});
      currentTicket = await request("tickets?" + query);
      if (!currentTicket.ticket) throw new Error("Invalid response");
      renderTicket();
      textState(el("lookup-message"), "loaded", "success");
      if (!el("lookup-panel").hidden) el("ticket-result").focus();
    } catch (error) {
      textState(el("lookup-message"), error.status === 401 ? "invalidAccess" : errorKey(error), "error");
      if (!el("lookup-panel").hidden) el("ticket-number").focus();
    } finally {
      lookupBusy = false;
      button.disabled = false;
      el("lookup-form").removeAttribute("aria-busy");
    }
  }
  document.addEventListener("nortivo:language", () => { document.title = t("title"); renderTicket(); });
  site.applyTranslations();
  document.title = t("title");
  verifyAccess();
})();
