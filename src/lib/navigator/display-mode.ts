/**
 * Navigator display mode (NAV-ENTRY-1) — Automatic, Night, or Day.
 *
 * ONE AUTHORITY. The design tokens already shipped both palettes: night on
 * `:root` (night is the design — blueprint law 3) and a complete day palette
 * behind `[data-theme='day']`, dormant because "flipping it on is a wiring
 * decision, not a design one". This module is that wiring, and it is the only
 * thing allowed to decide which palette is live.
 *
 * WHAT AUTOMATIC IS, AND IS NOT. It follows the phone's own light/dark
 * preference — `prefers-color-scheme`, one media query the browser already
 * evaluates. It does NOT compute sunset, does not ask for location, does not
 * call a provider, and does not store a time or a place. That was a real
 * temptation: "automatic" in a truck app suggests sunset math. But sunset
 * math needs a position and a clock policy, it is wrong in a tunnel and wrong
 * at a loading dock, and the driver's phone already knows the answer they
 * chose for every other app they own. Following it is both more correct and
 * strictly less invasive.
 *
 * PRESENTATION ONLY. A display mode is not route state. Nothing here touches
 * geometry, the camera, the lifecycle, or a provider request, and the harness
 * asserts that changing it spends nothing and remounts nothing.
 *
 * Pure: no storage, no DOM, no clock. The provider component supplies the
 * media-query answer; this decides what to do with it.
 */

export type DisplayMode = 'automatic' | 'night' | 'day';

/** The palette actually painted. Only ever one of two. */
export type DisplayTheme = 'night' | 'day';

export const DEFAULT_DISPLAY_MODE: DisplayMode = 'automatic';

export const DISPLAY_MODES: readonly DisplayMode[] = Object.freeze([
  'automatic',
  'night',
  'day',
] as DisplayMode[]);

export type DisplayModeChoice = {
  mode: DisplayMode;
  label: string;
  /** What the driver gets, in one line. */
  help: string;
};

export const DISPLAY_MODE_CHOICES: readonly DisplayModeChoice[] = Object.freeze([
  Object.freeze({
    mode: 'automatic' as const,
    label: 'Automatic',
    help: 'Follows your phone’s light or dark setting.',
  }),
  Object.freeze({ mode: 'night' as const, label: 'Night', help: 'Dark screen, always.' }),
  Object.freeze({ mode: 'day' as const, label: 'Day', help: 'Light screen, always.' }),
] as DisplayModeChoice[]);

/** Anything unrecognised is the documented default, never a guess. */
export function parseDisplayMode(value: unknown): DisplayMode {
  return DISPLAY_MODES.includes(value as DisplayMode)
    ? (value as DisplayMode)
    : DEFAULT_DISPLAY_MODE;
}

/**
 * The palette to paint.
 *
 * `prefersDark` is the phone's answer, or null where the browser cannot say.
 * Night wins the null case: this app's design IS night, so an unknown
 * preference falls back to the shipped default rather than to a light screen
 * a driver never asked for at 3 a.m.
 */
export function resolveTheme(mode: DisplayMode, prefersDark: boolean | null): DisplayTheme {
  if (mode === 'night') return 'night';
  if (mode === 'day') return 'day';
  return prefersDark === false ? 'day' : 'night';
}

/**
 * The value for the `data-theme` attribute, or null to REMOVE it.
 *
 * Night is `:root` itself, so night is the absence of the attribute rather
 * than `data-theme="night"`. Returning null instead of a string is what keeps
 * that true — a caller cannot accidentally invent a third palette by writing
 * an attribute value the stylesheet has never heard of.
 */
export function themeAttribute(theme: DisplayTheme): 'day' | null {
  return theme === 'day' ? 'day' : null;
}

/**
 * The map's void colour — what shows through where a tile has not loaded.
 *
 * The basemap itself is NOT restyled by display mode, and that is a deliberate
 * refusal rather than an omission: the shipped tiles are OpenStreetMap raster
 * street tiles, there is no night tile set behind them, and inverting or
 * dimming a day map into a "night map" repaints roads into something a driver
 * could read as information. The existing mild desaturation stays exactly as
 * it is in both modes. What legitimately follows the theme is the colour of
 * the nothing behind the tiles, and it is applied as a paint property on the
 * layer that already exists — no `setStyle`, so no remount, no camera reset,
 * no route redraw.
 */
export const MAP_VOID_COLOR: Readonly<Record<DisplayTheme, string>> = Object.freeze({
  night: '#0A0E13',
  day: '#E8EBEE',
});
