(() => {
  'use strict';
  const parseDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
  };
  const times = value => {
    const date = parseDate(value);
    if (!date || [0, 1].includes(date.getUTCDay())) return [];
    return date.getUTCDay() >= 5 ? ['16:00', '17:00', '18:00', '19:00', '20:00'] : ['17:00', '18:00', '19:00', '20:00'];
  };
  const today = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Oslo', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
    const get = key => parts.find(part => part.type === key).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const valid = (selection, currentDay = today()) => !!parseDate(selection.date) && selection.date >= currentDay && Number.isInteger(selection.guests) && selection.guests >= 1 && selection.guests <= 6 && times(selection.date).includes(selection.time);
  window.LuneDemo = { parseDate, times, today, valid };
})();
