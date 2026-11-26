import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Loader } from '../components/ui';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState(token ? 'working' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This page needs the link from your confirmation email.');
  const { refreshUser } = useContext(AuthContext);
  const sent = useRef(false); // StrictMode runs effects twice in dev; a token works only once

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    api.post('/Auth/verify-email', { token })
      .then((res) => { setState('done'); setMessage(res.data?.message || 'Email confirmed.'); refreshUser(); })
      .catch((error) => { setState('error'); setMessage(errorMessage(error, 'This link is invalid or has expired.')); });
  }, [token, refreshUser]);

  if (state === 'working') return <Loader label="Confirming your email" />;

  return (
    <div className="page grid min-h-[calc(100vh-4rem)] place-items-center py-16">
      <div className="card w-full max-w-md p-8 text-center animate-fade-up">
        <span className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${state === 'done' ? 'bg-lime' : 'bg-red-100 text-red-700'}`}>
          {state === 'done' ? <Check size={22} /> : <X size={22} />}
        </span>
        <h1 className="mt-6 text-3xl font-light tracking-[-0.03em]">{state === 'done' ? 'You’re all set.' : 'That didn’t work.'}</h1>
        <p className="mt-3 text-sm text-muted">{message}</p>
        {state === 'error' && <p className="mt-2 text-sm text-muted">Log in and use “Resend email” in the banner to get a new link.</p>}
        <Link to="/" className="btn-ink btn-lg mt-8 w-full">Continue</Link>
      </div>
    </div>
  );
}
