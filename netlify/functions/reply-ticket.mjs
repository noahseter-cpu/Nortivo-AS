import { clean, escapeHtml, isAdmin, json, parseBody, sendEmail, supabase } from './_utils.mjs';

export async function handler(event) {
  if (!isAdmin(event)) return json(401, { error: 'Not signed in.' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  try {
    const body = parseBody(event);
    const id = clean(body.id, 60);
    const message = clean(body.message, 4000);
    if (!id || message.length < 2) return json(400, { error: 'Write a reply before sending.' });
    const params = new URLSearchParams({ select: '*', id: `eq.${id}`, limit: '1' });
    const rows = await supabase(`tickets?${params}`);
    const ticket = rows?.[0];
    if (!ticket) return json(404, { error: 'Ticket not found.' });

    await sendEmail({
      to: ticket.email,
      subject: `Re: ${ticket.subject} · ${ticket.ticket_number}`,
      text: `Hi ${ticket.name},\n\n${message}\n\nTicket: ${ticket.ticket_number}\nCheck status: https://nortivo.no/support/\n\nNortivo Support`,
      html: `<p>Hi ${escapeHtml(ticket.name)},</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p><p><strong>Ticket:</strong> ${escapeHtml(ticket.ticket_number)}</p><p><a href="https://nortivo.no/support/">Check ticket status</a></p><p>Nortivo Support</p>`,
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
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || 'The reply could not be sent.' });
  }
}
