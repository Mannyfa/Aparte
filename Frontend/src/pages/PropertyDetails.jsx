import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, ShieldCheck, Star, CheckCircle2, AlertCircle, X, PlusCircle, CheckCircle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';

import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useContext(AuthContext);

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [checkIn, setCheckIn] = useState(null); 
  const [checkOut, setCheckOut] = useState(null);
  const [nights, setNights] = useState(0);
  const [bookedDates, setBookedDates] = useState([]); 

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  // --- NEW: SPLIT PAYMENT STATE ---
  const [isSplit, setIsSplit] = useState(false);
  const [splitWays, setSplitWays] = useState(2);

  useEffect(() => {
    const fetchPropertyAndDates = async () => {
      try {
        const propResponse = await api.get(`/Properties/${id}`);
        setProperty(propResponse.data);

        const datesResponse = await api.get(`/Properties/${id}/booked-dates`);
        const unavailableDates = datesResponse.data.map(dateStr => new Date(dateStr));
        setBookedDates(unavailableDates);
      } catch (error) {
        toast.error("Failed to load property details.");
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchPropertyAndDates();
  }, [id, navigate]);

  useEffect(() => {
    if (checkIn && checkOut) {
      const diffTime = Math.abs(checkOut - checkIn);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0 && checkIn < checkOut) {
        setNights(diffDays);
      } else {
        setNights(0);
      }
    } else {
      setNights(0);
    }
  }, [checkIn, checkOut]);

  const getNextBookedDate = () => {
    if (!checkIn) return null;
    const futureBookings = bookedDates.filter(date => date > checkIn).sort((a, b) => a - b);
    return futureBookings.length > 0 ? futureBookings[0] : null;
  };

  const maxCheckOutDate = getNextBookedDate();

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

  const toggleAddOn = (addon) => {
    const exists = selectedAddOns.find(a => a.id === addon.id);
    if (exists) {
      setSelectedAddOns(selectedAddOns.filter(a => a.id !== addon.id));
    } else {
      setSelectedAddOns([...selectedAddOns, addon]);
    }
  };

  const handleConfirmBooking = async () => {
    setBookingLoading(true);
    try {
      const payload = { 
        propertyId: id, 
        checkIn: checkIn.toISOString(), 
        checkOut: checkOut.toISOString(),
        addOnIds: selectedAddOns.map(a => a.id),
        isSplit: isSplit, // <-- Send Split Preference
        splitWays: isSplit ? splitWays : 1
      };
      const response = await api.post('/Bookings', payload);
      
      // NEW: Redirect to Split Dashboard OR Paystack
      if (response.data.isSplit) {
        toast.success("Split Group Created! Redirecting to your group dashboard...");
        navigate(`/split-success/${response.data.splitGroupId}`);
      } else {
        window.location.href = response.data.paymentUrl; 
      }

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
  const platformFee = totalRoomPrice * 0.05; 
  const cautionFee = property.cautionFee || 0; 
  const addOnsTotal = selectedAddOns.reduce((sum, addon) => sum + addon.price, 0);
  const finalPrice = totalRoomPrice + platformFee + cautionFee + addOnsTotal;

  // Split calculations
  const splitAmount = isSplit ? (finalPrice / splitWays) : finalPrice;

  return (
    <div className="min-h-screen bg-white pb-24">
      <style>{`
        .react-datepicker__day--selected, .react-datepicker__day--in-selecting-range, .react-datepicker__day--in-range,
        .react-datepicker__month-text--selected, .react-datepicker__month-text--in-selecting-range, .react-datepicker__month-text--in-range {
          background-color: #0f172a !important; 
          color: #d4af37 !important; 
          font-weight: bold;
        }
        .react-datepicker__day--keyboard-selected { background-color: #0f172a !important; color: white !important; }
        .react-datepicker__day--disabled { color: #ccc !important; text-decoration: line-through; }
        .react-datepicker { font-family: inherit; border: 1px solid #e5e7eb; border-radius: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .react-datepicker__header { background-color: white; border-bottom: 1px solid #e5e7eb; border-top-left-radius: 0.75rem !important; border-top-right-radius: 0.75rem !important; }
      `}</style>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-8">
        
        {/* HEADER & GALLERY OMITTED FOR BREVITY BUT KEPT IN CODE */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{property.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600">
            <span className="flex items-center gap-1"><Star size={16} className="text-yellow-500 fill-yellow-500" /> 4.9</span>
            <span className="underline flex items-center gap-1"><MapPin size={16} /> {property.area}, {property.city}, {property.state}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-2 h-[50vh] min-h-[400px] mb-12 rounded-2xl overflow-hidden">
          <div className="md:col-span-2 row-span-2 bg-gray-200">
            <img src={property.imageUrls?.[0] || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9"} alt="Main" className="w-full h-full object-cover" />
          </div>
          <div className="bg-gray-200 hidden md:block"><img src={property.imageUrls?.[1] || "https://images.unsplash.com/photo-1512917774080-9991f1c4c750"} className="w-full h-full object-cover" alt="Gallery"/></div>
          <div className="bg-gray-200 hidden md:block"><img src={property.imageUrls?.[2] || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c"} className="w-full h-full object-cover" alt="Gallery"/></div>
          <div className="bg-gray-200 hidden md:block"><img src={property.imageUrls?.[3] || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2"} className="w-full h-full object-cover" alt="Gallery"/></div>
          <div className="bg-gray-200 hidden md:block"><img src={property.imageUrls?.[4] || "https://images.unsplash.com/photo-1505691938895-1758d7def511"} className="w-full h-full object-cover" alt="Gallery"/></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-10">
            <div className="flex justify-between items-start border-b border-gray-200 pb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Entire {property.type} hosted by {property.hostName}</h2>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">About this space</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>
            </div>
          </div>

          {/* RIGHT COLUMN: Booking Widget */}
          <div className="relative">
            <div className="sticky top-24 bg-white border border-gray-200 rounded-2xl p-6 shadow-xl">
              <div className="mb-6">
                <span className="text-2xl font-black text-gray-900">₦{property.pricePerNight.toLocaleString()}</span>
                <span className="text-gray-500 font-medium"> / night</span>
              </div>

              <div className="border border-gray-300 rounded-xl overflow-hidden mb-4">
                <div className="flex border-b border-gray-300">
                  <div className="w-1/2 p-3 border-r border-gray-300 relative cursor-pointer hover:bg-gray-50 transition-colors">
                    <label className="block text-[10px] font-extrabold uppercase text-gray-900 mb-1 cursor-pointer">Check-in</label>
                    <DatePicker
                      selected={checkIn}
                      onChange={(date) => { setCheckIn(date); setCheckOut(null); }}
                      selectsStart startDate={checkIn} endDate={checkOut}
                      minDate={new Date()} excludeDates={bookedDates}
                      placeholderText="Add date" dateFormat="MMM d, yyyy"
                      className="w-full outline-none text-sm text-gray-700 bg-transparent cursor-pointer font-bold placeholder-gray-400"
                    />
                  </div>
                  <div className={`w-1/2 p-3 relative transition-colors ${!checkIn ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                    <label className="block text-[10px] font-extrabold uppercase text-gray-900 mb-1 cursor-pointer">Checkout</label>
                    <DatePicker
                      selected={checkOut} onChange={(date) => setCheckOut(date)}
                      selectsEnd startDate={checkIn} endDate={checkOut}
                      minDate={checkIn ? new Date(checkIn.getTime() + 86400000) : new Date()} 
                      maxDate={maxCheckOutDate} excludeDates={bookedDates}
                      placeholderText="Add date" disabled={!checkIn}
                      dateFormat="MMM d, yyyy"
                      className="w-full outline-none text-sm text-gray-700 bg-transparent cursor-pointer font-bold placeholder-gray-400 disabled:cursor-not-allowed"
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
            </div>
          </div>
        </div>
      </div>

      {/* --- THE CHECKOUT MODAL --- */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden relative"
            >
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
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between border-b border-gray-200 pb-4">
                    <div>
                      <p className="font-bold text-gray-900">Dates</p>
                      <p className="text-sm text-gray-500">{checkIn.toLocaleDateString()} – {checkOut.toLocaleDateString()}</p>
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
                  {cautionFee > 0 && (
                    <div className="flex justify-between text-brand font-semibold pt-1">
                      <span className="flex items-center gap-1"><ShieldCheck size={14}/> Caution Fee (Escrow)</span>
                      <span>₦{cautionFee.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedAddOns.map(addon => (
                    <div key={addon.id} className="flex justify-between text-brand font-medium">
                      <span>+ {addon.name}</span>
                      <span>₦{addon.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center border-t border-gray-300 pt-4 mt-6">
                  <span className="font-black text-gray-900">Total (NGN)</span>
                  <span className="font-black text-2xl text-brand">₦{finalPrice.toLocaleString()}</span>
                </div>
              </div>

              {/* RIGHT SIDE: ADD-ONS & SPLIT */}
              <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 hidden md:flex">
                  <h3 className="text-2xl font-black text-brand">Enhance Your Stay</h3>
                  <button onClick={() => setIsCheckoutModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2"><X size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6">
                  {property.addOns?.map(addon => {
                    const isSelected = selectedAddOns.some(a => a.id === addon.id);
                    return (
                      <div key={addon.id} onClick={() => toggleAddOn(addon)} className={`cursor-pointer p-5 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between gap-4 ${isSelected ? 'border-brand bg-brand/5 shadow-md' : 'border-gray-100 bg-white hover:border-brand/30 hover:bg-gray-50 shadow-sm'}`}>
                        <div className="flex-1">
                          <h4 className={`font-bold text-lg mb-1 ${isSelected ? 'text-brand' : 'text-gray-900'}`}>{addon.name}</h4>
                          <p className="text-brand font-black mt-1">₦{addon.price.toLocaleString()}</p>
                        </div>
                        <div className="flex-shrink-0">{isSelected ? <CheckCircle size={28} className="text-brand" /> : <PlusCircle size={28} className="text-gray-300 hover:text-brand" />}</div>
                      </div>
                    );
                  })}
                </div>

                {/* --- NEW: THE APARTEY SPLIT UI SECTION --- */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-brand/10 p-2 rounded-lg"><Users size={20} className="text-brand"/></div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Apartey Split</h4>
                        <p className="text-xs text-gray-500">Split this booking with friends</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={isSplit} onChange={() => setIsSplit(!isSplit)} />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                    </label>
                  </div>
                  
                  {isSplit && (
                    <div className="mt-4 pt-4 border-t border-gray-200 animate-fade-in flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">How many ways?</span>
                      <select 
                        value={splitWays} 
                        onChange={(e) => setSplitWays(Number(e.target.value))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-brand outline-none"
                      >
                        {[2,3,4,5].map(num => <option key={num} value={num}>{num} People</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 mt-auto">
                  <button 
                    onClick={handleConfirmBooking}
                    disabled={bookingLoading}
                    className="w-full bg-brand hover:bg-gray-900 text-white font-bold py-4 rounded-xl text-lg transition-colors shadow-lg flex justify-center items-center gap-2 disabled:opacity-70"
                  >
                    {bookingLoading ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
                    ) : (
                      isSplit ? `Pay Your Share (₦${splitAmount.toLocaleString()})` : 'Proceed to Payment'
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