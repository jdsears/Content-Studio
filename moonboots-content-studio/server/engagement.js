import * as publer from './publer.js';

// Likes, comments, shares and reach for published posts, read from Publer's analytics
// (GET /analytics/{account_id}/post_insights). Publer gathers these from each network
// about once a day, so they are refreshed every few hours at most. Facebook Pages,
// Instagram business accounts and LinkedIn pages have numbers; LinkedIn profiles and X
// have little or none. The API key needs Publer's Analytics permission.

const HOUR = 60 * 60 * 1000;
const REFRESH_EVERY_MS = 6 * HOUR;
const LOOKBACK_DAYS = 60;
const MAX_PAGES = 10;
const STATUS = 'engagement_status';

const METRICS = ['reach', 'engagement', 'engagement_rate', 'likes', 'comments', 'shares', 'saves', 'video_views', 'link_clicks', 'post_clicks'];

// Publer may send a metric as a number or as { name, value, tooltip }
export function metricValue(value) {
  const n = value !== null && typeof value === 'object' ? Number(value.value) : Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n;
}

// One item from post_insights, in a shape we can match and store
export function readInsight(raw) {
  const source = raw?.analytics && typeof raw.analytics === 'object' ? raw.analytics : raw || {};
  const metrics = {};
  for (const key of METRICS) {
    const n = metricValue(source[key]);
    if (n !== null) metrics[key] = n;
  }
  return {
    id: raw?.id !== undefined && raw?.id !== null ? String(raw.id) : null,
    postLink: raw?.post_link || null,
    text: raw?.text || '',
    at: raw?.scheduled_at || raw?.published_at || null,
    accountId: raw?.account_id !== undefined && raw?.account_id !== null ? String(raw.account_id) : null,
    metrics,
  };
}

// Find a post's numbers: by Publer id, then by its live link, then by its text and account
export function matchInsight(post, insights) {
  if (post.publer_post_id) {
    const byId = insights.find(i => i.id === String(post.publer_post_id));
    if (byId) return byId;
  }
  if (post.post_url) {
    const byLink = insights.find(i => i.postLink && i.postLink === post.post_url);
    if (byLink) return byLink;
  }
  const text = post.published_text || post.content;
  return insights.find(i => publer.sameText(i.text, text)
    && (!post.publer_account_id || !i.accountId || i.accountId === String(post.publer_account_id))) || null;
}

const day = date => date.toISOString().slice(0, 10);

export function createEngagementService({ store, posts, getWorkspaceSecrets }) {
  const running = new Set();

  async function status(workspace) {
    return (await store.get(STATUS, workspace.id)) || { ok: null, checked_at: null };
  }

  async function saveStatus(workspace, value) {
    const saved = { ...value, checked_at: new Date().toISOString() };
    await store.set(STATUS, workspace.id, saved);
    return saved;
  }

  // Read the latest numbers from Publer and put them on this workspace's published posts
  async function refresh(workspace, { force = false } = {}) {
    const last = await status(workspace);
    if (!force && last.checked_at && Date.now() - new Date(last.checked_at).getTime() < REFRESH_EVERY_MS) return last;
    if (running.has(workspace.id)) return last;
    running.add(workspace.id);
    try {
      const secrets = await getWorkspaceSecrets(workspace.id);
      if (!secrets.publer_api_key) {
        return saveStatus(workspace, { ok: false, code: 'no_key', error: `No Publer key saved for ${workspace.name}.` });
      }
      const published = await posts.list({ workspaceId: workspace.id, status: 'published' });
      const accountIds = [...new Set([
        ...Object.values(secrets.platform_accounts || {}),
        ...published.map(p => p.publer_account_id),
      ].filter(Boolean).map(String))];
      if (!accountIds.length) {
        return saveStatus(workspace, { ok: false, code: 'no_accounts', error: 'No Publer accounts are chosen for this workspace yet.' });
      }

      const publerWorkspaceId = await publer.getPublerWorkspaceId(secrets.publer_api_key);
      const to = new Date();
      const from = new Date(to.getTime() - LOOKBACK_DAYS * 24 * HOUR);
      const insights = [];
      for (const accountId of accountIds) {
        for (let page = 0; page < MAX_PAGES; page++) {
          const batch = await publer.getPostInsights(secrets.publer_api_key, publerWorkspaceId, accountId, { from: day(from), to: day(to), page });
          if (!batch.length) break;
          for (const raw of batch) {
            const insight = readInsight(raw);
            insights.push({ ...insight, accountId: insight.accountId || accountId });
          }
        }
      }

      let matched = 0;
      const updatedAt = new Date().toISOString();
      for (const post of published) {
        const found = matchInsight(post, insights);
        if (!found || !Object.keys(found.metrics).length) continue;
        await posts.update(post.id, ['published'], {
          metrics: { likes: 0, comments: 0, shares: 0, ...found.metrics, updated_at: updatedAt },
          post_url: post.post_url || found.postLink || null,
        });
        matched += 1;
      }
      return saveStatus(workspace, { ok: true, matched, insights: insights.length });
    } catch (error) {
      if (error.status === 403 || error.code === 'no_api_access') {
        return saveStatus(workspace, {
          ok: false,
          code: 'no_analytics',
          error: "Publer won't share analytics with this key. Analytics needs a Business plan, and an API key made with the Analytics permission ticked. Make a new key in Publer, then paste it in Settings.",
        });
      }
      console.error(`[engagement] Refresh failed for ${workspace.name}:`, error.message);
      return saveStatus(workspace, { ok: false, code: error.code || 'error', error: error.message });
    } finally {
      running.delete(workspace.id);
    }
  }

  return { status, refresh };
}
