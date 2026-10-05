import { checkContent } from '../../shared/brand.js';
import { isValidDate } from './schedule.js';

// One view of every post: drafts made in this browser ("local") and posts from
// Touchline HQ or the API, which live on the server ("server").

const sourceOf = (post) => {
  if (post.source === 'marcus-cmo') return { key: 'marcus', label: 'Marcus', detail: 'From Marcus · approved in Touchline HQ' };
  if (post.source) return { key: 'api', label: 'API', detail: `From ${post.source}` };
  return { key: 'api', label: 'API', detail: 'From the API' };
};

// Which list a post belongs in
const groupOf = (item) => {
  const now = Date.now();
  if (item.origin === 'local') {
    if (item.status === 'pending') return 'approval';
    if (item.status === 'rejected') return 'other';
    if (item.error && item.status === 'approved') return 'problems';
    if (item.status === 'published' || item.status === 'publishing') {
      return isValidDate(item.scheduledFor) && new Date(item.scheduledFor).getTime() > now ? 'upcoming' : 'published';
    }
    return 'upcoming'; // approved, waiting to be posted
  }
  if (item.status === 'pending' || (item.status === 'queued' && !item.autoSchedule)) return 'approval';
  if (item.status === 'scheduled' || item.status === 'queued') return 'upcoming';
  if (item.status === 'published') return 'published';
  if (item.status === 'failed') return 'problems';
  return 'other';
};

export const combinePosts = (localPosts, serverPosts, workspaceSlug) => {
  const items = [
    ...localPosts.map(p => ({
      key: `local-${p.id}`,
      origin: 'local',
      id: p.id,
      platform: p.platform,
      content: p.content || '',
      pillar: p.pillar || null,
      image: p.image || null,
      status: p.status,
      scheduledFor: isValidDate(p.scheduledFor) ? p.scheduledFor : null,
      suggestedTime: p.suggestedTime || null,
      publishedAt: p.publishedAt || null,
      createdAt: p.createdAt || null,
      error: p.error || null,
      source: { key: 'you', label: 'You', detail: 'Made in Content Studio' },
      warnings: checkContent(workspaceSlug, p.content),
      raw: p,
    })),
    ...serverPosts.map(p => ({
      key: `server-${p.id}`,
      origin: 'server',
      id: p.id,
      platform: p.platform,
      content: p.content || '',
      pillar: p.pillar || null,
      image: p.image || null,
      status: p.status,
      scheduledFor: p.scheduledFor || null,
      publishedAt: p.publishedAt || null,
      createdAt: p.createdAt || null,
      error: p.error || null,
      postUrl: p.postUrl || null,
      autoSchedule: p.autoSchedule,
      imageError: p.imageError || null,
      source: sourceOf(p),
      warnings: p.warnings || [],
      raw: p,
    })),
  ];
  for (const item of items) {
    item.group = groupOf(item);
    item.when = item.group === 'published' ? (item.publishedAt || item.scheduledFor) : item.scheduledFor;
  }
  return items;
};

export const byWhen = (a, b) => {
  const ta = isValidDate(a.when) ? new Date(a.when).getTime() : Infinity;
  const tb = isValidDate(b.when) ? new Date(b.when).getTime() : Infinity;
  return ta - tb;
};

export const PLATFORM_NAMES = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', x: 'X' };
export const PLATFORM_LIMITS = { linkedin: 3000, facebook: 63206, instagram: 2200, x: 280 };
