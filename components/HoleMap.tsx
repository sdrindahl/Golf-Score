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
  const userMarker = useRef<any>(null);
  const greenMarker = useRef<any>(null);
  const currentLabel2 = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tapPoint, setTapPoint] = useState<{ lat: number; lng: number } | null>(null);

  // Only initialize the map once
  useEffect(() => {
    let leafletInstance: any = null;
    let isMounted = true;
    import('leaflet').then((leaflet) => {
      if (!isMounted) return;
      const L = leaflet.default;
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
    });
    return () => {
      isMounted = false;
      if (map.current) {
        map.current.off('click');
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map overlays and view when props change
  useEffect(() => {
    let leafletInstance: any = null;
    let L: any = null;
    let cleanupClick = () => {};
    import('leaflet').then((leaflet) => {
      L = leaflet.default;
      if (!map.current) return;

      // Defensive: check all coordinates are valid numbers
      const allCoords = [userLat, userLng, greenLat, greenLng];
      const allValid = allCoords.every((v) => typeof v === 'number' && !isNaN(v));
      if (!allValid) return;

      // Remove previous polyline if exists
      if (measurementPolyline.current) {
        map.current.removeLayer(measurementPolyline.current);
        measurementPolyline.current = null;
      }

      // Remove previous tap marker and label if they exist
      if (currentTapMarker.current) {
        map.current?.removeLayer(currentTapMarker.current);
        currentTapMarker.current = null;
      }
      if (currentLabel.current) {
        map.current?.removeLayer(currentLabel.current);
        currentLabel.current = null;
      }
      if (currentLabel2.current) {
        map.current?.removeLayer(currentLabel2.current);
        currentLabel2.current = null;
      }

      // Remove previous user/green markers
      if (userMarker.current) {
        map.current?.removeLayer(userMarker.current);
        userMarker.current = null;
      }
      if (greenMarker.current) {
        map.current?.removeLayer(greenMarker.current);
        greenMarker.current = null;
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
        setTapPoint({ lat, lng });
      };

      // Draw polyline: user -> tapPoint -> green if tapPoint exists, else user -> green
      let polylinePoints;
      if (tapPoint) {
        polylinePoints = [[userLat, userLng], [tapPoint.lat, tapPoint.lng], [greenLat, greenLng]];

        // Tap marker — white circle outline with filled dot (like screenshot)
        const tapIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:26px;height:26px;
            border:2.5px solid #fff;
            border-radius:50%;
            background:transparent;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 0 1.5px rgba(0,0,0,0.35),0 2px 6px rgba(0,0,0,0.4);
          "><div style="width:9px;height:9px;border-radius:50%;background:#fff;"></div></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        currentTapMarker.current = L.marker([tapPoint.lat, tapPoint.lng], { icon: tapIcon }).addTo(map.current!);

        // Blue badge: user → tap distance, at midpoint of that segment
        const distUserToTap = Math.round(getDistance(userLat, userLng, tapPoint.lat, tapPoint.lng));
        const midUserTapLat = (userLat + tapPoint.lat) / 2;
        const midUserTapLng = (userLng + tapPoint.lng) / 2;
        const blueIcon = L.divIcon({
          className: '',
          html: `<div style="background:#2563eb;color:#fff;font-weight:700;font-size:14px;padding:5px 11px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${distUserToTap} yd</div>`,
          iconAnchor: [36, 16],
        });
        currentLabel.current = L.marker([midUserTapLat, midUserTapLng], { icon: blueIcon }).addTo(map.current!);

        // Orange badge: tap → green distance, at midpoint of that segment
        const distTapToGreen = Math.round(getDistance(tapPoint.lat, tapPoint.lng, greenLat, greenLng));
        const midTapGreenLat = (tapPoint.lat + greenLat) / 2;
        const midTapGreenLng = (tapPoint.lng + greenLng) / 2;
        const orangeIcon = L.divIcon({
          className: '',
          html: `<div style="background:#ea580c;color:#fff;font-weight:700;font-size:14px;padding:5px 11px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${distTapToGreen} yd</div>`,
          iconAnchor: [36, 16],
        });
        currentLabel2.current = L.marker([midTapGreenLat, midTapGreenLng], { icon: orangeIcon }).addTo(map.current!);
      } else {
        polylinePoints = [[userLat, userLng], [greenLat, greenLng]];
      }
      measurementPolyline.current = L.polyline(polylinePoints, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.9,
      }).addTo(map.current);

      // User position — blue GPS dot with white ring
      userMarker.current = L.circleMarker([userLat, userLng], {
        radius: 9,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(map.current);
      // Inner pulse dot
      L.circleMarker([userLat, userLng], {
        radius: 4,
        fillColor: '#ffffff',
        color: 'transparent',
        weight: 0,
        fillOpacity: 0.9,
      }).addTo(map.current);

      // Pin marker at green — white flag icon using divIcon
      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 28px; height: 28px;
          background: #16a34a;
          border: 2.5px solid #fff;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; line-height: 1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        ">⛳</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      greenMarker.current = L.marker([greenLat, greenLng], { icon: pinIcon }).addTo(map.current);

      map.current.on('click', handleMapClick);
      cleanupClick = () => {
        if (map.current) map.current.off('click', handleMapClick);
      };
    });
    return () => {
      cleanupClick();
    };
  }, [userLat, userLng, greenLat, greenLng, holeName, tapPoint]);

  // Reset tapPoint when the hole changes
  useEffect(() => {
    setTapPoint(null);
  }, [holeName]);

  // Recenter the map only when the hole changes
  useEffect(() => {
    import('leaflet').then((leaflet) => {
      if (!map.current) return;
      map.current.setView([greenLat, greenLng], 18); // Only on hole change
    });
  }, [holeName, greenLat, greenLng]);
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
