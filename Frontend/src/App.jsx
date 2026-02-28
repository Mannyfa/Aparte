import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer'; // <-- NEW: Import the Footer

// Pages
import Login from './pages/Login';
import Home from './pages/Home'; 
import PaymentSuccess from './pages/PaymentSuccess';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import MyTrips from './pages/MyTrips';
import PropertyDetails from './pages/PropertyDetails';




function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Toaster position="top-right" />
        
        {/* The Navbar sits at the top of everything! */}
        <Navbar />
        
        {/* Page Content fills the rest of the screen */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/my-trips" element={<MyTrips />} />
            <Route path="/property/:id" element={<PropertyDetails />} />
          </Routes>
        </main>

        {/* The Footer sits at the bottom of everything! */}
        <Footer /> 
      </div>
    </Router>
  );
}

export default App;