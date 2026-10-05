// Marcus's posts end to end, against a fake Publer.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakePubler } from './helpers/fake-publer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOUCHLINE_KEY = 'tl_marcus_test_key';

let fake;
let service;
let toApiPost;
let secrets;
let dataDir;
let server;
let base;

const workspace = {
  id: 'touchline',
  slug: 'touchline',
  name: 'Touchline',
  pillars: [{ id: 'parents', name: 'Parents' }],
  brand_config: {
    posting_frequency: {
      linkedin: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], hours: [8, 12, 17] },
    },
  },
};

const londonHour = iso => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));

before(async () => {
  fake = await startFakePubler();
  process.env.PUBLER_API_URL = fake.url;
  process.env.PUBLER_POLL_MS = '10';
  dataDir = mkdtempSync(join(tmpdir(), 'content-studio-marcus-'));
  process.env.DATA_DIR = dataDir;
  delete process.env.RAILWAY_ENVIRONMENT;

  const { createStore } = await import('../server/store.js');
  const posts = await import('../server/posts.js');
  toApiPost = posts.toApiPost;
  secrets = { publer_api_key: 'good-key', platform_accounts: { linkedin: 'acc_li' } };
  service = posts.createPostService({
    store: createStore(null),
    getWorkspaceById: async id => (id === workspace.id ? workspace : null),
    getWorkspaceSecrets: async () => secrets,
    makeImage: async () => 'data:image/png;base64,iVBORw0KGgo=',
  });

  // The real server, for the HTTP contract
  const serverData = mkdtempSync(join(tmpdir(), 'content-studio-marcus-server-'));
  writeFileSync(join(serverData, 'content-studio-store.json'), JSON.stringify({
    workspace_settings: { touchline: { publer_api_key: 'good-key', platform_accounts: { linkedin: 'acc_li' } } },
  }));
  const port = 4900 + Math.floor(Math.random() * 90);
  base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), ADMIN_PASSWORD: 'pw', TOUCHLINE_API_KEY: TOUCHLINE_KEY, DATA_DIR: serverData };
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY']) delete env[name];
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
});

after(() => {
  server?.kill();
  fake?.close();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('a Marcus post without a time goes to the next UK posting slot and is scheduled in Publer', async () => {
  const post = await service.createScheduledPost(workspace, {
    platform: 'linkedin',
    content: 'Every child at Wicklewood Wanderers now has a plan. See it at touchline.xyz/register',
    pillar: 'Parents',
    source: 'marcus-cmo',
  });

  assert.equal(post.status, 'scheduled');
  assert.ok([8, 12, 17].includes(londonHour(post.scheduled_for)), 'slot is a Touchline posting hour in UK time');
  assert.ok(post.publer_post_id, 'Publer post id found');

  const sentText = fake.state.scheduleCalls.at(-1).bulk.posts[0].networks.linkedin.text;
  assert.match(sentText, /touchline\.xyz\/register\?utm_source=linkedin&utm_medium=organic_social&utm_campaign=parents/);
  assert.equal(post.content.includes('utm_'), false, 'stored text is unchanged');
});

test('two posts for the same platform get different slots', async () => {
  const a = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Post A about rainy sessions', source: 'marcus-cmo' });
  const b = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Post B about volunteers', source: 'marcus-cmo' });
  assert.notEqual(a.scheduled_for, b.scheduled_for);
});

test('scheduleFor is used when given', async () => {
  const when = '2030-03-05T09:00:00.000Z';
  const post = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Set time post', scheduleFor: when });
  assert.equal(post.scheduled_for, when);
});

test('a scheduleFor without a timezone is read as UK time', async () => {
  const post = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'UK time post', scheduleFor: '2030-07-02T08:00' });
  assert.equal(post.scheduled_for, '2030-07-02T07:00:00.000Z');
});

test('a post only counts as published once Publer reports it live', async () => {
  let post = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Going live soon', source: 'marcus-cmo' });
  assert.equal((await service.list({ workspaceId: 'touchline', status: 'published' })).length, 0);

  // Its time has passed but Publer has not published it yet
  post = await service.save({ ...post, scheduled_for: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
  post = await service.checkLive(post);
  assert.equal(post.status, 'scheduled');

  fake.goLive(post.publer_post_id);
  post = await service.checkLive(post);
  assert.equal(post.status, 'published');
  assert.ok(post.published_at);

  const api = toApiPost(post);
  assert.equal(api.platformPostId, post.publer_post_id);
  assert.equal(api.postUrl, `https://www.linkedin.com/feed/update/${post.publer_post_id}`);
  assert.deepEqual((await service.list({ workspaceId: 'touchline', status: 'published' })).map(p => p.id), [post.id]);
});

test('cancelling a scheduled post deletes it from Publer', async () => {
  const post = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Cancel me please', source: 'marcus-cmo' });
  const cancelled = await service.cancel(workspace, post.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.ok(fake.state.deleted.includes(post.publer_post_id));
});

test('an expired Publer key leaves the post queued with a clear reason, and a retry works once fixed', async () => {
  secrets.publer_api_key = 'expired-key';
  let post = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Waiting for a key', source: 'marcus-cmo' });
  assert.equal(post.status, 'queued');
  assert.match(post.error, /expired or been revoked/);

  secrets.publer_api_key = 'good-key';
  post = await service.retry(workspace, post.id);
  assert.equal(post.status, 'scheduled');
});

test('a post Publer refuses is marked failed with its reason', async () => {
  const post = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'FAILME this is far too long', source: 'marcus-cmo' });
  assert.equal(post.status, 'failed');
  assert.match(post.error, /too long/);
});

test('generateImage attaches a card and uploads it to Publer', async () => {
  const before = fake.state.media;
  const post = await service.createScheduledPost(workspace, { platform: 'linkedin', content: 'With a card', generateImage: true });
  assert.ok(post.image.startsWith('data:image/png'));
  assert.equal(fake.state.media, before + 1);
});

test('bad input is refused', async () => {
  await assert.rejects(service.createScheduledPost(workspace, { platform: 'tiktok', content: 'x' }), /platform must be one of/);
  await assert.rejects(service.createScheduledPost(workspace, { platform: 'linkedin', content: '' }), /content is required/);
  await assert.rejects(service.createScheduledPost(workspace, { platform: 'linkedin', content: 'x', scheduleFor: 'next tuesday' }), /scheduleFor must be a date/);
});

test('HTTP contract: POST and GET /api/posts keep the fields Marcus reads', async () => {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOUCHLINE_KEY}` };
  const created = await fetch(`${base}/api/posts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ platform: 'linkedin', content: 'Contract check post', pillar: 'Parents', generateImage: false, imageStyle: 'dark', source: 'marcus-cmo' }),
  });
  assert.equal(created.status, 200);
  const body = await created.json();
  for (const field of ['id', 'status', 'platform', 'publishedAt', 'scheduledFor', 'platformPostId', 'postUrl']) {
    assert.ok(field in body, `POST response has ${field}`);
  }
  assert.equal(body.status, 'scheduled');

  const listed = await (await fetch(`${base}/api/posts?status=published&limit=50`, { headers })).json();
  assert.deepEqual(listed.posts, [], 'nothing is published yet');

  const all = await (await fetch(`${base}/api/posts?limit=50`, { headers })).json();
  const mine = all.posts.find(p => p.id === body.id);
  for (const field of ['id', 'platform', 'content', 'pillar', 'status', 'publishedAt', 'platformPostId', 'postUrl']) {
    assert.ok(field in mine, `GET post has ${field}`);
  }
  assert.equal(mine.source, 'marcus-cmo');
});
