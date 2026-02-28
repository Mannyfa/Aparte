import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Home, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(); // This clears the token from LocalStorage and React Context
    navigate('/login'); // Send them back to the login page
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Left Side - Logo */}
        <Link to="/" className="flex items-center gap-2 text-brand font-bold text-xl hover:opacity-80 transition-opacity">
          <div className="bg-brand p-1.5 rounded-lg text-white">
            <Home size={20} />
          </div>
          <span>APARTEY!</span>
        </Link>

        <Link to="/my-trips">My Trips</Link>

        {/* Right Side - Auth Links */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {/* Only show Dashboard if the user is a Host! */}
              {user?.role === 'Host' && (
                <Link to="/dashboard" className="text-sm font-semibold text-gray-600 hover:text-brand transition-colors mr-2">
                  Dashboard
                </Link>
              )}
              
              <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                <div className="bg-gray-200 p-1 rounded-full text-gray-500">
                  <User size={16} />
                </div>
                <span className="text-sm font-semibold">{user?.name || 'Guest'}</span>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="bg-brand text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}