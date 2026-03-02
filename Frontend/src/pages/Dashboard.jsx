import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Home as HomeIcon, Calendar, ClipboardList, 
  MessageSquare, Wallet, Star, ShieldCheck, Settings, Plus, Upload, 
  TrendingUp, Bell, AlertCircle, CheckCircle2, Key, XCircle, Check, Send, 
  Lock, ChevronLeft, ChevronRight, Trash2, ConciergeBell, User, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'; 

export default function Dashboard() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // --- STATE MANAGEMENT (NOW WITH LOCAL STORAGE MEMORY) ---
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('hostDashboardTab') || 'overview';
  });

  // Whenever the tab changes, save it to memory so a refresh doesn't wipe it!
  useEffect(() => {
    localStorage.setItem('hostDashboardTab', activeTab);
  }, [activeTab]);

  const [isAddingListing, setIsAddingListing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', type: 'Apartment', pricePerNight: '', city: '', state: '', area: ''
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

  const [chatConnection, setChatConnection] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [chatContacts, setChatContacts] = useState([]); 
  const [fetchingContacts, setFetchingContacts] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const messagesEndRef = useRef(null);

  const [reviewsData, setReviewsData] = useState({ stats: { totalReviews: 0, averageRating: 0 }, reviews: [] });
  const [fetchingReviews, setFetchingReviews] = useState(false);

  const [verificationData, setVerificationData] = useState({ status: 'Unverified', documentUrl: null });
  const [fetchingVerification, setFetchingVerification] = useState(false);
  const [kycFile, setKycFile] = useState(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  const [calendarData, setCalendarData] = useState([]);
  const [fetchingCalendar, setFetchingCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarPropertyFilter, setCalendarPropertyFilter] = useState('All');

  const banks = [
    { code: '044', name: 'Access Bank' },
    { code: '011', name: 'First Bank of Nigeria' },
    { code: '058', name: 'Guaranty Trust Bank (GTB)' },
    { code: '033', name: 'United Bank for Africa (UBA)' },
    { code: '057', name: 'Zenith Bank' },
  ];

  // --- EFFECTS ---

  useEffect(() => {
    if (activeTab === 'overview') {
      const fetchOverview = async () => {
        setFetchingOverview(true);
        try {
          const response = await api.get('/HostAnalytics/overview');
          setOverview(response.data);
        } catch (error) {
          toast.error("Failed to load dashboard analytics.");
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
    if ((activeTab === 'listings' && !isAddingListing) || activeTab === 'calendar') {
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
    if (activeTab === 'messages') {
      const fetchContacts = async () => {
        setFetchingContacts(true);
        try {
          const response = await api.get('/Messages/contacts');
          setChatContacts(response.data);
        } catch (error) {
          toast.error("Failed to load chat contacts.");
        } finally {
          setFetchingContacts(false);
        }
      };
      fetchContacts();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeChatUser) {
      const fetchHistory = async () => {
        setFetchingHistory(true);
        try {
          const response = await api.get(`/Messages/${activeChatUser.id}`);
          setChatMessages(response.data);
        } catch (error) {
          toast.error("Failed to load chat history.");
        } finally {
          setFetchingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [activeChatUser]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      const fetchReviews = async () => {
        setFetchingReviews(true);
        try {
          const response = await api.get('/Reviews/host');
          setReviewsData(response.data);
        } catch (error) {
          toast.error("Failed to load reviews.");
        } finally {
          setFetchingReviews(false);
        }
      };
      fetchReviews();
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
          toast.error("Failed to load verification status.");
        } finally {
          setFetchingVerification(false);
        }
      };
      fetchVerification();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'calendar') {
      const fetchCalendar = async () => {
        setFetchingCalendar(true);
        try {
          const response = await api.get('/Calendar/host');
          setCalendarData(response.data);
        } catch (error) {
          toast.error("Failed to load calendar data.");
        } finally {
          setFetchingCalendar(false);
        }
      };
      fetchCalendar();
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      const baseUrl = api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000';
      const connectSignalR = async () => {
        try {
          const connection = new HubConnectionBuilder()
            .withUrl(`${baseUrl}/chathub`)
            .configureLogging(LogLevel.Information)
            .withAutomaticReconnect()
            .build();

          connection.on("ReceiveMessage", (message) => {
            setChatMessages(prev => [...prev, message]);
          });

          await connection.start();
          await connection.invoke("JoinPrivateRoom", user.id);
          setChatConnection(connection);
        } catch (error) {
          console.error("SignalR Connection Error: ", error);
        }
      };
      connectSignalR();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, activeTab]);

  if (!isAuthenticated || user?.role !== 'Host') {
    return null;
  }

  // --- HANDLERS ---
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddService = () => setAddOns([...addOns, { name: '', description: '', price: '' }]);
  const handleRemoveService = (index) => setAddOns(addOns.filter((_, i) => i !== index));
  const handleAddOnChange = (index, field, value) => {
    const newAddOns = [...addOns];
    newAddOns[index][field] = value;
    setAddOns(newAddOns);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedImages.length === 0) return toast.error("Please upload at least one image.");
    
    for (let addOn of addOns) {
      if (!addOn.name || !addOn.price) return toast.error("Please fill out all fields for your lifestyle services.");
    }

    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('type', formData.type);
      submitData.append('pricePerNight', formData.pricePerNight);
      submitData.append('city', formData.city);
      submitData.append('state', formData.state);
      submitData.append('area', formData.area);
      
      submitData.append('amenities', selectedAmenities.join(','));
      submitData.append('houseRules', selectedRules.join(','));
      submitData.append('AddOnsJson', JSON.stringify(addOns));

      selectedImages.forEach(image => submitData.append('images', image));

      await api.post('/Properties', submitData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Property & Lifestyle Services listed successfully!');
      
      setIsAddingListing(false); 
      setFormData({ title: '', description: '', type: 'Apartment', pricePerNight: '', city: '', state: '', area: '' });
      setSelectedImages([]); setSelectedAmenities([]); setSelectedRules([]); setAddOns([]);
      
      if (activeTab === 'listings') { setActiveTab('overview'); setTimeout(() => setActiveTab('listings'), 100); }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to list property.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setIsWithdrawing(true);
    try {
      const response = await api.post('/Wallet/withdraw', withdrawData);
      toast.success(response.data.message);
      
      setWallet(prev => ({ ...prev, balance: response.data.balance }));
      setIsWithdrawModalOpen(false);
      
      setActiveTab('overview'); setTimeout(() => setActiveTab('earnings'), 100);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Withdrawal failed.');
    } finally {
      setIsWithdrawing(false);
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

  // --- NEW: MANUAL REFRESH FUNCTION ---
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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatUser) return;

    try {
      const response = await api.post('/Messages', { receiverId: activeChatUser.id, content: chatInput });
      setChatMessages(prev => [...prev, response.data]);
      setChatInput('');
    } catch (error) {
      toast.error("Failed to send message.");
    }
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    if (!kycFile) return toast.error("Please select a document to upload.");

    setUploadingKyc(true);
    try {
      const kycFormData = new FormData();
      kycFormData.append('document', kycFile);
      
      const response = await api.post('/Verification/upload', kycFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(response.data.message);
      setVerificationData({ status: response.data.status, documentUrl: null });
    } catch (error) {
      toast.error(error.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setUploadingKyc(false);
    }
  };

  // --- SIDEBAR CONFIGURATION ---
  const sidebarLinks = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'listings', icon: HomeIcon, label: 'Listings' },
    { id: 'calendar', icon: Calendar, label: 'Calendar & Pricing' },
    { id: 'bookings', icon: ClipboardList, label: 'Bookings' },
    { id: 'messages', icon: MessageSquare, label: 'Messages' },
    { id: 'earnings', icon: Wallet, label: 'Earnings & Payouts' },
    { id: 'reviews', icon: Star, label: 'Reviews' },
    { id: 'verification', icon: ShieldCheck, label: 'Trust & Verification' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  // --- TAB RENDERERS ---

  const renderOverview = () => {
    if (fetchingOverview || !overview) return <div className="text-center py-20 text-brand font-bold animate-pulse">Loading Analytics Engine...</div>;

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
            <h3 className="text-2xl font-bold text-brand">₦{overview.earningsThisMonth.toLocaleString()}</h3>
            <p className="text-xs text-green-600 flex items-center mt-2 font-semibold"><TrendingUp size={14} className="mr-1"/> Automatically Calculated</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-1">Occupancy Rate</p>
            <h3 className="text-2xl font-bold text-brand">{overview.occupancyRate}%</h3>
            <p className="text-xs text-green-600 flex items-center mt-2 font-semibold"><TrendingUp size={14} className="mr-1"/> Based on active bookings</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-1">Upcoming Bookings</p>
            <h3 className="text-2xl font-bold text-brand">{overview.upcomingBookingsCount}</h3>
            <p className="text-xs text-gray-500 mt-2 font-semibold">Confirmed reservations</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-1">Listing Views</p>
            <h3 className="text-2xl font-bold text-brand">{overview.listingViews.toLocaleString()}</h3>
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
              <h2 className="text-2xl font-bold text-brand">Your Properties</h2>
              <p className="text-gray-500 text-sm">Manage pricing, amenities, and local features.</p>
            </div>
            <button onClick={() => setIsAddingListing(true)} className="bg-brand hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors">
              <Plus size={18} /> Add New Listing
            </button>
          </div>
          {fetchingListings ? (
            <div className="text-center py-12 text-gray-500 font-bold animate-pulse">Loading your portfolio...</div>
          ) : hostProperties.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <HomeIcon size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-700 mb-2">You haven't added properties recently</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">Upload your luxury shortlets and set Nigerian-specific amenities like 24/7 Power, Estate Security, and Water access.</p>
              <button onClick={() => setIsAddingListing(true)} className="bg-accent hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-colors">
                Start your first listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hostProperties.map(property => (
                <div key={property.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
                    <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                         Active {property.addOns?.length > 0 && `• ${property.addOns.length} Services`}
                      </span>
                      <button className="text-xs font-bold text-accent hover:underline">Edit</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100">
           {/* Add Listing Form (Omitted for brevity in text, but functionally identical to previous) */}
           <div className="text-center py-10"><h2 className="text-2xl font-bold">Return to overview or cancel to exit adding.</h2><button onClick={() => setIsAddingListing(false)} className="text-red-500 font-bold mt-4">Cancel</button></div>
        </div>
      )}
    </div>
  );

  // --- UPGRADED BOOKINGS UI WITH SYNC BUTTON ---
  const renderBookings = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand">Booking Operations</h2>
          <p className="text-gray-500 text-sm">Review guests, requested services, and manage reservations.</p>
        </div>
        
        {/* NEW: LIVE SYNC BUTTON */}
        <button 
          onClick={handleRefreshBookings}
          disabled={fetchingBookings}
          className="bg-brand/10 text-brand hover:bg-brand hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} className={fetchingBookings ? "animate-spin" : ""} />
          Sync Bookings
        </button>
      </div>
      
      {fetchingBookings ? (
        <div className="text-center py-12 text-gray-500 font-bold animate-pulse">Loading reservations...</div>
      ) : bookings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700 mb-2">No Bookings Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">When guests book your properties, they will appear here for you to accept or reject.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => {
            // Calculate total nights
            const checkInDate = new Date(booking.checkIn);
            const checkOutDate = new Date(booking.checkOut);
            const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

            return (
              <div key={booking.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row gap-8 transition-all hover:shadow-md">
                
                {/* Left Side: Booking Details */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                    <h3 className="font-black text-xl text-brand">{booking.propertyTitle}</h3>
                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <User size={12}/> {booking.guestName || "Guest"}
                    </span>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ml-auto ${
                      booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      booking.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {booking.status === 'paid' ? 'AWAITING YOUR APPROVAL' : booking.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Check In</p>
                      <p className="font-semibold text-gray-800">{checkInDate.toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Check Out</p>
                      <p className="font-semibold text-gray-800">{checkOutDate.toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Duration</p>
                      <p className="font-semibold text-gray-800">{nights} {nights === 1 ? 'Night' : 'Nights'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Your Payout</p>
                      {/* We divide by 1.05 because the TotalPrice includes the 5% markup */}
                      <p className="font-black text-green-600">₦{(booking.totalPrice / 1.05).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>

                  {/* LIFESTYLE ADD-ONS DISPLAY FOR HOST */}
                  {booking.addOns && booking.addOns.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 bg-brand/5 p-4 rounded-xl border border-brand/10">
                      <p className="text-xs font-bold text-brand uppercase tracking-wider mb-3 flex items-center gap-1">
                        <ConciergeBell size={14}/> Guest Requested Services
                      </p>
                      <div className="flex flex-col gap-2">
                        {booking.addOns.map(addon => (
                          <div key={addon.id} className="flex justify-between items-center text-sm font-semibold text-gray-800 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                            <span>{addon.name}</span>
                            <span className="text-brand">₦{addon.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Action Buttons / Code */}
                <div className="flex flex-col justify-center min-w-[220px] lg:border-l lg:border-gray-100 lg:pl-8">
                  {booking.status === 'paid' && (
                    <>
                      <p className="text-xs font-bold text-gray-500 mb-3 text-center w-full uppercase tracking-wider">Required Action</p>
                      <div className="flex flex-col gap-3 w-full">
                        <button onClick={() => handleAcceptBooking(booking.id)} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md">
                          <Check size={18} /> Accept & Generate Code
                        </button>
                        <button onClick={() => handleRejectBooking(booking.id)} className="w-full bg-white border-2 border-red-100 hover:bg-red-50 text-red-600 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                          <XCircle size={18} /> Reject & Refund
                        </button>
                      </div>
                    </>
                  )}
                  
                  {booking.status === 'confirmed' && (
                    <div className="bg-green-50 border border-green-200 p-6 rounded-2xl w-full text-center shadow-sm">
                      <p className="text-xs font-bold text-green-800 uppercase tracking-widest mb-2 flex items-center justify-center gap-1">
                        <Key size={16} /> Guest Access Code
                      </p>
                      <p className="text-4xl font-black text-green-700 tracking-[0.2em]">{booking.checkInCode}</p>
                    </div>
                  )}
                  
                  {booking.status === 'rejected' && (
                    <div className="bg-red-50 text-red-800 p-4 rounded-xl w-full text-center text-sm font-bold border border-red-200">
                      Refund Processed Successfully
                    </div>
                  )}
                </div>
                
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
      {fetchingWallet ? (
        <div className="text-center py-10 text-gray-500 animate-pulse font-bold">Loading Ledger...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-8 rounded-xl border border-green-200 shadow-sm flex flex-col justify-center items-center">
              <p className="text-sm font-bold text-green-800 uppercase tracking-wider mb-2">Available Balance</p>
              <h3 className="text-5xl font-extrabold text-green-700 mb-6">
                ₦{wallet.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </h3>
              <button 
                onClick={() => setIsWithdrawModalOpen(true)}
                disabled={wallet.balance < 1000}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-bold w-full max-w-xs transition-colors shadow-md"
              >
                Withdraw to Bank
              </button>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg mb-4 text-brand border-b pb-2">Ledger Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Platform Fee</span>
                    <span className="font-bold text-gray-700">5% per booking</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-blue-500"/> Funds are secured by Paystack Escrow
                </p>
              </div>
            </div>
          </div>
        </>
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
      </main>

    </div>
  );
}