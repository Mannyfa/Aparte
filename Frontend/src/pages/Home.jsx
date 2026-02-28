import React, { useState, useEffect, useContext } from 'react';
import { MapPin, ChevronDown, Map as MapIcon, List, Search, ShieldCheck, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PropertyMap from '../components/PropertyMap';
import { motion, AnimatePresence } from 'framer-motion';

const heroImages = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1920&q=80"
];

// Animation Variants for staggered loading
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
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

  const handleSearchClick = () => {
    if (page === 1) fetchProperties(); 
    else setPage(1); 
  };

  const scrollToListings = () => {
    const element = document.getElementById('discover-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* --- HERO SECTION WITH ADVANCED CROSSFADE --- */}
      <div className="relative h-[85vh] w-full flex items-center justify-center overflow-hidden mb-16">
        <AnimatePresence mode="popLayout">
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
        
        {/* Luxury Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#f9fafb]" />
        
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto flex flex-col items-center pt-20 pb-32 md:pb-48">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-4 py-1.5 rounded-full text-sm font-bold tracking-widest uppercase mb-6 inline-block shadow-lg">
              Welcome to Apartey
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-tight drop-shadow-2xl">
              Experience <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Luxury Living.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-200 mb-10 max-w-2xl mx-auto font-medium drop-shadow-md">
              Discover the finest curated shortlets, penthouses, and premium apartments across Nigeria. Unmatched comfort, verified hosts.
            </p>
          </motion.div>

          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={scrollToListings} 
            className="bg-brand hover:bg-white hover:text-brand text-white px-8 py-4 rounded-full font-bold flex items-center gap-3 transition-all duration-300 shadow-2xl"
          >
            Start Exploring <ArrowRight size={20} />
          </motion.button>
        </div>
      </div>

      <div id="discover-section" className="max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* --- FLOATING ADVANCED SEARCH BAR --- */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] mb-12 flex flex-wrap gap-5 items-end border border-gray-100 relative -mt-32 z-20"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Location or Title</label>
            <div className="relative">
              <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="e.g. Lekki, Ikoyi..." className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all" />
            </div>
          </div>
          
          <div className="w-full md:w-auto">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Property Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand outline-none font-medium text-gray-700 transition-all">
              <option value="">All Types</option>
              <option value="Apartment">Apartment</option>
              <option value="Penthouse">Penthouse</option>
              <option value="Duplex">Duplex</option>
              <option value="Studio">Studio</option>
            </select>
          </div>

          <div className="w-1/2 md:w-36">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Min Price</label>
            <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="₦ 0" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all" />
          </div>
          
          <div className="w-1/2 md:w-36">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Max Price</label>
            <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="₦ Any" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all" />
          </div>

          <button onClick={handleSearchClick} className="w-full md:w-auto bg-brand hover:bg-gray-800 text-white px-10 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex-shrink-0">
            Search
          </button>
        </motion.div>

        {/* VIEW TOGGLE & HEADER */}
        <motion.div 
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-200 pb-6"
        >
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand mb-2">Curated Escapes</h2>
            <p className="text-gray-500 font-medium text-sm md:text-base">Find the perfect backdrop for your next getaway.</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl mt-4 md:mt-0 shadow-inner">
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700'}`}><List size={18} /> List</button>
            <button onClick={() => setViewMode('map')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-brand' : 'text-gray-500 hover:text-gray-700'}`}><MapIcon size={18} /> Map</button>
          </div>
        </motion.div>
        
        {/* RENDER LISTINGS */}
        {loading ? (
           <div className="flex justify-center items-center py-32"><div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div></div>
        ) : properties.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <Search size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">No exact matches found</h3>
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
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500 group flex flex-col"
              >
                <div className="relative h-64 overflow-hidden bg-gray-100">
                  {property.imageUrls && property.imageUrls.length > 0 ? (
                    <img src={property.imageUrls[0]} alt={property.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold bg-gray-200">No Image</div>
                  )}
                  {/* Gradient Overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"/>
                  
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className="bg-white/90 backdrop-blur-sm text-brand text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm">
                      {property.type}
                    </span>
                  </div>
                  
                  <div className="absolute bottom-4 right-4 bg-brand text-white px-4 py-2 rounded-xl font-black shadow-lg translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    ₦{property.pricePerNight.toLocaleString()}<span className="text-xs font-normal opacity-80">/nt</span>
                  </div>
                </div>
                
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-brand transition-colors line-clamp-2">{property.title}</h3>
                  </div>
                  
                  {property.hostVerificationStatus === 'Verified' && (
                    <div className="flex items-center gap-1 mb-4">
                      <ShieldCheck size={14} className="text-green-500" />
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">Verified Host</span>
                    </div>
                  )}

                  <div className="flex items-center text-gray-500 text-sm mb-8 flex-grow">
                    <MapPin size={16} className="mr-1.5 text-brand flex-shrink-0" />
                    <span className="font-medium truncate">{property.area}, {property.city}</span>
                  </div>
                  
                  <button 
                    onClick={() => navigate(`/property/${property.id}`)} 
                    className="w-full bg-gray-900 hover:bg-brand text-white px-4 py-3.5 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-xl"
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
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1}
              className="bg-white border border-gray-200 text-brand px-5 py-2.5 rounded-xl font-bold hover:border-brand disabled:opacity-50 transition-all shadow-sm flex items-center gap-1"
            >
              <ChevronLeft size={18}/> Prev
            </button>
            <span className="font-bold text-gray-700 px-4">
              {page} <span className="text-gray-400 font-medium">/ {totalPages}</span>
            </span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={page === totalPages}
              className="bg-white border border-gray-200 text-brand px-5 py-2.5 rounded-xl font-bold hover:border-brand disabled:opacity-50 transition-all shadow-sm flex items-center gap-1"
            >
              Next <ChevronRight size={18}/>
            </button>
          </motion.div>
        )}

      </div>
    </div>
  );
}