import React, { useEffect, useState } from 'react';
import { useStudio, DEFAULT_PILLARS } from '../studio.jsx';
import { Badge, Button, Card, Field, PageHeader, Toggle, cx, inputClass, useFeedback } from '../components/ui.jsx';
import { Icon, PlatformIcon } from '../components/icons.jsx';
import { apiJson } from '../lib/api.js';
import { themesFor } from '../lib/images.js';

const ACCOUNT_PLATFORMS = [
  { p: 'linkedin', label: 'LinkedIn', hint: 'Usually a LinkedIn page' },
  { p: 'facebook', label: 'Facebook', hint: 'A Facebook Page' },
  { p: 'instagram', label: 'Instagram', hint: 'An Instagram business account' },
  { p: 'x', label: 'X', hint: 'Posted by copy and paste for now' },
];

// A settings block: title and description on the left, controls on the right (stacked on phones)
const Section = ({ title, description, children }) => (
  <section className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 py-8 first:pt-0 border-b border-line/50 last:border-0">
    <div>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description && <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>}
    </div>
    <div className="min-w-0 space-y-4">{children}</div>
  </section>
);

const Notice = ({ tone = 'info', children }) => (
  <div className={cx(
    'flex gap-2.5 p-3 rounded-xl border text-xs leading-relaxed',
    tone === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-200'
      : tone === 'warn' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
        : tone === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          : 'bg-raised/40 border-line/60 text-muted',
  )}>
    <Icon name={tone === 'success' ? 'check' : tone === 'info' ? 'sparkles' : 'alert'} className="w-4 h-4 flex-shrink-0" />
    <div className="min-w-0">{children}</div>
  </div>
);

const StatusRow = ({ icon, label, detail, ok, okLabel = 'Ready', badLabel = 'Not set' }) => (
  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-raised/30 border border-line/50">
    <span className="w-9 h-9 rounded-xl bg-raised flex items-center justify-center text-muted"><Icon name={icon} className="w-4 h-4" /></span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm text-ink">{label}</span>
      {detail && <span className="block text-xs text-faint mt-0.5">{detail}</span>}
    </span>
    <Badge tone={ok ? 'green' : 'yellow'}>{ok ? okLabel : badLabel}</Badge>
  </div>
);

export default function Settings() {
  const { workspace, serverConfig, settings, updateSettings, updateWorkspace } = useStudio();
  const { toast, confirm } = useFeedback();

  const [newKey, setNewKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null); // { success, message, hint }
  const [accounts, setAccounts] = useState([]); // what the saved key can post to
  const [generatedKey, setGeneratedKey] = useState(null);

  const pillars = workspace?.pillars?.length ? workspace.pillars : DEFAULT_PILLARS;
  const themes = themesFor(workspace?.slug);

  const savePubler = async body => {
    const data = await apiJson(`/api/workspaces/${workspace.id}/publer-settings`, { method: 'PUT', body: JSON.stringify(body) });
    if (data.workspace) updateWorkspace(data.workspace);
    return data;
  };

  const testConnection = async ({ quiet = false } = {}) => {
    if (!workspace?.has_publer_key) return;
    setTesting(true);
    if (!quiet) setStatus(null);
    try {
      const data = await apiJson('/api/publer/test', { method: 'POST', body: JSON.stringify({ workspaceId: workspace.id }) });
      setAccounts(data.accountsList || []);
      setStatus({ success: true, message: `Connected. Publer can post to ${data.accountCount} account${data.accountCount === 1 ? '' : 's'}.` });
    } catch (error) {
      setAccounts([]);
      setStatus({ success: false, message: error.message, hint: error.hint });
    }
    setTesting(false);
  };

  // Check the saved key whenever Settings opens for a workspace
  useEffect(() => {
    setStatus(null);
    setAccounts([]);
    setNewKey('');
    setGeneratedKey(null);
    if (workspace?.has_publer_key) testConnection({ quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const saveKey = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const data = await savePubler({ publerApiKey: newKey.trim() });
      const list = data.accounts || [];
      setNewKey('');
      setAccounts(list);
      setStatus({ success: true, message: `Key saved and working. Publer can post to ${list.length} account${list.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setStatus({ success: false, message: error.message, hint: error.hint });
    }
    setSaving(false);
  };

  const removeKey = async () => {
    const ok = await confirm({
      title: 'Remove the Publer key?',
      body: `Publishing for ${workspace.name} stops until a new key is saved.`,
      confirmLabel: 'Remove key',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await savePubler({ publerApiKey: null });
      setStatus(null);
      setAccounts([]);
      toast({ tone: 'success', title: 'Publer key removed' });
    } catch (error) {
      toast({ tone: 'error', title: 'Could not remove the key', body: error.message });
    }
  };

  const chooseAccount = async (platform, accountId) => {
    const next = { ...(workspace.platform_accounts || {}) };
    if (accountId) next[platform] = accountId;
    else delete next[platform];
    try {
      await savePubler({ platformAccounts: next });
      toast({ tone: 'success', title: 'Saved' });
    } catch (error) {
      toast({ tone: 'error', title: 'Could not save', body: error.message });
    }
  };

  const generateKey = async () => {
    if (workspace.has_api_key) {
      const ok = await confirm({
        title: 'Make a new API key?',
        body: 'The old key stops working straight away, so anything using it must be updated.',
        confirmLabel: 'Make a new key',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      const data = await apiJson(`/api/workspaces/${workspace.id}/generate-api-key`, { method: 'POST' });
      setGeneratedKey(data.api_key);
      navigator.clipboard?.writeText(data.api_key).catch(() => {});
      updateWorkspace(await apiJson(`/api/workspaces/${workspace.id}`));
    } catch (error) {
      toast({ tone: 'error', title: 'Could not make a key', body: error.message });
    }
  };

  const setPref = (key, value) => {
    updateSettings({ [key]: value });
    toast({ tone: 'success', title: 'Saved', duration: 1800 });
  };

  if (!workspace) return null;
  const storage = serverConfig?.storage;

  return (
    <>
      <PageHeader title="Settings" subtitle={`For ${workspace.name}. Keys stay on the server and are never shown in full.`} />

      {storage && !storage.ok && <div className="mb-6"><Notice tone="error">Server storage error: {storage.error}</Notice></div>}
      {storage?.ok && !storage.persistent && (
        <div className="mb-6">
          <Notice tone="warn">Saved settings are not permanent yet, so keys are lost on the next deploy. Attach a Railway Volume at /data, or set up Supabase.</Notice>
        </div>
      )}

      <Card className="px-5 sm:px-6 py-8">
        {/* ---------- Publer ---------- */}
        <Section
          title="Publer"
          description={`Publer posts for ${workspace.name} at the planned time. Each workspace has its own key. When a key expires, paste a new one here.`}
        >
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-raised/30 border border-line/50">
            <span className="w-9 h-9 rounded-xl bg-raised flex items-center justify-center text-muted"><Icon name="key" className="w-4 h-4" /></span>
            <span className="flex-1 min-w-0 text-sm text-ink">
              {workspace.has_publer_key
                ? <>Saved key ends in <code className="font-mono text-muted">…{workspace.publer_key_last4}</code></>
                : 'No Publer key saved'}
            </span>
            {workspace.has_publer_key
              ? <Button size="sm" variant="ghost" icon="trash" onClick={removeKey}>Remove</Button>
              : <Badge tone="yellow">Not connected</Badge>}
          </div>

          <Field
            label={workspace.has_publer_key ? 'Replace with a new key' : 'Publer API key'}
            hint="The key is checked with Publer first and only saved if it works. Publer's API needs a Business or Enterprise plan."
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                autoComplete="off"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveKey(); }}
                placeholder="Paste your Publer API key"
                className={cx(inputClass, 'flex-1')}
              />
              <Button variant="primary" loading={saving} disabled={!newKey.trim()} onClick={saveKey}>Save and test</Button>
            </div>
          </Field>

          {workspace.has_publer_key && (
            <Button size="sm" icon="refresh" loading={testing} onClick={() => testConnection()}>Test connection</Button>
          )}

          {status && (
            <Notice tone={status.success ? 'success' : 'error'}>
              <p>{status.message}</p>
              {status.hint && <p className="mt-1 opacity-80">{status.hint}</p>}
            </Notice>
          )}
        </Section>

        {/* ---------- Accounts ---------- */}
        <Section title="Where posts go" description="Choose which Publer account each platform posts to.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ACCOUNT_PLATFORMS.map(({ p, label, hint }) => {
              const matching = accounts.filter(acc => acc.platform === p);
              const selectedId = workspace.platform_accounts?.[p] || '';
              const selected = accounts.find(acc => String(acc.id) === selectedId);
              const detail = selected ? `${selected.name} (${selected.kind})`
                : selectedId ? 'Chosen. Test the connection to see its name.'
                  : matching.length ? 'Choose an account'
                    : accounts.length ? `No ${label} account in Publer` : hint;
              return (
                <div key={p} className="p-3.5 rounded-xl bg-raised/30 border border-line/50">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-raised flex items-center justify-center text-ink"><PlatformIcon platform={p} className="w-4 h-4" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink">{label}</span>
                      <span className={cx('block text-xs truncate', selected || selectedId ? 'text-accent' : 'text-faint')}>{detail}</span>
                    </span>
                    {selectedId && <Icon name="check" className="w-4 h-4 text-accent" />}
                  </div>
                  {matching.length > 0 && (
                    <select value={selectedId} onChange={e => chooseAccount(p, e.target.value)} className={cx(inputClass, 'mt-3 py-2')}>
                      <option value="">Choose an account</option>
                      {matching.map(acc => <option key={acc.id} value={String(acc.id)}>{acc.name} ({acc.kind})</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ---------- Preferences ---------- */}
        <Section title="Preferences" description="How Create starts each time. Saved in this browser.">
          <Field label="Default content pillar">
            <select value={settings.defaultPillar || ''} onChange={e => setPref('defaultPillar', e.target.value || null)} className={cx(inputClass, 'py-2')}>
              <option value="">First pillar ({pillars[0]?.name})</option>
              {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Default image style">
            <select value={themes[settings.defaultTheme] ? settings.defaultTheme : ''} onChange={e => setPref('defaultTheme', e.target.value || null)} className={cx(inputClass, 'py-2')}>
              <option value="">{Object.values(themes)[0]?.name}</option>
              {Object.entries(themes).slice(1).map(([key, t]) => <option key={key} value={key}>{t.name}</option>)}
            </select>
          </Field>
          <div className="space-y-4 pt-2">
            <Toggle
              checked={settings.includeImages !== false}
              onChange={v => setPref('includeImages', v)}
              label="Add a branded image to new posts"
              description="You can still add or remove it per post."
            />
            <Toggle
              checked={settings.autoSchedule !== false}
              onChange={v => setPref('autoSchedule', v)}
              label="Suggest the next best posting time"
              description="New drafts start with the next good slot for each platform."
            />
          </div>
        </Section>

        {/* ---------- Server ---------- */}
        <Section title="Server" description="Set in Railway. Keys here are never sent to your browser.">
          <StatusRow
            icon="sparkles"
            label="Claude"
            detail={serverConfig?.claude ? 'Writes posts and suggests topics' : 'Add ANTHROPIC_API_KEY in Railway > Variables'}
            ok={serverConfig?.claude}
          />
          <StatusRow
            icon="server"
            label="Saved settings"
            detail={!storage ? 'Checking' : !storage.ok ? storage.error : storage.persistent ? 'Kept between deploys' : 'Lost on the next deploy'}
            ok={storage?.ok && storage?.persistent}
            okLabel="Permanent"
            badLabel={storage?.ok ? 'Not permanent' : 'Problem'}
          />
        </Section>

        {/* ---------- API key ---------- */}
        <Section
          title="API key"
          description={workspace.slug === 'touchline'
            ? 'Marcus in Touchline HQ uses this key to send posts here.'
            : 'Lets other tools send posts to this workspace.'}
        >
          {workspace.api_key_source === 'railway' ? (
            <StatusRow
              icon="key"
              label={<>Set in Railway as <code className="font-mono text-muted">{workspace.api_key_env_name}</code></>}
              detail={<>Ends in <code className="font-mono">…{workspace.api_key_last4}</code>. Change it in Railway.</>}
              ok
              okLabel="Active"
            />
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 px-3.5 py-2.5 rounded-xl bg-bg/60 border border-line/70 text-xs text-muted font-mono">
                {workspace.has_api_key ? `Key ends in …${workspace.api_key_last4}` : 'No API key yet'}
              </code>
              <Button onClick={generateKey}>{workspace.has_api_key ? 'Make a new key' : 'Make a key'}</Button>
            </div>
          )}
          {generatedKey && (
            <Notice tone="success">
              <p>New key, copied to your clipboard. Store it safely: it is not shown again.</p>
              <code className="block mt-2 font-mono text-ink break-all select-all">{generatedKey}</code>
            </Notice>
          )}
          <p className="text-xs text-faint">
            Send it as <code className="font-mono text-muted">Authorization: Bearer &lt;key&gt;</code> to <code className="font-mono text-muted">/api/posts</code> or <code className="font-mono text-muted">/api/v1/content</code>.
          </p>
        </Section>
      </Card>
    </>
  );
}
