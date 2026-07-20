/**
 * Cinematic asset manifest for THE ROAD AHEAD — the seven-scene treatment.
 *
 * WHY THIS EXISTS: the flagship experience is built to cinematic spec now, but
 * the real trucking footage and licensed soundtrack are owner-supplied and can't
 * be committed from this environment. So every clip is a typed SLOT keyed to a
 * scene and to an exact drop-in FILENAME. Drop the file into the public folder
 * and it appears — no code change (the server resolver in assets-resolver.ts
 * fills the slot at build time; see docs/road-ahead.md).
 *
 * The slots mirror the locked shot list, scene by scene, with the exact filename
 * to drop into `public/road-ahead/video/`:
 *
 *   Scene 1  Night Drive   — dark-highway, night-driving, headlights, windshield-rain
 *   Scene 2  The Pre-Trip  — pretrip, truck-walkaround, backing, climb-into-cab, air-brake-check
 *   Scene 3  The Grind     — truck-stop, empty-highway, rain-driving, late-night-driving
 *   Scene 4  First Light   — sunrise, hero-shot, drone-shot, academy-footage
 *   Scene 5  The Wall      — no video (3D Founder Wall)
 *   Scene 6  Your Name     — no video (cinematic name engraving)
 *   Scene 7  The Payoff    — student-training, key-handoff, student-success, truck-driving-away
 *
 * CONTRACT (enforced by validateAssetManifest + scripts/test-road-ahead.ts):
 *   - Every video slot ALWAYS has a `gradient` fallback → never a blank scene.
 *   - Slot ids/filenames are unique.
 *   - Any slot whose `src` is filled MUST carry license provenance.
 *   - Audio is optional; the synthesized soundtrack (audio.ts) is off by default.
 *
 * DB-free / React-free so it is unit-tested and importable on server and client.
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
  source: string | null;
  licenseType: string | null;
  attribution: string | null;
};

export type VideoSlot = {
  /** Stable id — also the drop-in filename stem (e.g. 'dark-highway'). */
  id: string;
  scene: SceneId;
  label: string;
  /** What footage belongs here — guidance for whoever films the slot. */
  description: string;
  /** Exact drop-in filename in public/road-ahead/video/ (e.g. 'dark-highway.mp4'). */
  file: string;
  /** Primary encoding path — null until the file is dropped in (resolver fills it). */
  src: string | null;
  /** Optional WebM/VP9 path (resolver fills it if a .webm sibling exists). */
  webmSrc: string | null;
  /** Poster still path — null until poster/<stem>.jpg exists (resolver fills it). */
  poster: string | null;
  /**
   * Optional YouTube-Unlisted video id — an alternative to a dropped-in file
   * for filming on the road. Set by mapping the slot in
   * public/road-ahead/youtube-sources.json (resolver fills it). A native file
   * (`src`) always wins for quality; the embed is the fallback when no file yet.
   */
  youtubeId: string | null;
  /** Brand-safe CSS background — ALWAYS present, the ultimate fallback. */
  gradient: string;
  /** Captions track (WebVTT) for spoken/graphic content — accessibility. */
  captionsSrc: string | null;
  /** Text alternative describing the footage for AT and no-video contexts. */
  alt: string;
  license: AssetLicense;
};

/** An ambience/narration/music audio slot (synth or file-backed). */
export type AudioSlot = {
  id: string;
  label: string;
  description: string;
  /** Which scenes this bed belongs under (empty = whole experience). */
  scenes: SceneId[];
  /** 'ambience' = looping environment · 'narration' = spoken · 'music' = score. */
  kind: 'ambience' | 'narration' | 'music';
  /** Drop-in filename in public/road-ahead/audio/ (e.g. 'rain-ambience.mp3'). */
  file: string | null;
  /** Filled by the resolver when the file exists; null → the synth stand-in plays. */
  src: string | null;
  loop: boolean;
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

export const SCENE_ORDER: SceneId[] = [
  'nightDrive',
  'preTrip',
  'theGrind',
  'firstLight',
  'foundersWall',
  'nameEngraving',
  'thePayoff',
];

/** Two-digit scene number, e.g. 'nightDrive' → '01'. */
export function sceneNumber(scene: SceneId): string {
  return String(SCENE_ORDER.indexOf(scene) + 1).padStart(2, '0');
}

/** Compact VideoSlot constructor — id is also the drop-in filename stem. */
function v(id: string, scene: SceneId, gradient: string, label: string, alt: string): VideoSlot {
  return {
    id,
    scene,
    label,
    description: label,
    file: `${id}.mp4`,
    src: null,
    webmSrc: null,
    poster: null,
    youtubeId: null,
    gradient,
    captionsSrc: null,
    alt,
    license: NO_LICENSE,
  };
}

/**
 * All video slots, in scene/shot order, keyed by their drop-in filename stem.
 * `src`/`poster` are null until the owner drops the file into the public folder;
 * the resolver (assets-resolver.ts) fills them at build. Suggested specs live in
 * docs/road-ahead.md.
 */
export const ROAD_AHEAD_VIDEO: Record<string, VideoSlot> = {
  // ---------------------------------------------------- Scene 1 — Night Drive
  'dark-highway': v(
    'dark-highway',
    'nightDrive',
    G.night,
    'Dark highway',
    'A dark highway at night, the road disappearing into black.',
  ),
  'night-driving': v(
    'night-driving',
    'nightDrive',
    G.night,
    'Night driving — cab interior',
    'A driver alone in a truck cab at night, lit by the dashboard glow.',
  ),
  headlights: v(
    'headlights',
    'nightDrive',
    G.night,
    'Headlights cutting the dark',
    'Truck headlights cutting through darkness on an empty road.',
  ),
  'windshield-rain': v(
    'windshield-rain',
    'nightDrive',
    G.night,
    'Windshield in the rain',
    "A driver's-eye view through a rain-streaked windshield down a dark highway.",
  ),

  // ----------------------------------------------------- Scene 2 — The Pre-Trip
  pretrip: v(
    'pretrip',
    'preTrip',
    G.steel,
    'Pre-trip inspection',
    'A driver performing a pre-trip inspection, checking lights and tires.',
  ),
  'truck-walkaround': v(
    'truck-walkaround',
    'preTrip',
    G.steel,
    'Walking around the truck',
    'A driver walking around a parked truck in cold morning light.',
  ),
  backing: v(
    'backing',
    'preTrip',
    G.steel,
    'Backing the trailer',
    'A truck backing a trailer into a spot, framed through the mirrors.',
  ),
  'climb-into-cab': v(
    'climb-into-cab',
    'preTrip',
    G.steel,
    'Climbing into the cab',
    'A driver climbing up into the cab of a truck.',
  ),
  'air-brake-check': v(
    'air-brake-check',
    'preTrip',
    G.steel,
    'Air brake check',
    'A driver performing an air brake check, watching the gauges.',
  ),

  // ------------------------------------------------------- Scene 3 — The Grind
  'truck-stop': v(
    'truck-stop',
    'theGrind',
    G.sodium,
    'Truck stop at night',
    'A truck stop at night, rows of parked rigs under sodium lights.',
  ),
  'empty-highway': v(
    'empty-highway',
    'theGrind',
    G.rain,
    'Empty highway',
    'An empty highway stretching toward a dark horizon.',
  ),
  'rain-driving': v(
    'rain-driving',
    'theGrind',
    G.rain,
    'Driving in the rain',
    'Driving through rain, wipers working across the windshield.',
  ),
  'late-night-driving': v(
    'late-night-driving',
    'theGrind',
    G.rain,
    'Late-night driving',
    'Late-night driving on a near-empty road, dashboard clock glowing.',
  ),

  // ------------------------------------------------------ Scene 4 — First Light
  sunrise: v(
    'sunrise',
    'firstLight',
    G.dawn,
    'Sunrise over the road',
    'Sunrise breaking over a highway, the road running toward the light.',
  ),
  'hero-shot': v(
    'hero-shot',
    'firstLight',
    G.dawn,
    'Truck hero shot',
    'A hero shot of a truck catching the first light of dawn.',
  ),
  'drone-shot': v(
    'drone-shot',
    'firstLight',
    G.dawn,
    'Drone over the highway',
    'An aerial drone view of a truck on an open highway at dawn.',
  ),
  'academy-footage': v(
    'academy-footage',
    'firstLight',
    G.dawn,
    'Academy footage',
    'The Trucking Life Academy training yard with trucks and students.',
  ),

  // -------------------------------------------------------- Scene 7 — The Payoff
  'student-training': v(
    'student-training',
    'thePayoff',
    G.gold,
    'Student training',
    'A student driving on a training pad with an instructor alongside.',
  ),
  'key-handoff': v(
    'key-handoff',
    'thePayoff',
    G.gold,
    'The key handoff',
    'Truck keys being handed from an instructor to a new driver.',
  ),
  'student-success': v(
    'student-success',
    'thePayoff',
    G.gold,
    'Student success',
    'A new driver standing proud beside their truck, licensed and ready.',
  ),
  'truck-driving-away': v(
    'truck-driving-away',
    'thePayoff',
    G.gold,
    'The truck drives away',
    'A truck pulling out and driving away toward a bright horizon.',
  ),
};

/**
 * Audio beds/slots. The synth engine (audio.ts) provides zero-asset stand-ins
 * for the ambiences today; dropping a file into public/road-ahead/audio/ swaps
 * in the real recording with no code change. Narration + licensed music are
 * file-only (no synth) and stay silent until supplied. Nothing autoplays.
 */
export const ROAD_AHEAD_AUDIO: AudioSlot[] = [
  a(
    'engine-idle',
    'Engine idle',
    ['nightDrive', 'preTrip'],
    'ambience',
    'The low idle of a diesel engine.',
  ),
  a(
    'air-brakes',
    'Air brakes',
    ['preTrip'],
    'ambience',
    'The hiss and knock of an air-brake release.',
  ),
  a(
    'highway-ambience',
    'Highway ambience',
    ['nightDrive', 'theGrind'],
    'ambience',
    'The wash of tires and wind at highway speed.',
  ),
  a('rain-ambience', 'Rain ambience', ['theGrind'], 'ambience', 'Rain on the cab and glass.'),
  a(
    'truck-stop-ambience',
    'Truck stop ambience',
    ['theGrind'],
    'ambience',
    'The murmur of a truck stop after dark.',
  ),
  a(
    'dawn-swell',
    'Dawn swell',
    ['firstLight'],
    'ambience',
    'A warm tonal swell as the sun breaks.',
  ),
  a('narration', 'Narration', [], 'narration', 'Optional voiceover for the whole experience.'),
  a('score', 'Licensed score', [], 'music', 'Optional licensed instrumental bed. Loops.'),
];

/** Compact AudioSlot constructor. */
function a(
  id: string,
  label: string,
  scenes: SceneId[],
  kind: AudioSlot['kind'],
  description: string,
): AudioSlot {
  return {
    id,
    label,
    description,
    scenes,
    kind,
    file: `${id}.mp3`,
    src: null,
    loop: kind !== 'narration',
    title: null,
    license: NO_LICENSE,
  };
}

/** The expected public path for a slot's primary clip. */
export function videoPath(slot: VideoSlot): string {
  return `${ROAD_AHEAD_ASSET_BASE}/video/${slot.file}`;
}

/** The expected public path for a slot's poster still. */
export function posterPath(slot: VideoSlot): string {
  return `${ROAD_AHEAD_ASSET_BASE}/poster/${slot.id}.jpg`;
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

/** Scene-appropriate gradient (used for the video-free scenes 5/6 too). */
export function sceneGradient(scene: SceneId): string {
  const withSlots = slotsForScene(scene)[0];
  if (withSlots) return withSlots.gradient;
  return 'linear-gradient(180deg, #0b0b0b 0%, #0E0E0E 100%)';
}

/**
 * Pick the backdrop slot from a list: the first with real footage, else the
 * first (for its gradient). Pure — the resolver fills `src` before calling this.
 */
export function pickBackdrop(slots: VideoSlot[]): VideoSlot | undefined {
  return slots.find(hasAnyFootage) ?? slots[0];
}

/**
 * The backdrop slot for a scene from the UNRESOLVED manifest (all gradient).
 * The server resolver produces the resolved version; this is the safe fallback
 * (SSR without the resolver, tests, video-free scenes).
 */
export function sceneBackdropSlot(scene: SceneId): VideoSlot {
  const first = slotsForScene(scene)[0];
  if (first) return first;
  // Video-free scene (5/6): a synthetic gradient-only slot.
  return {
    id: `${scene}-backdrop`,
    scene,
    label: `${scene} backdrop`,
    description: 'Gradient-only backdrop (this scene renders its own treatment).',
    file: '',
    src: null,
    webmSrc: null,
    poster: null,
    youtubeId: null,
    gradient: sceneGradient(scene),
    captionsSrc: null,
    alt: '',
    license: NO_LICENSE,
  };
}

/** Has a dropped-in native file been supplied for this slot? */
export function hasFootage(slot: VideoSlot): boolean {
  return typeof slot.src === 'string' && slot.src.length > 0;
}

/** Has a YouTube-Unlisted clip been mapped for this slot? */
export function hasYouTube(slot: VideoSlot): boolean {
  return typeof slot.youtubeId === 'string' && slot.youtubeId.length > 0;
}

/** Any playable footage — native file or YouTube. Drives backdrop selection. */
export function hasAnyFootage(slot: VideoSlot): boolean {
  return hasFootage(slot) || hasYouTube(slot);
}

/** Has a licensed track/recording been supplied for this audio slot? */
export function hasAudio(slot: AudioSlot): boolean {
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
 * Validate the manifest. Returns human-readable problems (empty = healthy).
 */
export function validateAssetManifest(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const files = new Set<string>();

  for (const slot of allVideoSlots()) {
    if (ids.has(slot.id)) problems.push(`duplicate video slot id "${slot.id}"`);
    ids.add(slot.id);
    if (files.has(slot.file)) problems.push(`duplicate drop-in filename "${slot.file}"`);
    files.add(slot.file);
    if (slot.file !== `${slot.id}.mp4`) {
      problems.push(`video slot "${slot.id}" filename must be "${slot.id}.mp4"`);
    }
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

  for (const slot of ROAD_AHEAD_AUDIO) {
    if (ids.has(slot.id)) problems.push(`duplicate asset id "${slot.id}" (audio)`);
    ids.add(slot.id);
    if (hasAudio(slot) && !licenseIsAccounted(slot.license)) {
      problems.push(`audio slot "${slot.id}" has a track but no accounted license`);
    }
  }

  return problems;
}
