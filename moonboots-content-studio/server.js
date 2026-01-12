import express from 'express';
import pg from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection - only create if DATABASE_URL exists
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

// Initialize database tables
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        content TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'x', 'instagram')),
        pillar TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'published', 'rejected')),
        suggested_time TEXT,
        scheduled_for TIMESTAMP,
        buffer_update_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS performance (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        platform TEXT NOT NULL,
        pillar TEXT,
        posted_at TIMESTAMP NOT NULL,
        day_of_week TEXT,
        hour INTEGER,
        length INTEGER,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        leads INTEGER DEFAULT 0,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        claude_api_key TEXT,
        buffer_access_token TEXT,
        buffer_linkedin_profile_id TEXT,
        buffer_instagram_profile_id TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: !!pool });
});

// Posts
app.get('/api/posts', async (req, res) => {
  if (!pool) return res.json([]);
  try {
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/posts', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { content, platform, pillar, status, suggested_time, scheduled_for } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO posts (content, platform, pillar, status, suggested_time, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [content, platform, pillar, status || 'pending', suggested_time, scheduled_for]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.patch('/api/posts/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { id } = req.params;
  const updates = req.body;

  const setClause = Object.keys(updates)
    .map((key, i) => `${key} = $${i + 2}`)
    .join(', ');
  const values = [id, ...Object.values(updates)];

  try {
    const result = await pool.query(
      `UPDATE posts SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Performance
app.get('/api/performance', async (req, res) => {
  if (!pool) return res.json([]);
  try {
    const result = await pool.query('SELECT * FROM performance ORDER BY posted_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

app.post('/api/performance', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { post_id, content, platform, pillar, posted_at, day_of_week, hour, length, likes, comments, shares, leads, rating, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO performance (post_id, content, platform, pillar, posted_at, day_of_week, hour, length, likes, comments, shares, leads, rating, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [post_id, content, platform, pillar, posted_at, day_of_week, hour, length, likes, comments, shares, leads, rating, notes]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error logging performance:', error);
    res.status(500).json({ error: 'Failed to log performance' });
  }
});

// Settings
app.get('/api/settings', async (req, res) => {
  if (!pool) return res.json(null);
  try {
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { claude_api_key, buffer_access_token, buffer_linkedin_profile_id, buffer_instagram_profile_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO settings (id, claude_api_key, buffer_access_token, buffer_linkedin_profile_id, buffer_instagram_profile_id, updated_at)
       VALUES (1, $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         claude_api_key = EXCLUDED.claude_api_key,
         buffer_access_token = EXCLUDED.buffer_access_token,
         buffer_linkedin_profile_id = EXCLUDED.buffer_linkedin_profile_id,
         buffer_instagram_profile_id = EXCLUDED.buffer_instagram_profile_id,
         updated_at = NOW()
       RETURNING *`,
      [claude_api_key, buffer_access_token, buffer_linkedin_profile_id, buffer_instagram_profile_id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  // Express 5 requires named wildcard parameters
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Start server
async function start() {
  try {
    if (pool) {
      await initDatabase();
    } else {
      console.log('No DATABASE_URL provided - running in demo mode');
    }
  } catch (error) {
    console.error('Database init error (continuing anyway):', error.message);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

start();
