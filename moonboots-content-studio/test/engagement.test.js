// Likes, comments, shares and reach read from Publer's analytics, against a fake Publer.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakePubler } from './helpers/fake-publer.js';

let fake;
let posts;
let engagement;
let secrets;
let dataDir;
let readInsight;
let metricValue;

const workspace = { id: 'touchline', slug: 'touchline', name: 'Touchline', pillars: [], brand_config: {} };

before(async () => {
  fake = await startFakePubler();
  process.env.PUBLER_API_URL = fake.url;
  process.env.PUBLER_POLL_MS = '10';
  dataDir = mkdtempSync(join(tmpdir(), 'content-studio-engagement-'));
  process.env.DATA_DIR = dataDir;
  delete process.env.RAILWAY_ENVIRONMENT;
  const { createStore } = await import('../server/store.js');
  const { createPostService } = await import('../server/posts.js');
  const mod = await import('../server/engagement.js');
  ({ readInsight, metricValue } = mod);
  const store = createStore(null);
  secrets = { publer_api_key: 'good-key', platform_accounts: { linkedin: 'acc_li' } };
  posts = createPostService({ store, getWorkspaceById: async () => workspace, getWorkspaceSecrets: async () => secrets });
  engagement = mod.createEngagementService({ store, posts, getWorkspaceSecrets: async () => secrets });
});

after(() => {
  fake?.close();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('metrics are read whether Publer sends numbers or { name, value }', () => {
  assert.equal(metricValue(12), 12);
  assert.equal(metricValue({ name: 'Reach', value: '450' }), 450);
  assert.equal(metricValue(null), null);
  assert.equal(metricValue({ name: 'Reach' }), null);
  const insight = readInsight({ id: 7, text: 'Hi', analytics: { reach: { value: 10 }, likes: 2, comments: null } });
  assert.deepEqual(insight.metrics, { reach: 10, likes: 2 });
  assert.equal(insight.id, '7');
});

test('published posts get their numbers from Publer, matched to the right post', async () => {
  // A draft approved and sent to Publer, which then goes live
  const draft = await posts.createStudioDraft(workspace, { platform: 'linkedin', content: 'Saturday mornings start with cones and bibs.' });
  const scheduled = await posts.approve(workspace, draft.id);
  assert.equal(scheduled.status, 'scheduled');
  fake.goLive(scheduled.publer_post_id);
  const live = await posts.checkLive(draft.id);
  assert.equal(live.status, 'published');

  // A published post Publer has never seen gets no numbers
  await posts.save({ id: 'post_unknown', workspace_id: 'touchline', platform: 'linkedin', content: 'Never sent through Publer', status: 'published', created_at: new Date().toISOString() });

  const status = await engagement.refresh(workspace, { force: true });
  assert.equal(status.ok, true);
  assert.equal(status.matched, 1);
  const withNumbers = await posts.get(draft.id);
  assert.equal(withNumbers.metrics.reach, 400);
  assert.equal(withNumbers.metrics.likes, 20);
  assert.equal(withNumbers.metrics.comments, 5);
  assert.equal(withNumbers.metrics.engagement_rate, 7.5);
  assert.ok(withNumbers.metrics.updated_at);
  assert.equal((await posts.get('post_unknown')).metrics, undefined);

  // Touchline HQ sees them in the fields it already reads, plus the new ones
  const { toApiPost } = await import('../server/posts.js');
  const api = toApiPost(withNumbers);
  assert.equal(api.metrics.likes, 20);
  assert.equal(api.metrics.shares, 3);
  assert.equal(api.engagement.reach, 400);
  assert.deepEqual(toApiPost(await posts.get('post_unknown')).metrics, { likes: 0, comments: 0, shares: 0 });
});

test('numbers are not fetched again within a few hours unless asked', async () => {
  const calls = fake.state.analyticsCalls;
  await engagement.refresh(workspace);
  assert.equal(fake.state.analyticsCalls, calls, 'a recent refresh is reused');
  await engagement.refresh(workspace, { force: true });
  assert.ok(fake.state.analyticsCalls > calls);
});

test('a key without the Analytics permission gives a clear message', async () => {
  fake.state.analyticsStatus = 403;
  try {
    const status = await engagement.refresh(workspace, { force: true });
    assert.equal(status.ok, false);
    assert.equal(status.code, 'no_analytics');
    assert.match(status.error, /Analytics permission/);
  } finally {
    fake.state.analyticsStatus = null;
  }
});

test('a workspace without a Publer key or accounts says so', async () => {
  const saved = secrets;
  try {
    secrets = {};
    assert.equal((await engagement.refresh({ ...workspace, id: 'nokey' }, { force: true })).code, 'no_key');
    secrets = { publer_api_key: 'good-key' };
    assert.equal((await engagement.refresh({ ...workspace, id: 'noaccounts' }, { force: true })).code, 'no_accounts');
  } finally {
    secrets = saved;
  }
});
