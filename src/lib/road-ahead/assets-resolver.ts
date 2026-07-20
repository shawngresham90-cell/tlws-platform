import 'server-only';
import {
  ROAD_AHEAD_ASSET_BASE,
  ROAD_AHEAD_AUDIO,
  SCENE_ORDER,
  pickBackdrop,
  posterPath,
  slotsForScene,
  videoPath,
  type AudioSlot,
  type SceneId,
  type VideoSlot,
} from './assets';
import { PRESENT_ASSETS } from './asset-presence.generated';

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

/** Fill a video slot from whatever files exist on disk for its id. */
function resolveVideoSlot(slot: VideoSlot): VideoSlot {
  const hasMp4 = present('video', `${slot.id}.mp4`);
  const hasWebm = present('video', `${slot.id}.webm`);
  const hasJpg = present('poster', `${slot.id}.jpg`);
  const hasWebp = present('poster', `${slot.id}.webp`);
  const hasVtt = present('captions', `${slot.id}.vtt`);

  const poster = hasJpg
    ? posterPath(slot)
    : hasWebp
      ? `${ROAD_AHEAD_ASSET_BASE}/poster/${slot.id}.webp`
      : null;

  if (!hasMp4) {
    // No clip yet — keep the gradient, but a poster (if dropped in early) shows.
    return { ...slot, poster };
  }
  return {
    ...slot,
    src: videoPath(slot),
    webmSrc: hasWebm ? `${ROAD_AHEAD_ASSET_BASE}/video/${slot.id}.webm` : null,
    poster,
    captionsSrc: hasVtt ? `${ROAD_AHEAD_ASSET_BASE}/captions/${slot.id}.vtt` : null,
    license: { ...OWNER_LICENSE },
  };
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
