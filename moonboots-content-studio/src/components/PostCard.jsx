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
  if (item.group === 'published') return item.when ? `Published ${formatWhen(item.when)}` : 'Published';
  if (item.status === 'scheduled' || (item.origin === 'local' && item.group === 'upcoming' && item.status === 'published')) {
    return `Goes out ${formatWhen(item.scheduledFor)}`;
  }
  if (item.status === 'queued' && item.autoSchedule) return `Waiting to reach Publer, for ${formatWhen(item.scheduledFor)}`;
  if (item.scheduledFor) return `Planned for ${formatWhen(item.scheduledFor)}`;
  if (item.suggestedTime) return `Suggested: ${item.suggestedTime}`;
  return 'No time set';
};

export const EditPostModal = ({ item, workspaceSlug, onClose, onSave }) => {
  const [text, setText] = useState(item?.content || '');
  if (!item) return null;
  const limit = PLATFORM_LIMITS[item.platform];
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${PLATFORM_NAMES[item.platform] || ''} post`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!text.trim()} onClick={() => { onSave(text); onClose(); }}>Save changes</Button>
        </>
      )}
    >
      <textarea value={text} onChange={e => setText(e.target.value)} rows={12} className={cx(inputClass, 'resize-y leading-relaxed')} />
      <div className="flex justify-end mt-1.5">
        <span className={cx('text-xs', limit && text.length > limit ? 'text-red-300' : 'text-faint')}>{text.length}{limit ? ` / ${limit}` : ''}</span>
      </div>
      <BrandWarnings warnings={checkContent(workspaceSlug, text)} className="mt-3" />
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

  const actions = [];
  if (item.origin === 'local') {
    if (item.status === 'pending') {
      actions.push(<Button key="approve" size="sm" variant="primary" icon="check" loading={busy === 'approve'} onClick={() => run('approve', () => studio.approveLocal(item.id))}>Approve</Button>);
      actions.push(<Button key="edit" size="sm" icon="edit" onClick={() => setEditing(true)}>Edit</Button>);
      actions.push(<Button key="reject" size="sm" variant="ghost" icon="x" onClick={() => studio.rejectLocal(item.id)}>Reject</Button>);
    }
    if (item.status === 'approved') {
      if (item.error) actions.push(<Button key="retry" size="sm" variant="primary" icon="refresh" loading={busy === 'approve'} onClick={() => run('approve', () => studio.approveLocal(item.id))}>Try again</Button>);
      actions.push(<Button key="copy" size="sm" icon="copy" onClick={() => studio.copyText(item.content)}>Copy</Button>);
      actions.push(<Button key="edit" size="sm" icon="edit" onClick={() => setEditing(true)}>Edit</Button>);
      actions.push(<Button key="return" size="sm" variant="ghost" icon="undo" onClick={() => studio.returnLocal(item.id)}>Back to approvals</Button>);
    }
    if (item.status === 'published' || item.status === 'rejected') {
      actions.push(<Button key="copy" size="sm" icon="copy" onClick={() => studio.copyText(item.content)}>Copy</Button>);
      if (item.status === 'rejected') actions.push(<Button key="return" size="sm" variant="ghost" icon="undo" onClick={() => studio.returnLocal(item.id)}>Back to approvals</Button>);
    }
    if (item.status !== 'publishing') {
      actions.push(<Button key="delete" size="sm" variant="ghost" icon="trash" onClick={() => studio.deleteLocal(item.id)} aria-label="Delete" />);
    }
  } else {
    if (item.group === 'approval') {
      actions.push(<Button key="approve" size="sm" variant="primary" icon="check" loading={busy === 'approve'} onClick={() => run('approve', () => studio.serverAction(item, 'approve'))}>Approve & schedule</Button>);
    }
    if (item.status === 'failed' || (item.status === 'queued' && item.autoSchedule)) {
      actions.push(<Button key="retry" size="sm" variant={item.status === 'failed' ? 'primary' : 'secondary'} icon="refresh" loading={busy === 'retry'} onClick={() => run('retry', () => studio.serverAction(item, 'retry'))}>Try again</Button>);
    }
    if (['pending', 'queued', 'scheduled'].includes(item.status)) {
      actions.push(<Button key="cancel" size="sm" variant="ghost" icon="x" loading={busy === 'cancel'} onClick={() => run('cancel', () => studio.serverAction(item, 'cancel'))}>Cancel</Button>);
    }
    actions.push(<Button key="copy" size="sm" variant="ghost" icon="copy" onClick={() => studio.copyText(item.content)} aria-label="Copy" />);
  }

  return (
    <Card className={cx('p-4 sm:p-5', item.group === 'problems' && 'border-red-500/40')}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-raised flex items-center justify-center text-ink flex-shrink-0">
          <PlatformIcon platform={item.platform} className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-ink">{PLATFORM_NAMES[item.platform] || item.platform}</span>
            <StatusBadge status={item.status} item={item} />
            <Badge wrap tone={SOURCE_TONES[item.source.key]}>{item.source.key === 'marcus' ? item.source.detail : item.source.label}</Badge>
            {item.pillar && !compact && <Badge>{item.pillar}</Badge>}
          </div>
          <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
            <Icon name="clock" className="w-3.5 h-3.5" />
            {timeLine(item)}
          </p>
        </div>
        {item.image && (
          <button onClick={() => setViewImage(item.image)} className="flex-shrink-0">
            <img src={item.image} alt="Post image" className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-line/60" />
          </button>
        )}
      </div>

      {!compact && (
        <>
          <BrandWarnings warnings={item.warnings} className="mt-3" />
          <p className="mt-3 text-sm text-ink/90 whitespace-pre-wrap leading-relaxed break-words">{text}</p>
          {long && (
            <button onClick={() => setExpanded(!expanded)} className="mt-1 text-xs font-medium text-accent">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      )}
      {compact && <p className="mt-2 text-sm text-ink/90 line-clamp-2 break-words">{item.content}</p>}

      {item.error && (
        <p className="mt-3 flex gap-2 text-xs text-red-300">
          <Icon name="alert" className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
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
        <EditPostModal item={item} workspaceSlug={studio.workspace?.slug} onClose={() => setEditing(false)} onSave={content => studio.editLocal(item.id, content)} />
      )}
      <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />
    </Card>
  );
};
