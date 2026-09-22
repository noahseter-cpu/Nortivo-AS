(() => {
'use strict';
const form = document.querySelector('#contact-form');
if (!form) return;
const n = window.Nortivo;
const feedback = document.querySelector('#contact-feedback');
const submit = form.querySelector('[type=submit]');
let busy = false, success = null, failure = null;
const fields = ['contact-name', 'contact-email', 'contact-message'];
const errors = new Map();
function render() {
 for (const id of fields) {
  const input = document.getElementById(id);
  const key = errors.get(id);
  input.setAttribute('aria-invalid', String(Boolean(key)));
  document.getElementById(id + '-error').textContent = key ? n.translate(key) : '';
 }
 feedback.replaceChildren();
 feedback.className = 'form-feedback' + (success ? ' success' : failure ? ' error' : '');
 if (success) {
  feedback.append(document.createTextNode(n.translate(success.confirmationSent === false ? 'contact.deliveryWarning' : 'contact.success')));
  const number = document.createElement('strong'); number.textContent = success.number; feedback.append(number);
  const link = document.createElement('a'); link.href = '/' + n.getLanguage() + '/support/'; link.textContent = n.translate('contact.track'); feedback.append(link);
 } else if (failure) feedback.textContent = n.translate(failure);
 const label = submit.querySelector('span');
 label.textContent = n.translate(busy ? 'contact.sending' : 'contact.submit');
 submit.disabled = busy || Boolean(success);
 form.setAttribute('aria-busy', String(busy));
}
form.addEventListener('input', event => {
 if (success) { success = null; render(); }
 if (errors.has(event.target.id)) { errors.delete(event.target.id); render(); }
});
form.addEventListener('submit', async event => {
 event.preventDefault();
 if (busy || success) return;
 errors.clear(); failure = null;
 const name = form.elements.name.value.trim();
 const email = form.elements.email.value.trim();
 const message = form.elements.message.value.trim();
 if (!name) errors.set('contact-name', 'contact.required');
 if (!email || !form.elements.email.validity.valid) errors.set('contact-email', 'contact.emailError');
 if (message.length < 10) errors.set('contact-message', 'contact.messageError');
 if (errors.size) {
  failure = 'contact.validation'; render(); document.getElementById(errors.keys().next().value).focus(); return;
 }
 busy = true; render();
 const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 20000);
 try {
  const language = n.getLanguage();
  const subject = (language === 'nb' ? 'Prosjekthenvendelse: ' : 'Project enquiry: ') + n.translate('contact.' + form.elements.type.value);
  const response = await fetch('/.netlify/functions/tickets', {method:'POST', credentials:'same-origin', signal:controller.signal, headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,email,subject,message,company:form.elements.company.value,language})});
  const result = await response.json();
  if (!response.ok || !result.ticket?.ticket_number) throw new Error('request-failed');
  success = {number: result.ticket.ticket_number, confirmationSent: result.confirmationSent};
 } catch { failure = 'contact.failed'; }
 finally { clearTimeout(deadline); busy = false; render(); feedback.focus(); }
});
document.addEventListener('nortivo:language', render);
})();
