/**
 * Navigator Pilot Stop Policy — when the pilot continues, when it stops
 * taking on more drivers, and when it stops tonight.
 *
 * WHY THIS IS CODE AND NOT ONLY PROSE
 *
 * A stop policy that lives only in a document gets read once, before
 * anything has gone wrong, and then re-interpreted at 11 p.m. by a tired
 * owner who has just been sent a photograph of a low bridge. The parts of
 * the decision that are mechanical — is this a P0, does one confirmed P0
 * stop expansion, does an unconfirmed P0 report stop expansion — should
 * not be re-derived under that pressure. They are settled here, once, and
 * the document is generated from the same catalogue so the two can never
 * disagree.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 *
 * It does not turn anything off. It has no flag, no fetch, no timer and no
 * importer inside the running app — by design, not by omission. An
 * automated kill-switch driven by field reports is its own hazard: it
 * would hand anyone who can file a report the power to stop a driver's
 * navigation mid-trip, and it would do it on the strength of an
 * UNCONFIRMED claim. The owner stops the pilot. This module only says, in
 * one voice, what the policy already committed to.
 *
 * WHERE JUDGMENT STAYS WITH THE OWNER
 *
 * Some conditions can be counted: three reroute failures on one trip is a
 * number. Others cannot: "provider outage handling was confusing" is a
 * verdict, and pretending a threshold exists for it would be inventing
 * arithmetic to look rigorous. Those carry `judgment: true`, and the
 * classifier will NEVER trigger them from a count — only from the owner
 * marking the condition confirmed. A policy that fakes certainty is worse
 * than one that admits where a human has to decide.
 *
 * Pure: catalogue in, observations in, a posture out. No clock, no I/O,
 * no browser globals, no persistence. Every count arrives as an argument.
 */

/** Severity bands. P2 and below do not gate the pilot and are not modelled here. */
export type StopSeverity = 'P0' | 'P1';

/**
 * What the pilot may do right now.
 *
 * `continue`          run the pilot as scoped; add drivers only if the
 *                     wave gate also passes.
 * `pause-expansion`   the drivers already driving may keep driving; NO new
 *                     driver is added and no new wave opens until the
 *                     condition is resolved.
 * `stop-immediately`  stop the pilot. Tell every driver to stop using
 *                     Navigator for guidance and finish the trip on their
 *                     own knowledge or another device.
 */
export type PilotPosture = 'continue' | 'pause-expansion' | 'stop-immediately';

/** Severity order, so the worst observation always wins a comparison. */
const POSTURE_RANK: Readonly<Record<PilotPosture, number>> = Object.freeze({
  continue: 0,
  'pause-expansion': 1,
  'stop-immediately': 2,
});

export function worstPosture(a: PilotPosture, b: PilotPosture): PilotPosture {
  return POSTURE_RANK[a] >= POSTURE_RANK[b] ? a : b;
}

export type StopCondition = Readonly<{
  /** Stable id. Cited by the incident playbook and by the report triage. */
  id: string;
  severity: StopSeverity;
  /** Plain language, written as the owner or driver would observe it. */
  observed: string;
  /** Why this severity — the safety reasoning, not a restatement. */
  why: string;
  /** What the owner does, in order, the moment it is confirmed. */
  ownerActions: readonly string[];
  /** What has to be true again before the pilot resumes or expands. */
  resume: string;
  /**
   * True when confirming this is a human verdict rather than a count.
   * The classifier refuses to infer these from occurrences — see the
   * module note.
   */
  judgment: boolean;
  /**
   * P1 only. Occurrences within one review window that trip the pause.
   * Null when `judgment` is true, or when the driver count is the rule.
   */
  occurrenceThreshold: number | null;
  /**
   * P1 only. Independent drivers reporting the same defect that trip the
   * pause regardless of per-driver counts.
   */
  driverThreshold: number | null;
}>;

/**
 * A pilot review window. Not a clock — a unit the owner counts within,
 * named here so the thresholds below mean the same thing to everyone.
 *
 * One window = one driver's day of pilot driving, or one owner review,
 * whichever comes first. Thresholds are per-window, per-driver unless the
 * condition says otherwise.
 */
export const REVIEW_WINDOW = 'one driver-day of pilot use, or one owner review';

/* ------------------------------------------------------------------ P0 */

/**
 * P0 — STOP THE PILOT.
 *
 * The bar for this list: a driver acting on what Navigator said could put
 * a 70-foot combination somewhere it must not be, or the pilot's own
 * access controls have failed. Not "the app was wrong" — "the app was
 * wrong in a way a driver could have followed".
 *
 * ONE confirmed P0 stops the pilot. Not a rate, not a pattern, not two.
 * Rate-based stopping assumes the next occurrence is as survivable as the
 * last one, and a strike is not survivable.
 */
export const P0_CONDITIONS: readonly StopCondition[] = Object.freeze([
  Object.freeze({
    id: 'unsafe-turnaround-implied',
    severity: 'P0' as const,
    observed:
      'A route or replacement route required the truck to reverse direction, and Navigator did not identify a verified place to do it.',
    why: 'A truck cannot improvise a turnaround. The instruction hands the driver a problem the app created and cannot solve, in traffic, under time pressure.',
    ownerActions: [
      'Tell every pilot driver to stop using Navigator for guidance now.',
      'Capture the driver report and the build id before anything is redeployed.',
      'Record the road, the direction of travel, and what the app said.',
      'Do not redeploy until the case reproduces in a fixture and fails before the fix.',
    ],
    resume:
      'A regression fixture reproduces the exact geometry, fails on the shipped build, and passes on the fix; owner re-drives the same road.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'prohibited-roadway-directed',
    severity: 'P0' as const,
    observed:
      'Navigator directed the truck onto a roadway commercial vehicles are not permitted to use.',
    why: 'This is the failure the truck profile exists to prevent. It is a citation at best and a strike at worst.',
    ownerActions: [
      'Stop the pilot.',
      'Record the road, the posted restriction, and the direction of travel.',
      'Check whether the truck profile was carried on the request that produced it.',
    ],
    resume:
      'Root cause identified as ours or the provider’s, a fixture pins it, and the owner re-drives the corridor.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'clearance-weight-width-contradiction',
    severity: 'P0' as const,
    observed:
      'A route conflicted with a posted clearance, weight or width restriction that the configured truck profile should have excluded.',
    why: 'The profile is the entire legal basis for calling this truck routing. A contradiction means the profile is not doing what the screen says it is doing.',
    ownerActions: [
      'Stop the pilot.',
      'Photograph the posted restriction if it is safe to do so from a stop.',
      'Record the configured dimensions shown in the truck panel at the time.',
    ],
    resume:
      'The profile-to-request path is re-verified end to end and the specific restriction is covered by a fixture.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'wrong-way-instruction',
    severity: 'P0' as const,
    observed:
      'Navigator instructed a movement into oncoming traffic, or against the legal direction of a one-way or divided roadway.',
    why: 'Immediate life safety, for the driver and for everyone approaching.',
    ownerActions: [
      'Stop the pilot.',
      'Record the intersection and the exact wording spoken and displayed.',
    ],
    resume: 'Reproduced, fixed, fixture-pinned, and re-driven by the owner.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'guidance-conflicts-with-direction',
    severity: 'P0' as const,
    observed:
      'Turn guidance materially conflicted with the direction the truck was actually travelling — instructions for a road going the other way.',
    why: 'A driver following an instruction that does not match the road they are on is being steered by a stale or mismatched route. What they do next is unpredictable.',
    ownerActions: [
      'Stop the pilot.',
      'Record whether the map marker was on the correct roadway at the time.',
      'Record whether an off-route or rerouting message had been given.',
    ],
    resume: 'Matching and guidance-retirement behaviour verified on the same road.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'critical-maneuver-guidance-failure',
    severity: 'P0' as const,
    observed:
      'A maneuver that had to be announced was not announced, or arrived too late to take safely, on an active route.',
    why: 'A missed exit in a truck is not a U-turn away. The whole product promise is that the turn arrives before the turn does.',
    ownerActions: [
      'Stop the pilot.',
      'Record the maneuver, the speed, and whether voice was muted or the device silent.',
      'Separate two different failures: the app never said it, versus the phone never played it.',
    ],
    resume:
      'The announcement path is verified on the same device class, including the speech-unlock state that was in effect.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'repeated-navigation-freeze',
    severity: 'P0' as const,
    observed: 'Navigator froze or stopped updating more than once during an active trip.',
    why: 'A frozen navigation screen still LOOKS like navigation. The driver keeps trusting a picture that stopped being true.',
    ownerActions: [
      'Stop the pilot.',
      'Record the build id, the trip length at the freeze, and whether the screen stayed lit.',
      'Note whether reloading recovered the trip or lost it.',
    ],
    resume: 'A long-session run reproduces the conditions without a freeze.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'severe-gps-error-undisclosed',
    severity: 'P0' as const,
    observed:
      'The truck was drawn on the wrong road, or far off the road, and Navigator gave no degraded-accuracy warning.',
    why: 'A wrong position with an honest warning is a nuisance. A wrong position presented as certain is the input to every downstream instruction.',
    ownerActions: [
      'Stop the pilot.',
      'Record how far off, on what road, and what the accuracy indicator showed.',
    ],
    resume: 'The degradation disclosure is verified to fire for that accuracy class.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'hos-critical-warning-suppressed',
    severity: 'P0' as const,
    observed: 'A critical hours-of-service warning did not appear or was spoken over.',
    why: 'HOS is a legal obligation with a fatigue consequence. Navigator may never be the reason a driver missed it.',
    ownerActions: [
      'Stop the pilot.',
      'Record the clock state and what else was speaking at the time.',
    ],
    resume: 'Voice arbitration re-verified: nothing outranks a critical HOS announcement.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'unauthorized-navigator-access',
    severity: 'P0' as const,
    observed: 'Anyone reached a Navigator surface without entering the pilot password.',
    why: 'The gate is the only thing bounding who is being given truck guidance, and the only thing bounding provider spend.',
    ownerActions: [
      'Stop the pilot.',
      'Change NAVIGATOR_PREVIEW_PASSWORD — every issued pilot cookie is signed with it and stops verifying.',
      'Record the exact URL that was reachable and how it was reached.',
    ],
    resume: 'The gate is re-verified for that path, and a test pins the path as protected.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'pilot-auth-failure',
    severity: 'P0' as const,
    observed:
      'The password or session behaved incorrectly — a wrong password admitted, a valid one refused repeatedly, or a session that would not expire.',
    why: 'An access control that is wrong in either direction is not an access control.',
    ownerActions: [
      'Stop the pilot.',
      'Change the pilot password.',
      'Record which direction it failed, and whether it was reproducible.',
    ],
    resume: 'Access harness green and the specific direction of failure pinned by a test.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'secret-exposure',
    severity: 'P0' as const,
    observed:
      'A provider key, the pilot password, a session token, or any other secret appeared on screen, in a report, in a URL or in a log.',
    why: 'Exposure is not recoverable by fixing the code — the value itself is burned.',
    ownerActions: [
      'Stop the pilot.',
      'Rotate the exposed value before anything else.',
      'Preserve the artifact that showed it, then find every other path that could emit the same value.',
    ],
    resume: 'Value rotated, path fixed, and a redaction test pins the emitting surface.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'corrupted-accepted-route',
    severity: 'P0' as const,
    observed:
      'A route that Navigator accepted and began guiding on was malformed — missing geometry, missing maneuvers, or a destination that was not the one chosen.',
    why: 'Validation exists so that a malformed route never becomes guidance. If one did, validation is not holding, and nothing downstream can be trusted.',
    ownerActions: [
      'Stop the pilot.',
      'Capture the diagnostic snapshot before closing the app.',
      'Record what the route summary claimed versus what was drawn.',
    ],
    resume: 'The malformed shape is added as a rejection fixture and validation refuses it.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'stale-maneuver-after-reroute',
    severity: 'P0' as const,
    observed:
      'After going off route, Navigator kept showing or speaking a maneuver from the abandoned route.',
    why: 'A stale instruction is worse than silence: it is confident, specific, and wrong, and the driver has no way to tell it apart from a live one.',
    ownerActions: [
      'Stop the pilot.',
      'Record what was still being shown, and for how long after the departure.',
    ],
    resume:
      'Guidance retirement on off-route and rerouting verified on the road, not only in a fixture.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
]);

/* ------------------------------------------------------------------ P1 */

/**
 * P1 — PAUSE EXPANSION.
 *
 * These do not stop a driver mid-trip. They stop the pilot GROWING, which
 * is the decision that is actually under pressure: every one of these is
 * a defect that a second and third driver would hit too, and adding them
 * converts one person's bad evening into three.
 *
 * Thresholds are per review window (`REVIEW_WINDOW`) and per driver unless
 * the driver threshold says otherwise. Where no honest threshold exists,
 * `judgment` is true and the owner's verdict is the trigger.
 */
export const P1_CONDITIONS: readonly StopCondition[] = Object.freeze([
  Object.freeze({
    id: 'repeat-reroute-failure',
    severity: 'P1' as const,
    observed:
      'Navigator said it was rerouting and did not produce a usable replacement route the driver could act on.',
    why: 'The driver is off route with no guidance and a message implying guidance is coming. Once is a provider hiccup; three times is a product that cannot recover.',
    ownerActions: [
      'Add no new drivers.',
      'Collect the trip, the road, and whether the message stayed up or cleared.',
      'Check the reroute budget counters in the diagnostic snapshot before assuming a provider fault.',
    ],
    resume: 'Reproduced offline and the recovery path is fixed and fixture-pinned.',
    judgment: false,
    occurrenceThreshold: 3,
    driverThreshold: 2,
  }),
  Object.freeze({
    id: 'provider-outage-confusing',
    severity: 'P1' as const,
    observed:
      'During a routing provider outage the driver could not tell what was wrong or what to do.',
    why: 'Outages are expected and survivable. Being unable to tell an outage from a broken app is what turns a survivable one into a stopped truck.',
    ownerActions: [
      'Add no new drivers.',
      'Record what the screen said and what the driver believed it meant.',
    ],
    resume: 'Outage copy re-reviewed against the driver’s own account of it.',
    judgment: true,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'frequent-search-failure',
    severity: 'P1' as const,
    observed: 'Destination search failed to find real, ordinary places.',
    why: 'A destination the driver cannot enter is a trip Navigator cannot run at all — and the failure lands before the driver has any reason to distrust it.',
    ownerActions: [
      'Add no new drivers.',
      'Record the exact search text and where the driver was searching from.',
    ],
    resume: 'The failing queries are reproduced and either fixed or disclosed as a limitation.',
    judgment: false,
    occurrenceThreshold: 3,
    driverThreshold: 2,
  }),
  Object.freeze({
    id: 'voice-materially-late',
    severity: 'P1' as const,
    observed:
      'Turn announcements arrived late enough that the driver had to react rather than plan.',
    why: 'Late is not merely annoying in a truck: the whole margin the announcement was supposed to buy is the margin needed to change lanes loaded.',
    ownerActions: [
      'Add no new drivers.',
      'Record the speed, the road class, and how late it felt.',
    ],
    resume: 'Announcement timing re-verified at highway speed on the same device class.',
    judgment: false,
    occurrenceThreshold: 3,
    driverThreshold: 2,
  }),
  Object.freeze({
    id: 'excessive-voice-chatter',
    severity: 'P1' as const,
    observed: 'Navigator talked so much the driver wanted to mute it.',
    why: 'A muted Navigator cannot warn. Chatter does not fail loudly — it converts a safety channel into a nuisance the driver switches off.',
    ownerActions: [
      'Add no new drivers.',
      'Ask specifically whether the driver muted it, and when.',
    ],
    resume: 'Announcement volume reviewed against a full trip transcript.',
    judgment: true,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'follow-recenter-breaks',
    severity: 'P1' as const,
    observed: 'The map stopped following the truck, or would not recenter when asked.',
    why: 'A map that has to be fought is a map that gets touched while moving, which is the interaction the motion lock exists to prevent.',
    ownerActions: ['Add no new drivers.', 'Record whether it recovered on its own.'],
    resume: 'Follow and recenter verified across a full trip including a manual pan.',
    judgment: false,
    occurrenceThreshold: 2,
    driverThreshold: 2,
  }),
  Object.freeze({
    id: 'reporting-fails',
    severity: 'P1' as const,
    observed: 'The driver could not produce or send a problem report.',
    why: 'The pilot runs on reports. Losing the reporting path does not just lose one report — it makes the pilot unmeasurable while it continues.',
    ownerActions: [
      'Add no new drivers.',
      'Record where it failed: generating, copying, or sending.',
    ],
    resume: 'The reporting path is verified end to end on the driver’s own phone.',
    judgment: false,
    occurrenceThreshold: 1,
    driverThreshold: 1,
  }),
  Object.freeze({
    id: 'session-expiry-confusing',
    severity: 'P1' as const,
    observed:
      'The pilot session expired and the driver could not tell what had happened or how to get back in.',
    why: 'Expiry during a trip is the worst possible moment for an unexplained screen, and the pilot session is short by design.',
    ownerActions: [
      'Add no new drivers.',
      'Record whether it happened mid-trip and whether the trip survived re-entry.',
    ],
    resume: 'Expiry behaviour re-reviewed with the driver’s account of what they saw.',
    judgment: true,
    occurrenceThreshold: null,
    driverThreshold: null,
  }),
  Object.freeze({
    id: 'independent-multi-driver-defect',
    severity: 'P1' as const,
    observed:
      'Two or more drivers independently reported the same significant defect without hearing it from each other.',
    why: 'Independent corroboration is the strongest signal a small pilot can produce. It means the defect is in the product, not in one phone or one road.',
    ownerActions: [
      'Add no new drivers.',
      'Confirm the reports really were independent before counting them.',
    ],
    resume:
      'The shared defect is reproduced and resolved, or explicitly disclosed as a limitation.',
    judgment: false,
    occurrenceThreshold: null,
    driverThreshold: 2,
  }),
]);

export const STOP_CONDITIONS: readonly StopCondition[] = Object.freeze([
  ...P0_CONDITIONS,
  ...P1_CONDITIONS,
]);

const BY_ID: ReadonlyMap<string, StopCondition> = new Map(STOP_CONDITIONS.map((c) => [c.id, c]));

export function findStopCondition(id: string | null | undefined): StopCondition | null {
  if (typeof id !== 'string') return null;
  return BY_ID.get(id) ?? null;
}

/* ----------------------------------------------------------- classifier */

export type PilotObservation = Readonly<{
  /** Must match a catalogue id. Anything else is reported as unknown. */
  conditionId: string;
  /**
   * The owner has established this actually happened — reproduced, or seen
   * first-hand, or corroborated by evidence in the report. A driver saying
   * it happened is a REPORT, not a confirmation.
   */
  confirmed: boolean;
  /** Occurrences within one review window. Defaults to 1. */
  occurrences?: number;
  /** Independent drivers reporting it. Defaults to 1. */
  drivers?: number;
}>;

export type PilotPostureVerdict = Readonly<{
  posture: PilotPosture;
  /** Confirmed P0 ids. Any entry here means stop. */
  stopping: readonly string[];
  /**
   * P0 ids reported but NOT yet confirmed. These do not stop the pilot —
   * they stop it growing while the owner establishes what happened.
   */
  unconfirmedP0: readonly string[];
  /** P1 ids that met their threshold or were confirmed by judgment. */
  pausing: readonly string[];
  /** P1 ids seen but below threshold. Recorded, not acted on. */
  belowThreshold: readonly string[];
  /** Observation ids that match no catalogue entry. */
  unknown: readonly string[];
  /** One line per decision, in the order they were applied. */
  reasons: readonly string[];
}>;

function count(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

/**
 * Turn a set of observations into the posture the policy already committed
 * to. Deterministic and total: unknown ids are reported, never guessed at,
 * and never silently dropped.
 *
 * The rules, in the order applied:
 *
 *   1. Any CONFIRMED P0 stops the pilot. One is enough.
 *   2. Any REPORTED-BUT-UNCONFIRMED P0 pauses expansion. You do not hand a
 *      possible strike-path defect to a second driver while you are still
 *      working out whether it was real.
 *   3. A P1 pauses expansion when it is confirmed and either (a) its
 *      occurrence threshold is met, (b) its independent-driver threshold is
 *      met, or (c) it is a judgment condition the owner has confirmed.
 *   4. Otherwise, continue.
 *
 * Note what rule 3 does NOT do: it never fires a judgment condition from a
 * count. See the module note.
 */
export function classifyPilotPosture(
  observations: readonly PilotObservation[],
): PilotPostureVerdict {
  const stopping: string[] = [];
  const unconfirmedP0: string[] = [];
  const pausing: string[] = [];
  const belowThreshold: string[] = [];
  const unknown: string[] = [];
  const reasons: string[] = [];
  let posture: PilotPosture = 'continue';

  for (const obs of observations) {
    const condition = findStopCondition(obs.conditionId);
    if (condition === null) {
      unknown.push(String(obs.conditionId));
      reasons.push(`unknown condition "${String(obs.conditionId)}" — not classified`);
      continue;
    }

    if (condition.severity === 'P0') {
      if (obs.confirmed) {
        stopping.push(condition.id);
        posture = worstPosture(posture, 'stop-immediately');
        reasons.push(`${condition.id}: confirmed P0 — stop the pilot`);
      } else {
        unconfirmedP0.push(condition.id);
        posture = worstPosture(posture, 'pause-expansion');
        reasons.push(
          `${condition.id}: P0 reported but unconfirmed — add no drivers until resolved`,
        );
      }
      continue;
    }

    if (!obs.confirmed) {
      belowThreshold.push(condition.id);
      reasons.push(`${condition.id}: P1 reported but unconfirmed — recorded, no posture change`);
      continue;
    }

    if (condition.judgment) {
      pausing.push(condition.id);
      posture = worstPosture(posture, 'pause-expansion');
      reasons.push(`${condition.id}: confirmed by owner judgment — pause expansion`);
      continue;
    }

    const occurrences = count(obs.occurrences, 1);
    const drivers = count(obs.drivers, 1);
    const byOccurrence =
      condition.occurrenceThreshold !== null && occurrences >= condition.occurrenceThreshold;
    const byDrivers = condition.driverThreshold !== null && drivers >= condition.driverThreshold;

    if (byOccurrence || byDrivers) {
      pausing.push(condition.id);
      posture = worstPosture(posture, 'pause-expansion');
      reasons.push(
        `${condition.id}: ${byOccurrence ? `${occurrences} occurrences` : `${drivers} independent drivers`} — pause expansion`,
      );
    } else {
      belowThreshold.push(condition.id);
      reasons.push(
        `${condition.id}: ${occurrences} occurrence(s), ${drivers} driver(s) — below threshold, recorded only`,
      );
    }
  }

  return Object.freeze({
    posture,
    stopping: Object.freeze(stopping),
    unconfirmedP0: Object.freeze(unconfirmedP0),
    pausing: Object.freeze(pausing),
    belowThreshold: Object.freeze(belowThreshold),
    unknown: Object.freeze(unknown),
    reasons: Object.freeze(reasons),
  });
}

/** What the owner is being told to do, in one line, for the status line of a review. */
export function postureSummary(verdict: PilotPostureVerdict): string {
  switch (verdict.posture) {
    case 'stop-immediately':
      return `STOP THE PILOT — ${verdict.stopping.length} confirmed P0: ${verdict.stopping.join(', ')}`;
    case 'pause-expansion': {
      const causes = [...verdict.unconfirmedP0, ...verdict.pausing];
      return `PAUSE EXPANSION — no new drivers: ${causes.join(', ')}`;
    }
    default:
      return 'CONTINUE — no stop condition met; wave gates still apply separately';
  }
}
