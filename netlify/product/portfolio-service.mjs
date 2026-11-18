import { commandDigest, fail, sha256 } from '../terminal/security.mjs';
import { createPortfolio, applyPortfolioCommand, summarizePortfolio, calculateLedger, isPortfolioId } from './portfolio.mjs';

function assertUser(ctx) {
  if (!ctx.user || ctx.user.kind !== 'user') fail('SIGN_IN_REQUIRED', 'Sign in to use your portfolio.', 401);
}
const keyFor = (userId, id) => `${userId}:${id}`;
async function getOwned(ctx, id) {
  if (!isPortfolioId(id)) fail('PORTFOLIO_NOT_FOUND', 'This portfolio is unavailable.', 404);
  const row = await ctx.store.get('portfolios', keyFor(ctx.user.id, id));
  if (!row || row.ownerId !== ctx.user.id) fail('PORTFOLIO_NOT_FOUND', 'This portfolio is unavailable.', 404);
  return row;
}

export async function portfolioSummary(ctx, state, { fetchPrices = true } = {}) {
  const quotes = {}, fx = {}, failures = [];
  const providers = ctx.providers;
  // Bounded data requests; manual valuations still work when no commercial feed
  // exists. Provider errors remain visible and never become invented prices.
  const instruments = [...calculateLedger(state).holdings.values()].filter(holding => holding.quantity > 0n).map(holding => holding.instrument).slice(0, 100);
  if (fetchPrices && providers?.market?.quote) {
    for (let start = 0; start < instruments.length; start += 5) {
      await Promise.all(instruments.slice(start, start + 5).filter(item => item.assetType !== 'manual').map(async instrument => {
        try { const result = await providers.market.quote(instrument); if (result?.quote) quotes[instrument.id] = result.quote; }
        catch (error) { failures.push({ instrumentId: instrument.id, code: error.code || 'PROVIDER_UNAVAILABLE' }); }
      }));
    }
  }
  const currencies = new Set([...instruments.map(item => item.currency), ...state.transactions.map(txn => txn.currency)]);
  if (fetchPrices && providers?.market?.fx) await Promise.all([...currencies].filter(cur => cur !== state.displayCurrency).map(async cur => {
    try { const result = await providers.market.fx(cur, state.displayCurrency); if (result?.rate) fx[`${cur}/${state.displayCurrency}`] = result; }
    catch (error) { failures.push({ pair: `${cur}/${state.displayCurrency}`, code: error.code || 'PROVIDER_UNAVAILABLE' }); }
  }));
  return { ...summarizePortfolio(state, { quotes, fx, now: ctx.now }), feedErrors: failures };
}

export async function listPortfolios(ctx, options = {}) {
  const rows = await ctx.store.list('portfolios', { ownerId: ctx.user.id, limit: 100 });
  const summaries = [];
  for (const row of rows) summaries.push(await portfolioSummary(ctx, row.value, options));
  return summaries;
}

async function mayReadMarket(ctx) {
  try { await ctx.requireFeature('market.read'); return true; }
  catch (error) { if (['UPGRADE_REQUIRED', 'EMAIL_VERIFICATION_REQUIRED'].includes(error.code)) return false; throw error; }
}

export async function handlePortfolio(ctx, action, body = null, params = {}) {
  if (!['product-portfolio', 'product-portfolio-export'].includes(action)) return null;
  assertUser(ctx);
  if (action === 'product-portfolio-export') {
    const id = typeof params.get === 'function' ? params.get('portfolioId') : params.portfolioId;
    const row = await getOwned(ctx, id);
    return { portfolio: row.value, summary: await portfolioSummary(ctx, row.value, { fetchPrices: false }), exportedAt: new Date(ctx.now).toISOString(), format: 'nortivo-manual-portfolio-v1' };
  }
  if (!body) {
    const id = typeof params.get === 'function' ? params.get('portfolioId') : params.portfolioId;
    const fetchPrices = await mayReadMarket(ctx);
    if (!id) return { portfolios: await listPortfolios(ctx, { fetchPrices }) };
    const row = await getOwned(ctx, id);
    return { portfolio: row.value, summary: await portfolioSummary(ctx, row.value, { fetchPrices }) };
  }
  if (!body.command || typeof body.command !== 'object' || Array.isArray(body.command) || !/^[A-Za-z0-9_-]{8,128}$/.test(body.requestId || '')) fail('INVALID_PORTFOLIO_COMMAND', 'Send a portfolio command with a stable request ID.', 400);
  const command = body.command, digest = commandDigest(command), receiptKey = `${ctx.user.id}:portfolio:${sha256(body.requestId)}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const receipt = await ctx.store.get('receipts', receiptKey);
    if (receipt) {
      if (receipt.ownerId !== ctx.user.id || receipt.value.digest !== digest) fail('REQUEST_CONFLICT', 'This request ID was already used for another action.', 409);
      const row = await getOwned(ctx, receipt.value.portfolioId);
      return { portfolio: row.value, summary: await portfolioSummary(ctx, row.value, { fetchPrices: await mayReadMarket(ctx) }), replayed: true };
    }
    await ctx.requireFeature('portfolio.write');
    let state, row = null, accountLock = null;
    if (command.type === 'portfolio_create') {
      const count = await ctx.store.list('portfolios', { ownerId: ctx.user.id, limit: 100 });
      if (count.length >= 20) fail('PORTFOLIO_LIMIT', 'You can keep up to 20 portfolios. Existing records remain available.', 409);
      accountLock = await ctx.store.get('accounts', ctx.user.id);
      if (!accountLock || accountLock.ownerId !== ctx.user.id) fail('ACCOUNT_UNAVAILABLE', 'Reload your account before creating a portfolio.', 409);
      state = createPortfolio(command, { now: ctx.now });
    } else {
      row = await getOwned(ctx, command.portfolioId);
      state = applyPortfolioCommand(row.value, command, { now: ctx.now });
      if (Object.keys(state.instruments).length > 100) fail('HOLDINGS_LIMIT', 'A portfolio supports 100 identified instruments. Use another portfolio for additional holdings.', 409);
    }
    const summary = await portfolioSummary(ctx, state);
    // These are observed snapshots at actual recording time. Backdated ledger
    // changes never fabricate or rewrite historic market valuations.
    if (command.type !== 'portfolio_create' && summary.valuationStatus === 'complete') {
      state.history.push({ asOf: new Date(ctx.now).toISOString(), totalValue: summary.totalValue, currency: state.displayCurrency,
        source: 'recorded_snapshot', ledgerRevision: state.transactions.length + state.amendments.length,
        conversions: summary.conversions, note: 'Observed valuation; not a cash-flow-adjusted investment return.' });
      summary.history = state.history;
    }
    const result = await ctx.store.transact([
      ...(accountLock ? [{ ns: 'accounts', key: ctx.user.id, ownerId: ctx.user.id, expectedVersion: accountLock.version, value: { ...accountLock.value, portfolioRevision: (accountLock.value.portfolioRevision || 0) + 1 } }] : []),
      { ns: 'portfolios', key: keyFor(ctx.user.id, state.id), ownerId: ctx.user.id, expectedVersion: row?.version ?? null, value: state },
      { ns: 'receipts', key: receiptKey, ownerId: ctx.user.id, expectedVersion: null, value: { digest, portfolioId: state.id, commandType: command.type, recordedAt: ctx.now } },
    ]);
    if (result.status === 'applied') return { portfolio: state, summary, replayed: false };
  }
  fail('CONCURRENT_UPDATE', 'Another action changed this portfolio. Retry with the same request ID.', 409);
}
