import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference'); // Grabs the reference from Paystack's URL

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle size={64} className="text-green-500" />
        </div>
        
        <h2 className="text-3xl font-bold text-brand mb-4">Payment Successful!</h2>
        <p className="text-gray-600 mb-6">
          Your luxury shortlet has been secured. We have received your payment and our webhook is updating your database.
        </p>

        {reference && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8">
            <p className="text-sm text-gray-500 mb-1">Booking Reference</p>
            <p className="font-mono font-bold text-brand">{reference}</p>
          </div>
        )}

        <Link 
          to="/" 
          className="block w-full bg-brand hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}