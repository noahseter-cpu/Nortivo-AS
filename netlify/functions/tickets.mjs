import { clean, escapeHtml, json, parseBody, sendEmail, supabase, ticketNumber, validEmail } from './_utils.mjs';

export async function handler(event) {
  try {
    if (event.httpMethod === 'POST') return createTicket(event);
    if (event.httpMethod === 'GET') return findTicket(event);
    return json(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || 'Support is temporarily unavailable.' });
  }
}

async function createTicket(event) {
  const body = parseBody(event);
  if (clean(body.company, 200)) return json(200, { ticket: { ticket_number: 'received' } });
  const name = clean(body.name, 80);
  const email = clean(body.email, 160).toLowerCase();
  const subject = clean(body.subject, 140);
  const message = clean(body.message, 4000);
  if (!name || !validEmail(email) || subject.length < 3 || message.length < 10) {
    return json(400, { error: 'Please complete every field with a valid email and message.' });
  }
  const number = ticketNumber();
  const rows = await supabase('tickets', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ticket_number: number, name, email, subject, message }),
  });
  const ticket = rows?.[0];
  if (!ticket) throw new Error('The ticket could not be created.');

  const safeNumber = escapeHtml(number);
  const safeSubject = escapeHtml(subject);
  const safeName = escapeHtml(name);
  const confirmation = sendEmail({
    to: email,
    subject: `Nortivo Support · ${number}`,
    text: `Hi ${name},\n\nWe received your support ticket ${number}: ${subject}.\n\nKeep this number to check the ticket at https://nortivo.no/support/\n\nNortivo Support`,
    html: `<p>Hi ${safeName},</p><p>We received your support ticket <strong>${safeNumber}</strong>:</p><p>${safeSubject}</p><p>Keep this number to check the ticket at <a href="https://nortivo.no/support/">nortivo.no/support</a>.</p><p>Nortivo Support</p>`,
  }).catch(error => console.error('Confirmation email failed', error));

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const notification = adminEmail ? sendEmail({
    to: adminEmail,
    subject: `New support ticket · ${number}`,
    text: `${name} (${email}) created ${number}: ${subject}\n\n${message}\n\nOpen https://nortivo.no/admin/`,
    html: `<p><strong>${safeNumber}</strong> from ${safeName} (${escapeHtml(email)})</p><p><strong>${safeSubject}</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p><p><a href="https://nortivo.no/admin/">Open admin panel</a></p>`,
  }).catch(error => console.error('Admin email failed', error)) : Promise.resolve();
  await Promise.allSettled([confirmation, notification]);
  return json(201, { ticket: { ticket_number: ticket.ticket_number, status: ticket.status } });
}

async function findTicket(event) {
  const ticketNumberValue = clean(event.queryStringParameters?.ticket, 40).toUpperCase();
  const email = clean(event.queryStringParameters?.email, 160).toLowerCase();
  if (!ticketNumberValue || !validEmail(email)) return json(400, { error: 'Enter a valid ticket number and email.' });
  const params = new URLSearchParams({
    select: 'id,ticket_number,subject,message,status,created_at,updated_at',
    ticket_number: `eq.${ticketNumberValue}`,
    email: `eq.${email}`,
    limit: '1',
  });
  const rows = await supabase(`tickets?${params}`);
  const ticket = rows?.[0];
  if (!ticket) return json(404, { error: 'No ticket matched that number and email.' });
  const replyParams = new URLSearchParams({
    select: 'body,created_at', ticket_id: `eq.${ticket.id}`, order: 'created_at.asc'
  });
  const replies = await supabase(`ticket_replies?${replyParams}`);
  return json(200, { ticket, replies });
}
