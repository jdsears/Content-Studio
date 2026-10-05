// Security checks for the API. Starts the real server on a spare port with test settings.
// Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4100 + Math.floor(Math.random() * 800);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = 'test-admin-password';
const TOUCHLINE_KEY = 'tl_test_key_abcd';
const SAVED_PUBLER_KEY = 'PUBLER-SECRET-KEY-9876';

let server;
let dataDir;
let cookie;

async function api(path, { method = 'GET', body, headers = {}, auth } = {}) {
  const allHeaders = { 'Content-Type': 'application/json', ...headers };
  if (auth === 'admin') allHeaders.Cookie = cookie;
  else if (auth) allHeaders.Authorization = `Bearer ${auth}`;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: allHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, text, headers: response.headers };
}

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'content-studio-test-'));
  // A Publer key saved by an earlier session, to prove it is never sent back
  writeFileSync(join(dataDir, 'content-studio-store.json'), JSON.stringify({
    workspace_settings: {
      touchline: { publer_api_key: SAVED_PUBLER_KEY, platform_accounts: { linkedin: 'acc_1' } },
    },
  }));

  const env = { ...process.env, PORT: String(PORT), ADMIN_PASSWORD, TOUCHLINE_API_KEY: TOUCHLINE_KEY, DATA_DIR: dataDir };
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'MOONBOOTS_API_KEY', 'ANTHROPIC_API_KEY',
    'CLAUDE_API_KEY', 'ANTHROPIC_BASE_URL', 'RAILWAY_ENVIRONMENT', 'RAILWAY_VOLUME_MOUNT_PATH']) {
    delete env[name];
  }
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore' });

  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server did not start');
});

after(() => {
  server?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('health check is public and reports storage', async () => {
  const res = await api('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.status, 'ok');
  assert.equal(res.json.storage.type, 'file');
  assert.equal(res.json.storage.ok, true);
});

test('admin routes need the login', async () => {
  const routes = [
    ['GET', '/api/workspaces'],
    ['GET', '/api/workspaces/touchline'],
    ['GET', '/api/Workspaces'],
    ['PUT', '/api/workspaces/touchline', { api_key: 'attacker' }],
    ['POST', '/api/workspaces/touchline/generate-api-key'],
    ['PUT', '/api/workspaces/touchline/publer-settings', { publerApiKey: 'x' }],
    ['POST', '/api/publer/test', { workspaceId: 'touchline' }],
    ['POST', '/api/publish', { workspaceId: 'touchline', post: { platform: 'linkedin', content: 'hi' } }],
    ['POST', '/api/generate', { topic: 't', platforms: { linkedin: true } }],
    ['GET', '/api/config'],
    ['PUT', '/api/context/profile', { about_me: 'x' }],
  ];
  for (const [method, path, body] of routes) {
    const res = await api(path, { method, body });
    assert.equal(res.status, 401, `${method} ${path} should need login`);
    assert.equal(res.json.code, 'login_required');
  }
});

test('a workspace key does not unlock admin routes', async () => {
  const res = await api('/api/workspaces', { auth: TOUCHLINE_KEY });
  assert.equal(res.status, 401);
});

test('POST /api/posts needs a valid key, even when it claims to be Marcus', async () => {
  const body = { platform: 'linkedin', content: 'hello', source: 'marcus-cmo' };
  assert.equal((await api('/api/posts', { method: 'POST', body })).status, 401);
  assert.equal((await api('/api/posts', { method: 'POST', body, auth: 'wrong-key' })).status, 401);
});

test('GET /api/posts and /api/v1 need a valid key', async () => {
  assert.equal((await api('/api/posts')).status, 401);
  assert.equal((await api('/api/posts?source=marcus-cmo&status=published')).status, 401);
  assert.equal((await api('/api/posts', { auth: 'wrong-key' })).status, 401);
  assert.equal((await api('/api/v1/content/queue')).status, 401);
  assert.equal((await api('/api/v1/content/queue', { auth: TOUCHLINE_KEY })).status, 200);
});

test('v1 submit refuses a platform with no text', async () => {
  const res = await api('/api/v1/content/submit', {
    method: 'POST', auth: TOUCHLINE_KEY, body: { platforms: ['linkedin'], content: { facebook: 'Only Facebook text' } },
  });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /no text for: linkedin/);
});

test('wrong password is refused, right password sets a secure session cookie', async () => {
  const wrong = await api('/api/auth/login', { method: 'POST', body: { password: 'nope' } });
  assert.equal(wrong.status, 401);

  const right = await api('/api/auth/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
  assert.equal(right.status, 200);
  const setCookie = right.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  cookie = setCookie.split(';')[0];

  const me = await api('/api/auth/me', { auth: 'admin' });
  assert.equal(me.json.authenticated, true);
});

test('a tampered session cookie is refused', async () => {
  const [name, value] = cookie.split('=');
  const [expires] = value.split('.');
  const forged = `${name}=${Number(expires) + 1000}.${value.split('.')[1]}`;
  const res = await fetch(`${BASE}/api/workspaces`, { headers: { Cookie: forged } });
  assert.equal(res.status, 401);
});

test('workspace responses never include the Publer key or API keys', async () => {
  const list = await api('/api/workspaces', { auth: 'admin' });
  assert.equal(list.status, 200);
  assert.ok(!list.text.includes(SAVED_PUBLER_KEY));
  assert.ok(!list.text.includes(TOUCHLINE_KEY));

  const touchline = list.json.find(w => w.id === 'touchline');
  assert.equal(touchline.has_publer_key, true);
  assert.equal(touchline.publer_key_last4, '9876');
  assert.equal(touchline.api_key_source, 'railway');
  assert.equal(touchline.api_key_last4, 'abcd');
  assert.equal(touchline.publer_api_key, undefined);
  assert.equal(touchline.api_key, undefined);

  const single = await api('/api/workspaces/touchline', { auth: 'admin' });
  assert.ok(!single.text.includes(SAVED_PUBLER_KEY));
  assert.ok(!single.text.includes(TOUCHLINE_KEY));
});

test('the API key cannot be set through the workspace edit route', async () => {
  const res = await api('/api/workspaces/moonboots', { method: 'PUT', auth: 'admin', body: { api_key: 'attacker-key' } });
  assert.equal(res.status, 200);
  assert.equal((await api('/api/v1/content/queue', { auth: 'attacker-key' })).status, 401);
});

test('a key set in Railway cannot be replaced from the app', async () => {
  const res = await api('/api/workspaces/touchline/generate-api-key', { method: 'POST', auth: 'admin' });
  assert.equal(res.status, 409);
});

test('generated keys work, are stored only as a hash, and regenerating revokes the old one', async () => {
  const first = await api('/api/workspaces/moonboots/generate-api-key', { method: 'POST', auth: 'admin' });
  assert.equal(first.status, 200);
  const key1 = first.json.api_key;
  assert.equal((await api('/api/v1/content/queue', { auth: key1 })).status, 200);

  const stored = readFileSync(join(dataDir, 'content-studio-store.json'), 'utf8');
  assert.ok(!stored.includes(key1), 'raw key must not be stored');

  const second = await api('/api/workspaces/moonboots/generate-api-key', { method: 'POST', auth: 'admin' });
  const key2 = second.json.api_key;
  assert.equal((await api('/api/v1/content/queue', { auth: key1 })).status, 401);
  assert.equal((await api('/api/v1/content/queue', { auth: key2 })).status, 200);
});

test('each key only sees its own workspace posts', async () => {
  const moonbootsKey = (await api('/api/workspaces/moonboots/generate-api-key', { method: 'POST', auth: 'admin' })).json.api_key;

  // scheduleFor keeps this test away from Publer
  const created = await api('/api/posts', {
    method: 'POST',
    auth: TOUCHLINE_KEY,
    body: { platform: 'linkedin', content: 'Touchline only', source: 'marcus-cmo', scheduleFor: '2030-01-01T09:00:00Z' },
  });
  assert.equal(created.status, 200);

  const touchlinePosts = await api('/api/posts', { auth: TOUCHLINE_KEY });
  assert.ok(touchlinePosts.json.posts.some(p => p.id === created.json.id));

  const moonbootsPosts = await api('/api/posts', { auth: moonbootsKey });
  assert.ok(!moonbootsPosts.json.posts.some(p => p.id === created.json.id));
});

test('AI routes use server keys and say clearly when they are missing', async () => {
  const res = await api('/api/generate', { method: 'POST', auth: 'admin', body: { topic: 't', platforms: { linkedin: true }, apiKey: 'sk-from-browser' } });
  assert.equal(res.status, 503);
  assert.match(res.json.error, /ANTHROPIC_API_KEY/);

  const config = await api('/api/config', { auth: 'admin' });
  assert.equal(config.json.claude, false);
});

test('publishing ignores keys sent from the browser', async () => {
  const res = await api('/api/publish', {
    method: 'POST',
    auth: 'admin',
    body: { workspaceId: 'moonboots', apiKey: 'browser-key', post: { platform: 'linkedin', content: 'hi' } },
  });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /No Publer API key saved/);
});

test('logout ends the session', async () => {
  const res = await api('/api/auth/logout', { method: 'POST', auth: 'admin' });
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});

test('repeated wrong passwords are rate limited', async () => {
  let last;
  for (let i = 0; i < 12; i++) {
    last = await api('/api/auth/login', { method: 'POST', body: { password: `wrong-${i}` } });
  }
  assert.equal(last.status, 429);
});
