// Drafts written in Content Studio are kept on the server, not in one browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakePubler } from './helpers/fake-publer.js';

let fake;
let service;
let secrets;
let dataDir;

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const workspace = { id: 'touchline', slug: 'touchline', name: 'Touchline', pillars: [], brand_config: {} };
const imageFiles = () => (existsSync(join(dataDir, 'images')) ? readdirSync(join(dataDir, 'images')) : []);

before(async () => {
  fake = await startFakePubler();
  process.env.PUBLER_API_URL = fake.url;
  process.env.PUBLER_POLL_MS = '10';
  dataDir = mkdtempSync(join(tmpdir(), 'content-studio-drafts-'));
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

after(() => {
  fake?.close();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('a draft is saved on the server with its image as a file, not inside the store', async () => {
  const draft = await service.createStudioDraft(workspace, { platform: 'linkedin', content: 'Saturday mornings', pillar: 'Coaches & managers', image: PNG });
  assert.equal(draft.status, 'pending');
  assert.equal(draft.source, 'studio');
  assert.equal(draft.image, null);
  assert.match(draft.image_ref, /^file:post_[a-z0-9]+\.png$/);
  assert.equal(imageFiles().length, 1);
  assert.ok(!readFileSync(join(dataDir, 'content-studio-store.json'), 'utf8').includes('iVBORw0KGgo'), 'the store file holds no image data');
  const image = await service.readImage(draft);
  assert.equal(image.type, 'image/png');
  assert.ok(image.buffer.length > 0);
});

test('a draft can be edited, its image removed, rejected, reopened and deleted', async () => {
  const draft = await service.createStudioDraft(workspace, { platform: 'facebook', content: 'First words', image: PNG });
  const before = imageFiles().length;

  const edited = await service.editDraft(workspace, draft.id, { content: 'Better words', image: null });
  assert.equal(edited.content, 'Better words');
  assert.equal(edited.image_ref, null);
  assert.equal(imageFiles().length, before - 1, 'the old image file is deleted');

  assert.equal((await service.reject(workspace, draft.id)).status, 'rejected');
  assert.equal((await service.reopen(workspace, draft.id)).status, 'pending');
  await service.deletePost(workspace, draft.id);
  assert.equal(await service.get(draft.id), null);
  await assert.rejects(service.editDraft(workspace, 'post_missing', { content: 'x' }), /not found/i);
});

test('approving a draft with no time sends it to Publer straight away, through the safe pipeline', async () => {
  const draft = await service.createStudioDraft(workspace, { platform: 'linkedin', content: 'Goes out now', image: PNG });
  const media = fake.state.media;
  const approved = await service.approve(workspace, draft.id);
  assert.equal(approved.status, 'scheduled');
  assert.ok(new Date(approved.scheduled_for) - Date.now() < 5 * 60 * 1000, 'scheduled within a few minutes');
  assert.equal(fake.state.media, media + 1, 'the image went to Publer');
  assert.ok(fake.state.posts.some(p => p.text.includes('Goes out now')));
  await assert.rejects(service.deletePost(workspace, draft.id), /on its way to Publer/);
  await assert.rejects(service.editDraft(workspace, draft.id, { content: 'too late' }), /can't be edited/);
});

test('a draft with a future time keeps it', async () => {
  const at = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const draft = await service.createStudioDraft(workspace, { platform: 'linkedin', content: 'Later this week', scheduledFor: at });
  const approved = await service.approve(workspace, draft.id);
  assert.equal(approved.scheduled_for, at);
});

test('X, and any workspace without a Publer key, is approved to post by hand', async () => {
  const tweet = await service.createStudioDraft(workspace, { platform: 'x', content: 'Short and sharp' });
  const approved = await service.approve(workspace, tweet.id);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.manual, true);
  const posted = await service.markPosted(workspace, tweet.id);
  assert.equal(posted.status, 'published');
  assert.ok(posted.published_at);

  const saved = secrets;
  secrets = {};
  try {
    const draft = await service.createStudioDraft(workspace, { platform: 'linkedin', content: 'No key yet' });
    assert.equal((await service.approve(workspace, draft.id)).status, 'approved');
    assert.equal((await service.reopen(workspace, draft.id)).status, 'pending', 'an approved draft can go back to approvals');
  } finally {
    secrets = saved;
  }
});

test('drafts moved from a browser keep their state and are only saved once', async () => {
  const sent = { platform: 'linkedin', content: 'From the browser', localId: 1717171717, status: 'rejected', createdAt: '2026-09-01T09:00:00.000Z' };
  const first = await service.createStudioDraft(workspace, sent);
  const again = await service.createStudioDraft(workspace, sent);
  assert.equal(again.id, first.id);
  assert.equal(first.status, 'rejected');
  assert.equal(first.created_at, '2026-09-01T09:00:00.000Z');
  const published = await service.createStudioDraft(workspace, { platform: 'facebook', content: 'Already out', localId: 42, status: 'published', publishedAt: '2026-09-02T10:00:00.000Z' });
  assert.equal(published.status, 'published');
  assert.equal(published.published_at, '2026-09-02T10:00:00.000Z');
  const odd = await service.createStudioDraft(workspace, { platform: 'facebook', content: 'Odd status', localId: 43, status: 'cancelled' });
  assert.equal(odd.status, 'pending', 'unknown states come back as drafts');
  const fresh = await service.createStudioDraft(workspace, { platform: 'facebook', content: 'New one', status: 'published' });
  assert.equal(fresh.status, 'pending', 'only drafts moved from a browser can arrive with a state');
});

test('bad drafts are refused', async () => {
  await assert.rejects(service.createStudioDraft(workspace, { platform: 'tiktok', content: 'x' }), /platform must be one of/);
  await assert.rejects(service.createStudioDraft(workspace, { platform: 'linkedin', content: '  ' }), /no text/);
  await assert.rejects(service.createStudioDraft(workspace, { platform: 'linkedin', content: 'x', scheduledFor: 'soon' }), /not a date/);
});

test('images kept inside older posts are moved out to files', async () => {
  await service.save({ id: 'post_oldinline', workspace_id: 'touchline', platform: 'linkedin', content: 'Old', status: 'published', image: PNG, created_at: new Date().toISOString() });
  assert.ok(await service.moveInlineImages() >= 1);
  const moved = await service.get('post_oldinline');
  assert.equal(moved.image, null);
  assert.match(moved.image_ref, /^file:post_oldinline\.png$/);
  assert.equal(await service.moveInlineImages(), 0, 'nothing left to move');
});
