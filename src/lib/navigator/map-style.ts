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

/**
 * The tile URLs as MapLibre wants them (heading-up milestone).
 *
 * Leaflet expands the `{s}` subdomain placeholder itself; MapLibre has no
 * such placeholder and takes an ARRAY of URLs instead, rotating through
 * them for the same purpose. Same tiles, same host, same terms — this is
 * a syntax translation of the SAME approved source, not a new provider.
 * A template without `{s}` passes through as a single-entry array.
 */
export const TILE_SUBDOMAINS = ['a', 'b', 'c'] as const;

/**
 * MapLibre's equivalent of the cockpit's old `saturate(0.78)` tile
 * filter: -1 is greyscale, 0 is untouched. Kept mild on purpose — the
 * point is to let the cyan route line dominate, not to restyle roads.
 */
export const RASTER_SATURATION = -0.22;

export function tileUrlsFor(style: MapStyle): string[] {
  if (style.tileUrl === null) return [];
  if (!style.tileUrl.includes('{s}')) return [style.tileUrl];
  return TILE_SUBDOMAINS.map((s) => style.tileUrl!.replace('{s}', s));
}

/**
 * A complete MapLibre style document for a Navigator basemap.
 *
 * Deliberately hand-built rather than fetched: a remote style URL would
 * be a second provider dependency (and a second thing that can fail at
 * 70 mph). This is the raster source the platform already ships, wrapped
 * in the minimum valid MapLibre style — and it carries the SAME
 * attribution string, which MapLibre's own attribution control renders.
 *
 * Returns null for a style with no approved tile source (satellite), so
 * the caller keeps what is already drawn instead of blanking the map.
 */
export function maplibreRasterStyle(style: MapStyle): Record<string, unknown> | null {
  const tiles = tileUrlsFor(style);
  if (tiles.length === 0) return null;
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles,
        tileSize: 256,
        maxzoom: style.maxZoom,
        attribution: style.attribution,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0A0E13' } },
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        // The cockpit's tile treatment, as a renderer paint property.
        // Leaflet took `filter: saturate(0.78)` on the tile IMAGES; on a
        // single WebGL canvas a CSS filter would repaint the route line
        // and the truck too, so the same restraint is expressed where it
        // belongs — on the raster layer alone. Roads and LABELS keep
        // full contrast; nothing is inverted or dimmed into a fake night
        // map, because a recolored road could be mistaken for
        // information.
        paint: { 'raster-saturation': RASTER_SATURATION },
      },
    ],
  };
}
