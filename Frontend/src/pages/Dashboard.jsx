import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Home as HomeIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';

export default function Dashboard() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'Apartment',
    pricePerNight: '',
    city: '',
    state: '',
    area: '',
    image: null // This will hold the actual file
  });

  // Redirect if not logged in
 if (!isAuthenticated || user?.role !== 'Host') {
    toast.error("Unauthorized. Only Hosts can access this page.");
    navigate('/');
    return null;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, image: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Because we are sending a file, we MUST use FormData instead of standard JSON
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('type', formData.type);
      submitData.append('pricePerNight', formData.pricePerNight);
      submitData.append('city', formData.city);
      submitData.append('state', formData.state);
      submitData.append('area', formData.area);
      
      if (formData.image) {
        submitData.append('image', formData.image);
      }

      // Send to your C# Backend!
      await api.post('/Properties', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Property listed successfully!');
      navigate('/'); // Take them back to the home page to see their new listing

    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to list property.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md">
        
        <div className="flex items-center gap-3 border-b pb-4 mb-6">
          <div className="bg-brand p-2 rounded-lg text-white">
            <HomeIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand">Host Dashboard</h1>
            <p className="text-sm text-gray-500">List a new luxury shortlet, {user?.name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Title</label>
              <input type="text" name="title" required value={formData.title} onChange={handleInputChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                placeholder="e.g. Luxury 4-Bed Penthouse in Lekki" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" required value={formData.description} onChange={handleInputChange} rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                placeholder="Describe the amenities, power situation, and vibe..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
              <select name="type" value={formData.type} onChange={handleInputChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none">
                <option value="Apartment">Apartment</option>
                <option value="Penthouse">Penthouse</option>
                <option value="Duplex">Duplex</option>
                <option value="Studio">Studio</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Night (₦)</label>
              <input type="number" name="pricePerNight" required value={formData.pricePerNight} onChange={handleInputChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                placeholder="e.g. 150000" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input type="text" name="state" required value={formData.state} onChange={handleInputChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                placeholder="e.g. Lagos" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" name="city" required value={formData.city} onChange={handleInputChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                placeholder="e.g. Lekki" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Area / Address</label>
              <input type="text" name="area" required value={formData.area} onChange={handleInputChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                placeholder="e.g. Phase 1, Admiralty Way" />
            </div>

            {/* Image Upload Area */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Property Image</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 font-semibold">
                      {formData.image ? formData.image.name : "Click to upload a high-quality image"}
                    </p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} required />
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" disabled={loading}
              className="w-full bg-brand hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors">
              {loading ? 'Uploading & Saving to Database...' : 'List Property'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}