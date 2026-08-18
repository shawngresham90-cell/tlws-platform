/*
 * TP-5 — resume from the planned stop, after a clock update.
 *
 * The plan has always ended honestly at the clock-update boundary; these
 * scenarios pin the other half of that promise — that a driver who rests
 * at their planned stop can come back, enter their CURRENT clocks, and
 * continue toward the original destination on a brand-new quote, with the
 * planner assuming nothing about what the stop was:
 *
 *   R1  sending a stop persists trip context — and nothing else
 *   R2  the offer survives reload             (storage round-trip + bench)
 *   R3  a valid stored record loads fail-soft (strict shape)
 *   R4  continuing requires clocks entered AFTER the stop
 *   R5  the resumed origin is the stored stop position, verbatim
 *   R6  the original destination is retained
 *   R7  a via at/behind the stop is never stored, its dwell never re-charged
 *   R8  a via still ahead is retained with its dwell settings
 *   R9  the record holds NO old HOS arithmetic — by type, shape and scrub
 *   R10 explicit End Trip clears                       (source + bench)
 *   R11 completion at the original destination clears
 *   R12 planning a different destination clears
 *   R13 a new trip's record replaces the old one
 *   R14 an expired record fails closed
 *   R15 malformed storage is ignored, never crashes
 *   R16 the 12-hour handoff dies while resume context lives on
 *   R17 the next segment writes the next handoff through the TP-1 contract
 *   R18 a resumed segment that reaches the destination invents no parking
 *
 * Pure rules and storage shapes run here; reload journeys, the clock-gate
 * UI and touch targets run in the browser bench (tp5-resume-viewports).
 */
import { readFileSync } from 'node:fs';
import {
  buildResumeRecord,
  readResumeVerdict,
  resumeClocksConfirmable,
  resumeEndsAtDestination,
  resumeMatchesDestination,
  resumeRecordIsStale,
  samePlace,
  RESUME_CLOCKS_NOTICE,
  TRIP_RESUME_TTL_MS,
  type TripResumeRecord,
} from '@/lib/trip-planner/trip-resume';
import {
  readPlannedStop,
  PLANNED_STOP_TTL_MS,
  type PlannedStop,
} from '@/lib/trip-planner/planned-stop';
import { CLOCKS_UNSET, type ClockEntryState } from '@/lib/navigator/hos-clocks';
/*
 * The REAL storage layer runs in this harness against the stub window
 * installed below. Imports are hoisted, but the storage module touches
 * `window` only inside function bodies — so what matters is that the stub
 * exists before the first CALL, and every call here comes after it.
 */
import {
  clearTripResumeRecord,
  readTripResumeRecord,
  writeTripResumeRecord,
  TRIP_RESUME_KEY,
  TRIP_RESUME_VERSION,
} from '@/components/navigator/trip-resume-storage';
import { composeQuote } from '@/lib/trip-planner/compose-quote';
import { nullWeatherPort } from '@/lib/trip-planner/providers';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';
import {
  corridorRoute,
  corridorListings,
  corridorRoutingResult,
  MACON_DESTINATION,
} from './fixtures/i75-corridor';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const T0 = 1_795_000_000_000;
const HOUR = 3_600_000;

/* ---- a browser-shaped storage stub, so the REAL storage layer runs ---- */
/*
 * The versioned layer checks `typeof window` at call time, so installing
 * a minimal localStorage here exercises the shipped read/write/clear code
 * paths — envelope, version check, strict shape — not a re-implementation.
 */
const backing = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
  },
};
/* ------------------------------------------------------------ fixtures */

const stop: PlannedStop = {
  id: 'loves-emerson',
  name: "Love's (Emerson)",
  position: { lat: 34.1712, lng: -84.7766 },
  arriveAtMs: T0 + 4 * HOUR,
  clockLeftMin: 95,
  detourMiles: 0.4,
  detourMinutes: 1,
  source: 'manually-verified',
  plannedAtMs: T0,
  inputsFingerprint: 'clocks:600,700,300,3000,70/8|truck:13.5,8.5,72.0,80000,5,none,',
};

const macon = {
  label: 'Macon, GA',
  position: { lat: 32.8407, lng: -83.6324 },
  country: 'US' as const,
};
const atlanta = {
  label: 'Atlanta, GA',
  position: { lat: 33.749, lng: -84.388 },
  country: 'US' as const,
};

const clocksAt = (enteredAtMs: number): ClockEntryState => ({
  kind: 'set',
  entered: {
    drivingMin: 660,
    windowMin: 840,
    untilBreakMin: 480,
    cycleMin: 4200,
    cycleRule: '70/8',
  },
  enteredAtMs,
  fromFreshShift: false,
});

/* ============ R1 — sending a stop persists trip context ============== */
const record = buildResumeRecord({
  stop,
  stopCountry: 'US',
  destination: macon,
  via: atlanta,
  viaDwellMin: 60,
  viaDwellQualifiesForBreak: false,
  stopRouteMile: 42.4, // Emerson sits before Atlanta on this corridor
  viaRouteMile: 82.6,
  nowMs: T0,
});
check('R1: a record is built when a destination exists', record !== null);
if (record !== null) {
  check(
    'R1: it carries the stop, the destination and the moment it was true',
    record.plannedStop.id === stop.id &&
      record.plannedStop.label === stop.name &&
      record.originalDestination.label === 'Macon, GA' &&
      record.createdAtMs === T0,
  );
  check(
    'R1: no record exists for a trip already at its destination',
    buildResumeRecord({
      stop: { ...stop, position: macon.position },
      stopCountry: 'US',
      destination: macon,
      via: null,
      viaDwellMin: 0,
      viaDwellQualifiesForBreak: false,
      stopRouteMile: 160,
      viaRouteMile: null,
      nowMs: T0,
    }) === null,
  );
  check(
    'R1: no record exists without a destination',
    buildResumeRecord({
      stop,
      stopCountry: 'US',
      destination: { label: '', position: { lat: 0, lng: 0 }, country: null },
      via: null,
      viaDwellMin: 0,
      viaDwellQualifiesForBreak: false,
      stopRouteMile: 42.4,
      viaRouteMile: null,
      nowMs: T0,
    }) === null,
  );
}

/* ============ R2/R3 — the record survives storage, fail-soft ========= */
if (record !== null) {
  clearTripResumeRecord();
  writeTripResumeRecord(record);
  const back = readTripResumeRecord();
  // Compared FIELD BY FIELD, not by serialization: the strict reader
  // rebuilds the record in its own key order, and key order is not data.
  check(
    'R2: the record round-trips storage intact (reload = a fresh read)',
    back !== null &&
      back.createdAtMs === record.createdAtMs &&
      back.plannedStop.id === record.plannedStop.id &&
      back.plannedStop.label === record.plannedStop.label &&
      samePlace(back.plannedStop.position, record.plannedStop.position) &&
      back.plannedStop.country === record.plannedStop.country &&
      back.originalDestination.label === record.originalDestination.label &&
      samePlace(back.originalDestination.position, record.originalDestination.position) &&
      back.originalDestination.country === record.originalDestination.country &&
      back.remainingVia?.label === record.remainingVia?.label &&
      back.remainingVia?.dwellMin === record.remainingVia?.dwellMin &&
      back.remainingVia?.dwellQualifiesForBreak === record.remainingVia?.dwellQualifiesForBreak,
    back,
  );
  check(
    'R3: the read is the shipped versioned reader, not a re-parse',
    backing.has(TRIP_RESUME_KEY) &&
      (JSON.parse(backing.get(TRIP_RESUME_KEY) ?? '{}') as { v?: number }).v ===
        TRIP_RESUME_VERSION,
  );
}

/* ============ R4 — continuing requires clocks entered after the stop = */
if (record !== null) {
  check('R4: unset clocks can never be confirmed', !resumeClocksConfirmable(record, CLOCKS_UNSET));
  check(
    'R4: clocks entered BEFORE the stop are refused',
    !resumeClocksConfirmable(record, clocksAt(T0 - HOUR)),
  );
  check(
    'R4: clocks entered AT the same instant are refused (strictly after)',
    !resumeClocksConfirmable(record, clocksAt(T0)),
  );
  check(
    'R4: clocks entered after the stop may be OFFERED for confirmation',
    resumeClocksConfirmable(record, clocksAt(T0 + 10 * HOUR)),
  );
}

/* ============ R5/R6 — origin is the stored stop; destination kept ==== */
if (record !== null) {
  check(
    'R5: the resumed origin is the stored stop position, verbatim',
    record.plannedStop.position.lat === stop.position.lat &&
      record.plannedStop.position.lng === stop.position.lng,
  );
  check(
    'R6: the original destination survives, country claim included',
    samePlace(record.originalDestination.position, macon.position) &&
      record.originalDestination.country === 'US',
  );
}

/* ============ R7/R8 — via semantics decided at write time ============ */
{
  const ahead = buildResumeRecord({
    stop,
    stopCountry: 'US',
    destination: macon,
    via: atlanta,
    viaDwellMin: 45,
    viaDwellQualifiesForBreak: true,
    stopRouteMile: 42.4,
    viaRouteMile: 82.6,
    nowMs: T0,
  });
  check(
    'R8: a via still ahead is retained with its dwell settings',
    ahead?.remainingVia !== null &&
      ahead?.remainingVia?.label === 'Atlanta, GA' &&
      ahead?.remainingVia?.dwellMin === 45 &&
      ahead?.remainingVia?.dwellQualifiesForBreak === true,
    ahead?.remainingVia,
  );
  const behind = buildResumeRecord({
    stop,
    stopCountry: 'US',
    destination: macon,
    via: atlanta,
    viaDwellMin: 60,
    viaDwellQualifiesForBreak: false,
    stopRouteMile: 100.2, // the stop is past Atlanta
    viaRouteMile: 82.6,
    nowMs: T0,
  });
  check(
    'R7: a via behind the stop is never stored — dwell cannot re-charge',
    behind !== null && behind.remainingVia === null,
    behind?.remainingVia,
  );
  const atVia = buildResumeRecord({
    stop,
    stopCountry: 'US',
    destination: macon,
    via: atlanta,
    viaDwellMin: 60,
    viaDwellQualifiesForBreak: false,
    stopRouteMile: 82.6, // parked AT the via
    viaRouteMile: 82.6,
    nowMs: T0,
  });
  check('R7: a stop AT the via consumes it too (strict boundary)', atVia?.remainingVia === null);
  const unplaceable = buildResumeRecord({
    stop,
    stopCountry: 'US',
    destination: macon,
    via: atlanta,
    viaDwellMin: 60,
    viaDwellQualifiesForBreak: false,
    stopRouteMile: null, // no usable mile data
    viaRouteMile: 82.6,
    nowMs: T0,
  });
  check(
    'R7: a via that cannot be PLACED is dropped, never guessed at',
    unplaceable?.remainingVia === null,
  );
  check(
    'R8: a sub-30 dwell claim is not carried forward (same gate as TP-4)',
    buildResumeRecord({
      stop,
      stopCountry: 'US',
      destination: macon,
      via: atlanta,
      viaDwellMin: 20,
      viaDwellQualifiesForBreak: true,
      stopRouteMile: 42.4,
      viaRouteMile: 82.6,
      nowMs: T0,
    })?.remainingVia?.dwellQualifiesForBreak === false,
  );
}

/* ============ R9 — no old HOS arithmetic, by type, shape and scrub === */
{
  // By TYPE: the record's own keys — nothing clock-shaped may ever appear.
  if (record !== null) {
    const keys = new Set(Object.keys(record));
    check(
      'R9: the record has exactly the four context fields',
      keys.size === 4 &&
        keys.has('createdAtMs') &&
        keys.has('plannedStop') &&
        keys.has('originalDestination') &&
        keys.has('remainingVia'),
      [...keys],
    );
    const flat = JSON.stringify(record);
    check(
      'R9: nothing clock-shaped survives serialization',
      !/drivingMin|windowMin|untilBreakMin|cycleMin|clockLimit|limitedBy|breakDueAfter|stopTarget|arriveAtMs|clockLeft|hosRemaining/.test(
        flat,
      ),
      flat,
    );
  }
  // By SHAPE: a payload that smuggles old arithmetic parses to a record
  // WITHOUT it — stale conclusions cannot round-trip through the store.
  backing.set(
    TRIP_RESUME_KEY,
    JSON.stringify({
      v: TRIP_RESUME_VERSION,
      createdAtMs: T0,
      plannedStop: { id: 'x', label: 'X', position: { lat: 34, lng: -84 }, country: 'US' },
      originalDestination: macon,
      remainingVia: null,
      clockLimitMin: 480,
      breakSchedule: [{ dueAfterDrivingMin: 100 }],
      cycleLeftMin: 90,
      limitedBy: 'cycle',
      parkingCutoffMin: 400,
    }),
  );
  const scrubbed = readTripResumeRecord();
  check(
    'R9: smuggled HOS fields are shed on read',
    scrubbed !== null &&
      !JSON.stringify(scrubbed).includes('clockLimit') &&
      !JSON.stringify(scrubbed).includes('breakSchedule') &&
      !JSON.stringify(scrubbed).includes('cycleLeft') &&
      !JSON.stringify(scrubbed).includes('limitedBy') &&
      !JSON.stringify(scrubbed).includes('parkingCutoff'),
    scrubbed,
  );
  // By SOURCE: the module that builds the record never imports the shapes
  // that hold conclusions.
  const src = readFileSync('src/lib/trip-planner/trip-resume.ts', 'utf8');
  check(
    'R9: the rules module cannot even name a drive window or schedule',
    !/DriveWindow|BreakSchedule|ParkingChoice|TripPlan\b|RemainingClocks/.test(src),
  );
}

/* ============ R10–R13 — invalidation ================================= */
if (record !== null) {
  // R10/R13 storage half: an explicit clear removes it; a new write replaces it.
  writeTripResumeRecord(record);
  clearTripResumeRecord();
  check('R10: an explicit End Trip clears the record', readTripResumeRecord() === null);
  const second: TripResumeRecord = {
    ...record,
    originalDestination: atlanta,
    createdAtMs: T0 + HOUR,
  };
  writeTripResumeRecord(record);
  writeTripResumeRecord(second);
  check(
    'R13: a new trip REPLACES the old context — one slot, latest wins',
    readTripResumeRecord()?.originalDestination.label === 'Atlanta, GA',
  );
  clearTripResumeRecord();

  // R11/R18: only the ORIGINAL destination ends the trip.
  check(
    'R11: arrival at the original destination ends the trip',
    resumeEndsAtDestination(record, macon.position),
  );
  check(
    'R11: arrival at the PARKING STOP does not — that is when resume begins',
    !resumeEndsAtDestination(record, stop.position),
  );
  check('R11: an unknown segment end never clears', !resumeEndsAtDestination(record, null));

  // R12: planning toward another destination is a new trip.
  check(
    'R12: the same destination is the same trip',
    resumeMatchesDestination(record, macon.position),
  );
  check(
    'R12: a different destination is a different trip',
    !resumeMatchesDestination(record, atlanta.position),
  );
}

/* ============ R14 — expiry fails closed ============================== */
if (record !== null) {
  check(
    'R14: fresh inside the 72-hour window, exclusive at the boundary',
    !resumeRecordIsStale(record, T0 + TRIP_RESUME_TTL_MS) &&
      resumeRecordIsStale(record, T0 + TRIP_RESUME_TTL_MS + 1),
  );
  check(
    'R14: a future-dated record is stale (a lying device clock plans nothing)',
    resumeRecordIsStale(record, T0 - 1),
  );
  const verdict = readResumeVerdict(record, T0 + TRIP_RESUME_TTL_MS + 1);
  check('R14: the verdict refuses an expired record', !verdict.ok);
  check('R14: and refuses absence without inventing one', !readResumeVerdict(null, T0).ok);
}

/* ============ R15 — malformed storage is ignored ===================== */
{
  const junk = [
    'not json at all',
    '42',
    'null',
    JSON.stringify({ v: 999, createdAtMs: T0 }),
    JSON.stringify({ v: TRIP_RESUME_VERSION }), // missing everything
    JSON.stringify({
      v: TRIP_RESUME_VERSION,
      createdAtMs: T0,
      plannedStop: { id: '', label: 'X', position: { lat: 34, lng: -84 } }, // empty id
      originalDestination: macon,
      remainingVia: null,
    }),
    JSON.stringify({
      v: TRIP_RESUME_VERSION,
      createdAtMs: T0,
      plannedStop: { id: 'x', label: 'X', position: { lat: 0, lng: 0 } }, // 0,0 is the Atlantic
      originalDestination: macon,
      remainingVia: null,
    }),
    JSON.stringify({
      v: TRIP_RESUME_VERSION,
      createdAtMs: T0,
      plannedStop: { id: 'x', label: 'X', position: { lat: 34, lng: -84 }, country: 'US' },
      originalDestination: macon,
      remainingVia: { label: 'V', position: { lat: 33, lng: -84 } }, // via missing dwellMin
    }),
  ];
  let allIgnored = true;
  for (const raw of junk) {
    backing.set(TRIP_RESUME_KEY, raw);
    if (readTripResumeRecord() !== null) {
      allIgnored = false;
      console.error(`    junk accepted: ${raw}`);
    }
  }
  check('R15: every malformed payload reads as absent, never a crash', allIgnored);
  backing.delete(TRIP_RESUME_KEY);
}

/* ============ R16 — the two lifetimes are different on purpose ======= */
if (record !== null) {
  const thirteenHoursOn = T0 + 13 * HOUR;
  const handoff = readPlannedStop(stop, thirteenHoursOn, stop.inputsFingerprint);
  check(
    'R16: thirteen hours on, the 12-hour navigation handoff is dead',
    !handoff.ok && !readPlannedStop(stop, thirteenHoursOn).ok,
    handoff,
  );
  check(
    'R16: the resume context is alive and still demands fresh clocks',
    readResumeVerdict(record, thirteenHoursOn).ok &&
      !resumeClocksConfirmable(record, clocksAt(T0 - HOUR)),
  );
  check(
    'R16: sanity — the two windows really are 12h and 72h',
    PLANNED_STOP_TTL_MS === 12 * HOUR && TRIP_RESUME_TTL_MS === 72 * HOUR,
  );
}

/* ============ R17 — the next segment uses the TP-1 handoff contract == */
{
  const app = readFileSync('src/components/trip-planner/PlanMyDayApp.tsx', 'utf8');
  check(
    'R17: the next segment writes its stop through plannedStopFromChoice + writePlannedStopRecord',
    app.includes('plannedStopFromChoice(choice, Date.now(), currentFingerprint())') &&
      app.includes('writePlannedStopRecord(stop);'),
  );
  check(
    'R17: sending a stop also writes the resume context beside it',
    app.includes('buildResumeRecord({') && app.includes('writeTripResumeRecord(record);'),
  );

  /* ---- the resume flow's own wiring, pinned at the source ------------ */
  check(
    'R4: the continue tap re-checks the clock gate at tap time',
    app.includes('resumeClocksConfirmable(resume, readClocks())'),
  );
  check(
    'R4: without fresh clocks the card offers ONLY the clock-entry door',
    app.includes('data-resume-update-clocks') && app.includes('href="/drive"'),
  );
  check(
    'R4: the demand is the shipped sentence',
    app.includes('RESUME_CLOCKS_NOTICE') &&
      RESUME_CLOCKS_NOTICE === 'Update your current clocks before continuing the HOS-aware plan.',
  );
  check(
    'R5: the resumed origin is built from the STORED stop, never re-geocoded',
    app.includes('label: resume.plannedStop.label') &&
      app.includes('position: resume.plannedStop.position'),
  );
  check(
    'R6: the resumed destination is the stored original',
    app.includes('label: resume.originalDestination.label') &&
      app.includes('position: resume.originalDestination.position'),
  );
  check(
    'R8: the resumed request carries the remaining via and its dwell',
    app.includes('resume.remainingVia?.dwellMin ?? 0') &&
      app.includes('resume.remainingVia?.dwellQualifiesForBreak ?? false'),
  );
  check(
    'R17: the old handoff is archived BEFORE the next segment is planned',
    /function continueTrip\(\)[\s\S]{0,1600}clearPlannedStopRecord\(\);[\s\S]*?void planDay\(\{/.test(
      app,
    ),
  );
  check(
    'R10: End Trip clears the stored context explicitly',
    app.includes('function endTrip()') &&
      /function endTrip\(\) \{\s*clearTripResumeRecord\(\);/.test(app),
  );
  check(
    'R12: planning toward another destination clears the old trip',
    app.includes('!resumeMatchesDestination(resume, req.destination.position)'),
  );
  check(
    'R2: the offer renders for a returning driver, never over a live plan',
    app.includes('resume !== null && plan === null'),
  );
  check(
    'resume: the quote is issued from explicit values, not half-applied state',
    app.includes('void planDay({') && app.includes('origin: nextOrigin'),
  );

  const driving = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check(
    'R11: the Navigator clears resume ONLY when the segment ends at the original destination',
    /resumeEndsAtDestination\(\s*resumeRecord/.test(driving) &&
      driving.includes('clearTripResumeRecord();'),
  );
}

/* ============ R18 — a resumed segment behaves like any other quote === */
async function resumedSegmentEndToEnd(): Promise<void> {
  const route = corridorRoute({ via: false });
  const deps = {
    loadListings: async () => corridorListings(),
    weather: nullWeatherPort,
    fuelPrice: async () => null,
    routing: { name: 'fixture', route: async () => corridorRoutingResult(route) },
  };
  // The resumed request exactly as continueTrip issues it: origin = the
  // STORED stop, destination = the original, no via (it was passed),
  // clocks = the driver's fresh entry.
  const resumed = await composeQuote(
    {
      origin: { label: stop.name, position: stop.position, country: 'US' },
      destination: MACON_DESTINATION,
      via: null,
      viaDwellMin: 0,
      viaDwellQualifiesForBreak: false,
      departAtMs: T0 + 11 * HOUR,
      fuelLevelFraction: 1,
      mpg: DEFAULT_TRUCK_PROFILE.mpg,
      tankGallons: DEFAULT_TRUCK_PROFILE.tankGallons,
      truck: {
        heightFt: DEFAULT_TRUCK_PROFILE.heightFt,
        widthFt: DEFAULT_TRUCK_PROFILE.widthFt,
        lengthFt: DEFAULT_TRUCK_PROFILE.lengthFt,
        grossWeightLbs: DEFAULT_TRUCK_PROFILE.grossWeightLbs,
        axles: DEFAULT_TRUCK_PROFILE.axles,
        hazmatClass: null,
      },
      avoid: [] as never[],
      bufferMin: 60,
      clocks: {
        cycleRule: '70/8',
        drivingUsedMin: 0,
        windowElapsedMin: -1,
        drivingSinceBreakMin: 0,
        cycleUsedMin: 0,
      },
    } as never,
    deps,
  );
  check('R18: the resumed quote composes like any other', resumed.ok);
  if (resumed.ok) {
    const trip = resumed.tripPlan;
    const kinds =
      trip.status === 'unavailable' ? '(unavailable)' : trip.events.map((e) => e.kind).join('>');
    check(
      'R18: fresh clocks reach the destination with no parking invented',
      trip.status === 'reachable' &&
        kinds.endsWith('destination') &&
        !kinds.includes('parking') &&
        !kinds.includes('clock-update'),
      kinds,
    );
  }
}

void resumedSegmentEndToEnd().then(() => {
  console.log(`trip-planner-resume: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
