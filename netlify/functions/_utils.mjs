import crypto from 'node:crypto';

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); }
  catch { throw new Error('Invalid request.'); }
}

export function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export async function supabase(path, options = {}) {
  const base = requiredEnv('SUPABASE_URL').replace(/\/$/, '');
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    console.error('Supabase error', response.status, data);
    throw new Error('The ticket database is temporarily unavailable.');
  }
  return data;
}

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const from = requiredEnv('SUPPORT_FROM_EMAIL');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!response.ok) {
    console.error('Email error', response.status, await response.text());
    throw new Error('The email could not be sent.');
  }
  return response.json();
}

function cookieValue(event, name) {
  const header = event.headers?.cookie || event.headers?.Cookie || '';
  const item = header.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

function sign(value) {
  return crypto.createHmac('sha256', requiredEnv('ADMIN_SESSION_SECRET')).update(value).digest('base64url');
}

export function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function isAdmin(event) {
  try {
    const token = cookieValue(event, 'nortivo_admin');
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    const expected = sign(payload);
    const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return false;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(session.exp) > Date.now();
  } catch { return false; }
}

export function passwordMatches(candidate) {
  const expected = requiredEnv('ADMIN_PASSWORD');
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function ticketNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const byte of bytes) code += chars[byte % chars.length];
  return `NT-${new Date().getUTCFullYear()}-${code}`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}
