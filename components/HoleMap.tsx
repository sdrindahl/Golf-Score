"use client";
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
    let leafletInstance: any = null;
    let cleanup = () => {};
    import('leaflet').then((leaflet) => {
      const L = leaflet.default;
      // Initialize map if not already
      if (!map.current && mapContainer.current) {
        map.current = L.map(mapContainer.current, {
          center: [userLat, userLng],
          zoom: 17,
          zoomControl: false,
          attributionControl: false,
        });
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles © Esri',
          maxZoom: 19,
        }).addTo(map.current);
        setIsLoading(false);
      }

      // Defensive: check all coordinates are valid numbers
      const allCoords = [userLat, userLng, greenLat, greenLng];
      const allValid = allCoords.every((v) => typeof v === 'number' && !isNaN(v));
      if (!allValid) return;

      // Remove previous polyline if exists
      if (measurementPolyline.current) {
        map.current.removeLayer(measurementPolyline.current);
        measurementPolyline.current = null;
      }

      // Helper to calculate distance
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

        // Calculate distance from user to tap point
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

        if (measurementPolyline.current) {
          measurementPolyline.current.setLatLngs([[userLat, userLng], [lat, lng], [greenLat, greenLng]]);
        }
      };

      // Draw new polyline
      measurementPolyline.current = L.polyline([[userLat, userLng], [greenLat, greenLng]], {
        color: 'red',
        weight: 2,
        opacity: 0.7,
      }).addTo(map.current);
      map.current.on('click', handleMapClick);

      // Always center the map on the green for the current hole
      map.current.setView([greenLat, greenLng], 18); // 18 is a good zoom for a green

      // Cleanup function for useEffect
      cleanup = () => {
        if (map.current) {
          map.current.off('click');
          map.current.remove();
          map.current = null;
        }
      };
    });
    return () => cleanup();
  }, [userLat, userLng, greenLat, greenLng]);
  // Spotlight mask removed: always show map
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 100,
        background: '#000',
      }}
    >
      <div
        ref={mapContainer}
        style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75" style={{ zIndex: 30 }}>
          <div className="text-white">Loading map...</div>
        </div>
      )}
    </div>
  );
}
