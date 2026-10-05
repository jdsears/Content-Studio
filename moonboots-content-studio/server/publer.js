// ============ PUBLER API CLIENT ============
// Every call to Publer goes through here, so errors read the same everywhere.
// Docs: https://publer.com/docs (auth header "Bearer-API <key>", plus "Publer-Workspace-Id").

// PUBLER_API_URL and PUBLER_POLL_MS exist for the tests' fake Publer
const PUBLER_API = process.env.PUBLER_API_URL || 'https://app.publer.com/api/v1';
const TIMEOUT_MS = 20000;
const POLL_MS = Number(process.env.PUBLER_POLL_MS) || 2000;

export class PublerError extends Error {
  constructor(message, { status = 502, code = 'publer_error', hint } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

export const NEW_KEY_HINT = "Create a new API key in Publer's settings, then paste it into Content Studio Settings for this workspace.";

// Turn a Publer failure into a plain-English reason
function explain(status, data, isHtml) {
  const detail = data?.message || data?.error || (Array.isArray(data?.errors) ? data.errors.join(', ') : null);

  if (isHtml) {
    return new PublerError(
      'Publer sent back a web page instead of data. Usually the plan does not include API access (Business or Enterprise needed), or the key is wrong.',
      { status: 401, code: 'no_api_access', hint: NEW_KEY_HINT },
    );
  }
  if (status === 401) {
    return new PublerError(
      'Publer rejected this API key. It may have expired or been revoked.',
      { status: 401, code: 'key_invalid', hint: NEW_KEY_HINT },
    );
  }
  if (status === 403) {
    return new PublerError(
      `This Publer account cannot use the API${detail ? ` (${detail})` : ''}. API access needs a Business or Enterprise plan.`,
      { status: 403, code: 'no_api_access' },
    );
  }
  if (status === 429) {
    return new PublerError('Publer is limiting requests right now. Try again in a minute.', { status: 429, code: 'rate_limited' });
  }
  if (status >= 500) {
    return new PublerError(`Publer had a problem (status ${status}). Try again shortly.`, { status: 502, code: 'publer_down' });
  }
  return new PublerError(detail || `Publer error (status ${status})`, { status: 400, code: 'publer_error' });
}

async function request(apiKey, path, { method = 'GET', workspaceId, body, query, multipart } = {}) {
  const url = new URL(PUBLER_API + path);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach(v => url.searchParams.append(`${key}[]`, v));
    else url.searchParams.set(key, value);
  }

  const headers = { 'Authorization': `Bearer-API ${apiKey}` };
  if (workspaceId) headers['Publer-Workspace-Id'] = workspaceId;
  if (multipart) headers['Content-Type'] = multipart.contentType;
  else if (body) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: multipart ? multipart.body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // A timeout means Publer may have received the request; a connection failure means it did not
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new PublerError("Publer didn't answer in time.", { status: 504, code: 'timeout' });
    }
    throw new PublerError(`Could not reach Publer: ${error.message}`, { status: 502, code: 'network' });
  }

  const text = await response.text();
  const isHtml = text.trim().startsWith('<');
  let data = null;
  if (!isHtml && text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new PublerError('Publer sent a reply that could not be read.', { status: 502, code: 'bad_response' });
    }
  }

  if (isHtml || !response.ok) throw explain(response.status, data, isHtml);
  return data;
}

// ============ ACCOUNTS ============

const NETWORK_TO_PLATFORM = { linkedin: 'linkedin', facebook: 'facebook', instagram: 'instagram', twitter: 'x', x: 'x' };
const PLATFORM_TO_NETWORK = { linkedin: 'linkedin', facebook: 'facebook', instagram: 'instagram', x: 'twitter' };

// Publer account types, in words people recognise
const ACCOUNT_KINDS = {
  in_page: 'LinkedIn page',
  in_profile: 'LinkedIn profile',
  fb_page: 'Facebook Page',
  fb_group: 'Facebook group',
  ig_business: 'Instagram business',
  ig_creator: 'Instagram creator',
  ig_personal: 'Instagram personal',
  twitter: 'X',
};

function platformOfAccount(acc) {
  const raw = String(acc.provider || acc.social_network || acc.network || acc.platform || acc.type || '').toLowerCase();
  for (const [prefix, platform] of [['in_', 'linkedin'], ['fb_', 'facebook'], ['ig_', 'instagram']]) {
    if (raw.startsWith(prefix)) return platform;
  }
  if (NETWORK_TO_PLATFORM[raw]) return NETWORK_TO_PLATFORM[raw];
  for (const [network, platform] of Object.entries(NETWORK_TO_PLATFORM)) {
    if (raw.includes(network)) return platform;
  }
  return raw || 'unknown';
}

function normaliseAccount(acc) {
  const platform = platformOfAccount(acc);
  const type = acc.type || null;
  return {
    id: String(acc.id),
    name: acc.name || acc.username || acc.display_name || platform,
    platform,
    type,
    kind: ACCOUNT_KINDS[type] || ACCOUNT_KINDS[acc.provider] || platform,
  };
}

export async function getPublerWorkspaceId(apiKey) {
  const workspaces = await request(apiKey, '/workspaces');
  if (!Array.isArray(workspaces) || !workspaces.length) {
    throw new PublerError('This Publer key has no workspaces.', { status: 400, code: 'no_workspace' });
  }
  return workspaces[0].id;
}

// Check a key and list the accounts it can post to
export async function listAccounts(apiKey) {
  const publerWorkspaceId = await getPublerWorkspaceId(apiKey);
  const accounts = await request(apiKey, '/accounts', { workspaceId: publerWorkspaceId });
  return {
    publerWorkspaceId,
    accounts: (Array.isArray(accounts) ? accounts : []).map(normaliseAccount),
  };
}

// The account chosen in Settings for this platform, or the first one that matches
export async function resolveAccountId(apiKey, publerWorkspaceId, platform, chosenAccountId) {
  if (chosenAccountId) return String(chosenAccountId);
  const accounts = await request(apiKey, '/accounts', { workspaceId: publerWorkspaceId });
  const match = (Array.isArray(accounts) ? accounts : []).map(normaliseAccount).find(a => a.platform === platform);
  if (!match) {
    throw new PublerError(
      `No ${platform} account is connected in Publer. Connect it in Publer, then choose it in Content Studio Settings.`,
      { status: 400, code: 'no_account' },
    );
  }
  return match.id;
}

// ============ MEDIA ============

// Upload an image (data URL or web address) and return Publer's media id, or null if it fails
export async function uploadMedia(apiKey, publerWorkspaceId, image) {
  if (!image) return null;
  try {
    if (image.startsWith('data:')) {
      const mimeType = image.split(';')[0].split(':')[1] || 'image/png';
      const extension = mimeType.split('/')[1] || 'png';
      const buffer = Buffer.from(image.split(',')[1], 'base64');
      const boundary = '----ContentStudio' + Math.random().toString(36).slice(2);
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image_${Date.now()}.${extension}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const data = await request(apiKey, '/media', {
        method: 'POST',
        workspaceId: publerWorkspaceId,
        multipart: { contentType: `multipart/form-data; boundary=${boundary}`, body },
      });
      return data?.id || null;
    }
    const data = await request(apiKey, '/media/from-url', {
      method: 'POST',
      workspaceId: publerWorkspaceId,
      body: { url: image },
    });
    return data?.id || null;
  } catch (error) {
    console.error('Publer media upload failed, posting without image:', error.message);
    return null;
  }
}

// ============ POSTS ============

// Schedule one post on one account. Publer needs a time in the future.
export async function schedulePost(apiKey, publerWorkspaceId, { accountId, platform, text, mediaId, scheduledAt }) {
  const network = PLATFORM_TO_NETWORK[platform] || platform;
  const earliest = Date.now() + 60 * 1000;
  const when = new Date(Math.max(new Date(scheduledAt || 0).getTime() || 0, earliest)).toISOString();

  const networkContent = { type: mediaId ? 'photo' : 'status', text };
  if (mediaId) networkContent.media = [{ id: mediaId, type: 'photo' }];

  const data = await request(apiKey, '/posts/schedule', {
    method: 'POST',
    workspaceId: publerWorkspaceId,
    body: {
      bulk: {
        state: 'scheduled',
        posts: [{ networks: { [network]: networkContent }, accounts: [{ id: accountId, scheduled_at: when }] }],
      },
    },
  });
  return { jobId: data?.job_id || null, scheduledAt: when, data };
}

function failureMessage(payload) {
  const failures = payload?.failures;
  const list = Array.isArray(failures) ? failures : failures && typeof failures === 'object' ? Object.values(failures).flat() : [];
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const first = [...list, ...errors].find(Boolean);
  if (!first) return null;
  return typeof first === 'string' ? first : first.message || first.error || JSON.stringify(first);
}

// Wait for a Publer job to finish. Account problems show up as "failures" even when the job completes.
export async function waitForJob(apiKey, publerWorkspaceId, jobId, { attempts = 15, intervalMs = POLL_MS } = {}) {
  if (!jobId) return { done: true, failed: false };
  for (let i = 0; i < attempts; i++) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    let result;
    try {
      result = await request(apiKey, `/job_status/${jobId}`, { workspaceId: publerWorkspaceId });
    } catch (error) {
      if (['network', 'timeout', 'publer_down', 'rate_limited', 'bad_response'].includes(error.code)) continue;
      throw error;
    }
    const status = String(result?.status || '').toLowerCase();
    const failure = failureMessage(result?.payload);
    if (status === 'failed' || status === 'error' || failure) {
      return { done: true, failed: true, error: failure || result?.message || 'Publer could not schedule this post', result };
    }
    if (['complete', 'completed', 'done'].includes(status) || result?.done === true || result?.complete === true) {
      return { done: true, failed: false, result };
    }
  }
  return { done: false, failed: false };
}

// List posts in a time window, e.g. to find one we scheduled or check it went live
export async function listPosts(apiKey, publerWorkspaceId, { state, accountId, from, to, page = 0 }) {
  const data = await request(apiKey, '/posts', {
    workspaceId: publerWorkspaceId,
    query: { state, account_ids: accountId ? [accountId] : undefined, from, to, page },
  });
  if (Array.isArray(data)) return data;
  return data?.posts || data?.data || [];
}

export async function deletePosts(apiKey, publerWorkspaceId, postIds) {
  return request(apiKey, '/posts', {
    method: 'DELETE',
    workspaceId: publerWorkspaceId,
    query: { post_ids: postIds },
  });
}

// Text compared without links (Publer may shorten them) or spacing differences
const comparable = (text) => String(text || '').replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
const postTime = (p) => p.scheduled_at || p.published_at || p.date || null;
const TIME_TOLERANCE_MS = 2 * 60 * 60 * 1000;

// Publer's job status gives no post id, so find our post among Publer's posts.
// With a known Publer id, only that id counts. Otherwise the account and the whole text
// must match, the time must be close, and ids already used by other posts are skipped.
export function findMatchingPost(posts, { publerPostId, text, accountId, around, excludeIds } = {}) {
  if (publerPostId) return posts.find(p => String(p.id) === String(publerPostId)) || null;

  const wanted = comparable(text);
  if (!wanted) return null;
  return posts.find(p => {
    if (excludeIds?.has(String(p.id))) return false;
    if (accountId && p.account_id && String(p.account_id) !== String(accountId)) return false;
    if (comparable(p.text) !== wanted) return false;
    const when = postTime(p);
    if (around && when && Math.abs(new Date(when).getTime() - new Date(around).getTime()) > TIME_TOLERANCE_MS) return false;
    return true;
  }) || null;
}
