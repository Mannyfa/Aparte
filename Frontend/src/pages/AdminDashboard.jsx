import React, { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { ExternalLink, Check, X, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { EmptyState } from '../components/ui';
import { ListSkeleton } from '../components/Skeletons';
import { formatDay, formatDateTime, initials, naira } from '../utils/format';

/* ---------- KYC (unchanged behaviour) ---------- */

function KycTab() {
  const [pendingHosts, setPendingHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const fetchPendingKyc = async () => {
      try {
        const response = await api.get('/Admin/pending-kyc');
        setPendingHosts(response.data);
      } catch (error) {
        toast.error(errorMessage(error, 'Failed to load pending verifications.'));
      } finally {
        setLoading(false);
      }
    };
    fetchPendingKyc();
  }, []);

  const decide = async (host, action) => {
    if (action === 'reject' && !window.confirm(`Reject ${host.name}'s document? They'll need to upload a new one.`)) return;
    setBusyId(host.id);
    try {
      await api.post(`/Admin/kyc/${host.id}/${action}`);
      toast.success(action === 'approve' ? `${host.name} is now verified` : `${host.name}'s document was rejected`);
      setPendingHosts((prev) => prev.filter((h) => h.id !== host.id));
    } catch (error) {
      toast.error(errorMessage(error, `Failed to ${action} this host.`));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="h-page">Host verification</h1>
          <p className="lead mt-3">Review ID documents and approve hosts for the Verified badge.</p>
        </div>
        <span className="chip-lime self-start sm:self-auto">{pendingHosts.length} pending</span>
      </div>

      {loading ? (
        <ListSkeleton rows={4} label="Loading verification queue" />
      ) : pendingHosts.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing to review">All submitted documents have been handled.</EmptyState>
      ) : (
        <ul className="card divide-y divide-line">
          {pendingHosts.map((host) => (
            <li key={host.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand font-mono text-xs">{initials(host.name)}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{host.name}</p>
                  <p className="truncate text-xs text-muted">{host.email}{host.phone ? ` · ${host.phone}` : ''}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip-neutral">{host.documentType || 'Document'}</span>
                <span className="font-mono text-[11px] text-faint">joined {formatDay(host.submittedAt)}</span>
                {host.documentUrl && (
                  <a href={host.documentUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">View <ExternalLink size={13} /></a>
                )}
                <button onClick={() => decide(host, 'reject')} disabled={busyId === host.id} className="btn-danger btn-sm"><X size={14} /> Reject</button>
                <button onClick={() => decide(host, 'approve')} disabled={busyId === host.id} className="btn-ink btn-sm"><Check size={14} /> Approve</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- shared helpers ---------- */

const PAGE_SIZE = 25;

const CHIP = {
  active: 'chip-green', suspended: 'chip-red', pending: 'chip-amber', paid: 'chip-lime', confirmed: 'chip-green',
  completed: 'chip-neutral', Failed: 'chip-red', Pending: 'chip-amber', Processing: 'chip-amber', Succeeded: 'chip-green', Completed: 'chip-green',
};
const Status = ({ value }) => <span className={CHIP[value] || 'chip-neutral'}>{value}</span>;

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <label className="label">{label}</label>
    {children}
  </div>
);

function Pager({ page, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <span>{total} result{total === 1 ? '' : 's'} · page {page} of {pages}</span>
      <div className="flex gap-2">
        <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
        <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

/** Cards below md, table from md up. cols: [{ key, label, render, right }]. */
function DataList({ rows, cols, rowKey = (r) => r.id, empty = 'Nothing here yet.' }) {
  if (!rows.length) return <EmptyState icon={Inbox} title={empty} />;
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="card space-y-2 p-4 text-sm">
            {cols.map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-4">
                <span className="shrink-0 text-xs text-muted">{c.label}</span>
                <span className="min-w-0 break-words text-right">{c.render(r)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
              {cols.map((c) => <th key={c.key} className={`whitespace-nowrap px-4 py-3 font-normal ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                {cols.map((c) => <td key={c.key} className={`px-4 py-3 align-top ${c.right ? 'text-right' : ''}`}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Loads `path` with params whenever they change; returns { data, loading, reload }. */
function useAdminData(path, params, failMsg) {
  const [result, setResult] = useState({ id: null, data: null });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params ?? {});
  const id = `${path}|${key}|${tick}`;
  useEffect(() => {
    let cancelled = false;
    api.get(path, { params: JSON.parse(key) })
      .then((res) => { if (!cancelled) setResult({ id, data: res.data }); })
      .catch((error) => {
        if (cancelled) return;
        toast.error(errorMessage(error, failMsg));
        setResult((prev) => ({ ...prev, id }));
      });
    return () => { cancelled = true; };
  }, [path, key, failMsg, tick, id]);
  return { data: result.data, loading: result.id !== id, reload: () => setTick((t) => t + 1) };
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));

/* ---------- Listings ---------- */

function ListingsTab() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const { data, loading, reload } = useAdminData('/admin/listings', clean({ search: q, status, page, pageSize: PAGE_SIZE }), 'Failed to load listings.');

  const act = async (l, action) => {
    const verb = action === 'suspend' ? 'Suspend' : 'Restore';
    if (!window.confirm(`${verb} "${l.title}"?`)) return;
    setBusyId(l.id);
    try {
      await api.post(`/admin/listings/${l.id}/${action}`);
      toast.success(action === 'suspend' ? 'Listing suspended' : 'Listing restored');
      reload();
    } catch (error) {
      toast.error(errorMessage(error, `Failed to ${action} listing.`));
    } finally {
      setBusyId(null);
    }
  };

  const cols = [
    { key: 'title', label: 'Title', render: (l) => <span className="font-medium">{l.title}</span> },
    { key: 'city', label: 'City', render: (l) => [l.city, l.area].filter(Boolean).join(', ') },
    { key: 'host', label: 'Host', render: (l) => <>{l.hostName}<span className="block text-xs text-muted">{l.hostEmail}</span></> },
    { key: 'status', label: 'Status', render: (l) => <Status value={l.status} /> },
    { key: 'price', label: 'Price', right: true, render: (l) => <span className="mono">{naira(l.pricePerNight)}</span> },
    {
      key: 'act', label: 'Action', right: true,
      render: (l) => (l.status === 'active'
        ? <button className="btn-danger btn-sm" disabled={busyId === l.id} onClick={() => act(l, 'suspend')}>Suspend</button>
        : l.status === 'suspended'
          ? <button className="btn-ink btn-sm" disabled={busyId === l.id} onClick={() => act(l, 'restore')}>Restore</button>
          : null),
    },
  ];

  return (
    <div>
      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(search.trim()); }}>
        <Field label="Search"><input className="input" placeholder="Title, city or host" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
        <Field label="Status">
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option>
          </select>
        </Field>
        <button className="btn-ink">Search</button>
      </form>
      {loading && !data ? <ListSkeleton rows={5} label="Loading listings" /> : (
        <>
          <DataList rows={data?.items ?? []} cols={cols} empty="No listings found" />
          <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/* ---------- Bookings ---------- */

function BookingsTab() {
  const [f, setF] = useState({ status: '', from: '', to: '', propertyId: '' });
  const [page, setPage] = useState(1);
  const { data, loading } = useAdminData('/admin/bookings', clean({ ...f, propertyId: f.propertyId.trim(), page, pageSize: PAGE_SIZE }), 'Failed to load bookings.');
  const upd = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };

  const cols = [
    { key: 'prop', label: 'Property', render: (b) => <span className="font-medium">{b.propertyTitle}</span> },
    { key: 'guest', label: 'Guest', render: (b) => <>{b.guestName}<span className="block text-xs text-muted">{b.guestEmail}</span></> },
    { key: 'dates', label: 'Dates', render: (b) => `${formatDay(b.checkIn)} – ${formatDay(b.checkOut)}` },
    { key: 'total', label: 'Total', right: true, render: (b) => <span className="mono">{naira(b.totalPrice)}</span> },
    { key: 'fee', label: 'Platform fee', right: true, render: (b) => <span className="mono">{naira(b.serviceFee)}</span> },
    { key: 'disc', label: 'Discounts', right: true, render: (b) => <span className="mono">{naira((b.promoDiscount || 0) + (b.creditApplied || 0))}</span> },
    { key: 'status', label: 'Status', render: (b) => <Status value={b.status} /> },
  ];

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Status">
          <select className="input" value={f.status} onChange={upd('status')}>
            <option value="">All</option>
            {['pending', 'paid', 'confirmed', 'completed', 'cancelled', 'rejected', 'expired', 'failed'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="From"><input type="date" className="input" value={f.from} onChange={upd('from')} /></Field>
        <Field label="To"><input type="date" className="input" value={f.to} onChange={upd('to')} /></Field>
        <Field label="Property ID"><input className="input" value={f.propertyId} onChange={upd('propertyId')} placeholder="Optional" /></Field>
      </div>
      {data && <p className="mb-4 text-sm text-muted">Total for this filter: <span className="mono font-medium text-ink">{naira(data.totalAmount)}</span></p>}
      {loading && !data ? <ListSkeleton rows={5} label="Loading bookings" /> : (
        <>
          <DataList rows={data?.items ?? []} cols={cols} empty="No bookings match" />
          <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/* ---------- Refunds ---------- */

function RefundsTab() {
  const [status, setStatus] = useState('Failed');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const { data, loading, reload } = useAdminData('/admin/refunds', clean({ status, page, pageSize: PAGE_SIZE }), 'Failed to load refunds.');

  const retry = async (r) => {
    setBusyId(r.id);
    try {
      await api.post(`/admin/refunds/${r.id}/retry`);
      toast.success('Refund retry started');
      reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Retry failed.'));
    } finally {
      setBusyId(null);
    }
  };

  const cols = [
    { key: 'booking', label: 'Booking', render: (r) => <span className="mono break-all text-xs">{r.bookingId}</span> },
    { key: 'amount', label: 'Amount', right: true, render: (r) => <span className="mono">{naira(r.amount)}</span> },
    { key: 'purpose', label: 'Purpose', render: (r) => r.purpose },
    { key: 'status', label: 'Status', render: (r) => <Status value={r.status} /> },
    { key: 'attempts', label: 'Attempts', right: true, render: (r) => r.attempts },
    { key: 'reason', label: 'Failure reason', render: (r) => r.failureReason || '-' },
    {
      key: 'act', label: 'Action', right: true,
      render: (r) => (r.status === 'Failed'
        ? <button className="btn-ink btn-sm" disabled={busyId === r.id} onClick={() => retry(r)}>Retry</button>
        : null),
    },
  ];

  return (
    <div>
      <div className="mb-5 max-w-[220px]">
        <Field label="Status">
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="Failed">Failed</option><option value="">All</option><option value="Pending">Pending</option><option value="Completed">Completed</option>
          </select>
        </Field>
      </div>
      {loading && !data ? <ListSkeleton rows={4} label="Loading refunds" /> : (
        <>
          <DataList rows={data?.items ?? []} cols={cols} empty="No refunds found" />
          <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/* ---------- Revenue ---------- */

function RevenueTab() {
  const { data, loading } = useAdminData('/admin/revenue', { months: 12 }, 'Failed to load revenue.');
  if (loading && !data) return <ListSkeleton rows={6} label="Loading revenue" />;
  const cols = [
    { key: 'month', label: 'Month', render: (m) => <span className="font-medium">{m.month}</span> },
    { key: 'n', label: 'Paid bookings', right: true, render: (m) => m.paidBookings },
    { key: 'fees', label: 'Platform fees', right: true, render: (m) => <span className="mono">{naira(m.platformFees)}</span> },
    { key: 'disc', label: 'Discounts', right: true, render: (m) => <span className="mono">{naira(m.discounts)}</span> },
    { key: 'net', label: 'Net platform revenue', right: true, render: (m) => <span className="mono">{naira(m.netPlatformRevenue)}</span> },
  ];
  return (
    <div>
      <DataList rows={data?.months ?? []} cols={cols} rowKey={(m) => m.month} empty="No revenue yet" />
      {data && (
        <p className="mt-4 text-sm text-muted">Total platform fees: <span className="mono font-medium text-ink">{naira(data.totalPlatformFees)}</span></p>
      )}
    </div>
  );
}

/* ---------- Promo codes ---------- */

const EMPTY_PROMO = { code: '', discountType: 'percent', discountValue: '', expiresAt: '', usageLimit: '' };

function PromoTab() {
  const { data, loading, reload } = useAdminData('/admin/promo-codes', {}, 'Failed to load promo codes.');
  const [form, setForm] = useState(EMPTY_PROMO);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/promo-codes', {
        code: form.code.trim(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        expiresAt: form.expiresAt || null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      });
      toast.success('Promo code created');
      setForm(EMPTY_PROMO);
      reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create promo code.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p) => {
    setBusyId(p.id);
    try {
      await api.patch(`/admin/promo-codes/${p.id}`, { isActive: !p.isActive });
      toast.success(p.isActive ? 'Code deactivated' : 'Code activated');
      reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update promo code.'));
    } finally {
      setBusyId(null);
    }
  };

  const cols = [
    { key: 'code', label: 'Code', render: (p) => <span className="mono font-medium">{p.code}</span> },
    { key: 'disc', label: 'Discount', render: (p) => (p.discountType === 'percent' ? `${p.discountValue}%` : naira(p.discountValue)) },
    { key: 'used', label: 'Used', right: true, render: (p) => `${p.timesUsed}${p.usageLimit != null ? ` / ${p.usageLimit}` : ''}` },
    { key: 'exp', label: 'Expires', render: (p) => (p.expiresAt ? formatDateTime(p.expiresAt) : 'Never') },
    { key: 'status', label: 'Active', render: (p) => <span className={p.isActive ? 'chip-green' : 'chip-neutral'}>{p.isActive ? 'Active' : 'Off'}</span> },
    {
      key: 'act', label: 'Action', right: true,
      render: (p) => <button className="btn-outline btn-sm" disabled={busyId === p.id} onClick={() => toggle(p)}>{p.isActive ? 'Deactivate' : 'Activate'}</button>,
    },
  ];

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="card card-pad">
        <h3 className="mb-4 text-lg font-medium">New promo code</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1">
            <Field label="Code">
              <input className="input uppercase" required minLength={3} maxLength={32} pattern="[A-Za-z0-9\-]+" title="Letters, digits and dashes" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" />
            </Field>
          </div>
          <Field label="Type">
            <select className="input" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              <option value="percent">Percent</option><option value="fixed">Fixed (₦)</option>
            </select>
          </Field>
          <Field label="Value">
            <input className="input" type="number" required min={1} max={form.discountType === 'percent' ? 100 : undefined} step="any" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
          </Field>
          <Field label="Expiry (optional)"><input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
          <Field label="Usage limit (optional)"><input className="input" type="number" min={1} step={1} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} /></Field>
        </div>
        <button className="btn-ink mt-4" disabled={saving}>{saving ? 'Creating...' : 'Create code'}</button>
      </form>
      {loading && !data ? <ListSkeleton rows={4} label="Loading promo codes" /> : <DataList rows={data ?? []} cols={cols} empty="No promo codes yet" />}
    </div>
  );
}

/* ---------- Page ---------- */

const TABS = [
  { id: 'kyc', label: 'KYC', Comp: KycTab },
  { id: 'listings', label: 'Listings', Comp: ListingsTab },
  { id: 'bookings', label: 'Bookings', Comp: BookingsTab },
  { id: 'refunds', label: 'Refunds', Comp: RefundsTab },
  { id: 'revenue', label: 'Revenue', Comp: RevenueTab },
  { id: 'promo', label: 'Promo codes', Comp: PromoTab },
];

export default function AdminDashboard() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [tab, setTab] = useState('kyc');
  const isAdmin = isAuthenticated && user?.role === 'admin';
  if (!isAdmin) return <Navigate to="/" replace />;
  const Active = TABS.find((t) => t.id === tab).Comp;

  return (
    <div className="page pb-24 pt-10">
      <p className="eyebrow mb-4">Admin</p>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
        <div className="flex w-max gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={tab === t.id ? 'btn-ink btn-sm' : 'btn-outline btn-sm'}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Active key={tab} />
    </div>
  );
}
