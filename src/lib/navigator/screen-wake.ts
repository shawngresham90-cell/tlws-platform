/**
 * Screen wake during navigation (Block 2, priority I — mobile browser
 * lifecycle).
 *
 * A phone left alone sleeps its screen in thirty seconds. On the driving
 * surface that is not a cosmetic problem: the next maneuver is on a dark
 * screen, and the only way to see it is to pick up or touch the phone —
 * exactly the interaction the whole safety design exists to remove. The
 * Screen Wake Lock API is the sanctioned way to say "this page is being
 * looked at"; this module decides WHEN to hold one.
 *
 * The rule is one line: hold a lock while navigation is live and the page
 * is visible; hold nothing otherwise. Everything else here exists because
 * the platform is not that tidy —
 *
 *   - The browser releases the lock itself whenever the page hides (tab
 *     switch, phone lock, a call). Coming back does NOT restore it, so a
 *     driver who takes a call loses the screen for the rest of the trip
 *     unless it is re-requested.
 *   - `request()` is async, and navigation can end while one is in
 *     flight. A sentinel that arrives after that must be released at
 *     once, not held over an idle screen.
 *   - `request()` rejects — permissions policy, battery saver, headless.
 *     A refusal is reported, never retried in a loop.
 *
 * Pure: the platform arrives as an injected port, nothing here reads a
 * clock or touches a browser global.
 */

/** One held lock. `onRelease` fires if the PLATFORM drops it. */
export type WakeSentinel = {
  release(): void;
  onRelease(cb: () => void): void;
};

export type WakePort = {
  supported: boolean;
  /** Resolves to a sentinel, or null when the platform refused. */
  request(): Promise<WakeSentinel | null>;
};

export type WakeSnapshot = {
  supported: boolean;
  /** True only while a live sentinel is held. */
  held: boolean;
  /** Requests actually sent to the platform — the cost this module adds. */
  requests: number;
  /** Consecutive refusals; requests stop once this hits the cap. */
  refusals: number;
  /** Set when the platform refused, so the pilot report can say why. */
  lastRefusal: string | null;
};

/**
 * Consecutive refusals before this module stops asking. A device with the
 * API behind a permissions policy will refuse every single time, and a
 * request per re-render would be a battery leak that fixes nothing. The
 * count resets the moment a request succeeds.
 */
export const MAX_REFUSALS = 3;

export type ScreenWake = {
  /** Navigation live (true) or not. */
  setActive(active: boolean): void;
  /** Page visible (true) or hidden. */
  setVisible(visible: boolean): void;
  snapshot(): WakeSnapshot;
};

export function createScreenWake(port: WakePort): ScreenWake {
  let active = false;
  let visible = true;
  let sentinel: WakeSentinel | null = null;
  let inFlight = false;
  let requests = 0;
  let refusals = 0;
  let lastRefusal: string | null = null;

  const wanted = () => active && visible;

  function sync(): void {
    if (!port.supported) return;
    if (wanted()) {
      if (sentinel !== null || inFlight) return;
      if (refusals >= MAX_REFUSALS) return;
      inFlight = true;
      requests += 1;
      port.request().then(
        (s) => {
          inFlight = false;
          if (s === null) {
            refusals += 1;
            lastRefusal = 'refused';
            return;
          }
          refusals = 0;
          lastRefusal = null;
          // Navigation may have ended while the request was in flight.
          // Holding the screen awake over an idle page is a battery bug.
          if (!wanted()) {
            s.release();
            return;
          }
          sentinel = s;
          s.onRelease(() => {
            // The platform dropped it (page hidden, OS policy). Only the
            // CURRENT sentinel may clear the slot — a late callback from
            // a lock we already replaced must not.
            if (sentinel === s) sentinel = null;
            sync();
          });
        },
        (err: unknown) => {
          inFlight = false;
          refusals += 1;
          lastRefusal = err instanceof Error ? err.name : 'error';
        },
      );
      return;
    }
    if (sentinel !== null) {
      const s = sentinel;
      sentinel = null;
      s.release();
    }
  }

  return {
    setActive(next: boolean): void {
      if (active === next) return;
      active = next;
      // A fresh trip deserves a fresh chance: a device that refused
      // during the last trip may well grant one now.
      if (next) refusals = 0;
      sync();
    },
    setVisible(next: boolean): void {
      if (visible === next) return;
      visible = next;
      sync();
    },
    snapshot: () => ({
      supported: port.supported,
      held: sentinel !== null,
      requests,
      refusals,
      lastRefusal,
    }),
  };
}
