import React, { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { Copy, Share2, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { EmptyState } from '../components/ui';
import { Bone } from '../components/Skeletons';
import { naira, formatDay } from '../utils/format';

const reasonLabel = (r) => (r === 'referral_reward' ? 'Referral reward' : r);

export default function Referrals() {
  const { isAuthenticated } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/referrals/me')
      .then((res) => setData(res.data))
      .catch((error) => toast.error(errorMessage(error, 'Failed to load your referrals.')))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      toast.success('Link copied');
    } catch {
      toast('Copy not available here. Select the link and copy it manually.');
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: 'Join me on Apartey',
        text: `Sign up with my link and we both get ${naira(data.rewardAmount)} credit after your first stay.`,
        url: data.link,
      });
    } catch {
      /* dismissed */
    }
  };

  const reward = naira(data?.rewardAmount ?? 5000);
  const share50 = Math.round((data?.maxCreditShare ?? 0.5) * 100);

  return (
    <div className="page max-w-3xl pb-24 pt-10">
      <p className="eyebrow mb-4">Referrals</p>
      <h1 className="h-page">Invite friends, earn credit</h1>
      <p className="lead mt-3">
        You and your friend each get {reward} after their first completed stay. Credit covers at most {share50}% of a booking and only comes out of Apartey&apos;s platform fee.
      </p>

      {loading ? (
        <div className="mt-10 space-y-4" aria-hidden="true">
          <Bone className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3"><Bone className="h-24 rounded-2xl" /><Bone className="h-24 rounded-2xl" /></div>
          <Bone className="h-40 w-full rounded-2xl" />
        </div>
      ) : !data ? null : (
        <>
          <div className="card card-pad mt-10">
            <p className="label">Your referral link</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly className="input mono min-w-0 flex-1" value={data.link} onFocus={(e) => e.target.select()} aria-label="Referral link" />
              <div className="flex gap-2">
                <button onClick={copy} className="btn-ink flex-1 sm:flex-none"><Copy size={15} /> Copy</button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button onClick={share} className="btn-outline flex-1 sm:flex-none"><Share2 size={15} /> Share</button>
                )}
              </div>
            </div>
            <p className="hint">Code: <span className="mono">{data.code}</span></p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="card p-5">
              <p className="text-xs text-muted">Credit balance</p>
              <p className="mono mt-2 text-2xl font-medium">{naira(data.balance)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-muted">Friends who stayed</p>
              <p className="mono mt-2 text-2xl font-medium">{data.referredCount}</p>
            </div>
          </div>

          <h2 className="mb-3 mt-10 text-lg font-medium">Recent credit</h2>
          {data.credits?.length ? (
            <ul className="card divide-y divide-line">
              {data.credits.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <div>
                    <p className="font-medium">{reasonLabel(c.reason)}</p>
                    <p className="text-xs text-muted">{formatDay(c.createdAt)}</p>
                  </div>
                  <span className="mono">{c.amount >= 0 ? '+' : ''}{naira(c.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Gift} title="No credit yet">Share your link. Credit shows up here after a friend completes their first stay.</EmptyState>
          )}
        </>
      )}
    </div>
  );
}
