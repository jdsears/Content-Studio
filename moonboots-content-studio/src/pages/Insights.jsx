import React, { useMemo, useState } from 'react';
import { useStudio } from '../studio.jsx';
import { Badge, Card, PageHeader, Segmented, SectionTitle, cx } from '../components/ui.jsx';
import { Icon, PlatformIcon } from '../components/icons.jsx';
import { PLATFORM_NAMES } from '../lib/posts.js';
import { isValidDate, postingTimesFor } from '../lib/schedule.js';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const PLATFORMS = ['linkedin', 'facebook', 'instagram', 'x'];

const Tile = ({ label, value, note, tone }) => (
  <Card className="p-4">
    <p className="text-xs text-muted">{label}</p>
    <p className={cx('text-3xl font-semibold mt-1 tabular-nums', tone || 'text-ink')}>{value}</p>
    {note && <p className="text-[11px] text-faint mt-1">{note}</p>}
  </Card>
);

// Horizontal bars: [{ key, label, value, icon }]
const BarList = ({ rows, empty = 'Nothing yet.' }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (total === 0) return <p className="text-sm text-muted py-4">{empty}</p>;
  return (
    <div className="space-y-3">
      {rows.map(row => (
        <div key={row.key}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="flex items-center gap-2 text-ink min-w-0">
              {row.icon}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="text-muted tabular-nums text-xs">
              {row.value} <span className="text-faint">· {Math.round((row.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-raised overflow-hidden">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// Posts published each week, oldest on the left
const WeeklyBars = ({ weeks }) => {
  const max = Math.max(1, ...weeks.map(w => w.value));
  return (
    <div className="flex items-end gap-1.5 sm:gap-3 h-44 pt-6">
      {weeks.map((week, i) => (
        <div key={week.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
          <span className="text-[11px] text-muted tabular-nums">{week.value || ''}</span>
          <div
            className={cx('w-full max-w-[44px] rounded-t-lg transition-all', i === weeks.length - 1 ? 'bg-accent' : 'bg-accent/40')}
            style={{ height: `${Math.max(week.value ? 6 : 2, (week.value / max) * 100)}%` }}
            title={`${week.value} published, week of ${week.label}`}
          />
          <span className="text-[10px] text-faint whitespace-nowrap">{week.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function Insights() {
  const { items, workspace, counts } = useStudio();
  const [range, setRange] = useState(30);
  const now = Date.now();

  const published = useMemo(
    () => items.filter(i => i.group === 'published' && isValidDate(i.when)),
    [items],
  );
  const inRange = published.filter(i => now - new Date(i.when).getTime() <= range * DAY);
  const scheduledAhead = items.filter(i => i.group === 'upcoming' && isValidDate(i.when) && new Date(i.when).getTime() > now).length;

  const weeks = useMemo(() => Array.from({ length: 8 }, (_, idx) => {
    const back = 7 - idx; // 7 weeks ago ... this week
    const end = now - back * WEEK;
    const start = end - WEEK;
    return {
      label: new Date(start + DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }),
      value: published.filter(i => {
        const t = new Date(i.when).getTime();
        return t > start && t <= end;
      }).length,
    };
  }), [published, now]);

  const byPlatform = PLATFORMS.map(p => ({
    key: p,
    label: PLATFORM_NAMES[p],
    value: inRange.filter(i => i.platform === p).length,
    icon: <PlatformIcon platform={p} className="w-3.5 h-3.5 text-muted" />,
  }));

  const pillarCounts = {};
  inRange.forEach(i => { const key = i.pillar || 'No pillar'; pillarCounts[key] = (pillarCounts[key] || 0) + 1; });
  const byPillar = Object.entries(pillarCounts).sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, label: key, value }));

  const sourceCounts = {};
  inRange.forEach(i => { sourceCounts[i.source.label] = (sourceCounts[i.source.label] || 0) + 1; });
  const bySource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, label: key === 'You' ? 'Written here' : key, value }));

  // Last four weeks against the target for each platform
  const rhythm = PLATFORMS.map(p => {
    const target = postingTimesFor(workspace, p);
    const lastMonth = published.filter(i => i.platform === p && now - new Date(i.when).getTime() <= 4 * WEEK).length;
    const perWeek = lastMonth / 4;
    const { min, max } = target.frequency;
    const status = perWeek >= min ? 'on' : perWeek > 0 ? 'low' : 'none';
    return { platform: p, perWeek, min, max, status, target };
  });

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="What has gone out, and how it compares with your posting targets."
        actions={(
          <Segmented
            value={range}
            onChange={setRange}
            options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }]}
          />
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label={`Published, last ${range} days`} value={inRange.length} note={`${(inRange.length / (range / 7)).toFixed(1)} a week`} />
        <Tile label="Scheduled ahead" value={scheduledAhead} note="Waiting to go out" />
        <Tile label="Awaiting approval" value={counts.approval} tone={counts.approval ? 'text-amber-300' : undefined} />
        <Tile label="Need a fix" value={counts.problems} tone={counts.problems ? 'text-red-300' : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle>Published each week</SectionTitle>
          <WeeklyBars weeks={weeks} />
        </Card>
        <Card className="p-5">
          <SectionTitle>By platform</SectionTitle>
          <BarList rows={byPlatform} empty={`Nothing published in the last ${range} days.`} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <Card className="p-5">
          <SectionTitle>By content pillar</SectionTitle>
          <BarList rows={byPillar} empty={`Nothing published in the last ${range} days.`} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Where posts came from</SectionTitle>
          <BarList rows={bySource} empty={`Nothing published in the last ${range} days.`} />
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <SectionTitle>Posting rhythm, last 4 weeks</SectionTitle>
        <div className="divide-y divide-line/40">
          {rhythm.map(r => (
            <div key={r.platform} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="flex items-center gap-2.5 sm:w-36">
                <span className="w-8 h-8 rounded-lg bg-raised flex items-center justify-center text-ink"><PlatformIcon platform={r.platform} className="w-3.5 h-3.5" /></span>
                <span className="text-sm text-ink">{PLATFORM_NAMES[r.platform]}</span>
              </span>
              <span className="flex-1 text-xs text-muted">
                <span className="text-ink tabular-nums">{r.perWeek.toFixed(1)}</span> a week, target {r.min} to {r.max}.
                {' '}Best days {r.target.bestDays.map(d => d.slice(0, 3)).join(', ')} at {r.target.bestHours.map(h => `${String(h).padStart(2, '0')}:00`).join(', ')}.
              </span>
              <Badge tone={r.status === 'on' ? 'green' : r.status === 'low' ? 'yellow' : 'neutral'}>
                {r.status === 'on' ? 'On target' : r.status === 'low' ? 'Below target' : 'Not posting'}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-3 p-4 rounded-2xl border border-line/60 bg-raised/30 text-sm text-muted">
        <Icon name="insights" className="w-5 h-5 text-faint flex-shrink-0" />
        <p>
          These numbers come from posts sent through Content Studio. Likes, comments and reach live in Publer's analytics,
          which this app does not read yet.
        </p>
      </div>
    </>
  );
}
