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
