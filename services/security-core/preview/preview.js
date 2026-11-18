/* Browser-local presentation and report drafting. No network or storage calls. */
(() => {
  'use strict';
  const tr = (en, nb) => document.documentElement.lang === 'nb' ? nb : en;
  document.body.classList.add('ks-enhanced');
  function reveal(fragment, scroll) {
    const target=document.getElementById(fragment.replace(/^#/, ''));
    if (!target) return;
    for (let item=target;item;item=item.parentElement) {
      if (item.tagName==='DETAILS') item.open=true;
    }
    if (scroll) target.scrollIntoView({block:'start'});
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(link)reveal(link.hash,false);
  });
  window.addEventListener('hashchange',()=>reveal(location.hash,true));
  if(document.body.hasAttribute('data-open-report') && !location.hash)reveal('report',true);
  else if(location.hash)reveal(location.hash,true);
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('navigation');
  menu?.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!expanded));
    navigation?.classList.toggle('is-open', !expanded);
  });
  navigation?.addEventListener('click', event => {
    if (!event.target.closest('a')) return;
    menu.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
      menu.setAttribute('aria-expanded', 'false');
      navigation.classList.remove('is-open');
      menu.focus();
    }
  });

  const form = document.getElementById('report-form');
  if (!form) return;
  const error = document.getElementById('form-error');
  const result = document.getElementById('draft-result');
  const output = document.getElementById('draft-output');
  const notice = document.getElementById('redaction-notice');
  const download = document.getElementById('download-draft');
  let draft = '';

  const redact = (value) => String(value)
    .replace(/-----BEGIN [^-\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\n]*PRIVATE KEY-----/gi, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '[REDACTED AUTHORIZATION]')
    .replace(/\b(?:sk_(?:live|test)_[A-Za-z0-9]+|sk-proj-[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|AKIA[A-Z0-9]{16})\b/g, '[REDACTED TOKEN]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED TOKEN]')
    .replace(/\b(authorization|cookie|set-cookie)\s*:\s*[^\r\n]+/gi, '$1: [REDACTED]')
    .replace(/\b(password|passwd|secret|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|session[-_ ]?(?:id|token))\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s&,;]+)/gi, '$1=[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED EMAIL]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    result.hidden = true;
    draft = '';
    const required = ['report-title', 'report-path', 'report-summary', 'report-steps'];
    for (const id of required) document.getElementById(id).removeAttribute('aria-invalid');
    const missing = required.find((id) => !document.getElementById(id).value.trim());
    if (missing) {
      const input = document.getElementById(missing);
      input.setAttribute('aria-invalid', 'true');
      error.textContent = tr('Complete the required fields before generating your local draft.', 'Fyll ut de påkrevde feltene for å lage utkastet.');
      error.hidden = false;
      input.focus();
      return;
    }
    const data = new FormData(form);
    const sections = [
      [tr('Issue', 'Tittel'), String(data.get('title')).slice(0, 160)],
      [tr('Affected page or operation', 'Berørt side eller funksjon'), String(data.get('path')).slice(0, 500).replace(/[?#][\s\S]*$/, '')],
      [tr('Description', 'Beskrivelse'), String(data.get('summary')).slice(0, 4000)],
      [tr('Context and expected behavior', 'Kontekst og forventet atferd'), String(data.get('steps')).slice(0, 6000)],
      [tr('Potential impact', 'Mulig konsekvens'), String(data.get('impact') || '').slice(0, 2000)]
    ];
    let changed = false;
    const rendered = sections.map(([label, value]) => {
      const cleaned = redact(value);
      if (cleaned !== value.trim()) changed = true;
      return `${label}\n${cleaned || tr('(Not provided)', '(Ikke oppgitt)')}\n`;
    });
    if (String(data.get('path')).includes('?') || String(data.get('path')).includes('#')) changed = true;
    draft = [tr('NORTIVO SECURITY — LOCAL REPORT DRAFT', 'NORTIVO SECURITY — LOKALT RAPPORTUTKAST'), tr('Not submitted. Review all content before sharing.', 'Ikke innsendt. Gå gjennom alt før du deler.'), '', ...rendered, tr('This draft was prepared on this device.', 'Utkastet ble laget på denne enheten.')].join('\n');
    output.textContent = draft;
    notice.textContent = changed
      ? tr('Common sensitive patterns or URL parameters were removed. Review the draft before sharing.', 'Vanlige sensitive mønstre eller URL-parametere ble fjernet. Se gjennom utkastet før du deler.')
      : tr('Review each line for sensitive information before sharing.', 'Les gjennom hver linje og se etter sensitive opplysninger før du deler.');
    result.hidden = false;
    output.focus();
  });

  form.addEventListener('input', () => {
    draft = '';
    result.hidden = true;
    output.textContent = '';
  });
  form.addEventListener('reset', () => {
    draft = '';
    output.textContent = '';
    notice.textContent = '';
    result.hidden = true;
    error.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach((element) => element.removeAttribute('aria-invalid'));
  });

  download.addEventListener('click', () => {
    if (!draft) return;
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Nortivo-security-report-draft.txt';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  // The static form is inert until local-only submit handling is installed.
  const fields = document.getElementById('report-fields');
  if (fields) fields.disabled = false;
})();
