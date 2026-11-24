import React, { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { ExternalLink, Check, X, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Loader, EmptyState } from '../components/ui';
import { formatDay, initials } from '../utils/format';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [pendingHosts, setPendingHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const isAdmin = isAuthenticated && user?.role === 'admin';

  // All hooks must run on every render, so the redirect check comes after them.
  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

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
    <div className="page pb-24 pt-10">
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-4">Admin</p>
          <h1 className="h-page">Host verification</h1>
          <p className="lead mt-3">Review ID documents and approve hosts for the Verified badge.</p>
        </div>
        <span className="chip-lime self-start sm:self-auto">{pendingHosts.length} pending</span>
      </div>

      {loading ? (
        <Loader label="Loading queue" />
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
