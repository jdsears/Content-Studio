import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client (if configured)
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

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

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// Publer - Get connected social accounts
app.post('/api/publer/accounts', async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

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
    if (wsText.trim().startsWith('<') || !wsResponse.ok) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const workspaces = JSON.parse(wsText);
    if (!workspaces || workspaces.length === 0) {
      return res.status(400).json({ error: 'No workspaces found' });
    }

    const workspaceId = workspaces[0].id;

    // Get social accounts
    const response = await fetch('https://app.publer.com/api/v1/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer-API ${apiKey}`,
        'Publer-Workspace-Id': workspaceId,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Publer accounts error:', data);
      return res.status(response.status).json({
        error: data.message || data.error || 'Failed to fetch Publer accounts',
        details: data
      });
    }

    // Return accounts with platform info
    const accounts = (data || []).map(acc => ({
      id: acc.id,
      platform: acc.platform,
      name: acc.name || acc.username || acc.platform,
    }));

    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Publer accounts failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Publer' });
  }
});

// Publer connection test endpoint
app.post('/api/publer/test', async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    // First get workspaces to find workspace ID
    const wsResponse = await fetch('https://app.publer.com/api/v1/workspaces', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer-API ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const wsText = await wsResponse.text();
    console.log('Publer workspaces response status:', wsResponse.status);
    console.log('Publer workspaces response:', wsText.substring(0, 500));

    if (wsText.trim().startsWith('<')) {
      // Extract any useful info from the HTML
      const titleMatch = wsText.match(/<title>(.*?)<\/title>/i);
      const errorTitle = titleMatch ? titleMatch[1] : 'Unknown error';
      console.error('Publer returned HTML page:', errorTitle);
      return res.status(401).json({
        error: `Publer API error: ${errorTitle}. Check your API key format and plan.`,
        hint: 'API key should be the full key from app.publer.com/settings',
        debug: `Status: ${wsResponse.status}`
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
        error: workspaces?.message || 'No workspaces found. Check your API key.',
      });
    }

    const workspaceId = workspaces[0].id;

    // Now get social accounts with workspace ID
    const response = await fetch('https://app.publer.com/api/v1/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer-API ${apiKey}`,
        'Publer-Workspace-Id': workspaceId,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();

    // Check for HTML error page
    if (responseText.trim().startsWith('<')) {
      console.error('Publer test returned HTML:', responseText.substring(0, 200));
      return res.status(401).json({
        error: 'Invalid API key. Publer returned an error page.',
        hint: 'Please verify your API key at publer.io/settings/api'
      });
    }

    let accounts;
    try {
      accounts = JSON.parse(responseText);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Invalid response from Publer' });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: accounts.message || accounts.error || 'Failed to connect to Publer'
      });
    }

    // Log account structure for debugging
    if (accounts.length > 0) {
      console.log('Publer account structure:', JSON.stringify(accounts[0], null, 2));
    }

    // Publer may use different field names: social_network, type, network, platform
    const getAccountPlatform = (acc) => acc.social_network || acc.type || acc.network || acc.platform || 'unknown';
    const getAccountName = (acc) => acc.name || acc.username || acc.display_name || getAccountPlatform(acc);

    res.json({
      success: true,
      accountCount: accounts.length,
      accounts: accounts.map(a => `${getAccountName(a)} (${getAccountPlatform(a)})`).join(', ') || 'None',
      // Include full account data for the frontend
      accountsList: accounts.map(a => ({
        id: a.id,
        platform: getAccountPlatform(a),
        name: getAccountName(a),
      }))
    });
  } catch (error) {
    console.error('Publer test failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Publer' });
  }
});

// Publer API proxy endpoint
app.post('/api/publish', async (req, res) => {
  const { apiKey, post, socialAccountId } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  if (!post) {
    return res.status(400).json({ error: 'Post data is required' });
  }

  // Platform mapping for Publer's platform identifiers
  // Publer uses: in_profile (LinkedIn), ig_business (Instagram), twitter (X)
  const platformMatchers = {
    linkedin: ['linkedin', 'in_profile', 'in_'],
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

// Claude API proxy endpoint for content generation
app.post('/api/generate', async (req, res) => {
  const { apiKey, topic, pillar, platforms, userId = 'default' } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'Claude API key is required' });
  }

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  const enabledPlatforms = Object.entries(platforms || {})
    .filter(([_, enabled]) => enabled)
    .map(([platform]) => platform);

  if (enabledPlatforms.length === 0) {
    return res.status(400).json({ error: 'At least one platform must be selected' });
  }

  try {
    // Fetch dynamic context from Supabase (or use defaults)
    const context = await getGenerationContext(userId);

    // Find selected pillar details
    const selectedPillar = pillar
      ? context.pillars.find(p => p.name === pillar || p.id === pillar)
      : null;

    // Build dynamic system prompt from context
    const systemPrompt = buildSystemPrompt(context, selectedPillar);

    const userPrompt = `Create social media posts about: "${topic}"
${selectedPillar ? `Content pillar: ${selectedPillar.name}` : `Content pillar: ${pillar || 'AI Strategy'}`}
${selectedPillar?.example_angles?.length ? `Possible angles: ${selectedPillar.example_angles.join(', ')}` : ''}

Generate unique, platform-optimised content for: ${enabledPlatforms.join(', ')}

Platform guidelines:
- LinkedIn: Professional but human. Can be longer (1000-1500 chars). Use line breaks between paragraphs. No hashtags or max 3 relevant ones at the end.
- X/Twitter: Concise and punchy. Under 280 characters ideal. Can be provocative or contrarian. No hashtags unless essential.
- Instagram: Engaging caption. More personal tone. Include 5-10 relevant hashtags at the very end, separated from main content.

Return ONLY valid JSON in this exact format (no markdown, no code blocks, no explanation):
{
  ${enabledPlatforms.map(p => `"${p}": "Post content here"`).join(',\n  ')}
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Claude API error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || 'Claude API request failed',
        details: errorData
      });
    }

    const data = await response.json();

    // Extract text content from Claude response
    const textContent = data.content?.find(c => c.type === 'text')?.text;

    if (!textContent) {
      return res.status(500).json({ error: 'No content in Claude response' });
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let parsedContent;
    try {
      // Remove any markdown code blocks if present
      const cleanedContent = textContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsedContent = JSON.parse(cleanedContent);
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedContent = JSON.parse(jsonMatch[0]);
        } catch {
          console.error('JSON parse error:', parseError, 'Raw content:', textContent);
          return res.status(500).json({
            error: 'Failed to parse generated content',
            raw: textContent
          });
        }
      } else {
        return res.status(500).json({
          error: 'Failed to parse generated content',
          raw: textContent
        });
      }
    }

    res.json({ success: true, content: parsedContent });

  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
});

// Topic suggestion endpoint
app.post('/api/suggest-topic', async (req, res) => {
  const { apiKey, pillar } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'Claude API key is required' });
  }

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

  const prompt = `${moonbootsContext}

Based on the content pillar "${pillar || 'AI Strategy'}", suggest ONE compelling, specific topic for a social media post.

The topic should:
- Be thought-provoking and slightly contrarian
- Draw from real-world experience
- Be specific enough to write about (not generic)
- Appeal to founders, executives, and tech leaders
- Not be clickbait - genuine insight

Return ONLY the topic text, nothing else. No quotes, no explanation. Just the topic idea in 1-2 sentences.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Failed to suggest topic',
      });
    }

    const topic = data.content?.[0]?.text?.trim();
    if (!topic) {
      return res.status(500).json({ error: 'No topic generated' });
    }

    res.json({ success: true, topic });
  } catch (error) {
    console.error('Topic suggestion failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Claude API' });
  }
});

// ============ IMAGE GENERATION ENDPOINTS (Replicate + Claude) ============

// Generate optimized image prompt using Claude
app.post('/api/generate-image-prompt', async (req, res) => {
  const { apiKey, postContent, platform, style = 'modern professional' } = req.body;

  if (!apiKey || !postContent) {
    return res.status(400).json({ error: 'API key and post content required' });
  }

  const systemPrompt = `You are an expert at creating image generation prompts for social media posts.

Your task is to create a detailed prompt for an AI image generator (Flux) that will complement the social media post provided.

Guidelines:
- Create visually striking, professional images suitable for ${platform}
- Avoid text in the image (text will be overlaid separately)
- Focus on mood, atmosphere, and visual metaphor
- Use specific details: lighting, composition, color palette, style
- Keep it abstract/conceptual rather than literal where appropriate
- Never include people's faces or identifiable individuals
- Aim for images that work well with text overlay
- Use dark/moody backgrounds that contrast well with white text

Style preference: ${style}

Output ONLY the image prompt, nothing else. No explanations, no preamble.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Create an image prompt for this ${platform} post:\n\n"${postContent}"`
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return res.status(response.status).json({ error: 'Failed to generate image prompt' });
    }

    const data = await response.json();
    const prompt = data.content?.[0]?.text?.trim();

    res.json({ imagePrompt: prompt });

  } catch (error) {
    console.error('Generate image prompt failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate image using Replicate (Flux Schnell)
app.post('/api/generate-image', async (req, res) => {
  const { replicateApiKey, prompt, aspectRatio = '1:1' } = req.body;

  if (!replicateApiKey || !prompt) {
    return res.status(400).json({ error: 'Replicate API key and prompt required' });
  }

  // Map aspect ratios for different platforms
  const aspectRatios = {
    'square': '1:1',      // Instagram feed
    'portrait': '4:5',    // Instagram optimal
    'landscape': '16:9',  // X/Twitter, LinkedIn
    'story': '9:16'       // Instagram stories
  };

  const ratio = aspectRatios[aspectRatio] || aspectRatio;
  console.log('Generating image with Replicate, aspect ratio:', ratio);

  try {
    // Start prediction with Flux Schnell
    const startResponse = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          aspect_ratio: ratio,
          output_format: 'webp',
          output_quality: 90,
        }
      }),
    });

    if (!startResponse.ok) {
      const error = await startResponse.json().catch(() => ({}));
      console.error('Replicate start error:', error);
      return res.status(startResponse.status).json({
        error: error.detail || error.error || 'Failed to start image generation'
      });
    }

    const prediction = await startResponse.json();
    console.log('Replicate prediction started:', prediction.id);

    // Poll for completion
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Bearer ${replicateApiKey}` }
      });

      result = await pollResponse.json();
      attempts++;

      if (attempts % 5 === 0) {
        console.log('Replicate status:', result.status, 'attempts:', attempts);
      }
    }

    if (result.status === 'failed') {
      console.error('Replicate generation failed:', result.error);
      return res.status(500).json({ error: result.error || 'Image generation failed' });
    }

    if (result.status !== 'succeeded') {
      return res.status(408).json({ error: 'Image generation timed out' });
    }

    // Flux returns array of URLs
    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    console.log('Image generated successfully');

    // Fetch image and convert to base64 for consistency with frontend
    try {
      const imgResponse = await fetch(imageUrl);
      const imgBuffer = await imgResponse.arrayBuffer();
      const base64 = Buffer.from(imgBuffer).toString('base64');

      res.json({
        success: true,
        image: `data:image/webp;base64,${base64}`,
        imageUrl: imageUrl,
        predictionId: result.id
      });
    } catch (fetchErr) {
      // Return URL if fetch fails
      res.json({
        success: true,
        imageUrl: imageUrl,
        predictionId: result.id
      });
    }

  } catch (error) {
    console.error('Replicate image generation failed:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});

// Add text overlay to image using Sharp
app.post('/api/add-text-overlay', async (req, res) => {
  const {
    imageUrl,
    overlayText,
    position = 'center',  // top, center, bottom
    style = 'default'     // default, bold, minimal, gradient
  } = req.body;

  if (!imageUrl || !overlayText) {
    return res.status(400).json({ error: 'Image URL and overlay text required' });
  }

  try {
    // Fetch the image (handle both URLs and base64)
    let imageBuffer;
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      const imageResponse = await fetch(imageUrl);
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    }

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    // Calculate text positioning
    const padding = Math.round(width * 0.08);
    const maxTextWidth = width - (padding * 2);

    // Position Y based on selection
    const positions = {
      top: Math.round(height * 0.15),
      center: Math.round(height * 0.5),
      bottom: Math.round(height * 0.85)
    };
    const textY = positions[position] || positions.center;

    // Style configurations
    const styles = {
      default: {
        fontSize: Math.round(width * 0.055),
        fontWeight: 600,
        fill: '#FFFFFF',
        shadow: true,
        background: 'rgba(0,0,0,0.4)',
        backgroundPadding: 20
      },
      bold: {
        fontSize: Math.round(width * 0.07),
        fontWeight: 700,
        fill: '#FFFFFF',
        shadow: true,
        background: 'rgba(0,0,0,0.6)',
        backgroundPadding: 30
      },
      minimal: {
        fontSize: Math.round(width * 0.05),
        fontWeight: 400,
        fill: '#FFFFFF',
        shadow: true,
        background: 'none',
        backgroundPadding: 0
      },
      gradient: {
        fontSize: Math.round(width * 0.055),
        fontWeight: 600,
        fill: '#FFFFFF',
        shadow: false,
        background: 'gradient',
        backgroundPadding: 40
      }
    };

    const currentStyle = styles[style] || styles.default;

    // Word wrap text
    const words = overlayText.split(' ');
    const lines = [];
    let currentLine = '';
    const charsPerLine = Math.floor(maxTextWidth / (currentStyle.fontSize * 0.55));

    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= charsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);

    // Build SVG overlay
    const lineHeight = currentStyle.fontSize * 1.4;
    const textBlockHeight = lines.length * lineHeight;
    const textStartY = textY - (textBlockHeight / 2);

    // Escape XML special characters
    const escapeXml = (text) => text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    let backgroundSvg = '';
    if (currentStyle.background === 'gradient') {
      backgroundSvg = `
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgba(0,0,0,0)"/>
            <stop offset="50%" style="stop-color:rgba(0,0,0,0.7)"/>
            <stop offset="100%" style="stop-color:rgba(0,0,0,0)"/>
          </linearGradient>
        </defs>
        <rect x="0" y="${textStartY - currentStyle.backgroundPadding}"
              width="${width}" height="${textBlockHeight + currentStyle.backgroundPadding * 2}"
              fill="url(#grad)"/>
      `;
    } else if (currentStyle.background !== 'none') {
      backgroundSvg = `
        <rect x="${padding - currentStyle.backgroundPadding}"
              y="${textStartY - currentStyle.backgroundPadding}"
              width="${maxTextWidth + currentStyle.backgroundPadding * 2}"
              height="${textBlockHeight + currentStyle.backgroundPadding * 2}"
              rx="8" ry="8"
              fill="${currentStyle.background}"/>
      `;
    }

    const textSvg = lines.map((line, i) => {
      const y = textStartY + (i * lineHeight) + currentStyle.fontSize;
      const shadow = currentStyle.shadow
        ? `style="filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.8))"`
        : '';
      return `<text x="${width / 2}" y="${y}"
                    font-family="Arial, Helvetica, sans-serif"
                    font-size="${currentStyle.fontSize}"
                    font-weight="${currentStyle.fontWeight}"
                    fill="${currentStyle.fill}"
                    text-anchor="middle"
                    ${shadow}>${escapeXml(line)}</text>`;
    }).join('\n');

    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${backgroundSvg}
        ${textSvg}
      </svg>
    `;

    // Composite image with overlay
    const outputBuffer = await sharp(imageBuffer)
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      }])
      .webp({ quality: 90 })
      .toBuffer();

    // Convert to base64 data URL
    const base64 = outputBuffer.toString('base64');
    const dataUrl = `data:image/webp;base64,${base64}`;

    console.log('Text overlay applied successfully');
    res.json({
      success: true,
      image: dataUrl,
      width,
      height
    });

  } catch (error) {
    console.error('Text overlay error:', error);
    res.status(500).json({ error: error.message });
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), supabase: !!supabase });
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
