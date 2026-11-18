import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFedRss, parseBlsCalendar, createPublicFeeds } from '../providers/public-feeds.mjs';

const item = (title, link, date = 'Wed, 18 Nov 2026 13:30:00 GMT') => `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate></item>`;
const rss = items => `<rss version="2.0"><channel><title>Federal Reserve Press Releases</title>${items.join('')}</channel></rss>`;
const event = ({ uid = 'cpi', start = 'DTSTART;TZID=America/New_York:20261110T083000', title = 'Consumer Price Index', extra = '' } = {}) => `BEGIN:VEVENT\r\nUID:${uid}\r\n${start}\r\nSUMMARY:${title}\r\nDTSTAMP:20261101T150000Z\r\n${extra}END:VEVENT\r\n`;
const calendar = items => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${items.join('')}END:VCALENDAR\r\n`;

test('Fed releases preserve publication dates, sanitize title markup, deduplicate links and exclude unsafe sources', () => {
  const data = parseFedRss(rss([
    item('<![CDATA[Policy &amp; <b>markets</b>]]>', 'https://www.federalreserve.gov/newsevents/pressreleases/a.htm'),
    item('Duplicate', 'https://www.federalreserve.gov/newsevents/pressreleases/a.htm'),
    item('Bad URL', 'https://www.federalreserve.gov.attacker.test/a'),
    item('Invalid date', 'https://www.federalreserve.gov/b', 'missing'),
    item('Future', 'https://www.federalreserve.gov/c', 'Wed, 18 Nov 2037 13:30:00 GMT'),
  ]), { now: Date.parse('2026-11-18T14:00:00Z') });
  assert.equal(data.length, 1);
  assert.equal(data[0].title, 'Policy & markets');
  assert.equal(data[0].publishedAt, '2026-11-18T13:30:00.000Z');
  assert.equal(data[0].summary, null);
  assert.equal(data[0].kind, 'official_press_release');
});

test('Fed rejects DTD/entity declarations, unreadable feeds and feeds containing no valid dated releases', () => {
  for (const body of ['<html>Forbidden</html>', '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///private">]>' + rss([]), rss([item('Missing', 'javascript:alert(1)')])]) {
    assert.throws(() => parseFedRss(body), error => error.code === 'provider_invalid_data');
  }
});

test('BLS converts winter and summer Eastern local dates using DST rules', () => {
  const data = parseBlsCalendar(calendar([
    event({ uid: 'winter', start: 'DTSTART;TZID=America/New_York:20260115T083000' }),
    event({ uid: 'summer', start: 'DTSTART;TZID=US/Eastern:20260715T083000' }),
    event({ uid: 'custom', start: 'DTSTART;TZID=US-Eastern:20260815T083000' }),
  ]));
  assert.equal(data[0].time, '2026-01-15T13:30:00.000Z');
  assert.equal(data[1].time, '2026-07-15T12:30:00.000Z');
  assert.equal(data[0].timeZone, 'America/New_York');
  assert.equal(data[1].sourceDate, '2026-07-15');
  assert.equal(data[2].time, '2026-08-15T12:30:00.000Z');
  assert.equal(data[0].consensus, null);
  assert.equal(data[0].estimated, false);
});

test('BLS unfolds lines, unescapes text and accepts explicit UTC without guessing floating times', () => {
  const data = parseBlsCalendar(calendar([
    event({ uid: 'folded', title: 'Consumer Price\r\n  Index\\, monthly', start: 'DTSTART:20261110T133000Z' }),
    event({ uid: 'floating', start: 'DTSTART:20261111T083000' }),
    event({ uid: 'allday', start: 'DTSTART;VALUE=DATE:20261112' }),
    event({ uid: 'invalid', start: 'DTSTART;TZID=America/New_York:20260230T083000' }),
  ]));
  assert.equal(data.length, 1);
  assert.equal(data[0].title, 'Consumer Price Index, monthly');
  assert.equal(data[0].time, '2026-11-10T13:30:00.000Z');
  assert.equal(data[0].updatedAt, '2026-11-01T15:00:00.000Z');
});

test('BLS deduplicates by UID with latest revision, filters source dates and drops canceled/unsafe entries', () => {
  const data = parseBlsCalendar(calendar([
    event({ uid: 'revision', title: 'Original' }),
    event({ uid: 'revision', title: 'Revised', extra: 'LAST-MODIFIED:20261105T150000Z\r\nURL:https://www.bls.gov/news.release/cpi.htm\r\n' }),
    event({ uid: 'canceled', extra: 'STATUS:CANCELLED\r\n' }),
    event({ uid: 'unsafe', extra: 'URL:https://attacker.test/event\r\n' }),
    event({ uid: 'later', start: 'DTSTART;TZID=America/New_York:20261210T083000' }),
  ]), { start: '2026-11-10', end: '2026-11-10' });
  assert.equal(data.length, 1);
  assert.equal(data[0].title, 'Revised');
  assert.equal(data[0].sourceUrl, 'https://www.bls.gov/news.release/cpi.htm');
  assert.deepEqual(parseBlsCalendar(calendar([event()]), { start: '2027-01-01' }), []);
});

test('BLS rejects unsupported feed content, missing timezones, invalid limits and invalid date filters', () => {
  assert.throws(() => parseBlsCalendar('<html>Denied</html>'), error => error.code === 'provider_invalid_data');
  assert.throws(() => parseBlsCalendar(calendar([event({ start: 'DTSTART:20261110T083000' })])), error => error.code === 'provider_invalid_data');
  assert.throws(() => parseBlsCalendar(calendar([event()]), { limit: 5000 }), error => error.code === 'invalid_request');
  assert.throws(() => parseBlsCalendar(calendar([event()]), { start: '2026-02-30' }), error => error.code === 'invalid_request');
  assert.throws(() => parseBlsCalendar(calendar([event()]), { start: '2026-12-01', end: '2026-11-01' }), error => error.code === 'invalid_request');
});

test('Public feeds expose limited official coverage, real source times and transparent cached freshness', async () => {
  const calls = [];
  const transport = { async request(options) {
    calls.push(options);
    return { body: options.provider === 'fed' ? rss([item('Policy', 'https://www.federalreserve.gov/releases/a')]) : calendar([event()]), fetchedAt: '2026-11-18T14:00:00.000Z', cache: { hit: true, stale: true, ageMs: 300_000 }, sourceUrl: options.url };
  } };
  const api = createPublicFeeds({ transport, clock: () => Date.parse('2026-11-18T14:00:00Z') });
  const news = await api.news(), events = await api.events({ start: '2026-11-01', end: '2026-11-30' });
  assert.equal(news.meta.status, 'stale');
  assert.match(news.meta.coverage, /Federal Reserve/);
  assert.equal(news.data[0].publishedAt, '2026-11-18T13:30:00.000Z');
  assert.match(events.meta.coverage, /BLS national-office/);
  assert.deepEqual(calls.map(x => [x.provider, x.format]), [['fed', 'text'], ['bls', 'text']]);
  await assert.rejects(api.events({ start: 'invalid' }), error => error.code === 'invalid_request');
  assert.equal(calls.length, 2);
});

test('BLS upcoming endpoint defaults to current Eastern date through sixty calendar days', async () => {
  const transport = { async request(options) { return { body: calendar([
    event({ uid: 'past', start: 'DTSTART;TZID=US-Eastern:20261117T083000' }),
    event({ uid: 'today', start: 'DTSTART;TZID=US-Eastern:20261118T083000' }),
    event({ uid: 'future', start: 'DTSTART;TZID=US-Eastern:20261210T083000' }),
  ]), fetchedAt: '2026-11-19T01:00:00.000Z', cache: { hit: false, stale: false, ageMs: 0 }, sourceUrl: options.url }; } };
  const api = createPublicFeeds({ transport, clock: () => Date.parse('2026-11-19T01:00:00Z') });
  const result = await api.events();
  assert.deepEqual(result.meta.window, { start: '2026-11-18', end: '2027-01-17' });
  assert.deepEqual(result.data.map(x => x.id), ['bls:today', 'bls:future']);
});
