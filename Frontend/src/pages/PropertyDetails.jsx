import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, ShieldCheck, Star, CheckCircle2, AlertCircle, X, PlusCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useContext(AuthContext);

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Booking Form State
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [nights, setNights] = useState(0);

  // --- CHECKOUT MODAL & ADD-ONS STATE ---
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);

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

  // --- INITIATE CHECKOUT (OPENS MODAL) ---
  const handleInitiateCheckout = () => {
    if (!isAuthenticated) {
      toast.error("Please login to book a property.");
      return navigate('/login');
    }
    if (user?.role === 'Host') {
      return toast.error("Hosts cannot book properties.");
    }
    if (nights <= 0) {
      return toast.error("Please select valid check-in and check-out dates.");
    }
    setIsCheckoutModalOpen(true);
  };

  // --- TOGGLE ADD-ON IN MODAL ---
  const toggleAddOn = (addon) => {
    const exists = selectedAddOns.find(a => a.id === addon.id);
    if (exists) {
      setSelectedAddOns(selectedAddOns.filter(a => a.id !== addon.id));
    } else {
      setSelectedAddOns([...selectedAddOns, addon]);
    }
  };

  // --- CONFIRM BOOKING TO BACKEND ---
  const handleConfirmBooking = async () => {
    setBookingLoading(true);
    try {
      const payload = { 
        propertyId: id, 
        checkIn: new Date(checkIn).toISOString(), 
        checkOut: new Date(checkOut).toISOString(),
        // Send an array of just the IDs of the Add-Ons the guest chose
        addOnIds: selectedAddOns.map(a => a.id) 
      };
      const response = await api.post('/Bookings', payload);
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

  // --- NEW: PRICING MATH WITH ESCROW ---
  const totalRoomPrice = property.pricePerNight * nights;
  const platformFee = totalRoomPrice * 0.05; // 5% platform fee
  const cautionFee = property.cautionFee || 0; // Safely grab the caution fee
  const addOnsTotal = selectedAddOns.reduce((sum, addon) => sum + addon.price, 0);
  
  // Final calculation includes the refundable escrow deposit
  const finalPrice = totalRoomPrice + platformFee + cautionFee + addOnsTotal;

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
            <div className="sticky top-24 bg-white border border-gray-200 rounded-2xl p-6 shadow-xl">
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
                onClick={handleInitiateCheckout}
                disabled={nights <= 0}
                className="w-full bg-brand hover:bg-gray-900 disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md"
              >
                {nights > 0 ? 'Continue to Checkout' : 'Check Availability'}
              </button>

              <p className="text-center text-gray-500 text-xs mt-4 font-medium">You won't be charged yet</p>

              {/* Initial Price Preview */}
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
                  {/* --- NEW: CAUTION FEE PREVIEW --- */}
                  {cautionFee > 0 && (
                    <div className="flex justify-between text-brand font-medium">
                      <span className="underline">Refundable Caution Fee</span>
                      <span>₦{cautionFee.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* --- THE ENHANCE YOUR STAY CHECKOUT MODAL --- */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden relative"
            >
              {/* Mobile Close Button */}
              <button onClick={() => setIsCheckoutModalOpen(false)} className="absolute top-4 right-4 md:hidden z-10 bg-white p-2 rounded-full shadow-md text-gray-500 hover:text-red-500">
                <X size={20} />
              </button>

              {/* LEFT SIDE: SUMMARY */}
              <div className="w-full md:w-5/12 bg-gray-50 border-r border-gray-200 p-6 md:p-8 overflow-y-auto hidden md:block">
                <h3 className="text-2xl font-black text-brand mb-6">Your Stay</h3>
                
                <div className="flex gap-4 mb-8">
                  <div className="w-24 h-24 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                    <img src={property.imageUrls?.[0] || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9"} alt="Property" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{property.type}</p>
                    <p className="font-bold text-gray-900 leading-tight line-clamp-2">{property.title}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Star size={12} className="text-yellow-500 fill-yellow-500"/> 4.9</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between border-b border-gray-200 pb-4">
                    <div>
                      <p className="font-bold text-gray-900">Dates</p>
                      <p className="text-sm text-gray-500">{new Date(checkIn).toLocaleDateString()} – {new Date(checkOut).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-bold text-brand bg-brand/10 px-3 py-1 rounded-lg h-fit">{nights} Nights</span>
                  </div>
                </div>

                <h4 className="font-bold text-gray-900 mb-4">Price Details</h4>
                <div className="space-y-3 text-sm text-gray-600 mb-4">
                  <div className="flex justify-between">
                    <span>₦{property.pricePerNight.toLocaleString()} x {nights} nights</span>
                    <span>₦{totalRoomPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee (5%)</span>
                    <span>₦{platformFee.toLocaleString()}</span>
                  </div>
                  {/* --- NEW: ESCROW LINE ITEM IN RECEIPT --- */}
                  {cautionFee > 0 && (
                    <div className="flex justify-between text-brand font-semibold pt-1">
                      <span className="flex items-center gap-1"><ShieldCheck size={14}/> Caution Fee (Escrow)</span>
                      <span>₦{cautionFee.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Dynamic Add-Ons List in Receipt */}
                  {selectedAddOns.length > 0 && (
                    <div className="pt-3 border-t border-gray-200 space-y-2">
                      <p className="font-bold text-xs uppercase text-gray-400 tracking-wider">Lifestyle Add-Ons</p>
                      {selectedAddOns.map(addon => (
                        <div key={addon.id} className="flex justify-between text-brand font-medium">
                          <span>+ {addon.name}</span>
                          <span>₦{addon.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center border-t border-gray-300 pt-4 mt-6">
                  <span className="font-black text-gray-900">Total (NGN)</span>
                  <span className="font-black text-2xl text-brand">₦{finalPrice.toLocaleString()}</span>
                </div>
              </div>

              {/* RIGHT SIDE: ENHANCE YOUR STAY (ADD-ONS) */}
              <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 hidden md:flex">
                  <h3 className="text-2xl font-black text-brand">Enhance Your Stay</h3>
                  <button onClick={() => setIsCheckoutModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2"><X size={24} /></button>
                </div>
                
                {/* Mobile specific header */}
                <h3 className="text-xl font-black text-brand mb-4 md:hidden pr-8">Enhance Your Stay</h3>

                <p className="text-gray-500 mb-6">Make your trip unforgettable by adding luxury services provided directly by your host.</p>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6">
                  {!property.addOns || property.addOns.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl p-8 text-center border border-dashed border-gray-200">
                      <p className="text-gray-500">The host hasn't listed any extra services for this property. You're ready to complete your booking!</p>
                    </div>
                  ) : (
                    property.addOns.map(addon => {
                      const isSelected = selectedAddOns.some(a => a.id === addon.id);
                      return (
                        <div 
                          key={addon.id} 
                          onClick={() => toggleAddOn(addon)}
                          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between gap-4 ${
                            isSelected 
                              ? 'border-brand bg-brand/5 shadow-md' 
                              : 'border-gray-100 bg-white hover:border-brand/30 hover:bg-gray-50 shadow-sm'
                          }`}
                        >
                          <div className="flex-1">
                            <h4 className={`font-bold text-lg mb-1 ${isSelected ? 'text-brand' : 'text-gray-900'}`}>{addon.name}</h4>
                            <p className="text-sm text-gray-500">{addon.description}</p>
                            <p className="text-brand font-black mt-2">₦{addon.price.toLocaleString()}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckCircle size={28} className="text-brand" />
                            ) : (
                              <PlusCircle size={28} className="text-gray-300 hover:text-brand" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 mt-auto">
                  {/* Mobile Total Preview */}
                  <div className="flex justify-between items-center mb-4 md:hidden">
                    <span className="font-bold text-gray-600">Grand Total</span>
                    <span className="font-black text-xl text-brand">₦{finalPrice.toLocaleString()}</span>
                  </div>

                  <button 
                    onClick={handleConfirmBooking}
                    disabled={bookingLoading}
                    className="w-full bg-brand hover:bg-gray-900 text-white font-bold py-4 rounded-xl text-lg transition-colors shadow-lg flex justify-center items-center gap-2 disabled:opacity-70"
                  >
                    {bookingLoading ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Connecting to Escrow...</>
                    ) : (
                      'Proceed to Payment'
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-400 mt-3 font-medium flex items-center justify-center gap-1">
                    <ShieldCheck size={14}/> Secure payment via Paystack Escrow
                  </p>
                </div>
              </div>
              
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}