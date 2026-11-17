/** Authored fictional fixture. No exchange feed, real quotes, news or random runtime data. */
export const SAMPLE_SOURCE = Object.freeze({
  id: 'nortivo-fictional-session-v1',
  name: 'Nortivo fictional sample',
  mode: 'sample',
  version: '1.0.0',
  currency: 'USD',
  timezone: 'America/New_York',
  calendarTimezone: 'Europe/Oslo',
  attribution: 'Original Nortivo synthetic fixture. Not exchange or provider data.',
  license: 'Original project fixture; no third-party market-data redistribution.',
  method: 'Fixed integer interpolation between authored price anchors; deterministic authored volume and spreads. Bars are regular-session 1-minute intervals, stamped at interval close. No random numbers, wall clock or external prices are used.',
  execution: 'Paper only. Whole shares, integer USD cents. No real liquidity model.',
  adjusted: 'Synthetic internally consistent prices and volumes; no splits or dividends occur in this fixture.',
});

export const INSTRUMENTS = Object.freeze([
  { symbol: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ', currency: 'USD', sector: 'Semiconductors' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ', currency: 'USD', sector: 'Semiconductors' },
  { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', currency: 'USD', sector: 'Software' },
  { symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', currency: 'USD', sector: 'Consumer technology' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'NYSE Arca', currency: 'USD', sector: 'Broad market ETF' },
]);

// Two complete US regular sessions: 13 and 16 November 2026. The values are fiction.
// Each anchor describes 30 one-minute closes; interpolation is fixed and integer.
const ANCHORS = {
  NVDA: [14800,14890,15020,14930,15080,15200,15060,15140,15310,15230,15390,15480,15410,15460,15540,15650,15570,15480,15590,15760,15820,15670,15530,15620,15790,15900,15810],
  AMD: [22000,21920,21840,21980,22100,22010,21890,21760,21930,22080,22200,22120,22030,22070,22200,22340,22270,22120,22040,22230,22420,22310,22160,22240,22400,22530,22440],
  MSFT: [50500,50570,50680,50600,50490,50420,50560,50650,50720,50610,50530,50680,50740,50710,50830,50910,50820,50690,50580,50670,50790,50930,51020,50940,50810,50960,51080],
  AAPL: [26700,26790,26720,26610,26530,26620,26740,26660,26590,26480,26560,26680,26730,26710,26610,26520,26620,26750,26810,26720,26640,26530,26610,26720,26840,26760,26670],
  SPY: [67100,67180,67230,67160,67090,67130,67210,67270,67190,67120,67200,67300,67340,67310,67400,67480,67420,67310,67260,67340,67450,67520,67470,67380,67440,67530,67580],
};
const OPEN_TIMES = ['2026-11-13T14:30:00.000Z', '2026-11-16T14:30:00.000Z'];

function makeBars(symbol, instrumentIndex) {
  const anchors = ANCHORS[symbol];
  const bars = [];
  for (let index = 0; index < 780; index += 1) {
    const anchor = Math.floor(index / 30);
    const fraction = (index % 30 + 1) / 30;
    const base = Math.round(anchors[anchor] + (anchors[anchor + 1] - anchors[anchor]) * fraction);
    const ripple = [0, 3, -2, 5, -4, 2, -1, 4, -3, 1][index % 10] * (instrumentIndex + 1);
    const close = base + ripple;
    const open = index ? bars[index - 1].close : anchors[0];
    const spread = 4 + (index % 7) * 2 + instrumentIndex;
    const sessionMinute = index % 390;
    bars.push(Object.freeze({
      time: new Date(Date.parse(OPEN_TIMES[Math.floor(index / 390)]) + (sessionMinute + 1) * 60_000).toISOString(),
      open, high: Math.max(open, close) + spread, low: Math.min(open, close) - spread, close,
      volume: (symbol === 'SPY' ? 148000 : 53000 + instrumentIndex * 11000) + ((index * 7919 + instrumentIndex * 1151) % 97000) + (sessionMinute < 30 || sessionMinute >= 360 ? 80000 : 0),
    }));
  }
  return Object.freeze(bars);
}

export const SAMPLE_BARS = Object.freeze(Object.fromEntries(INSTRUMENTS.map((instrument, index) => [instrument.symbol, makeBars(instrument.symbol, index)])));
export const INITIAL_CURSOR = 509;

export const SAMPLE_NEWS = Object.freeze([
  { id: 'fixture-news-1', symbols: ['NVDA','AMD'], category: 'Technology', title: 'Sample: semiconductor demand discussion', summary: 'Fictional research-desk note for testing ticker filters and chart markers. No actual company announcement is represented.', publishedAt: '2026-11-13T15:05:00.000Z' },
  { id: 'fixture-news-2', symbols: ['MSFT'], category: 'Earnings', title: 'Sample: cloud spending scenario', summary: 'Fictional scenario about enterprise cloud budgets. The article is a fixture and is not investment research or current news.', publishedAt: '2026-11-13T18:20:00.000Z' },
  { id: 'fixture-news-3', symbols: ['SPY'], category: 'Macro', title: 'Sample: broad-market opening briefing', summary: 'An authored example briefing for the sample session. A publication marker indicates timing, not a proven cause of a price move.', publishedAt: '2026-11-16T14:20:00.000Z' },
  { id: 'fixture-news-4', symbols: ['AAPL'], category: 'Technology', title: 'Sample: consumer hardware channel checks', summary: 'Fictional channel-check discussion used to exercise news-to-chart navigation. No real source article exists.', publishedAt: '2026-11-16T14:55:00.000Z' },
  { id: 'fixture-news-5', symbols: ['NVDA','AMD'], category: 'Technology', title: 'Sample: chip-sector supply-chain note', summary: 'A fictional sector note with two relevant tickers. The sample contains no attributed current facts or machine-generated summary.', publishedAt: '2026-11-16T16:00:00.000Z' },
  { id: 'fixture-news-6', symbols: ['MSFT','SPY'], category: 'Markets', title: 'Sample: software and index midday review', summary: 'Fictional midday review released only when the replay reaches this timestamp. It must not enter earlier decisions.', publishedAt: '2026-11-16T17:10:00.000Z' },
  { id: 'fixture-news-7', symbols: ['AAPL'], category: 'Markets', title: 'Sample: hardware-sector afternoon review', summary: 'Fictional afternoon fixture for filtering and chronological replay. No causal claim about the chart is made.', publishedAt: '2026-11-16T18:25:00.000Z' },
  { id: 'fixture-news-8', symbols: ['NVDA','AMD','MSFT','AAPL','SPY'], category: 'Markets', title: 'Sample: closing-session risk checklist', summary: 'Fictional desk checklist. This publication is hidden until its timestamp and cannot inform earlier strategy signals.', publishedAt: '2026-11-16T20:15:00.000Z' },
].map(item => Object.freeze({ ...item, source: 'Nortivo fictional sample', url: null, fixture: true, summaryMethod: 'Authored fictional fixture; no AI summarization', sentiment: null, impact: null })));

export const SAMPLE_CALENDAR = Object.freeze([
  { id: 'fixture-event-1', title: 'Sample: manufacturing survey', country: 'US', currency: 'USD', scheduledAt: '2026-11-16T15:00:00.000Z', previous: '50.2', forecast: '50.5', actual: '50.4', unit: 'index points' },
  { id: 'fixture-event-2', title: 'Sample: business inventories', country: 'US', currency: 'USD', scheduledAt: '2026-11-16T16:00:00.000Z', previous: '0.1', forecast: '0.2', actual: '0.1', unit: '% month over month' },
  { id: 'fixture-event-3', title: 'Sample: regional activity survey', country: 'US', currency: 'USD', scheduledAt: '2026-11-16T17:30:00.000Z', previous: '4.0', forecast: '4.5', actual: '3.8', unit: 'index points' },
  { id: 'fixture-event-4', title: 'Sample: policy discussion', country: 'US', currency: 'USD', scheduledAt: '2026-11-16T19:00:00.000Z', previous: null, forecast: null, actual: null, unit: null },
].map(item => Object.freeze({ ...item, source: 'Nortivo fictional sample', fixture: true, url: null })));
