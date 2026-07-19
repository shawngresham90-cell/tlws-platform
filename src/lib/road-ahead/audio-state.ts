/**
 * Pure state machine for THE ROAD AHEAD's optional ambient soundtrack.
 *
 * Accessibility + policy contract, enforced here so the UI can't drift from it:
 *   - Audio is OFF by default and only ever starts from an explicit user gesture
 *     (no autoplay-with-sound — a hard browser + accessibility rule).
 *   - When no licensed track is configured, the control is 'unavailable' and the
 *     UI hides it entirely rather than showing a dead button.
 *   - The soundtrack is purely atmospheric; it never carries information, so a
 *     driver who never enables it misses nothing.
 *   - If the browser rejects playback, we land in 'blocked' (a labelled,
 *     retryable state) instead of pretending sound is on.
 *
 * DB-free / React-free so the transitions are unit-tested in isolation
 * (scripts/test-road-ahead.ts) and shared by the client hook.
 */

export type AudioStatus = 'unavailable' | 'off' | 'on' | 'blocked';

export type AudioState = { status: AudioStatus };

export type AudioAction =
  | { type: 'INIT'; hasTrack: boolean }
  | { type: 'TOGGLE' }
  | { type: 'ENABLE' }
  | { type: 'DISABLE' }
  | { type: 'BLOCKED' }
  | { type: 'ENDED' };

/** Before init we assume nothing to play — the control stays hidden. */
export const INITIAL_AUDIO_STATE: AudioState = { status: 'unavailable' };

export function audioReducer(state: AudioState, action: AudioAction): AudioState {
  switch (action.type) {
    case 'INIT':
      // (Re)establish availability from whether a track is configured. This is
      // the only transition that can leave 'unavailable'.
      return { status: action.hasTrack ? 'off' : 'unavailable' };

    case 'TOGGLE':
      if (state.status === 'unavailable') return state;
      // off → on, on → off, blocked → on (an explicit retry).
      return { status: state.status === 'on' ? 'off' : 'on' };

    case 'ENABLE':
      if (state.status === 'unavailable') return state;
      return { status: 'on' };

    case 'DISABLE':
      if (state.status === 'unavailable') return state;
      return { status: 'off' };

    case 'BLOCKED':
      if (state.status === 'unavailable') return state;
      return { status: 'blocked' };

    case 'ENDED':
      // A non-looping track finishing returns us to the resting 'off' state.
      return state.status === 'on' ? { status: 'off' } : state;

    default:
      return state;
  }
}

/** Should the `<audio>` element be actively playing? */
export function isAudioPlaying(state: AudioState): boolean {
  return state.status === 'on';
}

/** Should the toggle control render at all? (Hidden when there's no track.) */
export function isAudioControlVisible(state: AudioState): boolean {
  return state.status !== 'unavailable';
}

/** Accessible label for the toggle in each state. */
export function audioControlLabel(state: AudioState): string {
  switch (state.status) {
    case 'on':
      return 'Turn off soundtrack';
    case 'blocked':
      return 'Soundtrack blocked — tap to retry';
    default:
      return 'Turn on soundtrack';
  }
}
