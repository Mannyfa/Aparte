import React, { useState, useEffect, useContext } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Stunning luxury placeholder images for the slideshow
const heroImages = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80"
];

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // WE ADDED 'user' HERE SO WE CAN CHECK THEIR ROLE
  const { isAuthenticated, user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Slideshow Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000); // Changes image every 5 seconds
    
    return () => clearInterval(timer); // Cleanup on unmount
  }, []);

  // Fetch Properties Effect
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await api.get('/Properties');
        setProperties(response.data);
      } catch (error) {
        toast.error('Failed to load apartments.');
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const handleBookNow = async (propertyId) => {
    // 1. Security Check: Are they logged in?
    if (!isAuthenticated) {
      toast.error("Please log in to book an apartment.");
      navigate('/login');
      return;
    }

    // 2. NEW ROLE CHECK: Are they a Host?
    if (user?.role === 'Host') {
      toast.error("Hosts cannot book properties. Please create a Guest account to book.");
      return;
    }

    setBookingLoading(propertyId);
    
    try {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 1);
      
      const checkOut = new Date();
      checkOut.setDate(checkOut.getDate() + 5);

      const response = await api.post('/Bookings', {
        propertyId: propertyId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString()
      });

      toast.success("Securing your dates...");
      window.location.href = response.data.paymentUrl;

    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to initialize booking.");
    } finally {
      setBookingLoading(null);
    }
  };

  const scrollToListings = () => {
    // Scrolls the user down smoothly to the properties section
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xl text-gray-500 font-semibold animate-pulse">Loading luxury apartments...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      
      {/* FULL SCREEN HERO SLIDESHOW */}
      <div className="relative h-[calc(100vh-64px)] w-full flex items-center justify-center overflow-hidden mb-16">
        
        {/* The Images */}
        {heroImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}

        {/* Dark Overlay (makes the white text readable) */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Hero Content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight drop-shadow-lg">
            Find Your Perfect Stay in Nigeria
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-10 drop-shadow-md">
            Discover luxury shortlets, penthouses, and cozy apartments with 24/7 power and premium security.
          </p>
          
          <button 
            onClick={scrollToListings}
            className="bg-accent hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-xl flex items-center gap-2"
          >
            Explore Properties
            <ChevronDown size={20} />
          </button>
        </div>
      </div>

      {/* Property Grid */}
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-brand mb-8 border-b pb-4">Available Listings</h2>
        
        {properties.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No properties available yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((property) => (
              <div key={property.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
                
                {/* Real Image Display */}
                <div className="relative h-56 overflow-hidden">
                  {property.imageUrl ? (
                    <img 
                      src={property.imageUrl} 
                      alt={property.title} 
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400">No Image Available</span>
                    </div>
                  )}
                  {/* Floating Price Badge */}
                  <div className="absolute bottom-3 right-3 bg-brand/90 backdrop-blur-sm text-white px-3 py-1 rounded-lg font-bold shadow-lg">
                    ₦{property.pricePerNight.toLocaleString()}/nt
                  </div>
                </div>
                
                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-brand line-clamp-1">{property.title}</h3>
                  </div>
                  
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded w-max mb-3 border border-blue-100">
                    {property.type}
                  </span>
                  
                  <div className="flex items-center text-gray-500 text-sm mb-6 flex-grow">
                    <MapPin size={16} className="mr-1 text-accent" />
                    <span className="truncate">{property.area}, {property.city}</span>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100 mt-auto">
                    <button 
                      onClick={() => handleBookNow(property.id)}
                      disabled={bookingLoading === property.id}
                      className="w-full bg-brand hover:bg-gray-800 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-bold transition-all shadow-md"
                    >
                      {bookingLoading === property.id ? 'Connecting to Escrow...' : 'Book Now'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}