// Claude API helper for content generation

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

export async function generateContent({ topic, pillar, platforms, apiKey }) {
  if (!apiKey) {
    throw new Error('Claude API key not configured')
  }

  const platformInstructions = {
    linkedin: 'LinkedIn (professional, 150-300 words, thought leadership tone, can use line breaks for emphasis)',
    x: 'X/Twitter (punchy, under 280 characters, conversational, no hashtags)',
    instagram: 'Instagram (engaging, 100-200 words, include 3-5 relevant hashtags at the end)',
  }

  const selectedPlatforms = Object.entries(platforms)
    .filter(([_, enabled]) => enabled)
    .map(([platform]) => platformInstructions[platform])
    .join('\n- ')

  const systemPrompt = `You are a content strategist for MoonBoots Consultancy. Your strategic goal is to create content that funnels attention to two key properties:

**moonbootsconsultancy.net** - Strategic advisory for business leaders navigating AI and emerging tech
Services: AI strategy & implementation, Agentic systems design, Web3/blockchain consulting, Digital transformation, Fractional CTO/advisor roles
Target audience: Founders, CEOs, business leaders who need trusted guidance on complex technology decisions

**moments.deepfabrik.com** - Fan engagement platform for creators and athletes
Product: White-label community platform that helps creators/athletes build direct relationships with their audience through exclusive content, moments, and experiences
Target audience: Athletes, creators, sports teams, and the brands/managers who support them

CONTENT STRATEGY:
- Posts should naturally lead readers toward these solutions without being salesy
- For AI/Web3/transformation topics → subtle reference to moonbootsconsultancy.net
- For community/creator/athlete/sport topics → subtle reference to moments.deepfabrik.com
- Include soft CTAs when appropriate ("DM me", "link in bio", "learn more at...")
- Build thought leadership that positions John as the obvious choice when readers need help

BRAND VOICE:
- Calm, confident, jargon-free
- Human and approachable
- Senior/experienced feel - "someone you trust with complex decisions"
- NEVER use hype, buzzwords, or crypto clichés
- Share real insights, not platitudes

CONTENT PILLARS:
- AI Strategy & Agentic Systems → funnels to moonbootsconsultancy.net
- Web3 without the hype → funnels to moonbootsconsultancy.net
- Community building for creators/athletes → funnels to moments.deepfabrik.com
- Business Transformation → funnels to moonbootsconsultancy.net
- Sport/culture + tech intersection → funnels to moments.deepfabrik.com

FOUNDER CONTEXT:
John is married with 3 children, volunteers as a youth football coach. This informs his authentic perspective on team-building, coaching, and balancing ambition with what matters.`

  const userPrompt = `Create social media content about: "${topic}"

Content pillar: ${pillar}

Generate separate posts for:
- ${selectedPlatforms}

Return as JSON with keys for each platform (linkedin, x, instagram). Only include the platforms requested.
Example format:
{
  "linkedin": "post content here",
  "x": "post content here"
}`

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to generate content')
    }

    const data = await response.json()
    const content = data.content[0].text

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    throw new Error('Could not parse generated content')
  } catch (error) {
    console.error('Content generation error:', error)
    throw error
  }
}

// Generate content ideas based on pillar
export async function generateIdeas({ pillar, count = 5, apiKey }) {
  if (!apiKey) {
    throw new Error('Claude API key not configured')
  }

  const systemPrompt = `You are a content strategist for MoonBoots Consultancy. Generate content ideas that position John as a thought leader while funneling attention to:
- moonbootsconsultancy.net (AI strategy, Web3, digital transformation advisory)
- moments.deepfabrik.com (fan engagement platform for creators/athletes)

Ideas should create demand for these services without being promotional.`

  const userPrompt = `Generate ${count} content ideas for the "${pillar}" pillar.

Each idea should be:
- A specific, compelling angle (not generic)
- Interesting to founders, creators, athletes, or business leaders
- Naturally leads readers to want help with AI strategy, transformation, or community building
- Aligned with the MoonBoots brand (calm, confident, jargon-free, no hype)

Return as JSON array of strings - just the topic/angle, not full posts.
Example: ["Why most AI strategies fail in year one (and what to do instead)", "The hidden cost of not owning your fan relationships"]`

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to generate ideas')
    }

    const data = await response.json()
    const content = data.content[0].text

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    throw new Error('Could not parse ideas')
  } catch (error) {
    console.error('Idea generation error:', error)
    throw error
  }
}
