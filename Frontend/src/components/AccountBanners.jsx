import React, { useContext, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MailWarning, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

/** Thin bar under the navbar asking signed-in users to confirm their email (dismissible per session). */
export default function AccountBanners() {
  const { user, isAuthenticated } = useContext(AuthContext);
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('apartey:verify-banner') === '1'; } catch { return false; } });
  const [sending, setSending] = useState(false);

  // Only when we know for sure it's unconfirmed (older sessions have no flag until /Auth/me answers).
  if (!isAuthenticated || user?.emailConfirmed !== false || hidden || pathname.startsWith('/verify-email')) return null;

  const resend = async () => {
    setSending(true);
    try {
      const res = await api.post('/Auth/resend-verification');
      toast.success(res.data?.message || 'Confirmation email sent.');
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't send the email. Try again in a minute."));
    } finally {
      setSending(false);
    }
  };

  const dismiss = () => {
    try { sessionStorage.setItem('apartey:verify-banner', '1'); } catch { /* private mode */ }
    setHidden(true);
  };

  return (
    <div className="border-b border-line bg-lime-soft">
      <div className="page flex items-center gap-3 py-2 text-[13px]">
        <MailWarning size={15} className="shrink-0" />
        <p className="flex-1">Please confirm your email address. We sent a link to <span className="font-medium">{user.email || 'your inbox'}</span>.</p>
        <button onClick={resend} disabled={sending} className="btn-ghost btn-sm shrink-0 underline underline-offset-4">{sending ? 'Sending…' : 'Resend email'}</button>
        <button onClick={dismiss} className="btn-ghost btn-sm -mr-2 shrink-0" aria-label="Dismiss"><X size={14} /></button>
      </div>
    </div>
  );
}
