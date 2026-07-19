/**
 * Cinematic asset manifest for THE ROAD AHEAD — the seven-scene treatment.
 *
 * WHY THIS EXISTS: the flagship experience is built to cinematic spec now, but
 * the real trucking footage and licensed soundtrack are owner-supplied and can't
 * be fetched, purchased, or committed from this environment. So every piece of
 * media is a typed SLOT keyed to a scene: the page renders a brand-safe fallback
 * today and the real clip the moment a file is dropped in and its `src` is
 * filled here — no component changes required. See docs/road-ahead.md.
 *
 * The slots mirror the locked shot list, scene by scene, so the owner can film
 * against this list and drop each clip straight into its slot:
 *
 *   Scene 1  Night Drive    — night driving, headlights, highway, windshield
 *   Scene 2  The Pre-Trip   — inspection, walk-around, backing, climb-in, air-brake
 *   Scene 3  The Grind      — truck stop, rain, late-night driving, empty highway
 *   Scene 4  First Light    — sunrise, truck hero, drone, academy (future)
 *   Scene 5  The Wall       — no video (3D Founder Wall)
 *   Scene 6  Your Name      — no video (cinematic name engraving)
 *   Scene 7  The Payoff     — student, key handoff, training, truck driving away
 *
 * CONTRACT (enforced by validateAssetManifest + scripts/test-road-ahead.ts):
 *   - Every video slot ALWAYS has a `gradient` fallback → never a blank scene.
 *   - Slot ids are unique across video + audio.
 *   - Any slot whose `src` is filled MUST carry license provenance.
 *   - Audio is optional and, per audio-state.ts, off by default.
 *
 * DB-free / React-free so it is unit-tested and importable server-side.
 */

export type SceneId =
  | 'nightDrive'
  | 'preTrip'
  | 'theGrind'
  | 'firstLight'
  | 'foundersWall'
  | 'nameEngraving'
  | 'thePayoff';

export type AssetLicense = {
  /** Where the asset came from, e.g. 'Owner-supplied' or a stock vendor. */
  source: string | null;
  /** Rights basis, e.g. 'Owner-owned', 'Licensed — Artlist', 'CC-BY-4.0'. */
  licenseType: string | null;
  /** Required on-screen/credit text, if the license demands attribution. */
  attribution: string | null;
};

export type VideoSlot = {
  id: string;
  /** Scene this clip belongs to. */
  scene: SceneId;
  /** Human label for docs/admin. */
  label: string;
  /** What footage belongs here — guidance for whoever fills the slot. */
  description: string;
  /** Primary encoding (MP4/H.264). null until supplied → gradient/poster shows. */
  src: string | null;
  /** Optional alternate encoding (WebM/VP9) for smaller mobile payloads. */
  webmSrc: string | null;
  /** Optional still poster shown before/behind video. null → gradient only. */
  poster: string | null;
  /** Brand-safe CSS background — ALWAYS present, the ultimate fallback. */
  gradient: string;
  /** Captions track (WebVTT) for any spoken/graphic content — accessibility. */
  captionsSrc: string | null;
  /** Text alternative describing the footage for AT and no-video contexts. */
  alt: string;
  license: AssetLicense;
};

export type AudioSlot = {
  id: string;
  label: string;
  description: string;
  /** null until a licensed track is supplied → the control stays hidden. */
  src: string | null;
  loop: boolean;
  /** Track title for the credits line, when supplied. */
  title: string | null;
  license: AssetLicense;
};

const NO_LICENSE: AssetLicense = { source: null, licenseType: null, attribution: null };

/** Public base folder for dropped-in assets (see docs/road-ahead.md). */
export const ROAD_AHEAD_ASSET_BASE = '/road-ahead';

/** Scene-appropriate cinematic gradient fallbacks (dark, graded for white text). */
const G = {
  night: 'radial-gradient(120% 100% at 50% -10%, #10131c 0%, #0b0d14 45%, #0E0E0E 100%)',
  steel: 'linear-gradient(180deg, #171a1f 0%, #101215 60%, #0E0E0E 100%)',
  rain: 'linear-gradient(200deg, #14181d 0%, #0f1216 55%, #0E0E0E 100%)',
  sodium:
    'radial-gradient(120% 90% at 20% 20%, rgba(255,176,0,0.06) 0%, rgba(255,176,0,0) 55%), linear-gradient(180deg, #15120c 0%, #0E0E0E 100%)',
  dawn: 'linear-gradient(180deg, #0E0E0E 0%, #1c1608 55%, #2a2100 100%)',
  gold: 'radial-gradient(120% 120% at 50% 120%, #2a2100 0%, #14130a 45%, #0E0E0E 100%)',
} as const;

/**
 * All video slots, in scene/shot order. `src`/`poster`/`captionsSrc` are null
 * until the owner supplies files; the `gradient` keeps each scene cinematic in
 * the meantime. Suggested filenames are documented in docs/road-ahead.md.
 */
export const ROAD_AHEAD_VIDEO: Record<string, VideoSlot> = {
  // ---------------------------------------------------- Scene 1 — Night Drive
  nightDriving: v(
    'nightDriving',
    'nightDrive',
    'Night driving — cab interior',
    'The driver alone in the cab at night, dash glow on their face. The emotional open.',
    G.night,
    'A driver alone in a truck cab at night, lit by the dashboard glow.',
  ),
  headlights: v(
    'headlights',
    'nightDrive',
    'Headlights cutting the dark',
    'Headlights sweeping an empty road; the beam is the only light. Loops cleanly.',
    G.night,
    'Truck headlights cutting through darkness on an empty road.',
  ),
  highwayNight: v(
    'highwayNight',
    'nightDrive',
    'Highway at night',
    'Wide highway footage at night — tail lights, lane lines streaming past.',
    G.night,
    'A highway at night with streaming lane lines and distant tail lights.',
  ),
  windshield: v(
    'windshield',
    'nightDrive',
    'Windshield POV',
    'Windshield point-of-view down the night road — puts the viewer in the seat.',
    G.night,
    "A driver's-eye view through the windshield down a dark highway.",
  ),

  // ----------------------------------------------------- Scene 2 — The Pre-Trip
  preTripInspection: v(
    'preTripInspection',
    'preTrip',
    'Pre-trip inspection',
    'Hands checking lights, tires, connections — the discipline of the job.',
    G.steel,
    'A driver performing a pre-trip inspection, checking lights and tires.',
  ),
  walkAround: v(
    'walkAround',
    'preTrip',
    'Walking around the truck',
    'A slow walk-around of the rig in cold morning light — respect for the equipment.',
    G.steel,
    'A driver walking around a parked truck in cold morning light.',
  ),
  backing: v(
    'backing',
    'preTrip',
    'Backing the trailer',
    'Backing footage — mirrors, angle, precision. The skill of it.',
    G.steel,
    'A truck backing a trailer into a spot, framed through the mirrors.',
  ),
  climbingIn: v(
    'climbingIn',
    'preTrip',
    'Climbing into the cab',
    'Boots on the step, hand on the grab bar, climbing up into the seat.',
    G.steel,
    'A driver climbing up into the cab of a truck.',
  ),
  airBrakeCheck: v(
    'airBrakeCheck',
    'preTrip',
    'Air brake check',
    'The air brake check — gauges, the hiss, the routine that keeps everyone safe.',
    G.steel,
    'A driver performing an air brake check, watching the gauges.',
  ),

  // ------------------------------------------------------- Scene 3 — The Grind
  truckStop: v(
    'truckStop',
    'theGrind',
    'Truck stop at night',
    'A truck stop after dark — rows of rigs, sodium lights, the life on the road.',
    G.sodium,
    'A truck stop at night, rows of parked rigs under sodium lights.',
  ),
  rain: v(
    'rain',
    'theGrind',
    'Rain on the glass',
    'Rain streaking the windshield, wipers working — the hard nights.',
    G.rain,
    'Rain streaking across a windshield with the wipers running.',
  ),
  lateNightDriving: v(
    'lateNightDriving',
    'theGrind',
    'Late-night driving',
    'The long hours — dash clock late, road empty, the discipline of the miles.',
    G.rain,
    'Late-night driving on a near-empty road, dashboard clock glowing.',
  ),
  emptyHighway: v(
    'emptyHighway',
    'theGrind',
    'Empty highway',
    'A wide empty highway stretching to the dark horizon — the solitude of it.',
    G.rain,
    'An empty highway stretching toward a dark horizon.',
  ),

  // ------------------------------------------------------ Scene 4 — First Light
  sunrise: v(
    'sunrise',
    'firstLight',
    'Sunrise over the road',
    'The sun breaking the horizon over the highway — the turn from night to hope.',
    G.dawn,
    'Sunrise breaking over a highway, the road running toward the light.',
  ),
  truckHero: v(
    'truckHero',
    'firstLight',
    'Truck hero shot',
    'A hero shot of the rig catching first light — chrome, lines, pride.',
    G.dawn,
    'A hero shot of a truck catching the first light of dawn.',
  ),
  drone: v(
    'drone',
    'firstLight',
    'Drone over the highway',
    'Drone footage pulling up and away from the truck on an open road.',
    G.dawn,
    'An aerial drone view of a truck on an open highway at dawn.',
  ),
  academy: v(
    'academy',
    'firstLight',
    'Academy footage (future)',
    'Future: the Trucking Life Academy — the yard, the trucks, a class beginning.',
    G.dawn,
    'The Trucking Life Academy training yard with trucks and students.',
  ),

  // -------------------------------------------------------- Scene 7 — The Payoff
  student: v(
    'student',
    'thePayoff',
    'The student',
    'A new driver — nervous, ready — the person all of this is for.',
    G.gold,
    'A new student driver standing beside a truck, ready to begin.',
  ),
  keyHandoff: v(
    'keyHandoff',
    'thePayoff',
    'The key handoff',
    'Keys passed hand to hand — the moment a career becomes real.',
    G.gold,
    'Truck keys being handed from an instructor to a new driver.',
  ),
  training: v(
    'training',
    'thePayoff',
    'Training on the pad',
    'Training footage — the student behind the wheel, the instructor beside them.',
    G.gold,
    'A student driving on a training pad with an instructor alongside.',
  ),
  truckDrivingAway: v(
    'truckDrivingAway',
    'thePayoff',
    'The truck drives away',
    'The final shot: the truck pulling out and driving away toward the horizon — launched.',
    G.gold,
    'A truck pulling out and driving away toward a bright horizon.',
  ),
};

/** The single optional ambient soundtrack slot (off by default, see audio-state). */
export const ROAD_AHEAD_AUDIO: AudioSlot = {
  id: 'ambientScore',
  label: 'Ambient cinematic score',
  description:
    'Optional licensed instrumental bed for the whole experience. Loops. Never autoplays — the driver turns it on.',
  src: null,
  loop: true,
  title: null,
  license: NO_LICENSE,
};

/** Compact VideoSlot constructor — keeps the manifest readable. */
function v(
  id: string,
  scene: SceneId,
  label: string,
  description: string,
  gradient: string,
  alt: string,
): VideoSlot {
  return {
    id,
    scene,
    label,
    description,
    src: null,
    webmSrc: null,
    poster: null,
    gradient,
    captionsSrc: null,
    alt,
    license: NO_LICENSE,
  };
}

/** All video slots as an array (stable order matches declaration). */
export function allVideoSlots(): VideoSlot[] {
  return Object.values(ROAD_AHEAD_VIDEO);
}

/** Look up a video slot by id (undefined if unknown). */
export function getVideoSlot(id: string): VideoSlot | undefined {
  return ROAD_AHEAD_VIDEO[id];
}

/** All slots that belong to a scene, in declaration order. */
export function slotsForScene(scene: SceneId): VideoSlot[] {
  return allVideoSlots().filter((s) => s.scene === scene);
}

/**
 * The backdrop slot to render for a scene: the first slot with real footage, or
 * the first slot (for its gradient) while footage is pending. Returns undefined
 * for the no-video scenes (Founder Wall, Name Engraving).
 */
export function sceneBackdropSlot(scene: SceneId): VideoSlot | undefined {
  const slots = slotsForScene(scene);
  return slots.find(hasFootage) ?? slots[0];
}

/** Has real footage been supplied for this slot? */
export function hasFootage(slot: VideoSlot): boolean {
  return typeof slot.src === 'string' && slot.src.length > 0;
}

/** Has a licensed soundtrack been supplied? */
export function hasSoundtrack(slot: AudioSlot = ROAD_AHEAD_AUDIO): boolean {
  return typeof slot.src === 'string' && slot.src.length > 0;
}

/** Does a supplied asset carry enough license provenance to ship? */
function licenseIsAccounted(license: AssetLicense): boolean {
  return (
    typeof license.licenseType === 'string' &&
    license.licenseType.length > 0 &&
    ((typeof license.source === 'string' && license.source.length > 0) ||
      (typeof license.attribution === 'string' && license.attribution.length > 0))
  );
}

/**
 * Validate the manifest. Returns a list of human-readable problems (empty =
 * healthy). Enforces the contract in this file's header so a bad drop-in
 * (missing gradient, duplicate id, unlicensed supplied asset) fails the test
 * suite instead of shipping.
 */
export function validateAssetManifest(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  const claim = (id: string, where: string) => {
    if (ids.has(id)) problems.push(`duplicate asset id "${id}" (${where})`);
    ids.add(id);
  };

  for (const slot of allVideoSlots()) {
    claim(slot.id, 'video');
    if (!slot.gradient || slot.gradient.trim().length === 0) {
      problems.push(`video slot "${slot.id}" is missing its gradient fallback`);
    }
    if (!slot.alt || slot.alt.trim().length === 0) {
      problems.push(`video slot "${slot.id}" is missing an alt description`);
    }
    if (hasFootage(slot) && !licenseIsAccounted(slot.license)) {
      problems.push(`video slot "${slot.id}" has footage but no accounted license`);
    }
  }

  claim(ROAD_AHEAD_AUDIO.id, 'audio');
  if (hasSoundtrack() && !licenseIsAccounted(ROAD_AHEAD_AUDIO.license)) {
    problems.push(`audio slot "${ROAD_AHEAD_AUDIO.id}" has a track but no accounted license`);
  }

  return problems;
}
