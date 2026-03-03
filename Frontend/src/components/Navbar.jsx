import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, User, LayoutDashboard, ShieldAlert, Home } from 'lucide-react';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Left: Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-brand text-white p-1.5 rounded-lg">
                <Home size={20} />
              </div>
              <span className="font-black text-xl tracking-tight text-brand">APARTEY!</span>
            </Link>
          </div>

          {/* Right: Dynamic Navigation */}
          <div className="flex items-center gap-6">
            {isAuthenticated ? (
              <>
                {/* 1. Admin Link (Only shows if role is admin) */}
                {user?.role === 'admin' && (
                  <Link to="/admin" className="text-sm font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-red-100">
                    <ShieldAlert size={16} /> Command Center
                  </Link>
                )}
                
                {/* 2. Host Link (Only shows if role is Host) */}
                {user?.role === 'Host' && (
                  <Link to="/dashboard" className="text-sm font-bold text-brand hover:bg-gray-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-gray-100">
                    <LayoutDashboard size={16} /> Dashboard
                  </Link>
                )}

                {/* 3. Universal Guest Link */}
                <Link to="/my-trips" className="text-sm font-semibold text-gray-700 hover:text-brand transition-colors">
                  My Trips
                </Link>

                {/* 4. User Profile & Logout */}
                <div className="flex items-center gap-4 ml-2 pl-6 border-l border-gray-200">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                    <User size={14} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{user?.name}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="text-sm font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-bold text-gray-700 hover:text-brand transition-colors">Log In</Link>
                <Link to="/register" className="text-sm font-bold bg-brand text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
                  Sign Up
                </Link>
              </>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}