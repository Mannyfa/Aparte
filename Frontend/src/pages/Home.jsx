import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Search, ArrowRight, ChevronLeft, ChevronRight, ChevronDown, Check, ShieldCheck,
  Users, ConciergeBell, BadgeCheck, Bell, Lock, RotateCcw, CreditCard, Map as MapIcon, LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import PropertyMap from '../components/PropertyMap';
import { Loader, EmptyState, SectionHeader } from '../components/ui';
import { naira } from '../utils/format';

const PROPERTY_TYPES = ['Apartment', 'Penthouse', 'Duplex', 'Studio'];

const STEPS = [
  { title: 'Find a verified stay', body: 'Search by area, type and budget. Every listing shows its host’s verification status before you book.' },
  { title: 'Pay once, or split it', body: 'Pay securely through Paystack, or split the total with friends and send each person their own payment link.' },
  { title: 'Get your check-in code', body: 'When the host confirms, your gate code appears in My Trips and lands in your inbox.' },
];

const FAQS = [
  {
    q: 'What does Apartey charge?',
    a: 'A 5% platform fee on the room rate, shown in your price breakdown before you pay. Add-ons and the refundable caution fee are not charged a fee.',
  },
  {
    q: 'What is the caution fee?',
    a: 'Some hosts ask for a refundable caution fee. It’s held in escrow by Apartey, not paid to the host, and is returned if no damage is reported.',
  },
  {
    q: 'How does Apartey Split work?',
    a: 'Turn on Split at checkout and choose 2–5 people. You get a group page with a payment link per person. The booking goes to the host once every share is paid. The group has 24 hours to finish.',
  },
  {
    q: 'What happens if the host declines?',
    a: 'Every payment for that booking, including each friend’s share in a split, is refunded through Paystack to the card or account it came from.',
  },
  {
    q: 'When do I get my check-in code?',
    a: 'As soon as your host accepts the booking. It shows on the trip card in My Trips and is emailed to you.',
  },
  {
    q: 'How do hosts get paid?',
    a: 'When a guest pays, the host’s earnings (room rate plus add-ons) go to their Apartey wallet. Hosts can withdraw to any Nigerian bank account from ₦1,000.',
  },
];

/* ---------- Hero illustration: an example booking summary ---------- */
function BookingPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md rounded-[22px] border border-line bg-sand/80 p-3 shadow-lift">
      <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Example booking</span>
        <span className="chip-lime"><Lock size={11} /> Escrow</span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-paper">
        <div className="relative h-40">
          <img
            src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=70"
            alt=""
            className="h-full w-full object-cover"
          />
          <span className="chip absolute left-3 top-3 bg-paper/90 text-ink"><BadgeCheck size={11} /> Verified host</span>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="font-medium">2-bed apartment, Lekki Phase 1</p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-faint">Fri 12 Dec → Mon 15 Dec · 3 nights</p>
          </div>
          <div className="space-y-2 border-t border-line pt-4 font-mono text-[12.5px]">
            <div className="flex justify-between"><span className="text-muted">₦85,000 × 3 nights</span><span>₦255,000</span></div>
            <div className="flex justify-between"><span className="text-muted">Platform fee (5%)</span><span>₦12,750</span></div>
            <div className="flex justify-between"><span className="text-muted">Airport pickup</span><span>₦25,000</span></div>
            <div className="flex justify-between"><span className="text-muted">Caution fee · refundable</span><span>₦50,000</span></div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-cream">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream/70">Total</span>
            <span className="font-mono text-lg">₦342,750</span>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 shadow-soft sm:flex">
        <div className="flex -space-x-2">
          {['AO', 'TK', 'IB'].map((i, n) => (
            <span key={i} className={`grid h-6 w-6 place-items-center rounded-full border-2 border-paper font-mono text-[9px] ${n === 0 ? 'bg-lime' : 'bg-sand'}`}>{i}</span>
          ))}
        </div>
        <span className="text-xs text-muted">Split 3 ways · <span className="font-mono text-ink">₦114,250</span> each</span>
      </div>
    </div>
  );
}

/* ---------- Listing card ---------- */
function PropertyCard({ property, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper text-left transition-shadow hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        {property.imageUrls?.length > 0 ? (
          <img
            src={property.imageUrls[0]}
            alt={property.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-mono text-xs uppercase tracking-wider text-faint">No photo yet</div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {property.type && <span className="chip bg-paper/90 text-ink">{property.type}</span>}
          {property.hostVerificationStatus === 'Verified' && (
            <span className="chip-lime"><BadgeCheck size={11} /> Verified</span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 font-medium">{property.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
          <MapPin size={13} className="shrink-0" />
          <span className="truncate">{[property.area, property.city].filter(Boolean).join(', ')}</span>
        </p>
        <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
          <p>
            <span className="mono text-[15px]">{naira(property.pricePerNight)}</span>
            <span className="text-xs text-faint"> / night</span>
          </p>
          <span className="flex items-center gap-1 text-[13px] text-muted transition-colors group-hover:text-ink">
            View <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className="border-b border-line">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-6 py-5 text-left" aria-expanded={open}>
        <span className="text-[15px]">{q}</span>
        <ChevronDown size={16} className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="-mt-1 pb-5 pr-8 text-sm leading-relaxed text-muted animate-fade-in">{a}</p>}
    </div>
  );
}

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [openFaq, setOpenFaq] = useState(0);

  // Search & pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, pageSize: 6 });
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (filterType) params.append('type', filterType);
      if (maxPrice) params.append('maxPrice', maxPrice);

      const response = await api.get(`/Properties/search?${params.toString()}`);
      setProperties(response.data.data);
      setTotalPages(response.data.totalPages);
      setTotalItems(response.data.totalItems);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load stays.'));
    } finally {
      setLoading(false);
    }
  };

  // Filters apply when the search button is pressed, not on every keystroke.
  useEffect(() => {
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const scrollToListings = () => {
    const el = document.getElementById('stays');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (page === 1) fetchProperties();
    else setPage(1);
    scrollToListings();
  };

  const goToPage = (p) => { setPage(p); scrollToListings(); };

  const hostCta = user?.role === 'host' ? '/dashboard' : '/register';

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="page grid grid-cols-1 items-center gap-14 pb-20 pt-10 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-28">
        <div className="min-w-0 animate-fade-up">
          <p className="eyebrow mb-6">Verified shortlets · Nigeria</p>
          <h1 className="display text-[3.1rem] sm:text-6xl lg:text-[4.6rem]">
            Shortlets that <br className="hidden sm:block" />
            feel like <span className="mark">home.</span>
          </h1>
          <p className="lead mt-6 max-w-lg">
            Book verified apartments in Lagos, Abuja and beyond. Your caution fee stays in escrow, and you can split the bill with friends in a couple of taps.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-9 rounded-2xl border border-line bg-paper p-2 shadow-soft">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
              <label className="flex min-w-0 flex-col rounded-xl px-3 py-2 transition-colors focus-within:bg-sand/60 hover:bg-sand/40">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Where</span>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Lekki, Ikoyi, Wuse 2…"
                  className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-faint"
                />
              </label>
              <label className="flex min-w-0 flex-col rounded-xl px-3 py-2 transition-colors focus-within:bg-sand/60 hover:bg-sand/40">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Type</span>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full min-w-0 cursor-pointer bg-transparent text-sm outline-none">
                  <option value="">Any type</option>
                  {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="flex min-w-0 flex-col rounded-xl px-3 py-2 transition-colors focus-within:bg-sand/60 hover:bg-sand/40">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Max / night</span>
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="₦ any"
                  className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-faint"
                />
              </label>
              <button type="submit" className="btn-ink btn-lg rounded-xl">
                <Search size={16} /> <span className="sm:hidden lg:inline">Search</span>
              </button>
            </div>
          </form>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
            {['ID-verified hosts', 'Escrow-held caution fees', 'Split with friends'].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check size={14} className="text-lime-deep" /> {t}</li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 animate-fade-up [animation-delay:120ms]">
          <BookingPreview />
        </div>
      </section>

      {/* ================= LISTINGS ================= */}
      <section id="stays" className="border-y border-line bg-paper">
        <div className="page section">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeader
              eyebrow="Available now"
              title="Stays across Nigeria"
              lead={loading ? 'Looking for places…' : `${totalItems} ${totalItems === 1 ? 'place' : 'places'} match your search.`}
            />
            <div className="segmented self-start md:self-auto">
              <button aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} className="flex items-center gap-1.5">
                <LayoutGrid size={14} /> Grid
              </button>
              <button aria-pressed={viewMode === 'map'} onClick={() => setViewMode('map')} className="flex items-center gap-1.5">
                <MapIcon size={14} /> Map
              </button>
            </div>
          </div>

          {loading ? (
            <Loader label="Finding stays" />
          ) : properties.length === 0 ? (
            <EmptyState icon={Search} title="No stays match that search">
              Try a nearby area, a different property type, or a higher budget.
            </EmptyState>
          ) : viewMode === 'map' ? (
            <div className="overflow-hidden rounded-2xl border border-line">
              <PropertyMap properties={properties} />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} onOpen={() => navigate(`/property/${p.id}`)} />
              ))}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-3">
              <button onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-outline btn-sm">
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="mono px-2 text-sm text-muted">{page} / {totalPages}</span>
              <button onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-outline btn-sm">
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="page section">
        <SectionHeader eyebrow="How it works" title={<>From search to gate code <br className="hidden md:block" />in three steps.</>} />
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <div key={s.title} className="border-t border-line pt-6">
              <span className="chip-lime">Step {i + 1}</span>
              <h3 className="mt-5 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="border-t border-line">
        <div className="page section">
          <SectionHeader
            eyebrow="What’s included"
            title={<>Everything a good stay needs, <br className="hidden md:block" />nothing you have to chase.</>}
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {/* Escrow (wide) */}
            <div className="card card-pad md:col-span-2">
              <div className="inset space-y-2 p-5 font-mono text-[12.5px]">
                <div className="flex justify-between"><span className="text-muted">Room · 3 nights</span><span>₦255,000</span></div>
                <div className="flex justify-between"><span className="text-muted">Platform fee (5%)</span><span>+ ₦12,750</span></div>
                <div className="flex justify-between"><span className="text-lime-deep">Caution fee → escrow</span><span className="text-lime-deep">₦50,000</span></div>
                <div className="flex justify-between border-t border-line pt-2 text-[14px]"><span>You pay</span><span>₦317,750</span></div>
              </div>
              <h3 className="mt-5 font-medium">Every naira accounted for</h3>
              <p className="mt-1.5 text-sm text-muted">See the full breakdown before you pay. The caution fee goes into escrow, not to the host.</p>
            </div>

            {/* Split */}
            <div className="card card-pad">
              <div className="inset flex items-center justify-center gap-2 p-5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`rounded-lg px-3 py-2 text-center font-mono text-[11px] ${n === 1 ? 'bg-lime' : 'bg-paper'}`}>
                    <div className="text-faint">#{n}</div>
                    <div>{n === 1 ? 'Paid' : '₦106k'}</div>
                  </div>
                ))}
              </div>
              <h3 className="mt-5 flex items-center gap-2 font-medium"><Users size={16} /> Apartey Split</h3>
              <p className="mt-1.5 text-sm text-muted">Split the booking 2–5 ways. Everyone pays their share from their own link.</p>
            </div>

            {/* Add-ons */}
            <div className="card card-pad">
              <div className="inset flex flex-wrap gap-2 p-5">
                {['Airport pickup', 'Private chef', 'PS5 rental', 'Extra cleaning'].map((t, i) => (
                  <span key={t} className={`rounded-md px-2.5 py-1 text-xs ${i === 0 ? 'bg-ink text-cream' : 'bg-paper text-muted'}`}>{t}</span>
                ))}
              </div>
              <h3 className="mt-5 flex items-center gap-2 font-medium"><ConciergeBell size={16} /> Add-ons from your host</h3>
              <p className="mt-1.5 text-sm text-muted">Pickups, chefs and extras, booked and paid for with your stay.</p>
            </div>

            {/* Verified */}
            <div className="card card-pad">
              <div className="inset flex items-center gap-3 p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-lime"><BadgeCheck size={16} /></span>
                <div className="text-xs">
                  <p className="font-medium text-ink">Identity verified</p>
                  <p className="font-mono text-faint">NIN · Passport · Voter’s card</p>
                </div>
              </div>
              <h3 className="mt-5 flex items-center gap-2 font-medium"><ShieldCheck size={16} /> Verified hosts</h3>
              <p className="mt-1.5 text-sm text-muted">Hosts who pass an ID check get a Verified badge on every listing.</p>
            </div>

            {/* Real-time */}
            <div className="card card-pad">
              <div className="inset flex items-center justify-between p-5 text-xs">
                <span className="flex items-center gap-2 text-ink"><Bell size={14} /> Booking accepted</span>
                <span className="h-2 w-2 rounded-full bg-lime-deep" />
              </div>
              <h3 className="mt-5 font-medium">Updates as they happen</h3>
              <p className="mt-1.5 text-sm text-muted">Get notified the moment a host accepts, with your check-in code in My Trips.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRUST (dark) ================= */}
      <section id="trust" className="bg-night text-cream">
        <div className="page section">
          <p className="eyebrow mb-4 text-lime">Payments & trust</p>
          <h2 className="h-section max-w-2xl text-cream">Your money is handled carefully, from checkout to check-out.</h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-cream/60">
            Card payments run through Paystack. Apartey never sees or stores your card details.
          </p>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              { icon: Lock, title: 'Caution fees in escrow', body: 'Refundable deposits are held by Apartey, not the host, and returned if no damage is reported.' },
              { icon: RotateCcw, title: 'Declined means refunded', body: 'If a host can’t take your dates, every payment on that booking is refunded to where it came from.' },
              { icon: CreditCard, title: 'Paystack checkout', body: 'Pay through Paystack’s secure checkout, by card, bank transfer and more.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon size={20} className="text-lime" />
                <h3 className="mt-4 font-medium text-cream">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOSTS ================= */}
      <section id="hosts" className="border-b border-line bg-paper">
        <div className="page section grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeader
              eyebrow="For hosts"
              title={<>List your place. <br />Get paid to your bank.</>}
              lead="Publish a listing in minutes, accept bookings you’re happy with, and withdraw your earnings whenever you like."
            />
            <Link to={hostCta} className="btn-ink btn-lg mt-8">
              {user?.role === 'host' ? 'Go to your dashboard' : 'Start hosting'} <ArrowRight size={16} />
            </Link>
          </div>
          <ul className="card divide-y divide-line">
            {[
              ['You approve every booking', 'Paid requests wait for you to accept or decline.'],
              ['Keep 100% of add-ons', 'Charge for pickups, chefs and extras, with no platform fee on them.'],
              ['Withdraw from ₦1,000', 'Send your wallet balance to any major Nigerian bank.'],
              ['Get verified', 'Pass an ID check to unlock unlimited listings and the Verified badge.'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-4 p-5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-lime"><Check size={12} /></span>
                <div>
                  <p className="text-[15px]">{t}</p>
                  <p className="mt-0.5 text-sm text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="page section grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <p className="eyebrow mb-4">FAQ</p>
          <h2 className="h-section">Questions, answered.</h2>
        </div>
        <div className="border-t border-line">
          {FAQS.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="bg-lime">
        <div className="page py-20 text-center md:py-24">
          <h2 className="display mx-auto max-w-2xl text-5xl md:text-6xl">Your next stay is a few taps away.</h2>
          <p className="mt-5 text-[15px] text-ink/70">Browse verified places, or list your own in minutes.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={scrollToListings} className="btn-ink btn-lg">Find a stay <ArrowRight size={16} /></button>
            <Link to={hostCta} className="btn btn-lg border border-ink/20 text-ink hover:bg-ink/5">List your place</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
