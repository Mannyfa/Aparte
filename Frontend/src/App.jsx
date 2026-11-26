import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import NotificationListener from './components/NotificationListener';
import InstallPrompt from './components/InstallPrompt';

import Login from './pages/Login';
import Home from './pages/Home';
import PaymentSuccess from './pages/PaymentSuccess';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import MyTrips from './pages/MyTrips';
import PropertyDetails from './pages/PropertyDetails';
import AdminDashboard from './pages/AdminDashboard';
import SplitDashboard from './pages/SplitDashboard';

/** Scrolls to "#section" links (React Router doesn't) and to the top on page changes. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // wait a frame so the target section has rendered
      const id = hash.slice(1);
      const t = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
      }, 50);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);
  return null;
}

function NotFound() {
  return (
    <div className="page section text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="h-page">This page checked out.</h1>
      <p className="lead mx-auto mt-4 max-w-md">The link may be old, or the listing may have been removed.</p>
      <Link to="/" className="btn-lime btn-lg mt-8">Back to stays</Link>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const appView = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <ScrollManager />
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#16160F', color: '#F2F1EA', borderRadius: '10px', fontSize: '13px', padding: '10px 14px' },
          success: { iconTheme: { primary: '#D4F24A', secondary: '#16160F' } },
        }}
      />
      <NotificationListener />
      <InstallPrompt />
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-trips" element={<MyTrips />} />
          <Route path="/property/:id" element={<PropertyDetails />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/split-success/:id" element={<SplitDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!appView && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Shell />
    </Router>
  );
}
