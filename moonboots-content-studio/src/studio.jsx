import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiJson } from './lib/api.js';
import { combinePosts, PLATFORM_NAMES } from './lib/posts.js';
import { isValidDate } from './lib/schedule.js';
import {
  loadPosts, savePosts, loadSettings, saveSettings,
  loadActiveWorkspace, saveActiveWorkspace, removeLegacySecretsFromBrowser,
} from './lib/storage.js';
import { useFeedback } from './components/ui.jsx';

// Everything the pages share: workspaces, posts, settings and the actions on them.

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

  // ---------- Drafts and approvals (this browser) ----------
  const [localPosts, setLocalPostsState] = useState(() => loadPosts(workspaceId));
  const setLocalPosts = useCallback(update => {
    setLocalPostsState(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      savePosts(activeId, next);
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
    setLocalPostsState(loadPosts(id));
    setSettingsState(loadSettings(id));
  }, []);

  // ---------- Posts from Touchline HQ and the API (server) ----------
  const [serverPosts, setServerPosts] = useState([]);
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
      setServerPosts(data.posts || []);
      setServerState({ loading: false, error: null, loaded: true });
    } catch (error) {
      if (shownWorkspace.current === id) setServerState({ loading: false, error: error.message, loaded: true });
    }
  }, [activeId]);

  useEffect(() => {
    setServerPosts([]);
    setServerState({ loading: false, error: null, loaded: false });
    reloadServerPosts();
  }, [reloadServerPosts]);

  // Keep lists fresh while they are on screen
  useEffect(() => {
    if (!['home', 'schedule', 'insights'].includes(page)) return undefined;
    reloadServerPosts();
    const timer = setInterval(reloadServerPosts, 60 * 1000);
    return () => clearInterval(timer);
  }, [page, reloadServerPosts]);

  const items = useMemo(() => combinePosts(localPosts, serverPosts, workspace?.slug), [localPosts, serverPosts, workspace?.slug]);

  const counts = useMemo(() => {
    const c = { approval: 0, upcoming: 0, published: 0, problems: 0, other: 0 };
    items.forEach(item => { c[item.group] += 1; });
    return c;
  }, [items]);

  // ---------- Actions on drafts made here ----------

  const addDraft = useCallback(({ platform, content, pillar, image, scheduledFor, suggestedTime }) => {
    const post = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      platform,
      content,
      pillar,
      image: image || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      scheduledFor: scheduledFor || null,
      suggestedTime: suggestedTime || null,
    };
    setLocalPosts(prev => [...prev, post]);
    return post;
  }, [setLocalPosts]);

  const patchLocal = useCallback((id, changes) => {
    setLocalPosts(prev => prev.map(p => (p.id === id ? { ...p, ...(typeof changes === 'function' ? changes(p) : changes) } : p)));
  }, [setLocalPosts]);

  // Approving sends the post to Publer when this workspace has a Publer key (X is posted by hand)
  const approveLocal = useCallback(async id => {
    const post = localPosts.find(p => p.id === id);
    if (!post) return;

    if (!workspace?.has_publer_key || post.platform === 'x') {
      patchLocal(id, { status: 'approved', approvedAt: new Date().toISOString(), error: null });
      toast({
        tone: 'success',
        title: 'Approved',
        body: post.platform === 'x' ? 'Copy it and post it on X when it is time.' : 'Connect Publer in Settings to post it automatically.',
      });
      return;
    }

    patchLocal(id, { status: 'publishing', error: null });
    try {
      await apiJson('/api/publish', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: workspace.id,
          post: {
            content: post.content,
            platform: post.platform,
            pillar: post.pillar,
            image: post.image,
            scheduledFor: isValidDate(post.scheduledFor) ? post.scheduledFor : null,
          },
        }),
      });
      patchLocal(id, { status: 'published', publishedAt: new Date().toISOString(), approvedAt: new Date().toISOString() });
      toast({
        tone: 'success',
        title: isValidDate(post.scheduledFor) && new Date(post.scheduledFor) > new Date() ? 'Scheduled in Publer' : 'Sent to Publer',
        body: `${PLATFORM_NAMES[post.platform]} post is on its way.`,
      });
    } catch (error) {
      patchLocal(id, { status: 'approved', approvedAt: new Date().toISOString(), error: error.message });
      toast({ tone: 'error', title: 'Publer did not take it', body: [error.message, error.hint].filter(Boolean).join(' ') });
    }
  }, [localPosts, workspace, patchLocal, toast]);

  const rejectLocal = useCallback(id => patchLocal(id, { status: 'rejected' }), [patchLocal]);
  const returnLocal = useCallback(id => patchLocal(id, { status: 'pending', approvedAt: null, error: null }), [patchLocal]);
  const editLocal = useCallback((id, content) => patchLocal(id, { content }), [patchLocal]);
  const removeLocalImage = useCallback(id => patchLocal(id, { image: null }), [patchLocal]);

  const deleteLocal = useCallback(async id => {
    const ok = await confirm({ title: 'Delete this post?', body: 'It is removed from this browser. This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (ok) setLocalPosts(prev => prev.filter(p => p.id !== id));
  }, [confirm, setLocalPosts]);

  const copyText = useCallback(async text => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: 'Copied', body: 'Paste it into Publer or the platform.' });
    } catch {
      toast({ tone: 'error', title: 'Could not copy', body: 'Select the text and copy it by hand.' });
    }
  }, [toast]);

  // ---------- Actions on server posts (Touchline HQ, API) ----------

  const serverAction = useCallback(async (item, action, force = false) => {
    if (action === 'cancel' && !force) {
      const ok = await confirm({ title: 'Cancel this post?', body: 'It is removed from Publer and will not go out.', confirmLabel: 'Cancel post', cancelLabel: 'Keep it', tone: 'danger' });
      if (!ok) return;
    }
    try {
      await apiJson(`/api/workspaces/${activeId}/posts/${item.id}/${action}`, { method: 'POST', body: JSON.stringify({ force }) });
      const done = { cancel: 'Post cancelled', approve: 'Approved and sent to Publer', retry: 'Sent to Publer again' };
      toast({ tone: 'success', title: done[action] || 'Done' });
    } catch (error) {
      if (error.status === 409 && !force && (action === 'cancel' || action === 'retry')) {
        const ok = await confirm({
          title: action === 'cancel' ? 'Not found in Publer' : 'Publer may already have it',
          body: error.message,
          confirmLabel: action === 'cancel' ? 'Mark it cancelled' : 'Send it again',
        });
        if (ok) return serverAction(item, action, true);
      } else {
        toast({ tone: 'error', title: `Could not ${action} this post`, body: error.message });
      }
    }
    await reloadServerPosts();
  }, [activeId, confirm, toast, reloadServerPosts]);

  const value = {
    page, param, navigate,
    serverConfig, workspaces, workspace, switchWorkspace, updateWorkspace,
    settings, updateSettings,
    localPosts, serverPosts, serverState, reloadServerPosts, items, counts,
    generator, setGenerator,
    addDraft, approveLocal, rejectLocal, returnLocal, editLocal, removeLocalImage, deleteLocal, copyText,
    serverAction,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export const useStudio = () => useContext(StudioContext);
