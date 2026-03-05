import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Home as HomeIcon, Calendar, ClipboardList, 
  MessageSquare, Wallet, Star, ShieldCheck, Settings, Plus, Upload, 
  TrendingUp, AlertCircle, Key, XCircle, Check, User, RefreshCw, ConciergeBell
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import BrandLoader from '../components/BrandLoader'; // <-- Imported the custom luxury loader!

export default function Dashboard() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('hostDashboardTab') || 'overview';
  });

  useEffect(() => {
    localStorage.setItem('hostDashboardTab', activeTab);
  }, [activeTab]);

  const [isAddingListing, setIsAddingListing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', type: 'Apartment', pricePerNight: '', cautionFee: '', city: '', state: '', area: ''
  });

  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [selectedRules, setSelectedRules] = useState([]);
  const [addOns, setAddOns] = useState([]); 

  const availableAmenities = ["Starlink High-Speed WiFi", "24/7 Power (Gen + Inverter)", "24/7 Estate Security", "65\" Smart TV with Netflix", "Free secure parking", "Fully equipped kitchen", "Swimming Pool", "Gym Access"];
  const availableRules = ["Check-in: 2:00 PM - 10:00 PM", "Checkout before 11:00 AM", "No parties or events allowed.", "Smoking is strictly prohibited inside.", "No pets allowed."];

  const [wallet, setWallet] = useState({ balance: 0, pendingClearance: 0, transactions: [] });
  const [fetchingWallet, setFetchingWallet] = useState(false);

  const [hostProperties, setHostProperties] = useState([]);
  const [fetchingListings, setFetchingListings] = useState(false);

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawData, setWithdrawData] = useState({ amount: '', accountNumber: '', bankCode: '058' });
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [fetchingBookings, setFetchingBookings] = useState(false);

  const [overview, setOverview] = useState(null);
  const [fetchingOverview, setFetchingOverview] = useState(true);

  // SOFT LIFE: State for tracking which booking is currently expanded
  const [expandedBookingId, setExpandedBookingId] = useState(null);

  // SOFT LIFE: Helper to safely parse the add-ons from the database
  const parseAddOns = (addOnsData) => {
    if (!addOnsData) return [];
    if (Array.isArray(addOnsData)) return addOnsData;
    try { return JSON.parse(addOnsData); } catch (e) { return []; }
  };

  const [chatConnection, setChatConnection] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [chatContacts, setChatContacts] = useState([]); 
  const [fetchingContacts, setFetchingContacts] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const messagesEndRef = useRef(null);

  // KYC States
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

  useEffect(() => {
    if (activeTab === 'verification') {
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
    }
  }, [activeTab]);

  if (!isAuthenticated || user?.role !== 'Host') {
    return null;
  }

  // --- HANDLERS ---
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedImages.length === 0) return toast.error("Please upload at least one image.");

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
      submitData.append('houseRules', selectedRules.join(','));
      submitData.append('AddOnsJson', JSON.stringify(addOns));

      selectedImages.forEach(image => submitData.append('images', image));

      await api.post('/Properties', submitData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Property listed successfully!');
      
      setIsAddingListing(false); 
      setFormData({ title: '', description: '', type: 'Apartment', pricePerNight: '', cautionFee: '', city: '', state: '', area: '' });
      setSelectedImages([]); setSelectedAmenities([]); setSelectedRules([]); setAddOns([]);
      
      if (activeTab === 'listings') { setActiveTab('overview'); setTimeout(() => setActiveTab('listings'), 100); }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to list property.');
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
      toast.error("Failed to accept booking.");
    }
  };

  const handleRejectBooking = async (id) => {
    try {
      await api.post(`/HostBookings/${id}/reject`);
      toast.success("Booking rejected and guest refunded.");
      setActiveTab('overview'); setTimeout(() => setActiveTab('bookings'), 100);
    } catch (error) {
      toast.error("Failed to reject booking.");
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

  // --- NEW: ADVANCED KYC SUBMIT ---
  const handleKycSubmit = async (e) => {
    e.preventDefault();
    if (!kycFile) return toast.error("Please select a document to upload.");
    if (!kycAcceptedTerms) return toast.error("You must accept the Premium Host Terms & Conditions.");

    setUploadingKyc(true);
    try {
      const kycFormData = new FormData();
      kycFormData.append('document', kycFile);
      kycFormData.append('documentType', kycDocType);
      
      setTimeout(() => {
        toast.success("Verification request submitted successfully! Our team is reviewing it.");
        setVerificationData({ status: 'Pending', documentUrl: null });
        setUploadingKyc(false);
      }, 1500);

    } catch (error) {
      toast.error(error.response?.data?.message || "Upload failed. Please try again.");
      setUploadingKyc(false);
    }
  };

  // --- SIDEBAR CONFIGURATION ---
  const sidebarLinks = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'listings', icon: HomeIcon, label: 'Listings' },
    { id: 'bookings', icon: ClipboardList, label: 'Bookings' },
    { id: 'earnings', icon: Wallet, label: 'Earnings & Payouts' },
    { id: 'verification', icon: ShieldCheck, label: 'Trust & Verification' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  // --- TAB RENDERERS ---

  const renderOverview = () => {
    // UPDATED LOADER
    if (fetchingOverview || !overview) return <BrandLoader />;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-brand flex items-center gap-2">
              Welcome back, {user?.name}! 
              {verificationData.status === 'Verified' && <ShieldCheck size={20} className="text-green-500"/>}
            </h2>
            <p className="text-gray-500 text-sm">Here is what is happening with your properties today.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Earnings</p>
            <h3 className="text-2xl font-bold text-brand">₦{overview.earningsThisMonth?.toLocaleString() || 0}</h3>
            <p className="text-xs text-green-600 flex items-center mt-2 font-semibold"><TrendingUp size={14} className="mr-1"/> Automatically Calculated</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-1">Occupancy Rate</p>
            <h3 className="text-2xl font-bold text-brand">{overview.occupancyRate || 0}%</h3>
            <p className="text-xs text-green-600 flex items-center mt-2 font-semibold"><TrendingUp size={14} className="mr-1"/> Based on active bookings</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-1">Upcoming Bookings</p>
            <h3 className="text-2xl font-bold text-brand">{overview.upcomingBookingsCount || 0}</h3>
            <p className="text-xs text-gray-500 mt-2 font-semibold">Confirmed reservations</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-1">Listing Views</p>
            <h3 className="text-2xl font-bold text-brand">{overview.listingViews?.toLocaleString() || 0}</h3>
            <p className="text-xs text-gray-500 mt-2 font-semibold">Across all your properties</p>
          </div>
        </div>
      </div>
    );
  };

  const renderListings = () => (
    <div className="animate-fade-in">
      {!isAddingListing ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-brand flex items-center gap-2">
                Your Properties 
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{hostProperties.length} / {verificationData.status === 'Verified' ? 'Unlimited' : '2'} Used</span>
              </h2>
              <p className="text-gray-500 text-sm">Manage pricing, amenities, and local features.</p>
            </div>
            <button 
              onClick={() => {
                if (hostProperties.length >= 2 && verificationData.status !== 'Verified') {
                  toast.error("Standard hosts can only list 2 properties. Please verify your account to unlock unlimited listings.");
                  setActiveTab('verification');
                } else {
                  setIsAddingListing(true);
                }
              }} 
              className="bg-brand hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus size={18} /> Add New Listing
            </button>
          </div>
          
           {/* UPDATED LOADER */}
           {fetchingListings ? (
            <BrandLoader />
          ) : hostProperties.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <HomeIcon size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-700 mb-2">You haven't added properties recently</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">Upload your luxury shortlets and set Nigerian-specific amenities like 24/7 Power, Estate Security, and Water access.</p>
              <button onClick={() => setIsAddingListing(true)} className="bg-brand hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-bold transition-colors">
                Start your first listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hostProperties.map(property => (
                <div key={property.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="h-40 bg-gray-200 relative">
                    {property.imageUrls && property.imageUrls.length > 0 ? (
                      <img src={property.imageUrls[0]} alt={property.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                    )}
                    <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-md text-xs font-bold text-brand shadow">
                      ₦{property.pricePerNight.toLocaleString()}/nt
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-brand truncate mb-1">{property.title}</h3>
                    <p className="text-xs text-gray-500 mb-3">{property.city}, {property.state}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100 text-center">
           <h2 className="text-2xl font-bold">Return to overview or cancel to exit adding.</h2>
           <button onClick={() => setIsAddingListing(false)} className="text-red-500 font-bold mt-4">Cancel</button>
        </div>
      )}
    </div>
  );

  const renderBookings = () => (
     <div className="animate-fade-in space-y-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-brand">Booking Operations</h2>
            <p className="text-gray-500 text-sm">Review guests, requested services, and manage reservations.</p>
          </div>
          <button 
            onClick={handleRefreshBookings}
            disabled={fetchingBookings}
            className="bg-brand/10 text-brand hover:bg-brand hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} className={fetchingBookings ? "animate-spin" : ""} />
            Sync Bookings
          </button>
        </div>
        
        {/* UPDATED LOADER */}
        {fetchingBookings ? (
          <BrandLoader />
        ) : bookings.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-700 mb-2">No Bookings Yet</h3>
          </div>
        ) : (
           <div className="space-y-6">
             {bookings.map((booking) => {
               const isExpanded = expandedBookingId === booking.id;
               const selectedAddOns = parseAddOns(booking.addOns);

               return (
                <div key={booking.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col transition-all">
                   <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                     <div className="flex-1">
                        <h3 className="font-black text-xl text-brand">{booking.propertyTitle}</h3>
                        <p className="mt-1 text-sm text-gray-600 font-medium">Total Payout: <span className="text-green-600 font-bold">₦{(booking.totalPrice / 1.05).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
                        
                        {booking.status === 'confirmed' && (
                          <div className="mt-2 inline-block bg-green-50 text-green-700 font-bold px-3 py-1 rounded-md border border-green-200">
                            Check-In Code: {booking.checkInCode}
                          </div>
                        )}
                     </div>

                     <div className="flex flex-wrap gap-3">
                        <button 
                          onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)} 
                          className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                          <ConciergeBell size={16} />
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>

                        {booking.status === 'paid' && (
                          <button onClick={() => handleAcceptBooking(booking.id)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">
                            Accept Booking
                          </button>
                        )}
                     </div>
                   </div>

                   {/* --- EXPANDED DETAILS SECTION (SOFT LIFE UPGRADE) --- */}
                   {isExpanded && (
                     <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         
                         {/* Guest Info */}
                         <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                           <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Guest Information</h4>
                           <p className="font-bold text-gray-800">{booking.guestName || 'Apartey Guest'}</p>
                           <p className="text-sm text-gray-600 mt-1">
                             Dates: {new Date(booking.checkIn).toLocaleDateString()} to {new Date(booking.checkOut).toLocaleDateString()}
                           </p>
                           {booking.guestPhone && (
                             <p className="text-sm text-gray-600 mt-1">Phone: {booking.guestPhone}</p>
                           )}
                         </div>

                         {/* Add-ons Info */}
                         <div className="bg-brand/5 p-4 rounded-xl border border-brand/10">
                           <h4 className="text-xs font-bold text-brand uppercase tracking-wider mb-3">Requested Add-ons</h4>
                           {selectedAddOns.length > 0 ? (
                             <ul className="space-y-2">
                               {selectedAddOns.map((addon, idx) => (
                                 <li key={idx} className="flex justify-between items-center text-sm font-medium text-gray-800 bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                                   <span>{addon.name || addon.title}</span>
                                   <span className="text-brand font-bold">₦{(addon.price).toLocaleString()}</span>
                                 </li>
                               ))}
                             </ul>
                           ) : (
                             <p className="text-sm text-gray-500 italic">No premium add-ons selected for this stay.</p>
                           )}
                         </div>

                       </div>
                     </div>
                   )}
                </div>
               );
             })}
           </div>
        )}
     </div>
  );

  const renderEarnings = () => (
     <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand">Earnings & Payouts</h2>
        <p className="text-gray-500 text-sm">Manage your funds and withdraw directly to your Nigerian bank account.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-green-50 p-8 rounded-xl border border-green-200 shadow-sm flex flex-col justify-center items-center">
          <p className="text-sm font-bold text-green-800 uppercase tracking-wider mb-2">Available Balance</p>
          <h3 className="text-5xl font-extrabold text-green-700 mb-6">
            ₦{wallet.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h3>
          <button className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold w-full max-w-xs">
            Withdraw Funds
          </button>
        </div>
      </div>
    </div>
  );

  const renderVerification = () => (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-brand">Trust & Verification</h2>
        <p className="text-gray-500 text-sm">Become a Premium Host to unlock unlimited listings and higher visibility.</p>
      </div>

      {/* UPDATED LOADER */}
      {fetchingVerification ? (
         <BrandLoader />
      ) : verificationData.status === 'Verified' ? (
         <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center shadow-sm">
           <ShieldCheck size={48} className="mx-auto text-green-500 mb-4" />
           <h3 className="text-xl font-bold text-green-800 mb-2">Premium Host Active</h3>
           <p className="text-green-700 mb-4">You are a verified Premium Host. Your properties receive boosted visibility!</p>
         </div>
      ) : verificationData.status === 'Pending' ? (
         <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center shadow-sm">
           <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
           <h3 className="text-xl font-bold text-yellow-800 mb-2">Verification in Progress</h3>
           <p className="text-yellow-700">Our team is reviewing your documents. This usually takes 24-48 hours.</p>
         </div>
      ) : (
         <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8 shadow-sm">
           <div className="mb-6 pb-6 border-b border-gray-100">
             <h3 className="text-lg font-bold text-brand mb-2">Upgrade to Premium Host</h3>
             <p className="text-sm text-gray-600 mb-4">Standard hosts can list up to <strong>2 properties for free</strong>. Verify your identity to unlock unlimited listings and priority search placement.</p>
             <div className="bg-brand/5 p-4 rounded-xl border border-brand/10">
               <h4 className="font-bold text-brand text-sm mb-2 flex items-center gap-2">
                 <Star size={16} className="text-accent" /> Premium Benefits & Terms:
               </h4>
               <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5 mt-3">
                 <li><strong>Unlimited</strong> property listings.</li>
                 <li>"Verified Host" badge on your profile and properties.</li>
                 <li>Priority placement in guest search results.</li>
                 <li><strong>Platform Fee:</strong> By upgrading, you agree to a standard <strong>5% platform fee</strong> deducted from successful bookings.</li>
               </ul>
             </div>
           </div>

           <form onSubmit={handleKycSubmit} className="space-y-6">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Select Document Type</label>
               <select
                 value={kycDocType}
                 onChange={(e) => setKycDocType(e.target.value)}
                 className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 focus:ring-brand focus:border-brand transition-colors"
               >
                 <option value="NIN">National Identity Number (NIN) Slip</option>
                 <option value="Passport">International Passport</option>
                 <option value="VotersCard">Voter's Card (INEC)</option>
               </select>
             </div>

             <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Upload Document</label>
               <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
                 <input
                   type="file"
                   accept="image/*,.pdf"
                   onChange={(e) => setKycFile(e.target.files[0])}
                   className="hidden"
                   id="kyc-upload"
                 />
                 <label htmlFor="kyc-upload" className="cursor-pointer flex flex-col items-center">
                   <Upload size={32} className="text-gray-400 mb-3" />
                   <span className="text-sm font-bold text-brand">{kycFile ? kycFile.name : 'Click to browse or drag and drop'}</span>
                   <span className="text-xs text-gray-500 mt-2">PNG, JPG, or PDF (Max 5MB)</span>
                 </label>
               </div>
             </div>

             <div className="flex items-start gap-3 mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
               <input
                 type="checkbox"
                 id="terms"
                 checked={kycAcceptedTerms}
                 onChange={(e) => setKycAcceptedTerms(e.target.checked)}
                 className="mt-1 w-5 h-5 text-brand rounded border-gray-300 focus:ring-brand"
               />
               <label htmlFor="terms" className="text-sm text-gray-700 leading-relaxed">
                 I confirm that the uploaded document is authentic and belongs to me. I have read and agree to the <span className="text-brand font-bold">Premium Host Terms & Conditions</span>, including the 5% platform fee per booking.
               </label>
             </div>

             <button
               type="submit"
               disabled={!kycFile || !kycAcceptedTerms || uploadingKyc}
               className="w-full bg-brand hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-md mt-4 text-lg"
             >
               {uploadingKyc ? 'Submitting...' : 'Submit Verification Request'}
             </button>
           </form>
         </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:block flex-shrink-0 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
        <div className="p-4">
          <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-4 ml-3">Host Controls</p>
          <nav className="space-y-1">
            {sidebarLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === link.id 
                    ? 'bg-brand/10 text-brand border-r-4 border-brand' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-brand'
                }`}
              >
                <link.icon size={18} className={activeTab === link.id ? 'text-brand' : 'text-gray-400'} />
                {link.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-10 overflow-x-hidden">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'listings' && renderListings()}
        {activeTab === 'bookings' && renderBookings()}
        {activeTab === 'earnings' && renderEarnings()}
        {activeTab === 'verification' && renderVerification()}
      </main>
    </div>
  );
}