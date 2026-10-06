import React, { useEffect, useRef, useState } from 'react';
import { TOUCHLINE_COLOURS } from '../../shared/brand.js';
import { Icon } from './icons.jsx';
import { cx } from './ui.jsx';

// ============ LOGOS ============

// The Touchline mark, in one colour: white on navy
export const TouchlineMark = ({ className = 'h-5 w-8', colour = TOUCHLINE_COLOURS.white }) => (
  <svg viewBox="0 0 64 40" className={className} style={{ color: colour }} aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M16 32 A16 16 0 0 1 48 32" strokeWidth="3.6" />
      <line x1="6" y1="32" x2="58" y2="32" strokeWidth="3.6" />
      <circle cx="32" cy="32" r="5.6" strokeWidth="1.2" opacity="0.32" />
    </g>
    <circle cx="32" cy="32" r="3.4" fill="currentColor" />
  </svg>
);

export const Logo = ({ workspace }) => (workspace?.slug === 'touchline' ? (
  <div className="flex flex-col items-start">
    <div className="flex items-center gap-2">
      <TouchlineMark />
      <span className="text-lg leading-6 text-white" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>Touchline</span>
    </div>
    <span className="text-[10px] text-faint tracking-widest mt-0.5">content studio</span>
  </div>
) : (
  <div className="flex flex-col items-start">
    <img src="/moonboots-logo.png" alt="moonboots" className="h-6" />
    <span className="text-[10px] font-light text-faint tracking-widest -mt-0.5">content studio</span>
  </div>
));

// A small square avatar for a workspace (used in previews and the switcher)
export const WorkspaceAvatar = ({ workspace, size = 'md' }) => {
  const box = size === 'sm' ? 'w-7 h-7 rounded-lg' : 'w-10 h-10 rounded-xl';
  if (workspace?.slug === 'touchline') {
    return (
      <span className={cx(box, 'flex items-center justify-center shrink-0')} style={{ backgroundColor: TOUCHLINE_COLOURS.navy }}>
        <TouchlineMark className={size === 'sm' ? 'w-5 h-3' : 'w-7 h-5'} />
      </span>
    );
  }
  return (
    <span className={cx(box, 'flex items-center justify-center shrink-0 bg-slate-900 border border-slate-700')}>
      <span className={cx('relative', size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5')}>
        <span className="absolute inset-0 rounded-full bg-white" />
        <span className="absolute rounded-full bg-slate-900" style={{ width: '70%', height: '70%', top: '15%', left: '35%' }} />
      </span>
    </span>
  );
};

// ============ WORKSPACE SWITCHER ============

export const WorkspaceSwitcher = ({ workspaces, current, onSwitch, compact = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (workspaces.length < 2) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cx(
          'flex items-center gap-2.5 rounded-xl border border-line/70 bg-raised/50 hover:bg-raised transition text-left',
          compact ? 'px-2 py-1.5' : 'w-full px-3 py-2.5',
        )}
      >
        <WorkspaceAvatar workspace={current} size="sm" />
        {!compact && (
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-ink truncate">{current?.name}</span>
            <span className="block text-[11px] text-faint truncate">{current?.brand_config?.tagline}</span>
          </span>
        )}
        <Icon name="chevronDown" className="w-4 h-4 text-muted" />
      </button>

      {open && (
        <div className={cx('absolute z-40 mt-2 w-64 rounded-2xl border border-line bg-surface shadow-2xl p-1.5', compact ? 'right-0' : 'left-0')}>
          <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-faint">Workspaces</p>
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => { onSwitch(ws.id); setOpen(false); }}
              className={cx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-raised transition', ws.id === current?.id && 'bg-raised/60')}
            >
              <WorkspaceAvatar workspace={ws} size="sm" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-ink">{ws.name}</span>
                <span className="block text-[11px] text-faint truncate">{ws.brand_config?.tagline || ws.slug}</span>
              </span>
              {ws.id === current?.id && <Icon name="check" className="w-4 h-4 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ NAVIGATION ============

export const NAV_ITEMS = [
  { page: 'home', label: 'Home', icon: 'home' },
  { page: 'create', label: 'Create', icon: 'create' },
  { page: 'schedule', label: 'Schedule', icon: 'schedule' },
  { page: 'graphics', label: 'Graphics', icon: 'graphics' },
  { page: 'insights', label: 'Insights', icon: 'insights' },
  { page: 'settings', label: 'Settings', icon: 'settings' },
];

export const Sidebar = ({ page, navigate, badges, workspaces, current, onSwitch, onLogout }) => (
  <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-surface/80 border-r border-line/60 backdrop-blur-sm">
    <div className="px-5 pt-6 pb-5">
      <Logo workspace={current} />
    </div>
    <div className="px-3 pb-4">
      <WorkspaceSwitcher workspaces={workspaces} current={current} onSwitch={onSwitch} />
    </div>
    <nav className="flex-1 px-3 space-y-0.5">
      {NAV_ITEMS.map(item => (
        <button
          key={item.page}
          onClick={() => navigate(item.page)}
          className={cx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition',
            page === item.page ? 'bg-raised text-ink font-medium' : 'text-muted hover:text-ink hover:bg-raised/50',
          )}
        >
          <Icon name={item.icon} className={cx('w-5 h-5', page === item.page && 'text-accent')} />
          <span className="flex-1 text-left">{item.label}</span>
          {badges[item.page] > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-[11px] font-semibold flex items-center justify-center text-primary-ink">
              {badges[item.page]}
            </span>
          )}
        </button>
      ))}
    </nav>
    <div className="p-3 border-t border-line/60">
      <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-ink hover:bg-raised/50">
        <Icon name="logout" className="w-5 h-5" />
        Log out
      </button>
    </div>
  </aside>
);

export const MobileTopBar = ({ workspaces, current, onSwitch, onLogout }) => (
  <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 bg-bg/90 backdrop-blur-sm border-b border-line/50">
    <Logo workspace={current} />
    <div className="flex items-center gap-1">
      <WorkspaceSwitcher workspaces={workspaces} current={current} onSwitch={onSwitch} compact />
      <button onClick={onLogout} className="p-2 rounded-lg text-muted hover:text-ink" aria-label="Log out">
        <Icon name="logout" className="w-5 h-5" />
      </button>
    </div>
  </header>
);

export const BottomNav = ({ page, navigate, badges }) => (
  <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-sm border-t border-line/60 pb-safe">
    <div className="grid grid-cols-6">
      {NAV_ITEMS.map(item => (
        <button
          key={item.page}
          onClick={() => navigate(item.page)}
          className={cx('relative flex flex-col items-center gap-1 pt-2.5 pb-1.5 text-[10px]', page === item.page ? 'text-accent' : 'text-muted')}
        >
          <Icon name={item.icon} className="w-5 h-5" />
          {item.label}
          {badges[item.page] > 0 && (
            <span className="absolute top-1.5 right-[calc(50%-18px)] min-w-[16px] h-4 px-1 rounded-full bg-accent text-[10px] font-semibold flex items-center justify-center text-primary-ink">
              {badges[item.page]}
            </span>
          )}
        </button>
      ))}
    </div>
  </nav>
);
