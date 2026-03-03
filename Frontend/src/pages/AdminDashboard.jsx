import React, { useState, useEffect, useContext } from 'react';
import { ShieldAlert, CheckCircle, XCircle, ExternalLink, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [pendingHosts, setPendingHosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Security Check: If they aren't logged in OR aren't the admin, kick them out!
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchPendingKyc();
  }, []);

  const fetchPendingKyc = async () => {
    try {
      const response = await api.get('/Admin/pending-kyc');
      setPendingHosts(response.data);
    } catch (error) {
      toast.error("Failed to load pending verifications.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (hostId, hostName) => {
    try {
      await api.post(`/Admin/kyc/${hostId}/approve`);
      toast.success(`${hostName} approved!`);
      setPendingHosts(prev => prev.filter(h => h.id !== hostId));
    } catch (error) {
      toast.error("Failed to approve host.");
    }
  };

  const handleReject = async (hostId, hostName) => {
    if (!window.confirm(`Are you sure you want to reject ${hostName}'s document?`)) return;
    
    try {
      await api.post(`/Admin/kyc/${hostId}/reject`);
      toast.success(`${hostName} rejected.`);
      setPendingHosts(prev => prev.filter(h => h.id !== hostId));
    } catch (error) {
      toast.error("Failed to reject host.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center gap-3 mb-8">
          <Activity size={32} className="text-red-600" />
          <div>
            <h1 className="text-3xl font-black text-gray-900">Command Center</h1>
            <p className="text-gray-500">Platform oversight and host verification.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2">
              <ShieldAlert size={18} className="text-yellow-400" /> 
              Pending KYC Verifications
            </h2>
            <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
              {pendingHosts.length} Action Required
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500 font-bold animate-pulse">Scanning database...</div>
          ) : pendingHosts.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
              <h3 className="text-lg font-bold text-gray-700">Inbox Zero</h3>
              <p className="text-gray-500">All hosts have been reviewed. Great job!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                    <th className="p-4 font-bold">Host Details</th>
                    <th className="p-4 font-bold">Document Type</th>
                    <th className="p-4 font-bold">Attachment</th>
                    <th className="p-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingHosts.map(host => (
                    <tr key={host.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4">
                        <p className="font-bold text-gray-900">{host.name}</p>
                        <p className="text-xs text-gray-500">{host.email} • {host.phone}</p>
                      </td>
                      <td className="p-4">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-xs font-bold">
                          {host.documentType || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-4">
                        <a 
                          href={host.documentUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1 text-brand hover:text-blue-700 font-bold text-sm"
                        >
                          View Document <ExternalLink size={14} />
                        </a>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleReject(host.id, host.name)}
                            className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded font-bold text-sm transition-colors"
                          >
                            Reject
                          </button>
                          <button 
                            onClick={() => handleApprove(host.id, host.name)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded font-bold text-sm transition-colors shadow-sm"
                          >
                            Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}