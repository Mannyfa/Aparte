import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Calendar, MapPin, KeyRound, Luggage, ArrowRight, Sparkles, ImageOff, Lock, X, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { invalidate } from '../utils/cache';
import { AuthContext } from '../context/AuthContext';
import { EmptyState, StatusBadge, CautionChip, Modal, Row } from '../components/ui';
import { TripGridSkeleton } from '../components/Skeletons';
import { naira, formatDay, formatDateTime, nightsBetween, img } from '../utils/format';

const UPCOMING = ['pending', 'split_pending', 'paid', 'confirmed'];
const checkInMoment = (trip) => new Date(new Date(trip.checkIn).getTime() + 13 * 3600 * 1000); // 2pm Lagos

const canCancel = (trip) => UPCOMING.includes(trip.status) && Date.now() < checkInMoment(trip).getTime();
const canReview = (trip) => (trip.status === 'confirmed' || trip.status === 'completed') && !trip.hasReviewed && Date.now() >= checkInMoment(trip).getTime();

function TripCard({ trip, onCancel, onReview }) {
  const nights = nightsBetween(trip.checkIn, trip.checkOut);
  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="relative aspect-[16/9] bg-sand">
        {trip.imageUrl ? (
          <img src={img(trip.imageUrl, 640)} alt={trip.propertyTitle} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-faint"><ImageOff size={20} /></div>
        )}
        <div className="absolute left-3 top-3"><StatusBadge status={trip.status} /></div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <Link to={`/property/${trip.propertyId}`} className="line-clamp-1 font-medium hover:underline hover:underline-offset-4">
          {trip.propertyTitle}
        </Link>
        <div className="mt-3 space-y-1.5 text-[13px] text-muted">
          <p className="flex items-center gap-2"><Calendar size={14} /> {formatDay(trip.checkIn)} → {formatDay(trip.checkOut)} · {nights} night{nights === 1 ? '' : 's'}</p>
          <p className="flex items-center gap-2"><MapPin size={14} /> {trip.city}</p>
        </div>

        {trip.addOns?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {trip.addOns.map((a) => (
              <span key={a.id} className="chip-neutral"><Sparkles size={10} /> {a.name}</span>
            ))}
          </div>
        )}

        {trip.cautionFee > 0 && ['Held', 'Releasing', 'Refunded', 'Claimed', 'PartlyClaimed'].includes(trip.cautionFeeStatus) && (
          <div className="mt-4 rounded-lg bg-sand/70 px-3 py-2.5 text-xs">
            <p className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted"><Lock size={12} /> Caution fee <span className="mono text-ink">{naira(trip.cautionFee)}</span></span>
              <CautionChip status={trip.cautionFeeStatus} />
            </p>
            {trip.cautionFeeStatus === 'Held' && <p className="mt-1 text-faint">Held in escrow. It comes back to you after check-out unless the host reports damage.</p>}
            {(trip.cautionFeeStatus === 'Claimed' || trip.cautionFeeStatus === 'PartlyClaimed') && (
              <p className="mt-1 text-muted">
                Host kept <span className="mono text-ink">{naira(trip.cautionClaimAmount)}</span>: {trip.cautionClaimReason}
                {trip.cautionFee > trip.cautionClaimAmount && <> · <span className="mono text-ink">{naira(trip.cautionFee - trip.cautionClaimAmount)}</span> refunded</>}
              </p>
            )}
          </div>
        )}

        {trip.status === 'split_pending' && trip.splitGroupId && (
          <Link to={`/split-success/${trip.splitGroupId}`} className="btn-outline btn-sm mt-4 self-start">
            Open group payment <ArrowRight size={14} />
          </Link>
        )}

        <div className="mt-auto pt-5">
          {trip.status === 'confirmed' && trip.checkInCode ? (
            <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-cream">
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-cream/70"><KeyRound size={14} /> Check-in code</span>
              <span className="mono text-xl tracking-[0.2em] text-lime">{trip.checkInCode}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
                {trip.status === 'paid' ? 'Paid · waiting for host' : ['rejected', 'cancelled', 'expired'].includes(trip.status) ? 'Refunded' : 'Total'}
              </span>
              <span className="mono">{naira(trip.totalPrice)}</span>
            </div>
          )}

          {(canCancel(trip) || canReview(trip)) && (
            <div className="mt-3 flex gap-2">
              {canReview(trip) && <button onClick={() => onReview(trip)} className="btn-lime btn-sm flex-1"><Star size={13} /> Leave a review</button>}
              {canCancel(trip) && <button onClick={() => onCancel(trip)} className="btn-ghost btn-sm flex-1 text-red-700 hover:bg-red-50">Cancel booking</button>}
            </div>
          )}
          {trip.hasReviewed && <p className="mt-3 text-center text-xs text-faint">Thanks for your review ★</p>}
        </div>
      </div>
    </article>
  );
}

function CancelModal({ trip, onClose, onDone }) {
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    api.get(`/Bookings/${trip.id}/cancellation-quote`)
      .then((r) => { if (!cancelled) setQuote(r.data); })
      .catch((e) => { if (!cancelled) { toast.error(errorMessage(e, "Couldn't check the cancellation policy.")); onClose(); } });
    return () => { cancelled = true; };
  }, [trip, onClose]);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/Bookings/${trip.id}/cancel`);
      toast.success(res.data?.message || 'Booking cancelled.');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't cancel this booking."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!trip} onClose={onClose} title="Cancel booking">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-light tracking-[-0.02em]">Cancel this booking?</h3>
          <button onClick={onClose} className="btn-ghost btn-sm -mr-2" aria-label="Close"><X size={16} /></button>
        </div>
        <p className="mb-4 text-sm text-muted">{trip?.propertyTitle} · {trip && `${formatDay(trip.checkIn)} → ${formatDay(trip.checkOut)}`}</p>

        {!quote ? (
          <div className="space-y-2" aria-hidden="true"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-2/3" /><div className="skeleton h-10 w-full" /></div>
        ) : !quote.allowed ? (
          <p className="rounded-xl bg-sand/70 p-4 text-sm">{quote.reason}</p>
        ) : (
          <>
            <div className="space-y-2 rounded-xl bg-sand/70 p-4">
              {quote.fullRefund ? (
                <p className="text-sm">{quote.paidSoFar > 0 ? 'You get a full refund.' : 'Nothing has been paid yet, so there’s nothing to refund.'}</p>
              ) : (
                <>
                  <Row label="Paid" value={naira(quote.paidSoFar)} />
                  <Row label="Kept by host (half the room rate)" value={`− ${naira(quote.keptByHost)}`} />
                  <Row label="Service fee (non-refundable)" value={`− ${naira(quote.feeKept)}`} />
                </>
              )}
              {quote.paidSoFar > 0 && <Row label="Refund to you" value={naira(quote.refundToGuest)} strong className="border-t border-line pt-2" />}
            </div>
            <p className="hint">
              Free cancellation until {formatDateTime(quote.freeCancellationUntil)} ({quote.freeCancellationHours} hours before check-in).
              Refunds go back to your card or account, usually within 5–10 working days.
            </p>
            <button onClick={confirm} disabled={busy} className="btn-danger btn-lg mt-5 w-full">{busy ? 'Cancelling…' : 'Cancel booking'}</button>
            <button onClick={onClose} className="btn-ghost btn-lg mt-2 w-full">Keep my booking</button>
          </>
        )}
      </div>
    </Modal>
  );
}

function ReviewModal({ trip, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/Reviews', { propertyId: trip.propertyId, rating, comment: comment.trim() });
      toast.success('Thanks! Your review is live.');
      invalidate(`/Reviews/property/${trip.propertyId}`);
      invalidate(`/Properties/${trip.propertyId}`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't post your review."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!trip} onClose={onClose} title="Leave a review">
      <form onSubmit={submit} className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-light tracking-[-0.02em]">How was {trip?.propertyTitle}?</h3>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm -mr-2" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="mb-4 flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onClick={() => setRating(n)} className={`text-3xl leading-none transition-colors ${n <= rating ? 'text-lime-deep' : 'text-line hover:text-faint'}`}>★</button>
          ))}
        </div>
        <label htmlFor="review-comment" className="label">Tell other guests about it <span className="font-normal text-faint">(optional)</span></label>
        <textarea id="review-comment" rows="4" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)}
          className="input" placeholder="Cleanliness, power, security, how the host was…" />
        <p className="hint">Shown on the listing with your first name and last initial.</p>
        <button type="submit" disabled={busy} className="btn-ink btn-lg mt-5 w-full">{busy ? 'Posting…' : 'Post review'}</button>
      </form>
    </Modal>
  );
}

export default function MyTrips() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [cancelTrip, setCancelTrip] = useState(null);
  const [reviewTrip, setReviewTrip] = useState(null);
  const { isAuthenticated, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const fetchTrips = useCallback(async () => {
    try {
      const response = await api.get('/Bookings/guest');
      setTrips(response.data);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load your trips.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login', { state: { from: '/my-trips' } }); return; }
    if (user?.role === 'host') { navigate('/dashboard'); return; }

    // Coming back from Paystack
    if (searchParams.get('reference') || searchParams.get('trxref')) {
      toast.success('Payment received. Your host will confirm shortly.', { duration: 5000, id: 'paystack-return' });
      setSearchParams({}, { replace: true });
    }
    fetchTrips();
  }, [isAuthenticated, user, navigate, searchParams, setSearchParams, fetchTrips]);

  const closeCancel = useCallback(() => setCancelTrip(null), []);

  if (!isAuthenticated || user?.role === 'host') return null;

  const today = new Date(new Date().toISOString().slice(0, 10));
  const upcoming = trips.filter((t) => UPCOMING.includes(t.status) && new Date(t.checkOut) >= today);
  const past = trips.filter((t) => !upcoming.includes(t));
  const shown = tab === 'upcoming' ? upcoming : past;
  const toReview = past.filter(canReview).length + upcoming.filter(canReview).length;

  return (
    <div className="page pb-24 pt-10">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="eyebrow mb-4">My trips</p>
          <h1 className="h-page">Your stays</h1>
          <p className="lead mt-3">Upcoming bookings, check-in codes and past trips, in one place.</p>
        </div>
        <div className="segmented self-start md:self-auto">
          <button aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming · {upcoming.length}</button>
          <button aria-pressed={tab === 'past'} onClick={() => setTab('past')}>Past · {past.length}{toReview > 0 ? ' ★' : ''}</button>
        </div>
      </div>

      {loading ? (
        <TripGridSkeleton count={3} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Luggage}
          title={tab === 'upcoming' ? 'No upcoming trips' : 'No past trips yet'}
          action={<Link to="/#stays" className="btn-ink">Find a stay <ArrowRight size={14} /></Link>}
        >
          {tab === 'upcoming' ? 'When you book a stay, it’ll show up here with your check-in code.' : 'Trips you’ve completed or cancelled will appear here.'}
        </EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((trip) => <TripCard key={trip.id} trip={trip} onCancel={setCancelTrip} onReview={setReviewTrip} />)}
        </div>
      )}

      {cancelTrip && <CancelModal trip={cancelTrip} onClose={closeCancel} onDone={() => { setCancelTrip(null); invalidate('/Properties'); fetchTrips(); }} />}
      {reviewTrip && <ReviewModal trip={reviewTrip} onClose={() => setReviewTrip(null)} onDone={() => { setReviewTrip(null); fetchTrips(); }} />}
    </div>
  );
}
