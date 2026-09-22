(() => {
  'use strict';
  // Illustrative website-only values in integer øre. Never reads or writes app data.
  document.querySelectorAll('[data-arc-example]').forEach(root => {
    const add = root.querySelector('[data-example-add]');
    const reset = root.querySelector('[data-example-reset]');
    const feedback = root.querySelector('[data-example-feedback]');
    const spent = root.querySelector('[data-example-spent]');
    const remaining = root.querySelector('[data-example-remaining]');
    let added = false;
    const format = ore => new Intl.NumberFormat('nb-NO', {maximumFractionDigits:0}).format(ore / 100) + ' NOK';
    function render() {
      const usedOre = 180000 + (added ? 25000 : 0);
      spent.textContent = format(usedOre);
      remaining.textContent = format(500000 - usedOre);
      feedback.dataset.i18n = added ? 'demo.arc.after' : 'demo.arc.before';
      feedback.textContent = window.Nortivo.translate(feedback.dataset.i18n);
      add.setAttribute('aria-disabled', String(added));
      reset.hidden = !added;
    }
    add.hidden = false;
    add.addEventListener('click', () => { if (!added) { added = true; render(); } });
    reset.addEventListener('click', () => { added = false; render(); add.focus(); });
    render();
  });
})();
