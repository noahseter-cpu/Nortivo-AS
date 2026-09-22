(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const t = key => window.Nortivo.translate(key);
  const locale = () => window.Nortivo.getLanguage() === 'nb' ? 'nb-NO' : 'en-GB';
  const categories = [...document.querySelectorAll('[data-category]')];
  const dishes = [...document.querySelectorAll('[data-dish-category]')];
  let activeCategory = 'all';
  let selection;
  function filterMenu() {
    let count = 0;
    dishes.forEach(dish => {
      dish.hidden = (activeCategory !== 'all' && dish.dataset.dishCategory !== activeCategory) || ($('#vegetarian').checked && dish.dataset.vegetarian !== 'true');
      if (!dish.hidden) count++;
    });
    categories.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
    $('#menu-empty').hidden = count !== 0;
    $('#menu-count').textContent = `${count} ${t(count === 1 ? 'lune.filterOne' : 'lune.filterCount')}`;
  }
  categories.forEach(button => button.addEventListener('click', () => { activeCategory = button.dataset.category; filterMenu(); }));
  $('#vegetarian').addEventListener('change', filterMenu);
  $('.menu-controls').hidden = false;
  const form = $('#demo-booking');
  const date = $('#booking-date');
  const time = $('#booking-time');
  const guests = $('#booking-guests');
  const status = $('#booking-status');
  const selectedTime = () => time.querySelector('input:checked')?.value || '';
  function selectionText(value) {
    const formatted = new Intl.DateTimeFormat(locale(), {dateStyle:'long',timeZone:'Europe/Oslo'}).format(window.LuneDemo.parseDate(value.date));
    const guestWord = window.Nortivo.getLanguage() === 'nb' ? (value.guests === 1 ? 'gjest' : 'gjester') : (value.guests === 1 ? 'guest' : 'guests');
    return `${formatted} · ${value.time} · ${value.guests} ${guestWord}`;
  }
  function updatePreview() {
    const value = {date:date.value,time:selectedTime(),guests:Number(guests.value)};
    $('#selection-preview').textContent = window.LuneDemo.valid(value) ? selectionText(value) : t('lune.selectionEmpty');
  }
  date.min = window.LuneDemo.today();
  function updateTimes() {
    const saved = selectedTime();
    time.replaceChildren();
    const choices = window.LuneDemo.times(date.value);
    choices.forEach(value => {
      const label = document.createElement('label'); label.className = 'time-slot';
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'slot'; input.value = value; input.required = true; input.checked = value === saved;
      const text = document.createElement('span'); text.textContent = value;
      label.append(input,text); time.append(label);
    });
    $('#slots-hint').hidden = !!date.value;
    status.textContent = date.value && !choices.length ? t('lune.closed') : '';
    updatePreview();
  }
  function renderConfirmation() {
    if (!selection) return;
    $('#booking-summary').textContent = selectionText(selection);
  }
  date.addEventListener('change', updateTimes);
  time.addEventListener('change', updatePreview);
  guests.addEventListener('change', updatePreview);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let confirmationMotion;
  form.querySelector('fieldset').disabled = false;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = {date:date.value, time:selectedTime(), guests:Number(guests.value)};
    if (!window.LuneDemo.valid(next)) { status.textContent = t('lune.invalid'); date.focus(); return; }
    selection = next;
    status.textContent = '';
    form.hidden = true;
    $('#demo-confirmation').hidden = false;
    renderConfirmation();
    $('#demo-confirmation').focus();
    // Occasional pointer feedback only; state and keyboard focus are already committed.
    confirmationMotion?.cancel();
    if (!reducedMotion.matches && document.documentElement.dataset.input === 'pointer') {
      confirmationMotion = $('#demo-confirmation').animate([{opacity:.7,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(0.23,1,0.32,1)'});
    }
  });
  $('#booking-reset').addEventListener('click', () => {
    confirmationMotion?.cancel();
    selection = undefined;
    $('#demo-confirmation').hidden = true;
    form.hidden = false;
    date.focus();
  });
  reducedMotion.addEventListener('change', () => confirmationMotion?.cancel());
  function refreshLanguage() {
    document.querySelectorAll('[data-price-ore]').forEach(price => {
      price.textContent = new Intl.NumberFormat(locale(), {style:'currency',currency:'NOK',maximumFractionDigits:0}).format(Number(price.dataset.priceOre)/100);
    });
    filterMenu(); updateTimes(); renderConfirmation();
  }
  document.addEventListener('nortivo:language', refreshLanguage);
  refreshLanguage();
})();
