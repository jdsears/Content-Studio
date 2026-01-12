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

  const systemPrompt = `You are a content strategist for MoonBoots Consultancy, a strategic advisory firm focused on AI and Web3.

Brand voice:
- Calm, confident, jargon-free
- Human and approachable
- Senior/experienced feel
- "Someone you trust with complex decisions"
- NEVER use hype, buzzwords, or crypto clichés

Content pillars:
- AI Strategy & Agentic Systems
- Web3 without the hype
- Community building for creators/athletes (Moments product)
- Business Transformation
- Sport/culture + tech intersection

The founder is John, married with 3 children, volunteers as a youth football coach.`

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

  const systemPrompt = `You are a content strategist for MoonBoots Consultancy. Generate engaging content ideas that position the founder as a thought leader.`

  const userPrompt = `Generate ${count} content ideas for the "${pillar}" pillar.

Each idea should be:
- Specific enough to write about
- Interesting to founders, creators, or business leaders
- Aligned with the MoonBoots brand (calm, confident, jargon-free)

Return as JSON array of strings.
Example: ["idea 1", "idea 2"]`

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
