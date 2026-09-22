import { escapeHtml, json, parseBody, sendEmail, supabase, validEmail } from './_utils.mjs';
import { errorResponse, language, message } from './_support-language.mjs';
import { issueToken, normalizeEmail, normalizeTicket, rateLimit, readToken, sameOrigin, siteOrigin, ticketCookie, validTicket } from './_ticket-security.mjs';

export async function handler(event) {
  let locale = language(event.queryStringParameters?.language);
  if (event.httpMethod !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', locale, { Allow: 'POST' });
  if (!sameOrigin(event, { required: true })) return errorResponse(403, 'FORBIDDEN', locale);
  let body;
  try { body = parseBody(event); } catch { return errorResponse(400, 'BAD_REQUEST', locale); }
  locale = language(body.language);
  if (body.action === 'request') {
    const ticketNumber = normalizeTicket(body.ticketNumber ?? body.ticket);
    const email = normalizeEmail(body.email);
    if (!validTicket(ticketNumber) || !validEmail(email)) return errorResponse(400, 'INVALID_FIELDS', locale);
    const accepted = () => json(202, { ok: true, message: message(locale, 'REQUEST_ACCEPTED') });
    // Missing tickets, throttling and delivery failures have the same public response.
    if (!rateLimit(event, 'access-request', { email, ipLimit: 8, emailLimit: 3 })) return accepted();
    try {
      const params = new URLSearchParams({ select: 'ticket_number', ticket_number: `eq.${ticketNumber}`, email: `eq.${email}`, limit: '1' });
      const rows = await supabase(`tickets?${params}`);
      if (rows?.[0]) {
        const token = issueToken('email-proof', { ticketNumber, email });
        const link = `${siteOrigin(event)}/support/#access=${encodeURIComponent(token)}`;
        const text = locale === 'nb'
          ? `Åpne supportsaken ${ticketNumber}\n\nBekreft e-postadressen din med denne lenken. Den er gyldig i 15 minutter:\n${link}\n\nIkke del lenken. Du kan se bort fra denne e-posten hvis du ikke ba om tilgang.\n\nNortivo Support`
          : `Open support ticket ${ticketNumber}\n\nConfirm your email using this link. It expires in 15 minutes:\n${link}\n\nDo not share this link. If you did not request access, you can ignore this email.\n\nNortivo Support`;
        await sendEmail({ to: email, subject: `${locale === 'nb' ? 'Bekreft tilgang' : 'Confirm access'} · ${ticketNumber}`, text,
          html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p><p><a href="${escapeHtml(link)}">${locale === 'nb' ? 'Åpne saken' : 'Open ticket'}</a></p>` });
      }
    } catch { console.error('Ticket access request could not be completed.'); }
    return accepted();
  }
  if (body.action === 'verify') {
    if (!rateLimit(event, 'access-verify', { ipLimit: 20 })) return errorResponse(429, 'TOO_MANY_REQUESTS', locale, { 'Retry-After': '900' });
    const claims = readToken(body.token, 'email-proof');
    if (!claims) return errorResponse(401, 'INVALID_ACCESS', locale);
    try {
      return json(200, { ok: true, ticketNumber: claims.ticketNumber, email: claims.email }, { 'Set-Cookie': ticketCookie(claims) });
    } catch { return errorResponse(503, 'UNAVAILABLE', locale); }
  }
  return errorResponse(400, 'BAD_REQUEST', locale);
}
