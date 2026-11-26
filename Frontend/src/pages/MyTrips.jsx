import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Calendar, MapPin, KeyRound, Luggage, ArrowRight, Sparkles, ImageOff, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { EmptyState, StatusBadge, CautionChip } from '../components/ui';
import { TripGridSkeleton } from '../components/Skeletons';
import { naira, formatDay, nightsBetween, img } from '../utils/format';

const UPCOMING = ['pending', 'split_pending', 'paid', 'confirmed'];

function TripCard({ trip }) {
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
        </div>
      </div>
    </article>
  );
}

export default function MyTrips() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const { isAuthenticated, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login', { state: { from: '/my-trips' } }); return; }
    if (user?.role === 'host') { navigate('/dashboard'); return; }

    // Coming back from Paystack
    if (searchParams.get('reference') || searchParams.get('trxref')) {
      toast.success('Payment received. Your host will confirm shortly.', { duration: 5000, id: 'paystack-return' });
      setSearchParams({}, { replace: true });
    }

    const fetchTrips = async () => {
      try {
        const response = await api.get('/Bookings/guest');
        setTrips(response.data);
      } catch (error) {
        toast.error(errorMessage(error, 'Failed to load your trips.'));
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, [isAuthenticated, user, navigate, searchParams, setSearchParams]);

  if (!isAuthenticated || user?.role === 'host') return null;

  const today = new Date(new Date().toISOString().slice(0, 10));
  const upcoming = trips.filter((t) => UPCOMING.includes(t.status) && new Date(t.checkOut) >= today);
  const past = trips.filter((t) => !upcoming.includes(t));
  const shown = tab === 'upcoming' ? upcoming : past;

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
          <button aria-pressed={tab === 'past'} onClick={() => setTab('past')}>Past · {past.length}</button>
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
          {shown.map((trip) => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}
    </div>
  );
}
