import express from 'express';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  requireAdmin, handleLogin, handleLogout, handleMe,
  safeEqual, sha256, envKeyFor, envKeyName, bearerToken,
} from './server/auth.js';
import { createStore } from './server/store.js';
import { askClaude, claudeApiKey, CLAUDE_KEY_MISSING } from './server/claude.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Railway terminates HTTPS in front of us; trust it so req.secure and req.ip are correct
app.set('trust proxy', 1);

// Initialize Supabase client (if configured)
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// Persistent store for workspace secrets (Supabase table or Railway Volume file)
const store = createStore(supabase);

// ============ CONTEXT HELPER FUNCTIONS ============

// Fetch all context for prompt building
async function getGenerationContext(userId = 'default') {
  if (!supabase) {
    // Return hardcoded defaults if Supabase not configured
    return getDefaultContext();
  }

  const [profileResult, venturesResult, pillarsResult, storiesResult] = await Promise.all([
    supabase.from('context_profile').select('*').eq('user_id', userId).single(),
    supabase.from('ventures').select('*').eq('user_id', userId).eq('include_in_posts', true).order('sort_order'),
    supabase.from('content_pillars').select('*').eq('user_id', userId).eq('active', true).order('sort_order'),
    supabase.from('story_bank').select('*').eq('user_id', userId).order('times_used', { ascending: true }).limit(3)
  ]);

  // Fall back to defaults if no data found
  if (!profileResult.data && !venturesResult.data?.length) {
    return getDefaultContext();
  }

  return {
    profile: profileResult.data,
    ventures: venturesResult.data || [],
    pillars: pillarsResult.data || [],
    stories: storiesResult.data || []
  };
}

// Default context (used when Supabase not configured)
function getDefaultContext() {
  return {
    profile: {
      about_me: 'Founder of MoonBoots Consultancy, a strategic advisory firm helping businesses cut through AI and Web3 hype with practical strategy that actually ships. Grassroots football coach. Dad of 3.',
      background: 'Former enterprise consultant turned founder. Built multiple AI-powered products including Touchline (AI coaching platform). Deep experience bridging strategy to execution for startups and enterprise clients.',
      tone_keywords: ['direct', 'conversational', 'no jargon', 'occasionally contrarian', 'uses analogies'],
      avoid_words: ['synergy', 'leverage', 'disrupt', 'Web3 native', 'paradigm shift', 'move the needle', 'circle back'],
      signature_phrases: ['clarity over hype', 'own vs rent your audience', 'strategy to execution', 'practical, not theoretical']
    },
    ventures: [
      { name: 'MoonBoots Consultancy', website: 'moonbootsconsultancy.net', description: 'Professional services and advisory arm delivering AI strategy, agentic AI development, business transformation and Web3 integration.', key_messages: ['Business enablement bridge', 'Hands-on implementation', 'AI strategy that ships'] },
      { name: 'Touchline', website: 'touchline.xyz', description: 'AI-powered coaching platform for grassroots football coaches. Tactical analysis, training session generation, player development tools.', key_messages: ['AI for real coaches', 'Grassroots football deserves better tools'] },
      { name: 'Moments', website: null, description: 'White-label community platform for creators to own their audience relationships. Memberships, badges, gated content, live-streaming.', key_messages: ['Own your audience, dont rent it', 'Platform independence'] },
      { name: 'DeepFabrik', website: null, description: 'Modular Web3 tooling and blockchain solutions. Tokenization platforms, decentralized applications.', key_messages: ['Web3 infrastructure', 'Tokenization done right'] }
    ],
    pillars: [
      { name: 'AI Strategy', description: 'Practical AI implementation without the hype', example_angles: ['AI tools that actually save time', 'When NOT to use AI', 'AI strategy vs AI theatre'] },
      { name: 'Community Ownership', description: 'Own vs rent your audience - platform independence', example_angles: ['Creator platform dependency risks', 'Building owned audiences'] },
      { name: 'Building in Public', description: 'Lessons from building MoonBoots ecosystem', example_angles: ['What I learned this week', 'Founder lessons', 'Shipping over perfecting'] },
      { name: 'Sport & Culture', description: 'Leadership, coaching mindset, football', example_angles: ['Football coaching parallels', 'Team culture', 'Grassroots sport'] }
    ],
    stories: []
  };
}

// Build dynamic system prompt from context
function buildSystemPrompt(context, selectedPillar) {
  const { profile, ventures, stories } = context;

  // Build ventures section
  const venturesText = ventures.map((v, i) => {
    let text = `${i + 1}. ${v.name.toUpperCase()}`;
    if (v.website) text += `\n   Website: ${v.website}`;
    text += `\n   ${v.description}`;
    if (v.key_messages?.length) {
      text += `\n   Key messages: ${v.key_messages.join(', ')}`;
    }
    return text;
  }).join('\n\n');

  // Build stories section
  const storiesText = stories.length > 0
    ? `\n\nREAL STORIES TO REFERENCE (use naturally, don't force):\n${stories.map(s => `- ${s.title}: "${s.story}"`).join('\n')}`
    : '';

  // Build tone instructions
  const toneText = profile?.tone_keywords?.length
    ? `Voice characteristics: ${profile.tone_keywords.join(', ')}`
    : 'Voice: direct, conversational, no jargon';

  const avoidText = profile?.avoid_words?.length
    ? `\n\nNEVER use these words/phrases: ${profile.avoid_words.join(', ')}`
    : '';

  const phrasesText = profile?.signature_phrases?.length
    ? `\n\nSignature phrases to use naturally: ${profile.signature_phrases.join(', ')}`
    : '';

  return `You are writing social media content as the founder of the MoonBoots Labs ecosystem.

ABOUT THE FOUNDER:
${profile?.about_me || 'Founder and consultant helping businesses with AI and Web3 strategy.'}

${profile?.background || ''}

THE MOONBOOTS LABS ECOSYSTEM:

${venturesText}
${storiesText}

VOICE AND TONE:
${toneText}
${avoidText}
${phrasesText}

CONTENT GUIDELINES:
- Sound authentic and conversational, not corporate
- Share genuine insights and perspectives
- Use short paragraphs and line breaks for readability
- Optimise for each platform's style and audience
- Be practical and actionable, not theoretical
- Draw from real experience - reference specific ventures or stories where relevant
${selectedPillar ? `\nCurrent content pillar focus: ${selectedPillar.name} - ${selectedPillar.description}` : ''}`;
}

// ============ WORKSPACE / MULTI-TENANT SYSTEM ============

// Default workspaces (used when Supabase not configured)
const defaultWorkspaces = [
  {
    id: 'moonboots',
    name: 'MoonBoots',
    slug: 'moonboots',
    brand_config: {
      tagline: 'Strategy to Execution',
      tone: 'Direct, conversational, no jargon, occasionally contrarian',
      forbidden_topics: [],
      posting_frequency: {
        linkedin: { min: 3, max: 5, days: ['Tuesday', 'Wednesday', 'Thursday'], hours: [8, 9, 10, 12] },
        facebook: { min: 3, max: 7, days: ['Wednesday', 'Thursday', 'Friday'], hours: [9, 11, 13, 15] },
        x: { min: 7, max: 21, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], hours: [9, 12, 15, 17] },
        instagram: { min: 3, max: 5, days: ['Monday', 'Wednesday', 'Friday', 'Sunday'], hours: [11, 13, 18, 20] },
      },
    },
    pillars: [
      { id: 'ai', name: 'AI Strategy', description: 'Practical AI implementation without the hype', example_angles: ['AI tools that actually save time', 'When NOT to use AI', 'AI strategy vs AI theatre'] },
      { id: 'web3', name: 'Web3', description: 'Infrastructure for trust and ownership', example_angles: ['Creator platform dependency risks', 'Building owned audiences'] },
      { id: 'community', name: 'Community Building', description: 'Own vs rent your audience', example_angles: ['Platform independence', 'Community as product'] },
      { id: 'transformation', name: 'Business Transformation', description: 'Bridging strategy to execution', example_angles: ['Founder lessons', 'Shipping over perfecting'] },
      { id: 'sport', name: 'Sport & Culture', description: 'Leadership, coaching mindset, football', example_angles: ['Football coaching parallels', 'Team culture'] },
    ],
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'touchline',
    name: 'Touchline',
    slug: 'touchline',
    brand_config: {
      tagline: 'Empowering Grassroots Football',
      tone: 'Enthusiastic, knowledgeable, supportive, community-focused. Never corporate or salesy.',
      forbidden_topics: ['Gambling', 'Alcohol', 'Politics', 'Professional transfer gossip'],
      posting_frequency: {
        linkedin: { min: 3, max: 5, days: ['Tuesday', 'Wednesday', 'Thursday'], hours: [8, 9, 10] },
        facebook: { min: 5, max: 10, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], hours: [8, 12, 17, 19] },
        x: { min: 7, max: 21, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], hours: [7, 9, 12, 17, 19] },
        instagram: { min: 3, max: 5, days: ['Monday', 'Wednesday', 'Friday', 'Sunday'], hours: [8, 12, 18] },
      },
    },
    pillars: [
      { id: 'coaching', name: 'Coaching Tips & Drills', description: 'Practical coaching advice for grassroots football', example_angles: ['Training drill of the week', 'Session planning tips', 'Age-appropriate coaching'] },
      { id: 'grassroots', name: 'Grassroots Football Culture', description: 'Celebrating the grassroots game', example_angles: ['Weekend matchday stories', 'Why grassroots matters', 'Volunteer appreciation'] },
      { id: 'development', name: 'Player Development', description: 'Helping young players grow', example_angles: ['Technical skill progression', 'Mental resilience', 'Fun-first philosophy'] },
      { id: 'community', name: 'Community & Club Stories', description: 'Stories from clubs and communities', example_angles: ['Club spotlights', 'Parent involvement', 'Inclusive football'] },
      { id: 'product', name: 'Product Updates & Features', description: 'Touchline platform news', example_angles: ['New features', 'How coaches use Touchline', 'Roadmap previews'] },
    ],
    created_at: '2026-01-30T00:00:00Z',
  },
];

// In-memory workspace store (Supabase-backed when available)
let workspacesCache = [...defaultWorkspaces];

async function getWorkspaces() {
  if (!supabase) return workspacesCache;

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at');

    if (error || !data?.length) return workspacesCache;
    return data;
  } catch {
    return workspacesCache;
  }
}

async function getWorkspaceById(id) {
  const workspaces = await getWorkspaces();
  return workspaces.find(w => w.id === id || w.slug === id);
}

// Server-only workspace settings: Publer key, Publer account choices, generated API key hash.
// Never sent to the browser in full.
async function getWorkspaceSecrets(workspaceId) {
  try {
    return (await store.get('workspace_settings', workspaceId)) || {};
  } catch (error) {
    console.error(`Failed to read settings for workspace ${workspaceId}:`, error.message);
    return {};
  }
}

async function updateWorkspaceSecrets(workspaceId, updates) {
  // Read straight from the store so a failed read can't wipe the saved settings
  const current = (await store.get('workspace_settings', workspaceId)) || {};
  const next = { ...current, ...updates, updated_at: new Date().toISOString() };
  for (const key of Object.keys(next)) {
    if (next[key] === undefined || next[key] === null) delete next[key];
  }
  return store.set('workspace_settings', workspaceId, next);
}

const lastFour = (value) => (value ? String(value).slice(-4) : null);

// The only workspace fields the browser is allowed to see
async function publicWorkspace(ws) {
  const secrets = await getWorkspaceSecrets(ws.id);
  const envKey = envKeyFor(ws);
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    brand_config: ws.brand_config,
    pillars: ws.pillars,
    created_at: ws.created_at,
    has_api_key: !!(envKey || secrets.api_key_hash),
    api_key_source: envKey ? 'railway' : secrets.api_key_hash ? 'generated' : null,
    api_key_env_name: envKeyName(ws),
    api_key_last4: envKey ? lastFour(envKey) : secrets.api_key_last4 || null,
    has_publer_key: !!secrets.publer_api_key,
    publer_key_last4: lastFour(secrets.publer_api_key),
    platform_accounts: secrets.platform_accounts || {},
  };
}

// A workspace key comes from its Railway variable (e.g. TOUCHLINE_API_KEY) when set;
// otherwise from a key generated in Settings (only its hash is stored).
async function getWorkspaceByApiKey(apiKey) {
  if (!apiKey) return null;

  const workspaces = await getWorkspaces();
  for (const ws of workspaces) {
    const envKey = envKeyFor(ws);
    if (envKey) {
      if (safeEqual(apiKey, envKey)) return ws;
      continue;
    }
    const secrets = await getWorkspaceSecrets(ws.id);
    if (secrets.api_key_hash && safeEqual(sha256(apiKey), secrets.api_key_hash)) return ws;
  }

  return null;
}

// Build workspace-specific system prompt
function buildWorkspaceSystemPrompt(workspace, selectedPillar) {
  const config = workspace.brand_config || {};
  const pillars = workspace.pillars || [];

  const forbiddenText = config.forbidden_topics?.length
    ? `\n\nNEVER discuss or reference: ${config.forbidden_topics.join(', ')}`
    : '';

  const pillarDetail = selectedPillar
    ? pillars.find(p => p.name === selectedPillar || p.id === selectedPillar)
    : null;

  if (workspace.slug === 'moonboots') {
    // Use the existing rich context system for MoonBoots
    return null; // signals caller to use getGenerationContext + buildSystemPrompt
  }

  return `You are writing social media content for ${workspace.name}.
${config.tagline ? `Brand: ${workspace.name} - "${config.tagline}"` : ''}

VOICE AND TONE:
${config.tone || 'Professional and engaging.'}
${forbiddenText}

CONTENT PILLARS:
${pillars.map((p, i) => `${i + 1}. ${p.name}: ${p.description}${p.example_angles?.length ? ` (angles: ${p.example_angles.join(', ')})` : ''}`).join('\n')}

CONTENT GUIDELINES:
- Sound authentic and on-brand
- Share genuine insights and perspectives
- Use short paragraphs and line breaks for readability
- Optimise for each platform's style and audience
- Be practical and actionable
${pillarDetail ? `\nCurrent content pillar focus: ${pillarDetail.name} - ${pillarDetail.description}` : ''}`;
}

// Workspace API key (Bearer) authentication for Touchline HQ / Marcus.
// The workspace always comes from the key, never from the request body.
function authenticateApiKey(req, res, next) {
  const apiKey = bearerToken(req);
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer <API_KEY>' });
  }

  getWorkspaceByApiKey(apiKey).then(workspace => {
    if (!workspace) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.workspace = workspace;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Authentication failed' });
  });
}

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// ============ ACCESS CONTROL ============
// Every /api route needs the admin login, except:
// - health and login routes (public)
// - /api/posts and /api/v1/* (workspace API key, used by Touchline HQ)
const PUBLIC_API_PATHS = new Set(['/health', '/auth/login', '/auth/logout', '/auth/me']);

function isWorkspaceKeyPath(path) {
  return path === '/posts' || path === '/posts/' || path.startsWith('/v1/');
}

app.use('/api', (req, res, next) => {
  const path = req.path.toLowerCase();
  if (PUBLIC_API_PATHS.has(path)) return next();
  if (isWorkspaceKeyPath(path)) return authenticateApiKey(req, res, next);
  return requireAdmin(req, res, next);
});

app.post('/api/auth/login', handleLogin);
app.post('/api/auth/logout', handleLogout);
app.get('/api/auth/me', handleMe);

async function storageStatus() {
  const check = await store.check();
  return { type: store.type, persistent: store.persistent, ...check };
}

// What the server has configured (never the keys themselves)
app.get('/api/config', async (req, res) => {
  res.json({
    claude: !!claudeApiKey(),
    storage: await storageStatus(),
  });
});

// ============ PUBLER HELPERS ============

async function getSavedPublerKey(workspaceId) {
  if (!workspaceId) return null;
  const secrets = await getWorkspaceSecrets(workspaceId);
  return secrets.publer_api_key || null;
}

const NO_PUBLER_KEY = 'No Publer API key saved for this workspace. Paste one in Settings.';
const PUBLER_TIMEOUT_MS = 15000;

// Check a Publer key and list the social accounts it can post to
async function fetchPublerAccounts(apiKey) {
  const wsResponse = await fetch('https://app.publer.com/api/v1/workspaces', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer-API ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(PUBLER_TIMEOUT_MS),
  });

  const wsText = await wsResponse.text();
  console.log('Publer workspaces response status:', wsResponse.status);

  if (wsText.trim().startsWith('<')) {
    const titleMatch = wsText.match(/<title>(.*?)<\/title>/i);
    const errorTitle = titleMatch ? titleMatch[1] : 'Unknown error';
    console.error('Publer returned HTML page:', errorTitle);
    return {
      ok: false,
      status: 401,
      error: `Publer API error: ${errorTitle}. Check your API key format and plan.`,
      hint: 'API key should be the full key from app.publer.com/settings',
    };
  }

  let workspaces;
  try {
    workspaces = JSON.parse(wsText);
  } catch (e) {
    return { ok: false, status: 502, error: 'Invalid response from Publer' };
  }

  if (!wsResponse.ok || !workspaces || !workspaces.length) {
    return { ok: false, status: 401, error: workspaces?.message || 'No workspaces found. Check your API key.' };
  }

  const publerWorkspaceId = workspaces[0].id;

  const response = await fetch('https://app.publer.com/api/v1/accounts', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer-API ${apiKey}`,
      'Publer-Workspace-Id': publerWorkspaceId,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(PUBLER_TIMEOUT_MS),
  });

  const responseText = await response.text();
  if (responseText.trim().startsWith('<')) {
    console.error('Publer accounts returned HTML:', responseText.substring(0, 200));
    return { ok: false, status: 401, error: 'Invalid API key. Publer returned an error page.' };
  }

  let accounts;
  try {
    accounts = JSON.parse(responseText);
  } catch (parseErr) {
    return { ok: false, status: 502, error: 'Invalid response from Publer' };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, error: accounts.message || accounts.error || 'Failed to connect to Publer' };
  }

  // Publer may use different field names: social_network, type, network, platform
  const getAccountPlatform = (acc) => acc.social_network || acc.type || acc.network || acc.platform || 'unknown';
  const getAccountName = (acc) => acc.name || acc.username || acc.display_name || getAccountPlatform(acc);

  return {
    ok: true,
    publerWorkspaceId,
    accounts: (Array.isArray(accounts) ? accounts : []).map(a => ({
      id: a.id,
      platform: getAccountPlatform(a),
      name: getAccountName(a),
    })),
  };
}

// Publer - Get connected social accounts (uses the workspace's saved key)
app.post('/api/publer/accounts', async (req, res) => {
  const apiKey = await getSavedPublerKey(req.body?.workspaceId);
  if (!apiKey) {
    return res.status(400).json({ error: NO_PUBLER_KEY });
  }

  try {
    const result = await fetchPublerAccounts(apiKey);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, hint: result.hint });
    }
    res.json({ success: true, accounts: result.accounts });
  } catch (error) {
    console.error('Publer accounts failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Publer' });
  }
});

// Publer connection test (uses the workspace's saved key)
app.post('/api/publer/test', async (req, res) => {
  const apiKey = await getSavedPublerKey(req.body?.workspaceId);
  if (!apiKey) {
    return res.status(400).json({ error: NO_PUBLER_KEY });
  }

  try {
    const result = await fetchPublerAccounts(apiKey);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, hint: result.hint });
    }
    res.json({
      success: true,
      accountCount: result.accounts.length,
      accounts: result.accounts.map(a => `${a.name} (${a.platform})`).join(', ') || 'None',
      accountsList: result.accounts,
    });
  } catch (error) {
    console.error('Publer test failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Publer' });
  }
});

// Publer API proxy endpoint
app.post('/api/publish', async (req, res) => {
  const { workspaceId, post } = req.body;

  // Publer key and account choices come from the workspace's server-side settings
  const secrets = workspaceId ? await getWorkspaceSecrets(workspaceId) : {};
  const apiKey = secrets.publer_api_key;
  const socialAccountId = post?.platform ? secrets.platform_accounts?.[post.platform] : null;

  if (!apiKey) {
    return res.status(400).json({ error: NO_PUBLER_KEY });
  }

  if (!post) {
    return res.status(400).json({ error: 'Post data is required' });
  }

  // Platform mapping for Publer's platform identifiers
  // Publer uses: in_profile (LinkedIn), ig_business (Instagram), twitter (X)
  const platformMatchers = {
    linkedin: ['linkedin', 'in_profile', 'in_'],
    facebook: ['facebook', 'fb_page', 'fb_'],
    instagram: ['instagram', 'ig_business', 'ig_'],
    x: ['twitter', 'x'],
  };

  const matchers = platformMatchers[post.platform] || [post.platform];

  try {
    // First get workspace ID
    const wsResponse = await fetch('https://app.publer.com/api/v1/workspaces', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer-API ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const wsText = await wsResponse.text();
    if (wsText.trim().startsWith('<')) {
      return res.status(401).json({
        error: 'Invalid API key or API access not enabled.',
        hint: 'Publer API requires Business or Enterprise plan'
      });
    }

    let workspaces;
    try {
      workspaces = JSON.parse(wsText);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid response from Publer' });
    }

    if (!wsResponse.ok || !workspaces || workspaces.length === 0) {
      return res.status(401).json({
        error: workspaces?.message || 'No workspaces found'
      });
    }

    const workspaceId = workspaces[0].id;

    // If no socialAccountId provided, try to find one
    let accountId = socialAccountId;

    if (!accountId) {
      // Fetch accounts to find matching platform
      const accountsResponse = await fetch('https://app.publer.com/api/v1/accounts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer-API ${apiKey}`,
          'Publer-Workspace-Id': workspaceId,
          'Content-Type': 'application/json',
        },
      });

      // Get response as text first to handle HTML error pages
      const accountsText = await accountsResponse.text();

      // Check if response is HTML (error page - usually invalid API key)
      if (accountsText.trim().startsWith('<')) {
        console.error('Publer accounts API returned HTML:', accountsText.substring(0, 200));
        return res.status(401).json({
          error: 'Publer API key appears to be invalid. Please check your API key in Settings.',
          hint: 'Get your API key from Publer → Settings → API Access'
        });
      }

      let accounts;
      try {
        accounts = JSON.parse(accountsText);
      } catch (parseErr) {
        console.error('Failed to parse Publer accounts response:', accountsText.substring(0, 200));
        return res.status(500).json({
          error: 'Invalid response from Publer API',
        });
      }

      if (!accountsResponse.ok) {
        return res.status(accountsResponse.status).json({
          error: accounts.message || accounts.error || 'Failed to fetch social accounts',
          details: accounts
        });
      }

      // Find account matching platform using matchers
      const matchingAccount = accounts.find(acc => {
        const accPlatform = (acc.platform || acc.social_network || acc.type || '').toLowerCase();
        return matchers.some(m => accPlatform.includes(m.toLowerCase()));
      });

      if (!matchingAccount) {
        return res.status(400).json({
          error: `No ${post.platform} account connected in Publer. Please connect your ${post.platform} account in Publer first.`,
          availableAccounts: accounts.map(a => ({ id: a.id, platform: a.platform || a.social_network || a.type, name: a.name }))
        });
      }

      accountId = matchingAccount.id;
    }

    // Map platform to Publer network provider
    const platformToNetwork = {
      linkedin: 'linkedin',
      facebook: 'facebook',
      instagram: 'instagram',
      x: 'twitter',
    };
    const networkProvider = platformToNetwork[post.platform] || post.platform;

    // Handle image upload if present - Publer requires media ID, not URL
    let mediaId = null;
    if (post.image && post.image.startsWith('data:')) {
      // Upload base64 image to Publer's media endpoint using multipart/form-data
      try {
        const base64Data = post.image.split(',')[1];
        const mimeType = post.image.split(';')[0].split(':')[1] || 'image/png';
        const extension = mimeType.split('/')[1] || 'png';

        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Create form data with the file
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const filename = `image_${Date.now()}.${extension}`;

        const bodyParts = [
          `--${boundary}\r\n`,
          `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
          `Content-Type: ${mimeType}\r\n\r\n`,
        ];

        const bodyStart = Buffer.from(bodyParts.join(''));
        const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([bodyStart, buffer, bodyEnd]);

        console.log('Uploading media to Publer (multipart)...');
        const uploadResponse = await fetch('https://app.publer.com/api/v1/media', {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Authorization': `Bearer-API ${apiKey}`,
            'Publer-Workspace-Id': workspaceId,
          },
          body: body,
        });

        const uploadText = await uploadResponse.text();
        console.log('Media upload response:', uploadText.substring(0, 500));

        // Check if response is HTML (error page)
        if (uploadText.trim().startsWith('<')) {
          console.error('Publer media upload returned HTML error');
          // Continue without image
        } else {
          try {
            const uploadData = JSON.parse(uploadText);
            if (uploadResponse.ok && uploadData.id) {
              mediaId = uploadData.id;
              console.log('Media uploaded successfully, ID:', mediaId);
            } else {
              console.error('Publer media upload failed:', uploadData);
            }
          } catch (parseErr) {
            console.error('Failed to parse media upload response:', uploadText.substring(0, 200));
          }
        }
      } catch (uploadError) {
        console.error('Media upload error:', uploadError);
        // Continue without image
      }
    } else if (post.image) {
      // Upload from URL using Publer's from-url endpoint
      try {
        console.log('Uploading media from URL to Publer...');
        const uploadResponse = await fetch('https://app.publer.com/api/v1/media/from-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer-API ${apiKey}`,
            'Publer-Workspace-Id': workspaceId,
          },
          body: JSON.stringify({ url: post.image }),
        });

        const uploadText = await uploadResponse.text();
        console.log('Media from-url response:', uploadText.substring(0, 500));

        if (!uploadText.trim().startsWith('<')) {
          const uploadData = JSON.parse(uploadText);
          if (uploadResponse.ok && uploadData.id) {
            mediaId = uploadData.id;
            console.log('Media uploaded from URL, ID:', mediaId);
          }
        }
      } catch (uploadError) {
        console.error('Media from-url error:', uploadError);
      }
    }

    // Build network-specific content
    const networkContent = {
      type: mediaId ? 'photo' : 'status',
      text: post.content,
    };

    // Add media array with ID if we have it (Publer format)
    if (mediaId) {
      networkContent.media = [{ id: mediaId, type: 'photo' }];
    }

    // Build account entry with optional scheduling
    const accountEntry = {
      id: accountId,
    };
    if (post.scheduledFor) {
      accountEntry.scheduled_at = new Date(post.scheduledFor).toISOString();
    }

    // Build the correct Publer bulk payload format
    const payload = {
      bulk: {
        state: post.scheduledFor ? 'scheduled' : 'scheduled', // scheduled for both (immediate posts also use scheduled with current time)
        posts: [
          {
            networks: {
              [networkProvider]: networkContent,
            },
            accounts: [accountEntry],
          },
        ],
      },
    };

    // If no scheduled time, schedule for 1 minute from now (Publer requires future time)
    if (!post.scheduledFor) {
      const oneMinuteFromNow = new Date(Date.now() + 60 * 1000).toISOString();
      payload.bulk.posts[0].accounts[0].scheduled_at = oneMinuteFromNow;
    }

    console.log('Publer payload:', JSON.stringify(payload, null, 2));
    console.log('Publishing to Publer with workspaceId:', workspaceId, 'accountId:', accountId);

    const postUrl = 'https://app.publer.com/api/v1/posts/schedule';
    const postHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer-API ${apiKey}`,
      'Publer-Workspace-Id': workspaceId,
    };

    console.log('POST URL:', postUrl);

    const response = await fetch(postUrl, {
      method: 'POST',
      headers: postHeaders,
      body: JSON.stringify(payload),
    });

    // Handle potential HTML error responses
    const responseText = await response.text();
    console.log('Publer response status:', response.status);
    console.log('Publer response:', responseText.substring(0, 500));

    // Check if response is HTML (error page)
    if (responseText.trim().startsWith('<')) {
      console.error('Publer API returned HTML error page');
      return res.status(500).json({
        error: 'Publer API returned an error page. Please check your API key and try again.',
        hint: 'Your Publer API key may be invalid or expired.',
        debug: `Status: ${response.status}`
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Publer response:', responseText.substring(0, 200));
      return res.status(500).json({
        error: 'Invalid response from Publer API',
        raw: responseText.substring(0, 200)
      });
    }

    if (!response.ok) {
      console.error('Publer API error:', data);
      return res.status(response.status).json({
        error: data.message || data.error || JSON.stringify(data) || 'Failed to publish to Publer',
        details: data
      });
    }

    // Publer returns a job_id for async operations - poll for completion
    const jobId = data.job_id;
    if (!jobId) {
      console.log('No job_id returned, assuming immediate success:', data);
      return res.json({ success: true, data, status: 'completed' });
    }

    console.log('Got job_id:', jobId, '- polling for completion...');

    // Poll job status (max 30 seconds, check every 2 seconds)
    let jobComplete = false;
    let jobResult = null;
    let attempts = 0;
    const maxAttempts = 15;

    while (!jobComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;

      try {
        const statusResponse = await fetch(`https://app.publer.com/api/v1/job_status/${jobId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer-API ${apiKey}`,
            'Publer-Workspace-Id': workspaceId,
          },
        });

        const statusText = await statusResponse.text();
        console.log(`Job status attempt ${attempts}:`, statusText.substring(0, 300));

        if (!statusText.trim().startsWith('<')) {
          jobResult = JSON.parse(statusText);

          // Check if job is complete (status might be 'complete', 'done', 'failed', etc.)
          if (jobResult.status === 'complete' || jobResult.status === 'done' ||
              jobResult.status === 'failed' || jobResult.status === 'error' ||
              jobResult.done === true || jobResult.complete === true) {
            jobComplete = true;
          }

          // Also check for payload with results
          if (jobResult.payload && (jobResult.payload.posts || jobResult.payload.errors)) {
            jobComplete = true;
          }
        }
      } catch (pollError) {
        console.error('Job polling error:', pollError);
      }
    }

    if (!jobComplete) {
      console.log('Job polling timed out, returning pending status');
      return res.json({
        success: true,
        data,
        jobId,
        status: 'pending',
        message: 'Post scheduled - check Publer for status'
      });
    }

    // Check if job failed
    if (jobResult?.status === 'failed' || jobResult?.status === 'error' ||
        jobResult?.payload?.errors?.length > 0) {
      const errorMsg = jobResult?.payload?.errors?.[0]?.message ||
                       jobResult?.error ||
                       jobResult?.message ||
                       'Post failed in Publer';
      console.error('Publer job failed:', jobResult);
      return res.status(400).json({
        error: errorMsg,
        details: jobResult
      });
    }

    console.log('Job completed successfully:', jobResult);
    res.json({ success: true, data: jobResult, jobId, status: 'completed' });
  } catch (error) {
    console.error('Publer publish failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Publer' });
  }
});

// ============ CONTENT GENERATION (Claude) ============

const POST_PLATFORMS = ['linkedin', 'facebook', 'x', 'instagram'];

const PLATFORM_GUIDELINES = `Platform guidelines:
- LinkedIn: Professional but human. Can be longer (1000-1500 chars). Use line breaks between paragraphs. No hashtags or max 3 relevant ones at the end.
- X/Twitter: Concise and punchy. Under 280 characters ideal. Can be provocative or contrarian. No hashtags unless essential.
- Facebook: Conversational and shareable. 100-250 characters ideal for engagement. Ask questions or share insights. Use 1-2 hashtags max.
- Instagram: Engaging caption. More personal tone. Include 5-10 relevant hashtags at the very end, separated from main content.`;

// Claude must reply with one post per requested platform
function postsSchema(platforms) {
  return {
    type: 'object',
    properties: Object.fromEntries(platforms.map(p => [p, { type: 'string' }])),
    required: platforms,
    additionalProperties: false,
  };
}

function buildPostsPrompt(topic, pillarLine, anglesLine, platforms) {
  return `Create social media posts about: "${topic}"
${pillarLine}
${anglesLine}

Generate unique, platform-optimised content for: ${platforms.join(', ')}

${PLATFORM_GUIDELINES}

Reply with one post per platform, keyed by platform name.`;
}

// System prompt for a workspace: MoonBoots uses its rich context system, others their brand config
async function systemPromptFor(workspace, pillar, userId = 'default') {
  if (workspace && workspace.slug !== 'moonboots') {
    return { systemPrompt: buildWorkspaceSystemPrompt(workspace, pillar), pillarDetail: findPillar(workspace.pillars, pillar) };
  }
  const context = await getGenerationContext(userId);
  const pillarDetail = findPillar(context.pillars, pillar);
  return { systemPrompt: buildSystemPrompt(context, pillarDetail), pillarDetail };
}

function findPillar(pillars, pillar) {
  if (!pillar) return null;
  return (pillars || []).find(p => p.name === pillar || p.id === pillar) || null;
}

function sendClaudeError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error.message);
  res.status(error.status || 500).json({ error: error.message || fallbackMessage });
}

app.post('/api/generate', async (req, res) => {
  const { topic, pillar, platforms, userId = 'default', workspaceId } = req.body;

  if (!claudeApiKey()) {
    return res.status(503).json({ error: CLAUDE_KEY_MISSING });
  }

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  const enabledPlatforms = Object.entries(platforms || {})
    .filter(([platform, enabled]) => enabled && POST_PLATFORMS.includes(platform))
    .map(([platform]) => platform);

  if (enabledPlatforms.length === 0) {
    return res.status(400).json({ error: 'At least one platform must be selected' });
  }

  try {
    const workspace = workspaceId ? await getWorkspaceById(workspaceId) : null;
    const { systemPrompt, pillarDetail } = await systemPromptFor(workspace, pillar, userId);

    const content = await askClaude({
      purpose: 'drafting',
      system: systemPrompt,
      prompt: buildPostsPrompt(
        topic,
        pillarDetail ? `Content pillar: ${pillarDetail.name}` : `Content pillar: ${pillar || 'AI Strategy'}`,
        pillarDetail?.example_angles?.length ? `Possible angles: ${pillarDetail.example_angles.join(', ')}` : '',
        enabledPlatforms,
      ),
      schema: postsSchema(enabledPlatforms),
    });

    res.json({ success: true, content });
  } catch (error) {
    sendClaudeError(res, error, 'Failed to generate content');
  }
});

// Topic suggestion endpoint (planning model)
app.post('/api/suggest-topic', async (req, res) => {
  const { pillar, workspaceId } = req.body;

  if (!claudeApiKey()) {
    return res.status(503).json({ error: CLAUDE_KEY_MISSING });
  }

  const workspace = workspaceId ? await getWorkspaceById(workspaceId) : null;

  let prompt;
  if (workspace && workspace.slug !== 'moonboots') {
    prompt = `${buildWorkspaceSystemPrompt(workspace, pillar)}

Based on the content pillar "${pillar || workspace.pillars?.[0]?.name || 'general'}", suggest ONE specific, useful topic for a social media post.

The topic should:
- Be specific enough to write about (not generic)
- Speak to the audience this pillar is for
- Follow every brand rule above

Return ONLY the topic text, nothing else. No quotes, no explanation. Just the topic idea in 1-2 sentences.`;
  } else {
    const moonbootsContext = `moonboots labs is a consultancy and venture studio ecosystem comprising:

THE MOONBOOTS LABS ECOSYSTEM:

1. MOONBOOTS CONSULTANCY (Moonboots Consultancy UK Ltd)
   Website: moonbootsconsultancy.net
   The professional services and advisory arm - the "business enablement bridge" delivering:

   Core Services:
   - AI Strategy & Integration Services (helping organisations apply AI meaningfully, bridging Web2→Web3 and AI-first product strategies)
   - Website & Agentic AI Development (building functional AI applications based on specific client requirements)
   - Technical & Operational Enablement (deployment planning, tooling choice, ecosystem integrations)
   - Business Transformation & Web3 Integration (unifying tokens, memberships, governance modules with real-world business models)

   Practical Engagements:
   - Web3 pilot strategy workshops for brands exploring tokens and memberships
   - AI + community product design consulting & development
   - Tokenomics reviews for client tokens or emblems
   - DAO launch consulting (governance, fund design, member incentives)
   - Integration planning for DeepFabrik modules
   - End-to-end implementation for bespoke clients

   Strategic Position: Captures value from organisations needing hands-on implementation rather than self-service. Helps projects move from strategy → execution with real ROI.

2. MOMENTS (Community Building Infrastructure)
   White-label community infrastructure platform - NOT another social network.

   Core capabilities:
   - Memberships & subscriptions with flexible tiers
   - Achievement badges and gamification systems
   - Gated content for exclusive access
   - Live-streaming with real-time engagement
   - Fan timelines and activity feeds
   - Rewards and loyalty programs
   - Direct messaging and community interaction

   Use cases: Musicians, artists, athletes, brands, creators seeking platform independence.

   Strategic value: Own your audience data (not rented from social platforms), brand continuity, platform independence, monetization without gatekeepers.

3. DEEPFABRIK (Web3 Infrastructure)
   Modular Web3 tooling and blockchain solutions. Tokenization platforms, decentralized applications.

4. MOONBOOTS DAO
   Community investment and cultural membership vehicle. Governance, fund design, member incentives.

5. CHAPPYZ
   AI analytics hub and technical integration support.

The founder's perspective: Practical, experience-driven insights from working with both startups and enterprises. Skeptical of hype, focused on what actually works. Values community over vanity metrics, substance over buzzwords. Believes creators and brands should own their audience relationships, not rent them from platforms. Committed to moving from strategy → execution.`;

    prompt = `${moonbootsContext}

Based on the content pillar "${pillar || 'AI Strategy'}", suggest ONE compelling, specific topic for a social media post.

The topic should:
- Be thought-provoking and slightly contrarian
- Draw from real-world experience
- Be specific enough to write about (not generic)
- Appeal to founders, executives, and tech leaders
- Not be clickbait - genuine insight

Return ONLY the topic text, nothing else. No quotes, no explanation. Just the topic idea in 1-2 sentences.`;
  }

  try {
    const topic = await askClaude({ purpose: 'planning', prompt });
    res.json({ success: true, topic });
  } catch (error) {
    sendClaudeError(res, error, 'Failed to suggest topic');
  }
});

// ============ CONTEXT PROFILE ENDPOINTS ============

app.get('/api/context/profile', async (req, res) => {
  const { userId = 'default' } = req.query;

  if (!supabase) {
    // Return defaults if Supabase not configured
    return res.json(getDefaultContext().profile);
  }

  try {
    const { data, error } = await supabase
      .from('context_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || getDefaultContext().profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/context/profile', async (req, res) => {
  const { userId = 'default', ...profileData } = req.body;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to environment.' });
  }

  try {
    const { data, error } = await supabase
      .from('context_profile')
      .upsert({ user_id: userId, ...profileData }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ VENTURES ENDPOINTS ============

app.get('/api/context/ventures', async (req, res) => {
  const { userId = 'default' } = req.query;

  if (!supabase) {
    return res.json(getDefaultContext().ventures);
  }

  try {
    const { data, error } = await supabase
      .from('ventures')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');

    if (error) throw error;
    res.json(data?.length ? data : getDefaultContext().ventures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/context/ventures', async (req, res) => {
  const { userId = 'default', ...ventureData } = req.body;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('ventures')
      .insert({ user_id: userId, ...ventureData })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/context/ventures/:id', async (req, res) => {
  const { id } = req.params;
  const ventureData = req.body;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('ventures')
      .update(ventureData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/context/ventures/:id', async (req, res) => {
  const { id } = req.params;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { error } = await supabase
      .from('ventures')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CONTENT PILLARS ENDPOINTS ============

app.get('/api/context/pillars', async (req, res) => {
  const { userId = 'default' } = req.query;

  if (!supabase) {
    return res.json(getDefaultContext().pillars);
  }

  try {
    const { data, error } = await supabase
      .from('content_pillars')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');

    if (error) throw error;
    res.json(data?.length ? data : getDefaultContext().pillars);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/context/pillars', async (req, res) => {
  const { userId = 'default', ...pillarData } = req.body;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('content_pillars')
      .insert({ user_id: userId, ...pillarData })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/context/pillars/:id', async (req, res) => {
  const { id } = req.params;
  const pillarData = req.body;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('content_pillars')
      .update(pillarData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/context/pillars/:id', async (req, res) => {
  const { id } = req.params;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { error } = await supabase
      .from('content_pillars')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STORY BANK ENDPOINTS ============

app.get('/api/context/stories', async (req, res) => {
  const { userId = 'default' } = req.query;

  if (!supabase) {
    return res.json([]);
  }

  try {
    const { data, error } = await supabase
      .from('story_bank')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/context/stories', async (req, res) => {
  const { userId = 'default', ...storyData } = req.body;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('story_bank')
      .insert({ user_id: userId, ...storyData })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/context/stories/:id', async (req, res) => {
  const { id } = req.params;
  const storyData = req.body;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('story_bank')
      .update(storyData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/context/stories/:id', async (req, res) => {
  const { id } = req.params;

  if (!supabase) {
    return res.status(400).json({ error: 'Supabase not configured' });
  }

  try {
    const { error } = await supabase
      .from('story_bank')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WORKSPACE MANAGEMENT ENDPOINTS (UI, admin login) ============

app.get('/api/workspaces', async (req, res) => {
  try {
    const workspaces = await getWorkspaces();
    res.json(await Promise.all(workspaces.map(publicWorkspace)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workspaces/:id', async (req, res) => {
  try {
    const workspace = await getWorkspaceById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    res.json(await publicWorkspace(workspace));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Only brand fields can be edited here. Keys have their own endpoints.
const EDITABLE_WORKSPACE_FIELDS = ['name', 'brand_config', 'pillars'];

app.put('/api/workspaces/:id', async (req, res) => {
  const { id } = req.params;
  const updates = {};
  for (const field of EDITABLE_WORKSPACE_FIELDS) {
    if (req.body?.[field] !== undefined) updates[field] = req.body[field];
  }

  // Update in-memory cache
  const idx = workspacesCache.findIndex(w => w.id === id || w.slug === id);
  if (idx !== -1) {
    workspacesCache[idx] = { ...workspacesCache[idx], ...updates };
  }

  // Update in Supabase if available
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .upsert({ id, ...updates }, { onConflict: 'id' })
        .select()
        .single();
      if (!error && data) return res.json(await publicWorkspace(data));
    } catch {}
  }

  if (idx !== -1) {
    return res.json(await publicWorkspace(workspacesCache[idx]));
  }
  res.status(404).json({ error: 'Workspace not found' });
});

// Generate API key for a workspace. Only its hash is stored; the key is shown once.
app.post('/api/workspaces/:id/generate-api-key', async (req, res) => {
  const workspace = await getWorkspaceById(req.params.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  if (envKeyFor(workspace)) {
    return res.status(409).json({
      error: `This workspace's API key is set in Railway (${envKeyName(workspace)}). Change it there.`,
    });
  }

  const newKey = `cs_${crypto.randomBytes(32).toString('hex')}`;
  try {
    await updateWorkspaceSecrets(workspace.id, { api_key_hash: sha256(newKey), api_key_last4: lastFour(newKey) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ api_key: newKey });
});

const PUBLISHING_PLATFORMS = ['linkedin', 'facebook', 'instagram', 'x'];

// Save a workspace's Publer key (checked with Publer first) and account choices.
// The key is stored on the server only; the browser sees its last 4 characters.
app.put('/api/workspaces/:id/publer-settings', async (req, res) => {
  const workspace = await getWorkspaceById(req.params.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const { publerApiKey, platformAccounts } = req.body || {};
  const updates = {};
  let accounts;

  if (typeof publerApiKey === 'string' && publerApiKey.trim()) {
    const key = publerApiKey.trim();
    try {
      const result = await fetchPublerAccounts(key);
      if (!result.ok) {
        return res.status(400).json({ error: `Key not saved. ${result.error}`, hint: result.hint });
      }
      accounts = result.accounts;
    } catch (error) {
      return res.status(502).json({ error: `Key not saved. Could not reach Publer: ${error.message}` });
    }
    updates.publer_api_key = key;
  } else if (publerApiKey === null) {
    updates.publer_api_key = null;
  }

  if (platformAccounts !== undefined) {
    if (!platformAccounts || typeof platformAccounts !== 'object' || Array.isArray(platformAccounts)) {
      return res.status(400).json({ error: 'platformAccounts must be an object' });
    }
    const clean = {};
    for (const platform of PUBLISHING_PLATFORMS) {
      const value = platformAccounts[platform];
      if (value !== undefined && value !== null && value !== '') clean[platform] = String(value);
    }
    updates.platform_accounts = clean;
  }

  try {
    await updateWorkspaceSecrets(workspace.id, updates);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, workspace: await publicWorkspace(workspace), accounts });
});

// ============ EXTERNAL API v1 ENDPOINTS (for agents like Marcus) ============

// Generate content via API
app.post('/api/v1/content/generate', authenticateApiKey, async (req, res) => {
  const workspace = req.workspace;
  const {
    topic,
    content_pillar,
    platforms = ['linkedin', 'x', 'instagram'],
    schedule = 'auto',
    include_image = false,
    image_style = 'modern professional',
    brand_voice,
  } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'topic is required' });
  }

  if (!claudeApiKey()) {
    return res.status(503).json({ error: CLAUDE_KEY_MISSING });
  }

  const enabledPlatforms = (Array.isArray(platforms) ? platforms : [platforms]).filter(p => typeof p === 'string' && p);

  try {
    let { systemPrompt } = await systemPromptFor(workspace, content_pillar);

    // Override voice if provided
    if (brand_voice) {
      systemPrompt += `\n\nAdditional voice direction: ${brand_voice}`;
    }

    const parsedContent = await askClaude({
      purpose: 'drafting',
      system: systemPrompt,
      prompt: buildPostsPrompt(topic, content_pillar ? `Content pillar: ${content_pillar}` : '', '', enabledPlatforms),
      schema: postsSchema(enabledPlatforms),
    });

    // Calculate scheduled times
    const scheduledTimes = {};
    const freq = workspace.brand_config?.posting_frequency;
    if (schedule === 'auto' && freq) {
      const now = new Date();
      enabledPlatforms.forEach(p => {
        const pFreq = freq[p === 'twitter' ? 'x' : p];
        if (pFreq?.hours?.length && pFreq?.days?.length) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          for (let d = 0; d < 14; d++) {
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() + d);
            const dayName = dayNames[checkDate.getDay()];
            if (pFreq.days.includes(dayName)) {
              for (const hour of pFreq.hours) {
                const slotDate = new Date(checkDate);
                slotDate.setHours(hour, 0, 0, 0);
                if (slotDate > now) {
                  scheduledTimes[p] = slotDate.toISOString();
                  break;
                }
              }
              if (scheduledTimes[p]) break;
            }
          }
        }
      });
    } else if (schedule !== 'auto' && schedule !== 'now') {
      // Use provided datetime for all platforms
      enabledPlatforms.forEach(p => { scheduledTimes[p] = schedule; });
    }

    // Build post records
    const postRecords = enabledPlatforms.map(p => ({
      id: `${Date.now()}_${p}`,
      workspace_id: workspace.id,
      platform: p,
      content: parsedContent[p],
      pillar: content_pillar || null,
      status: 'queued',
      scheduled_for: scheduledTimes[p] || null,
      created_at: new Date().toISOString(),
    }));

    // Store in Supabase if available
    if (supabase) {
      try {
        await supabase.from('posts').insert(postRecords);
      } catch (e) {
        console.error('Failed to store posts in Supabase:', e);
      }
    }

    res.json({
      success: true,
      posts: postRecords.map(p => ({
        id: p.id,
        platform: p.platform,
        content: p.content,
        scheduled_for: p.scheduled_for,
        status: p.status,
      })),
      content: parsedContent,
      scheduled_times: scheduledTimes,
    });
  } catch (error) {
    console.error('API generate error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Submit pre-written content via API
app.post('/api/v1/content/submit', authenticateApiKey, async (req, res) => {
  const workspace = req.workspace;
  const {
    platforms = ['linkedin'],
    content,
    image_url,
    schedule = 'auto',
    approval_required = false,
  } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required (object with platform keys or string for all platforms)' });
  }

  const enabledPlatforms = Array.isArray(platforms) ? platforms : [platforms];

  // Normalize content - can be string (same for all) or object per platform
  const contentMap = typeof content === 'string'
    ? Object.fromEntries(enabledPlatforms.map(p => [p, content]))
    : content;

  // Calculate scheduled times
  const scheduledTimes = {};
  const freq = workspace.brand_config?.posting_frequency;
  if (schedule === 'auto' && freq) {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    enabledPlatforms.forEach(p => {
      const pFreq = freq[p === 'twitter' ? 'x' : p];
      if (pFreq?.hours?.length && pFreq?.days?.length) {
        for (let d = 0; d < 14; d++) {
          const checkDate = new Date(now);
          checkDate.setDate(checkDate.getDate() + d);
          const dayName = dayNames[checkDate.getDay()];
          if (pFreq.days.includes(dayName)) {
            for (const hour of pFreq.hours) {
              const slotDate = new Date(checkDate);
              slotDate.setHours(hour, 0, 0, 0);
              if (slotDate > now) {
                scheduledTimes[p] = slotDate.toISOString();
                break;
              }
            }
            if (scheduledTimes[p]) break;
          }
        }
      }
    });
  } else if (schedule !== 'auto' && schedule !== 'now') {
    enabledPlatforms.forEach(p => { scheduledTimes[p] = schedule; });
  }

  const postRecords = enabledPlatforms.map(p => ({
    id: `${Date.now()}_${p}`,
    workspace_id: workspace.id,
    platform: p,
    content: contentMap[p] || contentMap[enabledPlatforms[0]],
    image: image_url || null,
    status: approval_required ? 'pending' : 'queued',
    scheduled_for: scheduledTimes[p] || null,
    created_at: new Date().toISOString(),
  }));

  // Store in Supabase if available
  if (supabase) {
    try {
      await supabase.from('posts').insert(postRecords);
    } catch (e) {
      console.error('Failed to store submitted posts:', e);
    }
  }

  res.json({
    success: true,
    posts: postRecords.map(p => ({
      id: p.id,
      platform: p.platform,
      content: p.content,
      status: p.status,
      scheduled_for: p.scheduled_for,
    })),
  });
});

// Get queue for workspace
app.get('/api/v1/content/queue', authenticateApiKey, async (req, res) => {
  const workspace = req.workspace;
  const { status, platform } = req.query;

  if (supabase) {
    try {
      let query = supabase
        .from('posts')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (platform) query = query.eq('platform', platform);

      const { data, error } = await query;
      if (error) throw error;
      return res.json({ posts: data || [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // No Supabase - return empty (UI-only posts are in localStorage)
  res.json({ posts: [], note: 'Supabase not configured - posts are stored in browser only' });
});

// Get analytics for workspace
app.get('/api/v1/content/analytics', authenticateApiKey, async (req, res) => {
  const workspace = req.workspace;
  const { period = '7d', platform = 'all' } = req.query;

  if (supabase) {
    try {
      const days = parseInt(period) || 7;
      const since = new Date();
      since.setDate(since.getDate() - days);

      let query = supabase
        .from('performance')
        .select('*')
        .eq('workspace_id', workspace.id)
        .gte('posted_at', since.toISOString());

      if (platform !== 'all') query = query.eq('platform', platform);

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate metrics
      const metrics = (data || []).reduce((acc, post) => ({
        total_posts: acc.total_posts + 1,
        total_likes: acc.total_likes + (post.likes || 0),
        total_comments: acc.total_comments + (post.comments || 0),
        total_shares: acc.total_shares + (post.shares || 0),
        total_impressions: acc.total_impressions + (post.impressions || 0),
      }), { total_posts: 0, total_likes: 0, total_comments: 0, total_shares: 0, total_impressions: 0 });

      return res.json({
        period,
        platform,
        workspace_id: workspace.id,
        metrics,
        posts: data || [],
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.json({
    period,
    platform,
    workspace_id: workspace.id,
    metrics: { total_posts: 0, total_likes: 0, total_comments: 0, total_shares: 0, total_impressions: 0 },
    posts: [],
    note: 'Supabase not configured',
  });
});

// Delete a scheduled post
app.delete('/api/v1/content/:id', authenticateApiKey, async (req, res) => {
  const workspace = req.workspace;
  const { id } = req.params;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspace.id);

      if (error) throw error;
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.json({ success: true, note: 'Supabase not configured - post may still exist in browser' });
});

// ============ MARCUS (CMO) POST STORE ============

// In-memory post store (Supabase-backed when available)
const postsStore = [];

function generatePostId() {
  return 'post_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function savePost(post) {
  postsStore.push(post);

  if (supabase) {
    try {
      await supabase.from('posts').insert(post);
    } catch (e) {
      console.error('Failed to save post to Supabase:', e);
    }
  }

  return post;
}

async function getPosts(filter = {}) {
  if (supabase) {
    try {
      let query = supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (filter.status) query = query.eq('status', filter.status);
      if (filter.workspace_id) query = query.eq('workspace_id', filter.workspace_id);
      if (filter.source) query = query.eq('source', filter.source);
      if (filter.limit) query = query.limit(filter.limit);
      const { data } = await query;
      if (data?.length) return data;
    } catch {}
  }

  // Fall back to in-memory
  let results = [...postsStore];
  if (filter.workspace_id) results = results.filter(p => p.workspace_id === filter.workspace_id);
  if (filter.status) results = results.filter(p => p.status === filter.status);
  if (filter.source) results = results.filter(p => p.source === filter.source);
  results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (filter.limit) results = results.slice(0, filter.limit);
  return results;
}

async function updatePost(id, updates) {
  const idx = postsStore.findIndex(p => p.id === id);
  if (idx !== -1) {
    postsStore[idx] = { ...postsStore[idx], ...updates };
  }

  if (supabase) {
    try {
      await supabase.from('posts').update(updates).eq('id', id);
    } catch {}
  }
}

// Helper: publish a post to Publer using workspace settings
async function publishToPubler(post, workspace) {
  const secrets = await getWorkspaceSecrets(workspace.id);
  const publerApiKey = secrets.publer_api_key;
  if (!publerApiKey) {
    throw new Error(`No Publer API key configured for workspace "${workspace.name}". Set it in Settings.`);
  }

  const platformAccounts = secrets.platform_accounts || {};
  const socialAccountId = platformAccounts[post.platform];

  // Get Publer workspace ID
  const wsResponse = await fetch('https://app.publer.com/api/v1/workspaces', {
    headers: { 'Authorization': `Bearer-API ${publerApiKey}`, 'Content-Type': 'application/json' },
  });
  const wsText = await wsResponse.text();
  if (wsText.trim().startsWith('<') || !wsResponse.ok) {
    throw new Error('Invalid Publer API key');
  }
  const workspaces = JSON.parse(wsText);
  if (!workspaces?.length) throw new Error('No Publer workspaces found');
  const publerWorkspaceId = workspaces[0].id;

  // Resolve account ID
  let accountId = socialAccountId;
  if (!accountId) {
    // Auto-match by platform
    const platformMatchers = {
      linkedin: ['linkedin', 'in_profile', 'in_page', 'in_'],
      facebook: ['facebook', 'fb_page', 'fb_'],
      instagram: ['instagram', 'ig_business', 'ig_'],
      x: ['twitter', 'x'],
    };
    const matchers = platformMatchers[post.platform] || [post.platform];

    const accountsResp = await fetch('https://app.publer.com/api/v1/accounts', {
      headers: {
        'Authorization': `Bearer-API ${publerApiKey}`,
        'Publer-Workspace-Id': publerWorkspaceId,
        'Content-Type': 'application/json',
      },
    });
    const accounts = await accountsResp.json();
    const match = accounts.find(acc => {
      const p = (acc.platform || acc.social_network || acc.type || '').toLowerCase();
      return matchers.some(m => p.includes(m.toLowerCase()));
    });
    if (!match) throw new Error(`No ${post.platform} account found in Publer`);
    accountId = match.id;
  }

  // Map platform to Publer network
  const platformToNetwork = { linkedin: 'linkedin', facebook: 'facebook', instagram: 'instagram', x: 'twitter' };
  const networkProvider = platformToNetwork[post.platform] || post.platform;

  // Handle image upload if present
  let mediaId = null;
  if (post.image) {
    if (post.image.startsWith('data:')) {
      const base64Data = post.image.split(',')[1];
      const mimeType = post.image.split(';')[0].split(':')[1] || 'image/png';
      const ext = mimeType.split('/')[1] || 'png';
      const buffer = Buffer.from(base64Data, 'base64');
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const bodyStart = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
      const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([bodyStart, buffer, bodyEnd]);

      const uploadResp = await fetch('https://app.publer.com/api/v1/media', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Authorization': `Bearer-API ${publerApiKey}`,
          'Publer-Workspace-Id': publerWorkspaceId,
        },
        body,
      });
      const uploadText = await uploadResp.text();
      if (!uploadText.trim().startsWith('<')) {
        const uploadData = JSON.parse(uploadText);
        if (uploadResp.ok && uploadData.id) mediaId = uploadData.id;
      }
    } else {
      // URL image
      try {
        const uploadResp = await fetch('https://app.publer.com/api/v1/media/from-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer-API ${publerApiKey}`,
            'Publer-Workspace-Id': publerWorkspaceId,
          },
          body: JSON.stringify({ url: post.image }),
        });
        const uploadText = await uploadResp.text();
        if (!uploadText.trim().startsWith('<')) {
          const uploadData = JSON.parse(uploadText);
          if (uploadResp.ok && uploadData.id) mediaId = uploadData.id;
        }
      } catch (e) {
        console.error('Media URL upload failed:', e);
      }
    }
  }

  // Build payload
  const networkContent = { type: mediaId ? 'photo' : 'status', text: post.content };
  if (mediaId) networkContent.media = [{ id: mediaId, type: 'photo' }];

  const accountEntry = { id: accountId };
  if (post.scheduledFor) {
    accountEntry.scheduled_at = new Date(post.scheduledFor).toISOString();
  } else {
    accountEntry.scheduled_at = new Date(Date.now() + 60 * 1000).toISOString();
  }

  const payload = {
    bulk: {
      state: 'scheduled',
      posts: [{ networks: { [networkProvider]: networkContent }, accounts: [accountEntry] }],
    },
  };

  console.log(`[Marcus] Publishing to ${post.platform} via Publer, account: ${accountId}`);
  const response = await fetch('https://app.publer.com/api/v1/posts/schedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer-API ${publerApiKey}`,
      'Publer-Workspace-Id': publerWorkspaceId,
    },
    body: JSON.stringify(payload),
  });

  const respText = await response.text();
  if (respText.trim().startsWith('<')) throw new Error('Publer returned error page');
  const data = JSON.parse(respText);
  if (!response.ok) throw new Error(data.message || data.error || 'Publer publish failed');

  // Poll job status
  const jobId = data.job_id;
  if (jobId) {
    let attempts = 0;
    while (attempts < 15) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
      try {
        const statusResp = await fetch(`https://app.publer.com/api/v1/job_status/${jobId}`, {
          headers: { 'Authorization': `Bearer-API ${publerApiKey}`, 'Publer-Workspace-Id': publerWorkspaceId },
        });
        const statusText = await statusResp.text();
        if (!statusText.trim().startsWith('<')) {
          const result = JSON.parse(statusText);
          if (result.status === 'complete' || result.status === 'done' || result.done === true ||
              (result.payload && (result.payload.posts || result.payload.errors))) {
            if (result.status === 'failed' || result.payload?.errors?.length) {
              throw new Error(result.payload?.errors?.[0]?.message || 'Publer job failed');
            }
            return { success: true, jobId, publerData: result };
          }
        }
      } catch (e) {
        if (e.message.includes('failed')) throw e;
      }
    }
  }

  return { success: true, jobId, publerData: data };
}

// ============ MARCUS CMO ENDPOINTS (POST /api/posts, GET /api/posts) ============

// POST /api/posts - Marcus submits a post for publishing
// Requires the workspace API key (Bearer); see the access control gate above.
app.post('/api/posts', async (req, res) => {
  const {
    platform,
    content,
    pillar,
    generateImage = false,
    imageStyle,
    scheduleFor,
    source = 'unknown',
  } = req.body;

  if (!platform || !content) {
    return res.status(400).json({ error: 'platform and content are required' });
  }

  // The workspace always comes from the API key, never from the "source" field
  const workspace = req.workspace;

  const postId = generatePostId();
  const post = {
    id: postId,
    workspace_id: workspace.id,
    platform,
    content,
    pillar: pillar || null,
    image: null,
    status: 'queued',
    source,
    scheduled_for: scheduleFor || null,
    publer_job_id: null,
    published_at: null,
    metrics: null,
    created_at: new Date().toISOString(),
  };

  await savePost(post);
  console.log(`[Marcus] Post ${postId} created for ${workspace.name} on ${platform}`);

  // If scheduleFor is set, queue for later; otherwise try to publish now
  if (scheduleFor) {
    await updatePost(postId, { status: 'scheduled', scheduled_for: scheduleFor });
    return res.json({
      id: postId,
      status: 'scheduled',
      platform,
      publishedAt: null,
    });
  }

  // Attempt immediate publish
  try {
    // Wait a moment for image generation if requested (max 30s)
    if (generateImage) {
      let waited = 0;
      while (waited < 30000) {
        await new Promise(r => setTimeout(r, 2000));
        waited += 2000;
        const current = postsStore.find(p => p.id === postId);
        if (current?.image) break;
      }
    }

    const currentPost = postsStore.find(p => p.id === postId) || post;
    const result = await publishToPubler(currentPost, workspace);

    await updatePost(postId, {
      status: 'published',
      published_at: new Date().toISOString(),
      publer_job_id: result.jobId || null,
    });

    return res.json({
      id: postId,
      status: 'published',
      platform,
      publishedAt: new Date().toISOString(),
    });
  } catch (pubError) {
    console.error(`[Marcus] Publish failed for ${postId}:`, pubError.message);
    await updatePost(postId, { status: 'failed', error: pubError.message });
    return res.json({
      id: postId,
      status: 'queued',
      platform,
      publishedAt: null,
      error: pubError.message,
    });
  }
});

// GET /api/posts - Marcus polls for published posts and metrics
// Requires the workspace API key (Bearer); only that workspace's posts are returned.
app.get('/api/posts', async (req, res) => {
  const { status, limit = 50, source, platform } = req.query;

  const filter = {
    workspace_id: req.workspace.id,
    status: status || undefined,
    source: source || undefined,
    limit: parseInt(limit) || 50,
  };

  const posts = await getPosts(filter);

  // Filter by platform if specified
  const filtered = platform ? posts.filter(p => p.platform === platform) : posts;

  res.json({
    posts: filtered.map(p => ({
      id: p.id,
      platform: p.platform,
      content: p.content,
      pillar: p.pillar,
      status: p.status,
      source: p.source,
      publishedAt: p.published_at || null,
      scheduledFor: p.scheduled_for || null,
      image: p.image || null,
      metrics: p.metrics || { likes: 0, comments: 0, shares: 0 },
      error: p.error || null,
      createdAt: p.created_at,
    })),
  });
});

// Health check endpoint (public; Touchline HQ checks it)
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: !!supabase,
    storage: await storageStatus(),
  });
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
