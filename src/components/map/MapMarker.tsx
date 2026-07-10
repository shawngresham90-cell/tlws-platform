import { getCategory } from '@/lib/directory/categories';
import type { MapMarkerDatum, MarkerCluster } from '@/lib/map/cluster';

/**
 * Presentational markers for the map foundation. Rendered inside MapCanvas's
 * SVG; positioning is the canvas's job, appearance is this file's. No map
 * provider, no API keys.
 */

export function MapMarker({
  marker,
  x,
  y,
  onClick,
}: {
  marker: MapMarkerDatum;
  /** SVG coordinates computed by MapCanvas. */
  x: number;
  y: number;
  onClick?: (marker: MapMarkerDatum) => void;
}) {
  const icon = getCategory(marker.category)?.icon ?? '📍';
  return (
    <g
      transform={`translate(${x}, ${y})`}
      role="img"
      aria-label={marker.name}
      onClick={onClick ? () => onClick(marker) : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <circle r={10} fill={marker.featured ? '#facc15' : '#1f2937'} stroke="#facc15" />
      <text y={4} textAnchor="middle" fontSize={10}>
        {icon}
      </text>
      <title>{marker.name}</title>
    </g>
  );
}

export function ClusterMarker({
  cluster,
  x,
  y,
  onClick,
}: {
  cluster: MarkerCluster;
  x: number;
  y: number;
  onClick?: (cluster: MarkerCluster) => void;
}) {
  const count = cluster.markers.length;
  const r = Math.min(22, 12 + Math.log2(count) * 3);
  return (
    <g
      transform={`translate(${x}, ${y})`}
      role="img"
      aria-label={`${count} locations`}
      onClick={onClick ? () => onClick(cluster) : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <circle r={r} fill="#facc15" fillOpacity={0.9} stroke="#1f2937" />
      <text y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#111827">
        {count}
      </text>
      <title>{`${count} locations`}</title>
    </g>
  );
}
