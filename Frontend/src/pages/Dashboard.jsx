import React, { useState, useEffect, useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Home as HomeIcon, ClipboardList, Wallet, ShieldCheck, Plus, Upload, Check, X, RefreshCw,
  ArrowRight, ArrowLeft, KeyRound, BadgeCheck, Clock, ImageOff, Lock, CalendarDays, Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { OverviewSkeleton, ListingCardsSkeleton, ListSkeleton, WalletSkeleton, Bone } from '../components/Skeletons';
import { EmptyState, StatusBadge, Modal, CautionChip } from '../components/ui';
import { naira, formatDay, formatDateTime, nightsBetween, initials, img } from '../utils/format';
import { invalidate } from '../utils/cache';
import HostCalendar from '../components/HostCalendar';

function PageHead({ eyebrow, title, lead, action }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="text-3xl font-light tracking-[-0.035em] md:text-4xl">{title}</h1>
        {lead && <p className="mt-2 text-sm text-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated } = useContext(AuthContext);
  
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('hostDashboardTab') || 'overview';
  });

  useEffect(() => {
    localStorage.setItem('hostDashboardTab', activeTab);
  }, [activeTab]);

  const [isAddingListing, setIsAddingListing] = useState(false);
  const [editingId, setEditingId] = useState(null);         // listing being edited (null = creating)
  const [existingImages, setExistingImages] = useState([]); // photos already on the listing being edited
  const [calendarPropertyId, setCalendarPropertyId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', type: 'Apartment', pricePerNight: '', cautionFee: '', city: '', state: '', area: ''
  });

  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [selectedRules, setSelectedRules] = useState([]);
  
  // ADD-ONS STATE
  const [addOns, setAddOns] = useState([]); 
  const [newAddOn, setNewAddOn] = useState({ name: '', description: '', price: '' });

  const availableAmenities = ["Starlink High-Speed WiFi", "24/7 Power (Gen + Inverter)", "24/7 Estate Security", "65\" Smart TV with Netflix", "Free secure parking", "Fully equipped kitchen", "Swimming Pool", "Gym Access"];
  const availableRules = ["Check-in: 2:00 PM - 10:00 PM", "Checkout before 11:00 AM", "No parties or events allowed.", "Smoking is strictly prohibited inside.", "No pets allowed."];

  const [wallet, setWallet] = useState({ balance: 0, pendingClearance: 0, transactions: [] });
  const [fetchingWallet, setFetchingWallet] = useState(false);

  const [hostProperties, setHostProperties] = useState([]);
  const [fetchingListings, setFetchingListings] = useState(false);

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawData, setWithdrawData] = useState({ amount: '', accountNumber: '', bankCode: '058' });
  const [banks, setBanks] = useState([]);
  const [accountName, setAccountName] = useState(null); // null = not looked up, '' = not found
  const [resolvingAccount, setResolvingAccount] = useState(false);

  // Caution fee claims
  const [claimFor, setClaimFor] = useState(null); // booking being claimed against
  const [claimData, setClaimData] = useState({ amount: '', reason: '' });
  const [cautionBusyId, setCautionBusyId] = useState(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [fetchingBookings, setFetchingBookings] = useState(false);

  const [overview, setOverview] = useState(null);
  const [fetchingOverview, setFetchingOverview] = useState(true);

  const [expandedBookingId, setExpandedBookingId] = useState(null);

  const parseAddOns = (addOnsData) => {
    if (!addOnsData) return [];
    if (Array.isArray(addOnsData)) return addOnsData;
    try { return JSON.parse(addOnsData); } catch (e) { return []; }
  };

  const [verificationData, setVerificationData] = useState({ status: 'Unverified', documentUrl: null });
  const [fetchingVerification, setFetchingVerification] = useState(false);
  const [kycFile, setKycFile] = useState(null);
  const [kycDocType, setKycDocType] = useState('NIN');
  const [kycAcceptedTerms, setKycAcceptedTerms] = useState(false);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    if (activeTab === 'overview') {
      const fetchOverview = async () => {
        setFetchingOverview(true);
        try {
          const response = await api.get('/HostAnalytics/overview');
          setOverview(response.data);
        } catch (error) {
          console.error("Failed to load dashboard analytics.");
        } finally {
          setFetchingOverview(false);
        }
      };
      fetchOverview();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'earnings') {
      const fetchWallet = async () => {
        setFetchingWallet(true);
        try {
          const response = await api.get('/Wallet');
          setWallet(response.data);
        } catch (error) {
          toast.error("Failed to load wallet data.");
        } finally {
          setFetchingWallet(false);
        }
      };
      fetchWallet();
    }
  }, [activeTab]);

  useEffect(() => {
    if ((activeTab === 'listings' && !isAddingListing)) {
      const fetchListings = async () => {
        setFetchingListings(true);
        try {
          const response = await api.get('/Properties/host');
          setHostProperties(response.data);
        } catch (error) {
          toast.error("Failed to load your properties.");
        } finally {
          setFetchingListings(false);
        }
      };
      fetchListings();
    }
  }, [activeTab, isAddingListing]);

  useEffect(() => {
    if (activeTab === 'bookings') {
      const fetchBookings = async () => {
        setFetchingBookings(true);
        try {
          const response = await api.get('/HostBookings');
          setBookings(response.data);
        } catch (error) {
          toast.error("Failed to load your bookings.");
        } finally {
          setFetchingBookings(false);
        }
      };
      fetchBookings();
    }
  }, [activeTab]);

  // Verification status is needed on every tab (listing limit, verified badge), so it loads on every tab change.
  useEffect(() => {
    const fetchVerification = async () => {
      setFetchingVerification(true);
      try {
        const response = await api.get('/Verification/status');
        setVerificationData(response.data);
      } catch (error) {
        setVerificationData({ status: 'Unverified' });
      } finally {
        setFetchingVerification(false);
      }
    };
    fetchVerification();
  }, [activeTab]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'host') return <Navigate to="/" replace />;

  // --- HANDLERS ---
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // Add-On List Handlers
  const handleAddAddOn = () => {
    if (!newAddOn.name || !newAddOn.price) {
      return toast.error("Please enter a name and price for the Add-on.");
    }
    setAddOns([...addOns, { id: Date.now().toString(), name: newAddOn.name, description: newAddOn.description, price: Number(newAddOn.price) }]);
    setNewAddOn({ name: '', description: '', price: '' });
  };

  const removeAddOn = (id) => {
    setAddOns(addOns.filter(a => a.id !== id));
  };

  const resetListingForm = () => {
    setFormData({ title: '', description: '', type: 'Apartment', pricePerNight: '', cautionFee: '', city: '', state: '', area: '' });
    setSelectedImages([]); setSelectedAmenities([]); setSelectedRules([]); setAddOns([]); setNewAddOn({ name: '', description: '', price: '' });
    setEditingId(null); setExistingImages([]);
  };

  const closeListingForm = () => { resetListingForm(); setIsAddingListing(false); };

  // Open the listing form pre-filled with an existing listing.
  const startEdit = (p) => {
    setFormData({
      title: p.title || '', description: p.description || '', type: p.type || 'Apartment',
      pricePerNight: p.pricePerNight ?? '', cautionFee: p.cautionFee || '', city: p.city || '', state: p.state || '', area: p.area || '',
    });
    setSelectedAmenities(p.amenities || []);
    setSelectedRules(p.houseRules || []);
    setAddOns((p.addOns || []).map((a) => ({ id: a.id, name: a.name, description: a.description, price: a.price })));
    setExistingImages(p.imageUrls || []);
    setSelectedImages([]);
    setEditingId(p.id);
    setIsAddingListing(true);
    window.scrollTo({ top: 0 });
  };

  const handleDeleteListing = async (p) => {
    if (!window.confirm(`Delete “${p.title}”? Guests won't be able to find or book it any more. Past bookings stay in your history.`)) return;
    try {
      const res = await api.delete(`/Properties/${p.id}`);
      toast.success(res.data?.message || 'Listing deleted.');
      setHostProperties((list) => list.filter((x) => x.id !== p.id));
      invalidate('/Properties');
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't delete this listing."));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedImages.length + existingImages.length === 0) return toast.error("Please add at least one photo.");
    if (selectedImages.length + existingImages.length > 5) return toast.error("A listing can have up to 5 photos.");

    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('type', formData.type);
      submitData.append('pricePerNight', formData.pricePerNight);
      submitData.append('cautionFee', formData.cautionFee || 0);
      submitData.append('city', formData.city);
      submitData.append('state', formData.state);
      submitData.append('area', formData.area);
      
      submitData.append('amenities', selectedAmenities.join(','));
      submitData.append('houseRules', selectedRules.join(',')); // Added rules to submit
      
      submitData.append('AddOnsJson', JSON.stringify(addOns));

      selectedImages.forEach(image => submitData.append('images', image));

      if (editingId) {
        submitData.append('KeepImageUrlsJson', JSON.stringify(existingImages));
        await api.put(`/Properties/${editingId}`, submitData);
        toast.success('Listing updated.');
      } else {
        await api.post('/Properties', submitData);
        toast.success('Property listed successfully!');
      }
      invalidate('/Properties'); // so changes show on the home page straight away

      closeListingForm();
      if (activeTab === 'listings') { setActiveTab('overview'); setTimeout(() => setActiveTab('listings'), 100); }
    } catch (error) {
      toast.error(errorMessage(error, editingId ? 'Failed to save changes.' : 'Failed to list property.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBooking = async (id) => {
    try {
      await api.post(`/HostBookings/${id}/accept`);
      toast.success("Booking confirmed! Check-in code generated.");
      setActiveTab('overview'); setTimeout(() => setActiveTab('bookings'), 100);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to accept booking."));
    }
  };

  const handleRejectBooking = async (id) => {
    try {
      if (!window.confirm("Reject this booking? Any payment will be refunded to the guest.")) return;
      const response = await api.post(`/HostBookings/${id}/reject`);
      toast.success(response.data?.message || "Booking rejected.");
      setActiveTab('overview'); setTimeout(() => setActiveTab('bookings'), 100);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to reject booking."));
    }
  };

  const handleRefreshBookings = async () => {
    setFetchingBookings(true);
    try {
      const response = await api.get('/HostBookings');
      setBookings(response.data);
      toast.success("Bookings synced successfully!");
    } catch (error) {
      toast.error("Failed to sync bookings.");
    } finally {
      setFetchingBookings(false);
    }
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    if (!kycFile) return toast.error("Please select a document to upload.");
    if (!kycAcceptedTerms) return toast.error("You must accept the Premium Host Terms & Conditions.");

    setUploadingKyc(true);
    try {
      const kycFormData = new FormData();
      kycFormData.append('document', kycFile);
      kycFormData.append('documentType', kycDocType);
      
      const response = await api.post('/Verification/upload', kycFormData);
      toast.success(response.data?.message || "Verification request submitted! Our team is reviewing it.");
      setVerificationData({ status: response.data?.status || 'Pending', documentUrl: response.data?.documentUrl || null });
      setKycFile(null);
    } catch (error) {
      toast.error(errorMessage(error, "Upload failed. Please try again."));
    } finally {
      setUploadingKyc(false);
    }
  };

  const refreshWallet = async () => {
    try {
      const walletRes = await api.get('/Wallet');
      setWallet(walletRes.data);
    } catch { /* keep showing the last known wallet */ }
  };

  // Bank list comes from Paystack (via the API) so bank codes are always current.
  const openWithdrawModal = async () => {
    setIsWithdrawModalOpen(true);
    if (banks.length > 0) return;
    try {
      const res = await api.get('/Wallet/banks');
      setBanks(res.data);
      if (!res.data.some((b) => b.code === withdrawData.bankCode) && res.data.length) {
        setWithdrawData((d) => ({ ...d, bankCode: res.data[0].code }));
      }
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't load the bank list."));
    }
  };

  // Look up the account holder's name once we have 10 digits and a bank.
  const resolveAccount = async (accountNumber, bankCode) => {
    setAccountName(null);
    if (!/^\d{10}$/.test(accountNumber) || !bankCode) return;
    setResolvingAccount(true);
    try {
      const res = await api.get('/Wallet/resolve-account', { params: { accountNumber, bankCode } });
      setAccountName(res.data.accountName);
    } catch (error) {
      setAccountName('');
      toast.error(errorMessage(error, "We couldn't verify that account."));
    } finally {
      setResolvingAccount(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = Number(withdrawData.amount);
    if (!amount || amount < 1000) return toast.error("Minimum withdrawal is ₦1,000.");
    if (amount > wallet.balance) return toast.error("That's more than your available balance.");
    if (!/^\d{10}$/.test(withdrawData.accountNumber)) return toast.error("Account number must be 10 digits.");
    if (!accountName) return toast.error("Wait for the account name to appear before confirming.");

    setIsWithdrawing(true);
    try {
      const response = await api.post('/Wallet/withdraw', { ...withdrawData, amount });
      toast.success(response.data?.message || "Withdrawal submitted.");
      setIsWithdrawModalOpen(false);
      setWithdrawData({ amount: '', accountNumber: '', bankCode: withdrawData.bankCode });
      setAccountName(null);
    } catch (error) {
      toast.error(errorMessage(error, "Withdrawal failed."));
    } finally {
      setIsWithdrawing(false);
      refreshWallet();
    }
  };

  // --- CAUTION FEE (deposit) ---
  const releaseCaution = async (booking) => {
    if (!window.confirm(`Return the full ₦${Number(booking.cautionFee).toLocaleString()} caution fee to ${booking.guestName || 'the guest'}?`)) return;
    setCautionBusyId(booking.id);
    try {
      const res = await api.post(`/HostBookings/${booking.id}/caution/release`);
      toast.success(res.data?.message || 'Caution fee returned.');
      handleRefreshBookings();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't return the caution fee."));
    } finally {
      setCautionBusyId(null);
    }
  };

  const submitCautionClaim = async (e) => {
    e.preventDefault();
    const booking = claimFor;
    const amount = Number(claimData.amount);
    if (!amount || amount <= 0) return toast.error('Enter the amount you’re keeping.');
    if (amount > booking.cautionFee) return toast.error(`You can keep at most ₦${Number(booking.cautionFee).toLocaleString()}.`);
    if (claimData.reason.trim().length < 10) return toast.error('Describe the damage in a few words (at least 10 characters).');

    setCautionBusyId(booking.id);
    try {
      const res = await api.post(`/HostBookings/${booking.id}/caution/claim`, { amount, reason: claimData.reason.trim() });
      toast.success(res.data?.message || 'Claim saved.');
      setClaimFor(null);
      handleRefreshBookings();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save the claim."));
    } finally {
      setCautionBusyId(null);
    }
  };

  // --- NAVIGATION ---
  const sidebarLinks = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'listings', icon: HomeIcon, label: 'Listings' },
    { id: 'bookings', icon: ClipboardList, label: 'Bookings' },
    { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
    { id: 'earnings', icon: Wallet, label: 'Earnings' },
    { id: 'verification', icon: ShieldCheck, label: 'Verification' },
  ];
  // An old saved tab (e.g. the removed "settings") falls back to the overview.
  const tab = sidebarLinks.some((l) => l.id === activeTab) ? activeTab : 'overview';
  const isVerified = verificationData.status === 'Verified';
  const listingLimitReached = hostProperties.length >= 2 && !isVerified;

  // What the host actually receives: room rate (total minus the 5% fee, caution fee and add-ons) plus add-ons.
  const hostPayout = (b) => {
    const addOnsTotal = parseAddOns(b.addOns).reduce((s, a) => s + Number(a.price || 0), 0);
    const roomWithFee = b.totalPrice - (b.cautionFee || 0) - addOnsTotal;
    return roomWithFee / 1.05 + addOnsTotal;
  };

  const startNewListing = () => {
    if (listingLimitReached) {
      toast.error('Standard hosts can list 2 properties. Verify your ID to unlock unlimited listings.');
      setActiveTab('verification');
    } else {
      resetListingForm();
      setIsAddingListing(true);
      setActiveTab('listings');
    }
  };


  // --- TAB RENDERERS ---
  const renderOverview = () => {
    if (fetchingOverview || !overview) return <OverviewSkeleton />;
    const stats = [
      { label: 'Available balance', value: naira(overview.availableBalance), hint: 'Ready to withdraw' },
      { label: 'Earned this month', value: naira(overview.earningsThisMonth), hint: 'Credited to your wallet' },
      { label: 'Upcoming stays', value: overview.upcomingBookingsCount ?? 0, hint: 'Confirmed bookings' },
      { label: 'Occupied today', value: `${overview.occupancyRate ?? 0}%`, hint: 'Of your listings' },
    ];
    return (
      <div className="animate-fade-in">
        <PageHead
          eyebrow="Overview"
          title={<>Welcome back, {user?.name?.split(' ')[0]}</>}
          lead="Here’s what’s happening across your listings."
          action={<button onClick={startNewListing} className="btn-lime"><Plus size={16} /> New listing</button>}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">{s.label}</p>
              <p className="mono mt-3 text-2xl">{s.value}</p>
              <p className="mt-1 text-xs text-muted">{s.hint}</p>
            </div>
          ))}
        </div>

        {!isVerified && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-lime p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{verificationData.status === 'Pending' ? 'Your ID is being reviewed' : 'Get the Verified badge'}</p>
              <p className="text-xs text-ink/70">
                {verificationData.status === 'Pending' ? 'This usually takes 24–48 hours.' : 'Verified hosts get unlimited listings and a badge guests can see.'}
              </p>
            </div>
            {verificationData.status !== 'Pending' && (
              <button onClick={() => setActiveTab('verification')} className="btn-ink btn-sm">Verify now <ArrowRight size={14} /></button>
            )}
          </div>
        )}

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">Recent requests</p>
            <button onClick={() => setActiveTab('bookings')} className="btn-ghost btn-sm">All bookings <ArrowRight size={14} /></button>
          </div>
          {overview.recentRequests?.length ? (
            <ul className="card divide-y divide-line">
              {overview.recentRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand font-mono text-xs">{r.guestInitials || initials(r.guestName)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.guestName} · <span className="font-normal text-muted">{r.propertyTitle}</span></p>
                      <p className="font-mono text-[11px] text-faint">{formatDay(r.checkIn)} → {formatDay(r.checkOut)}</p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardList} title="No booking requests yet">Requests from guests will show up here.</EmptyState>
          )}
        </div>
      </div>
    );
  };

  const renderListingForm = () => (
    <div className="animate-fade-in">
      <button onClick={closeListingForm} className="btn-ghost btn-sm -ml-3 mb-4"><ArrowLeft size={14} /> Back to listings</button>
      <PageHead eyebrow={editingId ? "Edit listing" : "New listing"} title={editingId ? (formData.title || "Edit listing") : "List a place"} lead={editingId ? "Changes apply to new bookings. Existing bookings keep the price they paid." : "Fill in the details guests need. You can list up to 5 photos."} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="card card-pad">
          <p className="eyebrow mb-5">01 · The basics</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label" htmlFor="title">Title</label>
              <input id="title" required name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. Bright 2-bed apartment with pool" className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="description">Description</label>
              <textarea id="description" required name="description" rows="4" value={formData.description} onChange={handleInputChange} placeholder="The layout, the vibe, what’s nearby…" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="type">Property type</label>
              <select id="type" name="type" value={formData.type} onChange={handleInputChange} className="input">
                {['Apartment', 'Penthouse', 'Duplex', 'Studio'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pricePerNight">Price per night (₦)</label>
              <input id="pricePerNight" required min="1" type="number" name="pricePerNight" value={formData.pricePerNight} onChange={handleInputChange} placeholder="85000" className="input mono" />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="cautionFee">Refundable caution fee (₦) <span className="font-normal text-faint">optional</span></label>
              <input id="cautionFee" min="0" type="number" name="cautionFee" value={formData.cautionFee} onChange={handleInputChange} placeholder="50000" className="input mono md:w-1/2" />
              <p className="hint">Charged to the guest and held in Apartey escrow, then refunded if nothing is damaged.</p>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <p className="eyebrow mb-5">02 · Location</p>
          <div className="grid gap-4 md:grid-cols-3">
            {[['state', 'State', 'Lagos'], ['city', 'City', 'Lekki'], ['area', 'Area / estate', 'Phase 1']].map(([name, label, ph]) => (
              <div key={name}>
                <label className="label" htmlFor={name}>{label}</label>
                <input id={name} required name={name} value={formData[name]} onChange={handleInputChange} placeholder={ph} className="input" />
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <p className="eyebrow mb-5">03 · Amenities & house rules</p>
          <div className="grid gap-8 md:grid-cols-2">
            {[
              ['Amenities', availableAmenities, selectedAmenities, setSelectedAmenities],
              ['House rules', availableRules, selectedRules, setSelectedRules],
            ].map(([title, options, selected, setSelected]) => (
              <div key={title}>
                <p className="mb-3 text-sm font-medium">{title}</p>
                <div className="flex flex-wrap gap-2">
                  {options.map((opt) => {
                    const on = selected.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        aria-pressed={on}
                        onClick={() => setSelected(on ? selected.filter((x) => x !== opt) : [...selected, opt])}
                        className={`rounded-lg border px-3 py-1.5 text-left text-[13px] transition-colors ${on ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-muted hover:text-ink'}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <p className="eyebrow mb-2">04 · Add-ons</p>
          <p className="mb-5 text-sm text-muted">Optional extras guests can book with their stay, like an airport pickup or a private chef. You keep 100%.</p>
          <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_0.8fr_auto]">
            <input placeholder="Name" value={newAddOn.name} onChange={(e) => setNewAddOn({ ...newAddOn, name: e.target.value })} className="input" />
            <input placeholder="Short description" value={newAddOn.description} onChange={(e) => setNewAddOn({ ...newAddOn, description: e.target.value })} className="input" />
            <input type="number" min="0" placeholder="₦ price" value={newAddOn.price} onChange={(e) => setNewAddOn({ ...newAddOn, price: e.target.value })} className="input mono" />
            <button type="button" onClick={handleAddAddOn} className="btn-outline"><Plus size={14} /> Add</button>
          </div>
          {addOns.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {addOns.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm">{a.name} <span className="mono ml-2 text-muted">{naira(a.price)}</span></p>
                    {a.description && <p className="truncate text-xs text-faint">{a.description}</p>}
                  </div>
                  <button type="button" onClick={() => removeAddOn(a.id)} className="btn-ghost btn-sm" aria-label={`Remove ${a.name}`}><X size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-pad">
          <p className="eyebrow mb-5">05 · Photos</p>
          {existingImages.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs text-muted">Current photos. The first one is the cover; tap × to remove.</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {existingImages.map((url, i) => (
                  <div key={url} className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-sand">
                    <img src={img(url, 240)} alt="" className="h-full w-full object-cover" />
                    {i === 0 && <span className="chip-lime absolute bottom-1 left-1">Cover</span>}
                    <button type="button" onClick={() => setExistingImages((list) => list.filter((u) => u !== url))}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-cream" aria-label="Remove photo">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <input type="file" multiple accept="image/*" onChange={(e) => setSelectedImages(Array.from(e.target.files).slice(0, Math.max(0, 5 - existingImages.length)))} className="sr-only" id="property-images" />
          <label htmlFor="property-images" className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-line bg-cream px-6 py-10 text-center transition-colors hover:bg-sand/60">
            <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-paper"><Upload size={18} /></span>
            <span className="text-sm font-medium">{selectedImages.length > 0 ? `${selectedImages.length} photo${selectedImages.length > 1 ? 's' : ''} selected` : 'Choose photos'}</span>
            <span className="mt-1 text-xs text-faint">JPG or PNG, up to 10 MB each · max 5</span>
          </label>
          {selectedImages.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {selectedImages.map((f) => (
                <img key={f.name + f.size} src={URL.createObjectURL(f)} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2 pb-6">
          <button type="button" onClick={closeListingForm} className="btn-ghost btn-lg">Cancel</button>
          <button type="submit" disabled={loading} className="btn-ink btn-lg">
            {loading ? <><RefreshCw size={16} className="animate-spin" /> {editingId ? "Saving…" : "Publishing…"}</> : <><Check size={16} /> {editingId ? "Save changes" : "Publish listing"}</>}
          </button>
        </div>
      </form>
    </div>
  );

  const renderListings = () => {
    if (isAddingListing) return renderListingForm();
    return (
      <div className="animate-fade-in">
        <PageHead
          eyebrow="Listings"
          title="Your places"
          lead={`${hostProperties.length} of ${isVerified ? 'unlimited' : '2'} listings used`}
          action={<button onClick={startNewListing} className="btn-lime"><Plus size={16} /> New listing</button>}
        />
        {fetchingListings ? (
          <ListingCardsSkeleton count={3} />
        ) : hostProperties.length === 0 ? (
          <EmptyState icon={HomeIcon} title="No listings yet" action={<button onClick={startNewListing} className="btn-ink">Create your first listing</button>}>
            Add photos, a nightly price and the amenities guests care about, like 24/7 power and estate security.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {hostProperties.map((p) => (
              <div key={p.id} className="card flex flex-col overflow-hidden">
                <Link to={`/property/${p.id}`} className="group block">
                  <div className="aspect-[16/10] bg-sand">
                    {p.imageUrls?.length > 0
                      ? <img src={img(p.imageUrls[0], 480)} alt={p.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      : <div className="grid h-full place-items-center text-faint"><ImageOff size={18} /></div>}
                  </div>
                  <div className="p-4 pb-3">
                    <p className="truncate font-medium group-hover:underline group-hover:underline-offset-4">{p.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{[p.city, p.state].filter(Boolean).join(', ')}</p>
                    <p className="mt-3 flex items-center justify-between">
                      <span><span className="mono">{naira(p.pricePerNight)}</span><span className="text-xs text-faint"> / night</span></span>
                      {p.reviewCount > 0 && <span className="text-xs text-muted">★ {Number(p.rating).toFixed(1)} ({p.reviewCount})</span>}
                    </p>
                  </div>
                </Link>
                <div className="mt-auto flex gap-1 border-t border-line p-2">
                  <button onClick={() => startEdit(p)} className="btn-ghost btn-sm flex-1"><Pencil size={13} /> Edit</button>
                  <button onClick={() => { setCalendarPropertyId(p.id); setActiveTab('calendar'); }} className="btn-ghost btn-sm flex-1"><CalendarDays size={13} /> Calendar</button>
                  <button onClick={() => handleDeleteListing(p)} className="btn-ghost btn-sm text-red-700 hover:bg-red-50" aria-label={`Delete ${p.title}`}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBookings = () => (
    <div className="animate-fade-in">
      <PageHead
        eyebrow="Bookings"
        title="Requests & stays"
        lead="Accept paid requests to send guests their check-in code."
        action={
          <button onClick={handleRefreshBookings} disabled={fetchingBookings} className="btn-outline btn-sm">
            <RefreshCw size={14} className={fetchingBookings ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />
      {fetchingBookings ? (
        <ListSkeleton rows={3} label="Loading bookings" />
      ) : bookings.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No bookings yet">When guests book one of your places, it’ll appear here.</EmptyState>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isExpanded = expandedBookingId === booking.id;
            const bookingAddOns = parseAddOns(booking.addOns);
            return (
              <div key={booking.id} className="card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={booking.status} />
                      <span className="font-mono text-[11px] text-faint">{formatDay(booking.checkIn)} → {formatDay(booking.checkOut)}</span>
                    </div>
                    <p className="truncate font-medium">{booking.propertyTitle}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {booking.guestName || 'Guest'} · your payout <span className="mono text-ink">{naira(hostPayout(booking))}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)} className="btn-ghost btn-sm">
                      {isExpanded ? 'Hide details' : 'Details'}
                    </button>
                    {(booking.status === 'paid' || booking.status === 'split_pending') && (
                      <button onClick={() => handleRejectBooking(booking.id)} className="btn-danger btn-sm">Decline</button>
                    )}
                    {booking.status === 'paid' && (
                      <button onClick={() => handleAcceptBooking(booking.id)} className="btn-ink btn-sm"><Check size={14} /> Accept</button>
                    )}
                  </div>
                </div>

                {booking.status === 'confirmed' && booking.checkInCode && (
                  <div className="mt-4 inline-flex items-center gap-3 rounded-lg bg-ink px-3 py-2 text-cream">
                    <KeyRound size={14} className="text-lime" />
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream/70">Check-in code</span>
                    <span className="mono tracking-[0.2em] text-lime">{booking.checkInCode}</span>
                  </div>
                )}

                {booking.cautionFee > 0 && booking.cautionFeeStatus !== 'Pending' && booking.cautionFeeStatus !== 'None' && (
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <p className="flex items-center gap-2">
                        <Lock size={14} className="text-muted" />
                        Caution fee <span className="mono">{naira(booking.cautionFee)}</span>
                        <CautionChip status={booking.cautionFeeStatus} />
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {booking.cautionFeeStatus === 'Held' && booking.canResolveCaution &&
                          <>Return it, or keep part of it for damage, before <span className="mono text-ink">{formatDateTime(booking.cautionDeadline)}</span>. After that it goes back to the guest automatically.</>}
                        {booking.cautionFeeStatus === 'Held' && !booking.canResolveCaution &&
                          'Held in escrow. You can return or claim it from the check-out day.'}
                        {booking.cautionFeeStatus === 'Releasing' && 'Being returned to the guest.'}
                        {booking.cautionFeeStatus === 'Refunded' && 'Returned to the guest.'}
                        {(booking.cautionFeeStatus === 'Claimed' || booking.cautionFeeStatus === 'PartlyClaimed') &&
                          <>You kept <span className="mono text-ink">{naira(booking.cautionClaimAmount)}</span>: {booking.cautionClaimReason}</>}
                      </p>
                    </div>
                    {booking.cautionFeeStatus === 'Held' && booking.canResolveCaution && (
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => { setClaimData({ amount: '', reason: '' }); setClaimFor(booking); }} disabled={cautionBusyId === booking.id} className="btn-outline btn-sm">
                          Keep some
                        </button>
                        <button onClick={() => releaseCaution(booking)} disabled={cautionBusyId === booking.id} className="btn-ink btn-sm">
                          <Check size={14} /> Return all
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-5 grid gap-3 border-t border-line pt-5 md:grid-cols-2 animate-fade-in">
                    <div className="inset p-4 text-sm">
                      <p className="eyebrow mb-3 text-faint">Guest</p>
                      <p className="font-medium">{booking.guestName || 'Guest'}</p>
                      {booking.guestPhone && <p className="mono mt-1 text-muted">{booking.guestPhone}</p>}
                      <p className="mt-1 text-muted">{nightsBetween(booking.checkIn, booking.checkOut)} nights · guest paid <span className="mono text-ink">{naira(booking.totalPrice)}</span></p>
                    </div>
                    <div className="inset p-4 text-sm">
                      <p className="eyebrow mb-3 text-faint">Add-ons</p>
                      {bookingAddOns.length > 0 ? (
                        <ul className="space-y-1.5">
                          {bookingAddOns.map((a, idx) => (
                            <li key={a.id ?? idx} className="flex justify-between"><span>{a.name || a.title}</span><span className="mono">{naira(a.price)}</span></li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted">No add-ons on this booking.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!claimFor} onClose={() => setClaimFor(null)} title="Keep part of the caution fee">
        {claimFor && (
          <form onSubmit={submitCautionClaim} className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-light tracking-[-0.02em]">Keep part of the caution fee</h3>
              <button type="button" onClick={() => setClaimFor(null)} className="btn-ghost btn-sm -mr-2" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="inset flex justify-between px-4 py-3 text-sm">
              <span className="text-muted">Held for {claimFor.guestName || 'the guest'}</span>
              <span className="mono">{naira(claimFor.cautionFee)}</span>
            </div>
            <div>
              <label className="label" htmlFor="claim-amount">Amount to keep (₦)</label>
              <input id="claim-amount" type="number" min="1" max={claimFor.cautionFee} step="1" required autoFocus value={claimData.amount}
                onChange={(e) => setClaimData({ ...claimData, amount: e.target.value })} className="input mono" />
              {Number(claimData.amount) > 0 && Number(claimData.amount) <= claimFor.cautionFee && (
                <p className="hint">The guest gets back <span className="mono text-ink">{naira(claimFor.cautionFee - Number(claimData.amount))}</span>.</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="claim-reason">What was damaged?</label>
              <textarea id="claim-reason" rows="3" required minLength={10} maxLength={500} value={claimData.reason}
                onChange={(e) => setClaimData({ ...claimData, reason: e.target.value })} className="input"
                placeholder="e.g. Broken glass coffee table in the living room" />
              <p className="hint">The guest sees this reason in their email.</p>
            </div>
            <button type="submit" disabled={cautionBusyId === claimFor.id} className="btn-ink btn-lg w-full">
              {cautionBusyId === claimFor.id ? 'Saving…' : 'Keep this amount'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );

  const renderEarnings = () => (
    <div className="animate-fade-in">
      <PageHead eyebrow="Earnings" title="Wallet & payouts" lead="Withdraw your balance to any major Nigerian bank." />
      {fetchingWallet && <WalletSkeleton />}
      <div className={`grid gap-4 lg:grid-cols-[1fr_1.3fr] ${fetchingWallet ? 'hidden' : ''}`}>
        <div className="flex flex-col justify-between rounded-2xl bg-night p-6 text-cream">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream/60">Available balance</p>
            <p className="mono mt-3 text-4xl">{fetchingWallet ? '—' : naira(wallet.balance)}</p>
          </div>
          <div className="mt-10">
            <button onClick={openWithdrawModal} disabled={fetchingWallet || wallet.balance < 1000} className="btn-lime btn-lg w-full">
              Withdraw funds <ArrowRight size={16} />
            </button>
            <p className="mt-2 text-center text-xs text-cream/50">
              {wallet.pendingWithdrawals > 0
                ? <><span className="mono text-cream/80">{naira(wallet.pendingWithdrawals)}</span> on its way to your bank</>
                : 'Minimum withdrawal ₦1,000'}
            </p>
          </div>
        </div>

        <div className="card card-pad">
          <p className="eyebrow mb-4">Recent transactions</p>
          {(wallet.transactions || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No transactions yet. Earnings appear here when guests pay.</p>
          ) : (
            <ul className="divide-y divide-line">
              {wallet.transactions.map((t) => {
                const incoming = t.type === 'Credit' || t.type === 'Reversal';
                return (
                  <li key={t.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{t.description}</p>
                      <p className="flex items-center gap-2 font-mono text-[11px] text-faint">
                        {formatDay(t.date)} · {t.type}
                        {t.status === 'Pending' && <span className="chip-amber">Processing</span>}
                        {t.status === 'Failed' && <span className="chip-red">Failed · returned</span>}
                      </p>
                    </div>
                    <span className={`mono shrink-0 ${incoming ? 'text-emerald-700' : 'text-ink'} ${t.status === 'Failed' ? 'line-through opacity-50' : ''}`}>
                      {incoming ? '+' : '−'}{naira(t.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Modal open={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Withdraw">
        <form onSubmit={handleWithdraw} className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-light tracking-[-0.02em]">Withdraw to your bank</h3>
            <button type="button" onClick={() => setIsWithdrawModalOpen(false)} className="btn-ghost btn-sm -mr-2" aria-label="Close"><X size={16} /></button>
          </div>
          <div className="inset flex justify-between px-4 py-3 text-sm"><span className="text-muted">Available</span><span className="mono">{naira(wallet.balance)}</span></div>
          <div>
            <label className="label" htmlFor="wd-amount">Amount (₦)</label>
            <input id="wd-amount" type="number" min="1000" max={wallet.balance} step="1" required value={withdrawData.amount}
              onChange={(e) => setWithdrawData({ ...withdrawData, amount: e.target.value })} className="input mono" />
          </div>
          <div>
            <label className="label" htmlFor="wd-bank">Bank</label>
            <select id="wd-bank" value={withdrawData.bankCode} disabled={banks.length === 0}
              onChange={(e) => {
                const bankCode = e.target.value;
                setWithdrawData({ ...withdrawData, bankCode });
                resolveAccount(withdrawData.accountNumber, bankCode);
              }}
              className="input">
              {banks.length === 0 && <option>Loading banks…</option>}
              {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="wd-acct">Account number</label>
            <input id="wd-acct" type="text" inputMode="numeric" pattern="\d{10}" maxLength={10} required value={withdrawData.accountNumber}
              onChange={(e) => {
                const accountNumber = e.target.value.replace(/\D/g, '');
                setWithdrawData({ ...withdrawData, accountNumber });
                resolveAccount(accountNumber, withdrawData.bankCode);
              }}
              className="input mono tracking-wider" placeholder="0123456789" />
            <p className="hint min-h-[1.25rem]">
              {resolvingAccount && 'Checking account…'}
              {!resolvingAccount && accountName && <span className="flex items-center gap-1.5 text-ink"><BadgeCheck size={13} className="text-lime-deep" /> {accountName}</span>}
              {!resolvingAccount && accountName === '' && <span className="text-red-700">Account not found. Check the number and bank.</span>}
            </p>
          </div>
          <button type="submit" disabled={isWithdrawing || !accountName} className="btn-ink btn-lg w-full">
            {isWithdrawing ? 'Processing…' : accountName ? `Send to ${accountName.split(' ')[0]}` : 'Confirm withdrawal'}
          </button>
          <p className="text-center text-xs text-faint">Bank transfers usually arrive within minutes. If one fails, the money comes back to your wallet.</p>
        </form>
      </Modal>
    </div>
  );

  const renderVerification = () => (
    <div className="max-w-2xl animate-fade-in">
      <PageHead eyebrow="Verification" title="Become a verified host" lead="Verified hosts get unlimited listings and a badge guests see on every listing." />
      {fetchingVerification && !verificationData.status ? (
        <div className="card space-y-4 p-6" aria-hidden="true"><Bone className="h-5 w-48" /><Bone className="h-4 w-full" /><Bone className="h-4 w-2/3" /></div>
      ) : isVerified ? (
        <div className="card flex items-center gap-4 p-6">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-lime"><BadgeCheck size={20} /></span>
          <div>
            <p className="font-medium">You’re verified</p>
            <p className="text-sm text-muted">Your listings show the Verified badge, and you can list as many places as you like.</p>
          </div>
        </div>
      ) : verificationData.status === 'Pending' ? (
        <div className="card flex items-center gap-4 p-6">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-100"><Clock size={20} className="text-amber-700" /></span>
          <div>
            <p className="font-medium">Review in progress</p>
            <p className="text-sm text-muted">We’re checking your document. This usually takes 24–48 hours.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleKycSubmit} className="card card-pad space-y-5">
          <ul className="inset space-y-2 p-4 text-sm">
            {['Unlimited listings (standard hosts can list 2)', 'Verified badge on your profile and listings', 'Standard 5% platform fee on bookings'].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check size={14} className="text-lime-deep" /> {t}</li>
            ))}
          </ul>
          <div>
            <label className="label" htmlFor="kyc-type">Document type</label>
            <select id="kyc-type" value={kycDocType} onChange={(e) => setKycDocType(e.target.value)} className="input">
              <option value="NIN">National Identity Number (NIN) slip</option>
              <option value="Passport">International passport</option>
              <option value="DriversLicense">Driver’s licence</option>
              <option value="VotersCard">Voter’s card</option>
            </select>
          </div>
          <div>
            <span className="label">Document</span>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setKycFile(e.target.files[0])} className="sr-only" id="kyc-upload" />
            <label htmlFor="kyc-upload" className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-line bg-cream px-6 py-8 text-center transition-colors hover:bg-sand/60">
              <Upload size={18} className="mb-2 text-muted" />
              <span className="text-sm font-medium">{kycFile ? kycFile.name : 'Choose a file'}</span>
              <span className="mt-1 text-xs text-faint">Photo or PDF, up to 10 MB</span>
            </label>
          </div>
          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" checked={kycAcceptedTerms} onChange={(e) => setKycAcceptedTerms(e.target.checked)} className="checkbox mt-0.5" />
            I confirm this document is genuine and belongs to me, and I agree to the 5% platform fee on bookings.
          </label>
          <button type="submit" disabled={!kycFile || !kycAcceptedTerms || uploadingKyc} className="btn-ink btn-lg w-full">
            {uploadingKyc ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div className="page grid min-h-[calc(100vh-4rem)] grid-cols-1 gap-8 py-6 md:grid-cols-[200px_1fr] md:py-10">
      {/* Sidebar (desktop) / tab strip (mobile) */}
      <aside className="md:sticky md:top-24 md:self-start">
        <p className="eyebrow mb-3 hidden text-faint md:block">Host</p>
        <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:px-0" aria-label="Dashboard">
          {sidebarLinks.map((link) => {
            const active = tab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => { setActiveTab(link.id); closeListingForm(); }}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${active ? 'bg-ink text-cream' : 'text-muted hover:bg-paper hover:text-ink'}`}
              >
                <link.icon size={15} className={active ? 'text-lime' : ''} />
                {link.label}
              </button>
            );
          })}
        </nav>
        {isVerified && (
          <p className="mt-6 hidden items-center gap-1.5 text-xs text-muted md:flex"><BadgeCheck size={14} className="text-lime-deep" /> Verified host</p>
        )}
      </aside>

      <section className="min-w-0">
        {tab === 'overview' && renderOverview()}
        {tab === 'listings' && renderListings()}
        {tab === 'bookings' && renderBookings()}
        {tab === 'earnings' && renderEarnings()}
        {tab === 'verification' && renderVerification()}
        {tab === 'calendar' && <HostCalendar initialPropertyId={calendarPropertyId} />}
      </section>
    </div>
  );
}
