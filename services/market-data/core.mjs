import { createHash, timingSafeEqual } from 'node:crypto';

export class ApiError extends Error {
  constructor(code, message, status = 503, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const digest = value => createHash('sha256').update(value).digest('hex');
export const sameSecret = (left, right) => {
  const a = Buffer.from(digest(String(left))), b = Buffer.from(digest(String(right)));
  return timingSafeEqual(a, b);
};

export function safeSourceUrl(value) {
  const url = new URL(value);
  for (const name of [...url.searchParams.keys()]) {
    if (/key|token|secret|password|authorization/i.test(name)) url.searchParams.delete(name);
  }
  url.username = ''; url.password = ''; url.hash = '';
  return url.href;
}

export function integer(value, { name = 'limit', min = 1, max = 1000, fallback = 100 } = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new ApiError('invalid_request', `${name} must be an integer from ${min} to ${max}.`, 400);
  }
  return Number(value);
}

export function dateValue(value, name = 'date', { timestamp = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const pattern = timestamp ? /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z)?$/ : /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new ApiError('invalid_request', `${name} must be a valid ISO ${timestamp ? 'date or UTC timestamp' : 'date'}.`, 400);
  }
  return value;
}

export function validSymbol(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9.\/-]{0,29}$/.test(value)) {
    throw new ApiError('invalid_request', 'Supply a valid symbol, for example AAPL or BTC/USD.', 400);
  }
  return value.toUpperCase();
}

export function errorBody(error, requestId) {
  const known = error instanceof ApiError;
  return {
    data: null,
    error: {
      code: known ? error.code : 'internal_error',
      message: known ? error.message : 'The request could not be completed.',
      ...(known && Object.keys(error.details).length ? { details: error.details } : {}),
    },
    meta: { requestId, status: 'unavailable' },
  };
}
