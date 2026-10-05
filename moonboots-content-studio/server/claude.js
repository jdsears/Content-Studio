import Anthropic from '@anthropic-ai/sdk';

// ============ CLAUDE SETTINGS (the one place to change models) ============
// drafting: writing posts and image card headlines
// planning: suggesting topics
export const CLAUDE_MODELS = {
  drafting: 'claude-sonnet-5-5',
  planning: 'claude-opus-5-5',
};

// These models always think before answering; effort sets how hard.
const CLAUDE_EFFORT = {
  drafting: 'medium',
  planning: 'medium',
};

// Thinking counts towards max_tokens, so leave plenty of room
const DEFAULT_MAX_TOKENS = 16000;

export function claudeApiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || null;
}

export const CLAUDE_KEY_MISSING = 'Claude is not set up on the server. Add ANTHROPIC_API_KEY in Railway > Variables.';

export class ClaudeError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function friendlyError(error) {
  if (error instanceof Anthropic.AuthenticationError) {
    return new ClaudeError('Claude rejected the API key. Check ANTHROPIC_API_KEY in Railway.', 502);
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new ClaudeError('This Claude API key is not allowed to use the model.', 502);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ClaudeError('Claude is busy (rate limit). Try again in a minute.', 429);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ClaudeError(`Claude could not handle the request: ${error.message}`, 400);
  }
  if (error instanceof Anthropic.APIError) {
    return new ClaudeError(`Claude API error${error.status ? ` ${error.status}` : ''}: ${error.message}`, 502);
  }
  return new ClaudeError(error.message || 'Could not reach Claude', 502);
}

// Ask Claude and return the reply text.
// Replies can start with thinking blocks, so only "text" blocks are read.
// With `schema`, Claude must reply with JSON matching it, and the parsed object is returned.
export async function askClaude({ purpose, system, prompt, schema, maxTokens = DEFAULT_MAX_TOKENS }) {
  const apiKey = claudeApiKey();
  if (!apiKey) throw new ClaudeError(CLAUDE_KEY_MISSING, 503);

  const client = new Anthropic({ apiKey });
  const outputConfig = { effort: CLAUDE_EFFORT[purpose] };
  if (schema) outputConfig.format = { type: 'json_schema', schema };

  let response;
  try {
    response = await client.beta.messages.create({
      model: CLAUDE_MODELS[purpose],
      max_tokens: maxTokens,
      // If a safety check declines the request, Anthropic retries it on a suitable model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: outputConfig,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (error) {
    throw friendlyError(error);
  }

  if (response.stop_reason === 'refusal') {
    throw new ClaudeError('Claude declined to write this. Try rewording the topic.', 422);
  }

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();

  if (response.stop_reason === 'max_tokens') {
    throw new ClaudeError('Claude ran out of room before finishing. Try a shorter request.', 502);
  }
  if (!text) throw new ClaudeError('Claude returned no text.', 502);

  if (!schema) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new ClaudeError('Claude returned content that could not be read.', 502);
  }
}
