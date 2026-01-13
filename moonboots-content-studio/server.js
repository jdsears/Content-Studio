import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
    const response = await fetch('https://publer.io/api/v1/social_accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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

// Publer API proxy endpoint
app.post('/api/publish', async (req, res) => {
  const { apiKey, post, socialAccountId } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  if (!post) {
    return res.status(400).json({ error: 'Post data is required' });
  }

  // Platform mapping for fetching accounts
  const platformMap = {
    linkedin: 'linkedin',
    instagram: 'instagram',
    x: 'twitter',
  };

  const publerPlatform = platformMap[post.platform];

  try {
    // If no socialAccountId provided, try to find one
    let accountId = socialAccountId;

    if (!accountId) {
      // Fetch accounts to find matching platform
      const accountsResponse = await fetch('https://publer.io/api/v1/social_accounts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const accounts = await accountsResponse.json();

      if (!accountsResponse.ok) {
        return res.status(accountsResponse.status).json({
          error: 'Failed to fetch social accounts',
          details: accounts
        });
      }

      // Find account matching platform
      const matchingAccount = accounts.find(acc =>
        acc.platform === publerPlatform ||
        acc.platform === post.platform
      );

      if (!matchingAccount) {
        return res.status(400).json({
          error: `No ${post.platform} account connected in Publer. Please connect your ${post.platform} account in Publer first.`,
          availableAccounts: accounts.map(a => ({ id: a.id, platform: a.platform, name: a.name }))
        });
      }

      accountId = matchingAccount.id;
    }

    // Build Publer payload with social_account_ids
    const payload = {
      text: post.content,
      social_account_ids: [accountId],
    };

    // Add scheduling if specified
    if (post.scheduledFor) {
      payload.scheduled_at = new Date(post.scheduledFor).toISOString();
    }

    // Handle image upload if present
    let mediaUrl = null;
    if (post.image && post.image.startsWith('data:')) {
      // Upload image to Publer's media endpoint first
      try {
        const base64Data = post.image.split(',')[1];
        const mimeType = post.image.split(';')[0].split(':')[1] || 'image/png';

        const uploadResponse = await fetch('https://publer.io/api/v1/media/upload_base64', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            file: base64Data,
            content_type: mimeType,
          }),
        });

        const uploadText = await uploadResponse.text();

        // Check if response is HTML (error page)
        if (uploadText.trim().startsWith('<')) {
          console.error('Publer media upload returned HTML:', uploadText.substring(0, 200));
          // Continue without image
        } else {
          try {
            const uploadData = JSON.parse(uploadText);
            if (uploadResponse.ok && uploadData.url) {
              mediaUrl = uploadData.url;
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
      // Use URL directly
      mediaUrl = post.image;
    }

    // Add media to payload if we have it
    if (mediaUrl) {
      payload.media = [{ url: mediaUrl }];
    }

    console.log('Publer payload:', { ...payload, media: payload.media ? '[media present]' : 'no media' });

    const response = await fetch('https://publer.io/api/v1/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    // Handle potential HTML error responses
    const responseText = await response.text();

    // Check if response is HTML (error page)
    if (responseText.trim().startsWith('<')) {
      console.error('Publer API returned HTML:', responseText.substring(0, 200));
      return res.status(500).json({
        error: 'Publer API returned an error page. Please check your API key and try again.',
        hint: 'Your Publer API key may be invalid or expired.'
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

    res.json({ success: true, data });
  } catch (error) {
    console.error('Publer publish failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Publer' });
  }
});

// Claude API proxy endpoint for content generation
app.post('/api/generate', async (req, res) => {
  const { apiKey, topic, pillar, platforms } = req.body;

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

  const systemPrompt = `You are a social media content strategist for moonboots labs, a consultancy and venture studio.

moonboots labs focus areas:
1. COMMUNITY BUILDING INFRASTRUCTURE (moments) - A white-label community platform that lets creators own their audience relationships. Features: memberships, badges, gated content, live-streaming, fan timelines, rewards. For musicians, artists, athletes, brands seeking platform independence.
2. WEB3 INFRASTRUCTURE (deepfabrik) - Blockchain solutions, tokenization platforms
3. AGENTIC AI SOLUTIONS & CONSULTANCY - AI agents, automation, enterprise AI strategy
4. WEB3 STRATEGY & TOKENISED INVESTMENT - Token economics, crypto investment
5. VENTURE CAPITAL & REAL ESTATE - Startups, tokenized real estate

Write engaging, thought-provoking content that:
- Sounds authentic and conversational, not corporate
- Shares genuine insights and perspectives
- Avoids buzzwords and jargon
- Uses short paragraphs and line breaks for readability
- Is optimized for each platform's style and audience
- Positions community ownership as the future (own vs rent your audience)

The founder's voice is: thoughtful, direct, occasionally contrarian, draws from real experience with startups and enterprise clients. Skeptical of platform dependency, values substance over hype.`;

  const userPrompt = `Create social media posts about: "${topic}"
Content pillar: ${pillar || 'AI Strategy'}

Generate unique, platform-optimized content for: ${enabledPlatforms.join(', ')}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "linkedin": "LinkedIn post content here (professional, can be longer, use line breaks)",
  "x": "X/Twitter post content here (concise, punchy, under 280 chars ideal)",
  "instagram": "Instagram caption here (engaging, include relevant hashtags)"
}

Only include the platforms requested. Make each post unique and tailored to that platform's style.`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Failed to generate content',
        details: data
      });
    }

    // Extract the text content from Claude's response
    const textContent = data.content?.[0]?.text;
    if (!textContent) {
      return res.status(500).json({ error: 'No content generated' });
    }

    // Parse the JSON response
    try {
      const content = JSON.parse(textContent);
      res.json({ success: true, content });
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent);
      // Try to extract JSON from the response if it's wrapped in markdown
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const content = JSON.parse(jsonMatch[0]);
          res.json({ success: true, content });
        } catch {
          res.status(500).json({ error: 'Failed to parse generated content', raw: textContent });
        }
      } else {
        res.status(500).json({ error: 'Failed to parse generated content', raw: textContent });
      }
    }
  } catch (error) {
    console.error('Claude API failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to Claude API' });
  }
});

// Topic suggestion endpoint
app.post('/api/suggest-topic', async (req, res) => {
  const { apiKey, pillar } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'Claude API key is required' });
  }

  const moonbootsContext = `moonboots labs is a consultancy and venture studio focused on:

1. COMMUNITY BUILDING INFRASTRUCTURE (moments)
   moments is a white-label community infrastructure platform - NOT another social network.

   Core capabilities:
   - Memberships & subscriptions with flexible tiers
   - Achievement badges and gamification systems
   - Gated content for exclusive access
   - Live-streaming with real-time engagement
   - Fan timelines and activity feeds
   - Rewards and loyalty programs
   - Direct messaging and community interaction

   Use cases:
   - Musicians building direct fan relationships outside streaming platforms
   - Artists creating exclusive collector communities
   - Athletes connecting with superfans
   - Brands building owned community spaces
   - Creators seeking platform independence

   Strategic value:
   - Own your audience data and relationships (not rented from social platforms)
   - Brand continuity - your community, your rules, your look
   - Platform independence - no algorithm changes affecting reach
   - Monetization without platform fees or gatekeepers
   - Deep fan insights and engagement analytics

2. WEB3 INFRASTRUCTURE (deepfabrik) - Blockchain solutions, tokenization platforms, decentralized applications

3. AGENTIC AI SOLUTIONS & CONSULTANCY - AI agents, automation, enterprise AI strategy, practical AI implementation

4. WEB3 STRATEGY & TOKENISED INVESTMENT - Token economics, crypto investment strategies, DeFi

5. VENTURE CAPITAL & REAL ESTATE - Investment in startups, tokenized real estate, alternative assets

The founder's perspective: Practical, experience-driven insights from working with both startups and enterprises. Skeptical of hype, focused on what actually works. Values community over vanity metrics, substance over buzzwords. Believes creators and brands should own their audience relationships, not rent them from platforms.`;

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

// OpenAI DALL-E image generation proxy
app.post('/api/generate-image', async (req, res) => {
  const { apiKey, prompt, platform } = req.body;

  console.log('Generate image request for platform:', platform);

  if (!apiKey) {
    console.error('No OpenAI API key provided');
    return res.status(400).json({ error: 'OpenAI API key is required. Please add your OpenAI API key in Settings.' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Platform-specific sizes
  const size = platform === 'instagram' ? '1024x1792' : '1792x1024';
  console.log('Using size:', size, 'for platform:', platform);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard',
        response_format: 'b64_json',
      }),
    });

    // Get response as text first to handle potential HTML error pages
    const responseText = await response.text();

    // Check for HTML error page
    if (responseText.trim().startsWith('<')) {
      console.error('OpenAI API returned HTML:', responseText.substring(0, 200));
      return res.status(500).json({
        error: 'OpenAI API returned an error page. Please check your API key.',
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse OpenAI response:', responseText.substring(0, 200));
      return res.status(500).json({
        error: 'Invalid response from OpenAI API',
        raw: responseText.substring(0, 200)
      });
    }

    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Failed to generate image',
        details: data
      });
    }

    const base64Image = data.data?.[0]?.b64_json;
    if (!base64Image) {
      console.error('No image in response:', data);
      return res.status(500).json({ error: 'No image generated by OpenAI' });
    }

    console.log('Image generated successfully for', platform);
    res.json({
      success: true,
      image: `data:image/png;base64,${base64Image}`
    });
  } catch (error) {
    console.error('OpenAI image generation failed:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to OpenAI' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
