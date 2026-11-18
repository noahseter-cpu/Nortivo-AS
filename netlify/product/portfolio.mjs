import { randomUUID } from 'node:crypto';
import { fail } from '../terminal/security.mjs';
import { units, decimal, canonical, multiply, divide, divideRounded } from './decimal.mjs';

export const CURRENCIES = Object.freeze(['USD', 'NOK', 'EUR', 'GBP', 'CHF', 'SEK', 'DKK', 'CAD', 'JPY']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const text = (value, max, field, required = false) => {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value) || required && !value.trim())
    fail('INVALID_PORTFOLIO', `Enter a valid ${field}.`, 400);
  return value.trim();
};
export function currency(value) {
  if (!CURRENCIES.includes(value)) fail('INVALID_CURRENCY', 'Choose a supported currency.', 400);
  return value;
}
const time = now => new Date(now).toISOString();
function timestamp(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [,year,month,day,hour,minute,second = '0',zone] = match;
  const dateCheck = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (dateCheck.getUTCFullYear() !== Number(year) || dateCheck.getUTCMonth() + 1 !== Number(month) || dateCheck.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  if (zone !== 'Z') { const [h,m] = zone.slice(1).split(':').map(Number); if (h > 14 || m > 59 || h === 14 && m !== 0) return null; }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function date(value, now, optional = false) {
  if (optional && (value == null || value === '')) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value || value > time(now).slice(0, 10))
    fail('INVALID_DATE', 'Use a valid date no later than today.', 400);
  return value;
}

export function normalizeInstrument(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_INSTRUMENT', 'Choose an instrument or identify a manual holding.', 400);
  const instrument = {
    id: text(input.id, 120, 'instrument ID', true), symbol: text(input.symbol, 24, 'symbol', true),
    name: text(input.name, 120, 'instrument name', true), venue: text(input.venue, 24, 'venue', true),
    currency: currency(input.currency), assetType: input.assetType,
  };
  if (!/^[A-Za-z0-9:._-]+$/.test(instrument.id) || !['stock', 'etf', 'manual'].includes(instrument.assetType))
    fail('INVALID_INSTRUMENT', 'Enter a stable instrument ID and supported asset type.', 400);
  return instrument;
}

export function createPortfolio(input, { now = Date.now() } = {}) {
  return { version: 1, id: randomUUID(), name: text(input.name, 80, 'portfolio name', true), displayCurrency: currency(input.displayCurrency || 'USD'),
    source: 'manual', createdAt: time(now), updatedAt: time(now), instruments: {}, transactions: [], amendments: [], valuations: {}, history: [] };
}

function normalizeTransaction(input, state, now, opening = false) {
  const kind = opening ? 'opening' : input.kind;
  if (!['opening', 'buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'split'].includes(kind)) fail('INVALID_TRANSACTION', 'Choose a supported transaction type.', 400);
  const txn = { id: randomUUID(), kind, date: date(opening ? Object.hasOwn(input, 'purchaseDate') ? input.purchaseDate : input.date : input.date, now, opening), recordedAt: time(now), notes: text(input.notes, 1000, 'notes'), fees: canonical(input.fees ?? '0', { signed: false, field: 'fees' }) };
  if (['deposit', 'withdrawal'].includes(kind)) {
    txn.currency = currency(input.currency); txn.amount = canonical(input.amount, { positive: true });
    if (units(txn.fees) !== 0n) fail('INVALID_TRANSACTION', 'Record cash transfer fees separately as part of the transferred amount.', 400);
    return txn;
  }
  const instrument = input.instrument ? normalizeInstrument(input.instrument) : state.instruments[input.instrumentId];
  if (!instrument) fail('INVALID_INSTRUMENT', 'Choose the exact instrument for this transaction.', 400);
  const old = state.instruments[instrument.id];
  if (old && JSON.stringify(old) !== JSON.stringify(instrument)) fail('INSTRUMENT_CONFLICT', 'An instrument ID cannot change its identity or currency.', 409);
  txn.instrument = instrument; txn.instrumentId = instrument.id; txn.currency = instrument.currency;
  if (input.currency && input.currency !== instrument.currency) fail('INVALID_CURRENCY', 'Transaction currency must match the instrument currency.', 400);
  if (kind === 'dividend') txn.amount = canonical(input.amount, { positive: true });
  else if (kind === 'split') {
    txn.ratio = canonical(input.ratio, { positive: true, field: 'split ratio' });
    if (units(txn.fees) !== 0n) fail('INVALID_TRANSACTION', 'A split must not introduce trading fees.', 400);
  } else {
    txn.quantity = canonical(input.quantity, { positive: true, field: 'quantity' });
    const suppliedPrice = opening ? Object.hasOwn(input, 'unitCost') ? input.unitCost : input.unitPrice : input.unitPrice;
    txn.unitPrice = opening && (suppliedPrice == null || suppliedPrice === '') ? null : canonical(suppliedPrice, { signed: false, field: 'unit price' });
    if (txn.unitPrice === null && units(txn.fees) !== 0n) fail('INVALID_TRANSACTION', 'Add fees after the unknown purchase cost is supplied.', 400);
  }
  return txn;
}

export function effectiveTransactions(state) {
  const map = new Map(state.transactions.map(txn => [txn.id, txn]));
  for (const amendment of state.amendments) {
    if (!map.has(amendment.transactionId)) fail('CORRUPT_LEDGER', 'A ledger correction references a missing transaction.', 409);
    if (amendment.type === 'void') map.set(amendment.transactionId, null);
    else map.set(amendment.transactionId, amendment.replacement);
  }
  // Undated opening lots are a disclosed baseline, never a fabricated purchase.
  return [...map.values()].filter(Boolean).sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.recordedAt.localeCompare(b.recordedAt) || state.transactions.findIndex(t => t.id === a.id) - state.transactions.findIndex(t => t.id === b.id));
}

export function calculateLedger(state) {
  const holdings = new Map(), cash = new Map(), contributions = new Map(), dividends = new Map(), realized = new Map();
  let unknownRealized = false, openingBaseline = false;
  const add = (map, key, value) => map.set(key, (map.get(key) || 0n) + value);
  const moveCash = (cur, amount) => {
    add(cash, cur, amount);
    if (cash.get(cur) < 0n) fail('INSUFFICIENT_CASH', `This ledger would have a negative ${cur} cash balance. Add the deposit first or correct the transaction.`, 409);
  };
  for (const txn of effectiveTransactions(state)) {
    const cur = txn.currency, fees = units(txn.fees);
    if (txn.kind === 'deposit' || txn.kind === 'withdrawal') {
      const change = units(txn.amount) * (txn.kind === 'withdrawal' ? -1n : 1n);
      moveCash(cur, change); add(contributions, cur, change); continue;
    }
    const id = txn.instrumentId;
    if (!holdings.has(id)) holdings.set(id, { instrument: txn.instrument, lots: [], quantity: 0n, realized: 0n, realizedKnown: true });
    const holding = holdings.get(id);
    if (txn.kind === 'dividend') {
      moveCash(cur, units(txn.amount) - fees); add(dividends, cur, units(txn.amount) - fees); continue;
    }
    if (txn.kind === 'split') {
      if (!holding.quantity) fail('INVALID_SPLIT', 'A split requires an existing position.', 409);
      const newTotal = multiply(holding.quantity, units(txn.ratio));
      if (newTotal <= 0n) fail('INVALID_SPLIT', 'This split is below the supported quantity precision.', 400);
      let allocated = 0n;
      for (let i = 0; i < holding.lots.length; i++) {
        const lot = holding.lots[i];
        lot.quantity = i === holding.lots.length - 1 ? newTotal - allocated : multiply(lot.quantity, units(txn.ratio));
        if (lot.quantity <= 0n) fail('INVALID_SPLIT', 'This split would erase a lot below supported precision. Record a verified cash-in-lieu correction instead.', 400);
        allocated += lot.quantity;
      }
      holding.quantity = newTotal; continue;
    }
    const quantity = units(txn.quantity), principal = txn.unitPrice === null ? null : multiply(quantity, units(txn.unitPrice));
    if (txn.kind === 'buy' || txn.kind === 'opening') {
      const cost = principal === null ? null : principal + fees;
      if (txn.kind === 'buy') moveCash(cur, -cost);
      else openingBaseline = true;
      holding.lots.push({ transactionId: txn.id, quantity, cost, purchaseDate: txn.date }); holding.quantity += quantity;
    } else {
      if (quantity > holding.quantity) fail('INSUFFICIENT_HOLDINGS', 'This sale exceeds the position available on its date.', 409);
      let remaining = quantity, basis = 0n, known = true;
      for (const lot of holding.lots) {
        if (!remaining) break;
        const taken = remaining < lot.quantity ? remaining : lot.quantity;
        const consumed = lot.cost === null ? null : taken === lot.quantity ? lot.cost : divideRounded(lot.cost * taken, lot.quantity);
        if (consumed === null) known = false; else { basis += consumed; lot.cost -= consumed; }
        lot.quantity -= taken; remaining -= taken;
      }
      holding.lots = holding.lots.filter(lot => lot.quantity > 0n); holding.quantity -= quantity;
      const proceeds = principal - fees;
      if (proceeds < 0n) fail('INVALID_TRANSACTION', 'Sale fees cannot exceed the proceeds.', 400);
      moveCash(cur, proceeds);
      if (known) { holding.realized += proceeds - basis; add(realized, cur, proceeds - basis); }
      else { holding.realizedKnown = false; unknownRealized = true; }
    }
  }
  return { holdings, cash, contributions, dividends, realized, unknownRealized, openingBaseline };
}

export function applyPortfolioCommand(state, command, { now = Date.now() } = {}) {
  const next = structuredClone(state);
  if (command.type === 'portfolio_settings') {
    if (command.name !== undefined) next.name = text(command.name, 80, 'portfolio name', true);
    if (command.displayCurrency !== undefined) next.displayCurrency = currency(command.displayCurrency);
  } else if (command.type === 'valuation_set') {
    const instrument = next.instruments[command.instrumentId];
    if (!instrument) fail('INVALID_INSTRUMENT', 'Choose an existing holding.', 400);
    if (command.currency !== instrument.currency) fail('INVALID_CURRENCY', 'The manual value must use the instrument currency.', 400);
    const asOf = command.asOf;
    if (timestamp(asOf) === null || timestamp(asOf) > now + 60000) fail('INVALID_DATE', 'Enter the actual valuation timestamp with its timezone.', 400);
    const value = { price: canonical(command.price, { signed: false, field: 'valuation price' }), currency: instrument.currency, asOf: new Date(asOf).toISOString(), source: 'manual', recordedAt: time(now) };
    next.valuations[command.instrumentId] = value;
  } else if (command.type === 'opening_position' || command.type === 'transaction_add') {
    const txn = normalizeTransaction(command, next, now, command.type === 'opening_position');
    if (txn.instrument) next.instruments[txn.instrument.id] = txn.instrument;
    next.transactions.push(txn);
  } else if (command.type === 'transaction_correct' || command.type === 'transaction_void') {
    const original = effectiveTransactions(next).find(txn => txn.id === command.transactionId);
    if (!original) fail('TRANSACTION_NOT_FOUND', 'Choose an active transaction to correct or void.', 404);
    const amendment = { id: randomUUID(), transactionId: original.id, type: command.type === 'transaction_void' ? 'void' : 'correct', recordedAt: time(now) };
    if (amendment.type === 'correct') {
      if (!command.replacement || command.replacement.kind && command.replacement.kind !== original.kind) fail('INVALID_CORRECTION', 'Keep the original transaction type; void it and add another type when needed.', 400);
      amendment.replacement = { ...normalizeTransaction({ ...command.replacement, kind: original.kind }, next, now, original.kind === 'opening'), id: original.id, recordedAt: original.recordedAt };
      if (amendment.replacement.instrument) next.instruments[amendment.replacement.instrument.id] = amendment.replacement.instrument;
    }
    next.amendments.push(amendment);
  } else fail('INVALID_PORTFOLIO_COMMAND', 'Choose a supported portfolio action.', 400);
  calculateLedger(next); // Replay the full effective ledger before accepting any correction.
  next.updatedAt = time(now);
  return next;
}

export function summarizePortfolio(state, { quotes = {}, fx = {}, now = Date.now() } = {}) {
  const ledger = calculateLedger(state), missingPrices = [], missingFx = new Set(), conversions = [], warnings = [];
  let total = 0n, pricedParts = 0, missingParts = 0;
  const convert = (amount, cur) => {
    if (cur === state.displayCurrency) return amount;
    const rate = fx[`${cur}/${state.displayCurrency}`];
    const rateTime = timestamp(rate?.asOf);
    if (!rate || rateTime === null || rateTime > now + 60000 || now - rateTime > 300000 || rate.freshness === 'stale' || rate.freshness === 'unavailable') { missingFx.add(`${cur}/${state.displayCurrency}`); return null; }
    let value; try { value = multiply(amount, units(rate.rate, { positive: true })); } catch { missingFx.add(`${cur}/${state.displayCurrency}`); return null; }
    if (!conversions.some(item => item.pair === `${cur}/${state.displayCurrency}`)) conversions.push({ pair: `${cur}/${state.displayCurrency}`, rate: canonical(rate.rate), asOf: rate.asOf, source: rate.source || null });
    return value;
  };
  const holdings = [...ledger.holdings.values()].map(holding => {
    const { instrument } = holding, id = instrument.id;
    const knownBasis = holding.lots.every(lot => lot.cost !== null);
    const basis = knownBasis ? holding.lots.reduce((n, lot) => n + lot.cost, 0n) : null;
    let quote = quotes[id], source = 'unavailable', status = 'unavailable', price = null, asOf = null;
    const quoteTime = timestamp(quote?.asOf), delay = quote?.freshness === 'delayed' && Number.isInteger(quote.delayMinutes) && quote.delayMinutes >= 0 && quote.delayMinutes <= 1440 ? quote.delayMinutes * 60000 : 0;
    const maxQuoteAge = quote?.freshness === 'market_closed' ? 4 * 86400000 : delay + 120000;
    if (quote && quote.instrumentId === id && quote.currency === instrument.currency && quoteTime !== null && quoteTime <= now + 60000 && now - quoteTime <= maxQuoteAge && ['current', 'delayed', 'market_closed'].includes(quote.freshness)) {
      try { price = units(quote.price, { signed: false }); source = quote.source || 'provider'; status = quote.freshness || 'current'; asOf = quote.asOf; } catch { /* unusable provider price */ }
    }
    if (price === null && state.valuations[id]) {
      quote = state.valuations[id]; price = units(quote.price, { signed: false }); source = 'manual'; status = 'manual'; asOf = quote.asOf;
    }
    const marketValue = price === null ? null : multiply(holding.quantity, price);
    const displayValue = marketValue === null ? null : convert(marketValue, instrument.currency);
    if (holding.quantity > 0n) {
      if (price === null) missingPrices.push(id);
      if (displayValue === null) missingParts++; else { total += displayValue; pricedParts++; }
    }
    return { instrument, quantity: decimal(holding.quantity), costBasis: basis === null ? null : decimal(basis), costCurrency: instrument.currency,
      marketPrice: price === null ? null : decimal(price), marketValue: marketValue === null ? null : decimal(marketValue), marketCurrency: instrument.currency,
      displayValue: displayValue === null ? null : decimal(displayValue), unrealizedPnl: basis === null || marketValue === null ? null : decimal(marketValue - basis),
      realizedPnl: holding.realizedKnown ? decimal(holding.realized) : null, valuationSource: source, asOf, status,
      lots: holding.lots.map(lot => ({ transactionId: lot.transactionId, quantity: decimal(lot.quantity), costBasis: lot.cost === null ? null : decimal(lot.cost), purchaseDate: lot.purchaseDate })), allocationPercent: null };
  });
  const cash = [...ledger.cash].map(([cur, amount]) => {
    const converted = amount === 0n ? 0n : convert(amount, cur);
    if (amount !== 0n) { if (converted === null) missingParts++; else { total += converted; pricedParts++; } }
    return { currency: cur, amount: decimal(amount), displayValue: converted === null ? null : decimal(converted) };
  });
  const valuationStatus = !missingParts ? 'complete' : pricedParts ? 'partial' : 'unavailable';
  let displayBasis = 0n, displayGain = 0n, basisComplete = true, gainComplete = true;
  for (const holding of holdings.filter(h => units(h.quantity) > 0n)) {
    const basis = holding.costBasis === null ? null : convert(units(holding.costBasis), holding.costCurrency);
    if (basis === null) basisComplete = false; else displayBasis += basis;
    if (basis === null || holding.displayValue === null) gainComplete = false;
    else displayGain += units(holding.displayValue) - basis;
  }
  if (valuationStatus === 'complete' && total > 0n) for (const holding of holdings) if (holding.displayValue !== null) holding.allocationPercent = decimal(multiply(divide(units(holding.displayValue), total), units('100')));
  if (ledger.openingBaseline) warnings.push('Opening positions are a manually entered baseline; they do not establish past cash flows or investment performance.');
  if (holdings.some(h => h.costBasis === null)) warnings.push('Some purchase costs are unknown; gain/loss is unavailable for those lots.');
  if (ledger.unknownRealized) warnings.push('Realized gain/loss is incomplete because sold lots include unknown purchase costs.');
  warnings.push('Corporate actions are not automatically applied. Record verified splits or correct the ledger; do not apply both.');
  return { id: state.id, name: state.name, displayCurrency: state.displayCurrency, source: 'manual', createdAt: state.createdAt, updatedAt: state.updatedAt,
    holdings, cash, totalValue: valuationStatus === 'complete' ? decimal(total) : null, knownValue: decimal(total),
    displayCostBasis: basisComplete ? decimal(displayBasis) : null, displayUnrealizedPnl: gainComplete ? decimal(displayGain) : null,
    displayBasisMethod: 'Native-currency lot costs converted with the displayed FX timestamp; not historical FX-adjusted investment performance.',
    valuationStatus, missingPrices, missingFx: [...missingFx], conversions,
    netContributions: Object.fromEntries([...ledger.contributions].map(([cur, value]) => [cur, decimal(value)])),
    dividends: Object.fromEntries([...ledger.dividends].map(([cur, value]) => [cur, decimal(value)])), realizedPnl: ledger.unknownRealized ? null : Object.fromEntries([...ledger.realized].map(([cur, value]) => [cur, decimal(value)])),
    history: state.history, performance: { available: false, reason: 'Complete dated cash flows and recorded valuations are required. No history is reconstructed from current holdings.' }, warnings };
}

export const isPortfolioId = value => typeof value === 'string' && UUID.test(value);
