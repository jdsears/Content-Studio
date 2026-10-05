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

// Problems that retrying will not fix
const PERMANENT_ERRORS = new Set(['job_failed', 'publer_error']);

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

  // Next free slot from the workspace's posting times (UK time), skipping slots already used
  async function nextSlotFor(workspace, platform) {
    const posts = await list({ workspaceId: workspace.id, platform });
    const taken = posts.filter(p => ['queued', 'scheduled'].includes(p.status) && p.scheduled_for).map(p => p.scheduled_for);
    const slot = nextPostingSlot(workspace.brand_config?.posting_frequency?.[platform], { taken });
    return slot || new Date(Date.now() + 15 * MINUTE);
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

  async function sendToPubler(post) {
    const workspace = await getWorkspaceById(post.workspace_id);
    if (!workspace) throw new PostError('Workspace not found', 404);
    const { apiKey, publerWorkspaceId, platformAccounts } = await publerContext(workspace);

    const accountId = await publer.resolveAccountId(apiKey, publerWorkspaceId, post.platform, platformAccounts[post.platform]);
    const mediaId = await publer.uploadMedia(apiKey, publerWorkspaceId, post.image);
    const text = prepareForPublishing(workspace, post);
    const { jobId, scheduledAt } = await publer.schedulePost(apiKey, publerWorkspaceId, {
      accountId, platform: post.platform, text, mediaId, scheduledAt: post.scheduled_for,
    });

    const job = await publer.waitForJob(apiKey, publerWorkspaceId, jobId);
    if (job.failed) throw new PublerError(job.error, { status: 400, code: 'job_failed' });

    // Publer's job gives no post id, so look the post up (best effort; checked again later)
    let publerPostId = null;
    try {
      const scheduled = await publer.listPosts(apiKey, publerWorkspaceId, { state: 'scheduled', accountId, ...searchWindow(scheduledAt) });
      const match = publer.findMatchingPost(scheduled, { text, accountId });
      if (match?.id) publerPostId = String(match.id);
    } catch (error) {
      console.error(`[posts] Could not look up Publer post for ${post.id}:`, error.message);
    }

    return { jobId, scheduledAt, accountId, publerPostId, text };
  }

  async function withdrawFromPubler(post, sent) {
    try {
      const workspace = await getWorkspaceById(post.workspace_id);
      const ctx = await publerContext(workspace);
      let publerPostId = sent.publerPostId;
      if (!publerPostId) {
        const scheduled = await publer.listPosts(ctx.apiKey, ctx.publerWorkspaceId, { state: 'scheduled', accountId: sent.accountId, ...searchWindow(sent.scheduledAt) });
        publerPostId = publer.findMatchingPost(scheduled, { text: sent.text, accountId: sent.accountId })?.id;
      }
      if (!publerPostId) throw new Error('not found in Publer');
      await publer.deletePosts(ctx.apiKey, ctx.publerWorkspaceId, [String(publerPostId)]);
      return post;
    } catch (error) {
      console.error(`[posts] ${post.id} was cancelled while being scheduled and could not be removed from Publer:`, error.message);
      return save({ ...post, error: 'Cancelled while it was being sent to Publer. Check Publer and delete it there if it is still scheduled.' });
    }
  }

  // Hand a post to Publer. Temporary problems leave it queued for the next retry.
  async function submit(post) {
    const attempt = { attempts: (post.attempts || 0) + 1, last_attempt_at: nowIso() };
    try {
      const sent = await sendToPubler(post);

      // Cancelled while it was on its way to Publer: take it back out
      const latest = await get(post.id);
      if (latest?.status === 'cancelled') return withdrawFromPubler(latest, sent);

      console.log(`[posts] ${post.id} scheduled in Publer for ${sent.scheduledAt}`);
      return save({
        ...post,
        ...attempt,
        status: 'scheduled',
        scheduled_for: sent.scheduledAt,
        publer_job_id: sent.jobId,
        publer_account_id: sent.accountId,
        publer_post_id: sent.publerPostId,
        published_text: sent.text,
        error: null,
        error_code: null,
      });
    } catch (error) {
      const tooOld = Date.now() - new Date(post.retry_from || post.created_at).getTime() > GIVE_UP_AFTER_MS;
      const failed = PERMANENT_ERRORS.has(error.code) || tooOld || error instanceof PostError;
      console.error(`[posts] ${post.id} not scheduled (${failed ? 'failed' : 'will retry'}):`, error.message);
      return save({
        ...post,
        ...attempt,
        status: failed ? 'failed' : 'queued',
        error: error.message,
        error_code: error.code || null,
      });
    }
  }

  // Ask Publer whether a scheduled post has gone live, and fetch its link
  async function checkLive(post) {
    const workspace = await getWorkspaceById(post.workspace_id);
    if (!workspace) return post;
    const checked = { last_checked_at: nowIso() };

    let ctx;
    try {
      ctx = await publerContext(workspace);
    } catch (error) {
      return save({ ...post, ...checked, error: error.message });
    }

    const window = searchWindow(post.scheduled_for || post.created_at);
    const lookup = {
      publerPostId: post.publer_post_id,
      text: post.published_text || post.content,
      accountId: post.publer_account_id,
    };

    for (const state of ['published', 'published_posted']) {
      let posts;
      try {
        posts = await publer.listPosts(ctx.apiKey, ctx.publerWorkspaceId, { state, accountId: post.publer_account_id, ...window });
      } catch (error) {
        return save({ ...post, ...checked, error: error.message });
      }
      const match = publer.findMatchingPost(posts, lookup);
      if (match) {
        return save({
          ...post,
          ...checked,
          status: 'published',
          published_at: post.published_at || match.published_at || match.scheduled_at || post.scheduled_for,
          post_url: match.post_link || post.post_url || null,
          publer_post_id: match.id ? String(match.id) : post.publer_post_id,
          error: null,
        });
      }
    }

    if (post.status === 'scheduled') {
      try {
        const failedPosts = await publer.listPosts(ctx.apiKey, ctx.publerWorkspaceId, { state: 'failed', accountId: post.publer_account_id, ...window });
        const failedMatch = publer.findMatchingPost(failedPosts, lookup);
        if (failedMatch) {
          return save({ ...post, ...checked, status: 'failed', error: failedMatch.error || 'Publer could not publish this post. Check it in Publer.' });
        }
      } catch {}

      if (Date.now() - new Date(post.scheduled_for).getTime() > GIVE_UP_AFTER_MS) {
        return save({ ...post, ...checked, status: 'failed', error: 'Publer has not confirmed this post went live after 24 hours. Check it in Publer.' });
      }
    }

    return save({ ...post, ...checked });
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
    return submit(post);
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
    if (!['pending', 'queued'].includes(post.status)) throw new PostError(`This post is already ${post.status}.`);
    const scheduledFor = post.scheduled_for && new Date(post.scheduled_for) > new Date()
      ? post.scheduled_for
      : (await nextSlotFor(workspace, post.platform)).toISOString();
    return submit({ ...post, auto_schedule: true, status: 'queued', scheduled_for: scheduledFor, retry_from: nowIso() });
  }

  async function retry(workspace, postId) {
    const post = await getForWorkspace(workspace.id, postId);
    if (!['queued', 'failed'].includes(post.status)) throw new PostError(`This post is ${post.status}, so there is nothing to retry.`);
    const scheduledFor = new Date(post.scheduled_for) > new Date() ? post.scheduled_for : new Date(Date.now() + 5 * MINUTE).toISOString();
    return submit({ ...post, auto_schedule: true, status: 'queued', scheduled_for: scheduledFor, retry_from: nowIso() });
  }

  // Cancel a post. A scheduled post is deleted from Publer first so it can't go out.
  // `force` marks it cancelled here when it can't be found in Publer (already deleted there).
  async function cancel(workspace, postId, { force = false } = {}) {
    const post = await getForWorkspace(workspace.id, postId);
    if (['published', 'cancelled'].includes(post.status)) throw new PostError(`This post is already ${post.status}.`);

    if (post.status === 'scheduled' && !force) {
      const ctx = await publerContext(workspace);
      let publerPostId = post.publer_post_id;
      if (!publerPostId) {
        const scheduled = await publer.listPosts(ctx.apiKey, ctx.publerWorkspaceId, {
          state: 'scheduled', accountId: post.publer_account_id, ...searchWindow(post.scheduled_for),
        });
        publerPostId = publer.findMatchingPost(scheduled, { text: post.published_text || post.content, accountId: post.publer_account_id })?.id;
      }
      if (!publerPostId) {
        throw new PostError("Couldn't find this post in Publer, so it may still go out. Delete it in Publer, then mark it cancelled here.", 409);
      }
      await publer.deletePosts(ctx.apiKey, ctx.publerWorkspaceId, [String(publerPostId)]);
    }

    return save({ ...post, status: 'cancelled', cancelled_at: nowIso(), error: null });
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
        try {
          if (post.status === 'queued' && post.auto_schedule && since(post.last_attempt_at) >= RETRY_EVERY_MS) {
            await submit(post);
          } else if (post.status === 'scheduled' && new Date(post.scheduled_for).getTime() <= now - MINUTE && since(post.last_checked_at) >= RETRY_EVERY_MS) {
            await checkLive(post);
          } else if (post.status === 'published' && !post.post_url && since(post.published_at) <= LINK_WAIT_MS && since(post.last_checked_at) >= 2 * RETRY_EVERY_MS) {
            await checkLive(post);
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
    get, save, remove, list, getForWorkspace, nextSlotFor,
    createScheduledPost, createDraft, approve, retry, cancel,
    submit, checkLive, runChecks, startScheduler,
  };
}
