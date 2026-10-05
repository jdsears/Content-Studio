import React, { useMemo } from 'react';
import { useStudio } from '../studio.jsx';
import { Button, Card, EmptyState, PageHeader, SectionTitle, Spinner, cx } from '../components/ui.jsx';
import { Icon, PlatformIcon } from '../components/icons.jsx';
import { byWhen, PLATFORM_NAMES } from '../lib/posts.js';
import { dayLabel, formatTime, greeting, isValidDate, ukDayKey } from '../lib/schedule.js';

const DAY = 24 * 60 * 60 * 1000;

const Stat = ({ label, value, tone, onClick }) => (
  <button onClick={onClick} className="text-left rounded-2xl border border-line/60 bg-surface p-4 hover:border-line transition">
    <p className="text-xs text-muted">{label}</p>
    <p className={cx('text-3xl font-semibold mt-1 tabular-nums', tone || 'text-ink')}>{value}</p>
  </button>
);

const Attention = ({ icon, tone, title, body, action }) => (
  <div className={cx('flex items-start gap-3 p-4 rounded-2xl border', tone === 'red' ? 'bg-red-500/10 border-red-500/30' : tone === 'yellow' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-accent/10 border-accent/30')}>
    <Icon name={icon} className={cx('w-5 h-5 flex-shrink-0 mt-0.5', tone === 'red' ? 'text-red-300' : tone === 'yellow' ? 'text-amber-300' : 'text-accent')} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="text-xs text-muted mt-0.5">{body}</p>}
    </div>
    {action}
  </div>
);

const MiniRow = ({ item, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 py-2.5 text-left group">
    <span className="w-14 text-xs text-muted tabular-nums">{formatTime(item.when)}</span>
    <span className="w-8 h-8 rounded-lg bg-raised flex items-center justify-center text-ink flex-shrink-0">
      <PlatformIcon platform={item.platform} className="w-3.5 h-3.5" />
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm text-ink truncate group-hover:text-accent transition">{item.content.split('\n')[0]}</span>
      <span className="block text-[11px] text-faint">{PLATFORM_NAMES[item.platform]} · {item.source.label}</span>
    </span>
  </button>
);

export default function Home() {
  const { workspace, items, counts, serverConfig, serverState, navigate } = useStudio();
  const now = Date.now();

  const upcoming = useMemo(() => items
    .filter(i => i.group === 'upcoming' && isValidDate(i.when) && new Date(i.when).getTime() >= now - 60 * 60 * 1000)
    .sort(byWhen), [items, now]);
  const nextWeek = upcoming.filter(i => new Date(i.when).getTime() <= now + 7 * DAY);
  const recent = useMemo(() => items
    .filter(i => i.group === 'published' && isValidDate(i.when))
    .sort((a, b) => byWhen(b, a)), [items]);
  const publishedThisWeek = recent.filter(i => new Date(i.when).getTime() >= now - 7 * DAY).length;

  // Group the coming week by day
  const byDay = upcoming.slice(0, 12).reduce((acc, item) => {
    const key = ukDayKey(item.when);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  const attention = [];
  if (serverConfig && !serverConfig.claude) {
    attention.push({ icon: 'alert', tone: 'yellow', title: 'Claude is not set up', body: 'Add ANTHROPIC_API_KEY in Railway to write posts.' });
  }
  if (serverConfig?.storage && (!serverConfig.storage.ok || !serverConfig.storage.persistent)) {
    attention.push({
      icon: 'server', tone: 'red', title: 'Saved settings are not permanent',
      body: serverConfig.storage.ok ? 'Attach a Railway Volume at /data, or keys and posts are lost on the next deploy.' : serverConfig.storage.error,
    });
  }
  if (workspace && !workspace.has_publer_key) {
    attention.push({
      icon: 'key', tone: 'yellow', title: `Connect Publer for ${workspace.name}`, body: 'Paste a Publer API key so approved posts go out by themselves.',
      action: <Button size="sm" variant="primary" onClick={() => navigate('settings')}>Connect</Button>,
    });
  }
  if (counts.problems > 0) {
    attention.push({
      icon: 'alert', tone: 'red', title: `${counts.problems} post${counts.problems === 1 ? '' : 's'} need${counts.problems === 1 ? 's' : ''} a fix`, body: 'Publer did not take them. Check the reason and try again.',
      action: <Button size="sm" onClick={() => navigate('schedule', 'problems')}>Review</Button>,
    });
  }
  if (counts.approval > 0) {
    attention.push({
      icon: 'check', tone: 'accent', title: `${counts.approval} post${counts.approval === 1 ? '' : 's'} waiting for your approval`,
      action: <Button size="sm" variant="primary" onClick={() => navigate('schedule', 'approval')}>Review</Button>,
    });
  }

  return (
    <>
      <PageHeader
        title={`${greeting()}`}
        subtitle={workspace ? `${workspace.name}${workspace.brand_config?.tagline ? `, ${workspace.brand_config.tagline.toLowerCase()}` : ''}` : ''}
        actions={<Button variant="primary" icon="plus" onClick={() => navigate('create')}>New post</Button>}
      />

      {attention.length > 0 && (
        <div className="space-y-2.5 mb-6">
          {attention.map(a => <Attention key={a.title} {...a} />)}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Going out in 7 days" value={nextWeek.length} onClick={() => navigate('schedule', 'upcoming')} />
        <Stat label="Published in 7 days" value={publishedThisWeek} onClick={() => navigate('schedule', 'published')} />
        <Stat label="Awaiting approval" value={counts.approval} tone={counts.approval ? 'text-amber-300' : undefined} onClick={() => navigate('schedule', 'approval')} />
        <Stat label="Need a fix" value={counts.problems} tone={counts.problems ? 'text-red-300' : undefined} onClick={() => navigate('schedule', 'problems')} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 p-5 min-w-0">
          <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => navigate('schedule', 'upcoming')}>See all</Button>}>
            Coming up
            {serverState.loading && <Spinner className="w-3.5 h-3.5 text-faint" />}
          </SectionTitle>
          {upcoming.length === 0 ? (
            <EmptyState
              icon="schedule"
              title="Nothing scheduled yet"
              body={workspace?.slug === 'touchline' ? "Posts from Marcus and your own drafts show up here once they're scheduled." : 'Write a post and approve it to see it here.'}
              action={<Button variant="primary" icon="plus" onClick={() => navigate('create')}>New post</Button>}
            />
          ) : (
            <div className="space-y-4">
              {Object.entries(byDay).map(([key, dayItems]) => (
                <div key={key}>
                  <p className="text-[11px] uppercase tracking-wider text-faint mb-1">{dayLabel(key)}</p>
                  <div className="divide-y divide-line/40">
                    {dayItems.map(item => <MiniRow key={item.key} item={item} onClick={() => navigate('schedule', 'upcoming')} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 p-5 min-w-0">
          <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => navigate('schedule', 'published')}>See all</Button>}>Recently published</SectionTitle>
          {recent.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Nothing published yet.</p>
          ) : (
            <div className="divide-y divide-line/40">
              {recent.slice(0, 6).map(item => (
                <div key={item.key} className="flex items-center gap-3 py-2.5">
                  <span className="w-8 h-8 rounded-lg bg-raised flex items-center justify-center text-ink flex-shrink-0">
                    <PlatformIcon platform={item.platform} className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink truncate">{item.content.split('\n')[0]}</span>
                    <span className="block text-[11px] text-faint">{dayLabel(ukDayKey(item.when))}, {formatTime(item.when)}</span>
                  </span>
                  {item.postUrl && (
                    <a href={item.postUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-muted hover:text-accent" aria-label="View the live post">
                      <Icon name="link" className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
