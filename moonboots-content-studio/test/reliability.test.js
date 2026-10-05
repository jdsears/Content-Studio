// Regression tests for the scheduling problems found in code review, against a fake Publer.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakePubler } from './helpers/fake-publer.js';

let fake;
let service;
let secrets;
let dataDir;

const workspace = {
  id: 'touchline',
  slug: 'touchline',
  name: 'Touchline',
  pillars: [],
  brand_config: {
    posting_frequency: {
      linkedin: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], hours: [8, 12, 17] },
    },
  },
};

const queuedPost = (id, content, extra = {}) => ({
  id, workspace_id: 'touchline', platform: 'linkedin', content, source: 'marcus-cmo', auto_schedule: true,
  status: 'queued', scheduled_for: '2030-05-01T08:00:00.000Z', created_at: new Date().toISOString(), ...extra,
});

before(async () => {
  fake = await startFakePubler();
  process.env.PUBLER_API_URL = fake.url;
  process.env.PUBLER_POLL_MS = '10';
  dataDir = mkdtempSync(join(tmpdir(), 'content-studio-reliability-'));
  process.env.DATA_DIR = dataDir;
  delete process.env.RAILWAY_ENVIRONMENT;
  const { createStore } = await import('../server/store.js');
  const { createPostService } = await import('../server/posts.js');
  secrets = { publer_api_key: 'good-key', platform_accounts: { linkedin: 'acc_li' } };
  service = createPostService({
    store: createStore(null),
    getWorkspaceById: async id => (id === workspace.id ? workspace : null),
    getWorkspaceSecrets: async () => secrets,
  });
});

beforeEach(() => {
  fake.state.scheduleDelayMs = 0;
  fake.state.scheduleStatus = null;
  fake.state.jobStatusCode = null;
});

after(() => {
  fake?.close();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('a post being sent is never sent a second time by the scheduler or a retry', async () => {
  await service.save(queuedPost('post_once', 'Sent exactly once'));
  fake.state.scheduleDelayMs = 150;
  const before = fake.state.scheduleCalls.length;

  const sending = service.submit('post_once');
  await new Promise(r => setTimeout(r, 30));
  await Promise.all([service.submit('post_once'), service.runChecks()]);
  await assert.rejects(service.retry(workspace, 'post_once'), /being sent to Publer right now/);
  const post = await sending;

  assert.equal(post.status, 'scheduled');
  assert.equal(fake.state.scheduleCalls.length, before + 1);
});

test('an error after Publer accepted a post keeps it scheduled instead of sending it again', async () => {
  await service.save(queuedPost('post_accepted', 'Accepted, then job status errors'));
  fake.state.jobStatusCode = 429;
  const before = fake.state.scheduleCalls.length;

  const post = await service.submit('post_accepted');
  assert.equal(post.status, 'scheduled');
  assert.ok(post.publer_job_id);

  await service.runChecks();
  assert.equal(fake.state.scheduleCalls.length, before + 1);
});

test('a cancel made while a send is failing is not undone', async () => {
  await service.save(queuedPost('post_cancel', 'Cancel while Publer is down'));
  fake.state.scheduleDelayMs = 150;
  fake.state.scheduleStatus = 503;

  const sending = service.submit('post_cancel');
  await new Promise(r => setTimeout(r, 30));
  await service.cancel(workspace, 'post_cancel');
  await sending;

  assert.equal((await service.get('post_cancel')).status, 'cancelled');
});

test('a post cancelled while Publer accepts it is taken back out of Publer', async () => {
  await service.save(queuedPost('post_withdraw', 'Cancelled mid send, then withdrawn'));
  fake.state.scheduleDelayMs = 150;

  const sending = service.submit('post_withdraw');
  await new Promise(r => setTimeout(r, 30));
  await service.cancel(workspace, 'post_withdraw');
  const post = await sending;

  assert.equal(post.status, 'cancelled');
  assert.ok(fake.state.deleted.includes(post.publer_post_id));
});

test('posts that start the same way are never mixed up', async () => {
  const opening = 'Matchday tips from Wicklewood Wanderers: ';
  const a = await service.createScheduledPost(workspace, { platform: 'linkedin', content: `${opening}keep warm-ups short.`, source: 'marcus-cmo' });
  const b = await service.createScheduledPost(workspace, { platform: 'linkedin', content: `${opening}let everyone take a throw-in.`, source: 'marcus-cmo' });
  assert.ok(a.publer_post_id && b.publer_post_id);
  assert.notEqual(a.publer_post_id, b.publer_post_id);

  // A goes live, B fails in Publer: B must not be reported as published
  fake.goLive(a.publer_post_id);
  fake.fail(b.publer_post_id);
  await service.update(b.id, null, { scheduled_for: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
  const checkedB = await service.checkLive(b.id);
  assert.equal(checkedB.status, 'failed');
  assert.notEqual(checkedB.publer_post_id, a.publer_post_id);
});

test('cancelling one of two similar posts deletes only that one from Publer', async () => {
  const opening = 'Training ideas for under 9s at Wicklewood Wanderers: ';
  const a = await service.createScheduledPost(workspace, { platform: 'linkedin', content: `${opening}rondos.`, source: 'marcus-cmo' });
  const b = await service.createScheduledPost(workspace, { platform: 'linkedin', content: `${opening}small-sided games.`, source: 'marcus-cmo' });
  await service.cancel(workspace, b.id);
  assert.ok(fake.state.deleted.includes(b.publer_post_id));
  assert.ok(!fake.state.deleted.includes(a.publer_post_id));
});

test('the same post sent twice within a few minutes is only posted once', async () => {
  const input = { platform: 'linkedin', content: 'A retried request should not double post', source: 'marcus-cmo' };
  const before = fake.state.scheduleCalls.length;
  const first = await service.createScheduledPost(workspace, input);
  const second = await service.createScheduledPost(workspace, input);
  assert.equal(second.id, first.id);
  assert.equal(fake.state.scheduleCalls.length, before + 1);
});

test('two posts arriving together get different slots', async () => {
  const [a, b] = await Promise.all([
    service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Parallel one', source: 'marcus-cmo' }),
    service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Parallel two', source: 'marcus-cmo' }),
  ]);
  assert.notEqual(a.scheduled_for, b.scheduled_for);
});

test('a send cut short by a restart is not resent automatically', async () => {
  await service.save(queuedPost('post_restart', 'Server stopped mid send', {
    sending_since: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  }));
  const before = fake.state.scheduleCalls.length;
  await service.runChecks();

  const post = await service.get('post_restart');
  assert.equal(post.status, 'failed');
  assert.equal(post.error_code, 'restarted');
  assert.equal(fake.state.scheduleCalls.length, before);
  await assert.rejects(service.retry(workspace, 'post_restart'), /may already have this post/);

  const resent = await service.retry(workspace, 'post_restart', { force: true });
  assert.equal(resent.status, 'scheduled');
});

test('a post with no text is refused, not sent', async () => {
  await service.save(queuedPost('post_empty', undefined));
  const post = await service.submit('post_empty');
  assert.equal(post.status, 'failed');
  assert.match(post.error, /no text/);
});
