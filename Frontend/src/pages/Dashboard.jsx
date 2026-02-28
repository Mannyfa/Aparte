import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Home as HomeIcon, Calendar, ClipboardList, 
  MessageSquare, Wallet, Star, ShieldCheck, Settings, Plus, Upload, 
  TrendingUp, Bell, AlertCircle, CheckCircle2, Key, XCircle, Check, Send, Lock, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'; 

export default function Dashboard() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('overview');
  const [isAddingListing, setIsAddingListing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', type: 'Apartment', pricePerNight: '', city: '', state: '', area: ''
  });

  // --- NEW: MULTI-IMAGE & ARRAY STATE ---
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [selectedRules, setSelectedRules] = useState([]);

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

  // --- CALENDAR STATE ---
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

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'Host') {
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  if (!isAuthenticated || user?.role !== 'Host') {
    return null;
  }

  // --- HANDLERS ---
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // --- UPDATED SUBMIT HANDLER ---
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
      submitData.append('city', formData.city);
      submitData.append('state', formData.state);
      submitData.append('area', formData.area);
      
      // Append multi-select arrays as comma-separated strings
      submitData.append('amenities', selectedAmenities.join(','));
      submitData.append('houseRules', selectedRules.join(','));

      // Append up to 5 images!
      selectedImages.forEach(image => {
        submitData.append('images', image);
      });

      await api.post('/Properties', submitData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Property listed successfully with all images!');
      
      // Reset Form
      setIsAddingListing(false); 
      setFormData({ title: '', description: '', type: 'Apartment', pricePerNight: '', city: '', state: '', area: '' });
      setSelectedImages([]);
      setSelectedAmenities([]);
      setSelectedRules([]);
      
      if (activeTab === 'listings') {
          setActiveTab('overview'); 
          setTimeout(() => setActiveTab('listings'), 100);
      }
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
      
      setActiveTab('overview'); 
      setTimeout(() => setActiveTab('earnings'), 100);
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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatUser) return;

    try {
      const response = await api.post('/Messages', {
        receiverId: activeChatUser.id,
        content: chatInput
      });
      
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
      const formData = new FormData();
      formData.append('document', kycFile);
      
      const response = await api.post('/Verification/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

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
          <button className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">
            <Bell size={16} /> Notifications <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">3</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Earnings (This Month)</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-lg mb-4 text-brand border-b pb-2">Recent Booking Requests</h3>
            {overview.recentRequests.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No recent booking requests found.</p>
            ) : (
              <div className="space-y-4">
                {overview.recentRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 text-white rounded-full flex items-center justify-center font-bold ${req.status === 'confirmed' ? 'bg-green-600' : 'bg-brand'}`}>
                        {req.guestInitials}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-brand">{req.guestName}</p>
                        <p className="text-xs text-gray-500">{new Date(req.checkIn).toLocaleDateString()} - {new Date(req.checkOut).toLocaleDateString()} • {req.propertyTitle}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 ${
                      req.status === 'pending' || req.status === 'paid' ? 'bg-yellow-100 text-yellow-800' :
                      req.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {req.status === 'confirmed' && <CheckCircle2 size={12}/>}
                      {req.status === 'paid' ? 'Pending Approval' : req.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg mb-4 text-brand border-b pb-2">Wallet & Payouts</h3>
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                <p className="text-xs text-green-800 font-bold uppercase mb-1">Available to Withdraw</p>
                <h4 className="text-3xl font-extrabold text-green-700">₦{overview.availableBalance.toLocaleString()}</h4>
              </div>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Pending Clearance:</span> <span className="font-bold">₦{overview.pendingClearance.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Next Auto-Payout:</span> <span className="font-bold">Friday</span></div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 flex items-center gap-1"><CheckCircle2 size={14} className="text-green-500"/> Integrated with <strong>Paystack Escrow</strong></p>
            </div>
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
                    {property.imageUrl ? (
                      <img src={property.imageUrl} alt={property.title} className="w-full h-full object-cover" />
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
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Active</span>
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
          <div className="flex justify-between items-center border-b pb-4 mb-6">
            <h2 className="text-2xl font-bold text-brand">List a New Property</h2>
            <button onClick={() => setIsAddingListing(false)} className="text-gray-500 hover:text-red-500 font-bold text-sm">Cancel</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Property Title</label>
                <input type="text" name="title" required value={formData.title} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand outline-none" placeholder="e.g. Luxury 4-Bed Penthouse in Lekki" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                <textarea name="description" required value={formData.description} onChange={handleInputChange} rows="3" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand outline-none" placeholder="Describe the vibe of the apartment..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Property Type</label>
                <select name="type" value={formData.type} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand outline-none">
                  <option value="Apartment">Apartment</option>
                  <option value="Penthouse">Penthouse</option>
                  <option value="Duplex">Duplex</option>
                  <option value="Studio">Studio</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Price per Night (₦)</label>
                <input type="number" name="pricePerNight" required value={formData.pricePerNight} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand outline-none" placeholder="150000" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">State</label>
                <input type="text" name="state" required value={formData.state} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand outline-none" placeholder="Lagos" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">City</label>
                <input type="text" name="city" required value={formData.city} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand outline-none" placeholder="Lekki" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Area / Address</label>
                <input type="text" name="area" required value={formData.area} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand outline-none" placeholder="Phase 1, Admiralty Way" />
              </div>
            </div>

            {/* Checkboxes for Amenities & Rules */}
            <div className="border-t border-gray-200 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Amenities Included</label>
                <div className="space-y-2">
                  {availableAmenities.map(amenity => (
                    <label key={amenity} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-brand">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-brand focus:ring-brand border-gray-300"
                        checked={selectedAmenities.includes(amenity)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedAmenities([...selectedAmenities, amenity]);
                          else setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
                        }}
                      />
                      {amenity}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">House Rules</label>
                <div className="space-y-2">
                  {availableRules.map(rule => (
                    <label key={rule} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-brand">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-brand focus:ring-brand border-gray-300"
                        checked={selectedRules.includes(rule)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedRules([...selectedRules, rule]);
                          else setSelectedRules(selectedRules.filter(r => r !== rule));
                        }}
                      />
                      {rule}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Multi-Image Upload */}
            <div className="border-t border-gray-200 pt-6">
              <label className="block text-sm font-bold text-gray-900 mb-2">Upload Photos (Max 5)</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-brand border-dashed rounded-xl cursor-pointer bg-brand/5 hover:bg-brand/10 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-brand">
                  <Upload className="w-8 h-8 mb-2" />
                  <p className="text-sm font-bold">
                    {selectedImages.length > 0 ? `${selectedImages.length} image(s) selected` : "Click to select up to 5 images"}
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  multiple 
                  accept="image/*" 
                  onChange={(e) => setSelectedImages(Array.from(e.target.files).slice(0, 5))} 
                  required 
                />
              </label>
              {selectedImages.length > 0 && (
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                  {selectedImages.map((file, idx) => (
                    <div key={idx} className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                      <img src={URL.createObjectURL(file)} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full bg-brand hover:bg-gray-900 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl transition-all shadow-md">
              {loading ? 'Uploading Images to Cloudinary...' : 'Publish Property Listing'}
            </button>
          </form>
        </div>
      )}
    </div>
  );

  // --- INTERACTIVE CALENDAR UI RENDERER ---
  const renderCalendar = () => {
    // Basic calendar math
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const prevMonth = () => setCalendarMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setCalendarMonth(new Date(year, month + 1, 1));

    // Create the blank padding days for the start of the month
    const blanks = [];
    for (let i = 0; i < firstDayIndex; i++) {
      blanks.push(<div key={`blank-${i}`} className="bg-gray-50 border border-gray-100 p-2 min-h-[100px] text-transparent">.</div>);
    }

    // Is a specific day blocked?
    const checkIsBlocked = (day) => {
      const checkDate = new Date(year, month, day).getTime();
      
      const blockingBooking = calendarData.find(b => {
        if (calendarPropertyFilter !== 'All' && b.propertyId !== calendarPropertyFilter) return false;
        
        const start = new Date(b.startDate).getTime();
        const end = new Date(b.endDate).getTime();
        
        return checkDate >= start && checkDate <= end;
      });

      return blockingBooking; // returns the booking object if blocked, else undefined
    };

    // Create the actual day squares
    const daySquares = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const blockData = checkIsBlocked(d);
      const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;

      daySquares.push(
        <div key={d} className={`border border-gray-100 p-2 min-h-[100px] relative transition-colors ${blockData ? 'bg-red-50' : 'bg-white hover:bg-green-50'}`}>
          <span className={`font-bold text-sm ${isToday ? 'bg-brand text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-gray-700'}`}>
            {d}
          </span>
          
          {blockData && (
            <div className="mt-2 text-[10px] leading-tight font-bold bg-red-100 text-red-800 p-1 rounded border border-red-200 truncate" title={blockData.propertyTitle}>
              Booked
            </div>
          )}
          {!blockData && (
            <div className="absolute bottom-2 left-2 text-[10px] text-green-600 font-semibold opacity-0 hover:opacity-100 transition-opacity">
              Available
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-brand">Interactive Calendar</h2>
            <p className="text-gray-500 text-sm">View and manage your property availability.</p>
          </div>
          
          {/* Property Filter Dropdown */}
          <select 
            value={calendarPropertyFilter} 
            onChange={(e) => setCalendarPropertyFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm font-semibold"
          >
            <option value="All">All Properties</option>
            {hostProperties.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {fetchingCalendar ? (
          <div className="text-center py-12 text-gray-500 font-bold animate-pulse">Syncing calendar data...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Calendar Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><ChevronLeft size={20}/></button>
              <h3 className="text-xl font-bold text-brand">{monthNames[month]} {year}</h3>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><ChevronRight size={20}/></button>
            </div>
            
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-white">
              {dayNames.map(day => (
                <div key={day} className="p-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 bg-gray-100 gap-px border-t border-gray-100">
              {blanks}
              {daySquares}
            </div>
            
            {/* Legend */}
            <div className="p-4 bg-white flex items-center justify-end gap-4 text-xs font-bold text-gray-500">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div> Booked</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-gray-200 rounded"></div> Available</div>
            </div>
          </div>
        )}
      </div>
    );
  };


  const renderBookings = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand">Booking Operations</h2>
          <p className="text-gray-500 text-sm">Review, accept, and manage guest reservations.</p>
        </div>
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
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg text-brand">{booking.propertyTitle}</h3>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    booking.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {booking.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Check In</p>
                    <p className="font-semibold text-gray-800">{new Date(booking.checkIn).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Check Out</p>
                    <p className="font-semibold text-gray-800">{new Date(booking.checkOut).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Payout Amount</p>
                    <p className="font-bold text-green-600">₦{(booking.totalPrice * 0.95).toLocaleString()} <span className="text-gray-400 text-xs font-normal">(-5% fee)</span></p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end min-w-[200px] border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                {booking.status === 'paid' && (
                  <>
                    <p className="text-xs font-bold text-gray-500 mb-3 text-center md:text-right w-full">Action Required</p>
                    <div className="flex gap-2 w-full">
                      <button onClick={() => handleAcceptBooking(booking.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-colors">
                        <Check size={16} /> Accept
                      </button>
                      <button onClick={() => handleRejectBooking(booking.id)} className="flex-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 py-2 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-colors">
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  </>
                )}
                {booking.status === 'confirmed' && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-xl w-full text-center">
                    <p className="text-xs font-bold text-green-800 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                      <Key size={14} /> Gate/Door Code
                    </p>
                    <p className="text-3xl font-extrabold text-green-700 tracking-[0.2em]">{booking.checkInCode}</p>
                  </div>
                )}
                {booking.status === 'rejected' && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-xl w-full text-center text-sm font-bold border border-red-200">
                    Refund Processed
                  </div>
                )}
              </div>
            </div>
          ))}
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
                ₦{wallet.balance.toLocaleString()}
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
                    <span className="text-gray-500">Pending Clearance</span>
                    <span className="font-bold text-gray-700">₦{wallet.pendingClearance.toLocaleString()}</span>
                  </div>
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
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-lg mb-4 text-brand border-b pb-2">Recent Transactions</h3>
            {wallet.transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No transactions yet. Start accepting bookings to earn money!</p>
            ) : (
              <div className="space-y-3">
                {wallet.transactions.map((txn) => (
                  <div key={txn.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${txn.type === 'Credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {txn.type === 'Credit' ? '↓' : '↑'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800">{txn.description}</p>
                        <p className="text-xs text-gray-400">{new Date(txn.date).toLocaleDateString()} • Ref: {txn.reference}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${txn.type === 'Credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'Credit' ? '+' : '-'}₦{txn.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderMessages = () => (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-brand">Messages</h2>
        <p className="text-gray-500 text-sm">Communicate with your guests in real-time.</p>
      </div>
      <div className="flex flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="w-1/3 border-r border-gray-100 flex flex-col bg-gray-50/50">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-700">Registered Users</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {fetchingContacts ? (
              <div className="p-4 text-center text-gray-400 text-sm animate-pulse">Loading contacts...</div>
            ) : chatContacts.length === 0 ? (
               <div className="p-4 text-center text-gray-400 text-sm">No other users found in the system yet.</div>
            ) : (
              chatContacts.map(contact => (
                <button 
                  key={contact.id}
                  onClick={() => setActiveChatUser(contact)}
                  className={`w-full text-left p-4 border-b border-gray-100 hover:bg-white transition-colors flex gap-3 items-center ${activeChatUser?.id === contact.id ? 'bg-white border-l-4 border-l-brand' : ''}`}
                >
                  <div className="w-10 h-10 bg-brand text-white rounded-full flex items-center justify-center font-bold uppercase">
                    {contact.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-brand text-sm truncate">{contact.name}</p>
                    <p className="text-xs text-gray-400 truncate">Tap to open chat</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="w-2/3 flex flex-col bg-white">
          {!activeChatUser ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare size={48} className="mb-4 text-gray-200" />
              <p>Select a user to start messaging.</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center font-bold text-xs uppercase">
                  {activeChatUser.name.charAt(0)}
                </div>
                <h3 className="font-bold text-brand">{activeChatUser.name}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8fafc]">
                {fetchingHistory ? (
                  <div className="text-center text-xs text-gray-400 my-4 animate-pulse">Loading history...</div>
                ) : chatMessages.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 my-4">No messages yet. Say hello!</p>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${
                        msg.isMine ? 'bg-brand text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                      }`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-[10px] mt-1 text-right ${msg.isMine ? 'text-brand-100 opacity-70' : 'text-gray-400'}`}>
                          {new Date(msg.timestamp || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..." 
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-brand outline-none text-sm"
                />
                <button type="submit" disabled={!chatInput.trim()} className="bg-brand hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center transition-colors">
                  <Send size={16} className="ml-1" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderReviews = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand">Guest Reviews & Ratings</h2>
          <p className="text-gray-500 text-sm">See what guests are saying about your properties.</p>
        </div>
      </div>

      {fetchingReviews ? (
        <div className="text-center py-12 text-gray-500 font-bold animate-pulse">Loading reviews...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Overall Rating</p>
                <h3 className="text-4xl font-extrabold text-brand flex items-center gap-2">
                  {reviewsData.stats.averageRating} <Star className="text-yellow-400 fill-yellow-400" size={28} />
                </h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Total Reviews</p>
                <h3 className="text-4xl font-extrabold text-brand">{reviewsData.stats.totalReviews}</h3>
              </div>
              <ClipboardList size={40} className="text-gray-200" />
            </div>
          </div>

          {reviewsData.reviews.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <Star size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-700 mb-2">No Reviews Yet</h3>
              <p className="text-gray-500 max-w-md mx-auto">Once guests complete their stay, their reviews will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewsData.reviews.map(review => (
                <div key={review.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand text-white rounded-full flex items-center justify-center font-bold uppercase">
                        {review.guestName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-brand">{review.guestName}</p>
                        <p className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()} • {review.propertyTitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-md border border-yellow-100">
                      <span className="font-bold text-yellow-700">{review.rating}.0</span>
                      <Star className="text-yellow-500 fill-yellow-500" size={14} />
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 p-4 rounded-lg italic">"{review.comment}"</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderVerification = () => (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand">Trust & ID Verification</h2>
        <p className="text-gray-500 text-sm">Build trust with guests by verifying your identity.</p>
      </div>

      {fetchingVerification ? (
        <div className="text-center py-12 text-gray-500 font-bold animate-pulse">Checking status...</div>
      ) : verificationData.status === 'Verified' ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} className="text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Identity Verified</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Your government ID has been securely processed. You now have the <strong className="text-green-600">Verified Host</strong> badge on all your listings.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-brand/5 p-6 border-b border-gray-100 flex items-start gap-4">
            <Lock className="text-brand flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="font-bold text-brand text-lg">Secure Identity Upload</h3>
              <p className="text-sm text-gray-600 mt-1">
                Your data is securely encrypted and used strictly for identity verification. We accept Nigerian National ID (NIN), International Passports, or Driver's Licenses.
              </p>
            </div>
          </div>
          
          <form onSubmit={handleKycSubmit} className="p-8">
            <div className="mb-6">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-brand border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-brand">
                  <Upload className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="text-sm font-bold text-gray-700">
                    {kycFile ? kycFile.name : "Click to upload your Government ID"}
                  </p>
                  {!kycFile && <p className="text-xs text-gray-500 mt-2">JPG, PNG or PDF (Max. 5MB)</p>}
                </div>
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setKycFile(e.target.files[0])} />
              </label>
            </div>

            <button 
              type="submit" 
              disabled={uploadingKyc || !kycFile} 
              className="w-full bg-brand hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
            >
              {uploadingKyc ? 'Uploading to Secure Server...' : 'Submit Document'}
            </button>
          </form>
        </div>
      )}
    </div>
  );

  const renderPlaceholder = (title, icon) => (
    <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm h-full flex flex-col items-center justify-center animate-fade-in">
      <div className="bg-gray-50 p-6 rounded-full text-gray-400 mb-4">{icon}</div>
      <h2 className="text-2xl font-bold text-brand mb-2">{title} Module</h2>
      <p className="text-gray-500 max-w-md mx-auto">
        This operations module is currently being wired to the .NET Backend. As a Senior Engineer, you know we need to build the database models and controllers for this next!
      </p>
    </div>
  );

  const renderWithdrawModal = () => {
    if (!isWithdrawModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h3 className="text-xl font-bold text-brand">Withdraw Funds</h3>
            <button onClick={() => setIsWithdrawModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold">✕</button>
          </div>
          <div className="bg-green-50 text-green-800 p-3 rounded-lg mb-6 text-sm font-semibold border border-green-200">
            Available Balance: ₦{wallet.balance.toLocaleString()}
          </div>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Amount (₦)</label>
              <input type="number" required max={wallet.balance} min="1000" value={withdrawData.amount} onChange={e => setWithdrawData({...withdrawData, amount: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. 50000" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Bank</label>
              <select value={withdrawData.bankCode} onChange={e => setWithdrawData({...withdrawData, bankCode: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white">
                {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Account Number</label>
              <input type="text" required maxLength="10" minLength="10" value={withdrawData.accountNumber} onChange={e => setWithdrawData({...withdrawData, accountNumber: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="10-digit account number" />
            </div>
            <button type="submit" disabled={isWithdrawing} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg mt-4 transition-colors">
              {isWithdrawing ? 'Processing Transfer...' : 'Initiate Withdrawal'}
            </button>
          </form>
        </div>
      </div>
    );
  };

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
        {activeTab === 'calendar' && renderCalendar()}
        {activeTab === 'bookings' && renderBookings()}
        {activeTab === 'messages' && renderMessages()}
        {activeTab === 'earnings' && renderEarnings()}
        {activeTab === 'reviews' && renderReviews()}
        {activeTab === 'verification' && renderVerification()}
        {activeTab === 'settings' && renderPlaceholder('Account Settings', <Settings size={48}/>)}
      </main>

      {renderWithdrawModal()}
    </div>
  );
}