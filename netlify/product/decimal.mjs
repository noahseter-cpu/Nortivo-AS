import { fail } from '../terminal/security.mjs';

// Quantities, prices and ledger amounts have eight decimal places. No binary
// floating point enters the ledger; rounding happens once at each allocation.
export const SCALE = 100_000_000n;
export const ZERO = 0n;
const MAX = 999_999_999_999_999_999_999_999n;

export function units(value, { signed = true, positive = false, field = 'amount' } = {}) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,8})?$/.test(text))
    fail('INVALID_DECIMAL', `Enter ${field} as a decimal with at most eight decimal places.`, 400);
  const negative = text.startsWith('-'), [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const result = (BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0'))) * (negative ? -1n : 1n);
  if ((!signed && result < 0n) || (positive && result <= 0n) || result > MAX || result < -MAX)
    fail('INVALID_DECIMAL', `Enter a valid ${field}.`, 400);
  return result;
}

export function decimal(value) {
  if (typeof value !== 'bigint') throw new TypeError('Expected fixed-point integer.');
  const negative = value < 0n, n = negative ? -value : value;
  const fraction = String(n % SCALE).padStart(8, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${n / SCALE}${fraction ? `.${fraction}` : ''}`;
}

export function divideRounded(numerator, denominator) {
  if (denominator === 0n) fail('INVALID_DECIMAL', 'Division by zero is not permitted.', 400);
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator, d = denominator < 0n ? -denominator : denominator;
  const result = n / d + (n % d * 2n >= d ? 1n : 0n);
  return negative ? -result : result;
}

export const multiply = (a, b) => divideRounded(a * b, SCALE);
export const divide = (a, b) => divideRounded(a * SCALE, b);
export const sum = values => values.reduce((total, value) => total + value, 0n);
export const canonical = (value, options) => decimal(units(value, options));
