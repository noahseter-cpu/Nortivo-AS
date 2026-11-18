import { clean, escapeHtml, json, parseBody, sendEmail, supabase } from './_utils.mjs';
import { errorResponse, language } from './_support-language.mjs';
import { sameOrigin, siteOrigin } from './_ticket-security.mjs';
import { requireAdmin, adminError } from '../security-core/admin.mjs';

export function createHandler({ authorizeAdmin = requireAdmin } = {}) {
return async function handler(event) {
  let locale = language(event.queryStringParameters?.language);
  try { await authorizeAdmin(event, { routeId: 'admin-reply', mutation: true }); }
  catch (error) { return adminError(error); }
  if (event.httpMethod !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', locale, { Allow: 'POST' });
  if (!sameOrigin(event, { required: true })) return errorResponse(403, 'FORBIDDEN', locale);
  try {
    let body;
    try { body = parseBody(event); } catch (error) { return errorResponse(error.status || 400, 'BAD_REQUEST', locale); }
    locale = language(body.language);
    const id = clean(body.id, 60);
    const message = clean(body.message, 4000);
    if (!id || message.length < 2) return errorResponse(400, 'INVALID_FIELDS', locale);
    const params = new URLSearchParams({ select: '*', id: `eq.${id}`, limit: '1' });
    const rows = await supabase(`tickets?${params}`);
    const ticket = rows?.[0];
    if (!ticket) return errorResponse(404, 'NOT_FOUND', locale);

    const supportUrl = `${siteOrigin(event)}/support/`;
    const replyText = locale === 'nb'
      ? `Hei ${ticket.name},\n\n${message}\n\nSaksnummer: ${ticket.ticket_number}\nÅpne saken: ${supportUrl}\n\nNortivo Support`
      : `Hi ${ticket.name},\n\n${message}\n\nTicket: ${ticket.ticket_number}\nOpen ticket: ${supportUrl}\n\nNortivo Support`;
    await sendEmail({
      to: ticket.email,
      subject: `Re: ${ticket.subject} · ${ticket.ticket_number}`,
      text: replyText,
      html: `<p>${escapeHtml(replyText).replace(/\n/g, '<br>')}</p>`,
    });
    await supabase('ticket_replies', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ticket_id: ticket.id, sender: 'admin', body: message }),
    });
    const updateParams = new URLSearchParams({ id: `eq.${ticket.id}` });
    await supabase(`tickets?${updateParams}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'answered', updated_at: new Date().toISOString() }),
    });
    return json(200, { ok: true });
  } catch {
    console.error('Admin reply could not be completed.');
    return errorResponse(503, 'UNAVAILABLE', locale);
  }
}
}
export const handler = createHandler();
