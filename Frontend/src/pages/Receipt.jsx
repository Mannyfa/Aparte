import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, FileX } from 'lucide-react';
import api, { errorMessage } from '../utils/api';
import { naira, formatDay } from '../utils/format';
import { Logo, StatusBadge, EmptyState } from '../components/ui';
import { Bone } from '../components/Skeletons';

export default function Receipt() {
  const { bookingId } = useParams();
  const [state, setState] = useState({ id: null, receipt: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    api.get(`/receipts/${bookingId}`)
      .then((res) => { if (!cancelled) setState({ id: bookingId, receipt: res.data, error: '' }); })
      .catch((err) => { if (!cancelled) setState({ id: bookingId, receipt: null, error: errorMessage(err, "We couldn't load this receipt.") }); });
    return () => { cancelled = true; };
  }, [bookingId]);

  const loading = state.id !== bookingId;
  const { receipt, error } = state;

  const line = (label, value, { strong = false, minus = false, note } = {}) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className={strong ? 'font-medium text-ink' : 'text-muted'}>
        {label}
        {note && <span className="block text-xs text-faint">{note}</span>}
      </span>
      <span className={`mono shrink-0 ${strong ? 'text-lg font-medium' : ''}`}>{minus ? '−' : ''}{naira(value, { decimals: 2 })}</span>
    </div>
  );

  return (
    <div className="page max-w-2xl py-6 md:py-10">
      <div className="print-hide mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/my-trips" className="btn-ghost btn-sm -ml-3"><ArrowLeft size={14} /> Back</Link>
        {receipt && <button type="button" onClick={() => window.print()} className="btn-ink btn-sm"><Printer size={14} /> Print / Save as PDF</button>}
      </div>

      {loading ? (
        <div className="card space-y-4 p-6" aria-hidden="true">
          <Bone className="h-6 w-40" /><Bone className="h-4 w-2/3" /><Bone className="h-4 w-1/2" /><Bone className="h-32 w-full" />
        </div>
      ) : error || !receipt ? (
        <EmptyState icon={FileX} title="Receipt unavailable">{error || 'This receipt could not be found.'}</EmptyState>
      ) : (
        <div className="print-area card card-pad">
          <div className="print-block flex items-start justify-between gap-4 border-b border-line pb-5">
            <div>
              <Logo />
              <p className="mt-2 text-xs text-muted">Booking receipt</p>
            </div>
            <div className="text-right">
              <StatusBadge status={receipt.status} />
              <p className="mono mt-2 break-all text-xs text-muted">Ref {receipt.reference}</p>
              <p className="mt-1 text-xs text-faint">Issued {formatDay(receipt.createdAt)}</p>
            </div>
          </div>

          <div className="print-block grid gap-4 border-b border-line py-5 text-sm sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-1 text-faint">Property</p>
              <p className="font-medium">{receipt.propertyTitle}</p>
              {receipt.hostName && <p className="text-muted">Host: {receipt.hostName}</p>}
            </div>
            <div>
              <p className="eyebrow mb-1 text-faint">Guest</p>
              <p className="font-medium">{receipt.guestName}</p>
            </div>
            <div>
              <p className="eyebrow mb-1 text-faint">Check-in</p>
              <p className="mono">{formatDay(receipt.checkIn)}</p>
            </div>
            <div>
              <p className="eyebrow mb-1 text-faint">Check-out</p>
              <p className="mono">{formatDay(receipt.checkOut)}</p>
            </div>
          </div>

          <div className="print-block py-4">
            {line(`Room (${receipt.nights} night${receipt.nights === 1 ? '' : 's'})`, receipt.roomAmount)}
            {receipt.addOns?.length > 0 && (
              <div className="py-1">
                <p className="text-sm text-muted">Add-ons</p>
                <ul className="ml-3">
                  {receipt.addOns.map((a, i) => (
                    <li key={`${a.name}-${i}`} className="flex items-baseline justify-between gap-4 py-0.5 text-sm">
                      <span className="text-muted">{a.name}</span>
                      <span className="mono shrink-0">{naira(a.price, { decimals: 2 })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {line('Platform fee', receipt.platformFee)}
            {receipt.promoDiscount > 0 && line('Promo discount', receipt.promoDiscount, { minus: true })}
            {receipt.creditApplied > 0 && line('Referral credit', receipt.creditApplied, { minus: true })}
            {receipt.cautionFee > 0 && line('Caution deposit', receipt.cautionFee, { note: 'Refundable deposit, held in escrow' })}
          </div>

          <div className="print-block divider pt-4">
            {line('Total paid', receipt.total, { strong: true })}
            <p className="mt-1 text-right text-xs text-faint">Currency: {receipt.currency || 'NGN'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
