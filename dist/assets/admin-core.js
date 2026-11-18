// Presentation helpers only. Authentication, ownership and ticket changes stay on the server.
const knownStatuses = new Set(['open', 'answered', 'closed']);
const time = value => {const parsed = Date.parse(value);return Number.isFinite(parsed) ? parsed : null;};
export function isOlderOpen(ticket, now = Date.now()) {
  const created = time(ticket?.created_at);
  return ticket?.status === 'open' && created !== null && now - created > 24 * 60 * 60 * 1000;
}
export function summarizeTickets(tickets, now = Date.now()) {
  const summary = {total:tickets.length, open:0, answered:0, closed:0, older:0};
  for (const ticket of tickets) {
    if (knownStatuses.has(ticket.status)) summary[ticket.status]++;
    if (isOlderOpen(ticket, now)) summary.older++;
  }
  return summary;
}
export function selectTickets(tickets, {query = '', status = 'all', olderOnly = false, sort = 'newest', language = 'en'} = {}, now = Date.now()) {
  const locale = language === 'nb' ? 'nb' : 'en';
  const search = String(query).trim().toLocaleLowerCase(locale);
  const selected = tickets.filter(ticket => {
    const text = [ticket.ticket_number, ticket.name, ticket.email, ticket.subject].join(' ').toLocaleLowerCase(locale);
    return (status === 'all' || ticket.status === status) && (!olderOnly || isOlderOpen(ticket, now)) && text.includes(search);
  });
  return selected.sort((a, b) => {
    const left = time(sort === 'updated' ? a.updated_at || a.created_at : a.created_at);
    const right = time(sort === 'updated' ? b.updated_at || b.created_at : b.created_at);
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    const difference = left === null ? 0 : (left - right) * (sort === 'oldest' ? 1 : -1);
    return difference || String(a.id).localeCompare(String(b.id));
  });
}
export function mergeTicketPages(existing, incoming) {
  const records = new Map(existing.filter(ticket => typeof ticket?.id === 'string').map(ticket => [ticket.id, ticket]));
  for (const ticket of incoming) if (typeof ticket?.id === 'string') records.set(ticket.id, ticket);
  return [...records.values()];
}
export function ticketPage(page = {}) {
  return {limit:Number.isSafeInteger(page.limit) && page.limit > 0 ? page.limit : 200,
    offset:Number.isSafeInteger(page.offset) && page.offset >= 0 ? page.offset : 0,
    hasMore:page.hasMore === true,
    nextOffset:Number.isSafeInteger(page.nextOffset) && page.nextOffset >= 0 ? page.nextOffset : null};
}
