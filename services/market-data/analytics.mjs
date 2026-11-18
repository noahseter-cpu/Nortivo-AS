import { ApiError } from './core.mjs';

function ema(values, period) {
  const output = Array(values.length).fill(null);
  if (values.length < period) return output;
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  output[period - 1] = value;
  for (let i = period; i < values.length; i++) { value += (values[i] - value) * 2 / (period + 1); output[i] = value; }
  return output;
}

export function indicators(result, { clock = Date.now } = {}) {
  const input = Array.isArray(result.data) ? result.data : result.data?.bars;
  if (!Array.isArray(input)) throw new ApiError('invalid_data', 'A bar series is required for indicators.', 422);
  const bars = input.filter(bar => bar.complete === true);
  if (!bars.length) throw new ApiError('insufficient_history', 'No complete candles are available for indicators.', 422);
  let previous = -Infinity;
  for (const bar of bars) {
    const time = Date.parse(bar.time);
    if (!Number.isFinite(time) || time <= previous || !['open', 'high', 'low', 'close', 'volume'].every(key => typeof bar[key] === 'number' && Number.isFinite(bar[key])) || bar.low <= 0 || bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close) || bar.volume < 0) {
      throw new ApiError('invalid_data', 'Indicators require ascending unique, consistent OHLCV candles.', 422);
    }
    previous = time;
  }
  const closes = bars.map(bar => bar.close), ema9 = ema(closes, 9), ema20 = ema(closes, 20), fast = ema(closes, 12), slow = ema(closes, 26);
  const macd = closes.map((_, i) => slow[i] === null ? null : fast[i] - slow[i]);
  const validMacd = macd.filter(value => value !== null), signalSeries = ema(validMacd, 9);
  const macdValue = macd.at(-1), signal = signalSeries.at(-1) ?? null;
  let rsi14 = null, atr14 = null;
  if (bars.length >= 15) {
    let gain = 0, loss = 0, range = 0;
    for (let i = 1; i < bars.length; i++) {
      const delta = closes[i] - closes[i - 1];
      const trueRange = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - closes[i - 1]), Math.abs(bars[i].low - closes[i - 1]));
      if (i <= 14) { gain += Math.max(0, delta) / 14; loss += Math.max(0, -delta) / 14; range += trueRange / 14; }
      else { gain = (gain * 13 + Math.max(0, delta)) / 14; loss = (loss * 13 + Math.max(0, -delta)) / 14; range = (range * 13 + trueRange) / 14; }
    }
    rsi14 = gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    atr14 = range;
  }
  return {
    data: {
      lastInputBarStart: bars.at(-1).time, computedAt: new Date(clock()).toISOString(), completeBarsUsed: bars.length,
      ema9: ema9.at(-1), ema20: ema20.at(-1), rsi14, atr14,
      macd: { value: macdValue, signal, histogram: macdValue !== null && signal !== null ? macdValue - signal : null },
      vwap: null, relativeVolume: null,
      unavailable: {
        ...(bars.length < 9 ? { ema9: 'Requires 9 complete candles.' } : {}),
        ...(bars.length < 20 ? { ema20: 'Requires 20 complete candles.' } : {}),
        ...(bars.length < 15 ? { rsi14: 'Requires 15 complete candles.', atr14: 'Requires 15 complete candles.' } : {}),
        ...(bars.length < 34 ? { macdSignal: 'Requires 34 complete candles.' } : {}),
        vwap: 'Requires a verified full session of actual price-volume data. OHLC typical price is not substituted.',
        relativeVolume: 'Requires matched session-time historical volume coverage.',
      },
    },
    meta: { ...result.meta, derived: true, inputTimestampSemantics: 'Bar timestamps identify interval starts. Closing-value indicators could only be available after the interval completed and data arrived.', formulas: 'EMA seeded with SMA; RSI and ATR use Wilder 14-period smoothing; MACD 12/26/9. Incomplete bars excluded.', limitations: 'Indicators describe the available source series, including its gaps and venue coverage. They are not forecasts.' },
  };
}
