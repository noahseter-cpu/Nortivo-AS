(() => {
  const choices = document.querySelector('.invest-scenarios');
  const result = document.querySelector('.invest-result');
  const price = document.querySelector('#demo-price');
  const outcome = document.querySelector('#demo-outcome');
  const net = document.querySelector('#demo-net');
  const buttons = choices.querySelectorAll('[data-demo-price]');
  const chartPoints = document.querySelectorAll('[data-chart-price]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const numberFormat = new Intl.NumberFormat(document.documentElement.lang, { signDisplay: 'exceptZero' });
  const exitPrice = 101;
  const totalFees = 2;
  let feedback;

  choices.addEventListener('click', event => {
    const button = event.target.closest('[data-demo-price]');
    if (!button || button.getAttribute('aria-pressed') === 'true') return;

    const value = Number(button.dataset.demoPrice);
    const createsOrder = value <= 100;
    buttons.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    chartPoints.forEach(point => {
      point.dataset.selected = String(Number(point.dataset.chartPrice) === value);
    });
    price.textContent = String(value);
    outcome.dataset.order = String(createsOrder);
    outcome.dataset.i18n = createsOrder ? 'invest.buy' : 'invest.wait';
    outcome.textContent = window.Nortivo.translate(outcome.dataset.i18n);
    net.textContent = numberFormat.format(createsOrder ? exitPrice - value - totalFees : 0);

    feedback?.cancel();
    if (event.detail && !reducedMotion.matches && result.animate) {
      feedback = result.animate(
        [{ opacity: .75, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 180, easing: 'cubic-bezier(.23, 1, .32, 1)' }
      );
    }
  });

  reducedMotion.addEventListener('change', event => {
    if (event.matches) feedback?.cancel();
  });
  choices.hidden = false;
})();
