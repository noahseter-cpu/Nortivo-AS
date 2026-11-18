import { clean, isAdmin, json, parseBody, supabase } from './_utils.mjs';
import { sameOrigin } from './_ticket-security.mjs';

const PAGE_LIMIT = 200;
const MAX_OFFSET = 100000;

export function createHandler({ query = supabase, env = process.env, now = () => Date.now() } = {}) {
return async function handler(event) {
  if (!isAdmin(event)) return json(401, { error: 'Not signed in.' });
  if (!sameOrigin(event, { required: event.httpMethod === 'PATCH' })) return json(403, { error: 'Request origin is not allowed.', code: 'FORBIDDEN' });
  try {
    if (event.httpMethod === 'GET') return await getTickets(event, { query, env, now });
    if (event.httpMethod === 'PATCH') return await updateTicket(event, query);
    return json(405, { error: 'Method not allowed.' }, { Allow: 'GET, PATCH' });
  } catch {
    console.error('Admin ticket request could not be completed.');
    return json(503, { error: 'Support is temporarily unavailable.', code: 'UNAVAILABLE' });
  }
};
}
export const handler = createHandler();

async function getTickets(event, { query, env, now }) {
  const view = event.queryStringParameters?.view;
  if (view === 'operations') return json(200, { operations: await configurationOverview(env, now()) });
  if (view != null && view !== '') return json(400, { error: 'Invalid administration view.', code: 'INVALID_VIEW' });
  const id = clean(event.queryStringParameters?.id, 60);
  if (!id) {
    const rawOffset = event.queryStringParameters?.offset;
    if (rawOffset != null && (typeof rawOffset !== 'string' || !/^(?:0|[1-9]\d{0,5})$/.test(rawOffset) || Number(rawOffset) > MAX_OFFSET)) return json(400, { error: 'Choose a valid ticket page.', code: 'INVALID_OFFSET' });
    const offset = rawOffset == null ? 0 : Number(rawOffset);
    const params = new URLSearchParams({ select: '*', order: 'created_at.desc,id.desc', limit: String(PAGE_LIMIT + 1), offset: String(offset) });
    const rows = await query(`tickets?${params}`);
    if (!Array.isArray(rows)) throw new Error('Invalid ticket page.');
    const hasMore = rows.length > PAGE_LIMIT;
    return json(200, { tickets: rows.slice(0, PAGE_LIMIT), page: { limit: PAGE_LIMIT, offset, hasMore, nextOffset: hasMore && offset + PAGE_LIMIT <= MAX_OFFSET ? offset + PAGE_LIMIT : null } });
  }
  const params = new URLSearchParams({ select: '*', id: `eq.${id}`, limit: '1' });
  const rows = await query(`tickets?${params}`);
  const ticket = rows?.[0];
  if (!ticket) return json(404, { error: 'Ticket not found.' });
  const replyParams = new URLSearchParams({ select: '*', ticket_id: `eq.${ticket.id}`, order: 'created_at.asc' });
  const replies = await query(`ticket_replies?${replyParams}`);
  return json(200, { ticket, replies });
}

async function updateTicket(event, query) {
  const body = parseBody(event);
  const id = clean(body.id, 60);
  const status = clean(body.status, 20);
  if (!id || !['open', 'answered', 'closed'].includes(status)) return json(400, { error: 'Invalid status update.' });
  const params = new URLSearchParams({ id: `eq.${id}` });
  const rows = await query(`tickets?${params}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
  if (!rows?.[0]) return json(404, { error: 'Ticket not found.' });
  return json(200, { ticket: rows[0] });
}

async function configurationOverview(env, now) {
  // Reuse the application's configuration rules without a store, account or
  // provider transport. This view cannot query customer records or run probes.
  const [{ getIntegrationReadiness }, { emailReady }, { billingReady }] = await Promise.all([
    import('../product/providers.mjs'), import('../product/auth.mjs'), import('../product/billing.mjs'),
  ]);
  const readiness = await getIntegrationReadiness({ env, now, store: null, user: null, account: {} });
  const mailConfigured = emailReady(env);
  const payment = billingReady({ env, readiness }, 'portfolio');
  const labels = { market: 'Market data', news: 'News', calendar: 'Economic calendar', ai: 'AI explanations', broker: 'Brokerage' };
  const services = Object.entries(labels).map(([id, label]) => ({ id, label, configured: readiness[id]?.configured === true, status: readiness[id]?.configured === true ? 'configured' : 'not_configured', reachability: 'not_checked' }));
  for (const [id, label, configured] of [['email', 'Email', mailConfigured], ['payments', 'Subscriptions', payment.configured]]) services.push({ id, label, configured, status: configured ? 'configured' : 'not_configured', reachability: 'not_checked' });
  const productEnabled = env.PRODUCT_ENABLED === 'true';
  const unavailable = !productEnabled || !payment.configured || !mailConfigured || ['market', 'news', 'calendar', 'ai'].some(id => !readiness[id]?.configured || !readiness[id]?.permissionsReady);
  return { checkedAt: new Date(now).toISOString(), configurationOnly: true, productEnabled, purchasesOpen: unavailable ? false : null, purchasesStatus: unavailable ? 'unavailable' : 'not_checked', services, links: { website: 'https://nortivo.no', platform: 'https://invest.nortivo.no', support: 'https://nortivo.no/support/' } };
}
