import React from 'react';
import { Check } from 'lucide-react';

/** Two-column auth layout: form on the left, a quiet lime panel on the right (desktop only). */
export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="page grid min-h-[calc(100vh-4rem)] grid-cols-1 items-center gap-12 py-12 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-sm animate-fade-up">
        <p className="eyebrow mb-4">{eyebrow}</p>
        <h1 className="text-4xl font-light tracking-[-0.04em]">{title}</h1>
        {subtitle && <p className="mt-3 text-sm text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <p className="mt-8 text-sm text-muted">{footer}</p>}
      </div>

      <aside className="hidden h-full min-h-[520px] flex-col justify-between rounded-3xl bg-lime p-10 lg:flex">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink/70">Why Apartey</p>
        <div>
          <p className="display text-5xl">Book with <br />confidence.</p>
          <ul className="mt-8 space-y-3 text-[15px] text-ink/80">
            {[
              'Hosts verified with government ID',
              'Refundable caution fees held in escrow',
              'Full refund if a host declines',
              'Split any booking with up to 5 friends',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded bg-ink text-lime"><Check size={12} /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink/60">Payments secured by Paystack</p>
      </aside>
    </div>
  );
}
