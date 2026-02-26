import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { UserPlus } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Guest' // Default to Guest
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Send the data, which now includes the 'role', to the .NET backend
      await api.post('/Auth/register', formData);
      
      toast.success(`Account created as a ${formData.role}! Please log in.`);
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="bg-brand p-3 rounded-full text-white">
            <UserPlus size={28} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-brand mb-6">Create an Account</h2>
        
        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* THE NEW ROLE SELECTOR TOGGLE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I want to...</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${formData.role === 'Guest' ? 'border-brand bg-brand/5 text-brand font-semibold' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <input type="radio" name="role" value="Guest" checked={formData.role === 'Guest'} onChange={handleInputChange} className="hidden" />
                Book Places
              </label>
              
              <label className={`flex-1 flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${formData.role === 'Host' ? 'border-brand bg-brand/5 text-brand font-semibold' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <input type="radio" name="role" value="Host" checked={formData.role === 'Host'} onChange={handleInputChange} className="hidden" />
                List Places
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" name="name" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none" placeholder="e.g. Emmanuel" value={formData.name} onChange={handleInputChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" name="email" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none" placeholder="your@email.com" value={formData.email} onChange={handleInputChange} />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" name="password" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none" placeholder="••••••••" value={formData.password} onChange={handleInputChange} />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-brand hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex justify-center mt-6">
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}