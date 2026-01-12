# MoonBoots Content Studio

AI-powered social media content creation, scheduling, and analytics for thought leadership.

## Features

- **✨ Content Generation** - AI-powered drafts for LinkedIn, X, and Instagram
- **📋 Approval Queue** - Review and approve posts before publishing
- **📅 Calendar** - Visual scheduling view
- **🎨 Quote Cards** - Branded graphics generator
- **🧠 Insights & Learning** - Performance analytics that improve recommendations over time
- **🔗 Auto-posting** - Buffer integration for LinkedIn & Instagram (X is manual)

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Supabase (database)
- Claude API (content generation)
- Buffer API (scheduling)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/moonboots-content-studio.git
cd moonboots-content-studio
npm install
```

### 2. Set up Supabase (optional but recommended)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the SQL schema (see below)
4. Copy your project URL and anon key

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Run locally

```bash
npm run dev
```

### 4. Configure API keys

Open the app and go to **Settings** to add:
- Claude API key (for content generation)
- Buffer access token (for auto-posting)

## Supabase Schema

Run this SQL in your Supabase SQL editor:

```sql
-- Posts table
CREATE TABLE posts (
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

-- Performance tracking table
CREATE TABLE performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
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

-- Settings table
CREATE TABLE settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  claude_api_key TEXT,
  buffer_access_token TEXT,
  buffer_linkedin_profile_id TEXT,
  buffer_instagram_profile_id TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (single user app)
-- In production, add proper auth policies
CREATE POLICY "Allow all" ON posts FOR ALL USING (true);
CREATE POLICY "Allow all" ON performance FOR ALL USING (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true);
```

## Deploy to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

Railway will auto-detect Vite and build correctly.

## Posting Workflow

### LinkedIn & Instagram (Auto)
1. Generate content → Add to Queue
2. Review and Approve
3. System schedules via Buffer at optimal time
4. After posting, log performance in Insights

### X/Twitter (Manual)
1. Generate content → Add to Queue
2. Review and Approve
3. Copy content and post manually
4. Log performance in Insights

## Learning Engine

The system learns from your performance data:

- **Timing** - Discovers your best days/hours to post
- **Pillars** - Identifies which topics resonate most
- **Length** - Finds optimal post length
- **Leads** - Tracks which content drives business

Recommendations improve as you log more performance data (aim for 20+ posts).

## Project Structure

```
moonboots-content-studio/
├── public/
│   └── favicon.svg
├── src/
│   ├── lib/
│   │   ├── supabase.js    # Database client
│   │   ├── claude.js      # AI content generation
│   │   └── buffer.js      # Social scheduling
│   ├── App.jsx            # Main application
│   ├── main.jsx           # Entry point
│   └── index.css          # Styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env.example
```

## API Keys

### Claude API
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Add to Settings in the app

### Buffer
1. Go to [buffer.com/developers](https://buffer.com/developers)
2. Create an app and get access token
3. Add to Settings in the app

## Content Pillars

Pre-configured for MoonBoots:
- AI Strategy & Agentic Systems
- Web3 (without the hype)
- Community Building (Moments)
- Business Transformation
- Sport & Culture

## Brand Voice

- Calm, confident, jargon-free
- Human and approachable
- "Someone you trust with complex decisions"
- No hype, buzzwords, or crypto clichés

---

Built for [MoonBoots Consultancy](https://moonbootsconsultancy.net)
