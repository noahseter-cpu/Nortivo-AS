(() => {
  const scene = document.querySelector('.replay-scene');
  const command = scene.querySelector('.replay-command');
  const choices = command.querySelector('.replay-samples');
  const buttons = choices.querySelectorAll('[data-case]');
  const steps = scene.querySelectorAll('.replay-steps li');
  const fill = scene.querySelector('.replay-track-fill');
  const pulse = scene.querySelector('.replay-track-pulse');
  const replay = command.querySelector('.replay-replay');
  const output = Object.fromEntries(
    ['price', 'rule', 'guard', 'verdict', 'result'].map(id => [id, scene.querySelector('#replay-' + id)])
  );
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
  const canAnimate = typeof fill.animate === 'function';
  const { translate } = window.Nortivo;
  const buyLimit = 100;
  const maxPositions = 3;
  const cases = {
    allowed: { price: 98, positions: 1 },
    price: { price: 102, positions: 1 },
    limit: { price: 98, positions: 3 },
  };
  let currentCase = 'allowed';
  let activeAnimations = [];

  function cancelReplay() {
    for (const animation of activeAnimations) animation.cancel();
    activeAnimations = [];
  }

  function showCase(key, animate) {
    cancelReplay();
    currentCase = key;
    const { price, positions } = cases[key];
    const pricePasses = price <= buyLimit;
    const positionPasses = positions < maxPositions;
    const permitsOrder = pricePasses && positionPasses;
    const checkpoint = !pricePasses ? 1 : !positionPasses ? 2 : 3;
    const distance = checkpoint / 3;

    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.case === key));
    steps[1].dataset.state = pricePasses ? 'pass' : 'stop';
    steps[2].dataset.state = !pricePasses ? 'skipped' : positionPasses ? 'pass' : 'stop';
    steps[3].dataset.state = permitsOrder ? 'order' : 'skipped';
    scene.dataset.checkpoint = String(checkpoint);

    output.price.textContent = price;
    output.rule.textContent = `${price} ${pricePasses ? '≤' : '>'} ${buyLimit}`;
    output.guard.textContent = pricePasses
      ? translate('replay.open').replace('{count}', positions).replace('{max}', maxPositions)
      : translate('replay.skipped');
    output.verdict.textContent = translate(permitsOrder ? 'replay.allowed' : 'replay.noOrder');
    output.result.textContent = translate('replay.result.' + key);

    if (!animate || reducedMotion.matches || !canAnimate) return;
    const timing = { duration: 320 + 180 * checkpoint, easing };
    activeAnimations = [
      fill.animate([{ transform: 'scaleX(0)' }, { transform: `scaleX(${distance})` }], timing),
      pulse.animate([
        { transform: 'translateX(0)', opacity: .8 },
        { transform: `translateX(${distance * 100}%)`, opacity: 1, offset: .78 },
        { transform: `translateX(${distance * 100}%)`, opacity: 0 },
      ], timing),
    ];
  }

  function setReplayAvailability() {
    replay.hidden = reducedMotion.matches || !canAnimate;
    if (replay.hidden) cancelReplay();
  }

  choices.addEventListener('click', event => {
    const button = event.target.closest('[data-case]');
    if (button) showCase(button.dataset.case, event.detail > 0);
  });
  replay.addEventListener('click', () => showCase(currentCase, true));
  document.addEventListener('nortivo:language', () => showCase(currentCase, false));
  reducedMotion.addEventListener('change', setReplayAvailability);
  setReplayAvailability();
  command.hidden = false;
})();
