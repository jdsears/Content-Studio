import React, { useState } from 'react';
import { checkContent } from '../../shared/brand.js';
import { useStudio, DEFAULT_PILLARS } from '../studio.jsx';
import { BrandWarnings, Button, Card, ImageViewer, PageHeader, Segmented, Toggle, cx, inputClass, useFeedback } from '../components/ui.jsx';
import { Icon, PlatformIcon } from '../components/icons.jsx';
import { PostPreview } from '../components/PostPreview.jsx';
import { apiJson, CLAUDE_NOT_SET } from '../lib/api.js';
import { generateTemplateImage, themesFor } from '../lib/images.js';
import { PLATFORM_LIMITS, PLATFORM_NAMES } from '../lib/posts.js';
import { formatWhen, getNextTimeSlots, isValidDate } from '../lib/schedule.js';

const PLATFORMS = ['linkedin', 'facebook', 'instagram', 'x'];

// MoonBoots keeps its canned posts for when Claude is not available. Other workspaces never use them.
const moonbootsFallback = topic => ({
  linkedin: `${topic}\n\nThis isn't about chasing trends—it's about building systems that last.\n\nThree things I've learned:\n\n1. Start with the problem, not the technology\n2. Simple beats sophisticated every time\n3. Your users will tell you what they need—if you listen\n\nThe organisations getting this right aren't the loudest. They're the most curious.`,
  x: `${topic}\n\nMost get this wrong.\n\nThey start with tools. They should start with problems.\n\nClarity > complexity. Every time.`,
  instagram: `${topic}\n\nAfter years of working with founders on this, one thing is clear:\n\nThe best technology serves people—not the other way around.\n\n#Strategy #AI #Innovation #Leadership`,
});

// "2026-10-06T08:00" for a datetime-local input, in this browser's time
const toLocalInput = iso => {
  if (!isValidDate(iso)) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const slotWhen = slot => ({ mode: 'slot', at: slot.date.toISOString(), label: slot.full });

// ============ WHEN PICKER ============

const WhenPicker = ({ platform, when, workspace, onChange }) => {
  const slots = getNextTimeSlots(platform, 3, workspace);
  const [custom, setCustom] = useState(when?.mode === 'custom');
  const chip = (active, label, onClick, key) => (
    <button
      key={key || label}
      onClick={onClick}
      className={cx(
        'h-8 px-3 rounded-lg text-xs font-medium border transition',
        active ? 'bg-accent/15 border-accent/50 text-accent' : 'bg-raised/40 border-line/60 text-muted hover:text-ink',
      )}
    >
      {label}
    </button>
  );
  const minInput = toLocalInput(new Date(Date.now() + 5 * 60 * 1000).toISOString());

  return (
    <div>
      <p className="text-xs font-medium text-muted mb-2 flex items-center gap-1.5">
        <Icon name="clock" className="w-3.5 h-3.5" /> When
      </p>
      <div className="flex flex-wrap gap-1.5">
        {slots.map(slot => chip(
          !custom && when?.mode === 'slot' && when.at === slot.date.toISOString(),
          `${slot.label} ${String(slot.hour).padStart(2, '0')}:00`,
          () => { setCustom(false); onChange(slotWhen(slot)); },
          slot.date.toISOString(),
        ))}
        {chip(custom, 'Pick a time', () => setCustom(true))}
        {chip(!custom && when?.mode === 'none', 'No time', () => { setCustom(false); onChange({ mode: 'none' }); })}
      </div>
      {custom && (
        <input
          type="datetime-local"
          min={minInput}
          value={when?.mode === 'custom' ? toLocalInput(when.at) : ''}
          onChange={e => onChange(e.target.value ? { mode: 'custom', at: new Date(e.target.value).toISOString() } : { mode: 'none' })}
          className={cx(inputClass, 'mt-2 max-w-xs')}
        />
      )}
      {when?.mode === 'none' && <p className="text-[11px] text-faint mt-1.5">Approving it sends it straight away.</p>}
    </div>
  );
};

// ============ ONE DRAFT ============

const DraftCard = ({ platform, draft, workspace, onChange, onImage, onRemoveImage, onAdd, onDiscard, adding }) => {
  const [mode, setMode] = useState('preview');
  const [viewImage, setViewImage] = useState(null);
  const limit = PLATFORM_LIMITS[platform];
  const length = draft.content.length;
  const over = limit && length > limit;
  const warnings = checkContent(workspace?.slug, draft.content);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl bg-raised flex items-center justify-center text-ink">
          <PlatformIcon platform={platform} className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">{PLATFORM_NAMES[platform]}</p>
          <p className={cx('text-[11px] tabular-nums', over ? 'text-red-300' : 'text-faint')}>
            {length.toLocaleString()} / {limit.toLocaleString()} characters{over ? ', too long' : ''}
          </p>
        </div>
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[{ value: 'preview', label: 'Preview' }, { value: 'edit', label: 'Edit' }]}
        />
      </div>

      {mode === 'preview' ? (
        <div className="max-w-xl">
          <PostPreview
            platform={platform}
            content={draft.content}
            image={draft.image}
            imageLoading={draft.imageLoading}
            workspace={workspace}
            onOpenImage={() => setViewImage(draft.image)}
          />
        </div>
      ) : (
        <textarea
          value={draft.content}
          onChange={e => onChange({ content: e.target.value })}
          rows={platform === 'x' ? 6 : 12}
          className={cx(inputClass, 'resize-y leading-relaxed')}
        />
      )}

      <BrandWarnings warnings={warnings} className="mt-3" />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" icon={draft.image ? 'refresh' : 'image'} loading={draft.imageLoading} onClick={onImage}>
          {draft.image ? 'New image' : 'Add image'}
        </Button>
        {draft.image && <Button size="sm" variant="ghost" icon="x" onClick={onRemoveImage}>Remove image</Button>}
      </div>

      <div className="mt-4 pt-4 border-t border-line/50 space-y-4">
        <WhenPicker platform={platform} when={draft.when} workspace={workspace} onChange={when => onChange({ when })} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" icon="trash" onClick={onDiscard}>Discard</Button>
          <Button variant="primary" icon="check" loading={adding} disabled={!draft.content.trim() || over || draft.imageLoading} onClick={onAdd}>Add to approvals</Button>
        </div>
      </div>
      <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />
    </Card>
  );
};

const DraftSkeleton = ({ platform }) => (
  <Card className="p-5">
    <div className="flex items-center gap-3 mb-4">
      <span className="w-9 h-9 rounded-xl bg-raised flex items-center justify-center text-muted">
        <PlatformIcon platform={platform} className="w-4 h-4" />
      </span>
      <p className="text-sm text-muted">Writing the {PLATFORM_NAMES[platform]} post</p>
    </div>
    <div className="space-y-2.5 animate-pulse">
      <div className="h-3 rounded-sm bg-raised w-11/12" />
      <div className="h-3 rounded-sm bg-raised w-10/12" />
      <div className="h-3 rounded-sm bg-raised w-8/12" />
      <div className="h-3 rounded-sm bg-raised w-9/12" />
    </div>
  </Card>
);

// ============ PAGE ============

export default function Create() {
  const { workspace, serverConfig, settings, generator, setGenerator, addDraft, navigate } = useStudio();
  const { toast } = useFeedback();
  const pillars = workspace?.pillars?.length ? workspace.pillars : DEFAULT_PILLARS;
  const themes = themesFor(workspace?.slug);
  const themeKeys = Object.keys(themes);
  const theme = themes[generator.theme] ? generator.theme : themeKeys[0];
  const pillarName = pillars.find(p => p.id === generator.pillar)?.name || pillars[0]?.name;
  const chosen = PLATFORMS.filter(p => generator.platforms[p]);
  const busy = generator.busy;
  const drafts = generator.drafts || {};
  const draftPlatforms = PLATFORMS.filter(p => drafts[p]);

  const update = changes => setGenerator(prev => ({ ...prev, ...(typeof changes === 'function' ? changes(prev) : changes) }));
  const updateDraft = (platform, changes) => setGenerator(prev => {
    if (!prev.drafts?.[platform]) return prev;
    return { ...prev, drafts: { ...prev.drafts, [platform]: { ...prev.drafts[platform], ...changes } } };
  });

  const makeImage = async (platform, content) => {
    updateDraft(platform, { imageLoading: true });
    try {
      const image = await generateTemplateImage(content, 'quote', platform, theme, workspace?.slug);
      updateDraft(platform, { image, imageLoading: false });
    } catch (error) {
      console.error(`Image failed for ${platform}:`, error);
      updateDraft(platform, { imageLoading: false });
      toast({ tone: 'error', title: 'Could not make the image', body: error.message });
    }
  };

  const suggestTopic = async () => {
    if (!serverConfig?.claude) {
      toast({ tone: 'error', title: 'Claude is not set up', body: CLAUDE_NOT_SET });
      return;
    }
    update({ busy: 'suggesting' });
    try {
      const data = await apiJson('/api/suggest-topic', {
        method: 'POST',
        body: JSON.stringify({ pillar: pillarName, workspaceId: workspace?.id }),
      });
      if (!data.topic) throw new Error(data.error || 'No topic came back');
      update({ topic: data.topic, busy: null });
    } catch (error) {
      update({ busy: null });
      toast({ tone: 'error', title: 'Could not suggest a topic', body: error.message });
    }
  };

  const write = async () => {
    const topic = generator.topic.trim();
    if (!topic || chosen.length === 0) return;
    const canUseFallback = !workspace || workspace.slug === 'moonboots';
    update({ busy: 'writing', drafts: null });

    let content = null;
    if (serverConfig?.claude) {
      try {
        const data = await apiJson('/api/generate', {
          method: 'POST',
          body: JSON.stringify({ topic, pillar: pillarName, platforms: generator.platforms, workspaceId: workspace?.id }),
        });
        content = data.content;
      } catch (error) {
        if (!canUseFallback) {
          update({ busy: null });
          toast({ tone: 'error', title: 'Claude could not write the posts', body: error.message });
          return;
        }
        toast({ tone: 'error', title: 'Claude could not write the posts', body: `${error.message} Using the standard MoonBoots posts instead.` });
        content = moonbootsFallback(topic);
      }
    } else {
      if (!canUseFallback) {
        update({ busy: null });
        toast({ tone: 'error', title: 'Claude is not set up', body: CLAUDE_NOT_SET });
        return;
      }
      content = moonbootsFallback(topic);
    }

    const next = {};
    for (const platform of chosen) {
      if (!content?.[platform]) continue;
      const firstSlot = getNextTimeSlots(platform, 1, workspace)[0];
      next[platform] = {
        content: content[platform],
        image: null,
        imageLoading: generator.includeImages || platform === 'instagram',
        when: settings.autoSchedule && firstSlot ? slotWhen(firstSlot) : { mode: 'none' },
      };
    }
    update({ busy: null, drafts: next });

    if (Object.keys(next).length === 0) {
      toast({ tone: 'error', title: 'No posts came back', body: 'Try again, or change the topic.' });
      return;
    }
    // Instagram always needs an image
    await Promise.all(Object.keys(next).filter(p => next[p].imageLoading).map(p => makeImage(p, next[p].content)));
  };

  const discard = platform => setGenerator(prev => {
    const rest = { ...(prev.drafts || {}) };
    delete rest[platform];
    return { ...prev, drafts: Object.keys(rest).length ? rest : null };
  });

  const [adding, setAdding] = useState(null); // a platform, or 'all'

  // Save one draft on the server. Returns true when it was saved.
  const addOne = async (platform, { quiet = false } = {}) => {
    const draft = drafts[platform];
    if (!draft) return false;
    const at = draft.when?.mode !== 'none' && isValidDate(draft.when?.at) ? draft.when.at : null;
    try {
      await addDraft({ platform, content: draft.content, pillar: pillarName, image: draft.image, scheduledFor: at });
    } catch (error) {
      toast({ tone: 'error', title: `Could not save the ${PLATFORM_NAMES[platform]} post`, body: error.message });
      return false;
    }
    discard(platform);
    if (!quiet) {
      toast({
        tone: 'success',
        title: `${PLATFORM_NAMES[platform]} post added to approvals`,
        body: at ? `Planned for ${formatWhen(at)}.` : 'No time set, so it goes out once approved.',
        action: { label: 'Review approvals', onClick: () => navigate('schedule', 'approval') },
      });
    }
    return true;
  };

  const addSingle = async platform => {
    setAdding(platform);
    await addOne(platform);
    setAdding(null);
  };

  const addAll = async () => {
    const ready = draftPlatforms.filter(p => {
      const d = drafts[p];
      return d.content.trim() && !d.imageLoading && !(PLATFORM_LIMITS[p] && d.content.length > PLATFORM_LIMITS[p]);
    });
    setAdding('all');
    let saved = 0;
    for (const p of ready) {
      if (await addOne(p, { quiet: true })) saved += 1;
    }
    setAdding(null);
    if (saved) {
      toast({
        tone: 'success',
        title: `${saved} post${saved === 1 ? '' : 's'} added to approvals`,
        action: { label: 'Review approvals', onClick: () => navigate('schedule', 'approval') },
      });
    }
  };

  const placeholder = workspace?.slug === 'touchline'
    ? 'e.g. How an under 9s coach can plan a session around the four corners in ten minutes'
    : 'e.g. Why most AI strategies fail in the first year';

  return (
    <>
      <PageHeader title="Create" subtitle={`Write posts for ${workspace?.name || 'this workspace'}, check them, then send them for approval.`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-start">
        {/* ---------- Composer ---------- */}
        <Card className="p-5 space-y-6 lg:sticky lg:top-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="topic" className="text-xs font-medium text-muted">Topic or idea</label>
              <Button size="sm" variant="ghost" icon="sparkles" loading={busy === 'suggesting'} disabled={!!busy} onClick={suggestTopic}>
                Suggest one
              </Button>
            </div>
            <textarea
              id="topic"
              value={generator.topic}
              onChange={e => update({ topic: e.target.value })}
              placeholder={placeholder}
              rows={4}
              className={cx(inputClass, 'resize-none leading-relaxed')}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-muted mb-2">Content pillar</p>
            <div className="flex flex-wrap gap-1.5">
              {pillars.map(p => (
                <button
                  key={p.id}
                  onClick={() => update({ pillar: p.id })}
                  className={cx(
                    'px-3 h-8 rounded-full text-xs font-medium border transition',
                    generator.pillar === p.id ? 'bg-primary text-primary-ink border-primary' : 'border-line/70 text-muted hover:text-ink hover:border-line',
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted mb-2">Platforms</p>
            <div className="grid grid-cols-4 gap-2">
              {PLATFORMS.map(p => {
                const on = generator.platforms[p];
                return (
                  <button
                    key={p}
                    onClick={() => update(prev => ({ platforms: { ...prev.platforms, [p]: !prev.platforms[p] } }))}
                    aria-pressed={on}
                    className={cx(
                      'relative flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-medium transition',
                      on ? 'bg-accent/10 border-accent/50 text-ink' : 'border-line/60 text-faint hover:text-muted',
                    )}
                  >
                    <PlatformIcon platform={p} className="w-5 h-5" />
                    {PLATFORM_NAMES[p]}
                    {on && <Icon name="check" className="absolute top-1.5 right-1.5 w-3 h-3 text-accent" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Toggle
              checked={generator.includeImages}
              onChange={value => update({ includeImages: value })}
              label="Add a branded image"
              description="A quote card in your brand. Instagram always gets one."
            />
            {generator.includeImages && (
              <div className="flex flex-wrap gap-2">
                {themeKeys.map(key => {
                  const t = themes[key];
                  return (
                    <button
                      key={key}
                      onClick={() => update({ theme: key })}
                      title={t.name}
                      className={cx('flex items-center gap-2 h-8 pl-1 pr-3 rounded-full border text-xs transition', theme === key ? 'border-accent/60 text-ink' : 'border-line/60 text-muted hover:text-ink')}
                    >
                      <span className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center" style={{ background: t.radial ? `radial-gradient(circle at 50% 46%, ${t.gradient[0]}, ${t.gradient[1]})` : `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.accent }} />
                      </span>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button
            variant="primary"
            size="lg"
            icon="sparkles"
            className="w-full"
            loading={busy === 'writing'}
            disabled={!!busy || !generator.topic.trim() || chosen.length === 0}
            onClick={write}
          >
            {busy === 'writing' ? 'Writing your posts' : draftPlatforms.length ? 'Write them again' : 'Write posts'}
          </Button>
          {chosen.length === 0 && <p className="text-xs text-faint -mt-3 text-center">Choose at least one platform.</p>}
        </Card>

        {/* ---------- Drafts ---------- */}
        <div className="space-y-4 min-w-0">
          {busy === 'writing' && chosen.map(p => <DraftSkeleton key={p} platform={p} />)}

          {busy !== 'writing' && draftPlatforms.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {draftPlatforms.length} draft{draftPlatforms.length === 1 ? '' : 's'}. Check each one, then add it to approvals.
                </p>
                {draftPlatforms.length > 1 && <Button size="sm" icon="check" loading={adding === 'all'} disabled={!!adding} onClick={addAll}>Add all</Button>}
              </div>
              {draftPlatforms.map(p => (
                <DraftCard
                  key={p}
                  platform={p}
                  draft={drafts[p]}
                  workspace={workspace}
                  onChange={changes => updateDraft(p, changes)}
                  onImage={() => makeImage(p, drafts[p].content)}
                  onRemoveImage={() => updateDraft(p, { image: null })}
                  onAdd={() => addSingle(p)}
                  adding={adding === p}
                  onDiscard={() => discard(p)}
                />
              ))}
            </>
          )}

          {busy !== 'writing' && draftPlatforms.length === 0 && (
            <Card className="p-8 sm:p-10 border-dashed">
              <div className="max-w-md mx-auto text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-4">
                  <Icon name="sparkles" className="w-6 h-6" />
                </div>
                <p className="text-base font-medium text-ink">Your drafts appear here</p>
                <p className="text-sm text-muted mt-1.5">
                  Give Claude a topic and it writes a post for each platform, in the {workspace?.name || 'workspace'} voice.
                  You see how each one will look, can edit it, and choose when it goes out.
                </p>
                <div className="mt-6 grid gap-2 text-left">
                  {[
                    ['1', 'Write', 'Pick a topic and platforms.'],
                    ['2', 'Check', 'Preview, edit and fix any brand warnings.'],
                    ['3', 'Approve', 'Approved posts go to Publer at their time.'],
                  ].map(([n, title, body]) => (
                    <div key={n} className="flex items-center gap-3 p-3 rounded-xl bg-raised/40">
                      <span className="w-7 h-7 rounded-lg bg-surface border border-line/60 flex items-center justify-center text-xs font-semibold text-accent">{n}</span>
                      <span className="text-sm"><span className="text-ink font-medium">{title}.</span> <span className="text-muted">{body}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

