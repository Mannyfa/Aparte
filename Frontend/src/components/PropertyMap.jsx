import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet's default marker icon missing in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function PropertyMap({ properties, onBookNow, bookingLoading }) {
  const [locations, setLocations] = useState([]);
  
  // Default center point: Lagos, Nigeria
  const defaultCenter = [6.5244, 3.3792];

  useEffect(() => {
    // This function converts your text addresses into GPS Coordinates!
    const geocodeProperties = async () => {
      const geocoded = await Promise.all(
        properties.map(async (property) => {
          try {
            // Ask OpenStreetMap for the coordinates of the city/state
            const query = `${property.area}, ${property.city}, ${property.state}, Nigeria`;
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data && data.length > 0) {
              return { ...property, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }
            // Fallback to random offset near Lagos if address isn't found perfectly
            return { 
              ...property, 
              lat: defaultCenter[0] + (Math.random() - 0.5) * 0.1, 
              lng: defaultCenter[1] + (Math.random() - 0.5) * 0.1 
            };
          } catch (error) {
            return { ...property, lat: defaultCenter[0], lng: defaultCenter[1] };
          }
        })
      );
      setLocations(geocoded);
    };

    if (properties.length > 0) {
      geocodeProperties();
    }
  }, [properties]);

  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden shadow-lg border border-gray-200 relative z-0">
      <MapContainer center={defaultCenter} zoom={11} scrollWheelZoom={false} className="h-full w-full">
        {/* The beautiful map background from OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Drop a pin for every property */}
        {locations.map((property) => (
          property.lat && property.lng && (
            <Marker key={property.id} position={[property.lat, property.lng]}>
              <Popup className="custom-popup">
                <div className="w-48">
                  <img 
                    src={property.imageUrl || "https://via.placeholder.com/150"} 
                    alt={property.title} 
                    className="w-full h-24 object-cover rounded-t-lg mb-2"
                  />
                  <h3 className="font-bold text-sm text-brand truncate">{property.title}</h3>
                  <p className="text-xs text-gray-500 mb-2">{property.city}, {property.state}</p>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-brand">₦{property.pricePerNight.toLocaleString()}</span>
                    <button 
                      onClick={() => onBookNow(property.id)}
                      disabled={bookingLoading === property.id}
                      className="bg-accent text-white text-xs px-2 py-1 rounded font-bold"
                    >
                      Book
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}