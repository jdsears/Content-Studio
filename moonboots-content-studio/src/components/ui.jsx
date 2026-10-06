import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

// ============ BASICS ============

const cx = (...classes) => classes.filter(Boolean).join(' ');
export { cx };

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-primary-ink hover:opacity-90 font-semibold',
  secondary: 'bg-raised/70 text-ink border border-line/70 hover:bg-raised',
  ghost: 'text-muted hover:text-ink hover:bg-raised/60',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/25',
  success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-sm gap-2 rounded-xl',
};

export const Button = ({ variant = 'secondary', size = 'md', icon, loading = false, className, children, disabled, ...props }) => (
  <button
    {...props}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center whitespace-nowrap transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/60',
      BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className,
    )}
  >
    {loading ? <Spinner className="w-4 h-4" /> : icon ? <Icon name={icon} className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> : null}
    {children}
  </button>
);

export const Card = ({ className, children, ...props }) => (
  <div {...props} className={cx('rounded-2xl border border-line/60 bg-surface', className)}>{children}</div>
);

export const Spinner = ({ className = 'w-5 h-5' }) => (
  <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const BADGE_TONES = {
  neutral: 'bg-raised text-muted border-line/70',
  accent: 'bg-accent/15 text-accent border-accent/30',
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  yellow: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  blue: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  purple: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
};

export const Badge = ({ tone = 'neutral', wrap = false, className, children }) => (
  <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border', wrap ? 'max-w-full' : 'whitespace-nowrap', BADGE_TONES[tone], className)}>
    {children}
  </span>
);

const STATUS = {
  pending: ['yellow', 'Awaiting approval'],
  approved: ['green', 'Post by hand'],
  queued: ['yellow', 'Waiting for Publer'],
  scheduled: ['purple', 'Scheduled'],
  published: ['blue', 'Published'],
  failed: ['red', 'Problem'],
  rejected: ['neutral', 'Rejected'],
  cancelled: ['neutral', 'Cancelled'],
};

export const StatusBadge = ({ status }) => {
  const [tone, label] = STATUS[status] || ['neutral', status];
  return <Badge tone={tone}>{label}</Badge>;
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

export const SectionTitle = ({ children, count, action }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
      {children}
      {count !== undefined && <span className="text-xs font-normal text-faint">{count}</span>}
    </h2>
    {action}
  </div>
);

export const EmptyState = ({ icon = 'sparkles', title, body, action }) => (
  <div className="flex flex-col items-center text-center px-6 py-12">
    <div className="w-12 h-12 rounded-2xl bg-raised flex items-center justify-center text-muted mb-4">
      <Icon name={icon} className="w-6 h-6" />
    </div>
    <p className="text-sm font-medium text-ink">{title}</p>
    {body && <p className="text-sm text-muted mt-1 max-w-sm">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Toggle = ({ checked, onChange, label, description }) => (
  <label className="flex items-start justify-between gap-4 cursor-pointer">
    <span>
      <span className="block text-sm text-ink">{label}</span>
      {description && <span className="block text-xs text-muted mt-0.5">{description}</span>}
    </span>
    <span className="relative inline-flex shrink-0 mt-0.5">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="w-10 h-6 rounded-full bg-raised border border-line peer-checked:bg-primary peer-checked:border-primary transition" />
      <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-ink peer-checked:bg-primary-ink peer-checked:translate-x-4 transition" />
    </span>
  </label>
);

export const Segmented = ({ options, value, onChange, size = 'md' }) => (
  <div className="inline-flex p-1 rounded-xl bg-raised/70 border border-line/60">
    {options.map(option => (
      <button
        key={option.value}
        onClick={() => onChange(option.value)}
        className={cx(
          'inline-flex items-center gap-1.5 rounded-lg transition font-medium',
          size === 'sm' ? 'px-2.5 h-7 text-xs' : 'px-3 h-8 text-sm',
          value === option.value ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink',
        )}
      >
        {option.icon && <Icon name={option.icon} className="w-4 h-4" />}
        {option.label}
        {option.count !== undefined && option.count > 0 && <span className="text-[11px] text-faint">{option.count}</span>}
      </button>
    ))}
  </div>
);

export const inputClass = 'w-full px-3.5 py-2.5 bg-bg/60 border border-line/70 rounded-xl text-sm text-ink placeholder-faint focus:outline-hidden focus:border-accent/60 focus:ring-2 focus:ring-accent/20';

export const Field = ({ label, hint, children }) => (
  <label className="block">
    {label && <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>}
    {children}
    {hint && <span className="block text-xs text-faint mt-1.5">{hint}</span>}
  </label>
);

// Warnings from the brand checks. They never change the post.
export const BrandWarnings = ({ warnings, className }) => {
  if (!warnings?.length) return null;
  return (
    <div className={cx('p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1', className)}>
      {warnings.map(w => (
        <p key={w.id} className="flex gap-2 text-xs text-amber-200">
          <Icon name="alert" className="w-3.5 h-3.5 shrink-0 mt-px" />
          {w.message}
        </p>
      ))}
    </div>
  );
};

// ============ MODAL ============

export const Modal = ({ open, onClose, title, children, footer, wide = false }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className={cx('w-full bg-surface border border-line/70 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised" aria-label="Close">
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line/60 flex justify-end gap-2 pb-safe">{footer}</div>}
      </div>
    </div>
  );
};

// Full-size image viewer
export const ImageViewer = ({ src, onClose }) => (
  src ? (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <img src={src} alt="" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" />
      <div className="absolute bottom-6 inset-x-0 flex justify-center gap-2" onClick={e => e.stopPropagation()}>
        <a href={src} download="image.png" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-slate-900 text-sm font-medium">
          <Icon name="download" className="w-4 h-4" /> Download
        </a>
        <button onClick={onClose} className="h-10 px-4 rounded-xl bg-white/10 text-white text-sm">Close</button>
      </div>
    </div>
  ) : null
);

// ============ TOASTS AND CONFIRM ============

const FeedbackContext = createContext(null);

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(1);

  const dismiss = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // toast({ title, body, tone: 'success' | 'error' | 'info', action: { label, onClick } })
  const toast = useCallback(({ title, body, tone = 'info', action, duration }) => {
    const id = nextId.current++;
    setToasts(prev => [...prev.slice(-3), { id, title, body, tone, action }]);
    setTimeout(() => dismiss(id), duration || (tone === 'error' ? 8000 : 4500));
  }, [dismiss]);

  // await confirm({ title, body, confirmLabel, tone: 'danger' | 'primary' }) → true or false
  const confirm = useCallback(options => new Promise(resolve => {
    setDialog({ ...options, resolve });
  }), []);

  const close = result => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const toneStyles = {
    success: 'border-emerald-500/30',
    error: 'border-red-500/40',
    info: 'border-line',
  };
  const toneIcons = { success: ['check', 'text-emerald-300'], error: ['alert', 'text-red-300'], info: ['sparkles', 'text-accent'] };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="fixed z-60 bottom-24 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={cx('pointer-events-auto animate-toast-in flex gap-3 p-4 rounded-2xl bg-surface border shadow-2xl', toneStyles[t.tone])}>
            <Icon name={toneIcons[t.tone][0]} className={cx('w-5 h-5 shrink-0', toneIcons[t.tone][1])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.body && <p className="text-xs text-muted mt-0.5 wrap-break-word">{t.body}</p>}
              {t.action && (
                <button onClick={() => { t.action.onClick(); dismiss(t.id); }} className="mt-2 text-xs font-semibold text-accent hover:underline">
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-faint hover:text-ink" aria-label="Dismiss">
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title}
        footer={(
          <>
            <Button variant="ghost" onClick={() => close(false)}>{dialog?.cancelLabel || 'Cancel'}</Button>
            <Button variant={dialog?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>{dialog?.confirmLabel || 'OK'}</Button>
          </>
        )}
      >
        {dialog?.body && <p className="text-sm text-muted whitespace-pre-line">{dialog.body}</p>}
      </Modal>
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => useContext(FeedbackContext);
