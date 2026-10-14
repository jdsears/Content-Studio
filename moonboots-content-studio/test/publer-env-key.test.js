// A workspace's Publer key can come from a Railway variable, so losing saved settings
// (for example a missing Volume) can't take publishing down.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakePubler } from './helpers/fake-publer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = 'env-key-test-password';
const SAVED_TOUCHLINE_KEY = 'SAVED-TOUCHLINE-KEY-5555';

let fake;
let server;
let dataDir;
let cookie;

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, text, headers: response.headers };
}

before(async () => {
  fake = await startFakePubler();
  dataDir = mkdtempSync(join(tmpdir(), 'content-studio-envkey-'));
  // Saved settings hold a key for Touchline only; MoonBoots has none saved, as if they were lost
  writeFileSync(join(dataDir, 'content-studio-store.json'), JSON.stringify({
    workspace_settings: { touchline: { publer_api_key: SAVED_TOUCHLINE_KEY } },
  }));
  const env = {
    ...process.env, PORT: String(PORT), ADMIN_PASSWORD, DATA_DIR: dataDir,
    PUBLER_API_URL: fake.url, PUBLER_POLL_MS: '10', MOONBOOTS_PUBLER_API_KEY: ' good-key ',
  };
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'TOUCHLINE_PUBLER_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'RAILWAY_ENVIRONMENT', 'RAILWAY_VOLUME_MOUNT_PATH']) {
    delete env[name];
  }
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: ADMIN_PASSWORD }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
});

after(() => {
  server?.kill();
  fake?.close();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('a key in Railway is used even when no key is saved, and never shown in full', async () => {
  const res = await api('/api/workspaces/moonboots');
  assert.equal(res.status, 200);
  assert.equal(res.json.has_publer_key, true);
  assert.equal(res.json.publer_key_source, 'railway');
  assert.equal(res.json.publer_key_env_name, 'MOONBOOTS_PUBLER_API_KEY');
  assert.equal(res.json.publer_key_last4, '-key');
  assert.ok(!res.text.includes('good-key'));

  const check = await api('/api/publer/test', { method: 'POST', body: { workspaceId: 'moonboots' } });
  assert.equal(check.status, 200, 'Publer accepts the key from Railway');
  assert.equal(check.json.success, true);
});

test('a key in Railway cannot be replaced or removed in Settings, but accounts can still be chosen', async () => {
  for (const publerApiKey of ['another-key', null]) {
    const res = await api('/api/workspaces/moonboots/publer-settings', { method: 'PUT', body: { publerApiKey } });
    assert.equal(res.status, 409);
    assert.match(res.json.error, /set in Railway as MOONBOOTS_PUBLER_API_KEY/);
  }
  const accounts = await api('/api/workspaces/moonboots/publer-settings', { method: 'PUT', body: { platformAccounts: { linkedin: 'acc_li' } } });
  assert.equal(accounts.status, 200);
  assert.deepEqual(accounts.json.workspace.platform_accounts, { linkedin: 'acc_li' });
  assert.equal(accounts.json.workspace.publer_key_source, 'railway', 'still the Railway key');
});

test('without a Railway variable the saved key is used, as before', async () => {
  const res = await api('/api/workspaces/touchline');
  assert.equal(res.json.has_publer_key, true);
  assert.equal(res.json.publer_key_source, 'settings');
  assert.equal(res.json.publer_key_last4, '5555');
  assert.equal(res.json.publer_key_env_name, 'TOUCHLINE_PUBLER_API_KEY');
  assert.ok(!res.text.includes(SAVED_TOUCHLINE_KEY));
});
