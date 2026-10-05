// Posting slots are UK times; the server clock runs on UTC.
export const POSTING_TIME_ZONE = 'Europe/London';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MIN_LEAD_MS = 5 * 60 * 1000;

function zonedParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const get = type => Number(parts.find(p => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

// Minutes the zone is ahead of UTC at this moment (60 in British Summer Time, 0 in winter)
function offsetMinutes(timestamp, timeZone) {
  const p = zonedParts(timestamp, timeZone);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - timestamp) / 60000;
}

// The moment it is `hour`:00 on the given calendar day in the zone
export function zonedTime(year, month, day, hour, timeZone = POSTING_TIME_ZONE) {
  const guess = Date.UTC(year, month - 1, day, hour);
  let utc = guess - offsetMinutes(guess, timeZone) * 60000;
  const corrected = guess - offsetMinutes(utc, timeZone) * 60000;
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}

// Next free posting slot for one platform, from a workspace's posting_frequency entry
// ({ days: ['Tuesday', ...], hours: [8, 9] }). `taken` holds ISO times already used.
export function nextPostingSlot(frequency, { after = new Date(), taken = [], timeZone = POSTING_TIME_ZONE } = {}) {
  if (!frequency?.days?.length || !frequency?.hours?.length) return null;

  const earliest = after.getTime() + MIN_LEAD_MS;
  const used = new Set(taken.map(t => new Date(t).toISOString()));
  const today = zonedParts(after.getTime(), timeZone);
  const hours = [...frequency.hours].sort((a, b) => a - b);

  for (let d = 0; d < 28; d++) {
    const calendarDay = new Date(Date.UTC(today.year, today.month - 1, today.day + d));
    if (!frequency.days.includes(DAY_NAMES[calendarDay.getUTCDay()])) continue;
    for (const hour of hours) {
      const slot = zonedTime(calendarDay.getUTCFullYear(), calendarDay.getUTCMonth() + 1, calendarDay.getUTCDate(), hour, timeZone);
      if (slot.getTime() >= earliest && !used.has(slot.toISOString())) return slot;
    }
  }
  return null;
}
