import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, ShieldCheck, Star, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useContext(AuthContext);

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Booking Form State
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [nights, setNights] = useState(0);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const response = await api.get(`/Properties/${id}`);
        setProperty(response.data);
      } catch (error) {
        toast.error("Failed to load property details.");
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id, navigate]);

  // Calculate nights when dates change
  useEffect(() => {
    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0 && start < end) {
        setNights(diffDays);
      } else {
        setNights(0);
      }
    }
  }, [checkIn, checkOut]);

  const handleBookNow = async () => {
    if (!isAuthenticated) return navigate('/login');
    if (user?.role === 'Host') return toast.error("Hosts cannot book properties.");
    if (nights <= 0) return toast.error("Please select valid check-in and check-out dates.");

    setBookingLoading(true);
    try {
      const response = await api.post('/Bookings', { 
        propertyId: id, 
        checkIn: new Date(checkIn).toISOString(), 
        checkOut: new Date(checkOut).toISOString() 
      });
      window.location.href = response.data.paymentUrl; // Send to Paystack
    } catch (error) {
      toast.error(error.response?.data?.message || "Booking failed.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center"><div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!property) return null;

  const totalRoomPrice = property.pricePerNight * nights;
  const platformFee = totalRoomPrice * 0.05; // 5% fee
  const finalPrice = totalRoomPrice + platformFee;

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-8">
        
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{property.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600">
            <span className="flex items-center gap-1"><Star size={16} className="text-yellow-500 fill-yellow-500" /> 4.9 (120 reviews)</span>
            <span className="underline flex items-center gap-1"><MapPin size={16} /> {property.area}, {property.city}, {property.state}</span>
            {property.hostVerificationStatus === 'Verified' && (
              <span className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200"><ShieldCheck size={16} /> Superhost</span>
            )}
          </div>
        </div>

        {/* DYNAMIC 5-IMAGE GALLERY GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-2 h-[50vh] min-h-[400px] mb-12 rounded-2xl overflow-hidden">
          <div className="md:col-span-2 row-span-2 bg-gray-200 hover:opacity-90 transition-opacity cursor-pointer">
            <img src={property.imageUrls?.[0] || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9"} alt="Main" className="w-full h-full object-cover" />
          </div>
          <div className="bg-gray-200 hover:opacity-90 transition-opacity cursor-pointer hidden md:block">
            <img src={property.imageUrls?.[1] || "https://images.unsplash.com/photo-1512917774080-9991f1c4c750"} className="w-full h-full object-cover" alt="Gallery 1"/>
          </div>
          <div className="bg-gray-200 hover:opacity-90 transition-opacity cursor-pointer hidden md:block">
            <img src={property.imageUrls?.[2] || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c"} className="w-full h-full object-cover" alt="Gallery 2"/>
          </div>
          <div className="bg-gray-200 hover:opacity-90 transition-opacity cursor-pointer hidden md:block">
            <img src={property.imageUrls?.[3] || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2"} className="w-full h-full object-cover" alt="Gallery 3"/>
          </div>
          <div className="bg-gray-200 hover:opacity-90 transition-opacity cursor-pointer hidden md:block">
            <img src={property.imageUrls?.[4] || "https://images.unsplash.com/photo-1505691938895-1758d7def511"} className="w-full h-full object-cover" alt="Gallery 4"/>
          </div>
        </div>

        {/* CONTENT SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* LEFT COLUMN: Details */}
          <div className="lg:col-span-2 space-y-10">
            
            <div className="flex justify-between items-start border-b border-gray-200 pb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Entire {property.type} hosted by {property.hostName}</h2>
                <p className="text-gray-500">4 guests · 2 bedrooms · 2 beds · 2.5 baths</p>
              </div>
              <div className="w-14 h-14 bg-brand text-white rounded-full flex items-center justify-center font-bold text-xl uppercase shadow-md">
                {property.hostName?.charAt(0) || 'H'}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">About this space</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>
            </div>

            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">What this place offers</h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                {property.amenities && property.amenities.length > 0 ? (
                  property.amenities.map((amenity, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-gray-700">
                      <CheckCircle2 size={24} className="text-brand"/> {amenity}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No specific amenities listed.</p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">House Rules</h3>
              <ul className="space-y-3 text-gray-600">
                {property.houseRules && property.houseRules.length > 0 ? (
                  property.houseRules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <AlertCircle size={18} className="text-brand shrink-0 mt-0.5"/> {rule}
                    </li>
                  ))
                ) : (
                  <p className="text-gray-500">No special rules applied by the host.</p>
                )}
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN: Sticky Booking Widget */}
          <div className="relative">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="sticky top-24 bg-white border border-gray-200 rounded-2xl p-6 shadow-xl"
            >
              <div className="mb-6">
                <span className="text-2xl font-black text-gray-900">₦{property.pricePerNight.toLocaleString()}</span>
                <span className="text-gray-500 font-medium"> / night</span>
              </div>

              <div className="border border-gray-300 rounded-xl overflow-hidden mb-4">
                <div className="flex border-b border-gray-300">
                  <div className="w-1/2 p-3 border-r border-gray-300">
                    <label className="block text-[10px] font-extrabold uppercase text-gray-900 mb-1">Check-in</label>
                    <input 
                      type="date" 
                      min={new Date().toISOString().split('T')[0]}
                      value={checkIn} onChange={(e) => setCheckIn(e.target.value)} 
                      className="w-full outline-none text-sm text-gray-700 bg-transparent cursor-pointer" 
                    />
                  </div>
                  <div className="w-1/2 p-3">
                    <label className="block text-[10px] font-extrabold uppercase text-gray-900 mb-1">Checkout</label>
                    <input 
                      type="date" 
                      min={checkIn || new Date().toISOString().split('T')[0]}
                      value={checkOut} onChange={(e) => setCheckOut(e.target.value)} 
                      className="w-full outline-none text-sm text-gray-700 bg-transparent cursor-pointer" 
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleBookNow}
                disabled={bookingLoading || nights <= 0}
                className="w-full bg-brand hover:bg-gray-900 disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md"
              >
                {bookingLoading ? 'Connecting to Escrow...' : (nights > 0 ? 'Reserve Now' : 'Check Availability')}
              </button>

              <p className="text-center text-gray-500 text-xs mt-4 font-medium">You won't be charged yet</p>

              {/* Dynamic Price Calculation */}
              {nights > 0 && (
                <div className="mt-6 space-y-3 text-sm text-gray-600 border-t border-gray-200 pt-4">
                  <div className="flex justify-between">
                    <span className="underline">₦{property.pricePerNight.toLocaleString()} x {nights} nights</span>
                    <span>₦{totalRoomPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="underline">Apartey service fee (5%)</span>
                    <span>₦{platformFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 text-lg border-t border-gray-200 pt-4 mt-4">
                    <span>Total</span>
                    <span>₦{finalPrice.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}