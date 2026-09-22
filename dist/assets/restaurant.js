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
  date.min = window.LuneDemo.today();
  function updateTimes() {
    const saved = time.value;
    time.replaceChildren(new Option(t('lune.choose'), ''));
    const choices = window.LuneDemo.times(date.value);
    choices.forEach(value => time.add(new Option(value, value)));
    time.value = choices.includes(saved) ? saved : '';
    status.textContent = date.value && !choices.length ? t('lune.closed') : '';
  }
  function renderConfirmation() {
    if (!selection) return;
    const formatted = new Intl.DateTimeFormat(locale(), {dateStyle:'long',timeZone:'Europe/Oslo'}).format(window.LuneDemo.parseDate(selection.date));
    const guestWord = window.Nortivo.getLanguage() === 'nb' ? (selection.guests === 1 ? 'gjest' : 'gjester') : (selection.guests === 1 ? 'guest' : 'guests');
    $('#booking-summary').textContent = `${formatted} · ${selection.time} · ${selection.guests} ${guestWord}`;
  }
  date.addEventListener('change', updateTimes);
  form.querySelector('fieldset').disabled = false;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = {date:date.value, time:time.value, guests:Number(guests.value)};
    if (!window.LuneDemo.valid(next)) { status.textContent = t('lune.invalid'); date.focus(); return; }
    selection = next;
    status.textContent = '';
    form.hidden = true;
    $('#demo-confirmation').hidden = false;
    renderConfirmation();
    $('#demo-confirmation').focus();
  });
  $('#booking-reset').addEventListener('click', () => {
    selection = undefined;
    $('#demo-confirmation').hidden = true;
    form.hidden = false;
    date.focus();
  });
  function refreshLanguage() {
    document.querySelectorAll('[data-price-ore]').forEach(price => {
      price.textContent = new Intl.NumberFormat(locale(), {style:'currency',currency:'NOK',maximumFractionDigits:0}).format(Number(price.dataset.priceOre)/100);
    });
    filterMenu(); updateTimes(); renderConfirmation();
  }
  document.addEventListener('nortivo:language', refreshLanguage);
  refreshLanguage();
})();
