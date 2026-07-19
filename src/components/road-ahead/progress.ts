'use client';

/**
 * THE ROAD AHEAD — the shared scroll-progress store ("one conductor").
 *
 * The whole experience reads a single normalized timeline value so nothing owns
 * its own clock (plan §1.1). The GSAP conductor pushes progress here every tick;
 * the video layer and the (reused) R3F spine subscribe and update imperatively —
 * deliberately NOT React state, so scroll never triggers a re-render (the same
 * discipline SpineCanvas already uses reading the DOM per frame).
 *
 * `progress` is 0→1 across the pinned cinematic section. `scene` is the active
 * scene id from the footage manifest. `velocity` (−1→1-ish) lets the video layer
 * add motion-blur on fast scroll and "savor" on slow, per the treatment's
 * scroll-as-throttle law.
 */
export interface CinemaProgress {
  progress: number;
  velocity: number;
  scene: string;
}

let state: CinemaProgress = { progress: 0, velocity: 0, scene: 'scene1_dark_road' };
const subs = new Set<(s: CinemaProgress) => void>();

export function setCinemaProgress(patch: Partial<CinemaProgress>): void {
  state = { ...state, ...patch };
  subs.forEach((fn) => fn(state));
}

export function getCinemaProgress(): CinemaProgress {
  return state;
}

export function subscribeCinemaProgress(fn: (s: CinemaProgress) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
