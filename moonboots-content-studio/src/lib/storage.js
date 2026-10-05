// Things kept in this browser: drafts and approvals (per workspace) and preferences.
// Keys and Publer settings live on the server only.

const safeRead = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save ${key}:`, error);
  }
};

export const loadPosts = (workspaceId) => safeRead(`contentStudioPosts_${workspaceId}`, []);
export const savePosts = (workspaceId, posts) => safeWrite(`contentStudioPosts_${workspaceId}`, posts);

export const DEFAULT_SETTINGS = {
  includeImages: true,
  autoSchedule: true,
  defaultPillar: null,
  defaultTheme: null,
};

export const loadSettings = (workspaceId) => ({ ...DEFAULT_SETTINGS, ...safeRead(`contentStudioSettings_${workspaceId}`, {}) });
export const saveSettings = (workspaceId, settings) => safeWrite(`contentStudioSettings_${workspaceId}`, settings);

export const loadActiveWorkspace = () => {
  try {
    return localStorage.getItem('activeWorkspace') || 'moonboots';
  } catch {
    return 'moonboots';
  }
};

export const saveActiveWorkspace = (workspaceId) => {
  try {
    localStorage.setItem('activeWorkspace', workspaceId);
  } catch {}
};

// Keys used to be kept in the browser. They now live on the server only, so remove old copies.
const LEGACY_SECRET_FIELDS = ['publerApiKey', 'claudeApiKey', 'replicateApiKey'];

export const removeLegacySecretsFromBrowser = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('contentStudioSettings_')) continue;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      if (LEGACY_SECRET_FIELDS.some(field => field in saved)) {
        LEGACY_SECRET_FIELDS.forEach(field => delete saved[field]);
        localStorage.setItem(key, JSON.stringify(saved));
      }
    }
    localStorage.removeItem('publerConnectionStatus');
  } catch {}
};
