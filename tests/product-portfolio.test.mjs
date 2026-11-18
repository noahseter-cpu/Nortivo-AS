import test from 'node:test';
import assert from 'node:assert/strict';
import { units, decimal, multiply, divide, divideRounded } from '../netlify/product/decimal.mjs';
import { createPortfolio, applyPortfolioCommand, calculateLedger, summarizePortfolio, effectiveTransactions } from '../netlify/product/portfolio.mjs';
import { handlePortfolio } from '../netlify/product/portfolio-service.mjs';

const now = Date.parse('2026-11-18T12:00:00Z');
const instrument = { id: 'XNAS:AAPL:USD', symbol: 'AAPL', name: 'Apple Inc.', venue: 'XNAS', currency: 'USD', assetType: 'stock' };
const manual = { id: 'manual:private', symbol: 'PRIVATE', name: 'Private holding', venue: 'MANUAL', currency: 'EUR', assetType: 'manual' };
const initial = () => createPortfolio({ name: 'My portfolio', displayCurrency: 'USD' }, { now });
const apply = (state, command) => applyPortfolioCommand(state, command, { now });
const opening = (state, quantity = '10', unitCost = '100') => apply(state, { type: 'opening_position', instrument, quantity, unitCost });
const tx = (state, kind, input = {}) => apply(state, { type: 'transaction_add', kind, date: '2026-11-17', ...input });
const quote = (price = '120') => ({ [instrument.id]: { instrumentId: instrument.id, price, currency: 'USD', asOf: '2026-11-18T11:59:59Z', source: 'test-fixture', freshness: 'current' } });
const summary = (state, options = {}) => summarizePortfolio(state, { now, ...options });
const error = (fn, code) => assert.throws(fn, err => err.code === code);

test('fixed point arithmetic preserves decimal quantities and symmetric ties', () => {
  assert.equal(decimal(multiply(units('0.1'), units('0.2'))), '0.02');
  assert.equal(decimal(divide(units('1'), units('3'))), '0.33333333');
  assert.equal(divideRounded(-5n, 2n), -3n);
  for (const input of ['1e3', 'NaN', '0.000000001', '01', '1000000000000000', 0.1, '', null]) error(() => units(input), 'INVALID_DECIMAL');
});

test('an undated opening lot stays undated and does not manufacture cash or history', () => {
  const state = opening(initial(), '1.125', '10.2'), value = summary(state, { quotes: quote('12.4') });
  assert.equal(state.transactions[0].date, null);
  assert.deepEqual(value.cash, []);
  assert.equal(value.holdings[0].costBasis, '11.475');
  assert.equal(value.totalValue, '13.95');
  assert.equal(value.holdings[0].unrealizedPnl, '2.475');
  assert.deepEqual(value.history, []);
  assert.equal(value.performance.available, false);
});

test('unknown opening cost leaves unrealized and realized gains unknown', () => {
  let state = opening(initial(), '2', null);
  assert.equal(summary(state, { quotes: quote() }).holdings[0].costBasis, null);
  state = tx(state, 'sell', { instrumentId: instrument.id, quantity: '1', unitPrice: '120', fees: '1' });
  const value = summary(state, { quotes: quote() });
  assert.equal(value.holdings[0].realizedPnl, null);
  assert.equal(value.realizedPnl, null);
  assert.equal(value.cash[0].amount, '119');
});

test('cash deposits, buys, FIFO sales and fees reconcile exactly', () => {
  let state = tx(initial(), 'deposit', { amount: '1000', currency: 'USD', date: '2026-11-01' });
  state = tx(state, 'buy', { instrument, quantity: '2', unitPrice: '100', fees: '2', date: '2026-11-02' });
  state = tx(state, 'buy', { instrument, quantity: '2', unitPrice: '120', fees: '2', date: '2026-11-03' });
  state = tx(state, 'sell', { instrumentId: instrument.id, quantity: '3', unitPrice: '130', fees: '3', date: '2026-11-04' });
  const value = summary(state, { quotes: quote('130') });
  assert.equal(value.cash[0].amount, '943');
  assert.equal(value.holdings[0].quantity, '1');
  assert.equal(value.holdings[0].costBasis, '121');
  assert.equal(value.holdings[0].realizedPnl, '64');
  assert.equal(value.totalValue, '1073');
  assert.equal(value.netContributions.USD, '1000');
});

test('fractional lot allocations preserve the residual cost through all sales', () => {
  let state = opening(initial(), '3', '0.33333333');
  for (let i = 0; i < 3; i++) state = tx(state, 'sell', { instrumentId: instrument.id, quantity: '1', unitPrice: '1' });
  const value = summary(state);
  assert.equal(value.holdings[0].costBasis, '0');
  assert.equal(value.holdings[0].realizedPnl, '2.00000001');
  assert.equal(value.totalValue, '3');
});

test('sells cannot exceed holdings and cash cannot go negative or borrow another currency', () => {
  error(() => tx(opening(initial()), 'sell', { instrumentId: instrument.id, quantity: '11', unitPrice: '120' }), 'INSUFFICIENT_HOLDINGS');
  const state = tx(initial(), 'deposit', { amount: '10000', currency: 'NOK' });
  error(() => tx(state, 'buy', { instrument, quantity: '1', unitPrice: '100' }), 'INSUFFICIENT_CASH');
  error(() => tx(state, 'withdrawal', { amount: '10001', currency: 'NOK' }), 'INSUFFICIENT_CASH');
});

test('dividend income enters cash once and is separate from contributions', () => {
  const state = tx(opening(initial()), 'dividend', { instrumentId: instrument.id, amount: '12.5', fees: '0.5' });
  const value = summary(state, { quotes: quote() });
  assert.equal(value.dividends.USD, '12');
  assert.deepEqual(value.netContributions, {});
  assert.equal(value.totalValue, '1212');
});

test('splits change quantities without changing cost, and void replays the original quantities', () => {
  let state = tx(opening(initial()), 'split', { instrumentId: instrument.id, ratio: '4' });
  assert.equal(summary(state).holdings[0].quantity, '40');
  assert.equal(summary(state).holdings[0].costBasis, '1000');
  state = apply(state, { type: 'transaction_void', transactionId: state.transactions.at(-1).id });
  assert.equal(summary(state).holdings[0].quantity, '10');
  assert.equal(state.transactions.length, 2);
  assert.equal(state.amendments.length, 1);
});

test('an impossible reverse split is rejected instead of discarding cost', () => {
  const state = opening(initial(), '0.00000001', '1');
  error(() => tx(state, 'split', { instrumentId: instrument.id, ratio: '0.1' }), 'INVALID_SPLIT');
});

test('correction and void retain immutable originals and validate every subsequent transaction', () => {
  let state = tx(opening(initial()), 'sell', { instrumentId: instrument.id, quantity: '5', unitPrice: '120' });
  const original = state.transactions[0];
  error(() => apply(state, { type: 'transaction_void', transactionId: original.id }), 'INSUFFICIENT_HOLDINGS');
  error(() => apply(state, { type: 'transaction_correct', transactionId: original.id, replacement: { instrument, quantity: '4', unitCost: '90' } }), 'INSUFFICIENT_HOLDINGS');
  state = apply(state, { type: 'transaction_correct', transactionId: original.id, replacement: { instrument, quantity: '10', unitCost: '90' } });
  assert.equal(state.transactions[0].unitPrice, '100');
  assert.equal(effectiveTransactions(state)[0].unitPrice, '90');
  assert.equal(summary(state).holdings[0].realizedPnl, '150');
});

test('backdated transactions replay by actual date and reject negative historical cash', () => {
  let state = tx(initial(), 'deposit', { amount: '1000', currency: 'USD', date: '2026-11-02' });
  error(() => tx(state, 'buy', { instrument, quantity: '1', unitPrice: '100', date: '2026-11-01' }), 'INSUFFICIENT_CASH');
  for (const date of ['2026-02-30', '2026-11-19', '12/01/2026']) error(() => tx(state, 'deposit', { amount: '1', currency: 'USD', date }), 'INVALID_DATE');
});

test('manual instrument identities cannot silently change currency', () => {
  const state = opening(initial());
  error(() => apply(state, { type: 'opening_position', instrument: { ...instrument, currency: 'EUR' }, quantity: '1', unitCost: '1' }), 'INSTRUMENT_CONFLICT');
  error(() => tx(state, 'buy', { instrument, quantity: '1', unitPrice: '1', currency: 'NOK' }), 'INVALID_CURRENCY');
});

test('missing prices and missing FX never produce a misleading complete total', () => {
  let state = opening(initial());
  state = tx(state, 'deposit', { amount: '100', currency: 'USD' });
  assert.equal(summary(state).valuationStatus, 'partial');
  assert.equal(summary(state).totalValue, null);
  assert.equal(summary(state).knownValue, '100');
  state = apply(state, { type: 'opening_position', instrument: manual, quantity: '2', unitCost: '20' });
  state = apply(state, { type: 'valuation_set', instrumentId: manual.id, price: '30', currency: 'EUR', asOf: '2026-11-17T12:00:00Z' });
  const value = summary(state, { quotes: quote() });
  assert.equal(value.totalValue, null);
  assert.deepEqual(value.missingFx, ['EUR/USD']);
  assert.equal(value.holdings.find(h => h.instrument.id === manual.id).valuationSource, 'manual');
});

test('FX conversion is decimal exact, timestamped and used only in display totals', () => {
  const state = apply(initial(), { type: 'opening_position', instrument: manual, quantity: '2', unitCost: '20' });
  const value = summary(state, { quotes: { [manual.id]: { instrumentId: manual.id, price: '30', currency: 'EUR', asOf: '2026-11-18T12:00:00Z', freshness: 'current' } }, fx: { 'EUR/USD': { rate: '1.12345678', asOf: '2026-11-18T11:59:00Z', source: 'fixture' } } });
  assert.equal(value.totalValue, '67.4074068');
  assert.equal(value.holdings[0].unrealizedPnl, '20');
  assert.equal(value.displayCostBasis, '44.9382712');
  assert.equal(value.displayUnrealizedPnl, '22.4691356');
  assert.equal(value.holdings[0].marketCurrency, 'EUR');
  assert.equal(value.conversions[0].asOf, '2026-11-18T11:59:00Z');
});

test('stale, wrong-currency, wrong-identity and future quotes do not become current valuations', () => {
  const state = opening(initial());
  for (const change of [{ freshness: 'stale' }, { freshness: 'unverified' }, { currency: 'EUR' }, { instrumentId: 'OTHER' }, { asOf: '2026-11-19T00:00:00Z' }, { price: '-1' }]) {
    const quotes = quote(); Object.assign(quotes[instrument.id], change);
    assert.equal(summary(state, { quotes }).totalValue, null);
  }
});

test('opening corrections can explicitly clear an unknown date and purchase cost', () => {
  let state = apply(initial(), { type: 'opening_position', instrument, quantity: '1', unitCost: '100', purchaseDate: '2026-10-01' });
  state = apply(state, { type: 'transaction_correct', transactionId: state.transactions[0].id, replacement: { ...state.transactions[0], purchaseDate: null, unitCost: null } });
  const value = summary(state, { quotes: quote() });
  assert.equal(value.holdings[0].costBasis, null);
  assert.equal(value.holdings[0].lots[0].purchaseDate, null);
  assert.equal(state.transactions[0].date, '2026-10-01');
});

test('manual valuation rejects normalized impossible dates and timestamps without a timezone', () => {
  const state = opening(initial());
  for (const asOf of ['2026-02-30T12:00:00Z', '2026-11-18T24:00:00Z', '2026-11-18T12:00:00', '2026-11-18', '2026-11-18T12:00:00+14:30'])
    error(() => apply(state, { type: 'valuation_set', instrumentId: instrument.id, currency: 'USD', price: '120', asOf }), 'INVALID_DATE');
});

test('old quote and FX timestamps cannot be made current by changing the freshness label', () => {
  const state = opening(initial()); const quotes = quote(); quotes[instrument.id].asOf = '2000-01-01T00:00:00Z';
  assert.equal(summary(state, { quotes }).totalValue, null);
  const eur = apply(initial(), { type: 'opening_position', instrument: manual, quantity: '2', unitCost: '20' });
  const value = summary(eur, { quotes: { [manual.id]: { instrumentId: manual.id, price: '30', currency: 'EUR', asOf: '2026-11-18T12:00:00Z', freshness: 'current' } }, fx: { 'EUR/USD': { rate: '1.1', asOf: '2000-01-01T00:00:00Z', freshness: 'current' } } });
  assert.equal(value.totalValue, null); assert.equal(value.displayCostBasis, null); assert.deepEqual(value.missingFx, ['EUR/USD']);
});

function context() {
  const user = { id: '11111111-1111-4111-8111-111111111111', kind: 'user' }, records = new Map();
  records.set(`accounts:${user.id}`, { key: user.id, ownerId: user.id, version: 1, value: { emailVerified: true } });
  return { user, now, requireFeature: async () => ({ tier: 'portfolio' }), store: {
    async get(ns, key) { return structuredClone(records.get(`${ns}:${key}`) || null); },
    async list(ns, { ownerId }) { return structuredClone([...records].filter(([key, value]) => key.startsWith(`${ns}:`) && value.ownerId === ownerId).map(([, value]) => value)); },
    async transact(changes) {
      if (changes.some(c => (records.get(`${c.ns}:${c.key}`)?.version ?? null) !== c.expectedVersion)) return { status: 'conflict' };
      for (const c of changes) records.set(`${c.ns}:${c.key}`, { key: c.key, ownerId: c.ownerId, version: (records.get(`${c.ns}:${c.key}`)?.version || 0) + 1, value: structuredClone(c.value) });
      return { status: 'applied' };
    },
  } };
}

test('service receipts prevent duplicate transactions and reject request ID reuse with changed content', async () => {
  const ctx = context(), body = { requestId: 'create_request_1', command: { type: 'portfolio_create', name: 'Retirement', displayCurrency: 'USD' } };
  const first = await handlePortfolio(ctx, 'product-portfolio', body);
  const repeated = await handlePortfolio(ctx, 'product-portfolio', body);
  assert.equal(first.portfolio.id, repeated.portfolio.id);
  assert.equal(repeated.replayed, true);
  await assert.rejects(handlePortfolio(ctx, 'product-portfolio', { ...body, command: { ...body.command, name: 'Other' } }), e => e.code === 'REQUEST_CONFLICT');
  const deposit = { requestId: 'deposit_request_1', command: { type: 'transaction_add', portfolioId: first.portfolio.id, kind: 'deposit', amount: '100', currency: 'USD', date: '2026-11-18' } };
  await Promise.all(Array.from({ length: 8 }, () => handlePortfolio(ctx, 'product-portfolio', deposit)));
  const final = await handlePortfolio(ctx, 'product-portfolio', null, { portfolioId: first.portfolio.id });
  assert.equal(final.portfolio.transactions.length, 1);
  assert.equal(final.summary.totalValue, '100');
  assert.equal(final.portfolio.history.length, 1);
});

test('private portfolios reject forged owner IDs; expired users retain export but not new writes or paid prices', async () => {
  const ctx = context(), first = await handlePortfolio(ctx, 'product-portfolio', { requestId: 'create_request_1', command: { type: 'portfolio_create', name: 'Private', displayCurrency: 'USD' } });
  const other = { ...ctx, user: { ...ctx.user, id: '22222222-2222-4222-8222-222222222222' } };
  await assert.rejects(handlePortfolio(other, 'product-portfolio', null, { portfolioId: first.portfolio.id }), e => e.code === 'PORTFOLIO_NOT_FOUND');
  let quoteCalls = 0; ctx.providers = { market: { quote: async () => { quoteCalls++; return {}; } } };
  ctx.requireFeature = async () => { throw Object.assign(new Error('Subscription required'), { code: 'UPGRADE_REQUIRED' }); };
  const exported = await handlePortfolio(ctx, 'product-portfolio-export', null, { portfolioId: first.portfolio.id });
  assert.equal(exported.portfolio.name, 'Private');
  await handlePortfolio(ctx, 'product-portfolio', null, { portfolioId: first.portfolio.id });
  assert.equal(quoteCalls, 0);
  await assert.rejects(handlePortfolio(ctx, 'product-portfolio', { requestId: 'write_expired_1', command: { type: 'portfolio_settings', portfolioId: first.portfolio.id, name: 'Blocked' } }), e => e.code === 'UPGRADE_REQUIRED');
});

test('service never converts provider outages into a made-up price', async () => {
  const ctx = context(), first = await handlePortfolio(ctx, 'product-portfolio', { requestId: 'create_request_1', command: { type: 'portfolio_create', name: 'Data unavailable', displayCurrency: 'USD' } });
  ctx.providers = { market: { quote: async () => { throw Object.assign(new Error('Offline'), { code: 'PROVIDER_UNAVAILABLE' }); } } };
  const result = await handlePortfolio(ctx, 'product-portfolio', { requestId: 'opening_request_1', command: { type: 'opening_position', portfolioId: first.portfolio.id, instrument, quantity: '1', unitCost: '100' } });
  assert.equal(result.summary.totalValue, null);
  assert.equal(result.summary.feedErrors[0].code, 'PROVIDER_UNAVAILABLE');
  assert.equal(result.portfolio.history.length, 0);
});

test('concurrent creation cannot bypass the portfolio count bound', async () => {
  const ctx = context();
  for (let i = 0; i < 19; i++) await handlePortfolio(ctx, 'product-portfolio', { requestId: `create-request-${i}`, command: { type: 'portfolio_create', name: `Portfolio ${i}`, displayCurrency: 'USD' } });
  const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => handlePortfolio(ctx, 'product-portfolio', { requestId: `parallel-request-${i}`, command: { type: 'portfolio_create', name: `Parallel ${i}`, displayCurrency: 'USD' } })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.code === 'PORTFOLIO_LIMIT'));
  const list = await handlePortfolio(ctx, 'product-portfolio');
  assert.equal(list.portfolios.length, 20);
});
