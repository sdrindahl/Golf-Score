'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface HoleMapProps {
  userLat: number;
  userLng: number;
  greenLat: number;
  greenLng: number;
  holeName: string;
}

export default function HoleMap({ userLat, userLng, greenLat, greenLng, holeName }: HoleMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const measurementPolyline = useRef<any>(null);
  const currentTapMarker = useRef<any>(null);
  const currentLabel = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ensure this only runs on client
    if (typeof window === 'undefined') return;

    // Prevent double initialization in React strict mode
    if (map.current) return;

    // Dynamically import Leaflet only on client
    import('leaflet').then((leaflet) => {
      const L = leaflet.default;
      
      if (!mapContainer.current) return;

      // Double-check map isn't already initialized (race condition safety)
      if (map.current) return;

      // Initialize map centered between user and green
      const centerLat = (userLat + greenLat) / 2;
      const centerLng = (userLng + greenLng) / 2;

      map.current = L.map(mapContainer.current).setView([centerLat, centerLng], 18);

      // Use satellite imagery
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri',
        maxZoom: 22,
      }).addTo(map.current);

      // Green marker
      L.circleMarker([greenLat, greenLng], {
        radius: 8,
        fillColor: '#22c55e',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .addTo(map.current)
        .bindPopup('Green Center 🚩');

      // User position marker
      L.circleMarker([userLat, userLng], {
        radius: 6,
        fillColor: '#0066ff',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .addTo(map.current)
        .bindPopup('Your Position 📍');

      // Draw initial line from user to green
      measurementPolyline.current = L.polyline([[userLat, userLng], [greenLat, greenLng]], {
        color: 'blue',
        weight: 2,
        opacity: 0.7,
      }).addTo(map.current);

      // Calculate distance helper
      const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371000; // meters
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c) * 1.09361; // convert to yards
      };

      // Tap to add measurement point
      const handleMapClick = (e: any) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        // Remove previous tap marker and label if they exist
        if (currentTapMarker.current) {
          map.current?.removeLayer(currentTapMarker.current);
        }
        if (currentLabel.current) {
          map.current?.removeLayer(currentLabel.current);
        }

        // Add new marker at tap location
        currentTapMarker.current = L.circleMarker([lat, lng], {
          radius: 5,
          fillColor: '#ff9500',
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.7,
        }).addTo(map.current!);

        // Calculate distance from you to tap point
        const distYards = Math.round(getDistance(userLat, userLng, lat, lng));

        // Add label next to marker
        currentLabel.current = L.tooltip({
          permanent: true,
          direction: 'right',
          className: 'hole-map-distance-label',
          offset: [15, 0],
        })
          .setContent(`<strong>${distYards} yd</strong>`)
          .setLatLng([lat, lng])
          .addTo(map.current!);

        // Update the line to snap through the tap point
        if (measurementPolyline.current) {
          measurementPolyline.current.setLatLngs([[userLat, userLng], [lat, lng], [greenLat, greenLng]]);
        }
      };

      map.current.on('click', handleMapClick);
      setIsLoading(false);

      return () => {
        map.current?.off('click', handleMapClick);
        map.current?.remove();
        map.current = null;
      };
    }).catch((err) => {
      console.error('Failed to load Leaflet:', err);
      setIsLoading(false);
    });
  }, [userLat, userLng, greenLat, greenLng]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg">
      <div className="p-3 bg-blue-600 text-white font-semibold text-center border-b">
        {holeName} - Hole Map View
      </div>
      <div ref={mapContainer} className="flex-1" style={{ height: '400px' }} />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
          <div className="text-gray-600">Loading map...</div>
        </div>
      )}
      <div className="p-3 text-xs text-gray-600 border-t bg-gray-50">
        💡 Tap anywhere on the map to measure distance from your position
      </div>
    </div>
  );
}
