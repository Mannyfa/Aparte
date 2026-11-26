import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MailCheck } from 'lucide-react';
import api, { errorMessage } from '../utils/api';
import AuthLayout from '../components/AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/Auth/forgot-password', { email });
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Forgot password"
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a link."
      footer={<>Remembered it? <Link to="/login" className="text-ink underline underline-offset-4">Log in</Link></>}
    >
      {sent ? (
        <div className="card flex gap-3 p-5 animate-fade-up">
          <MailCheck size={20} className="mt-0.5 shrink-0 text-lime-deep" />
          <div className="text-sm">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-muted">If <span className="text-ink">{email}</span> has an Apartey account, a reset link is on its way. It works for 1 hour. Check spam if you don't see it.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="btn-ink btn-lg w-full">{loading ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthLayout>
  );
}
