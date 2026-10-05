// Checks the Claude helper against a fake Messages API (no real calls, no cost).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { askClaude, CLAUDE_MODELS } from '../server/claude.js';

let fake;
let lastRequest;
let nextReply;

before(async () => {
  fake = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      lastRequest = { headers: req.headers, body: JSON.parse(body) };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_test', type: 'message', role: 'assistant', model: lastRequest.body.model,
        usage: { input_tokens: 1, output_tokens: 1 }, ...nextReply,
      }));
    });
  });
  await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

after(() => {
  fake?.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

test('reads only text blocks, even when the reply starts with thinking', async () => {
  nextReply = {
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: 'Rainy Tuesday sessions ' },
      { type: 'text', text: 'that still work' },
    ],
  };
  const topic = await askClaude({ purpose: 'planning', prompt: 'Suggest a topic' });
  assert.equal(topic, 'Rainy Tuesday sessions that still work');
  assert.equal(lastRequest.body.model, CLAUDE_MODELS.planning);
  assert.equal(lastRequest.body.model, 'claude-opus-5-5');
});

test('drafting uses Sonnet with structured output, fallbacks and no thinking settings', async () => {
  nextReply = {
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: '{"linkedin":"Post one","x":"Post two"}' },
    ],
  };
  const schema = { type: 'object', properties: { linkedin: { type: 'string' }, x: { type: 'string' } }, required: ['linkedin', 'x'], additionalProperties: false };
  const posts = await askClaude({ purpose: 'drafting', system: 'Be brief', prompt: 'Write', schema });
  assert.deepEqual(posts, { linkedin: 'Post one', x: 'Post two' });

  const body = lastRequest.body;
  assert.equal(body.model, 'claude-sonnet-5-5');
  assert.equal(body.fallbacks, 'default');
  assert.equal(body.thinking, undefined);
  assert.equal(body.output_config.effort, 'medium');
  assert.deepEqual(body.output_config.format, { type: 'json_schema', schema });
  assert.ok(body.max_tokens >= 16000);
  assert.match(lastRequest.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
});

test('a refusal becomes a clear error', async () => {
  nextReply = { stop_reason: 'refusal', content: [] };
  await assert.rejects(askClaude({ purpose: 'drafting', prompt: 'x' }), err => err.status === 422 && /declined/.test(err.message));
});
