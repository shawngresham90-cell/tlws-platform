/**
 * The branded vehicle marker — the icon for "you are here" on the live
 * Navigator map. Visual only: it renders a marker and decides nothing.
 *
 * WHY A TL BADGE AND NOT A TRUCK
 *
 * The brief preferred a truck carrying the TL letters, with the TL mark
 * alone as the fallback if the truck became unreadable small. It does.
 * The marker is 36 px on a phone held at arm's length in a moving cab,
 * and a tractor-trailer silhouette at that size collapses into an amber
 * smudge — rendered side by side, the truck body was indistinguishable
 * from a plain blob, and the letters riding on it were about 9 px, which
 * is below what anyone reads at a glance while driving. The fallback is
 * what shipped: the TL mark, big enough to actually be read.
 *
 * WHY THE LETTERS ARE COUNTER-ROTATED
 *
 * The marker element is rotated to face the direction of travel, and that
 * rotation is UNCHANGED by this module — NavigationMap still applies the
 * same `headingDeg - 90` CSS transform it always did. But rotating the
 * element rotates everything drawn in it, so a wordmark would hang upside
 * down every time the truck headed south. So the artwork is drawn facing
 * EAST (matching the existing -90 convention exactly, so no rotation math
 * moved) and the wordmark is counter-rotated inside the SVG by the same
 * angle. The badge reads upright at every heading; the nose still swings.
 *
 * WHY THE BADGE IS CENTRED ON THE ANCHOR
 *
 * The circle sits at the exact centre of the 36x36 box, which is also the
 * icon anchor. Rotating a circle about its own centre is invisible, so the
 * badge stays pinned to the truck's real position while only the nose
 * sweeps around it. An off-centre badge — the first version drawn — orbits
 * the anchor as the heading changes, which reads as the truck wandering
 * off the route line when it has not moved at all.
 */

/** Icon box, in CSS pixels. Must match the divIcon size and anchor. */
export const VEHICLE_MARKER_PX = 36;

/* Brand tokens, restated as literal hex: this string is assembled outside
 * React and inserted into a Leaflet div icon, where Tailwind classes do
 * not reach. Amber is the TLWS accent; asphalt is the badge body; the
 * near-white ring is what keeps the marker legible on a dark basemap, a
 * light one, and satellite imagery alike — and against the route line,
 * which is itself yellow, so the marker may not be. */
const AMBER = '#F5A623';
const ASPHALT = '#141414';
const RING = '#f8fafc';

/**
 * Degrees to rotate the marker so it faces the direction of travel.
 *
 * The `- 90` is the artwork convention, not a heading correction: the
 * marker is drawn pointing EAST, so a due-north heading of 0 has to turn
 * back a quarter turn. An unknown or non-finite heading points the icon
 * at its drawn orientation rather than guessing a direction.
 *
 * This is the value NavigationMap already computed inline; it lives here
 * now so the artwork and the transform can never disagree about which way
 * "forward" is.
 */
export function vehicleMarkerRotationDeg(headingDeg: number | null): number {
  return headingDeg === null || !Number.isFinite(headingDeg) ? 0 : headingDeg - 90;
}

/**
 * The marker as a self-contained inline SVG string.
 *
 * `rotationDeg` must be the SAME angle applied to the element's CSS
 * transform — it is used only to counter-rotate the wordmark back to
 * upright. It is rounded and range-checked here because this string is
 * assigned through `innerHTML`: everything in it is authored in this
 * file, and the one number that varies is forced to be a plain number
 * before it can reach the markup.
 */
export function vehicleMarkerSvg(rotationDeg: number): string {
  const safe = Number.isFinite(rotationDeg) ? Math.round(rotationDeg * 10) / 10 : 0;
  const s = VEHICLE_MARKER_PX;
  return (
    `<svg width="${s}" height="${s}" viewBox="0 0 36 36" aria-hidden="true" focusable="false">` +
    // Direction nose, drawn pointing east so the existing -90 convention
    // holds. It is the only part that visibly moves with the heading.
    `<path d="M35 18 L28.5 13 L28.5 23 Z" fill="${AMBER}" stroke="${RING}"` +
    ` stroke-width="1.7" stroke-linejoin="round"/>` +
    // The badge: centred on the anchor, so heading changes never move it.
    `<circle cx="18" cy="18" r="12.4" fill="${ASPHALT}" stroke="${RING}" stroke-width="2.6"/>` +
    `<g transform="rotate(${-safe} 18 18)">` +
    `<text x="18" y="18" font-family="system-ui,-apple-system,sans-serif" font-size="13"` +
    ` font-weight="800" letter-spacing="-0.5" fill="${AMBER}" text-anchor="middle"` +
    ` dominant-baseline="central">TL</text>` +
    `</g></svg>`
  );
}
