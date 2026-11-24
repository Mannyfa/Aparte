import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Luggage, KeyRound } from 'lucide-react';
import api, { errorMessage } from '../utils/api';
import AuthLayout from '../components/AuthLayout';

const ROLES = [
  { value: 'guest', icon: Luggage, title: 'I want to book', body: 'Find and pay for stays' },
  { value: 'host', icon: KeyRound, title: 'I want to host', body: 'List places, get paid' },
];

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'guest' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/Auth/register', formData);
      toast.success('Account created. Please log in.');
      navigate('/login');
    } catch (error) {
      toast.error(errorMessage(error, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Create an account"
      title="Join Apartey"
      subtitle="It takes less than a minute. Free for guests and hosts."
      footer={<>Already have an account? <Link to="/login" className="text-ink underline underline-offset-4">Log in</Link></>}
    >
      <form onSubmit={handleRegister} className="space-y-4">
        <fieldset>
          <legend className="label">I’m joining to…</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(({ value, icon: Icon, title, body }) => {
              const active = formData.role === value;
              return (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors ${active ? 'border-ink bg-paper' : 'border-line hover:bg-paper'}`}
                >
                  <input type="radio" name="role" value={value} checked={active} onChange={set} className="sr-only" />
                  <span className={`mb-3 grid h-8 w-8 place-items-center rounded-lg ${active ? 'bg-lime' : 'bg-sand'}`}>
                    <Icon size={16} />
                  </span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-muted">{body}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" name="name" required autoComplete="name" className="input" placeholder="Ada Okafor" value={formData.name} onChange={set} />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@example.com" value={formData.email} onChange={set} />
        </div>
        <div>
          <label htmlFor="phone" className="label">Phone <span className="font-normal text-faint">(optional)</span></label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" placeholder="0803 000 0000" value={formData.phone} onChange={set} />
          {formData.role === 'guest' && <p className="hint">Hosts you book with can see this, so they can reach you about your stay.</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="At least 8 characters" value={formData.password} onChange={set} />
        </div>

        <button type="submit" disabled={loading} className="btn-ink btn-lg w-full">
          {loading ? 'Creating account…' : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthLayout>
  );
}
