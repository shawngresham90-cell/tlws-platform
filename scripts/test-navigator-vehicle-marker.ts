/**
 * The branded vehicle marker — a VISUAL-ONLY change to the "you are here"
 * icon on the driving map.
 *
 * Two things are pinned. First the artwork: it is the TL mark, it is
 * self-contained, and it is drawn so the letters stay upright and the
 * badge stays anchored at every heading. Second, and more important, the
 * things this change must NOT have touched — the rotation convention, the
 * icon box, the anchor, and every engine the map draws from.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-vehicle-marker.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-vehicle-marker.cjs && node /tmp/test-navigator-vehicle-marker.cjs
 */
import { readFileSync } from 'node:fs';
import {
  vehicleMarkerRotationDeg,
  vehicleMarkerSvg,
  VEHICLE_MARKER_PX,
} from '@/components/navigator/vehicle-marker';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 200)}`}`);
  }
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MAP_SRC = readFileSync('src/components/navigator/NavigationMap.tsx', 'utf8');
const MAP = strip(MAP_SRC);

// ------------------------------------------------------- the rotation
// The -90 is the ARTWORK convention (the marker is drawn pointing east),
// and it is the exact expression the map used before this change. If it
// ever drifts, the icon silently points the wrong way down the road.
{
  check('rotation: due north (0) turns back a quarter turn', vehicleMarkerRotationDeg(0) === -90);
  check('rotation: due east (90) needs no turn', vehicleMarkerRotationDeg(90) === 0);
  check('rotation: due south (180)', vehicleMarkerRotationDeg(180) === 90);
  check('rotation: due west (270)', vehicleMarkerRotationDeg(270) === 180);
  check('rotation: an unknown heading does not guess', vehicleMarkerRotationDeg(null) === 0);
  check('rotation: NaN does not guess', vehicleMarkerRotationDeg(Number.NaN) === 0);
  check('rotation: Infinity does not guess', vehicleMarkerRotationDeg(Infinity) === 0);
  check(
    'rotation: the map still applies it to the element transform, as before',
    /el\.style\.transform \+= ` rotate\(\$\{rotate\}deg\)`/.test(MAP),
    'the heading transform changed — the marker no longer faces travel',
  );
  check(
    'rotation: and it is the SAME angle handed to the artwork',
    /const rotate = vehicleMarkerRotationDeg\(headingDeg\)/.test(MAP) &&
      /vehicleMarkerSvg\(rotate\)/.test(MAP),
    MAP.slice(MAP.indexOf('const rotate'), MAP.indexOf('const rotate') + 160),
  );
}

// ------------------------------------------------------- the artwork
{
  const svg = vehicleMarkerSvg(vehicleMarkerRotationDeg(0));
  check('art: it is an inline svg', svg.startsWith('<svg') && svg.endsWith('</svg>'));
  check('art: it carries the TL mark', />TL</.test(svg), svg);
  check(
    'art: it is self-contained — no network asset, no external reference',
    !/https?:|url\(|<image|xlink:href/.test(svg),
    svg,
  );
  check('art: it is decorative to assistive tech', /aria-hidden="true"/.test(svg));
  check(
    'art: the box matches the icon box exactly',
    svg.includes(`width="${VEHICLE_MARKER_PX}"`) && svg.includes(`height="${VEHICLE_MARKER_PX}"`),
    svg,
  );
  check(
    'art: the badge is centred on the anchor, so heading cannot move it',
    /<circle cx="18" cy="18"/.test(svg),
    'an off-centre badge orbits the anchor as the truck turns',
  );
  check('art: it uses the TLWS amber', svg.includes('#F5A623'));
  check('art: on an asphalt body', svg.includes('#141414'));
  check(
    'art: with a light ring, which is what keeps it legible over the yellow route line',
    svg.includes('#f8fafc'),
  );

  // The letters must never hang upside down. The element is rotated by
  // `r`; the wordmark group must carry exactly `-r`.
  for (const heading of [0, 45, 90, 135, 180, 225, 270, 315, 359]) {
    const r = vehicleMarkerRotationDeg(heading);
    const out = vehicleMarkerSvg(r);
    check(
      `art: at heading ${heading} the wordmark is counter-rotated to upright`,
      out.includes(`<g transform="rotate(${-r} 18 18)">`),
      out.slice(out.indexOf('<g transform')),
    );
  }
  check(
    'art: a zero rotation still emits a well-formed group',
    vehicleMarkerSvg(0).includes('<g transform="rotate(0 18 18)">'),
  );
  check(
    'art: a non-finite rotation degrades to upright rather than emitting NaN',
    !/NaN|Infinity|undefined/.test(vehicleMarkerSvg(Number.NaN)),
    vehicleMarkerSvg(Number.NaN),
  );
  check(
    'art: a fractional heading does not spray decimals into the markup',
    vehicleMarkerSvg(12.34567).includes('rotate(-12.3 18 18)'),
    vehicleMarkerSvg(12.34567),
  );
}

// ------------------------------------------------ the old marker is gone
{
  check(
    'swap: the generic arrow glyph no longer renders',
    !MAP.includes('➤'),
    'the blue arrow is still being drawn',
  );
  check(
    'swap: and neither does its blue disc',
    !MAP.includes('#38bdf8'),
    'the old marker background survived',
  );
  check('swap: the branded marker is what renders now', /vehicleMarkerSvg\(/.test(MAP));
  check(
    'swap: the icon box and anchor still come from one constant',
    /iconSize: \[VEHICLE_MARKER_PX, VEHICLE_MARKER_PX\]/.test(MAP) &&
      /iconAnchor: \[VEHICLE_MARKER_PX \/ 2, VEHICLE_MARKER_PX \/ 2\]/.test(MAP),
    'the marker can now be sized and anchored inconsistently',
  );
  check(
    'swap: the anchor is still the centre of the box (unchanged from 36/18)',
    VEHICLE_MARKER_PX === 36,
    VEHICLE_MARKER_PX,
  );
  check('swap: the marker still sits above the route line', /zIndexOffset: 1000/.test(MAP));
  check('swap: and is still non-interactive', /interactive: false/.test(MAP));
  check(
    'swap: it is still announced as the truck',
    /title: 'Your truck'/.test(MAP) && /alt: 'Your truck'/.test(MAP),
  );
}

// --------------------------------------- VISUAL ONLY: nothing else moved
// The brief was explicit — no routing, map, GPS, voice or reroute change.
// The marker module is the whole of the new surface, so it may not reach
// any of those, and the map's own engine calls must be untouched.
{
  const marker = strip(readFileSync('src/components/navigator/vehicle-marker.ts', 'utf8'));
  for (const [what, re] of [
    ['routing', /route|plan|reroute|lifecycle/i],
    ['GPS', /position|geolocation|watchPosition|accuracy/i],
    ['voice', /voice|speech|announce|utterance/i],
    ['map camera', /setView|fitBounds|flyTo|zoom/i],
    ['storage', /localStorage|sessionStorage|document\.cookie/i],
  ] as const) {
    check(`visual-only: the marker module touches no ${what}`, !re.test(marker), what);
  }
  check(
    'visual-only: the marker module is pure string-building — no browser globals',
    !/\bwindow\b|\bdocument\b|\bnavigator\b/.test(marker),
  );

  // The map's behavioural calls survive the swap, verbatim.
  for (const call of [
    'shouldAutoRecenter(followRef.current, now)',
    'shouldTrackPosition(followRef.current)',
    'shouldRecenter(position, lastCenteredRef.current)',
    'navigationZoom(speedMph)',
    "dispatch({ kind: 'recenter' })",
    'truckRef.current.setLatLng([position.lat, position.lng])',
  ]) {
    check(`visual-only: map behaviour intact — ${call}`, MAP.includes(call), call);
  }
  check(
    'visual-only: the follow/recenter effect dependencies are unchanged',
    MAP.includes('[ready, position, headingDeg, speedMph, navigating, dispatch]'),
    'the truck effect cadence changed',
  );
}

console.log(`navigator-vehicle-marker: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
