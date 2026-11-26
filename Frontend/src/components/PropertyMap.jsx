import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { img } from '../utils/format';

// Leaflet's default marker images don't resolve under Vite; point them at the bundled files.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// Default center point: Lagos, Nigeria
const DEFAULT_CENTER = [6.5244, 3.3792];

// Nominatim's usage policy allows ~1 request/second, so lookups are cached and made one at a time.
const geocodeCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(query) {
  if (geocodeCache.has(query)) return geocodeCache.get(query);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    const result = data?.length ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    geocodeCache.set(query, result);
    return result;
  } catch {
    return null; // not cached: try again next time
  }
}

export default function PropertyMap({ properties }) {
  const [locations, setLocations] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const geocodeProperties = async () => {
      const results = [];
      for (const property of properties) {
        const query = [property.area, property.city, property.state, 'Nigeria'].filter(Boolean).join(', ');
        const wasCached = geocodeCache.has(query);
        const coords = await geocode(query);
        if (cancelled) return;
        // Properties we can't place are left off the map instead of being dropped at a random spot.
        if (coords) results.push({ ...property, ...coords });
        setLocations([...results]);
        if (!wasCached) await sleep(1100);
      }
    };

    if (properties.length > 0) geocodeProperties();
    return () => { cancelled = true; };
  }, [properties]);

  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden shadow-lg border border-gray-200 relative z-0">
      <MapContainer center={DEFAULT_CENTER} zoom={11} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* only pins for the properties currently listed (the list changes when searching/paging) */}
        {locations.filter((l) => properties.some((p) => p.id === l.id)).map((property) => (
          <Marker key={property.id} position={[property.lat, property.lng]}>
            <Popup className="custom-popup">
              <div className="w-48">
                {property.imageUrls?.[0] && (
                  <img
                    src={img(property.imageUrls[0], 320)}
                    alt={property.title}
                    className="w-full h-24 object-cover rounded-t-lg mb-2"
                  />
                )}
                <h3 className="font-bold text-sm text-brand truncate">{property.title}</h3>
                <p className="text-xs text-gray-500 mb-2">{property.city}, {property.state}</p>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-brand">₦{Number(property.pricePerNight).toLocaleString()}</span>
                  <button
                    onClick={() => navigate(`/property/${property.id}`)}
                    className="bg-accent text-white text-xs px-2 py-1 rounded font-bold"
                  >
                    View
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
