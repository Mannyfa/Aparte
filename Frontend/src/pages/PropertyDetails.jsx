import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import {
  MapPin, BadgeCheck, ShieldCheck, X, Plus, Check, Users, ArrowLeft, ArrowRight, Lock, ImageOff, ScrollText, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, differenceInCalendarDays, addDays, startOfToday } from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Modal, Row } from '../components/ui';
import { PropertyDetailsSkeleton } from '../components/Skeletons';
import { peek, getCached } from '../utils/cache';
import { naira, img } from '../utils/format';

function Gallery({ images, title }) {
  const [active, setActive] = useState(0);
  if (!images?.length) {
    return (
      <div className="grid aspect-[16/7] place-items-center rounded-2xl border border-line bg-sand text-faint">
        <div className="flex flex-col items-center gap-2">
          <ImageOff size={22} />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em]">No photos yet</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl bg-sand">
        <img src={img(images[active], 1600)} alt={title} decoding="async" className="aspect-[16/9] w-full object-cover md:aspect-[16/7]" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === active ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'}`}
              aria-label={`Show photo ${i + 1}`}
            >
              <img src={img(src, 200)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useContext(AuthContext);

  // If the listing card was hovered/tapped, its details are usually already cached: render instantly.
  const [property, setProperty] = useState(() => peek(`/Properties/${id}`) ?? null);
  const [loading, setLoading] = useState(() => !peek(`/Properties/${id}`));

  // Dates carried over from a date search on the home page (?checkIn=…&checkOut=…)
  const [searchParams] = useSearchParams();
  const fromQuery = (key) => {
    const v = searchParams.get(key);
    const d = v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? parseISO(v) : null;
    return d && d >= startOfToday() ? d : null;
  };
  const [checkIn, setCheckIn] = useState(() => fromQuery('checkIn'));
  const [checkOut, setCheckOut] = useState(() => (fromQuery('checkIn') ? fromQuery('checkOut') : null));
  const [reviews, setReviews] = useState(null);
  const [bookedDates, setBookedDates] = useState(() => (peek(`/Properties/${id}/booked-dates`) ?? []).map((d) => parseISO(d)));

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Apartey Split
  const [isSplit, setIsSplit] = useState(false);
  const [splitWays, setSplitWays] = useState(2);

  useEffect(() => {
    const fetchPropertyAndDates = async () => {
      try {
        // Both requests at once (they used to run one after the other).
        const [propertyData, dates] = await Promise.all([
          getCached(`/Properties/${id}`),
          getCached(`/Properties/${id}/booked-dates`, { maxAge: 10_000 }), // availability should be fresh
        ]);
        setProperty(propertyData);
        // "yyyy-MM-dd" strings are calendar days: parse them as local dates, not UTC midnight
        setBookedDates(dates.map((d) => parseISO(d)));
      } catch (error) {
        toast.error(errorMessage(error, 'Failed to load this property.'));
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchPropertyAndDates();
  }, [id, navigate]);

  // Reviews load separately so they never delay the page.
  useEffect(() => {
    let cancelled = false;
    getCached(`/Reviews/property/${id}`).then((r) => { if (!cancelled) setReviews(r); }).catch(() => { if (!cancelled) setReviews({ count: 0, reviews: [] }); });
    return () => { cancelled = true; };
  }, [id]);

  const nights = checkIn && checkOut ? Math.max(0, differenceInCalendarDays(checkOut, checkIn)) : 0;

  // Check-out can't go past the next booked night.
  const maxCheckOutDate = checkIn
    ? bookedDates.filter((d) => d > checkIn).sort((a, b) => a - b)[0] ?? null
    : null;

  const handleInitiateCheckout = () => {
    if (!isAuthenticated) {
      toast.error('Please log in to book this place.');
      return navigate('/login', { state: { from: location.pathname } });
    }
    if (user?.role === 'host') return toast.error('Host accounts can’t make bookings. Log in with a guest account.');
    if (nights <= 0) return toast.error('Choose your check-in and check-out dates.');
    setIsCheckoutModalOpen(true);
  };

  const toggleAddOn = (addon) => {
    setSelectedAddOns((prev) => (prev.some((a) => a.id === addon.id) ? prev.filter((a) => a.id !== addon.id) : [...prev, addon]));
  };

  const handleConfirmBooking = async () => {
    setBookingLoading(true);
    try {
      const payload = {
        propertyId: id,
        checkIn: format(checkIn, 'yyyy-MM-dd'), // date only: toISOString() shifted the day for UTC+1 users
        checkOut: format(checkOut, 'yyyy-MM-dd'),
        addOnIds: selectedAddOns.map((a) => a.id),
        isSplit,
        splitWays: isSplit ? splitWays : 1,
      };
      const response = await api.post('/Bookings', payload);

      if (response.data.isSplit) {
        toast.success('Split group created. Share the payment links with your friends.');
        navigate(`/split-success/${response.data.splitGroupId}`);
      } else {
        window.location.href = response.data.paymentUrl;
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Booking failed.'));
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <PropertyDetailsSkeleton />;
  if (!property) return null;

  const totalRoomPrice = property.pricePerNight * nights;
  const platformFee = Math.round(totalRoomPrice * 0.05 * 100) / 100;
  const cautionFee = property.cautionFee || 0;
  const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const finalPrice = totalRoomPrice + platformFee + cautionFee + addOnsTotal;
  const splitAmount = isSplit ? finalPrice / splitWays : finalPrice;
  const location_ = [property.area, property.city, property.state].filter(Boolean).join(', ');

  return (
    <div className="page pb-24 pt-6">
      <Link to="/#stays" className="btn-ghost btn-sm -ml-3 mb-4"><ArrowLeft size={14} /> All stays</Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {property.type && <span className="chip-neutral">{property.type}</span>}
            {property.hostVerificationStatus === 'Verified' && <span className="chip-lime"><BadgeCheck size={11} /> Verified host</span>}
          </div>
          <h1 className="text-3xl font-light tracking-[-0.035em] md:text-5xl">{property.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5"><MapPin size={14} /> {location_}</span>
            {property.reviewCount > 0 && (
              <a href="#reviews" className="text-ink hover:underline hover:underline-offset-4">★ {Number(property.rating).toFixed(1)} · {property.reviewCount} review{property.reviewCount === 1 ? '' : 's'}</a>
            )}
          </p>
        </div>
        <p className="shrink-0 md:text-right">
          <span className="mono text-2xl">{naira(property.pricePerNight)}</span>
          <span className="text-sm text-faint"> / night</span>
        </p>
      </div>

      <Gallery images={property.imageUrls} title={property.title} />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-10">
          <div className="flex items-center gap-3 border-b border-line pb-8">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lime font-mono text-xs">
              {(property.hostName || 'H').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-[15px]">Hosted by {property.hostName}</p>
              <p className="text-xs text-muted">
                {property.hostVerificationStatus === 'Verified' ? 'Identity verified by Apartey' : 'Identity not yet verified'}
              </p>
            </div>
          </div>

          {property.description && (
            <section>
              <p className="eyebrow mb-3">About this place</p>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{property.description}</p>
            </section>
          )}

          {property.amenities?.length > 0 && (
            <section>
              <p className="eyebrow mb-4">What’s included</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2.5 text-sm">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-lime"><Check size={12} /></span>{a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {property.addOns?.length > 0 && (
            <section>
              <p className="eyebrow mb-4">Add-ons from your host</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {property.addOns.map((a) => (
                  <div key={a.id} className="card flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium"><Sparkles size={14} className="text-lime-deep" /> {a.name}</p>
                      {a.description && <p className="mt-1 text-xs text-muted">{a.description}</p>}
                    </div>
                    <span className="mono shrink-0 text-sm">{naira(a.price)}</span>
                  </div>
                ))}
              </div>
              <p className="hint">Choose add-ons at checkout.</p>
            </section>
          )}

          {property.houseRules?.length > 0 && (
            <section>
              <p className="eyebrow mb-4">House rules</p>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
                {property.houseRules.map((r) => (
                  <li key={r} className="flex items-center gap-3 px-4 py-3 text-sm"><ScrollText size={14} className="text-faint" /> {r}</li>
                ))}
              </ul>
            </section>
          )}

          <section id="reviews" className="scroll-mt-24">
            <p className="eyebrow mb-4">Reviews</p>
            {reviews === null ? (
              <div className="space-y-3" aria-hidden="true">
                <div className="skeleton h-4 w-40" /><div className="skeleton h-16 w-full" /><div className="skeleton h-16 w-full" />
              </div>
            ) : reviews.count === 0 ? (
              <p className="text-sm text-muted">No reviews yet. Guests can review after their stay.</p>
            ) : (
              <>
                <p className="mb-4 flex items-baseline gap-2">
                  <span className="text-3xl font-light tracking-[-0.03em]">{Number(reviews.average).toFixed(1)}</span>
                  <span className="text-lime-deep" aria-hidden="true">{'★'.repeat(Math.round(reviews.average))}<span className="text-line">{'★'.repeat(5 - Math.round(reviews.average))}</span></span>
                  <span className="text-sm text-muted">from {reviews.count} review{reviews.count === 1 ? '' : 's'}</span>
                </p>
                <ul className="space-y-3">
                  {reviews.reviews.map((r) => (
                    <li key={r.id} className="card p-4">
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{r.guestName}</span>
                        <span className="text-xs text-faint">{format(new Date(r.createdAt), 'MMM yyyy')}</span>
                      </div>
                      <p className="text-sm text-lime-deep" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></p>
                      {r.comment && <p className="mt-1.5 whitespace-pre-line text-sm text-ink/85">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {cautionFee > 0 && (
            <section className="inset flex gap-3 p-5">
              <Lock size={18} className="mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Refundable caution fee: <span className="mono">{naira(cautionFee)}</span></p>
                <p className="mt-1 text-muted">Held in Apartey escrow, not paid to the host, and refunded if no damage is reported.</p>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: booking widget */}
        <aside className="min-w-0">
          <div className="card sticky top-24 p-5 shadow-soft">
            <p className="eyebrow mb-4">Reserve</p>
            <div className="grid grid-cols-2 overflow-visible rounded-xl border border-line">
              <label className="border-r border-line px-3 py-2.5">
                <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Check-in</span>
                <DatePicker
                  selected={checkIn}
                  onChange={(date) => { setCheckIn(date); setCheckOut(null); }}
                  selectsStart startDate={checkIn} endDate={checkOut}
                  minDate={new Date()} excludeDates={bookedDates}
                  placeholderText="Add date" dateFormat="d MMM yyyy"
                  className="w-full cursor-pointer bg-transparent text-sm outline-none placeholder:text-faint"
                />
              </label>
              <label className={`px-3 py-2.5 ${!checkIn ? 'opacity-50' : ''}`}>
                <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Check-out</span>
                <DatePicker
                  selected={checkOut} onChange={(date) => setCheckOut(date)}
                  selectsEnd startDate={checkIn} endDate={checkOut}
                  minDate={checkIn ? addDays(checkIn, 1) : new Date()}
                  maxDate={maxCheckOutDate}
                  // the next booking's first night is still a valid check-out day
                  excludeDates={bookedDates.filter((d) => !maxCheckOutDate || d.getTime() !== maxCheckOutDate.getTime())}
                  placeholderText="Add date" disabled={!checkIn} dateFormat="d MMM yyyy"
                  popperPlacement="bottom-end"
                  className="w-full cursor-pointer bg-transparent text-sm outline-none placeholder:text-faint disabled:cursor-not-allowed"
                />
              </label>
            </div>

            {nights > 0 && (
              <div className="mt-5 space-y-2 animate-fade-in">
                <Row label={`${naira(property.pricePerNight)} × ${nights} night${nights > 1 ? 's' : ''}`} value={naira(totalRoomPrice)} />
                <Row label="Platform fee (5%)" value={naira(platformFee)} />
                {cautionFee > 0 && <Row label="Caution fee · refundable" value={naira(cautionFee)} />}
                <Row label="Total before add-ons" value={naira(totalRoomPrice + platformFee + cautionFee)} strong className="border-t border-line pt-3" />
              </div>
            )}

            <button onClick={handleInitiateCheckout} disabled={nights <= 0} className="btn-ink btn-lg mt-5 w-full">
              {nights > 0 ? <>Continue <ArrowRight size={16} /></> : 'Select dates'}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-faint">
              <ShieldCheck size={13} /> You won’t be charged until you confirm
            </p>
          </div>
        </aside>
      </div>

      {/* CHECKOUT */}
      <Modal open={isCheckoutModalOpen} onClose={() => setIsCheckoutModalOpen(false)} title="Checkout" wide>
        <div className="grid md:grid-cols-[1fr_1.15fr]">
          {/* Summary */}
          <div className="border-b border-line bg-cream p-6 md:border-b-0 md:border-r md:p-8">
            <p className="eyebrow mb-4">Your stay</p>
            <div className="flex gap-3">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-sand">
                {property.imageUrls?.[0] && <img src={img(property.imageUrls[0], 200)} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium">{property.title}</p>
                <p className="mt-0.5 text-xs text-muted">{property.city}</p>
              </div>
            </div>
            {checkIn && checkOut && (
              <div className="inset mt-5 flex items-center justify-between px-4 py-3 text-sm">
                <span>{format(checkIn, 'EEE d MMM')} → {format(checkOut, 'EEE d MMM')}</span>
                <span className="chip-neutral">{nights} night{nights > 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="mt-6 space-y-2">
              <Row label={`${naira(property.pricePerNight)} × ${nights}`} value={naira(totalRoomPrice)} />
              <Row label="Platform fee (5%)" value={naira(platformFee)} />
              {cautionFee > 0 && <Row label="Caution fee · escrow" value={naira(cautionFee)} />}
              {selectedAddOns.map((a) => <Row key={a.id} label={`+ ${a.name}`} value={naira(a.price)} />)}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-cream">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream/70">Total</span>
              <span className="mono text-lg">{naira(finalPrice)}</span>
            </div>
            {isSplit && (
              <p className="mt-3 text-right text-xs text-muted">
                Split {splitWays} ways ≈ <span className="mono text-ink">{naira(splitAmount)}</span> each
              </p>
            )}
          </div>

          {/* Options */}
          <div className="flex flex-col p-6 md:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-light tracking-[-0.02em]">Finish your booking</h3>
              <button onClick={() => setIsCheckoutModalOpen(false)} className="btn-ghost btn-sm -mr-2" aria-label="Close"><X size={16} /></button>
            </div>

            {property.addOns?.length > 0 && (
              <>
                <p className="eyebrow mb-3">Add-ons</p>
                <div className="space-y-2">
                  {property.addOns.map((addon) => {
                    const selected = selectedAddOns.some((a) => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddOn(addon)}
                        aria-pressed={selected}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors ${selected ? 'border-ink bg-paper' : 'border-line hover:bg-cream'}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{addon.name}</p>
                          {addon.description && <p className="truncate text-xs text-muted">{addon.description}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="mono text-sm">{naira(addon.price)}</span>
                          <span className={`grid h-6 w-6 place-items-center rounded-md ${selected ? 'bg-lime' : 'bg-sand'}`}>
                            {selected ? <Check size={14} /> : <Plus size={14} />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Split */}
            <div className="mt-6 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-sand"><Users size={16} /></span>
                  <div>
                    <p className="text-sm font-medium">Apartey Split</p>
                    <p className="text-xs text-muted">Each friend pays their share from their own link</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isSplit}
                  onClick={() => setIsSplit(!isSplit)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isSplit ? 'bg-ink' : 'bg-line'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-all ${isSplit ? 'left-[22px] bg-lime' : 'left-0.5'}`} />
                </button>
              </div>
              {isSplit && (
                <div className="mt-4 flex items-center justify-between border-t border-line pt-4 animate-fade-in">
                  <span className="text-sm text-muted">Split between</span>
                  <div className="segmented">
                    {[2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" aria-pressed={splitWays === n} onClick={() => setSplitWays(n)}>{n}</button>
                    ))}
                  </div>
                </div>
              )}
              {isSplit && <p className="hint">Everyone has 24 hours to pay. The booking goes to the host once all shares are paid.</p>}
            </div>

            <div className="mt-auto pt-6">
              <button onClick={handleConfirmBooking} disabled={bookingLoading} className="btn-lime btn-lg w-full">
                {bookingLoading
                  ? 'Processing…'
                  : isSplit
                    ? <>Create split group <ArrowRight size={16} /></>
                    : <>Pay {naira(finalPrice)} <ArrowRight size={16} /></>}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-faint">
                <Lock size={12} /> Secure payment via Paystack
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
