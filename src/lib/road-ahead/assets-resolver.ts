import 'server-only';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * Build-time asset resolver — the reason footage is TRUE zero-code drop-in.
 *
 * The pure manifest (assets.ts) keeps every clip's `src`/`poster` null. This
 * resolver runs on the server (build / ISR) and scans `public/road-ahead/**`,
 * filling `src`/`webmSrc`/`poster`/`captionsSrc` for the files that actually
 * exist. So the owner just drops `dark-highway.mp4` into the video folder and
 * redeploys — the slot lights up, no code edit. Until then the slot keeps its
 * gradient (and its poster, if a still was dropped in first).
 */

const PUBLIC_ROOT = join(process.cwd(), 'public', 'road-ahead');
const OWNER_LICENSE = {
  source: 'Owner-supplied',
  licenseType: 'Owner-owned',
  attribution: null,
} as const;

function present(...parts: string[]): boolean {
  return existsSync(join(PUBLIC_ROOT, ...parts));
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
