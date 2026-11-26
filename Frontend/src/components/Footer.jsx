import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './ui';

const columns = [
  {
    title: 'Guests',
    links: [
      { to: '/#stays', label: 'Browse stays' },
      { to: '/#how', label: 'How booking works' },
      { to: '/my-trips', label: 'My trips' },
    ],
  },
  {
    title: 'Hosts',
    links: [
      { to: '/register', label: 'List your place' },
      { to: '/dashboard', label: 'Host dashboard' },
      { to: '/#hosts', label: 'Why Apartey' },
    ],
  },
  {
    title: 'Help',
    links: [
      { to: '/#faq', label: 'FAQ' },
      { to: '/#trust', label: 'Payments & escrow' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-cream">
      <div className="page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Verified shortlets across Nigeria, with refundable caution fees held in escrow and bookings you can split with friends.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="eyebrow mb-4 text-faint">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-muted transition-colors hover:text-ink">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line pb-safe">
        <div className="page flex flex-col gap-2 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Apartey. All rights reserved.</p>
          <p className="font-mono uppercase tracking-[0.08em]">Payments secured by Paystack</p>
        </div>
      </div>
    </footer>
  );
}
