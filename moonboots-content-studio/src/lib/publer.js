// Publer API helper for social media scheduling
// Docs: https://publer.com/docs

const PUBLER_API_URL = 'https://app.publer.com/api/v1';

// Get headers for Publer API requests
const getHeaders = (apiKey, workspaceId, includeContentType = true) => {
  const headers = {
    'Authorization': `Bearer-API ${apiKey}`,
    'Publer-Workspace-Id': workspaceId,
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

// Upload media file to Publer
export async function uploadMedia({ apiKey, workspaceId, blob, filename = 'image.png' }) {
  if (!apiKey || !workspaceId) {
    throw new Error('Publer API key and Workspace ID required');
  }

  const formData = new FormData();
  formData.append('file', blob, filename);

  const response = await fetch(`${PUBLER_API_URL}/media`, {
    method: 'POST',
    headers: getHeaders(apiKey, workspaceId, false), // Don't include Content-Type for multipart
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to upload media');
  }

  return response.json();
}

// Get connected social accounts
export async function getAccounts({ apiKey, workspaceId }) {
  if (!apiKey || !workspaceId) {
    throw new Error('Publer API key and Workspace ID required');
  }

  const response = await fetch(`${PUBLER_API_URL}/accounts`, {
    method: 'GET',
    headers: getHeaders(apiKey, workspaceId),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch accounts');
  }

  return response.json();
}

// Create/schedule a post
// status: 'scheduled' | 'draft' | 'publish_now'
export async function createPost({
  apiKey,
  workspaceId,
  accountIds,  // Array of account IDs to post to
  content,     // Post text
  mediaUrls,   // Optional array of media URLs
  scheduledAt, // Optional ISO date string for scheduling
  status = 'draft'
}) {
  if (!apiKey || !workspaceId) {
    throw new Error('Publer API key and Workspace ID required');
  }

  if (!accountIds || accountIds.length === 0) {
    throw new Error('At least one account ID required');
  }

  const payload = {
    account_ids: accountIds,
    text: content,
    status,
  };

  // Add scheduled time if provided
  if (scheduledAt && status === 'scheduled') {
    payload.scheduled_at = scheduledAt;
  }

  // Add media if provided
  if (mediaUrls && mediaUrls.length > 0) {
    payload.media_urls = mediaUrls;
  }

  const response = await fetch(`${PUBLER_API_URL}/posts`, {
    method: 'POST',
    headers: getHeaders(apiKey, workspaceId),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to create post');
  }

  // Publer returns a job ID for async processing
  const result = await response.json();
  return result;
}

// Poll for post creation status
export async function getPostStatus({ apiKey, workspaceId, jobId }) {
  if (!apiKey || !workspaceId || !jobId) {
    throw new Error('API key, Workspace ID, and Job ID required');
  }

  const response = await fetch(`${PUBLER_API_URL}/posts/status/${jobId}`, {
    method: 'GET',
    headers: getHeaders(apiKey, workspaceId),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to get post status');
  }

  return response.json();
}

// Get scheduled/draft posts
export async function getPosts({ apiKey, workspaceId, status = 'scheduled', page = 1 }) {
  if (!apiKey || !workspaceId) {
    throw new Error('Publer API key and Workspace ID required');
  }

  const response = await fetch(`${PUBLER_API_URL}/posts?status=${status}&page=${page}`, {
    method: 'GET',
    headers: getHeaders(apiKey, workspaceId),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch posts');
  }

  return response.json();
}

// Delete a post
export async function deletePost({ apiKey, workspaceId, postId }) {
  if (!apiKey || !workspaceId || !postId) {
    throw new Error('API key, Workspace ID, and Post ID required');
  }

  const response = await fetch(`${PUBLER_API_URL}/posts/${postId}`, {
    method: 'DELETE',
    headers: getHeaders(apiKey, workspaceId),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete post');
  }

  return response.json();
}

// Get analytics for an account
export async function getAnalytics({ apiKey, workspaceId, accountId, startDate, endDate }) {
  if (!apiKey || !workspaceId || !accountId) {
    throw new Error('API key, Workspace ID, and Account ID required');
  }

  const params = new URLSearchParams({
    account_id: accountId,
    ...(startDate && { start_date: startDate }),
    ...(endDate && { end_date: endDate }),
  });

  const response = await fetch(`${PUBLER_API_URL}/analytics?${params}`, {
    method: 'GET',
    headers: getHeaders(apiKey, workspaceId),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch analytics');
  }

  return response.json();
}

// Helper to map platform names to Publer account types
export const platformToPubler = {
  linkedin: 'linkedin',
  x: 'twitter',
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  threads: 'threads',
};
