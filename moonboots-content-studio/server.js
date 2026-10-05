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
import * as publer from './server/publer.js';
import { createPostService, toApiPost, PostError, PLATFORMS } from './server/posts.js';
import { checkContent, prepareForPublishing } from './shared/brand.js';
import { makePostImage } from './server/cards.js';

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

// Posts from Touchline HQ and the v1 API, and the scheduler that sends them to Publer
const postService = createPostService({ store, getWorkspaceById, getWorkspaceSecrets, makeImage: makePostImage });

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
      tagline: 'The all-in-one grassroots football app',
      tone: 'British English. Write like a grassroots coach talking on the touchline to other coaches and parents, not like a press release. Warm, practical and specific, with short sentences and plain words.',
      lead_message: "What a manager says on the touchline (as a Voice Note or typed notes) or films on a Sunday becomes notes on every player under the FA's four corners (technical/tactical, physical, psychological, social), and then each child's development plan (IDP). The coach confirms everything before it is saved. Families see their child's plan in the Player Lounge.",
      style_rules: [
        'Use British English spelling and grassroots football words (match, pitch, kit, under 9s).',
        'Never use em dashes, en dashes or spaced hyphens as dashes. Use full stops, commas or colons instead.',
        'Write Voice Notes, Player Lounge and IDP exactly like that.',
      ],
      never_claim: [
        'That Touchline is "the only" or "the first" anything.',
        'Any FA Charter Standard or England Football Accredited endorsement.',
        'Atlas player tracking.',
        'That Touchline is a native app or is in an app store.',
        "Time savings we can't prove, such as hours saved each week.",
      ],
      example_rules: [
        'Use the invented club Wicklewood Wanderers in examples.',
        'Never name real children, real clubs or real coaches.',
      ],
      register_link: 'touchline.xyz/register',
      forbidden_topics: ['Gambling', 'Alcohol', 'Politics', 'Professional transfer gossip'],
      posting_frequency: {
        linkedin: { min: 3, max: 5, days: ['Tuesday', 'Wednesday', 'Thursday'], hours: [8, 9, 10] },
        facebook: { min: 5, max: 10, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], hours: [8, 12, 17, 19] },
        x: { min: 7, max: 21, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], hours: [7, 9, 12, 17, 19] },
        instagram: { min: 3, max: 5, days: ['Monday', 'Wednesday', 'Friday', 'Sunday'], hours: [8, 12, 18] },
      },
    },
    pillars: [
      { id: 'coaches', name: 'Coaches & managers', description: "Voice Notes and match video become notes on every player and each child's development plan, with the coach confirming everything.", example_angles: ['A Voice Note on the drive home becomes notes on every player', "Sunday's match video turned into each child's development plan", 'Notes under all four corners, confirmed by the coach'] },
      { id: 'parents', name: 'Parents', description: 'A development plan about their own child, shared in the Player Lounge. Parents are free.', example_angles: ['What your child is working on this month', "Seeing your child's plan in the Player Lounge", 'Parents never pay for Touchline'] },
      { id: 'clubs', name: 'Clubs', description: 'Development visible across every team, in one app instead of four subscriptions.', example_angles: ["Every team's player development in one place", 'One app instead of four subscriptions', 'The same development approach from under 7s upwards'] },
      { id: 'coaching-tips', name: 'Coaching tips & grassroots culture', description: 'Practical coaching ideas and the culture of the grassroots game.', example_angles: ['A session that still works on a wet Tuesday', 'Why fun comes first at under 9s', 'Thanking the volunteers who keep the club going'] },
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
  if (workspace.slug === 'moonboots') {
    // Use the existing rich context system for MoonBoots
    return null; // signals caller to use getGenerationContext + buildSystemPrompt
  }

  const config = workspace.brand_config || {};
  const pillars = workspace.pillars || [];
  const pillarDetail = findPillar(pillars, selectedPillar);
  const list = (title, lines) => (lines?.length ? `\n\n${title}:\n${lines.map(line => `* ${line}`).join('\n')}` : '');

  // No dashes in this prompt: the model copies the punctuation it is shown
  return `You are writing social media posts for ${workspace.name}${config.tagline ? `, "${config.tagline}"` : ''}.`
    + (config.lead_message ? `\n\nWHAT ${workspace.name.toUpperCase()} DOES (the lead message):\n${config.lead_message}` : '')
    + `\n\nVOICE AND TONE:\n${config.tone || 'Professional and engaging.'}`
    + list('STYLE RULES', config.style_rules)
    + list('NEVER CLAIM', config.never_claim)
    + list('EXAMPLES AND NAMES', config.example_rules)
    + (config.forbidden_topics?.length ? `\n\nNEVER discuss or reference: ${config.forbidden_topics.join(', ')}` : '')
    + (config.register_link ? `\n\nWhen inviting people to sign up, link to ${config.register_link}. Tracking tags are added automatically, so do not add any.` : '')
    + `\n\nCONTENT PILLARS:\n${pillars.map((p, i) => `${i + 1}. ${p.name}: ${p.description}${p.example_angles?.length ? ` Angles: ${p.example_angles.join('; ')}.` : ''}`).join('\n')}`
    + '\n\nCONTENT GUIDELINES:\n* Sound authentic and on brand\n* Use short paragraphs and line breaks for readability\n* Suit each platform\'s style and audience\n* Be practical and specific'
    + (pillarDetail ? `\n\nCurrent content pillar focus: ${pillarDetail.name}. ${pillarDetail.description}` : '');
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
  return path === '/posts' || path.startsWith('/posts/') || path.startsWith('/v1/');
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

// ============ PUBLER (UI routes, admin login) ============

const NO_PUBLER_KEY = 'No Publer API key saved for this workspace. Paste one in Settings.';

async function getSavedPublerKey(workspaceId) {
  if (!workspaceId) return null;
  const secrets = await getWorkspaceSecrets(workspaceId);
  return secrets.publer_api_key || null;
}

function sendPublerError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error.message);
  res.status(error.status || 500).json({ error: error.message || fallbackMessage, code: error.code, hint: error.hint });
}

// Publer - Get connected social accounts (uses the workspace's saved key)
app.post('/api/publer/accounts', async (req, res) => {
  const apiKey = await getSavedPublerKey(req.body?.workspaceId);
  if (!apiKey) {
    return res.status(400).json({ error: NO_PUBLER_KEY, code: 'no_key' });
  }

  try {
    const { accounts } = await publer.listAccounts(apiKey);
    res.json({ success: true, accounts });
  } catch (error) {
    sendPublerError(res, error, 'Failed to fetch Publer accounts');
  }
});

// Publer connection test (uses the workspace's saved key)
app.post('/api/publer/test', async (req, res) => {
  const apiKey = await getSavedPublerKey(req.body?.workspaceId);
  if (!apiKey) {
    return res.status(400).json({ error: NO_PUBLER_KEY, code: 'no_key' });
  }

  try {
    const { accounts } = await publer.listAccounts(apiKey);
    res.json({
      success: true,
      accountCount: accounts.length,
      accounts: accounts.map(a => `${a.name} (${a.kind})`).join(', ') || 'None',
      accountsList: accounts,
    });
  } catch (error) {
    sendPublerError(res, error, 'Publer test failed');
  }
});

// Publish a post approved in the Queue, using the workspace's saved Publer key and accounts
app.post('/api/publish', async (req, res) => {
  const { workspaceId, post } = req.body;

  const workspace = workspaceId ? await getWorkspaceById(workspaceId) : null;
  const secrets = workspace ? await getWorkspaceSecrets(workspace.id) : {};
  const apiKey = secrets.publer_api_key;

  if (!apiKey) {
    return res.status(400).json({ error: NO_PUBLER_KEY, code: 'no_key' });
  }

  if (!post?.content || !post?.platform) {
    return res.status(400).json({ error: 'Post data is required' });
  }

  try {
    const publerWorkspaceId = await publer.getPublerWorkspaceId(apiKey);
    const accountId = await publer.resolveAccountId(apiKey, publerWorkspaceId, post.platform, secrets.platform_accounts?.[post.platform]);
    const mediaId = await publer.uploadMedia(apiKey, publerWorkspaceId, post.image);
    const text = prepareForPublishing(workspace, post);

    // Publer needs a future time; "now" goes out in about a minute
    const scheduledFor = post.scheduledFor && !Number.isNaN(new Date(post.scheduledFor).getTime()) ? post.scheduledFor : null;
    const { jobId, data } = await publer.schedulePost(apiKey, publerWorkspaceId, {
      accountId, platform: post.platform, text, mediaId, scheduledAt: scheduledFor,
    });

    if (!jobId) {
      return res.json({ success: true, data, status: 'completed' });
    }

    const job = await publer.waitForJob(apiKey, publerWorkspaceId, jobId);
    if (job.failed) {
      return res.status(400).json({ error: job.error, details: job.result });
    }
    if (!job.done) {
      return res.json({ success: true, data, jobId, status: 'pending', message: 'Post scheduled - check Publer for status' });
    }
    res.json({ success: true, data: job.result, jobId, status: 'completed' });
  } catch (error) {
    sendPublerError(res, error, 'Publer publish failed');
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
      ({ accounts } = await publer.listAccounts(key));
    } catch (error) {
      return res.status(error.status || 502).json({ error: `Key not saved. ${error.message}`, code: error.code, hint: error.hint });
    }
    updates.publer_api_key = key;

    // Keep account choices that still exist under the new key
    const secrets = await getWorkspaceSecrets(workspace.id);
    const available = new Set(accounts.map(a => a.id));
    updates.platform_accounts = Object.fromEntries(
      Object.entries(secrets.platform_accounts || {}).filter(([, id]) => available.has(String(id))),
    );
  } else if (publerApiKey === null) {
    updates.publer_api_key = null;
  }

  if (platformAccounts !== undefined) {
    if (!platformAccounts || typeof platformAccounts !== 'object' || Array.isArray(platformAccounts)) {
      return res.status(400).json({ error: 'platformAccounts must be an object' });
    }
    const clean = {};
    for (const platform of PLATFORMS) {
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

  // Posts waiting for a working key get another go straight away
  if (updates.publer_api_key) postService.runChecks();

  res.json({ success: true, workspace: await publicWorkspace(workspace), accounts });
});

// ============ EXTERNAL API v1 ENDPOINTS (workspace API key) ============
// Posts made here wait for approval in Content Studio; they never publish by themselves.

// Next posting slot per platform (UK time), or the given time for all platforms
async function scheduleTimes(workspace, platforms, schedule) {
  const times = {};
  for (const platform of platforms) {
    if (schedule === 'auto') {
      times[platform] = (await postService.nextSlotFor(workspace, platform)).toISOString();
    } else if (schedule && schedule !== 'now' && !Number.isNaN(new Date(schedule).getTime())) {
      times[platform] = new Date(schedule).toISOString();
    }
  }
  return times;
}

// Generate content via API
app.post('/api/v1/content/generate', async (req, res) => {
  const workspace = req.workspace;
  const {
    topic,
    content_pillar,
    platforms = ['linkedin', 'x', 'instagram'],
    schedule = 'auto',
    brand_voice,
  } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'topic is required' });
  }

  if (!claudeApiKey()) {
    return res.status(503).json({ error: CLAUDE_KEY_MISSING });
  }

  const enabledPlatforms = (Array.isArray(platforms) ? platforms : [platforms]).filter(p => PLATFORMS.includes(p));
  if (enabledPlatforms.length === 0) {
    return res.status(400).json({ error: `platforms must include one of: ${PLATFORMS.join(', ')}` });
  }

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

    const scheduledTimes = await scheduleTimes(workspace, enabledPlatforms, schedule);
    const posts = [];
    for (const platform of enabledPlatforms) {
      posts.push(await postService.createDraft(workspace, {
        platform,
        content: parsedContent[platform],
        pillar: content_pillar || null,
        source: 'api-v1',
        status: 'queued',
        scheduled_for: scheduledTimes[platform] || null,
      }));
    }

    res.json({
      success: true,
      posts: posts.map(p => ({
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
app.post('/api/v1/content/submit', async (req, res) => {
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

  const enabledPlatforms = (Array.isArray(platforms) ? platforms : [platforms]).filter(p => PLATFORMS.includes(p));
  if (enabledPlatforms.length === 0) {
    return res.status(400).json({ error: `platforms must include one of: ${PLATFORMS.join(', ')}` });
  }

  // Normalize content - can be string (same for all) or object per platform
  const contentMap = typeof content === 'string'
    ? Object.fromEntries(enabledPlatforms.map(p => [p, content]))
    : content;

  try {
    const scheduledTimes = await scheduleTimes(workspace, enabledPlatforms, schedule);
    const posts = [];
    for (const platform of enabledPlatforms) {
      posts.push(await postService.createDraft(workspace, {
        platform,
        content: contentMap[platform] || contentMap[enabledPlatforms[0]],
        image: image_url || null,
        source: 'api-v1',
        status: approval_required ? 'pending' : 'queued',
        scheduled_for: scheduledTimes[platform] || null,
      }));
    }

    res.json({
      success: true,
      posts: posts.map(p => ({
        id: p.id,
        platform: p.platform,
        content: p.content,
        status: p.status,
        scheduled_for: p.scheduled_for,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue for workspace
app.get('/api/v1/content/queue', async (req, res) => {
  const { status, platform } = req.query;
  try {
    const posts = await postService.list({ workspaceId: req.workspace.id, status, platform });
    res.json({
      posts: posts.map(p => ({
        id: p.id,
        workspace_id: p.workspace_id,
        platform: p.platform,
        content: p.content,
        pillar: p.pillar || null,
        image: p.image ? `/api/posts/${p.id}/image` : null,
        status: p.status,
        source: p.source || null,
        scheduled_for: p.scheduled_for || null,
        published_at: p.published_at || null,
        post_url: p.post_url || null,
        error: p.error || null,
        created_at: p.created_at,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get analytics for workspace
app.get('/api/v1/content/analytics', async (req, res) => {
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

// Delete a post (a post already scheduled in Publer is removed from Publer first)
app.delete('/api/v1/content/:id', async (req, res) => {
  try {
    const post = await postService.getForWorkspace(req.workspace.id, req.params.id);
    if (post.status === 'scheduled') {
      await postService.cancel(req.workspace, post.id);
    }
    await postService.remove(post.id);
    res.json({ success: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ============ TOUCHLINE HQ / MARCUS (POST /api/posts, GET /api/posts) ============
// Marcus's posts are approved in Touchline HQ before they arrive, so they schedule
// themselves: at scheduleFor if given, otherwise the next posting slot (UK time).

app.post('/api/posts', async (req, res) => {
  try {
    const post = await postService.createScheduledPost(req.workspace, req.body);
    const api = toApiPost(post);
    res.json({
      id: api.id,
      status: api.status,
      platform: api.platform,
      publishedAt: api.publishedAt,
      scheduledFor: api.scheduledFor,
      platformPostId: api.platformPostId,
      postUrl: api.postUrl,
      ...(api.error ? { error: api.error } : {}),
    });
  } catch (error) {
    if (!(error instanceof PostError)) console.error('[posts] Create failed:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Only this key's workspace. status=published returns posts that are live.
app.get('/api/posts', async (req, res) => {
  const { status, limit = 50, source, platform } = req.query;
  try {
    const posts = await postService.list({
      workspaceId: req.workspace.id,
      status: status || undefined,
      source: source || undefined,
      platform: platform || undefined,
      limit: Math.min(Math.max(parseInt(limit) || 50, 1), 500),
    });
    res.json({ posts: posts.map(toApiPost) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// A post's image card
app.get('/api/posts/:id/image', async (req, res) => {
  try {
    const post = await postService.getForWorkspace(req.workspace.id, req.params.id);
    if (!post.image) return res.status(404).json({ error: 'This post has no image' });
    if (!post.image.startsWith('data:')) return res.redirect(post.image);
    const [meta, data] = post.image.split(',');
    res.type(meta.slice(5).split(';')[0] || 'image/png').send(Buffer.from(data, 'base64'));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ============ SERVER POSTS IN THE QUEUE (UI, admin login) ============

async function workspaceFromParams(req) {
  const workspace = await getWorkspaceById(req.params.id);
  if (!workspace) throw new PostError('Workspace not found', 404);
  return workspace;
}

function uiPost(workspace, post) {
  return {
    ...toApiPost(post),
    image: post.image || null,
    imageError: post.image_error || null,
    autoSchedule: !!post.auto_schedule,
    warnings: checkContent(workspace.slug, post.content),
  };
}

app.get('/api/workspaces/:id/posts', async (req, res) => {
  try {
    const workspace = await workspaceFromParams(req);
    const posts = await postService.list({ workspaceId: workspace.id });
    res.json({ posts: posts.map(p => uiPost(workspace, p)) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

for (const action of ['cancel', 'approve', 'retry']) {
  app.post(`/api/workspaces/:id/posts/:postId/${action}`, async (req, res) => {
    try {
      const workspace = await workspaceFromParams(req);
      const post = await postService[action](workspace, req.params.postId, { force: req.body?.force === true });
      res.json({ post: uiPost(workspace, post) });
    } catch (error) {
      if (!(error instanceof PostError)) console.error(`[posts] ${action} failed:`, error.message);
      res.status(error.status || 500).json({ error: error.message, code: error.code });
    }
  });
}

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
  postService.startScheduler();
});
