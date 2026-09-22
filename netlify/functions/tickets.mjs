import { clean, escapeHtml, json, parseBody, sendEmail, supabase, ticketNumber, validEmail } from './_utils.mjs';
import { errorResponse, language } from './_support-language.mjs';
import { normalizeEmail, normalizeTicket, rateLimit, sameOrigin, siteOrigin, ticketSession } from './_ticket-security.mjs';

export async function handler(event) {
  let locale = language(event.queryStringParameters?.language);
  try {
    if (event.httpMethod === 'POST') {
      if (!sameOrigin(event, { required: true })) return errorResponse(403, 'FORBIDDEN', locale);
      let body;
      try { body = parseBody(event); } catch { return errorResponse(400, 'BAD_REQUEST', locale); }
      locale = language(body.language);
      return await createTicket(event, body, locale);
    }
    if (event.httpMethod === 'GET') return await findTicket(event, locale);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', locale, { Allow: 'GET, POST' });
  } catch {
    console.error('Support request could not be completed.');
    return errorResponse(503, 'UNAVAILABLE', locale);
  }
}

async function createTicket(event, body, locale) {
  // Autofill can populate this field too; never claim a ticket was saved when it was not.
  if (clean(body.company, 200)) return errorResponse(400, 'INVALID_FIELDS', locale);
  const name = clean(body.name, 80);
  const email = normalizeEmail(body.email);
  const subject = clean(body.subject, 140);
  const message = clean(body.message, 4000);
  if (!name || !validEmail(email) || subject.length < 3 || message.length < 10) {
    return errorResponse(400, 'INVALID_FIELDS', locale);
  }
  if (!rateLimit(event, 'ticket-create', { email, ipLimit: 6, emailLimit: 3, windowMs: 60 * 60 * 1000 })) {
    return errorResponse(429, 'TOO_MANY_REQUESTS', locale, { 'Retry-After': '3600' });
  }
  const number = ticketNumber();
  const rows = await supabase('tickets', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ticket_number: number, name, email, subject, message }),
  });
  const ticket = rows?.[0];
  if (!ticket) throw new Error('The ticket could not be created.');

  const supportUrl = `${siteOrigin(event)}/support/`;
  const text = locale === 'nb'
    ? `Hei ${name},\n\nVi har mottatt supportsaken ${number}: ${subject}.\n\nTa vare på saksnummeret. Du kan be om en bekreftelseslenke for å åpne saken på ${supportUrl}\n\nNortivo Support`
    : `Hi ${name},\n\nWe received your support ticket ${number}: ${subject}.\n\nKeep this number. You can request a verification link to open the ticket at ${supportUrl}\n\nNortivo Support`;
  const confirmation = sendEmail({
    to: email,
    subject: `Nortivo Support · ${number}`,
    text,
    html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
  }).then(() => true).catch(() => { console.error('Ticket confirmation email failed.'); return false; });

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const notification = adminEmail ? sendEmail({
    to: adminEmail,
    subject: `${locale === 'nb' ? 'Ny supportsak' : 'New support ticket'} · ${number}`,
    text: `${name} (${email}) · ${number}: ${subject}\n\n${message}\n\n${siteOrigin(event)}/admin/`,
    html: `<p><strong>${escapeHtml(number)}</strong> · ${escapeHtml(name)} (${escapeHtml(email)})</p><p><strong>${escapeHtml(subject)}</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p><p><a href="${escapeHtml(siteOrigin(event))}/admin/">${locale === 'nb' ? 'Åpne administrasjon' : 'Open admin panel'}</a></p>`,
  }).catch(() => console.error('Admin notification email failed.')) : Promise.resolve();
  const [confirmationSent] = await Promise.all([confirmation, notification]);
  // Creating a ticket never grants access to its private conversation.
  return json(201, { ticket: { ticket_number: ticket.ticket_number, status: ticket.status }, confirmationSent });
}

async function findTicket(event, locale) {
  if (!sameOrigin(event)) return errorResponse(403, 'FORBIDDEN', locale);
  const ticketNumberValue = normalizeTicket(event.queryStringParameters?.ticketNumber ?? event.queryStringParameters?.ticket);
  const session = ticketSession(event);
  // New clients omit email from the URL; legacy clients must still match the proof.
  const email = event.queryStringParameters?.email === undefined ? session?.email : normalizeEmail(event.queryStringParameters.email);
  if (!session || session.ticketNumber !== ticketNumberValue || session.email !== email) return errorResponse(401, 'ACCESS_REQUIRED', locale);
  if (!rateLimit(event, 'ticket-read', { ipLimit: 60 })) return errorResponse(429, 'TOO_MANY_REQUESTS', locale, { 'Retry-After': '900' });
  const params = new URLSearchParams({
    select: 'id,ticket_number,subject,message,status,created_at,updated_at',
    ticket_number: `eq.${ticketNumberValue}`,
    email: `eq.${email}`,
    limit: '1',
  });
  const rows = await supabase(`tickets?${params}`);
  const ticket = rows?.[0];
  if (!ticket) return errorResponse(404, 'NOT_FOUND', locale);
  const replyParams = new URLSearchParams({
    select: 'body,created_at', ticket_id: `eq.${ticket.id}`, order: 'created_at.asc'
  });
  const replies = await supabase(`ticket_replies?${replyParams}`);
  return json(200, { ticket, replies });
}
