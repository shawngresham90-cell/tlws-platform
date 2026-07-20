/**
 * Pure scroll/animation math for THE ROAD AHEAD cinematic experience.
 *
 * DB-free and DOM-free on purpose: every function here is a plain number
 * transform so the scroll choreography can be unit-tested in isolation
 * (scripts/test-road-ahead.ts) and reused by both the client hooks and any
 * server-computed defaults. The client hooks feed real scroll positions in;
 * these functions decide what fraction of each beat has played.
 */

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Clamp into the animation-normal range [0, 1]. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Linear interpolate from a→b by t (t is NOT clamped; caller decides). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map `value` from the input range [inMin, inMax] onto [outMin, outMax],
 * clamped to the output range. A zero-width input range maps to outMin
 * (no divide-by-zero, no Infinity leaking into a transform).
 */
export function mapClamp(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const span = inMax - inMin;
  if (span === 0) return outMin;
  const t = (value - inMin) / span;
  return clamp(lerp(outMin, outMax, t), Math.min(outMin, outMax), Math.max(outMin, outMax));
}

/** Cubic ease-in-out — the default cinematic easing for pinned reveals. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Smoothstep (Hermite) — softer than cubic, used for light/opacity sweeps. */
export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * Progress of a fixed-height element through the viewport, 0→1.
 *
 * `top` is the element's top relative to the viewport top (getBoundingClientRect
 * .top). Progress is 0 while the element's top is at/below the viewport bottom
 * and 1 once it has scrolled a full (viewportHeight + elementHeight) past — i.e.
 * the element has completely crossed the viewport. Used for parallax depth.
 */
export function crossViewportProgress(
  top: number,
  elementHeight: number,
  viewportHeight: number,
): number {
  const total = viewportHeight + elementHeight;
  if (total <= 0) return 0;
  // top === viewportHeight  → just entering (0)
  // top === -elementHeight  → fully passed (1)
  const travelled = viewportHeight - top;
  return clamp01(travelled / total);
}

/**
 * Progress of a "pinned" beat given how far the sticky child has scrolled
 * within its tall parent. `scrolledPast` is how many pixels of the parent have
 * moved above the viewport top; `pinnedRange` is the scrollable overshoot
 * (parentHeight − viewportHeight). Returns the eased [0,1] play-head.
 */
export function pinnedProgress(scrolledPast: number, pinnedRange: number): number {
  if (pinnedRange <= 0) return 0;
  return clamp01(scrolledPast / pinnedRange);
}

/**
 * Split an overall [0,1] play-head into a sub-beat's local [0,1]. Lets one
 * pinned section stage several reveals: e.g. subBeat(p, 0.2, 0.5) is 0 until
 * p reaches 0.2, 1 once p passes 0.5, linear between.
 */
export function subBeat(progress: number, start: number, end: number): number {
  return mapClamp(progress, start, end, 0, 1);
}
