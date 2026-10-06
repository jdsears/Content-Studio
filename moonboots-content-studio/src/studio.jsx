import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiJson } from './lib/api.js';
import { browserDraftToServer, toItems, PLATFORM_NAMES } from './lib/posts.js';
import { formatWhen } from './lib/schedule.js';
import {
  loadPosts, savePosts, loadSettings, saveSettings,
  loadActiveWorkspace, saveActiveWorkspace, removeLegacySecretsFromBrowser,
} from './lib/storage.js';
import { useFeedback } from './components/ui.jsx';

// Everything the pages share: workspaces, posts, settings and the actions on them.
// Posts (drafts included) live on the server, so they are safe and the same on every device.

const StudioContext = createContext(null);

const FALLBACK_WORKSPACES = [
  { id: 'moonboots', name: 'MoonBoots', slug: 'moonboots', brand_config: { tagline: 'Strategy to Execution' }, pillars: [] },
  { id: 'touchline', name: 'Touchline', slug: 'touchline', brand_config: { tagline: 'The all-in-one grassroots football app' }, pillars: [] },
];

// MoonBoots pillars used if the server's list is missing
export const DEFAULT_PILLARS = [
  { id: 'ai', name: 'AI Strategy' },
  { id: 'web3', name: 'Web3' },
  { id: 'community', name: 'Community Building' },
  { id: 'transformation', name: 'Business Transformation' },
  { id: 'sport', name: 'Sport & Culture' },
];

export const freshGenerator = (workspace, settings) => {
  const pillars = workspace?.pillars?.length ? workspace.pillars : DEFAULT_PILLARS;
  const pillar = pillars.find(p => p.id === settings?.defaultPillar) ? settings.defaultPillar : pillars[0]?.id;
  return {
    topic: '',
    pillar,
    platforms: { linkedin: true, facebook: false, x: true, instagram: false },
    includeImages: settings?.includeImages !== false,
    theme: settings?.defaultTheme || null,
    drafts: null, // { [platform]: { content, image, imageLoading, when: { mode, at } } }
  };
};

// What to tell the person after an action on a post (null means it went wrong)
const doneMessages = (action, post) => {
  if (action === 'approve') {
    if (post.status === 'approved') {
      return post.platform === 'x'
        ? { title: 'Approved', body: 'Copy it and post it on X when it is time.' }
        : { title: 'Approved', body: 'Connect Publer in Settings to post automatically. For now, copy it and post it by hand.' };
    }
    if (post.status === 'scheduled') return { title: 'Scheduled in Publer', body: `${PLATFORM_NAMES[post.platform]} post goes out ${formatWhen(post.scheduledFor)}.` };
    if (post.status === 'failed') return null;
    if (post.status === 'queued' && post.error) {
      return { title: 'Waiting for Publer', body: `Publer didn't take it yet (${post.error}). Content Studio tries again every few minutes.` };
    }
    return { title: 'Sent to Publer', body: 'It is on its way.' };
  }
  return {
    cancel: { title: 'Post cancelled' },
    retry: { title: 'Sent to Publer again' },
    reject: { title: 'Rejected', body: 'It is under Rejected & cancelled if you change your mind.' },
    reopen: { title: 'Back in approvals' },
    'mark-posted': { title: 'Marked as posted' },
  }[action] || { title: 'Done' };
};

export const StudioProvider = ({ page, param, navigate, children }) => {
  const { toast, confirm } = useFeedback();

  // ---------- Server config and workspaces ----------
  const [serverConfig, setServerConfig] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(loadActiveWorkspace);

  useEffect(() => {
    removeLegacySecretsFromBrowser();
    apiFetch('/api/config').then(r => (r.ok ? r.json() : null)).then(data => data && setServerConfig(data)).catch(() => {});
    apiFetch('/api/workspaces')
      .then(r => r.json())
      .then(data => setWorkspaces(Array.isArray(data) && data.length ? data : FALLBACK_WORKSPACES))
      .catch(() => setWorkspaces(FALLBACK_WORKSPACES));
  }, []);

  const workspace = workspaces.find(w => w.id === workspaceId) || workspaces[0] || null;
  const activeId = workspace?.id || workspaceId;

  const updateWorkspace = useCallback(updated => {
    setWorkspaces(prev => prev.map(w => (w.id === updated.id ? { ...w, ...updated } : w)));
  }, []);

  // ---------- Preferences (this browser) ----------
  const [settings, setSettingsState] = useState(() => loadSettings(workspaceId));
  const updateSettings = useCallback(changes => {
    setSettingsState(prev => {
      const next = { ...prev, ...changes };
      saveSettings(activeId, next);
      return next;
    });
  }, [activeId]);

  // ---------- Generator (kept while moving between pages) ----------
  const [generator, setGenerator] = useState(() => freshGenerator(null, loadSettings(workspaceId)));
  const generatorWorkspace = useRef(null);
  useEffect(() => {
    // Start fresh when the workspace (and so its pillars) changes
    if (workspace && generatorWorkspace.current !== workspace.id) {
      generatorWorkspace.current = workspace.id;
      setGenerator(freshGenerator(workspace, loadSettings(workspace.id)));
    }
  }, [workspace]);

  const switchWorkspace = useCallback(id => {
    saveActiveWorkspace(id);
    setWorkspaceId(id);
    setSettingsState(loadSettings(id));
  }, []);

  // ---------- Posts (server) ----------
  const [posts, setPosts] = useState([]);
  const [serverState, setServerState] = useState({ loading: false, error: null, loaded: false });
  const shownWorkspace = useRef(activeId);
  shownWorkspace.current = activeId;

  const reloadServerPosts = useCallback(async () => {
    if (!activeId) return;
    const id = activeId;
    setServerState(prev => ({ ...prev, loading: true }));
    try {
      const data = await apiJson(`/api/workspaces/${id}/posts`);
      if (shownWorkspace.current !== id) return; // a slow reply for another workspace
      setPosts(data.posts || []);
      setServerState({ loading: false, error: null, loaded: true });
    } catch (error) {
      if (shownWorkspace.current === id) setServerState({ loading: false, error: error.message, loaded: true });
    }
  }, [activeId]);

  // Drafts used to be kept in this browser. Move any still here to the server, once.
  const moving = useRef(new Set());
  const moveBrowserDrafts = useCallback(async id => {
    const local = loadPosts(id);
    if (!local.length || moving.current.has(id)) return;
    moving.current.add(id);
    const left = [];
    let moved = 0;
    for (const draft of local) {
      try {
        await apiJson(`/api/workspaces/${id}/posts`, { method: 'POST', body: JSON.stringify(browserDraftToServer(draft)) });
        moved += 1;
      } catch (error) {
        console.error('Could not move a draft to the server:', error.message);
        left.push(draft);
      }
    }
    try { localStorage.setItem(`contentStudioPosts_${id}_moved`, JSON.stringify(local)); } catch {}
    savePosts(id, left);
    moving.current.delete(id);
    if (moved) {
      toast({ tone: 'success', title: `Moved ${moved} draft${moved === 1 ? '' : 's'} to the server`, body: 'They are now safe, and on every device you use.' });
    }
    if (left.length) {
      toast({ tone: 'error', title: `${left.length} draft${left.length === 1 ? '' : 's'} could not be moved yet`, body: 'They stay in this browser and are tried again next time.' });
    }
  }, [toast]);

  useEffect(() => {
    setPosts([]);
    setServerState({ loading: false, error: null, loaded: false });
    (async () => {
      await moveBrowserDrafts(activeId);
      await reloadServerPosts();
    })();
  }, [activeId, moveBrowserDrafts, reloadServerPosts]);

  // Keep lists fresh while they are on screen
  useEffect(() => {
    if (!['home', 'schedule', 'insights'].includes(page)) return undefined;
    reloadServerPosts();
    const timer = setInterval(reloadServerPosts, 60 * 1000);
    return () => clearInterval(timer);
  }, [page, reloadServerPosts]);

  const items = useMemo(() => toItems(posts), [posts]);

  const counts = useMemo(() => {
    const c = { approval: 0, upcoming: 0, published: 0, problems: 0, other: 0 };
    items.forEach(item => { c[item.group] += 1; });
    return c;
  }, [items]);

  // Put a changed post into the list straight away
  const replacePost = useCallback(post => {
    if (!post?.id) return;
    setPosts(prev => (prev.some(p => p.id === post.id) ? prev.map(p => (p.id === post.id ? post : p)) : [post, ...prev]));
  }, []);

  // ---------- Actions ----------

  const addDraft = useCallback(async ({ platform, content, pillar, image, scheduledFor }) => {
    const data = await apiJson(`/api/workspaces/${activeId}/posts`, {
      method: 'POST',
      body: JSON.stringify({ platform, content, pillar, image, scheduledFor }),
    });
    replacePost(data.post);
    return data.post;
  }, [activeId, replacePost]);

  // Approve, reject, cancel, retry, reopen or mark-posted a post
  const serverAction = useCallback(async (item, action, force = false) => {
    if (action === 'cancel' && !force) {
      const ok = await confirm({ title: 'Cancel this post?', body: 'It is removed from Publer and will not go out.', confirmLabel: 'Cancel post', cancelLabel: 'Keep it', tone: 'danger' });
      if (!ok) return;
    }
    try {
      const data = await apiJson(`/api/workspaces/${activeId}/posts/${item.id}/${action}`, { method: 'POST', body: JSON.stringify({ force }) });
      replacePost(data.post);
      const message = doneMessages(action, data.post);
      if (message) toast({ tone: 'success', ...message });
      else toast({ tone: 'error', title: 'Publer did not take it', body: data.post.error || 'See the post for the reason.' });
    } catch (error) {
      if (error.status === 409 && !force && (action === 'cancel' || action === 'retry')) {
        const ok = await confirm({
          title: action === 'cancel' ? 'Not found in Publer' : 'Publer may already have it',
          body: error.message,
          confirmLabel: action === 'cancel' ? 'Mark it cancelled' : 'Send it again',
        });
        if (ok) return serverAction(item, action, true);
      } else {
        toast({ tone: 'error', title: `Could not ${action.replace('-', ' ')} this post`, body: error.message });
      }
    }
    await reloadServerPosts();
  }, [activeId, confirm, toast, reloadServerPosts, replacePost]);

  const editPost = useCallback(async (item, changes) => {
    try {
      const data = await apiJson(`/api/workspaces/${activeId}/posts/${item.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      replacePost(data.post);
      toast({ tone: 'success', title: 'Saved' });
    } catch (error) {
      toast({ tone: 'error', title: 'Could not save the change', body: error.message });
    }
  }, [activeId, replacePost, toast]);

  const deletePost = useCallback(async item => {
    const ok = await confirm({ title: 'Delete this post?', body: 'It is removed from Content Studio. This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await apiJson(`/api/workspaces/${activeId}/posts/${item.id}`, { method: 'DELETE' });
      setPosts(prev => prev.filter(p => p.id !== item.id));
    } catch (error) {
      toast({ tone: 'error', title: 'Could not delete it', body: error.message });
    }
  }, [activeId, confirm, toast]);

  const copyText = useCallback(async text => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: 'Copied', body: 'Paste it into Publer or the platform.' });
    } catch {
      toast({ tone: 'error', title: 'Could not copy', body: 'Select the text and copy it by hand.' });
    }
  }, [toast]);

  const value = {
    page, param, navigate,
    serverConfig, workspaces, workspace, switchWorkspace, updateWorkspace,
    settings, updateSettings,
    posts, serverState, reloadServerPosts, items, counts,
    generator, setGenerator,
    addDraft, serverAction, editPost, deletePost, copyText,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export const useStudio = () => useContext(StudioContext);
