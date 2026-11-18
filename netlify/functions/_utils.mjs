import crypto from 'node:crypto';
import { parseBody as parseWorkspaceBody } from '../terminal/security.mjs';
import { securityHeaders } from '../../services/security-core/src/headers.mjs';

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...securityHeaders({ https: process.env.NETLIFY_DEV !== 'true' }),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function parseBody(event) {
  // Existing ticket clients handle malformed and oversized requests as BAD_REQUEST.
  try { return parseWorkspaceBody(event, 20_000); }
  catch (error) { if (error.status === 413) error.status = 400; throw error; }
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
  const configured = new URL(requiredEnv('SUPABASE_URL'));
  if (configured.protocol !== 'https:' || configured.username || configured.password || configured.pathname !== '/' || configured.search || configured.hash) throw new Error('Support storage is not configured correctly.');
  const base = configured.origin;
  if (typeof path !== 'string' || path.startsWith('/') || path.includes('\\') || path.includes('#') || /^[a-z]+:/i.test(path)) throw new Error('Invalid storage operation.');
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const authHeaders = key.startsWith('sb_secret_')
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      ...options.headers,
      ...authHeaders,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  const data = await boundedJson(response);
  if (!response.ok) {
    console.error('Supabase request failed', response.status);
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
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    console.error('Email delivery failed', response.status);
    throw new Error('The email could not be sent.');
  }
  return boundedJson(response);
}

async function boundedJson(response) {
  const maxBytes = 2_000_000;
  if (Number(response.headers?.get?.('content-length')) > maxBytes) throw new Error('The service response exceeded its limit.');
  let text;
  if (response.body) {
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) { throw new Error('The service response exceeded its limit.'); }
      chunks.push(chunk);
    }
    text = Buffer.concat(chunks).toString('utf8');
  } else {
    // Empty real responses, and bounded synthetic response objects in unit tests.
    text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error('The service response exceeded its limit.');
  }
  return text ? JSON.parse(text) : null;
}

function sign(value) {
  return crypto.createHmac('sha256', requiredEnv('ADMIN_SESSION_SECRET')).update(value).digest('base64url');
}

export function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function isAdmin(event) {
  // Retired compatibility API. An old exp-only bearer cookie never authorizes access.
  // Active endpoints use the asynchronous, database-backed Security Core authorizer.
  return false;
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
