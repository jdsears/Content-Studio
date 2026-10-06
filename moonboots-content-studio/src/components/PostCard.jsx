import React, { useState } from 'react';
import { checkContent } from '../../shared/brand.js';
import { Icon, PlatformIcon } from './icons.jsx';
import { Badge, BrandWarnings, Button, Card, ImageViewer, Modal, StatusBadge, cx, inputClass } from './ui.jsx';
import { formatWhen } from '../lib/schedule.js';
import { PLATFORM_NAMES, PLATFORM_LIMITS } from '../lib/posts.js';
import { useStudio } from '../studio.jsx';

const SOURCE_TONES = { marcus: 'accent', api: 'blue', you: 'neutral' };

// When, in words, for a post's current state
const timeLine = (item) => {
  const at = item.scheduledFor ? formatWhen(item.scheduledFor) : null;
  switch (item.status) {
    case 'published': return item.when ? `Published ${formatWhen(item.when)}` : 'Published';
    case 'scheduled': return `Goes out ${at}`;
    case 'queued': return item.autoSchedule ? `Waiting to reach Publer, for ${at}` : at ? `Planned for ${at}` : 'No time set';
    case 'approved': return at ? `Post it by hand, ${at}` : 'Post it by hand when you are ready';
    case 'pending':
      if (at) return `Planned for ${at}`;
      return item.source.key === 'you' ? 'Goes out straight away once approved' : 'Gets the next free slot once approved';
    case 'failed': return at ? `Was due ${at}` : 'Not sent';
    default: return at ? `Was planned for ${at}` : '';
  }
};

// "2026-10-06T08:00" for a datetime-local input, in this browser's time
const toLocalInput = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const EditPostModal = ({ item, workspaceSlug, onClose, onSave }) => {
  const [text, setText] = useState(item?.content || '');
  const [when, setWhen] = useState(toLocalInput(item?.scheduledFor));
  const [dropImage, setDropImage] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!item) return null;
  const limit = PLATFORM_LIMITS[item.platform];

  const save = async () => {
    const changes = {};
    if (text !== item.content) changes.content = text;
    const newWhen = when ? new Date(when).toISOString() : null;
    if ((newWhen || null) !== (item.scheduledFor || null)) changes.scheduledFor = newWhen;
    if (dropImage) changes.image = null;
    if (Object.keys(changes).length) {
      setSaving(true);
      await onSave(changes);
      setSaving(false);
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${PLATFORM_NAMES[item.platform] || ''} post`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!text.trim() || (limit && text.length > limit)} onClick={save}>Save changes</Button>
        </>
      )}
    >
      <textarea value={text} onChange={e => setText(e.target.value)} rows={12} className={cx(inputClass, 'resize-y leading-relaxed')} />
      <div className="flex justify-end mt-1.5">
        <span className={cx('text-xs', limit && text.length > limit ? 'text-red-300' : 'text-faint')}>{text.length}{limit ? ` / ${limit}` : ''}</span>
      </div>
      <BrandWarnings warnings={checkContent(workspaceSlug, text)} className="mt-3" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-medium text-muted mb-1.5">When</span>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={inputClass} />
          <span className="block text-[11px] text-faint mt-1">Leave empty to send it as soon as it is approved.</span>
        </label>
        {item.image && (
          <div>
            <span className="block text-xs font-medium text-muted mb-1.5">Image</span>
            <div className="flex items-center gap-3">
              <img src={item.image} alt="" className={cx('w-14 h-14 rounded-lg object-cover border border-line/60', dropImage && 'opacity-30')} />
              <Button size="sm" variant="ghost" icon={dropImage ? 'undo' : 'trash'} onClick={() => setDropImage(!dropImage)}>
                {dropImage ? 'Keep image' : 'Remove image'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export const PostCard = ({ item, compact = false }) => {
  const studio = useStudio();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [busy, setBusy] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const long = item.content.length > 280;
  const text = expanded || !long ? item.content : `${item.content.slice(0, 280).trimEnd()}...`;

  const approve = <Button key="approve" size="sm" variant="primary" icon="check" loading={busy === 'approve'} onClick={() => run('approve', () => studio.serverAction(item, 'approve'))}>Approve</Button>;
  const edit = <Button key="edit" size="sm" icon="edit" onClick={() => setEditing(true)}>Edit</Button>;
  const copy = <Button key="copy" size="sm" icon="copy" onClick={() => studio.copyText(item.content)}>Copy</Button>;
  const reopen = <Button key="reopen" size="sm" variant="ghost" icon="undo" loading={busy === 'reopen'} onClick={() => run('reopen', () => studio.serverAction(item, 'reopen'))}>Back to approvals</Button>;
  const cancel = <Button key="cancel" size="sm" variant="ghost" icon="x" loading={busy === 'cancel'} onClick={() => run('cancel', () => studio.serverAction(item, 'cancel'))}>Cancel</Button>;
  const remove = <Button key="delete" size="sm" variant="ghost" icon="trash" onClick={() => studio.deletePost(item)} aria-label="Delete" />;

  const actions = {
    pending: [approve, edit, <Button key="reject" size="sm" variant="ghost" icon="x" loading={busy === 'reject'} onClick={() => run('reject', () => studio.serverAction(item, 'reject'))}>Reject</Button>, remove],
    approved: [
      copy,
      <Button key="posted" size="sm" variant="primary" icon="check" loading={busy === 'posted'} onClick={() => run('posted', () => studio.serverAction(item, 'mark-posted'))}>Mark as posted</Button>,
      edit, reopen, remove,
    ],
    rejected: [copy, reopen, remove],
    queued: item.autoSchedule
      ? [<Button key="retry" size="sm" icon="refresh" loading={busy === 'retry'} onClick={() => run('retry', () => studio.serverAction(item, 'retry'))}>Try again</Button>, cancel]
      : [approve, edit, cancel],
    scheduled: [copy, cancel],
    failed: [<Button key="retry" size="sm" variant="primary" icon="refresh" loading={busy === 'retry'} onClick={() => run('retry', () => studio.serverAction(item, 'retry'))}>Try again</Button>, copy, cancel, remove],
    published: [copy],
    cancelled: [copy, remove],
  }[item.status] || [copy];

  return (
    <Card className={cx('p-4 sm:p-5', item.group === 'problems' && 'border-red-500/40')}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-raised flex items-center justify-center text-ink shrink-0">
          <PlatformIcon platform={item.platform} className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-ink">{PLATFORM_NAMES[item.platform] || item.platform}</span>
            <StatusBadge status={item.status} />
            <Badge wrap tone={SOURCE_TONES[item.source.key]}>{item.source.key === 'marcus' ? item.source.detail : item.source.label}</Badge>
            {item.pillar && !compact && <Badge>{item.pillar}</Badge>}
          </div>
          <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
            <Icon name="clock" className="w-3.5 h-3.5" />
            {timeLine(item)}
          </p>
        </div>
        {item.image && (
          <button onClick={() => setViewImage(item.image)} className="shrink-0">
            <img src={item.image} alt="Post image" className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-line/60" />
          </button>
        )}
      </div>

      {!compact && (
        <>
          <BrandWarnings warnings={item.warnings} className="mt-3" />
          <p className="mt-3 text-sm text-ink/90 whitespace-pre-wrap leading-relaxed wrap-break-word">{text}</p>
          {long && (
            <button onClick={() => setExpanded(!expanded)} className="mt-1 text-xs font-medium text-accent">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      )}
      {compact && <p className="mt-2 text-sm text-ink/90 line-clamp-2 wrap-break-word">{item.content}</p>}

      {item.error && (
        <p className="mt-3 flex gap-2 text-xs text-red-300">
          <Icon name="alert" className="w-3.5 h-3.5 shrink-0 mt-px" />
          {item.error}
        </p>
      )}
      {item.imageError && <p className="mt-2 text-xs text-faint">Image card could not be made: {item.imageError}</p>}
      {item.postUrl && (
        <a href={item.postUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          <Icon name="link" className="w-3.5 h-3.5" /> View the live post
        </a>
      )}

      {!compact && actions.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}

      {editing && (
        <EditPostModal
          item={item}
          workspaceSlug={studio.workspace?.slug}
          onClose={() => setEditing(false)}
          onSave={changes => studio.editPost(item, changes)}
        />
      )}
      <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />
    </Card>
  );
};
