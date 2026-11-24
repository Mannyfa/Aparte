import React, { useState, useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api, { errorMessage } from '../utils/api';
import AuthLayout from '../components/AuthLayout';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/Auth/login', { email, password });
      login({ id: data.userId, name: data.name, role: data.role }, data.token);
      toast.success(`Welcome back, ${data.name.split(' ')[0]}!`);

      // Return to the page that sent them here (e.g. a listing), otherwise their home base.
      const from = location.state?.from;
      const role = (data.role || '').toLowerCase();
      navigate(from || (role === 'host' ? '/dashboard' : role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, 'Login failed. Check your email and password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Log in to Apartey"
      subtitle="Pick up where you left off: trips, bookings and payouts."
      footer={<>New here? <Link to="/register" className="text-ink underline underline-offset-4">Create an account</Link></>}
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="btn-ink btn-lg w-full">
          {loading ? 'Signing in…' : <>Log in <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthLayout>
  );
}
