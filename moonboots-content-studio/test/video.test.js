// Short branded videos: the renderer, the video store and video posts through Publer.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import express from 'express';
import sharp from 'sharp';
import { startFakePubler } from './helpers/fake-publer.js';
import { validateSpec, timeline, renderClip, ffmpegAvailable, framedScreen } from '../server/video.js';
import { createVideoStore, sendVideo, VIDEO_ID } from '../server/videos.js';

const SCREEN = 'https://touchline.xyz/guide/coach-match-live.webp';
const LINES = ['Match day mode is live.', 'Goals, subs and minutes, logged from the touchline.'];

let fake;
let dataDir;
let store;
let videos;
let service;
let toApiPost;
let made;
const workspace = { id: 'touchline', slug: 'touchline', name: 'Touchline', pillars: [], brand_config: {} };

// A tall stand-in for a phone screenshot
const phoneScreen = () => sharp({ create: { width: 390, height: 844, channels: 3, background: '#1E3A8A' } }).png().toBuffer();

before(async () => {
  fake = await startFakePubler();
  process.env.PUBLER_API_URL = fake.url;
  process.env.PUBLER_POLL_MS = '10';
  dataDir = mkdtempSync(join(tmpdir(), 'content-studio-video-'));
  process.env.DATA_DIR = dataDir;
  delete process.env.RAILWAY_ENVIRONMENT;
  const { createStore } = await import('../server/store.js');
  const posts = await import('../server/posts.js');
  toApiPost = posts.toApiPost;
  store = createStore(null);
  videos = createVideoStore(store);
  made = [];
  service = posts.createPostService({
    store,
    getWorkspaceById: async id => (id === workspace.id ? workspace : null),
    getWorkspaceSecrets: async () => ({ publer_api_key: 'good-key', platform_accounts: { facebook: 'acc_fb', linkedin: 'acc_li' } }),
    makeImage: async () => 'data:image/png;base64,iVBORw0KGgo=',
    makeVideo: async (ws, spec) => {
      made.push(spec);
      return videos.put(ws.id, Buffer.from('rendered again'), { platform: spec.platform });
    },
    videos,
  });
});

after(() => {
  fake?.close();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('a video spec needs 2 to 4 short lines and a screen from touchline.xyz', () => {
  assert.deepEqual(validateSpec({ lines: LINES, screenUrl: SCREEN }).lines, LINES);
  assert.equal(validateSpec({ lines: LINES, screenUrl: SCREEN }).cta, 'Your first month of Pro is free.');
  assert.throws(() => validateSpec({ lines: ['Only one'], screenUrl: SCREEN }), /2 to 4 lines/);
  assert.throws(() => validateSpec({ lines: [...LINES, 'a', 'b', 'c'], screenUrl: SCREEN }), /2 to 4 lines/);
  assert.throws(() => validateSpec({ lines: ['x'.repeat(80), 'ok'], screenUrl: SCREEN }), /under 70/);
  assert.throws(() => validateSpec({ lines: LINES, screenUrl: 'https://example.com/a.png' }), /touchline\.xyz/);
  assert.throws(() => validateSpec({ lines: LINES, screenUrl: 'http://touchline.xyz/a.png' }), /touchline\.xyz/);
  assert.throws(() => validateSpec({ lines: LINES, screenUrl: 'not a link' }), /screenUrl/);
  assert.throws(() => validateSpec({ platform: 'x', lines: LINES, screenUrl: SCREEN }), /Videos are for/);
});

test('the timeline gives each line time to be read before the screen and the end card', () => {
  const plan = timeline(3);
  assert.equal(plan.lines.length, 3);
  assert.ok(plan.lines[1] - plan.lines[0] >= 1.2);
  assert.ok(plan.screen > plan.lines[2]);
  assert.ok(plan.end - plan.screen >= 3);
  assert.ok(plan.total >= 9 && plan.total <= 14, `total ${plan.total}s`);
});

test('a clip renders to an MP4 from the lines and a phone screen', async t => {
  if (!(await ffmpegAvailable())) return t.skip('ffmpeg not installed');
  const screen = await phoneScreen();
  let asked = null;
  const clip = await renderClip({ lines: LINES, screenUrl: SCREEN }, { fetchImage: async url => { asked = url; return screen; } });
  assert.equal(asked, SCREEN);
  assert.equal(clip.buffer.subarray(4, 8).toString(), 'ftyp', 'an MP4 file');
  assert.ok(clip.buffer.length > 20000, `${clip.buffer.length} bytes`);
  assert.equal(clip.width, 1080);
  assert.equal(clip.height, 1350);
  assert.equal(clip.durationSec, Math.round(timeline(2).total * 10) / 10);
});

test('the store keeps videos under long random ids and serves byte ranges for Safari', async () => {
  const saved = await videos.put('touchline', Buffer.from('0123456789'), { platform: 'facebook' });
  assert.match(saved.id, VIDEO_ID);
  assert.equal((await videos.meta(saved.id)).workspace_id, 'touchline');
  assert.equal((await videos.read(saved.id)).toString(), '0123456789');
  assert.equal(await videos.read('vid_../../etc/passwd'), null);
  assert.equal(await videos.meta('nope'), null);

  const app = express();
  app.get('/v', async (req, res) => sendVideo(req, res, await videos.read(saved.id)));
  const server = http.createServer(app).listen(0);
  const url = `http://127.0.0.1:${server.address().port}/v`;
  try {
    const whole = await fetch(url);
    assert.equal(whole.status, 200);
    assert.equal(whole.headers.get('accept-ranges'), 'bytes');
    assert.equal(await whole.text(), '0123456789');
    const part = await fetch(url, { headers: { Range: 'bytes=2-5' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await part.text(), '2345');
    const tail = await fetch(url, { headers: { Range: 'bytes=-3' } });
    assert.equal(await tail.text(), '789');
    const beyond = await fetch(url, { headers: { Range: 'bytes=20-' } });
    assert.equal(beyond.status, 416);
  } finally {
    server.close();
  }

  await videos.remove(saved.id);
  assert.equal(await videos.read(saved.id), null);
});

test('a post with a video uploads the MP4 and schedules a video post in Publer', async () => {
  const preview = await videos.put('touchline', Buffer.from('fake mp4'), { platform: 'facebook' });
  const uploadsBefore = fake.state.uploads.length;
  const post = await service.createScheduledPost(workspace, {
    platform: 'facebook', content: 'Match day mode is live in Touchline.', videoId: preview.id, generateImage: true, source: 'marcus-cmo',
  });
  assert.equal(post.status, 'scheduled');
  assert.equal(post.video_id, preview.id);
  assert.equal(post.image_ref || post.image || null, null, 'no image card on a video post');
  assert.deepEqual(fake.state.uploads.slice(uploadsBefore), ['video/mp4']);
  const network = fake.state.scheduleCalls.at(-1).bulk.posts[0].networks.facebook;
  assert.equal(network.type, 'video');
  assert.equal(network.media[0].type, 'video');
  assert.equal(toApiPost(post).video, `/api/videos/${preview.id}.mp4`);
});

test('a video preview that has gone is rendered again from its spec', async () => {
  made.length = 0;
  const post = await service.createScheduledPost(workspace, {
    platform: 'facebook', content: 'Rendered again post', videoId: 'vid_000000000000000000000000',
    video: { lines: LINES, screenUrl: SCREEN }, source: 'marcus-cmo',
  });
  assert.equal(made.length, 1);
  assert.equal(made[0].platform, 'facebook');
  assert.deepEqual(made[0].lines, LINES);
  assert.match(post.video_id, VIDEO_ID);
  assert.equal(post.status, 'scheduled');
});

test("a video id from another workspace, or one that has gone without a spec, is refused", async () => {
  const theirs = await videos.put('someone-else', Buffer.from('theirs'), {});
  await assert.rejects(
    service.createScheduledPost(workspace, { platform: 'facebook', content: 'Not my video', videoId: theirs.id }),
    error => error.status === 404,
  );
  await assert.rejects(
    service.createScheduledPost(workspace, { platform: 'facebook', content: 'Gone video', videoId: 'vid_111111111111111111111111' }),
    /not found/,
  );
});

test('imageUrl is kept on the post (https only) instead of a generated card', async () => {
  const post = await service.createScheduledPost(workspace, {
    platform: 'linkedin', content: 'Image link post', imageUrl: 'https://touchline.xyz/blog/match-day-mode.png', generateImage: true,
  });
  assert.equal(post.image, 'https://touchline.xyz/blog/match-day-mode.png');
  assert.equal(post.image_ref || null, null);
  await assert.rejects(
    service.createScheduledPost(workspace, { platform: 'linkedin', content: 'Plain http image', imageUrl: 'http://touchline.xyz/a.png' }),
    /https/,
  );
});

test('phone screenshots go in a phone; wide and tall desktop pages in a browser frame below the text', async () => {
  const image = (width, height) => sharp({ create: { width, height, channels: 3, background: '#223344' } }).png().toBuffer();
  const phone = await framedScreen(await image(780, 1688), 1080);
  assert.equal(phone.portrait, true);
  const wide = await framedScreen(await image(1600, 1000), 1080);
  assert.equal(wide.portrait, false);
  const tall = await framedScreen(await image(1600, 1851), 1080);
  assert.equal(tall.portrait, false, 'the club dashboard is a desktop page');
  assert.ok(tall.height <= Math.round(929 * 0.62) + 42, `cropped to the top of the page (${tall.height}px)`);
});

test('with no account chosen, posts go to the brand page and never default to a personal profile', async () => {
  const { defaultAccount } = await import('../server/publer.js');
  const profile = { id: 'p1', platform: 'linkedin', type: 'in_profile', name: 'John' };
  const page = { id: 'pg1', platform: 'linkedin', type: 'in_page', name: 'Touchline' };
  assert.equal(defaultAccount([profile, page], 'linkedin').id, 'pg1', 'the page, even when Publer lists the profile first');
  assert.equal(defaultAccount([profile], 'linkedin'), null, 'a personal profile must be chosen on purpose');
  assert.equal(defaultAccount([{ id: 'f1', platform: 'facebook', type: 'fb_page' }], 'facebook').id, 'f1');
  assert.equal(defaultAccount([{ id: 'x1', platform: 'x', type: 'twitter' }], 'x').id, 'x1');
  assert.equal(defaultAccount([], 'facebook'), null);
});
