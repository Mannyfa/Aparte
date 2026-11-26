import React from 'react';

/**
 * Skeleton placeholders that mirror the real layouts, so content slides into place instead of the
 * page jumping from a spinner to a full layout. All are aria-hidden; a single status label is
 * announced for screen readers.
 */

export const Bone = ({ className = '' }) => <div className={`skeleton ${className}`} />;

const Announce = ({ label }) => <span className="sr-only" role="status">{label}</span>;

/** Mirrors the listing card on the home page. */
export function PropertyCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper" aria-hidden="true">
      <Bone className="aspect-[4/3] rounded-none" />
      <div className="flex flex-1 flex-col p-4">
        <Bone className="h-4 w-3/4" />
        <Bone className="mt-2.5 h-3 w-1/2" />
        <div className="mt-5 flex items-end justify-between border-t border-line pt-3">
          <Bone className="h-4 w-24" />
          <Bone className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
}

export function PropertyGridSkeleton({ count = 6 }) {
  return (
    <>
      <Announce label="Loading stays" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => <PropertyCardSkeleton key={i} />)}
      </div>
    </>
  );
}

/** Mirrors the property page: header, gallery, details column and booking widget. */
export function PropertyDetailsSkeleton() {
  return (
    <div className="page pb-24 pt-6" aria-hidden="true">
      <Announce label="Loading stay" />
      <Bone className="mb-6 h-7 w-24" />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full max-w-xl">
          <div className="mb-3 flex gap-1.5"><Bone className="h-5 w-20" /><Bone className="h-5 w-24" /></div>
          <Bone className="h-10 w-full md:h-12" />
          <Bone className="mt-3 h-4 w-56" />
        </div>
        <Bone className="h-7 w-36" />
      </div>
      <Bone className="aspect-[16/9] w-full rounded-2xl md:aspect-[16/7]" />
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-b border-line pb-8">
            <Bone className="h-10 w-10 rounded-full" />
            <div className="space-y-2"><Bone className="h-4 w-40" /><Bone className="h-3 w-52" /></div>
          </div>
          <div className="space-y-2.5">
            <Bone className="h-3 w-28" />
            <Bone className="h-4 w-full" /><Bone className="h-4 w-full" /><Bone className="h-4 w-11/12" /><Bone className="h-4 w-3/5" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-5 w-4/5" />)}
          </div>
        </div>
        <div className="card space-y-4 p-5">
          <Bone className="h-3 w-16" />
          <Bone className="h-14 w-full rounded-xl" />
          <Bone className="h-12 w-full rounded-lg" />
          <Bone className="mx-auto h-3 w-44" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors a trip card on My Trips. */
export function TripGridSkeleton({ count = 3 }) {
  return (
    <>
      <Announce label="Loading trips" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card flex flex-col overflow-hidden">
            <Bone className="aspect-[16/9] rounded-none" />
            <div className="space-y-2.5 p-5">
              <Bone className="h-4 w-3/4" />
              <Bone className="h-3 w-2/3" />
              <Bone className="h-3 w-1/3" />
              <div className="border-t border-line pt-4"><Bone className="h-10 w-full rounded-xl" /></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Row list (bookings, admin queue, recent requests). */
export function ListSkeleton({ rows = 4, label = 'Loading' }) {
  return (
    <>
      <Announce label={label} />
      <ul className="card divide-y divide-line" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-4 p-5">
            <div className="flex flex-1 items-center gap-3">
              <Bone className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2"><Bone className="h-4 w-1/2" /><Bone className="h-3 w-1/3" /></div>
            </div>
            <Bone className="h-7 w-20 rounded-lg" />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Four stat tiles (host overview). */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <Bone className="h-3 w-24" /><Bone className="h-7 w-28" /><Bone className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Host overview: heading, stats and a short list. */
export function OverviewSkeleton() {
  return (
    <div>
      <Announce label="Loading dashboard" />
      <div className="mb-8 space-y-3" aria-hidden="true"><Bone className="h-3 w-20" /><Bone className="h-9 w-72" /><Bone className="h-4 w-64" /></div>
      <StatsSkeleton />
      <div className="mt-10"><ListSkeleton rows={3} label="" /></div>
    </div>
  );
}

/** Host listings grid. */
export function ListingCardsSkeleton({ count = 3 }) {
  return (
    <>
      <Announce label="Loading listings" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card overflow-hidden">
            <Bone className="aspect-[16/10] rounded-none" />
            <div className="space-y-2 p-4"><Bone className="h-4 w-3/4" /><Bone className="h-3 w-1/2" /><Bone className="mt-3 h-4 w-28" /></div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Wallet: balance panel + transactions. */
export function WalletSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]" aria-hidden="true">
      <Announce label="Loading wallet" />
      <div className="space-y-4 rounded-2xl bg-night p-6">
        <div className="h-3 w-28 rounded bg-cream/10" />
        <div className="h-10 w-44 rounded bg-cream/10" />
        <div className="mt-10 h-12 w-full rounded-lg bg-cream/10" />
      </div>
      <div className="card card-pad space-y-4">
        <Bone className="h-3 w-32" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between gap-4"><Bone className="h-4 w-2/3" /><Bone className="h-4 w-20" /></div>
        ))}
      </div>
    </div>
  );
}

/** Split payment page. */
export function SplitSkeleton() {
  return (
    <div className="page max-w-3xl pb-24 pt-10" aria-hidden="true">
      <Announce label="Loading group" />
      <Bone className="h-3 w-24" />
      <Bone className="mt-4 h-12 w-3/4" />
      <Bone className="mt-3 h-4 w-60" />
      <div className="card mt-10 space-y-5 p-6">
        <div className="flex justify-between"><Bone className="h-9 w-24" /><Bone className="h-9 w-32" /></div>
        <Bone className="h-2 w-full rounded-full" />
        <Bone className="h-4 w-64" />
      </div>
      <div className="mt-12"><ListSkeleton rows={3} label="" /></div>
    </div>
  );
}
