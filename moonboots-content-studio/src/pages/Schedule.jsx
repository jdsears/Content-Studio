import React, { useMemo, useState } from 'react';
import { useStudio } from '../studio.jsx';
import { Button, Card, EmptyState, PageHeader, Segmented, Spinner, cx } from '../components/ui.jsx';
import { Icon, PlatformIcon } from '../components/icons.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { byWhen } from '../lib/posts.js';
import { dayLabel, formatTime, isValidDate, ukDayKey } from '../lib/schedule.js';

const FILTERS = [
  { value: 'approval', label: 'To approve' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'published', label: 'Published' },
  { value: 'problems', label: 'Problems' },
  { value: 'other', label: 'Rejected & cancelled' },
];

const EMPTY = {
  approval: ['check', 'Nothing to approve', 'Drafts you write in Create wait here for a final check.'],
  upcoming: ['schedule', 'Nothing scheduled', 'Approved posts with a time show here until they go out.'],
  published: ['send', 'Nothing published yet', 'Posts appear here once they are live.'],
  problems: ['check', 'No problems', 'Posts Publer could not take would show here.'],
  other: ['trash', 'Nothing here', 'Rejected and cancelled posts show here.'],
};

// Group posts under day headings ("Today", "Tomorrow", "Thursday 8 October")
const groupByDay = (list) => {
  const groups = [];
  for (const item of list) {
    const key = isValidDate(item.when) ? ukDayKey(item.when) : 'none';
    let group = groups.find(g => g.key === key);
    if (!group) {
      group = { key, label: key === 'none' ? 'No time set' : dayLabel(key), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
};

// ============ LIST ============

const ListView = ({ filter, items }) => {
  const list = useMemo(() => {
    const chosen = items.filter(i => i.group === filter);
    if (filter === 'published' || filter === 'other') return chosen.sort((a, b) => byWhen(b, a));
    return chosen.sort(byWhen);
  }, [items, filter]);

  if (list.length === 0) {
    const [icon, title, body] = EMPTY[filter];
    return <Card><EmptyState icon={icon} title={title} body={body} /></Card>;
  }

  if (filter === 'approval' || filter === 'problems') {
    return <div className="space-y-3">{list.map(item => <PostCard key={item.key} item={item} />)}</div>;
  }

  return (
    <div className="space-y-6">
      {groupByDay(list).map(group => (
        <section key={group.key}>
          <h3 className="sticky top-14 lg:top-0 z-10 -mx-1 px-1 py-2 bg-bg/90 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider text-faint">
            {group.label} <span className="font-normal normal-case tracking-normal">· {group.items.length}</span>
          </h3>
          <div className="space-y-3 mt-1">
            {group.items.map(item => <PostCard key={item.key} item={item} />)}
          </div>
        </section>
      ))}
    </div>
  );
};

// ============ CALENDAR ============

const DOT = {
  approval: 'bg-amber-400',
  upcoming: 'bg-violet-400',
  published: 'bg-sky-400',
  problems: 'bg-red-400',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CalendarView = ({ items }) => {
  const todayKey = ukDayKey(new Date().toISOString());
  const [month, setMonth] = useState(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return { y, m };
  });
  const [selected, setSelected] = useState(todayKey);

  // Posts with a time, by UK day
  const byDay = useMemo(() => {
    const map = {};
    items
      .filter(i => i.group !== 'other' && isValidDate(i.when))
      .sort(byWhen)
      .forEach(item => {
        const key = ukDayKey(item.when);
        (map[key] = map[key] || []).push(item);
      });
    return map;
  }, [items]);

  const first = new Date(Date.UTC(month.y, month.m - 1, 1));
  const daysInMonth = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month.y}-${String(month.m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);

  const shift = (delta) => setMonth(({ y, m }) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  });
  const goToday = () => {
    const [y, m] = todayKey.split('-').map(Number);
    setMonth({ y, m });
    setSelected(todayKey);
  };

  const selectedItems = byDay[selected] || [];
  const monthName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
      <Card className="p-3 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-ink">{monthName}</h3>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={goToday}>Today</Button>
            <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => shift(-1)} aria-label="Previous month" />
            <Button size="sm" variant="ghost" icon="chevronRight" onClick={() => shift(1)} aria-label="Next month" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAYS.map(d => <div key={d} className="text-center text-[11px] font-medium text-faint pb-1">{d}</div>)}
          {cells.map((key, i) => {
            if (!key) return <div key={`blank-${i}`} />;
            const dayItems = byDay[key] || [];
            const isToday = key === todayKey;
            const isSelected = key === selected;
            const isPast = key < todayKey;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={cx(
                  'min-h-[56px] sm:min-h-[92px] rounded-xl border p-1.5 sm:p-2 text-left flex flex-col transition',
                  isSelected ? 'border-accent/60 bg-accent/5' : 'border-line/40 hover:border-line',
                  isPast && !isSelected && 'opacity-60',
                )}
              >
                <span className={cx(
                  'text-xs tabular-nums w-6 h-6 rounded-full flex items-center justify-center',
                  isToday ? 'bg-primary text-primary-ink font-semibold' : 'text-muted',
                )}>
                  {Number(key.slice(8))}
                </span>
                {/* Phones: dots. Larger screens: small post chips */}
                <span className="flex flex-wrap gap-0.5 mt-auto sm:hidden">
                  {dayItems.slice(0, 4).map(item => <span key={item.key} className={cx('w-1.5 h-1.5 rounded-full', DOT[item.group])} />)}
                </span>
                <span className="hidden sm:flex flex-col gap-1 mt-1">
                  {dayItems.slice(0, 3).map(item => (
                    <span key={item.key} className="flex items-center gap-1 text-[10px] text-muted truncate">
                      <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', DOT[item.group])} />
                      <PlatformIcon platform={item.platform} className="w-2.5 h-2.5 shrink-0" />
                      <span className="tabular-nums">{formatTime(item.when)}</span>
                    </span>
                  ))}
                  {dayItems.length > 3 && <span className="text-[10px] text-faint">+{dayItems.length - 3} more</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[11px] text-muted">
          {[['upcoming', 'Scheduled'], ['approval', 'To approve'], ['published', 'Published'], ['problems', 'Problem']].map(([g, label]) => (
            <span key={g} className="flex items-center gap-1.5"><span className={cx('w-2 h-2 rounded-full', DOT[g])} />{label}</span>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">{dayLabel(selected)}</h3>
        {selectedItems.length === 0
          ? <Card className="p-6 text-center text-sm text-muted">Nothing on this day.</Card>
          : selectedItems.map(item => <PostCard key={item.key} item={item} />)}
      </div>
    </div>
  );
};

// ============ PAGE ============

export default function Schedule() {
  const { items, counts, param, navigate, serverState, reloadServerPosts, workspace } = useStudio();
  const [view, setView] = useState('list');
  const routeFilter = FILTERS.some(f => f.value === param) ? param : null;
  const filter = routeFilter || (counts.approval > 0 ? 'approval' : 'upcoming');

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={workspace?.slug === 'touchline'
          ? 'Everything waiting, going out and gone out, including posts from Marcus.'
          : 'Everything waiting for approval, going out and gone out.'}
        actions={(
          <>
            <Button variant="ghost" icon="refresh" loading={serverState.loading} onClick={reloadServerPosts} aria-label="Refresh" />
            <Segmented
              value={view}
              onChange={setView}
              options={[{ value: 'list', label: 'List', icon: 'list' }, { value: 'calendar', label: 'Calendar', icon: 'calendar' }]}
            />
          </>
        )}
      />

      {serverState.error && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
          <Icon name="alert" className="w-4 h-4 shrink-0" />
          Could not load posts from the server: {serverState.error}
        </div>
      )}

      {view === 'list' ? (
        <>
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto mb-5">
            <div className="flex gap-1.5 w-max">
              {FILTERS.map(f => {
                const count = counts[f.value];
                const active = filter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => navigate('schedule', f.value)}
                    className={cx(
                      'h-9 px-3.5 rounded-full text-sm font-medium border transition flex items-center gap-2',
                      active ? 'bg-primary text-primary-ink border-primary' : 'border-line/70 text-muted hover:text-ink',
                    )}
                  >
                    {f.label}
                    {count > 0 && (
                      <span className={cx(
                        'min-w-[20px] h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center',
                        active ? 'bg-primary-ink/15' : f.value === 'problems' ? 'bg-red-500/20 text-red-300' : f.value === 'approval' ? 'bg-amber-500/20 text-amber-300' : 'bg-raised text-muted',
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {!serverState.loaded && serverState.loading
            ? <div className="flex justify-center py-16 text-faint"><Spinner /></div>
            : <ListView filter={filter} items={items} />}
        </>
      ) : (
        <CalendarView items={items} />
      )}
    </>
  );
}
