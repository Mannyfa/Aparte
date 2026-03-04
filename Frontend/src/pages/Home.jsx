import React, { useState, useEffect, useContext } from 'react';
import { MapPin, ChevronDown, Map as MapIcon, List, Search, ShieldCheck, ArrowRight, ChevronLeft, ChevronRight, Home as HomeIcon, Wallet } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PropertyMap from '../components/PropertyMap';
import BrandLoader from '../components/BrandLoader'; // <-- Your new custom loader!
import { motion, AnimatePresence } from 'framer-motion';

const heroImages = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80"
];

// Animation Variants for staggered loading
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 70, damping: 15 } }
};

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState('list');

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { isAuthenticated, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % heroImages.length), 6000);
    return () => clearInterval(timer);
  }, []);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page, pageSize: 6 });
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (filterType) params.append('type', filterType);
      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);

      const response = await api.get(`/Properties/search?${params.toString()}`);
      setProperties(response.data.data);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      toast.error('Failed to load apartments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [page]);

  const handleSearchClick = (e) => {
    e.preventDefault();
    if (page === 1) fetchProperties(); 
    else setPage(1); 
    scrollToListings();
  };

  const scrollToListings = () => {
    const element = document.getElementById('discover-section');
    if (element) {
      const offset = 100; // Adjusts scroll position to account for sticky navbar
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* --- SPECTACULAR CINEMATIC HERO SECTION --- */}
      <div className="relative h-[85vh] min-h-[650px] w-full flex items-center justify-center overflow-hidden mb-16">
        
        {/* Crossfading Background Images (Fixed!) */}
        <AnimatePresence>
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImages[currentSlide]})` }}
          />
        </AnimatePresence>
        
        {/* Luxury Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand/90 via-brand/50 to-gray-50/90" />
        
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 flex flex-col items-center text-center mt-12">
          
          {/* Animated Headlines */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="text-accent font-bold tracking-widest uppercase text-xs md:text-sm mb-4 block drop-shadow-md">
              Welcome to the New Standard
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-extrabold text-white leading-tight tracking-tight mb-6 drop-shadow-2xl">
              Curated Escapes. <br className="hidden md:block"/> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-yellow-200">
                Unmatched Luxury.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-200 font-medium max-w-2xl mx-auto drop-shadow-md mb-12">
              Discover the finest verified shortlets, penthouses, and premium apartments across Nigeria.
            </p>
          </motion.div>

          {/* --- THE GLASSMORPHISM SEARCH BAR (White/Readable Update!) --- */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="w-full max-w-5xl mx-auto"
          >
            <div className="bg-white/90 backdrop-blur-md border border-white p-2 md:p-3 rounded-3xl md:rounded-full shadow-2xl">
              <form onSubmit={handleSearchClick} className="flex flex-col md:flex-row items-center gap-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                
                {/* Location Input */}
                <div className="w-full md:w-1/3 px-4 py-3 md:py-0 flex items-center gap-3 hover:bg-gray-100/50 rounded-full transition-colors cursor-text">
                  <MapPin className="text-accent flex-shrink-0" size={24} />
                  <div className="flex flex-col text-left w-full">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Where to?</label>
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Lekki, Ikoyi, Abuja..." 
                      className="bg-transparent border-none text-brand placeholder-gray-400 focus:ring-0 text-sm md:text-base font-bold w-full outline-none p-0"
                    />
                  </div>
                </div>

                {/* Property Type Dropdown */}
                <div className="w-full md:w-1/4 px-4 py-3 md:py-0 flex items-center gap-3 hover:bg-gray-100/50 rounded-full transition-colors">
                  <HomeIcon className="text-accent flex-shrink-0" size={22} />
                  <div className="flex flex-col text-left w-full">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Property Type</label>
                    <select 
                      value={filterType} 
                      onChange={(e) => setFilterType(e.target.value)} 
                      className="bg-transparent border-none text-brand focus:ring-0 text-sm md:text-base font-bold w-full outline-none p-0 appearance-none cursor-pointer"
                    >
                      <option value="">All Types</option>
                      <option value="Apartment">Apartment</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Duplex">Duplex</option>
                      <option value="Studio">Studio</option>
                    </select>
                  </div>
                </div>

                {/* Max Price Input */}
                <div className="w-full md:w-1/4 px-4 py-3 md:py-0 flex items-center gap-3 hover:bg-gray-100/50 rounded-full transition-colors">
                  <Wallet className="text-accent flex-shrink-0" size={22} />
                  <div className="flex flex-col text-left w-full">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Max Budget</label>
                    <input 
                      type="number" 
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="₦ Any Amount" 
                      className="bg-transparent border-none text-brand placeholder-gray-400 focus:ring-0 text-sm md:text-base font-bold w-full outline-none p-0"
                    />
                  </div>
                </div>

                {/* Search Button */}
                <div className="w-full md:w-auto p-1">
                  <button 
                    type="submit"
                    className="w-full md:w-auto bg-brand hover:bg-gray-800 text-accent p-4 md:px-10 rounded-2xl md:rounded-full font-black transition-all shadow-lg hover:shadow-brand/30 hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <Search size={20} />
                    <span className="md:hidden">Search Properties</span>
                  </button>
                </div>

              </form>
            </div>
          </motion.div>

        </div>
      </div>

      <div id="discover-section" className="max-w-7xl mx-auto px-6 lg:px-8 pt-8">
        
        {/* VIEW TOGGLE & HEADER */}
        <motion.div 
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-200 pb-6"
        >
          <div>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-brand mb-2">Available Escapes</h2>
            <p className="text-gray-500 font-medium text-sm md:text-base">Showing results for your search criteria.</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl mt-4 md:mt-0 shadow-inner">
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700'}`}><List size={18} /> List</button>
            <button onClick={() => setViewMode('map')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700'}`}><MapIcon size={18} /> Map</button>
          </div>
        </motion.div>
        
        {/* RENDER LISTINGS (Now with BrandLoader!) */}
        {loading ? (
           <BrandLoader />
        ) : properties.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <Search size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-brand mb-2">No exact matches found</h3>
            <p className="text-gray-500">Try adjusting your filters or searching a different area.</p>
          </motion.div>
        ) : viewMode === 'map' ? (
          <motion.div key="map-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[600px] rounded-3xl overflow-hidden shadow-lg border border-gray-200">
            <PropertyMap properties={properties} />
          </motion.div>
        ) : (
          <motion.div 
            key="list-view"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {properties.map((property) => (
              <motion.div 
                key={property.id} 
                variants={itemVariants}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500 group flex flex-col"
              >
                <div className="relative h-64 overflow-hidden bg-gray-100">
                  {property.imageUrls && property.imageUrls.length > 0 ? (
                    <img src={property.imageUrls[0]} alt={property.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold bg-gray-200">No Image</div>
                  )}
                  {/* Gradient Overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"/>
                  
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className="bg-white/90 backdrop-blur-sm text-brand text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm">
                      {property.type}
                    </span>
                  </div>
                  
                  <div className="absolute bottom-4 right-4 bg-brand text-accent px-4 py-2 rounded-xl font-black shadow-lg translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    ₦{property.pricePerNight.toLocaleString()}<span className="text-xs font-normal text-white opacity-80">/nt</span>
                  </div>
                </div>
                
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="text-xl font-bold text-brand leading-tight transition-colors line-clamp-2">{property.title}</h3>
                  </div>
                  
                  {property.hostVerificationStatus === 'Verified' && (
                    <div className="flex items-center gap-1 mb-4">
                      <ShieldCheck size={14} className="text-green-500" />
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">Verified Host</span>
                    </div>
                  )}

                  <div className="flex items-center text-gray-500 text-sm mb-8 flex-grow">
                    <MapPin size={16} className="mr-1.5 text-accent flex-shrink-0" />
                    <span className="font-medium truncate">{property.area}, {property.city}</span>
                  </div>
                  
                  <button 
                    onClick={() => navigate(`/property/${property.id}`)} 
                    className="w-full bg-brand hover:bg-gray-800 text-white px-4 py-3.5 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-xl"
                  >
                    View Details
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* PAGINATION CONTROLS */}
        {!loading && totalPages > 1 && (
          <motion.div 
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="flex justify-center items-center gap-3 mt-16"
          >
            <button 
              onClick={() => { setPage(p => Math.max(1, p - 1)); scrollToListings(); }} 
              disabled={page === 1}
              className="bg-white border border-gray-200 text-brand px-5 py-2.5 rounded-xl font-bold hover:border-accent disabled:opacity-50 transition-all shadow-sm flex items-center gap-1"
            >
              <ChevronLeft size={18}/> Prev
            </button>
            <span className="font-bold text-brand px-4">
              {page} <span className="text-gray-400 font-medium">/ {totalPages}</span>
            </span>
            <button 
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); scrollToListings(); }} 
              disabled={page === totalPages}
              className="bg-white border border-gray-200 text-brand px-5 py-2.5 rounded-xl font-bold hover:border-accent disabled:opacity-50 transition-all shadow-sm flex items-center gap-1"
            >
              Next <ChevronRight size={18}/>
            </button>
          </motion.div>
        )}

      </div>
    </div>
  );
}