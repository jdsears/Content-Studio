import { isValidDate } from './schedule.js';

// Every post for a workspace comes from the server: drafts written here,
// posts from Touchline HQ (Marcus) and posts sent through the API.

const sourceOf = (post) => {
  if (post.source === 'studio') return { key: 'you', label: 'You', detail: 'Written in Content Studio' };
  if (post.source === 'marcus-cmo') return { key: 'marcus', label: 'Marcus', detail: 'From Marcus · approved in Touchline HQ' };
  if (post.source) return { key: 'api', label: 'API', detail: `From ${post.source}` };
  return { key: 'api', label: 'API', detail: 'From the API' };
};

// Which list a post belongs in
const groupOf = (post) => {
  switch (post.status) {
    case 'pending': return 'approval';
    case 'queued': return post.autoSchedule ? 'upcoming' : 'approval';
    case 'approved': return 'upcoming'; // approved, to post by hand
    case 'scheduled': return 'upcoming';
    case 'published': return 'published';
    case 'failed': return 'problems';
    default: return 'other'; // rejected, cancelled
  }
};

export const toItem = (p) => {
  const item = {
    key: `post-${p.id}`,
    id: p.id,
    platform: p.platform,
    content: p.content || '',
    pillar: p.pillar || null,
    image: p.image || null,
    status: p.status,
    scheduledFor: isValidDate(p.scheduledFor) ? p.scheduledFor : null,
    publishedAt: p.publishedAt || null,
    createdAt: p.createdAt || null,
    error: p.error || null,
    postUrl: p.postUrl || null,
    autoSchedule: !!p.autoSchedule,
    manual: !!p.manual,
    imageError: p.imageError || null,
    source: sourceOf(p),
    warnings: p.warnings || [],
    raw: p,
  };
  item.group = groupOf(item);
  item.when = item.group === 'published' ? (item.publishedAt || item.scheduledFor) : item.scheduledFor;
  return item;
};

export const toItems = (posts) => posts.map(toItem);

export const byWhen = (a, b) => {
  const ta = isValidDate(a.when) ? new Date(a.when).getTime() : Infinity;
  const tb = isValidDate(b.when) ? new Date(b.when).getTime() : Infinity;
  return ta - tb;
};

// Drafts that used to be kept in this browser, in the shape the server takes them
export const browserDraftToServer = (p) => {
  const future = isValidDate(p.scheduledFor) && new Date(p.scheduledFor).getTime() > Date.now();
  const status = {
    pending: 'pending',
    publishing: 'pending', // interrupted part way, so it goes back for approval
    approved: 'approved',
    rejected: 'rejected',
    published: future ? 'scheduled' : 'published', // sent to Publer for later, or already out
  }[p.status] || 'pending';
  return {
    localId: p.id,
    platform: p.platform,
    content: p.content,
    pillar: p.pillar || null,
    image: p.image || null,
    scheduledFor: isValidDate(p.scheduledFor) ? p.scheduledFor : null,
    status,
    createdAt: p.createdAt || null,
    publishedAt: p.publishedAt || null,
  };
};

export const PLATFORM_NAMES = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', x: 'X' };
export const PLATFORM_LIMITS = { linkedin: 3000, facebook: 63206, instagram: 2200, x: 280 };
