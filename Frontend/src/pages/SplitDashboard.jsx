import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Copy, CheckCircle, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function SplitDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [splitData, setSplitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payingShareId, setPayingShareId] = useState(null);

  useEffect(() => {
    const fetchSplit = async () => {
      try {
        const res = await api.get(`/Bookings/split/${id}`);
        setSplitData(res.data);
      } catch (error) {
        toast.error("Could not load split group.");
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchSplit();
  }, [id, navigate]);

  const copyLink = (shareId) => {
    const url = `${window.location.origin}/split-success/${id}`;
    navigator.clipboard.writeText(`Hey! Here is the link to pay your share for our Apartey booking: ${url}`);
    toast.success("Link copied! Send it via WhatsApp.");
  };

  const handlePayShare = async (shareId) => {
    
    const email = prompt("Enter your email address for the receipt:");
    if (!email) return;

    setPayingShareId(shareId);
    try {
      const res = await api.post(`/Bookings/split/${shareId}/pay`, { email });
      window.location.href = res.data.paymentUrl; 
    } catch (error) {
      toast.error(error.response?.data || "Failed to initiate payment.");
      setPayingShareId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center"><div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!splitData) return null;

  const progressPct = (splitData.paidShares / splitData.totalShares) * 100;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="bg-brand/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-brand" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">Apartey Split Group</h1>
          <p className="text-lg text-gray-600">Booking for: <span className="font-bold text-brand">{splitData.propertyTitle}</span></p>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8 animate-fade-in">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Group Progress</p>
              <p className="text-2xl font-black text-gray-900">{splitData.paidShares} of {splitData.totalShares} Paid</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Total Booking</p>
              <p className="text-2xl font-black text-brand">₦{splitData.totalAmount.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-4 mb-4 overflow-hidden">
            <div className="bg-brand h-4 rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }}></div>
          </div>

          {splitData.status === "Completed" ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-3 font-bold border border-green-200">
              <CheckCircle size={24} /> Group fully funded! Booking is confirmed.
            </div>
          ) : (
            <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl flex items-center gap-3 font-bold border border-yellow-200 text-sm">
              <Clock size={20} /> Waiting on remaining payments to confirm this booking.
            </div>
          )}
        </div>

        {/* Slices */}
        <h3 className="text-xl font-bold text-gray-900 mb-4 px-2">Payment Links</h3>
        <div className="space-y-4">
          {splitData.shares.map((share, index) => (
            <div key={share.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${share.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {share.status === 'Paid' ? <CheckCircle size={20}/> : `#${index + 1}`}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">Share {index + 1}</p>
                  <p className="text-gray-500 font-medium">₦{share.amount.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {share.status === 'Paid' ? (
                  <span className="bg-green-50 text-green-700 px-4 py-2 rounded-lg font-bold text-sm border border-green-200">Payment Complete</span>
                ) : (
                  <>
                    <button onClick={() => copyLink(share.id)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                      <Copy size={16}/> Copy Link
                    </button>
                    <button 
                      onClick={() => handlePayShare(share.id)}
                      disabled={payingShareId === share.id}
                      className="bg-brand hover:bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-70"
                    >
                      {payingShareId === share.id ? 'Loading...' : 'Pay Share'} <ArrowRight size={16}/>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-12 font-medium flex items-center justify-center gap-1">
          <ShieldCheck size={14}/> Funds held securely in Apartey Escrow until the group is complete.
        </p>

      </div>
    </div>
  );
}