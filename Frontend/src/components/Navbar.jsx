import React, { useContext, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { Logo } from './ui';
import { initials } from '../utils/format';

const sectionLinks = [
  { href: '/#stays', label: 'Stays' },
  { href: '/#how', label: 'How it works' },
  { href: '/#hosts', label: 'For hosts' },
  { href: '/#faq', label: 'FAQ' },
];

export default function Navbar() {
  const { user, logout, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The mobile menu closes itself when one of its links is tapped (see onClick below).

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/');
  };

  const role = user?.role;
  const appLinks = isAuthenticated
    ? [
        ...(role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
        ...(role === 'host' ? [{ to: '/dashboard', label: 'Dashboard' }] : [{ to: '/my-trips', label: 'My trips' }]),
      ]
    : [];

  const navLinkClass = ({ isActive }) =>
    `text-[13px] transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled || open ? 'border-line bg-cream/85 backdrop-blur-md' : 'border-transparent bg-cream'
      }`}
    >
      <div className="page flex h-16 items-center justify-between gap-6">
        <Logo />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {sectionLinks.map((l) => (
            <Link key={l.href} to={l.href} className="text-[13px] text-muted transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
          {appLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <span className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-[13px]">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-lime font-mono text-[10px] text-ink">
                  {initials(user?.name)}
                </span>
                <span className="max-w-[9rem] truncate">{user?.name}</span>
              </span>
              <button onClick={handleLogout} className="btn-ghost btn-sm" aria-label="Log out">
                <LogOut size={14} /> Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm">Log in</Link>
              <Link to="/register" className="btn-lime btn-sm">Get started</Link>
            </>
          )}
        </div>

        <button
          className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-paper md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-cream md:hidden">
          <nav className="page flex flex-col py-3" aria-label="Mobile">
            {[...sectionLinks.map((l) => ({ to: l.href, label: l.label })), ...appLinks].map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="border-b border-line/70 py-3 text-[15px] text-ink last:border-0">
                {l.label}
              </Link>
            ))}
            <div className="mt-4 flex gap-2 pb-2">
              {isAuthenticated ? (
                <button onClick={handleLogout} className="btn-outline flex-1"><LogOut size={14} /> Log out</button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="btn-outline flex-1">Log in</Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="btn-lime flex-1">Get started</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
