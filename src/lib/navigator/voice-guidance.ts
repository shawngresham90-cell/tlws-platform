/**
 * Voice guidance core (Navigator milestone N7) — speech OUTPUT only, per
 * docs/navigator/06-safety.md §3. Three priorities with fixed behaviour:
 *
 *   critical  jumps the queue; preempts anything speaking EXCEPT a
 *             maneuver, which it waits for rather than cutting the turn
 *             in half (see the critical branch of request())
 *   normal    queued in order
 *   passive   dropped entirely if anything is speaking or queued
 *
 * Rules enforced here: never two utterances at once, never repeat an
 * announcement (every request carries an announce-once id), one-touch
 * mute, and silent degradation when speech is unsupported. Speech input
 * (microphone, recognition, push-to-talk) is milestone N15 and does not
 * exist here in any form.
 *
 * Pure (AD-2): the actual speech engine arrives as an injected SpeechPort
 * — the browser adapter lives in the component layer; tests inject a
 * scripted port. No browser globals, no clocks, no timers in this module.
 */

import type { RemainingClocks } from '@/lib/trip-planner/types';
import type { HosWarning } from './hos-strip';
import type { ManeuverView } from './maneuver-engine';
import { normalizeInstruction } from './maneuver-text';
import type { DrivingScreenStatus } from './navigation-controller';

export type VoicePriority = 'critical' | 'normal' | 'passive';

/**
 * The supersession group every maneuver line carries. It does two jobs:
 * a newer stage of the same turn evicts an older one still queued, and a
 * critical line will not cut a maneuver mid-sentence. Exported so the
 * announcer that stamps it and the guard that honours it cannot drift.
 */
export const MANEUVER_GROUP = 'maneuver';

export type VoiceRequest = {
  /** Announce-once key. The same id is never spoken twice, ever. */
  id: string;
  priority: VoicePriority;
  text: string;
  /**
   * Supersession group. A newer request in the same group makes older
   * QUEUED requests obsolete and evicts them — a driver must hear the
   * instruction for where they are now, not a backlog of where they were.
   *
   * Eviction touches the queue only, never the utterance already in the
   * driver's ear: cutting speech mid-word to say something similar is its
   * own kind of noise.
   */
  group?: string;
};

/** What happened to a request — exact, for tests and honest displays. */
export type VoiceOutcome =
  | 'spoken'
  | 'queued'
  | 'dropped-repeat'
  | 'dropped-passive-busy'
  | 'dropped-muted'
  | 'dropped-unavailable';

/**
 * The speech seam. `speak` must call `onDone` exactly once when the
 * utterance ends (finished, cancelled, or errored — the module treats
 * them alike). `cancel` stops the current utterance immediately.
 */
export type SpeechPort = {
  supported: boolean;
  speak(text: string, onDone: () => void): void;
  cancel(): void;
};

export type VoiceSnapshot = {
  supported: boolean;
  muted: boolean;
  speakingId: string | null;
  queuedIds: string[];
  announcedCount: number;
};

export type VoiceGuidance = {
  request(req: VoiceRequest): VoiceOutcome;
  mute(): void;
  unmute(): void;
  /**
   * Cancel the current utterance and drop everything queued WITHOUT
   * changing the mute preference or forgetting announce-once ids. Used on
   * navigation stop, arrival, and route replacement — stale guidance must
   * die instantly, but the driver's voice on/off choice stands.
   */
  clearPending(): void;
  /**
   * Caller-driven watchdog. A speech engine can accept an utterance and
   * then never report it finished — a real speechSynthesis behavior when
   * the tab backgrounds or the engine is interrupted by the OS. The
   * queue would then be jammed for the rest of the trip and the driver
   * would simply stop being told about turns, silently.
   *
   * Pass the current time on the caller's ordinary cadence. Nothing
   * happens until an utterance has been outstanding for
   * STUCK_UTTERANCE_MS across two ticks; then it is retired and the
   * queue drains. Time arrives as an argument here, as everywhere else
   * in this module — no clock is read.
   */
  tick(nowMs: number): void;
  snapshot(): VoiceSnapshot;
};

/**
 * How long an utterance may be outstanding before the watchdog treats it
 * as lost. A spoken maneuver line runs about three seconds; twenty is
 * unambiguous without ever cutting off real speech.
 */
export const STUCK_UTTERANCE_MS = 20_000;

export type VoiceOptions = {
  /**
   * Start muted (default TRUE for the driving screen): voice never speaks
   * on ordinary page load — the driver explicitly enables it. Announcers
   * mark their own fired flags regardless of mute, so enabling later never
   * replays announcements that became stale while muted.
   */
  startMuted?: boolean;
};

export function createVoiceGuidance(port: SpeechPort, options: VoiceOptions = {}): VoiceGuidance {
  let muted = options.startMuted === true;
  let speaking: VoiceRequest | null = null;
  const queue: VoiceRequest[] = [];
  const announced = new Set<string>();
  // Guards stale port callbacks: cancel() may still fire the old
  // utterance's onDone in some engines; only the live token advances.
  let token = 0;
  // When the current utterance was first SEEN by the watchdog, not when
  // it started — `request` takes no clock, and inventing one here would
  // make this module read time.
  let speakingSinceMs: number | null = null;

  function speakNow(req: VoiceRequest): void {
    speaking = req;
    speakingSinceMs = null;
    const mine = ++token;
    const done = () => {
      if (mine !== token) return;
      speaking = null;
      speakingSinceMs = null;
      const next = queue.shift();
      if (next) speakNow(next);
    };
    try {
      port.speak(req.text, done);
    } catch {
      // A speech engine that throws is a broken speaker, not a broken
      // truck: swallow it here so the exception never reaches the
      // navigation effect that asked for the line, and treat it as an
      // utterance that ended instantly so the queue keeps moving.
      done();
    }
  }

  /**
   * Drop queued requests the incoming one makes obsolete. Same group only,
   * queue only — see VoiceRequest.group.
   */
  function evictSuperseded(req: VoiceRequest): void {
    if (req.group === undefined) return;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].group === req.group) queue.splice(i, 1);
    }
  }

  function stopCurrent(): void {
    if (speaking === null) return;
    token++; // invalidate the pending onDone before cancelling
    speaking = null;
    speakingSinceMs = null;
    try {
      port.cancel();
    } catch {
      // Same reasoning as speak(): a throwing engine must not take the
      // driving screen down with it.
    }
  }

  return {
    request(req: VoiceRequest): VoiceOutcome {
      if (!port.supported) return 'dropped-unavailable';
      if (muted) return 'dropped-muted';
      if (announced.has(req.id)) return 'dropped-repeat';

      if (req.priority === 'passive') {
        if (speaking !== null || queue.length > 0) return 'dropped-passive-busy';
        announced.add(req.id);
        speakNow(req);
        return 'spoken';
      }

      if (req.priority === 'critical') {
        announced.add(req.id);
        evictSuperseded(req);
        // A critical line jumps the queue — but it does not cut a TURN
        // out of the driver's ear. An HOS clock crossing at 30 minutes
        // is important and can wait the two seconds a maneuver line
        // takes; the turn cannot, and it would never come back, because
        // its announce-once flag is already set. The result on the road
        // was "Turn right onto Old M—" followed by a clock warning, and
        // the driver missing the turn.
        //
        // Anything genuinely instantaneous would need a new priority
        // above this one; nothing today is.
        if (speaking !== null && speaking.group === MANEUVER_GROUP) {
          queue.unshift(req);
          return 'queued';
        }
        stopCurrent();
        speakNow(req);
        return 'spoken';
      }

      // normal: speak when idle, otherwise wait in order.
      announced.add(req.id);
      evictSuperseded(req);
      if (speaking === null) {
        speakNow(req);
        return 'spoken';
      }
      queue.push(req);
      return 'queued';
    },

    tick(nowMs: number): void {
      if (speaking === null) {
        speakingSinceMs = null;
        return;
      }
      if (speakingSinceMs === null) {
        speakingSinceMs = nowMs;
        return;
      }
      if (nowMs - speakingSinceMs < STUCK_UTTERANCE_MS) return;
      // Retire the lost utterance and move on. `stopCurrent` invalidates
      // its callback first, so a late `onDone` from a slow engine cannot
      // double-advance the queue.
      stopCurrent();
      const next = queue.shift();
      if (next) speakNow(next);
    },

    mute(): void {
      muted = true;
      queue.length = 0;
      stopCurrent();
    },

    unmute(): void {
      muted = false;
    },

    clearPending(): void {
      queue.length = 0;
      stopCurrent();
    },

    snapshot(): VoiceSnapshot {
      return {
        supported: port.supported,
        muted,
        speakingId: speaking?.id ?? null,
        queuedIds: queue.map((q) => q.id),
        announcedCount: announced.size,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Maneuver announcements — doc 05 §3. Thresholds scale with speed; fired
// flags are per (maneuver, tier) and never reset, which combined with the
// tracker's monotonic route-mile makes double-announcement structurally
// impossible.

export type ManeuverTier = 'prepare' | 'approach' | 'execute';

/** Threshold miles by tier: [fast ≥ 50 mph, slow < 50 mph]. */
export const MANEUVER_THRESHOLDS_MI: Record<ManeuverTier, [number, number]> = {
  prepare: [2.0, 0.5],
  approach: [0.5, 0.15],
  execute: [0.1, 200 / 5280], // 200 ft below 50 mph
};

const TIER_ORDER: ManeuverTier[] = ['prepare', 'approach', 'execute'];

function maneuverKey(m: { mileMi: number; instruction: string }): string {
  return `${m.mileMi}@${m.instruction}`;
}

/** Speed-scaled threshold for one tier. Unknown speed uses the slow set. */
export function tierThresholdMi(tier: ManeuverTier, speedMph: number | null): number {
  const [fast, slow] = MANEUVER_THRESHOLDS_MI[tier];
  return speedMph !== null && speedMph >= 50 ? fast : slow;
}

/**
 * Spoken distance, in coarse buckets a driver actually uses. Deliberately
 * NOT a linear readout of GPS distance: "in 0.8 miles" then "in 0.7 miles"
 * is the chatter this policy exists to prevent, and a truck driver steers
 * by landmarks, not decimals.
 */
function distanceText(mi: number): string {
  if (mi >= 0.94) {
    const rounded = Math.round(mi * 10) / 10;
    // "In 1 miles" is the kind of thing that makes a product feel fake.
    if (rounded === 1) return 'In 1 mile';
    return `In ${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} miles`;
  }
  if (mi >= 0.4) return 'In half a mile';
  // 0.2-0.4 mi read as feet ("in 1,600 feet") is a number nobody pictures.
  if (mi >= 0.2) return 'In a quarter mile';
  return `In ${Math.round((mi * 5280) / 100) * 100} feet`;
}

export type ManeuverAnnouncer = {
  /**
   * Announcements newly due for the current view — each (maneuver, tier)
   * at most once for the announcer's lifetime. Chained maneuvers (the
   * next two within one prepare threshold of each other) come out as one
   * combined instruction and the second maneuver's prepare tier is
   * suppressed.
   */
  collect(view: ManeuverView, speedMph: number | null): VoiceRequest[];
};

export function createManeuverAnnouncer(): ManeuverAnnouncer {
  const fired = new Set<string>();

  return {
    collect(view: ManeuverView, speedMph: number | null): VoiceRequest[] {
      const next = view.next;
      if (next === null || view.distanceMi === null) return [];
      const out: VoiceRequest[] = [];
      const key = maneuverKey(next);
      const prepareMi = tierThresholdMi('prepare', speedMph);

      const chained =
        view.following !== null && view.following.mileMi - next.mileMi <= prepareMi
          ? view.following
          : null;
      if (chained) fired.add(`${maneuverKey(chained)}:prepare`);

      /*
       * AT MOST ONE announcement per tick, and it is the NEAREST tier that
       * has come due.
       *
       * The previous policy emitted every due-and-unfired tier in the same
       * call. Whenever the announcer met a maneuver already inside a closer
       * threshold — every reroute (fresh announcer), a trip started near a
       * turn, GPS resuming after a tunnel — the driver got two or three
       * near-identical sentences back to back:
       *
       *   "In half a mile, turn right onto Highway 92."
       *   "In 500 feet, turn right onto Highway 92."
       *   "Turn right onto Highway 92."
       *
       * TIER_ORDER runs far → near, so the last match is the most urgent.
       */
      let due: ManeuverTier | null = null;
      for (const tier of TIER_ORDER) {
        const flag = `${key}:${tier}`;
        if (fired.has(flag)) continue;
        if (view.distanceMi > tierThresholdMi(tier, speedMph)) continue;
        due = tier;
      }
      if (due === null) return out;

      // Everything farther than the tier we are about to speak is now
      // obsolete — announcing "in two miles" to a driver 300 feet from the
      // turn is worse than saying nothing. Burn those flags silently.
      for (const tier of TIER_ORDER) {
        fired.add(`${key}:${tier}`);
        if (tier === due) break;
      }

      // Spoken text is the normalized instruction: HERE appends the length
      // of the road AFTER the turn ("Turn right onto Broad St. Go for 1.3
      // mi."), which a voice reads out on every single maneuver while the
      // announcement's own "In half a mile" already gave the distance that
      // matters. Keys stay on the RAW text so announce-once is unaffected.
      const nextText = normalizeInstruction(next.instruction) ?? next.instruction;
      const chainedText =
        chained === null
          ? null
          : (normalizeInstruction(chained.instruction) ?? chained.instruction);
      const body = chainedText === null ? nextText : `${nextText}, then ${chainedText}`;
      out.push({
        id: `maneuver:${key}:${due}`,
        priority: 'normal',
        // One group for every maneuver line: a newer stage evicts an older
        // stage still waiting in the queue, and a critical line waits for
        // it rather than cutting the turn in half.
        group: MANEUVER_GROUP,
        text: due === 'execute' ? body : `${distanceText(view.distanceMi)}, ${body}`,
      });
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// HOS threshold announcements — doc 05 §9: crossing a clock threshold is
// voice-announced. Announce-once per (clock, severity); an escalation to a
// deeper severity is a new announcement, staying at one severity is not.

/** "45 minutes", "1 hour", "1 hour 30 minutes" — h:mm is unreadable aloud. */
export function speakableMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} minute${rest === 1 ? '' : 's'}`;
  const hours = `${h} hour${h === 1 ? '' : 's'}`;
  return rest === 0 ? hours : `${hours} ${rest} minute${rest === 1 ? '' : 's'}`;
}

const HOS_CLOCK_MINUTES: Record<
  NonNullable<HosWarning['clock']>,
  { pick(r: RemainingClocks): number; label: string; overdue: string }
> = {
  break: {
    pick: (r) => r.untilBreakMin,
    label: 'Break required in',
    overdue: 'Break required now',
  },
  driving: {
    pick: (r) => r.drivingMin,
    label: 'Driving limit in',
    overdue: 'Driving limit reached',
  },
  window: {
    pick: (r) => r.windowMin,
    label: 'On-duty window ends in',
    overdue: 'On-duty window ended',
  },
  cycle: {
    pick: (r) => r.cycleMin,
    label: 'Cycle limit in',
    overdue: 'Cycle limit reached',
  },
};

/** Spoken form of the binding-clock warning (never h:mm digits). */
export function hosVoiceText(warning: HosWarning, remaining: RemainingClocks): string | null {
  if (warning.severity === 'none' || warning.clock === null) return null;
  const clock = HOS_CLOCK_MINUTES[warning.clock];
  const minutes = clock.pick(remaining);
  return minutes <= 0 ? clock.overdue : `${clock.label} ${speakableMinutes(minutes)}`;
}

export type HosAnnouncer = {
  collect(warning: HosWarning, remaining: RemainingClocks): VoiceRequest[];
};

export function createHosAnnouncer(): HosAnnouncer {
  return {
    collect(warning: HosWarning, remaining: RemainingClocks): VoiceRequest[] {
      if (warning.severity === 'none' || warning.clock === null) return [];
      const text = hosVoiceText(warning, remaining);
      if (text === null) return [];
      return [
        {
          // Announce-once id per (clock, severity): the guidance module's
          // repeat guard makes staying at one severity silent.
          id: `hos:${warning.clock}:${warning.severity}`,
          // ≤30 min is imminent (doc 06 critical class); the 60-min notice
          // is informational and must not preempt a maneuver mid-sentence.
          priority: warning.severity === 'notice' ? 'normal' : 'critical',
          text,
        },
      ];
    },
  };
}

// ---------------------------------------------------------------------------
// Status announcements — "every degradation is announced, none is silent"
// (doc 05). Each transition INTO a speakable state is one announcement;
// a later, separate degradation is a new event with a new id, which is
// not a repeat.

const STATUS_SPEECH: Partial<Record<DrivingScreenStatus, string>> = {
  'position-degraded': 'Position approximate. Guidance continues.',
  'position-lost': 'Position unknown. Showing last known position.',
  'position-unavailable': 'Location unavailable from this device.',
  denied: 'Location permission denied. Navigation cannot run.',
  // 'arrived' is deliberately ABSENT here: trip completion is announced
  // by the lifecycle integration with the HONEST end reason (arrived vs
  // destination-unverified), so the status path never double-speaks it.
};

// ---------------------------------------------------------------------------
// Trip-lifecycle announcements (P1 integration) — route replacement and
// honest trip completion. Ids carry the route id, so announce-once holds
// per trip; cancellation is deliberately SILENT (the driver pressed the
// button — speech would be noise, and doc 06 keeps voice minimal).

export type TripVoiceEvent =
  | { kind: 'route-replaced'; routeId: string }
  | {
      kind: 'trip-ended';
      routeId: string;
      endReason: 'arrived' | 'destination-unverified' | 'cancelled';
    };

export function tripVoiceRequest(ev: TripVoiceEvent): VoiceRequest | null {
  if (ev.kind === 'route-replaced') {
    return { id: `route:${ev.routeId}:updated`, priority: 'normal', text: 'Route updated.' };
  }
  if (ev.endReason === 'cancelled') return null;
  return {
    id: `trip-end:${ev.routeId}:${ev.endReason}`,
    priority: 'normal',
    text:
      ev.endReason === 'arrived'
        ? 'You have arrived.'
        : 'You have arrived. Destination entrance is unverified.',
  };
}

export type StatusAnnouncer = {
  collect(status: DrivingScreenStatus): VoiceRequest[];
};

export function createStatusAnnouncer(): StatusAnnouncer {
  let last: DrivingScreenStatus | null = null;
  let seq = 0;

  return {
    collect(status: DrivingScreenStatus): VoiceRequest[] {
      if (status === last) return [];
      last = status;
      seq++;
      const text = STATUS_SPEECH[status];
      if (text === undefined) return [];
      return [{ id: `status:${seq}:${status}`, priority: 'normal', text }];
    },
  };
}
