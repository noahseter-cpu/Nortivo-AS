import { evaluateAlerts } from '../src/audit.mjs';

// Read only a bounded export of sanitized Sentinel JSON lines from stdin.
let size = 0, text = '';
try {
  for await (const part of process.stdin) {
    size += part.length;
    if (size > 5_000_000) throw Error();
    text += part.toString('utf8');
  }
  const end = Date.now(), start = end - 5 * 60_000;
  const events = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).filter(event => {
    const time = Date.parse(event.timestamp);
    return Number.isFinite(time) && time >= start && time <= end;
  });
  console.log(JSON.stringify({ windowMinutes: 5, alerts: evaluateAlerts(events), notificationDeliveryConfigured: false }, null, 2));
} catch { console.error('Use a bounded export of valid sanitized Sentinel JSON lines.'); process.exitCode = 1; }
