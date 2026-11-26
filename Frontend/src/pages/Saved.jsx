import React, { useState, useEffect, useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Heart, MapPin, ImageOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { EmptyState, SaveHeart } from '../components/ui';
import { PropertyGridSkeleton } from '../components/Skeletons';
import { naira, img } from '../utils/format';

function SavedCard({ item, onToggled }) {
  return (
    <div className="relative">
      <Link
        to={`/property/${item.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-shadow hover:shadow-lift"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-sand">
          {item.imageUrl ? (
            <img
              src={img(item.imageUrl, 640)}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-faint"><ImageOff size={20} /></div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-1 font-medium">{item.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{[item.area, item.city].filter(Boolean).join(', ')}</span>
          </p>
          <div className="mt-4 border-t border-line pt-3">
            <span className="mono text-[15px]">{naira(item.pricePerNight)}</span>
            <span className="text-xs text-faint"> / night</span>
          </div>
        </div>
      </Link>
      <SaveHeart propertyId={item.id} className="absolute right-2 top-2" onChange={(saved) => onToggled(item, saved)} />
    </div>
  );
}

export default function Saved() {
  const { token } = useContext(AuthContext);
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    api.get('/saved')
      .then(({ data }) => { if (!cancelled) setItems(data || []); })
      .catch((error) => {
        if (cancelled) return;
        toast.error(errorMessage(error, 'Failed to load your saved stays.'));
        setItems([]);
      });
    return () => { cancelled = true; };
  }, [token]);

  if (!token) return <Navigate to="/login" replace state={{ from: '/saved' }} />;

  // Un-saving removes the card at once; if the request fails the heart reverts and the card returns.
  const handleToggled = (item, saved) => {
    if (saved) setItems((list) => (list.some((x) => x.id === item.id) ? list : [item, ...list]));
    else setItems((list) => list.filter((x) => x.id !== item.id));
  };

  return (
    <div className="page pb-24 pt-8">
      <p className="eyebrow mb-3">Your shortlist</p>
      <h1 className="text-3xl font-light tracking-[-0.035em] md:text-5xl">Saved stays</h1>
      <div className="mt-8">
        {items === null ? (
          <PropertyGridSkeleton count={3} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No saved stays yet"
            action={<Link to="/#stays" className="btn-ink">Browse stays</Link>}
          >
            Tap the heart on any stay to keep it here for later.
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => <SavedCard key={item.id} item={item} onToggled={handleToggled} />)}
          </div>
        )}
      </div>
    </div>
  );
}
