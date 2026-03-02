import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Key, Clock, XCircle, CheckCircle2, ArrowRight, Home as HomeIcon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 15 } }
};

export default function MyTrips() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if not logged in or if the user is a Host
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role === 'Host') {
      navigate('/dashboard');
      return;
    }

    // --- NEW: PAYSTACK SUCCESS DETECTION ---
    if (searchParams.get('reference') || searchParams.get('trxref')) {
      toast.success("Payment Successful! Your funds are safe in Escrow.", { duration: 5000 });
      // Clean the URL so it looks pretty again
      setSearchParams({}); 
    }

    const fetchTrips = async () => {
      try {
        // Fetching from the newly created BookingsController endpoint which includes the AddOns!
        const response = await api.get('/Bookings/guest'); 
        setTrips(response.data);
      } catch (error) {
        toast.error("Failed to load your itinerary.");
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [isAuthenticated, user, navigate, searchParams, setSearchParams]);

  // Helper function to format dates nicely (e.g., "Oct 14, 2026")
  const formatDate = (dateString) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (!isAuthenticated || user?.role === 'Host') return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      
      {/* --- HERO HEADER --- */}
      <div className="bg-white border-b border-gray-100 pt-24 pb-12 shadow-sm relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl md:text-5xl font-black text-brand mb-3 tracking-tight">Your Escapes</h1>
            <p className="text-gray-500 text-lg font-medium">Manage your upcoming stays and past itineraries.</p>
          </motion.div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold animate-pulse">Retrieving your bookings...</p>
          </div>
        ) : trips.length === 0 ? (
          
          /* --- EMPTY STATE --- */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.5 }}
            className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm max-w-2xl mx-auto mt-10"
          >
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <HomeIcon size={40} className="text-gray-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">No trips booked yet</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">It's time to dust off your bags and start planning your next luxury getaway.</p>
            <button 
              onClick={() => navigate('/')} 
              className="bg-brand hover:bg-gray-900 text-white px-8 py-3.5 rounded-xl font-bold transition-all flex items-center gap-2 mx-auto shadow-md hover:shadow-lg"
            >
              Start Exploring <ArrowRight size={18} />
            </button>
          </motion.div>

        ) : (
          
          /* --- TRIPS GRID --- */
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {trips.map((trip) => (
              <motion.div 
                key={trip.id} 
                variants={cardVariants}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl transition-shadow duration-300 flex flex-col relative"
              >
                {/* Image & Status Badge */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  {trip.imageUrl ? (
                    <img src={trip.imageUrl} alt={trip.propertyTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400"><HomeIcon size={32} /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  
                  {/* Dynamic Status Badge */}
                  <div className="absolute top-4 right-4">
                    {trip.status === 'confirmed' && (
                      <span className="flex items-center gap-1.5 bg-green-500 text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-md backdrop-blur-sm">
                        <CheckCircle2 size={14} /> Confirmed
                      </span>
                    )}
                    {(trip.status === 'pending' || trip.status === 'paid') && (
                      <span className="flex items-center gap-1.5 bg-yellow-400 text-yellow-900 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-md backdrop-blur-sm">
                        <Clock size={14} /> Awaiting Host
                      </span>
                    )}
                    {trip.status === 'rejected' && (
                      <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-md backdrop-blur-sm">
                        <XCircle size={14} /> Refunded
                      </span>
                    )}
                  </div>
                </div>

                {/* Trip Details */}
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 line-clamp-1">{trip.propertyTitle}</h3>
                  
                  <div className="space-y-3 mb-4 flex-grow">
                    <div className="flex items-start gap-3 text-sm">
                      <Calendar size={18} className="text-brand flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-500 font-semibold text-xs uppercase tracking-wider mb-0.5">Dates</p>
                        <p className="font-bold text-gray-800">{formatDate(trip.checkIn)} — {formatDate(trip.checkOut)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin size={18} className="text-brand flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-500 font-semibold text-xs uppercase tracking-wider mb-0.5">Location</p>
                        <p className="font-bold text-gray-800 line-clamp-1">{trip.city}, Nigeria</p>
                      </div>
                    </div>
                  </div>

                  {/* --- NEW: LIFESTYLE ADD-ONS DISPLAY --- */}
                  {trip.addOns && trip.addOns.length > 0 && (
                    <div className="mb-6 pt-4 border-t border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Sparkles size={14}/> Lifestyle Services Added
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trip.addOns.map(addon => (
                          <span key={addon.id} className="text-[10px] font-bold bg-brand/5 text-brand border border-brand/10 px-2 py-1 rounded-md uppercase tracking-wide">
                            {addon.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* The Golden Ticket: The Gate Code */}
                  {trip.status === 'confirmed' ? (
                    <div className="mt-auto bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-extrabold text-green-800 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                          <Key size={14} /> Access Code
                        </p>
                        <p className="text-2xl font-black text-green-700 tracking-[0.15em]">{trip.checkInCode}</p>
                      </div>
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={20} className="text-green-600" />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Paid</span>
                      <span className="font-black text-lg text-gray-900">₦{trip.totalPrice?.toLocaleString() ?? "0"}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}