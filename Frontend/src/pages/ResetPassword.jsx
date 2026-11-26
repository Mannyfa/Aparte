import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import AuthLayout from '../components/AuthLayout';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("The two passwords don't match.");
    setLoading(true);
    try {
      const res = await api.post('/Auth/reset-password', { token, password });
      toast.success(res.data?.message || 'Password updated.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't reset your password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Reset password"
      title="Choose a new password"
      subtitle="Use at least 8 characters."
      footer={<>Link expired? <Link to="/forgot-password" className="text-ink underline underline-offset-4">Send a new one</Link></>}
    >
      {!token ? (
        <p className="card p-5 text-sm text-muted">This page needs the link from your reset email. <Link to="/forgot-password" className="text-ink underline">Request a new one</Link>.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="password" className="label">New password</label>
            <input id="password" type="password" required minLength={8} autoComplete="new-password" className="input"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label htmlFor="confirm" className="label">Confirm new password</label>
            <input id="confirm" type="password" required minLength={8} autoComplete="new-password" className="input"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="btn-ink btn-lg w-full">{loading ? 'Saving…' : 'Update password'}</button>
        </form>
      )}
    </AuthLayout>
  );
}
