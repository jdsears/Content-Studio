// Posting times and dates, shown in UK time.

export const industryBenchmarks = {
  linkedin: { frequency: { min: 3, max: 5, unit: 'week' }, bestDays: ['Tuesday', 'Wednesday', 'Thursday'], bestHours: [8, 9, 10, 12] },
  facebook: { frequency: { min: 3, max: 7, unit: 'week' }, bestDays: ['Wednesday', 'Thursday', 'Friday'], bestHours: [9, 11, 13, 15] },
  x: { frequency: { min: 7, max: 21, unit: 'week' }, bestDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], bestHours: [9, 12, 15, 17] },
  instagram: { frequency: { min: 3, max: 5, unit: 'week' }, bestDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'], bestHours: [11, 13, 18, 20] },
};

// Posting times for a platform: the workspace's own, or the general benchmarks
export const postingTimesFor = (workspace, platform) => {
  const own = workspace?.brand_config?.posting_frequency?.[platform];
  if (own?.days?.length && own?.hours?.length) {
    return { frequency: { min: own.min, max: own.max, unit: 'week' }, bestDays: own.days, bestHours: own.hours };
  }
  return industryBenchmarks[platform];
};

export const getNextTimeSlots = (platform, count = 5, workspace = null) => {
  const benchmark = postingTimesFor(workspace, platform);
  const slots = [];
  const now = new Date();
  let currentDay = now.getDay(); // 0 = Sunday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Get next 14 days of slots
  for (let d = 0; d < 14 && slots.length < count; d++) {
    const checkDay = (currentDay + d) % 7;
    const dayName = dayNames[checkDay];

    if (benchmark.bestDays.includes(dayName)) {
      benchmark.bestHours.forEach(hour => {
        if (slots.length < count) {
          const slotDate = new Date(now);
          slotDate.setDate(slotDate.getDate() + d);
          slotDate.setHours(hour, 0, 0, 0);

          // Only include future times
          if (slotDate > now) {
            slots.push({
              day: dayName,
              hour,
              date: slotDate,
              label: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayName,
              full: `${d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayName} ${hour}:00`
            });
          }
        }
      });
    }
  }
  return slots;
};


// ============ UK DATES ============

const TZ = 'Europe/London';

export const isValidDate = (value) => !!value && !Number.isNaN(new Date(value).getTime());

// "Tue 6 Oct, 08:00"
export const formatWhen = (iso) => {
  if (!isValidDate(iso)) return iso || '';
  return new Date(iso).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// "08:00"
export const formatTime = (iso) => (isValidDate(iso)
  ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  : '');

// "2026-10-06", the calendar day in the UK
export const ukDayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

// "Today", "Tomorrow", "Yesterday" or "Thursday 8 October"
export const dayLabel = (key) => {
  const today = ukDayKey(new Date().toISOString());
  const shift = (days) => ukDayKey(new Date(Date.now() + days * 86400000).toISOString());
  if (key === today) return 'Today';
  if (key === shift(1)) return 'Tomorrow';
  if (key === shift(-1)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
};

export const greeting = () => {
  const hour = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};
