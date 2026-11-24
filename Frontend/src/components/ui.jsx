import React from 'react';
import { Link } from 'react-router-dom';

/** Lime square mark + wordmark. */
export function Logo({ to = '/', inverted = false }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2" aria-label="Apartey home">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-lime">
        <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
          <path d="M6 25V14L16 6l10 8v11h-6.5v-6.5h-7V25z" fill="#16160F" />
        </svg>
      </span>
      <span className={`text-[15px] font-semibold tracking-tight ${inverted ? 'text-cream' : 'text-ink'}`}>Apartey</span>
    </Link>
  );
}

/** Eyebrow + headline + optional lead, used at the top of each section. */
export function SectionHeader({ eyebrow, title, lead, className = '', align = 'left' }) {
  return (
    <div className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-2xl ${className}`}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h2 className="h-section">{title}</h2>
      {lead && <p className="lead mt-4">{lead}</p>}
    </div>
  );
}

/** Quiet loading state: three pulsing lime dots. */
export function Loader({ label = 'Loading', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-24 ${className}`} role="status">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-ink"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p className="eyebrow text-faint">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-sand">
          <Icon size={20} className="text-muted" />
        </div>
      )}
      <h3 className="text-lg font-medium">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const STATUS = {
  pending: ['chip-amber', 'Awaiting payment'],
  split_pending: ['chip-amber', 'Collecting split'],
  paid: ['chip-lime', 'Awaiting host'],
  confirmed: ['chip-green', 'Confirmed'],
  completed: ['chip-neutral', 'Completed'],
  rejected: ['chip-red', 'Declined · refunded'],
  cancelled: ['chip-red', 'Cancelled'],
  failed: ['chip-neutral', 'Payment failed'],
};

export function StatusBadge({ status }) {
  const [cls, label] = STATUS[status] ?? ['chip-neutral', status];
  return <span className={cls}>{label}</span>;
}

/** Label/value row used in price breakdowns. */
export function Row({ label, value, strong = false, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 text-sm ${className}`}>
      <span className={strong ? 'font-medium text-ink' : 'text-muted'}>{label}</span>
      <span className={`mono ${strong ? 'text-base font-medium text-ink' : 'text-ink'}`}>{value}</span>
    </div>
  );
}

/** Centered modal shell. */
export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-paper shadow-lift animate-fade-up sm:rounded-2xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
