/**
 * THE ROAD AHEAD — footage manifest (the drop-in contract).
 *
 * This is the single seam between the cinematic experience and Shawn's real
 * trucking footage. Scenes reference clips by relative asset *key* only; the
 * actual files live on an external CDN/bucket (owner decision #2 — large video
 * renditions are NOT committed to the repo). Dropping in real footage later is
 * a no-code operation: upload the encoded renditions + posters to the bucket
 * and set the CDN base — the components never change.
 *
 * When the base is unset (local dev, preview with no bucket, or a driver on
 * Save-Data), `footageReady()` is false: the video layer shows graded poster
 * placeholders and the SSR story carries every scene with zero video. Nothing
 * ever renders blank or breaks.
 *
 * Dependency-free on purpose: imported by both the server route and client
 * components, and must never drag anything heavy into the initial bundle.
 */

/**
 * External asset host, e.g. https://cdn.example.com/road-ahead — read live so
 * it is unit-testable (Next inlines the NEXT_PUBLIC_ value into the client
 * build regardless). Trailing slashes trimmed.
 */
export function cdnBase(): string {
  return (process.env.NEXT_PUBLIC_ROAD_AHEAD_CDN ?? '').replace(/\/+$/, '');
}

/** True only when an external asset host is configured. */
export function footageReady(): boolean {
  return cdnBase().length > 0;
}

/** Resolve a relative asset key to a full URL, or null when no host is set. */
export function resolveAsset(key: string): string | null {
  const base = cdnBase();
  if (!base) return null;
  return `${base}/${key.replace(/^\/+/, '')}`;
}

export type ClipVariant = 'mobile' | 'desktop';

export interface FootageClip {
  /** Stable id, also the base filename convention. */
  id: string;
  /** Relative keys per rendition — the encode ladder from the plan (§4.2). */
  mobile: string;
  desktop: string;
  /** Optional smaller/modern rendition, tried first when present. */
  webm?: string;
  /** Poster still (first meaningful frame); shown until the clip can play. */
  poster: string;
  /** Muted-first caption — the story must read with zero audio (a11y §7). */
  caption: string;
  /** Documentary beat length in ms (Ken-Burns hold), from the treatment. */
  holdMs: number;
}

export interface FootageScene {
  id: string;
  title: string;
  clips: FootageClip[];
}

/** `<source>` list for a clip + variant — empty when no host is configured. */
export function clipSources(
  clip: FootageClip,
  variant: ClipVariant,
): { src: string; type: string }[] {
  if (!footageReady()) return [];
  const out: { src: string; type: string }[] = [];
  if (clip.webm) {
    const w = resolveAsset(clip.webm);
    if (w) out.push({ src: w, type: 'video/webm' });
  }
  const mp4 = resolveAsset(variant === 'mobile' ? clip.mobile : clip.desktop);
  if (mp4) out.push({ src: mp4, type: 'video/mp4' });
  return out;
}

/** Poster URL for a clip, or null when no host is configured. */
export function clipPoster(clip: FootageClip): string | null {
  return resolveAsset(clip.poster);
}

/**
 * The storyboard as data. Phase 0.5 wires the two footage-driven scenes the
 * treatment opens with — the dark road (Scene 1) and the 17-years montage
 * (Scene 2). Later phases append Scenes 3, 4 and 6 clips to this same manifest;
 * no component changes when they do.
 */
export const FOOTAGE_SCENES: Record<string, FootageScene> = {
  scene1_dark_road: {
    id: 'scene1_dark_road',
    title: 'The Dark Road',
    clips: [
      {
        id: 'dark-highway',
        mobile: 'scene1/dark-highway.720.mp4',
        desktop: 'scene1/dark-highway.1080.mp4',
        webm: 'scene1/dark-highway.vp9.webm',
        poster: 'scene1/dark-highway.jpg',
        caption: 'A single pair of headlights on a pre-dawn Georgia highway.',
        holdMs: 12000,
      },
    ],
  },
  scene2_montage: {
    id: 'scene2_montage',
    title: '17 Years',
    clips: [
      {
        id: 'backing-trailer',
        mobile: 'scene2/backing-trailer.720.mp4',
        desktop: 'scene2/backing-trailer.1080.mp4',
        poster: 'scene2/backing-trailer.jpg',
        caption: 'Backing a fifty-three-foot trailer, clean and slow.',
        holdMs: 1100,
      },
      {
        id: 'pre-trip',
        mobile: 'scene2/pre-trip.720.mp4',
        desktop: 'scene2/pre-trip.1080.mp4',
        poster: 'scene2/pre-trip.jpg',
        caption: 'The pre-trip walkaround — every light, every hose.',
        holdMs: 1000,
      },
      {
        id: 'sunrise-hood',
        mobile: 'scene2/sunrise-hood.720.mp4',
        desktop: 'scene2/sunrise-hood.1080.mp4',
        poster: 'scene2/sunrise-hood.jpg',
        caption: 'Sunrise breaking over the hood.',
        holdMs: 1000,
      },
      {
        id: 'hands-on-wheel',
        mobile: 'scene2/hands-on-wheel.720.mp4',
        desktop: 'scene2/hands-on-wheel.1080.mp4',
        poster: 'scene2/hands-on-wheel.jpg',
        caption: 'Hands on the wheel — seventeen years of them.',
        holdMs: 900,
      },
      {
        id: 'student-passenger',
        mobile: 'scene2/student-passenger.720.mp4',
        desktop: 'scene2/student-passenger.1080.mp4',
        poster: 'scene2/student-passenger.jpg',
        caption: 'A student in the passenger seat, learning it right.',
        holdMs: 1200,
      },
    ],
  },
};

/** The Anton title cards for the montage, synced to the beats (treatment S2). */
export const MONTAGE_CARDS = [
  '17 YEARS.',
  'ZERO VIOLATIONS.',
  'THOUSANDS OF STUDENTS.',
  'ONE PROMISE.',
] as const;

export function getScene(id: string): FootageScene | undefined {
  return FOOTAGE_SCENES[id];
}
