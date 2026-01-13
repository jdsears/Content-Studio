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

// Publer API proxy endpoint
app.post('/api/publish', async (req, res) => {
  const { apiKey, post } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  if (!post) {
    return res.status(400).json({ error: 'Post data is required' });
  }

  // Map platform names to Publer
  const platformMap = {
    linkedin: 'linkedin',
    instagram: 'instagram',
    x: 'twitter',
  };

  const publerPlatform = platformMap[post.platform];
  if (!publerPlatform) {
    return res.status(400).json({ error: `Unsupported platform: ${post.platform}` });
  }

  // Build Publer payload
  const payload = {
    text: post.content,
    platforms: [publerPlatform],
  };

  // Add image if present
  if (post.image) {
    payload.media = [{ url: post.image }];
  }

  // Add scheduling if specified
  if (post.scheduledFor) {
    payload.scheduled_at = new Date(post.scheduledFor).toISOString();
  }

  try {
    const response = await fetch('https://publer.io/api/v1/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Publer API error:', data);
      return res.status(response.status).json({
        error: data.message || data.error || 'Failed to publish to Publer',
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

  const systemPrompt = `You are a social media content strategist for moonboots, a consultancy focused on AI strategy, Web3, community building, and business transformation.

Write engaging, thought-provoking content that:
- Sounds authentic and conversational, not corporate
- Shares genuine insights and perspectives
- Avoids buzzwords and jargon
- Uses short paragraphs and line breaks for readability
- Is optimized for each platform's style and audience

The founder's voice is: thoughtful, direct, occasionally contrarian, draws from real experience with startups and enterprise clients.`;

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

// OpenAI DALL-E image generation proxy
app.post('/api/generate-image', async (req, res) => {
  const { apiKey, prompt, platform } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'OpenAI API key is required' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Platform-specific sizes
  const size = platform === 'instagram' ? '1024x1792' : '1792x1024';

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

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Failed to generate image',
        details: data
      });
    }

    const base64Image = data.data?.[0]?.b64_json;
    if (!base64Image) {
      return res.status(500).json({ error: 'No image generated' });
    }

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
