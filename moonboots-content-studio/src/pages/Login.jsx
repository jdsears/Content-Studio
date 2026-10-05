import React, { useEffect, useState } from 'react';
import { Button, cx, inputClass } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { TouchlineMark } from '../components/Shell.jsx';

// One shared password, set as ADMIN_PASSWORD in Railway
export default function Login({ passwordSet, serverError, onLoggedIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The login screen is shared, so drop any workspace look
  useEffect(() => {
    delete document.documentElement.dataset.brand;
    document.title = 'Content Studio';
  }, []);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPassword('');
        onLoggedIn();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Could not reach the server');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-bg relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <form onSubmit={submit} className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-3 mb-5">
            <img src="/moonboots-logo.png" alt="moonboots" className="h-6" />
            <span className="w-px h-5 bg-line" />
            <span className="flex items-center gap-1.5">
              <TouchlineMark className="h-4 w-7" />
              <span className="text-sm text-white" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>Touchline</span>
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Content Studio</h1>
          <p className="text-sm text-muted mt-1.5">Write, approve and schedule posts for every brand.</p>
        </div>

        <div className="rounded-2xl border border-line/60 bg-surface/90 backdrop-blur p-6 space-y-4 shadow-2xl">
          {!passwordSet && (
            <p className="flex gap-2 p-3 text-xs rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
              <Icon name="alert" className="w-4 h-4 flex-shrink-0" />
              ADMIN_PASSWORD is not set on the server yet. Add it in Railway &gt; Variables, then reload.
            </p>
          )}
          {serverError && <p className="text-xs text-red-300">{serverError}</p>}
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">Password</span>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={cx(inputClass, error && 'border-red-500/60')}
            />
          </label>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!password || !passwordSet}>
            Log in
          </Button>
        </div>
      </form>
    </div>
  );
}
