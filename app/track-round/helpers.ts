export type PerHoleStat = {
  fairwayHit: 'hit' | 'L' | 'R' | null;
  gir: boolean;
  puttDistances: number[];
  puttExpanded: number | null;
  drive: {
    start: { lat: number; lng: number } | null;
    end: { lat: number; lng: number } | null;
    yardage: number | null;
  } | null;
};

// Helper to chunk an array into subarrays of given size
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// Helper to calculate distance in yards between two lat/lng points
export function getDistanceYards(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = R * c;
  return meters * 1.09361; // convert to yards
}
