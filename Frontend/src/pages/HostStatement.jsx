import React, { useContext, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Printer, FileText } from 'lucide-react';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { naira, formatDay } from '../utils/format';
import { EmptyState, StatusBadge } from '../components/ui';
import { Bone } from '../components/Skeletons';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export default function HostStatement() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [month, setMonth] = useState(currentMonth);
  const [state, setState] = useState({ month: null, data: null, error: '' });

  useEffect(() => {
    if (!/^d{4}-d{2}$/.test(month)) return undefined;
    let cancelled = false;
    api.get('/host/statement', { params: { month } })
      .then((res) => { if (!cancelled) setState({ month, data: res.data, error: '' }); })
      .catch((err) => { if (!cancelled) setState({ month, data: null, error: errorMessage(err, "We couldn't load this statement.") }); });
    return () => { cancelled = true; };
  }, [month]);

  const loading = state.month !== month;
  const { data, error } = state;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'host') return <Navigate to="/" replace />;

  const bookings = data?.bookings || [];
  const cards = [
    { label: 'Bookings', value: data?.bookingCount ?? 0 },
    { label: 'Total earnings', value: naira(data?.totalEarnings, { decimals: 2 }) },
  ];

  return (
    <div className="page py-6 md:py-10">
      <div className="print-hide mb-4">
        <Link to="/dashboard" className="btn-ghost btn-sm -ml-3"><ArrowLeft size={14} /> Back to dashboard</Link>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-3">Host statement</p>
          <h1 className="text-3xl font-light tracking-[-0.035em] md:text-4xl">{/^\d{4}-\d{2}$/.test(month) ? monthLabel(month) : 'Monthly statement'}</h1>
          <p className="mt-2 text-sm text-muted">Stays checking in this month. Earnings are room plus add-ons.</p>
        </div>
        <div className="print-hide flex items-end gap-2">
          <div className="min-w-0 flex-1 sm:flex-none">
            <label className="label" htmlFor="stmt-month">Month</label>
            <input id="stmt-month" type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} className="input mono text-base sm:text-sm" />
          </div>
          <button type="button" onClick={() => window.print()} disabled={loading || !data} className="btn-ink"><Printer size={14} /> Print / Save as PDF</button>
        </div>
      </div>

      {loading ? (
        <div aria-hidden="true" className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><Bone className="h-24" /><Bone className="h-24" /></div>
          <Bone className="h-48 w-full" />
        </div>
      ) : error ? (
        <EmptyState icon={FileText} title="Statement unavailable">{error}</EmptyState>
      ) : (
        <div className="print-area">
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="card print-block p-5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">{c.label}</p>
                <p className="mono mt-3 break-words text-xl md:text-2xl">{c.value}</p>
              </div>
            ))}
          </div>

          {bookings.length === 0 ? (
            <div className="mt-6">
              <EmptyState icon={FileText} title="No bookings this month">Paid, confirmed and completed stays that check in during this month will appear here.</EmptyState>
            </div>
          ) : (
            <>
              <ul className="mt-6 space-y-3 md:hidden">
                {bookings.map((b) => (
                  <li key={b.id} className="card print-block p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate font-medium">{b.propertyTitle}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 text-muted">{b.guestFirstName} · {b.nights} night{b.nights === 1 ? '' : 's'}</p>
                    <p className="font-mono text-[11px] text-faint">{formatDay(b.checkIn)} → {formatDay(b.checkOut)}</p>
                    <p className="mono mt-2">{naira(b.hostEarnings, { decimals: 2 })}</p>
                  </li>
                ))}
              </ul>

              <div className="print-scroll card mt-6 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
                      <th className="px-4 py-3 font-normal">Check-in</th>
                      <th className="px-4 py-3 font-normal">Check-out</th>
                      <th className="px-4 py-3 font-normal">Nights</th>
                      <th className="px-4 py-3 font-normal">Guest</th>
                      <th className="px-4 py-3 font-normal">Property</th>
                      <th className="px-4 py-3 text-right font-normal">Earnings</th>
                      <th className="px-4 py-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td className="mono whitespace-nowrap px-4 py-3">{formatDay(b.checkIn)}</td>
                        <td className="mono whitespace-nowrap px-4 py-3">{formatDay(b.checkOut)}</td>
                        <td className="mono px-4 py-3">{b.nights}</td>
                        <td className="px-4 py-3">{b.guestFirstName}</td>
                        <td className="px-4 py-3">{b.propertyTitle}</td>
                        <td className="mono whitespace-nowrap px-4 py-3 text-right">{naira(b.hostEarnings, { decimals: 2 })}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
