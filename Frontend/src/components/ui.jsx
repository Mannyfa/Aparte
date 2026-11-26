import React, { useContext, useEffect, useSyncExternalStore } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

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
  cancelled: ['chip-red', 'Cancelled · refunded'],
  expired: ['chip-neutral', 'Expired · refunded'],
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
        className={`max-h-[92vh] w-full overflow-y-auto pb-safe rounded-t-2xl border border-line bg-paper shadow-lift animate-fade-up sm:rounded-2xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const CAUTION = {
  Pending: ['chip-neutral', 'Unpaid'],
  Held: ['chip-lime', 'In escrow'],
  Releasing: ['chip-amber', 'Returning'],
  Refunded: ['chip-green', 'Returned'],
  Claimed: ['chip-red', 'Kept by host'],
  PartlyClaimed: ['chip-amber', 'Partly kept'],
};

/** Status of a booking's refundable caution fee. */
export function CautionChip({ status }) {
  const entry = CAUTION[status];
  if (!entry) return null;
  return <span className={entry[0]}>{entry[1]}</span>;
}

/* ---------- Saved stays: one shared store so cards never refetch the ids ---------- */
let savedIds = new Set();
let savedToken = null; // token the ids were loaded for
let savedLoading = false;
const savedListeners = new Set();
const emitSaved = () => savedListeners.forEach((fn) => fn());
const subscribeSaved = (fn) => { savedListeners.add(fn); return () => savedListeners.delete(fn); };
const getSavedSnapshot = () => savedIds;

function loadSavedIds(token) {
  if (savedToken === token || savedLoading) return;
  savedLoading = true;
  api.get('/saved/ids')
    .then(({ data }) => { savedIds = new Set((data || []).map((x) => String(x).toLowerCase())); savedToken = token; })
    .catch(() => { savedToken = token; }) // don't retry in a loop; hearts start outline
    .finally(() => { savedLoading = false; emitSaved(); });
}

function setSavedLocal(id, saved) {
  const next = new Set(savedIds);
  if (saved) next.add(id); else next.delete(id);
  savedIds = next;
  emitSaved();
}

/** Heart toggle for saving a stay. Sits on cards and the property page. */
export function SaveHeart({ propertyId, className = '', onChange }) {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const ids = useSyncExternalStore(subscribeSaved, getSavedSnapshot);
  const key = String(propertyId).toLowerCase();

  useEffect(() => {
    if (token) loadSavedIds(token);
    else if (savedToken) { savedIds = new Set(); savedToken = null; emitSaved(); }
  }, [token]);

  const saved = !!token && ids.has(key);

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      toast('Log in to save stays.');
      return navigate('/login', { state: { from: location.pathname } });
    }
    const next = !saved;
    setSavedLocal(key, next);
    onChange?.(next);
    try {
      if (next) await api.post(`/saved/${propertyId}`);
      else await api.delete(`/saved/${propertyId}`);
    } catch (error) {
      setSavedLocal(key, !next);
      onChange?.(!next);
      toast.error(errorMessage(error, 'Could not update your saved stays.'));
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? 'Remove from saved stays' : 'Save this stay'}
      aria-pressed={saved}
      className={`grid h-11 w-11 place-items-center rounded-full bg-paper/90 text-ink shadow-soft transition hover:bg-paper ${className}`}
    >
      <Heart size={18} className={saved ? 'fill-red-500 text-red-500' : ''} />
    </button>
  );
}
