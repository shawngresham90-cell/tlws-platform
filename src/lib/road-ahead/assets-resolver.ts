import 'server-only';
import {
  DEFAULT_EDIT,
  ROAD_AHEAD_ASSET_BASE,
  ROAD_AHEAD_AUDIO,
  SCENE_ORDER,
  pickBackdrop,
  posterPath,
  slotsForScene,
  videoPath,
  type AudioSlot,
  type ColorGrade,
  type FootageEdit,
  type SceneId,
  type VideoSlot,
} from './assets';
import {
  PRESENT_ASSETS,
  YOUTUBE_SOURCES,
  FOOTAGE_MOMENTS,
  type GeneratedMoment,
} from './asset-presence.generated';

/**
 * Asset resolver — the reason footage is TRUE zero-code drop-in.
 *
 * The pure manifest (assets.ts) keeps every clip's `src`/`poster` null. This
 * resolver fills `src`/`webmSrc`/`poster`/`captionsSrc` for the files that exist
 * in `public/road-ahead/**`. Presence is read from a manifest GENERATED AT BUILD
 * (scripts/generate-road-ahead-manifest.mjs via the prebuild hook) rather than a
 * per-request `fs` scan — on serverless/ISR hosts `public/` lives on the CDN and
 * isn't in the page function's file trace, so a runtime scan would report every
 * file missing after the first regeneration and silently revert footage to
 * gradients. So the owner drops `dark-highway.mp4` in, redeploys (which
 * regenerates the manifest), and the slot lights up — no code edit.
 */

const OWNER_LICENSE = {
  source: 'Owner-supplied',
  licenseType: 'Owner-owned',
  attribution: null,
} as const;

const PRESENT = new Set(PRESENT_ASSETS);

function present(...parts: string[]): boolean {
  return PRESENT.has(parts.join('/'));
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

/** Map a generated moment's edit fields onto the typed FootageEdit. */
function momentToEdit(m: GeneratedMoment): FootageEdit {
  return {
    start: m.start,
    end: m.end,
    speed: m.speed,
    loop: m.loop,
    crop: m.crop,
    zoom: m.zoom,
    grade: (m.grade as ColorGrade) ?? 'none',
    fadeIn: m.fadeIn,
    fadeOut: m.fadeOut,
    duck: m.duck,
  };
}

/**
 * Fill a video slot from the footage manifest + whatever files exist on disk.
 *
 * Priority for the source: a footage-manifest MOMENT (footage.json) wins, then a
 * dropped-in `<slot>.mp4` native file, then a youtube-sources.json mapping. A
 * moment can point at any present file (so one long video feeds many scenes) and
 * carries the cinematic edit (segment/speed/loop/crop/grade/fade/duck).
 */
function resolveVideoSlot(slot: VideoSlot): VideoSlot {
  const hasMp4 = present('video', `${slot.id}.mp4`);
  const hasWebm = present('video', `${slot.id}.webm`);
  const hasJpg = present('poster', `${slot.id}.jpg`);
  const hasWebp = present('poster', `${slot.id}.webp`);
  const hasVtt = present('captions', `${slot.id}.vtt`);
  const moment: GeneratedMoment | undefined = FOOTAGE_MOMENTS[slot.id];

  // Poster: a moment's poster (if present) wins, else the slot-named still.
  let poster = hasJpg
    ? posterPath(slot)
    : hasWebp
      ? `${ROAD_AHEAD_ASSET_BASE}/poster/${slot.id}.webp`
      : null;
  if (moment?.poster && present('poster', moment.poster)) {
    poster = `${ROAD_AHEAD_ASSET_BASE}/poster/${moment.poster}`;
  }

  const edit = moment ? momentToEdit(moment) : { ...DEFAULT_EDIT };
  const editMobile = (moment?.mobile as Partial<FootageEdit> | null) ?? null;
  const captionsSrc = hasVtt ? `${ROAD_AHEAD_ASSET_BASE}/captions/${slot.id}.vtt` : null;

  // Native source: a moment's file (if present) wins over the slot-named .mp4.
  const momentFile = moment?.file && present('video', moment.file) ? moment.file : null;
  const nativeFile = momentFile ?? (hasMp4 ? `${slot.id}.mp4` : null);
  // YouTube: a moment's id wins over the youtube-sources.json mapping.
  const youtubeId = moment?.youtubeId ?? YOUTUBE_SOURCES[slot.id] ?? null;

  if (nativeFile) {
    const stem = nativeFile.replace(VIDEO_EXT, '');
    const webmSrc = present('video', `${stem}.webm`)
      ? `${ROAD_AHEAD_ASSET_BASE}/video/${stem}.webm`
      : !momentFile && hasWebm
        ? `${ROAD_AHEAD_ASSET_BASE}/video/${slot.id}.webm`
        : null;
    return {
      ...slot,
      src: momentFile ? `${ROAD_AHEAD_ASSET_BASE}/video/${nativeFile}` : videoPath(slot),
      webmSrc,
      poster,
      captionsSrc,
      youtubeId,
      edit,
      editMobile,
      license: { ...OWNER_LICENSE },
    };
  }
  // No native clip — keep the gradient (or the YouTube cover, if mapped); a
  // poster shows through if one was dropped in early.
  return { ...slot, poster, captionsSrc, youtubeId, edit, editMobile };
}

/** The resolved backdrop slot for each scene (null for the video-free scenes). */
export function resolveSceneBackdrops(): Record<SceneId, VideoSlot | null> {
  const out = {} as Record<SceneId, VideoSlot | null>;
  for (const scene of SCENE_ORDER) {
    const resolved = slotsForScene(scene).map(resolveVideoSlot);
    out[scene] = pickBackdrop(resolved) ?? null;
  }
  return out;
}

/** Resolve the audio beds/slots from public/road-ahead/audio/. */
export function resolveAudioSlots(): AudioSlot[] {
  return ROAD_AHEAD_AUDIO.map((slot) => {
    if (!slot.file || !present('audio', slot.file)) return slot;
    return {
      ...slot,
      src: `${ROAD_AHEAD_ASSET_BASE}/audio/${slot.file}`,
      license: { ...OWNER_LICENSE },
    };
  });
}
