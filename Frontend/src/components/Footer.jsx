import React from 'react';
import { Home as HomeIcon, Instagram, Twitter, Facebook, Mail, MapPin, Phone } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <footer className="bg-[#0A0A0A] text-gray-300 py-16 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Column */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="flex items-center gap-2 text-white">
              <div className="bg-brand p-2 rounded-lg"><HomeIcon size={24} className="text-white"/></div>
              <span className="text-2xl font-extrabold tracking-tight">APARTEY!</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Elevating the Nigerian shortlet experience. Premium luxury apartments, penthouses, and duplexes curated for your perfect stay.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-brand hover:text-white transition-colors"><Instagram size={18} /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-brand hover:text-white transition-colors"><Twitter size={18} /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-brand hover:text-white transition-colors"><Facebook size={18} /></a>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Explore</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-brand transition-colors flex items-center gap-2">Lekki Phase 1</a></li>
              <li><a href="#" className="hover:text-brand transition-colors flex items-center gap-2">Victoria Island</a></li>
              <li><a href="#" className="hover:text-brand transition-colors flex items-center gap-2">Ikoyi Luxury</a></li>
              <li><a href="#" className="hover:text-brand transition-colors flex items-center gap-2">Abuja Escapes</a></li>
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Contact Us</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-brand flex-shrink-0 mt-0.5" />
                <span>14 Admiralty Way,<br />Lekki Phase 1, Lagos, Nigeria</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-brand flex-shrink-0" />
                <span>+234 (0) 800 APARTEY</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-brand flex-shrink-0" />
                <span>hello@apartey.com</span>
              </li>
            </ul>
          </motion.div>

          {/* Newsletter */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Newsletter</h4>
            <p className="text-sm text-gray-400 mb-4">Subscribe for exclusive discounts and new luxury listings.</p>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-4 py-2.5 w-full focus:outline-none focus:border-brand transition-colors"
              />
              <button type="submit" className="bg-brand hover:bg-white hover:text-brand text-white font-bold px-4 py-2.5 rounded-lg transition-colors">
                Subscribe
              </button>
            </form>
          </motion.div>

        </div>
        
        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Apartey. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Trust & Safety</a>
          </div>
        </div>
      </div>
    </footer>
  );
}