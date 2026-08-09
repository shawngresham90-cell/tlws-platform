/**
 * Driver first name, the time-of-day greeting, and the initial route-start
 * phrase.
 *
 * Three separable pieces, deliberately kept in one module because they
 * share one rule: the driver's name is a SESSION-ONLY value that exists to
 * be spoken, and nothing else.
 *
 *   1. `normalizeFirstName` — an ALLOW-LIST validator. Letters, apostrophes
 *      and hyphens; a letter at each end; nothing else gets through. An
 *      allow-list is the only honest answer to "reject HTML/script
 *      injection": a deny-list of `<`, `&`, `javascript:` is a list of the
 *      attacks someone thought of, and this string is read aloud by a
 *      speech engine and rendered into a page.
 *
 *   2. `getGreetingPeriod` — the time bucket, as a PURE function of the
 *      LOCAL HOUR. `Date` is banned under `src/lib/navigator/` (AD-2,
 *      enforced by the purity gate), so the hour arrives as a number
 *      exactly the way every timestamp in this layer does. The component
 *      edge reads the driver's device clock and passes it in.
 *
 *   3. `createDriverPhraseAnnouncer` — the eligibility WINDOW for the two
 *      new phrases. It owns no ledger of its own: announce-once is the
 *      existing one inside `createVoiceGuidance`, keyed by the stable ids
 *      below. This announcer only decides when a phrase may still be
 *      offered at all, which is the part the ledger cannot know.
 *
 * Why both phrases are `passive`, the lowest priority in the module that
 * already exists:
 *
 *   passive is DROPPED — not queued — whenever anything is speaking or
 *   waiting to speak. That is exactly the requested behaviour. A greeting
 *   that waits its turn arrives after a maneuver, and "Good morning,
 *   Shawn" landing on a driver who just took an exit is worse than never
 *   greeting them at all. Nothing new was invented for this: the drop is
 *   the passive branch of `request()`, and the stale-utterance watchdog
 *   (STUCK_UTTERANCE_MS) is the same one every other line rides.
 *
 * Why the greeting has a window rather than a single instant:
 *
 *   Voice starts MUTED by design — nothing speaks on page load — so the
 *   first attempt at a greeting is, in the ordinary flow, made while the
 *   speaker is off, and a single-shot attempt would mean the feature never
 *   works for anybody. So the greeting stays OFFERABLE while the trip has
 *   not started (`idle`, `planning`, `route-ready`) and is burned forever
 *   the moment guidance goes live. Staleness is impossible by
 *   construction: maneuver, reroute and arrival speech only exist once
 *   guidance is live, and by then the greeting can no longer be offered.
 *
 *   "Offerable" is not "said". A phrase is retired only when the guidance
 *   module reports that it actually reached the driver — see
 *   SETTLING_OUTCOMES. The first version of this module had no such
 *   feedback: it offered each phrase and assumed the offer landed. On a
 *   real phone it did not, and there was nothing in the design that could
 *   notice.
 *
 * Why `route-ready` alone proves "this is the INITIAL route":
 *
 *   `LIFECYCLE_TRANSITIONS` admits exactly one edge into `route-ready`,
 *   and it comes from `planning` — the branch taken only after the plan
 *   port returned a route AND `createRouteSession` validated it. A
 *   replacement route lands through `rerouting -> navigating`; a failed or
 *   refused plan lands through `planning -> idle`. Route IDS are never
 *   consulted, because a reroute carries a different id and would have
 *   read as "new route" to any id-based test. The harness pins the shape
 *   of that table so the proof cannot rot.
 *
 * Pure: no clock, no storage, no I/O, no browser globals. The name lives
 * in React state at the component edge for the life of the mounted screen
 * and is never written anywhere.
 */

import type { LifecycleState } from './navigation-lifecycle';
import type { VoiceOutcome, VoiceRequest } from './voice-guidance';

/**
 * Long enough for the first names people actually have, short enough that
 * the field can never become a notes box. Counted in CODE POINTS, so an
 * astral character costs one, not two.
 */
export const MAX_FIRST_NAME_CHARS = 24;

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

export type FirstNameResult = { ok: true; firstName: string } | { ok: false; reason: string };

export const FIRST_NAME_MISSING = 'Enter your first name.';
export const FIRST_NAME_TOO_LONG = `First name is too long — ${MAX_FIRST_NAME_CHARS} characters or fewer.`;
export const FIRST_NAME_INVALID = 'First name only — letters, apostrophes and hyphens.';

/**
 * Control characters (C0, DEL, C1) are rejected on the RAW input, before
 * trimming. A newline is not whitespace to be tidied away here: it is the
 * separator that turns one field into two lines of anything, and the
 * requirement is to refuse it, not to silently swallow it.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * A letter at each end; letters, apostrophes (straight or curly) and
 * hyphens in between. "Shawn", "O'Brien", "Anne-Marie" pass; "<script>",
 * "a@b.com", "555-1212", "Shawn Gresham" and a bare "-" do not.
 *
 * The apostrophes are written as escapes rather than literals so no
 * source-scanning gate — the purity scanner blanks quoted text — has to
 * guess where a string starts.
 */
const FIRST_NAME_SHAPE = /^\p{L}(?:[\p{L}\u2019\u0027-]*\p{L})?$/u;

/**
 * Trim, then refuse anything that is not a plain first name. The accepted
 * value is the trimmed original — never re-cased, because a driver called
 * "d'Angelo" did not ask to be renamed.
 */
export function normalizeFirstName(raw: string | null | undefined): FirstNameResult {
  if (typeof raw !== 'string') return { ok: false, reason: FIRST_NAME_MISSING };
  if (CONTROL_CHARS.test(raw)) return { ok: false, reason: FIRST_NAME_INVALID };
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: FIRST_NAME_MISSING };
  if (Array.from(trimmed).length > MAX_FIRST_NAME_CHARS) {
    return { ok: false, reason: FIRST_NAME_TOO_LONG };
  }
  if (!FIRST_NAME_SHAPE.test(trimmed)) return { ok: false, reason: FIRST_NAME_INVALID };
  return { ok: true, firstName: trimmed };
}

/**
 * The time bucket, from the DRIVER'S DEVICE local hour:
 *
 *   00:00–11:59 morning · 12:00–16:59 afternoon · 17:00–23:59 evening
 *
 * The hour is an argument, never a clock read (AD-2). A fractional or
 * out-of-range hour is floored and clamped rather than throwing — a
 * greeting is not worth a crash on the driving screen — and a non-finite
 * hour is refused upstream by `greetingVoiceRequest`, which says nothing
 * at all rather than guessing at the time of day.
 */
export function getGreetingPeriod(localHour: number): GreetingPeriod {
  const h = Number.isFinite(localHour) ? Math.min(23, Math.max(0, Math.floor(localHour))) : 0;
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const PERIOD_WORD: Record<GreetingPeriod, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
};

/** "Good morning, Shawn." — the sanitized name, nothing appended. */
export function greetingText(period: GreetingPeriod, firstName: string): string {
  return `Good ${PERIOD_WORD[period]}, ${firstName}.`;
}

/** Said once, when the first validated route of the session is ready. */
export function routeStartText(firstName: string): string {
  return `Here's your route, ${firstName}. Now let's get it!`;
}

/**
 * Announce-once keys. Session-scoped and STABLE — no route id, no
 * timestamp, no name — because both phrases are once per live Navigator
 * session and the guidance ledger enforces that on the id alone. A key
 * carrying the route id would say the route-start phrase again on the next
 * trip; one carrying the name would say it again after a correction.
 */
export const GREETING_VOICE_ID = 'driver-greeting';
export const ROUTE_START_VOICE_ID = 'driver-route-start';

/**
 * The greeting as a voice request, or null when there is nothing honest to
 * say (no name, or a device clock that did not give a usable hour).
 */
export function greetingVoiceRequest(
  localHour: number | null,
  firstName: string | null,
): VoiceRequest | null {
  if (firstName === null || firstName === '') return null;
  if (localHour === null || !Number.isFinite(localHour) || localHour < 0 || localHour >= 24) {
    return null;
  }
  return {
    id: GREETING_VOICE_ID,
    priority: 'passive',
    text: greetingText(getGreetingPeriod(localHour), firstName),
  };
}

/** The initial route-start phrase as a voice request, or null with no name. */
export function routeStartVoiceRequest(firstName: string | null): VoiceRequest | null {
  if (firstName === null || firstName === '') return null;
  return { id: ROUTE_START_VOICE_ID, priority: 'passive', text: routeStartText(firstName) };
}

/**
 * Lifecycle states in which the greeting may still be offered: the trip
 * has not started, so no maneuver, reroute or arrival line can exist to be
 * displaced or to make the greeting stale. Anything else closes the window
 * permanently.
 */
const GREETING_STATES: readonly LifecycleState[] = ['idle', 'planning', 'route-ready'];

export type DriverPhraseInput = {
  /** Sanitized first name, or null while none has been accepted. */
  firstName: string | null;
  /** Driver device local hour, supplied by the component edge. */
  localHour: number | null;
  /** The lifecycle's state this tick. */
  lifecycleState: LifecycleState;
};

/**
 * Outcomes that SETTLE a phrase — after one of these it is never offered
 * again for the life of the session.
 *
 * This is the distinction the first cut of this feature got wrong, and it
 * is why nothing was heard on a real phone. `VoiceOutcome` already names
 * the two failures and they are not the same failure:
 *
 *   'dropped-muted' / 'dropped-unavailable'
 *       The ENGINE could not speak — voice is off, or the device has no
 *       speech at all. Nothing about the driver's situation has changed
 *       and no audio was produced. Settling here means the greeting is
 *       consumed by the fact that voice starts muted, which is every
 *       session. NOT settled.
 *
 *   'dropped-passive-busy'
 *       The phrase LOST to speech that outranks it. Also not settled —
 *       but the only speech that can exist while a phrase is still
 *       offerable is the voice-enable confirmation and GPS status, and
 *       losing a race with "Voice guidance on." is not a reason to lose
 *       the greeting for good. Staleness is prevented by the WINDOW, not
 *       by this outcome: the greeting stops being offered the instant
 *       guidance goes live, and the route-start phrase the instant the
 *       machine leaves `route-ready`. Neither can ever be offered while
 *       maneuver, reroute or arrival speech exists.
 *
 *   'spoken'          the driver heard it.
 *   'dropped-repeat'  the guidance ledger already has this id — it was
 *                     spoken earlier in this session.
 *
 * Announce-once itself still belongs entirely to the ledger inside
 * `createVoiceGuidance`; this only decides when to stop asking.
 */
const SETTLING_OUTCOMES: readonly VoiceOutcome[] = ['spoken', 'dropped-repeat'];

export type DriverPhraseAnnouncer = {
  /**
   * Requests that are still eligible this tick, in speaking order. Both
   * are `passive`, so the caller may simply hand them to
   * `VoiceGuidance.request` after every other announcer has had its turn:
   * anything already speaking or queued drops them.
   */
  collect(input: DriverPhraseInput): VoiceRequest[];
  /**
   * Report what `VoiceGuidance.request` did with a collected request. The
   * caller MUST do this for every request it collects — without it a
   * phrase that was actually spoken would keep being offered, and one that
   * was never speakable would be silently given up on.
   */
  note(id: string, outcome: VoiceOutcome): void;
};

export function createDriverPhraseAnnouncer(): DriverPhraseAnnouncer {
  // Window state and settlement only — never a record of what was SAID.
  // That belongs to the guidance ledger, the one place announce-once lives.
  let greetingWindowOpen = true;
  let greetingSettled = false;
  let routeStartSettled = false;

  return {
    collect(input: DriverPhraseInput): VoiceRequest[] {
      const out: VoiceRequest[] = [];

      // The greeting belongs to the parked driver who just opened the app.
      // Once guidance is live it is closed for the session, whether or not
      // it was ever heard — a greeting that arrives mid-trip is exactly
      // the stale line this must never produce.
      if (greetingWindowOpen && !GREETING_STATES.includes(input.lifecycleState)) {
        greetingWindowOpen = false;
      }
      if (greetingWindowOpen && !greetingSettled) {
        const req = greetingVoiceRequest(input.localHour, input.firstName);
        if (req !== null) out.push(req);
      }

      // `route-ready` is reachable ONLY from `planning`, and only once the
      // plan returned and route validation accepted it — see the module
      // note. A reroute, a replacement route, a failed plan, a refused
      // route, a re-render and a repeated lifecycle notification all fail
      // this test or are absorbed by the ledger's stable id.
      if (input.lifecycleState === 'route-ready' && !routeStartSettled) {
        const req = routeStartVoiceRequest(input.firstName);
        if (req !== null) out.push(req);
      }

      return out;
    },

    note(id: string, outcome: VoiceOutcome): void {
      if (!SETTLING_OUTCOMES.includes(outcome)) return;
      if (id === GREETING_VOICE_ID) greetingSettled = true;
      else if (id === ROUTE_START_VOICE_ID) routeStartSettled = true;
    },
  };
}
