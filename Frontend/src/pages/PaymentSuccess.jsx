import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  return (
    <div className="page grid min-h-[calc(100vh-4rem)] place-items-center py-16">
      <div className="card w-full max-w-md p-8 text-center animate-fade-up">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-lime"><Check size={22} /></span>
        <p className="eyebrow mt-6">Payment received</p>
        <h1 className="mt-3 text-3xl font-light tracking-[-0.03em]">You’re almost there.</h1>
        <p className="mt-3 text-sm text-muted">
          We’re confirming your payment with Paystack. Your host will then review the booking, and your check-in code will appear in My Trips once they accept.
        </p>
        {reference && (
          <div className="inset mt-6 px-4 py-3 text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Reference</p>
            <p className="mono mt-1 break-all text-sm">{reference}</p>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Link to="/my-trips" className="btn-ink btn-lg flex-1">View my trips <ArrowRight size={16} /></Link>
          <Link to="/" className="btn-outline btn-lg flex-1">Back home</Link>
        </div>
      </div>
    </div>
  );
}
