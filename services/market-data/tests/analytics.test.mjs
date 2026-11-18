import test from 'node:test';
import assert from 'node:assert/strict';
import { indicators } from '../analytics.mjs';

// Mathematical fixture series, not historical stock data.
function series(length, price = i => 100 + i) {
  return { data: { bars: Array.from({ length }, (_, i) => ({ time: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(), open: price(i), close: price(i), high: price(i) + 1, low: price(i) - 1, volume: 10, complete: true })) }, meta: { sourceId: 'mathematical-fixture' } };
}
test('rising fixture has RSI100 and independently expected linear-series EMA/MACD values', () => {
  const result = indicators(series(60));
  assert.equal(result.data.rsi14, 100);
  assert(Math.abs(result.data.ema9 - 155) < 1e-10);
  assert(Math.abs(result.data.ema20 - 149.5) < 1e-10);
  assert(Math.abs(result.data.macd.value - 7) < 1e-10);
  assert(Math.abs(result.data.macd.signal - 7) < 1e-10);
  assert.equal(result.data.vwap, null); assert.equal(result.data.relativeVolume, null);
});
test('incomplete candles never influence a historical signal and start time is labeled', () => {
  const data = series(40); data.data.bars.at(-1).complete = false; data.data.bars.at(-1).close = 90000;
  const result = indicators(data);
  assert.equal(result.data.completeBarsUsed, 39);
  assert.equal(result.data.lastInputBarStart, data.data.bars.at(-2).time);
  assert.equal(result.data.asOf, undefined);
  assert(result.data.ema9 < 200);
});
test('warmup is explicit and duplicate/out-of-order bars are rejected', () => {
  const short = indicators(series(5)); assert.equal(short.data.ema9, null); assert.equal(short.data.rsi14, null);
  const duplicate = series(20); duplicate.data.bars[1].time = duplicate.data.bars[0].time;
  assert.throws(() => indicators(duplicate), { code: 'invalid_data' });
  assert.throws(() => indicators({ data: { bars: [] } }), { code: 'insufficient_history' });
});
