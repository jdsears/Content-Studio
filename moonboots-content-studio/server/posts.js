import crypto from 'crypto';
import * as publer from './publer.js';
import { PublerError } from './publer.js';
import { nextPostingSlot, parseUkDateTime } from './schedule.js';
import { prepareForPublishing } from '../shared/brand.js';

// ============ SERVER-SIDE POSTS (Marcus and other API posts) ============
//
// Status flow for posts that schedule themselves (Marcus):
//   queued     saved here, not yet accepted by Publer (retried every few minutes)
//   scheduled  Publer accepted it for its posting time
//   published  Publer reports it live (publishedAt, postUrl)
//   failed     Publer refused it, or it was never confirmed live
//   cancelled  cancelled in Content Studio (and deleted from Publer)
// API posts that need approval in Content Studio start as "pending".

export const PLATFORMS = ['linkedin', 'facebook', 'instagram', 'x'];

const COLLECTION = 'posts';
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const CHECK_EVERY_MS = 2 * MINUTE;
const RETRY_EVERY_MS = 5 * MINUTE;
const GIVE_UP_AFTER_MS = 24 * HOUR;
const LINK_WAIT_MS = 6 * HOUR;

const DEDUPE_MS = 15 * MINUTE;
const STALE_SEND_MS = 2 * MINUTE;
const MAX_PAGES = 5;

// Problems that retrying will not fix
const PERMANENT_ERRORS = new Set(['job_failed', 'publer_error']);

// Failures where Publer may already have the post, so "Try again" asks first
const MAYBE_IN_PUBLER = new Set(['timeout', 'restarted', 'unconfirmed']);

export class PostError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const nowIso = () => new Date().toISOString();
const isoShift = (iso, ms) => new Date(new Date(iso).getTime() + ms).toISOString();

export function newPostId() {
  return 'post_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

// What Touchline HQ sees. Fields are only ever added, never renamed or removed.
export function toApiPost(p) {
  return {
    id: p.id,
    platform: p.platform,
    content: p.content,
    pillar: p.pillar || null,
    status: p.status,
    source: p.source || null,
    publishedAt: p.published_at || null,
    scheduledFor: p.scheduled_for || null,
    image: p.image ? `/api/posts/${p.id}/image` : null,
    metrics: p.metrics || { likes: 0, comments: 0, shares: 0 },
    error: p.error || null,
    createdAt: p.created_at,
    platformPostId: p.publer_post_id || null,
    postUrl: p.post_url || null,
  };
}

export function createPostService({ store, getWorkspaceById, getWorkspaceSecrets, makeImage }) {
  async function get(id) {
    return store.get(COLLECTION, id);
  }

  async function save(post) {
    const saved = { ...post, updated_at: nowIso() };
    await store.set(COLLECTION, saved.id, saved);
    return saved;
  }

  // Apply changes to the stored post, but only if its status is still one we expect.
  // This stops a slow Publer call from undoing a cancel made in the meantime.
  async function update(postId, expectedStatuses, changes) {
    const current = await get(postId);
    if (!current) return null;
    if (expectedStatuses && !expectedStatuses.includes(current.status)) return current;
    return save({ ...current, ...changes });
  }

  async function remove(id) {
    await store.remove(COLLECTION, id);
  }

  async function list({ workspaceId, status, source, platform, limit } = {}) {
    let posts = await store.list(COLLECTION);
    if (workspaceId) posts = posts.filter(p => p.workspace_id === workspaceId);
    if (status) posts = posts.filter(p => p.status === status);
    if (source) posts = posts.filter(p => p.source === source);
    if (platform) posts = posts.filter(p => p.platform === platform);
    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return limit ? posts.slice(0, limit) : posts;
  }

  async function getForWorkspace(workspaceId, postId) {
    const post = await get(postId);
    if (!post || post.workspace_id !== workspaceId) throw new PostError('Post not found', 404);
    return post;
  }

  // Slots handed out in the last few minutes, so two posts arriving together don't share one
  const reservedSlots = new Map();

  // Next free slot from the workspace's posting times (UK time), skipping slots already used
  async function nextSlotFor(workspace, platform) {
    const key = `${workspace.id}:${platform}`;
    const now = Date.now();
    const reserved = reservedSlots.get(key) || new Map();
    for (const [iso, until] of reserved) if (until < now) reserved.delete(iso);

    const posts = await list({ workspaceId: workspace.id, platform });
    const taken = posts
      .filter(p => p.scheduled_for && (p.status === 'scheduled' || (p.status === 'queued' && p.auto_schedule)))
      .map(p => p.scheduled_for);
    const slot = nextPostingSlot(workspace.brand_config?.posting_frequency?.[platform], { taken: [...taken, ...reserved.keys()] })
      || new Date(now + 15 * MINUTE);

    reserved.set(slot.toISOString(), now + 10 * MINUTE);
    reservedSlots.set(key, reserved);
    return slot;
  }

  // ---------- Publer ----------

  async function publerContext(workspace) {
    const secrets = await getWorkspaceSecrets(workspace.id);
    if (!secrets.publer_api_key) {
      throw new PublerError(`No Publer API key saved for ${workspace.name}. Paste one in Settings.`, { status: 400, code: 'no_key' });
    }
    const publerWorkspaceId = await publer.getPublerWorkspaceId(secrets.publer_api_key);
    return { apiKey: secrets.publer_api_key, publerWorkspaceId, platformAccounts: secrets.platform_accounts || {} };
  }

  function searchWindow(iso) {
    return { from: isoShift(iso, -24 * HOUR), to: isoShift(iso, 24 * HOUR) };
  }

  // Publer ids already linked to other posts, so a lookup never takes another post's id
  async function usedPublerIds(post) {
    const posts = await list({ workspaceId: post.workspace_id });
    return new Set(posts.filter(p => p.id !== post.id && p.publer_post_id).map(p => String(p.publer_post_id)));
  }

  // Find this post among Publer's posts in one state, reading a few pages
  async function findInPubler(ctx, post, state) {
    const around = post.scheduled_for || post.created_at;
    const excludeIds = await usedPublerIds(post);
    const seen = new Set();
    for (let page = 0; page < MAX_PAGES; page++) {
      const posts = await publer.listPosts(ctx.apiKey, ctx.publerWorkspaceId, {
        state, accountId: post.publer_account_id, ...searchWindow(around), page,
      });
      const fresh = posts.filter(p => !seen.has(String(p.id)));
      if (!fresh.length) break;
      fresh.forEach(p => seen.add(String(p.id)));
      const match = publer.findMatchingPost(fresh, {
        publerPostId: post.publer_post_id,
        text: post.published_text || post.content,
        accountId: post.publer_account_id,
        around,
        excludeIds,
      });
      if (match) return match;
    }
    return null;
  }

  async function withdrawFromPubler(post, ctx) {
    try {
      const match = post.publer_post_id ? { id: post.publer_post_id } : await findInPubler(ctx, post, 'scheduled');
      if (!match?.id) throw new Error('not found in Publer');
      await publer.deletePosts(ctx.apiKey, ctx.publerWorkspaceId, [String(match.id)]);
      return update(post.id, ['cancelled'], { publer_post_id: String(match.id) });
    } catch (error) {
      console.error(`[posts] ${post.id} was cancelled while being scheduled and could not be removed from Publer:`, error.message);
      return update(post.id, ['cancelled'], { error: 'Cancelled while it was being sent to Publer. Check Publer and delete it there if it is still scheduled.' });
    }
  }

  async function recordFailure(post, attempt, error) {
    const tooOld = Date.now() - new Date(post.retry_from || post.created_at).getTime() > GIVE_UP_AFTER_MS;
    const failed = PERMANENT_ERRORS.has(error.code) || MAYBE_IN_PUBLER.has(error.code) || tooOld || error instanceof PostError;
    console.error(`[posts] ${post.id} not scheduled (${failed ? 'failed' : 'will retry'}):`, error.message);
    return update(post.id, ['queued'], {
      ...attempt,
      status: failed ? 'failed' : 'queued',
      error: error.code === 'timeout'
        ? "Publer didn't answer in time, so it may or may not have this post. Check Publer before trying again."
        : error.message,
      error_code: error.code || null,
      sending_since: null,
    });
  }

  // Posts being sent right now (one server, so memory is enough)
  const inFlight = new Set();

  // Hand a queued post to Publer. Works from the stored copy, and never sends a post twice.
  async function submit(postId) {
    if (inFlight.has(postId)) return get(postId);
    inFlight.add(postId);
    try {
      return await submitNow(postId);
    } finally {
      inFlight.delete(postId);
    }
  }

  async function submitNow(postId) {
    const post = await get(postId);
    if (!post || post.status !== 'queued') return post;
    const attempt = { attempts: (post.attempts || 0) + 1, last_attempt_at: nowIso() };

    // Get everything ready. Nothing has reached Publer yet, so failures here can be retried.
    let ctx, accountId, mediaId, text;
    try {
      const workspace = await getWorkspaceById(post.workspace_id);
      if (!workspace) throw new PostError('Workspace not found', 404);
      if (typeof post.content !== 'string' || !post.content.trim()) throw new PostError('This post has no text.');
      ctx = await publerContext(workspace);
      accountId = await publer.resolveAccountId(ctx.apiKey, ctx.publerWorkspaceId, post.platform, ctx.platformAccounts[post.platform]);
      mediaId = await publer.uploadMedia(ctx.apiKey, ctx.publerWorkspaceId, post.image);
      text = prepareForPublishing(workspace, post);
    } catch (error) {
      return recordFailure(post, attempt, error);
    }

    // Mark it as on its way, so a restart part way through can't send it twice
    const marked = await update(post.id, ['queued'], { ...attempt, sending_since: nowIso() });
    if (marked?.status !== 'queued') return marked;

    let sent;
    try {
      sent = await publer.schedulePost(ctx.apiKey, ctx.publerWorkspaceId, {
        accountId, platform: post.platform, text, mediaId, scheduledAt: post.scheduled_for,
      });
    } catch (error) {
      return recordFailure(post, attempt, error);
    }

    // Publer has it. Record that straight away; if it was cancelled meanwhile, take it back out.
    const latest = await get(post.id);
    const accepted = {
      scheduled_for: sent.scheduledAt,
      publer_job_id: sent.jobId,
      publer_account_id: accountId,
      published_text: text,
      sending_since: null,
    };
    if (latest?.status === 'cancelled') {
      const cancelled = await update(post.id, ['cancelled'], accepted);
      return withdrawFromPubler(cancelled, ctx);
    }
    let current = await update(post.id, ['queued'], { ...accepted, status: 'scheduled', error: null, error_code: null });
    if (current?.status !== 'scheduled') return current;
    console.log(`[posts] ${post.id} scheduled in Publer for ${sent.scheduledAt}`);

    // Confirm it. Publer reports account problems as job "failures".
    let job;
    try {
      job = await publer.waitForJob(ctx.apiKey, ctx.publerWorkspaceId, sent.jobId);
    } catch (error) {
      job = { done: false, error: error.message };
    }
    if (job.failed) {
      return update(post.id, ['scheduled'], { status: 'failed', error: job.error, error_code: 'job_failed' });
    }

    // Publer's job gives no post id, so look the post up (checked again later if not found)
    try {
      const match = await findInPubler(ctx, current, 'scheduled');
      if (match?.id) current = await update(post.id, ['scheduled'], { publer_post_id: String(match.id) });
    } catch (error) {
      console.error(`[posts] Could not look up Publer post for ${post.id}:`, error.message);
    }
    return current;
  }

  // Ask Publer whether a scheduled post has gone live, and fetch its link
  async function checkLive(postId) {
    const post = await get(postId);
    if (!post || !['scheduled', 'published'].includes(post.status)) return post;
    const workspace = await getWorkspaceById(post.workspace_id);
    if (!workspace) return post;

    const checked = { last_checked_at: nowIso() };
    const overdue = post.status === 'scheduled' && Date.now() - new Date(post.scheduled_for).getTime() > GIVE_UP_AFTER_MS;
    const giveUp = () => update(post.id, ['scheduled'], {
      ...checked,
      status: 'failed',
      error_code: 'unconfirmed',
      error: 'Publer has not confirmed this post went live after 24 hours. Check it in Publer.',
    });

    try {
      const ctx = await publerContext(workspace);
      for (const state of ['published', 'published_posted']) {
        const match = await findInPubler(ctx, post, state);
        if (match) {
          return update(post.id, ['scheduled', 'published'], {
            ...checked,
            status: 'published',
            published_at: post.published_at || match.published_at || match.scheduled_at || post.scheduled_for,
            post_url: match.post_link || post.post_url || null,
            publer_post_id: String(match.id),
            error: null,
            error_code: null,
          });
        }
      }
      if (post.status === 'scheduled') {
        const failedMatch = await findInPubler(ctx, post, 'failed');
        if (failedMatch) {
          return update(post.id, ['scheduled'], {
            ...checked,
            status: 'failed',
            publer_post_id: String(failedMatch.id),
            error: failedMatch.error || 'Publer could not publish this post. Check it in Publer.',
            error_code: 'job_failed',
          });
        }
      }
    } catch (error) {
      if (overdue) return giveUp();
      return update(post.id, null, { ...checked, error: error.message });
    }

    if (overdue) return giveUp();
    return update(post.id, null, { ...checked, error: null });
  }

  // ---------- Actions ----------

  // A post from Touchline HQ: already approved there, so it schedules itself
  async function createScheduledPost(workspace, input) {
    const { platform, content, pillar, generateImage = false, imageStyle, scheduleFor, source } = input || {};

    if (!PLATFORMS.includes(platform)) {
      throw new PostError(`platform must be one of: ${PLATFORMS.join(', ')}`);
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new PostError('content is required');
    }

    // The same post sent again within a few minutes (e.g. a retried request) is not posted twice
    const requested = scheduleFor ? String(scheduleFor) : null;
    const duplicate = (await list({ workspaceId: workspace.id, platform })).find(p =>
      p.auto_schedule
      && p.content === content
      && (p.source || 'api') === (source || 'api')
      && (p.requested_schedule || null) === requested
      && !['cancelled', 'failed'].includes(p.status)
      && Date.now() - new Date(p.created_at).getTime() < DEDUPE_MS);
    if (duplicate) return duplicate;

    let scheduledFor;
    if (scheduleFor) {
      const when = parseUkDateTime(scheduleFor);
      if (Number.isNaN(when.getTime())) {
        throw new PostError('scheduleFor must be a date and time, for example 2026-10-12T08:00:00Z');
      }
      scheduledFor = when;
    } else {
      scheduledFor = await nextSlotFor(workspace, platform);
    }

    let post = {
      id: newPostId(),
      workspace_id: workspace.id,
      platform,
      content,
      pillar: pillar || null,
      image: null,
      image_style: imageStyle || null,
      source: source || 'api',
      auto_schedule: true,
      status: 'queued',
      scheduled_for: scheduledFor.toISOString(),
      requested_schedule: requested,
      created_at: nowIso(),
    };

    if (generateImage && makeImage) {
      try {
        post.image = await makeImage(workspace, post);
      } catch (error) {
        console.error(`[posts] Image card failed for ${post.id}:`, error.message);
        post.image_error = error.message;
      }
    }

    post = await save(post);
    console.log(`[posts] ${post.id} received from ${post.source} for ${workspace.name} on ${platform}`);
    return submit(post.id);
  }

  // A post saved for approval in Content Studio (v1 API)
  async function createDraft(workspace, fields) {
    return save({
      id: newPostId(),
      workspace_id: workspace.id,
      auto_schedule: false,
      created_at: nowIso(),
      ...fields,
    });
  }

  async function approve(workspace, postId) {
    const post = await getForWorkspace(workspace.id, postId);
    if (!['pending', 'queued'].includes(post.status) || post.auto_schedule) {
      throw new PostError(`This post is already ${post.status === 'queued' ? 'on its way to Publer' : post.status}.`);
    }
    const scheduledFor = post.scheduled_for && new Date(post.scheduled_for) > new Date()
      ? post.scheduled_for
      : (await nextSlotFor(workspace, post.platform)).toISOString();
    await update(post.id, ['pending', 'queued'], {
      auto_schedule: true, status: 'queued', scheduled_for: scheduledFor, retry_from: nowIso(),
    });
    return submit(post.id);
  }

  async function retry(workspace, postId, { force = false } = {}) {
    const post = await getForWorkspace(workspace.id, postId);
    if (!['queued', 'failed'].includes(post.status)) throw new PostError(`This post is ${post.status}, so there is nothing to retry.`);
    if (inFlight.has(post.id)) throw new PostError('This post is being sent to Publer right now.', 409);
    if (MAYBE_IN_PUBLER.has(post.error_code) && !force) {
      throw new PostError('Publer may already have this post. Check Publer first; if it is not there, send it again.', 409);
    }

    // Remove the earlier copy from Publer if it is still there
    if (post.publer_post_id) {
      try {
        const ctx = await publerContext(workspace);
        await publer.deletePosts(ctx.apiKey, ctx.publerWorkspaceId, [String(post.publer_post_id)]);
      } catch (error) {
        console.error(`[posts] Could not remove the earlier Publer copy of ${post.id}:`, error.message);
      }
    }

    const scheduledFor = new Date(post.scheduled_for) > new Date() ? post.scheduled_for : new Date(Date.now() + 5 * MINUTE).toISOString();
    await update(post.id, ['queued', 'failed'], {
      auto_schedule: true,
      status: 'queued',
      scheduled_for: scheduledFor,
      retry_from: nowIso(),
      publer_post_id: null,
      publer_job_id: null,
      sending_since: null,
      error: null,
      error_code: null,
    });
    return submit(post.id);
  }

  // Cancel a post. A scheduled post is deleted from Publer first so it can't go out.
  // `force` marks it cancelled here when it can't be found in Publer (already deleted there).
  async function cancel(workspace, postId, { force = false } = {}) {
    const post = await getForWorkspace(workspace.id, postId);
    if (['published', 'cancelled'].includes(post.status)) throw new PostError(`This post is already ${post.status}.`);

    if (post.status === 'scheduled' && !force) {
      const ctx = await publerContext(workspace);
      const match = post.publer_post_id ? { id: post.publer_post_id } : await findInPubler(ctx, post, 'scheduled');
      if (!match?.id) {
        throw new PostError("Couldn't find this post in Publer, so it may still go out. Delete it in Publer, then mark it cancelled here.", 409);
      }
      await publer.deletePosts(ctx.apiKey, ctx.publerWorkspaceId, [String(match.id)]);
    }

    // A post on its way to Publer right now is taken back out by submit() once Publer has it
    return update(post.id, null, { status: 'cancelled', cancelled_at: nowIso(), error: null });
  }

  // ---------- Background checks ----------

  let running = false;
  async function runChecks() {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const since = iso => (iso ? now - new Date(iso).getTime() : Infinity);
      for (const post of await list()) {
        if (inFlight.has(post.id)) continue;
        try {
          if (post.status === 'queued' && post.auto_schedule && post.sending_since && since(post.sending_since) >= STALE_SEND_MS) {
            // The server stopped while sending this post, so Publer may or may not have it
            await update(post.id, ['queued'], {
              status: 'failed',
              sending_since: null,
              error_code: 'restarted',
              error: 'Content Studio restarted while sending this post. Check Publer, then send it again if it is not there.',
            });
          } else if (post.status === 'queued' && post.auto_schedule && !post.sending_since && since(post.last_attempt_at) >= RETRY_EVERY_MS) {
            await submit(post.id);
          } else if (post.status === 'scheduled' && new Date(post.scheduled_for).getTime() <= now - MINUTE && since(post.last_checked_at) >= RETRY_EVERY_MS) {
            await checkLive(post.id);
          } else if (post.status === 'published' && !post.post_url && since(post.published_at) <= LINK_WAIT_MS && since(post.last_checked_at) >= 2 * RETRY_EVERY_MS) {
            await checkLive(post.id);
          }
        } catch (error) {
          console.error(`[posts] Check failed for ${post.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[posts] Scheduler run failed:', error.message);
    } finally {
      running = false;
    }
  }

  function startScheduler() {
    setTimeout(runChecks, 10 * 1000).unref();
    setInterval(runChecks, CHECK_EVERY_MS).unref();
  }

  return {
    get, save, update, remove, list, getForWorkspace, nextSlotFor,
    createScheduledPost, createDraft, approve, retry, cancel,
    submit, checkLive, runChecks, startScheduler,
  };
}
