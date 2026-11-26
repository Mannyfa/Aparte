import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Copy, Check, Clock, Lock, ArrowRight, MessageCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { Modal } from '../components/ui';
import { SplitSkeleton } from '../components/Skeletons';
import { naira, formatDay } from '../utils/format';

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt) - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default function SplitDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [splitData, setSplitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payingShareId, setPayingShareId] = useState(null);
  const [emailFor, setEmailFor] = useState(null); // share id waiting for an email
  const [email, setEmail] = useState('');

  // Coming back from Paystack
  useEffect(() => {
    if (searchParams.get('reference') || searchParams.get('trxref')) {
      toast.success('Payment received. Updating the group…', { id: 'payment-success' });
      searchParams.delete('reference');
      searchParams.delete('trxref');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let interval = null;
    let firstLoad = true;

    const fetchSplit = async () => {
      try {
        const res = await api.get(`/Bookings/split/${id}`);
        setSplitData(res.data);
        // Nothing more will change once the group is finished: stop polling.
        if (res.data.status !== 'Pending' && interval) {
          clearInterval(interval);
          interval = null;
        }
      } catch (error) {
        if (firstLoad) {
          // Only give up on the first load; a hiccup while polling shouldn't kick the user out or spam toasts.
          if (interval) clearInterval(interval);
          interval = null;
          toast.error(errorMessage(error, 'Could not load this split group.'), { id: 'split-load' });
          navigate('/');
        }
      } finally {
        firstLoad = false;
        setLoading(false);
      }
    };

    fetchSplit();
    interval = setInterval(fetchSplit, 5000); // auto-refresh while friends are paying
    return () => { if (interval) clearInterval(interval); };
  }, [id, navigate]);

  const shareUrl = `${window.location.origin}/split-success/${id}`;
  const shareText = `Here’s the link to pay your share of our Apartey booking: ${shareUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy. Long-press the link to copy it instead.');
    }
  };

  const startPayment = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return toast.error('Please enter a valid email address.');

    const shareId = emailFor;
    setEmailFor(null);
    setPayingShareId(shareId);
    try {
      const res = await api.post(`/Bookings/split/${shareId}/pay`, { email: value });
      window.location.href = res.data.paymentUrl;
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to start the payment.'));
      setPayingShareId(null);
    }
  };

  if (loading) return <SplitSkeleton />;
  if (!splitData) return null;

  const { status } = splitData;
  const isOpen = status === 'Pending';
  const progressPct = (splitData.paidShares / splitData.totalShares) * 100;

  return (
    <div className="page max-w-3xl pb-24 pt-10">
      <p className="eyebrow mb-4">Apartey Split</p>
      <h1 className="h-page">{splitData.propertyTitle}</h1>
      <p className="lead mt-3">
        {formatDay(splitData.checkIn)} → {formatDay(splitData.checkOut)} · split {splitData.totalShares} ways
      </p>

      {/* Progress */}
      <div className="card mt-10 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Paid</p>
            <p className="mt-1 text-3xl font-light tracking-[-0.03em]">
              {splitData.paidShares} <span className="text-faint">of {splitData.totalShares}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Booking total</p>
            <p className="mono mt-1 text-xl">{naira(splitData.totalAmount)}</p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-lime transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="mt-5 text-sm">
          {status === 'Completed' ? (
            <p className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded bg-lime"><Check size={12} /></span> Fully paid. The host will confirm the booking shortly.</p>
          ) : isOpen ? (
            <p className="flex items-center gap-2 text-muted"><Clock size={15} /> Waiting for the remaining shares · <span className="mono text-ink">{timeLeft(splitData.expiresAt)}</span></p>
          ) : (
            <p className="flex items-center gap-2 text-red-700"><X size={15} /> This group {status === 'Expired' ? 'expired before everyone paid' : 'was cancelled'}. Anyone who paid is being refunded automatically.</p>
          )}
        </div>
      </div>

      {/* Share */}
      {isOpen && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-lime p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Invite your friends</p>
            <p className="text-xs text-ink/70">Everyone opens the same link and picks an unpaid share.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={copyLink} className="btn-ink btn-sm"><Copy size={14} /> Copy link</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="btn btn-sm border border-ink/20 hover:bg-ink/5">
              <MessageCircle size={14} /> WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Shares */}
      <p className="eyebrow mb-4 mt-12">Shares</p>
      <ul className="card divide-y divide-line">
        {splitData.shares.map((share, index) => {
          const paid = share.status === 'Paid';
          return (
            <li key={share.id} className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-lg font-mono text-xs ${paid ? 'bg-lime' : 'bg-sand text-muted'}`}>
                  {paid ? <Check size={15} /> : `#${index + 1}`}
                </span>
                <div>
                  <p className="text-sm font-medium">Share {index + 1}</p>
                  <p className="mono text-xs text-muted">{naira(share.amount, { decimals: 2 })}</p>
                </div>
              </div>
              {paid ? (
                <span className="chip-green">Paid</span>
              ) : isOpen ? (
                <button
                  onClick={() => { setEmail(''); setEmailFor(share.id); }}
                  disabled={payingShareId === share.id}
                  className="btn-ink btn-sm"
                >
                  {payingShareId === share.id ? 'Opening…' : <>Pay this share <ArrowRight size={14} /></>}
                </button>
              ) : (
                <span className="chip-neutral">Unpaid</span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-faint">
        <Lock size={12} /> Payments are processed securely by Paystack
      </p>

      <Modal open={!!emailFor} onClose={() => setEmailFor(null)} title="Your email">
        <form onSubmit={startPayment} className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-light tracking-[-0.02em]">Where should we send your receipt?</h3>
            <button type="button" onClick={() => setEmailFor(null)} className="btn-ghost btn-sm -mr-2" aria-label="Close"><X size={16} /></button>
          </div>
          <label htmlFor="split-email" className="label">Email</label>
          <input id="split-email" type="email" required autoFocus className="input" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn-lime btn-lg mt-5 w-full">
            <Users size={16} /> Continue to payment
          </button>
        </form>
      </Modal>
    </div>
  );
}
