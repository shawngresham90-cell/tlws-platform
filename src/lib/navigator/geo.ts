/**
 * Navigator-specific spherical geometry (Phase 1). Distance comes from the
 * shared pure geodesy module (`@/lib/map/geo`); only initial bearing is new
 * here — nothing else on the platform needs it yet, and it moves next to
 * its first consumer the day something does.
 */

export { haversineMiles } from '@/lib/map/geo';
export type { LatLng as GeoPoint } from '@/lib/map/bounds';

/** Initial great-circle bearing from `a` to `b`, degrees clockwise from true north [0, 360). */
export function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(latB);
  const x = Math.cos(latA) * Math.sin(latB) - Math.sin(latA) * Math.cos(latB) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}
