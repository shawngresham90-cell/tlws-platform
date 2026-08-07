/**
 * Map-style seam for the driving surface (map-first milestone).
 *
 * The platform's map foundation is Leaflet over OpenStreetMap raster tiles:
 * no API key, no per-request cost, and already in production on the
 * directory. OSM publishes STREET tiles only — there is no satellite layer
 * in that tile set, and this file will not point at someone else's imagery
 * to fake one.
 *
 * So the seam ships complete and Satellite ships DISABLED, carrying the
 * reason. Turning it on is a provider decision the owner has to make (see
 * `SATELLITE_REQUIREMENT`), not something code can decide: every satellite
 * basemap worth using is a licensed, keyed, metered service.
 */

export type MapStyleId = 'standard' | 'satellite';

export type MapStyle = {
  id: MapStyleId;
  /** Button text. */
  label: string;
  /** False = present in the UI, visibly unavailable, never silently missing. */
  enabled: boolean;
  /** Tile template, or null when the style has no approved source. */
  tileUrl: string | null;
  attribution: string;
  maxZoom: number;
  /** Why it is unavailable — shown to the driver, not swallowed. */
  blockedReason: string | null;
};

/**
 * What enabling satellite would require. Kept as data so the report, the
 * UI, and the tests all quote the SAME sentence.
 */
export const SATELLITE_REQUIREMENT =
  'Satellite imagery needs a licensed provider (for example HERE, Mapbox, Esri, or Google). ' +
  'OpenStreetMap — the keyless tile source this app already uses — publishes street maps only. ' +
  'Enabling it is an owner decision about provider terms and cost, so it is not switched on here.';

export const MAP_STYLES: readonly MapStyle[] = Object.freeze([
  Object.freeze({
    id: 'standard' as const,
    label: 'Standard',
    enabled: true,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }),
  Object.freeze({
    id: 'satellite' as const,
    label: 'Satellite',
    enabled: false,
    tileUrl: null,
    attribution: '',
    maxZoom: 19,
    blockedReason: SATELLITE_REQUIREMENT,
  }),
] as MapStyle[]);

export const DEFAULT_MAP_STYLE: MapStyleId = 'standard';

/** Look up a style; unknown or disabled ids fall back to the default. */
export function resolveMapStyle(id: string): MapStyle {
  const found = MAP_STYLES.find((s) => s.id === id && s.enabled);
  return found ?? (MAP_STYLES.find((s) => s.id === DEFAULT_MAP_STYLE) as MapStyle);
}

/** Styles a driver may actually select right now. */
export function enabledMapStyles(): MapStyle[] {
  return MAP_STYLES.filter((s) => s.enabled);
}
