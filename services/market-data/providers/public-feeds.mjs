import { ApiError } from '../core.mjs';

const FED_URL = 'https://www.federalreserve.gov/feeds/press_all.xml';
const BLS_URL = 'https://www.bls.gov/schedule/news_release/bls.ics';
const invalid = message => { throw new ApiError('provider_invalid_data', message, 502); };
const boundedLimit = (value, max) => {
  if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > max) throw new ApiError('invalid_request', `limit must be an integer from 1 to ${max}.`, 400);
  return Number(value);
};
function plain(value) {
  return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:\d{1,7}|x[\da-f]{1,6});/gi, entity => {
    const basic = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
    if (basic[entity.toLowerCase()]) return basic[entity.toLowerCase()];
    const hex = /^&#x/i.test(entity), n = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return n >= 32 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
  }).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
}
function sourceLink(value, host) {
  try { const u = new URL(plain(value)); return u.protocol === 'https:' && [host, `www.${host}`].includes(u.hostname) && !u.username && !u.password && !u.port ? u.href : null; } catch { return null; }
}
function iso(value) { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null; }

export function parseFedRss(body, { now = Date.now(), limit = 30 } = {}) {
  limit = boundedLimit(limit, 100);
  if (typeof body !== 'string' || body.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(body) || !/<rss\b/i.test(body) || !/<channel\b/i.test(body) || !/<\/rss\s*>/i.test(body)) invalid('The Federal Reserve feed is not supported RSS.');
  const get = (item, key) => new RegExp(`<${key}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${key}\\s*>`, 'i').exec(item)?.[1] || '';
  const seen = new Set(), output = [];
  const items = [...body.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)];
  if (!items.length) invalid('The Federal Reserve feed contains no readable releases.');
  for (const match of items.slice(0, 1000)) {
    const title = plain(get(match[1], 'title')), url = sourceLink(get(match[1], 'link'), 'federalreserve.gov'), publishedAt = iso(plain(get(match[1], 'pubDate')));
    if (!title || !url || !publishedAt || Date.parse(publishedAt) > now + 60_000 || seen.has(url)) continue;
    seen.add(url);
    output.push({ id: url, title, url, publishedAt, source: 'Federal Reserve', kind: 'official_press_release', summary: null });
  }
  if (!output.length) invalid('The Federal Reserve feed contains no valid dated release links.');
  return output.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
}

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !iso(value) || iso(value).slice(0, 10) !== value) throw new ApiError('invalid_request', 'Calendar boundaries must be valid YYYY-MM-DD dates.', 400);
  return value;
}
function localUtc(value, zone) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value || '');
  if (!m) return null;
  const parts = m.slice(1, 7).map(Number), target = Date.UTC(parts[0], parts[1] - 1, ...parts.slice(2));
  const valid = new Date(target);
  if (valid.getUTCFullYear() !== parts[0] || valid.getUTCMonth() !== parts[1] - 1 || valid.getUTCDate() !== parts[2] || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) return null;
  if (m[7]) return { time: valid.toISOString(), timeZone: 'UTC', localDate: `${m[1]}-${m[2]}-${m[3]}` };
  if (!['America/New_York', 'US/Eastern', 'US-Eastern', 'Eastern Standard Time'].includes(zone)) return null;
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const p = Object.fromEntries(formatter.formatToParts(guess).map(x => [x.type, x.value]));
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    if (represented === target) return { time: new Date(guess).toISOString(), timeZone: 'America/New_York', localDate: `${m[1]}-${m[2]}-${m[3]}` };
    guess += target - represented;
  }
  return null;
}
const unescapeIcs = value => plain(value.replace(/\\[nN]/g, ' ').replace(/\\([,;\\])/g, '$1'));
export function parseBlsCalendar(body, { start = null, end = null, limit = 100 } = {}) {
  limit = boundedLimit(limit, 200);
  if (start) calendarDate(start);
  if (end) calendarDate(end);
  if (start && end && start > end) throw new ApiError('invalid_request', 'start must not be after end.', 400);
  if (typeof body !== 'string' || body.length > 4_000_000 || !/^BEGIN:VCALENDAR\s*$/mi.test(body) || !/^END:VCALENDAR\s*$/mi.test(body)) invalid('The BLS feed is not a supported iCalendar.');
  const unfolded = body.replace(/\r?\n[ \t]/g, ''), blocks = [...unfolded.matchAll(/^BEGIN:VEVENT\r?\n([\s\S]*?)^END:VEVENT\s*$/gmi)];
  if (!blocks.length) invalid('The BLS calendar contains no readable events.');
  const byId = new Map(); let valid = 0;
  for (const match of blocks.slice(0, 3000)) {
    const fields = new Map();
    for (const line of match[1].split(/\r?\n/)) {
      const sep = line.indexOf(':'); if (sep < 1) continue;
      const rawKey = line.slice(0, sep), name = rawKey.split(';')[0].toUpperCase();
      if (['UID', 'SUMMARY', 'DTSTART', 'DTSTAMP', 'LAST-MODIFIED', 'URL', 'STATUS'].includes(name)) fields.set(name, { value: line.slice(sep + 1), params: rawKey });
    }
    if (fields.get('STATUS')?.value === 'CANCELLED') continue;
    const stamp = fields.get('DTSTART'), zone = /(?:^|;)TZID=(?:"([^"]+)"|([^;:]+))/.exec(stamp?.params || ''), parsed = localUtc(stamp?.value, zone?.[1] || zone?.[2] || null);
    // Do not guess a timezone for floating times or fabricate times for all-day entries.
    const title = unescapeIcs(fields.get('SUMMARY')?.value || ''), uid = unescapeIcs(fields.get('UID')?.value || ''), source = fields.get('URL')?.value;
    const url = source ? sourceLink(source, 'bls.gov') : 'https://www.bls.gov/schedule/';
    if (!parsed || !title || !uid || !url) continue;
    valid++;
    if ((start && parsed.localDate < start) || (end && parsed.localDate > end)) continue;
    const updated = fields.get('LAST-MODIFIED') || fields.get('DTSTAMP'), updatedParsed = updated ? localUtc(updated.value, null)?.time || null : null;
    const event = { id: `bls:${uid}`, title, time: parsed.time, sourceDate: parsed.localDate, timeZone: parsed.timeZone, source: 'Bureau of Labor Statistics', sourceUrl: url, kind: 'economic_release', country: 'United States', currency: 'USD', estimated: false, status: 'announced', actual: null, consensus: null, previous: null, updatedAt: updatedParsed };
    const old = byId.get(event.id);
    if (!old || (updatedParsed || '') >= (old.updatedAt || '')) byId.set(event.id, event);
  }
  if (!valid) invalid('The BLS calendar contains no valid dated events with supported timezones.');
  return [...byId.values()].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id)).slice(0, limit);
}

export function createPublicFeeds({ transport, clock = Date.now }) {
  return {
    async news({ limit = 30 } = {}) {
      limit = boundedLimit(limit, 100);
      const result = await transport.request({ provider: 'fed', url: FED_URL, format: 'text', ttlMs: 300_000, maxBytes: 2_000_000 });
      return { data: parseFedRss(result.body, { now: clock(), limit }), meta: { provider: 'fed', sourceUrl: FED_URL, fetchedAt: result.fetchedAt, cache: result.cache, status: result.cache?.stale ? 'stale' : 'available', coverage: 'Official Federal Reserve press releases only; not broad company or stock-market news.', delay: 'Publisher feed update schedule; no real-time guarantee.' } };
    },
    async events({ start = null, end = null, limit = 100 } = {}) {
      limit = boundedLimit(limit, 200);
      if (!start) {
        const today = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(clock()).map(x => [x.type, x.value]));
        start = `${today.year}-${today.month}-${today.day}`;
      }
      if (!end) { const date = new Date(`${calendarDate(start)}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 60); end = date.toISOString().slice(0, 10); }
      if (start) calendarDate(start); if (end) calendarDate(end);
      if (start && end && start > end) throw new ApiError('invalid_request', 'start must not be after end.', 400);
      const result = await transport.request({ provider: 'bls', url: BLS_URL, format: 'text', ttlMs: 3_600_000, maxBytes: 4_000_000 });
      return { data: parseBlsCalendar(result.body, { start, end, limit }), meta: { provider: 'bls', sourceUrl: BLS_URL, fetchedAt: result.fetchedAt, cache: result.cache, status: result.cache?.stale ? 'stale' : 'available', coverage: 'Announced BLS national-office releases only; not a global economic or earnings calendar. Dates can be revised.', window: { start, end }, dateFilter: 'Inclusive dates in each event source timezone; no completeness guarantee.' } };
    },
  };
}
