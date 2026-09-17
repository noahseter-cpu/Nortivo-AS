import { clean, isAdmin, json, parseBody, supabase } from './_utils.mjs';

export async function handler(event) {
  if (!isAdmin(event)) return json(401, { error: 'Not signed in.' });
  try {
    if (event.httpMethod === 'GET') return getTickets(event);
    if (event.httpMethod === 'PATCH') return updateTicket(event);
    return json(405, { error: 'Method not allowed.' }, { Allow: 'GET, PATCH' });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || 'Could not load tickets.' });
  }
}

async function getTickets(event) {
  const id = clean(event.queryStringParameters?.id, 60);
  if (!id) {
    const params = new URLSearchParams({ select: '*', order: 'created_at.desc', limit: '200' });
    return json(200, { tickets: await supabase(`tickets?${params}`) });
  }
  const params = new URLSearchParams({ select: '*', id: `eq.${id}`, limit: '1' });
  const rows = await supabase(`tickets?${params}`);
  const ticket = rows?.[0];
  if (!ticket) return json(404, { error: 'Ticket not found.' });
  const replyParams = new URLSearchParams({ select: '*', ticket_id: `eq.${ticket.id}`, order: 'created_at.asc' });
  const replies = await supabase(`ticket_replies?${replyParams}`);
  return json(200, { ticket, replies });
}

async function updateTicket(event) {
  const body = parseBody(event);
  const id = clean(body.id, 60);
  const status = clean(body.status, 20);
  if (!id || !['open', 'answered', 'closed'].includes(status)) return json(400, { error: 'Invalid status update.' });
  const params = new URLSearchParams({ id: `eq.${id}` });
  const rows = await supabase(`tickets?${params}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
  if (!rows?.[0]) return json(404, { error: 'Ticket not found.' });
  return json(200, { ticket: rows[0] });
}
