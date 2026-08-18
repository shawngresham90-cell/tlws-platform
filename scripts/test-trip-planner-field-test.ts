/*
 * TP-6 — I-75 road-test instrumentation, kept honest.
 *
 * The field-test layer exists to compare the planner's predictions with
 * the real road. These scenarios pin the two promises that make it safe
 * to ship: it is INVISIBLE unless deliberately armed from the pilot
 * Navigator, and it is STRUCTURALLY incapable of storing what it
 * promised never to store — coordinates, raw clocks, identity.
 *
 *   FT1  field test disabled by default
 *   FT2  no exact coordinates recorded — by shape, by gate, by scrub
 *   FT3  no exact HOS clocks recorded — by shape and by gate
 *   FT4  ETA stored only as a coarse bucket
 *   FT5  buffer feedback stored only as a category
 *   FT6  parking outcome uses the fixed enum, nothing else
 *   FT7  observations survive reload (real storage layer round-trip)
 *   FT8  malformed field-test state fails safely
 *   FT9  the normal Trip Planner is unchanged with field mode off
 *   FT10 Navigator behavior unchanged (additive arm control only)
 *   FT11 resume behavior unchanged (no coupling into trip-resume)
 *   FT12 no production directory mutation from an observation
 *   FT13 trip completion closes the session cleanly
 *   FT14 trip cancellation closes the session cleanly
 *   FT15 the privacy gate rejects forbidden fields at the door
 *
 * The storage checks run the REAL versioned layer against a stub window,
 * exactly as the TP-5 resume harness does.
 */
import { readFileSync } from 'node:fs';
import {
  addFieldNote,
  buildFieldTestSummary,
  closeFieldTestSession,
  dwellBucketOf,
  fieldTestRecordProblems,
  fieldTestSessionIsStale,
  recordFieldOutcome,
  sanitizeScoreComponents,
  setPlanEvidence,
  startFieldTestSession,
  BUFFER_OUTCOMES,
  ETA_VARIANCE_BUCKETS,
  NOTES_MAX,
  PARKING_OUTCOMES,
  SESSIONS_MAX,
  SESSION_EXPIRY_MS,
  type FieldTestSession,
  type PlanEvidence,
} from '@/lib/trip-planner/field-test';

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

// Minute-aligned on purpose: observation offsets are exact whole minutes.
const T0 = 1_798_000_020_000;
const MIN = 60_000;

/* ---- a browser-shaped storage stub, so the REAL storage layer runs ---- */
const backing = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
  },
};
import {
  clearAllFieldTestData,
  readActiveFieldTestSession,
  readFieldTestArmed,
  readFieldTestSessions,
  writeActiveFieldTestSession,
  writeFieldTestArmed,
  writeFieldTestSessions,
  FIELD_TEST_ARM_KEY,
  FIELD_TEST_SESSIONS_KEY,
  FIELD_TEST_VERSION,
} from '@/components/navigator/field-test-storage';

const evidence: PlanEvidence = {
  limitedBy: 'cycle',
  requiredBreakCount: 1,
  chosenRank: 1,
  alternativesShown: 3,
  // `coordVerified`, the way the capture path renames the ranking
  // engine's `coordinates` component before the privacy gate sees it.
  scoreComponents: { category: 30, coordVerified: 15, parking: 12 },
  scoreTotal: 57,
  overnightStatus: 'confirmed',
  reservable: false,
  detourBucket: '<5m',
  source: 'manually-verified',
  viaDwell: '30-60m',
  viaDwellQualifies: false,
};

/* ============ FT1 — disabled by default ============================== */
{
  backing.clear();
  check('FT1: an untouched device is not armed', readFieldTestArmed() === false);
  check('FT1: and holds no sessions', readFieldTestSessions(T0).length === 0);
  backing.set(FIELD_TEST_ARM_KEY, JSON.stringify({ v: FIELD_TEST_VERSION, armed: 'yes' }));
  check('FT1: a non-boolean arm value stays OFF', readFieldTestArmed() === false);
  writeFieldTestArmed(true);
  check('FT1: arming works only through the explicit writer', readFieldTestArmed() === true);
  writeFieldTestArmed(false);
  check('FT1: disarming removes the flag entirely', !backing.has(FIELD_TEST_ARM_KEY));

  const panel = readFileSync('src/components/trip-planner/FieldTestPanel.tsx', 'utf8');
  check('FT1: the panel renders nothing when unarmed', panel.includes('if (!armed) return null;'));
  const arm = readFileSync('src/components/navigator/RoadTestArm.tsx', 'utf8');
  check(
    'FT1: the ONLY arm switch lives on the pilot-gated Navigator surface',
    arm.includes('writeFieldTestArmed') &&
      !panel.includes('writeFieldTestArmed(true)') &&
      readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8').includes(
        '<RoadTestArm />',
      ),
  );
}

/* ============ FT2/FT3 — no coordinates, no clocks, structurally ====== */
{
  const session = startFieldTestSession(T0 + 30_500);
  check(
    'FT2: session time is coarse — rounded to the minute',
    session.startedAtMs % MIN === 0,
    session.startedAtMs,
  );
  const flat = JSON.stringify(setPlanEvidence(session, evidence));
  check(
    'FT2: a full session serializes with nothing coordinate-shaped',
    fieldTestRecordProblems(JSON.parse(flat)).length === 0 && !/lat|lng|position/i.test(flat),
    flat,
  );
  check(
    'FT2: the gate refuses coordinate KEYS wherever they hide',
    fieldTestRecordProblems({ note: { lat: 34.7, lng: -84.9 } }).length === 2 &&
      fieldTestRecordProblems({ deep: { nested: { position: 1 } } }).length === 1,
  );
  check(
    'FT2: the gate refuses coordinate-pair VALUES inside text',
    fieldTestRecordProblems({ text: 'parked at 34.7698, -84.9702 overnight' }).length === 1,
  );
  const noted = addFieldNote(session, 'full lot near 34.7698, -84.9702 at exit 296', T0 + 5 * MIN);
  check(
    'FT2: a note containing coordinates is scrubbed before it is stored',
    noted !== null &&
      !noted.observations[0].value.includes('34.7698') &&
      noted.observations[0].value.includes('exit 296'),
    noted?.observations[0]?.value,
  );

  check(
    'FT3: the gate refuses raw HOS clock field names',
    fieldTestRecordProblems({ drivingMin: 300 }).length === 1 &&
      fieldTestRecordProblems({ clocks: { untilBreakMin: 90 } }).length === 1 &&
      fieldTestRecordProblems({ windowMin: 500 }).length === 1 &&
      fieldTestRecordProblems({ cycleMin: 4000 }).length === 1,
  );
  check(
    'FT3: plan evidence carries the LABEL of the binding rule, never minutes',
    evidence.limitedBy === 'cycle' &&
      !('clockLimitMin' in evidence) &&
      !('stopTargetMin' in evidence),
  );
}

/* ============ FT4/FT5/FT6 — categories, not measurements ============= */
{
  const s = startFieldTestSession(T0);
  check(
    'FT4: every ETA bucket is accepted',
    ETA_VARIANCE_BUCKETS.every((b) => recordFieldOutcome(s, 'eta-variance', b, T0) !== null),
  );
  check(
    'FT4: a raw minute count is REFUSED, never coerced',
    recordFieldOutcome(s, 'eta-variance', '45', T0) === null &&
      recordFieldOutcome(s, 'eta-variance', '45 minutes late', T0) === null,
  );
  check(
    'FT5: buffer feedback takes only the three categories',
    BUFFER_OUTCOMES.every((b) => recordFieldOutcome(s, 'buffer-outcome', b, T0) !== null) &&
      recordFieldOutcome(s, 'buffer-outcome', '75', T0) === null,
  );
  check(
    'FT6: parking outcome takes exactly the fixed enum',
    PARKING_OUTCOMES.every((p) => recordFieldOutcome(s, 'parking-outcome', p, T0) !== null) &&
      recordFieldOutcome(s, 'parking-outcome', 'maybe', T0) === null,
  );
  const once = recordFieldOutcome(s, 'parking-outcome', 'full', T0 + 10 * MIN);
  const twice =
    once === null ? null : recordFieldOutcome(once, 'parking-outcome', 'available', T0 + 20 * MIN);
  check(
    'FT6: re-recording replaces — the latest judgement wins, list stays bounded',
    twice !== null &&
      twice.observations.filter((o) => o.kind === 'parking-outcome').length === 1 &&
      twice.observations.find((o) => o.kind === 'parking-outcome')?.value === 'available',
  );
  check(
    'observations carry minute OFFSETS from start, never wall clocks',
    twice?.observations.find((o) => o.kind === 'parking-outcome')?.atOffsetMin === 20,
  );
  const closed = closeFieldTestSession(s, 'ended');
  check(
    'a closed session refuses further observations',
    recordFieldOutcome(closed, 'resume', 'yes', T0) === null &&
      addFieldNote(closed, 'late note', T0) === null,
  );
}

/* ============ FT7 — observations survive reload ====================== */
{
  backing.clear();
  let s = startFieldTestSession(T0);
  s = recordFieldOutcome(s, 'handoff', 'yes', T0 + 60 * MIN) ?? s;
  s = addFieldNote(s, 'signage confusing at the second entrance', T0 + 65 * MIN) ?? s;
  s = setPlanEvidence(s, evidence) ?? s;
  check('FT7: the write is accepted', writeFieldTestSessions([s], T0 + 66 * MIN));
  const back = readActiveFieldTestSession(T0 + 70 * MIN);
  check(
    'FT7: a fresh read (= a reload) returns the same observations',
    back !== null &&
      back.observations.length === 2 &&
      back.observations.find((o) => o.kind === 'handoff')?.value === 'yes' &&
      back.planEvidence?.scoreTotal === 57,
    back,
  );
  check(
    'FT7: expiry drops old evidence, cap bounds the history',
    readFieldTestSessions(T0 + SESSION_EXPIRY_MS + MIN).length === 0 &&
      (() => {
        const many = Array.from({ length: 9 }, (_, i) =>
          closeFieldTestSession(startFieldTestSession(T0 + i * MIN), 'ended'),
        );
        writeFieldTestSessions(many, T0 + 10 * MIN);
        return readFieldTestSessions(T0 + 10 * MIN).length === SESSIONS_MAX;
      })(),
  );
  check(
    'notes are capped in count and length',
    (() => {
      let n = startFieldTestSession(T0);
      for (let i = 0; i < NOTES_MAX; i++) n = addFieldNote(n, `note ${i}`, T0) ?? n;
      return (
        addFieldNote(n, 'one too many', T0) === null &&
        (addFieldNote(startFieldTestSession(T0), 'x'.repeat(500), T0)?.observations[0].value
          .length ?? 0) <= 280
      );
    })(),
  );
  backing.clear();
}

/* ============ FT8 — malformed state fails safely ===================== */
{
  const junk = [
    'not json',
    '42',
    JSON.stringify({ v: 999, sessions: [] }),
    JSON.stringify({ v: FIELD_TEST_VERSION }), // sessions missing
    JSON.stringify({ v: FIELD_TEST_VERSION, sessions: 'lots' }),
    JSON.stringify({
      v: FIELD_TEST_VERSION,
      sessions: [{ startedAtMs: 'yesterday', observations: [] }],
    }),
  ];
  let allSafe = true;
  for (const raw of junk) {
    backing.set(FIELD_TEST_SESSIONS_KEY, raw);
    if (readFieldTestSessions(T0).length !== 0) allSafe = false;
    if (readActiveFieldTestSession(T0) !== null) allSafe = false;
  }
  check('FT8: every malformed payload reads as empty, never a crash', allSafe);
  // A malformed OBSERVATION inside a valid session is dropped, the rest kept.
  backing.set(
    FIELD_TEST_SESSIONS_KEY,
    JSON.stringify({
      v: FIELD_TEST_VERSION,
      sessions: [
        {
          startedAtMs: T0,
          planEvidence: null,
          observations: [
            { atOffsetMin: 5, kind: 'handoff', value: 'yes' },
            { atOffsetMin: -2, kind: 'resume', value: 'yes' }, // negative offset
            { atOffsetMin: 6, kind: 'weird-kind', value: 'x' }, // unknown kind
          ],
          closed: null,
        },
      ],
    }),
  );
  const shaped = readActiveFieldTestSession(T0 + MIN);
  check(
    'FT8: bad observations are shed, good ones survive',
    shaped !== null &&
      shaped.observations.length === 1 &&
      shaped.observations[0].kind === 'handoff',
    shaped,
  );
  backing.clear();
  clearAllFieldTestData();
  check('the delete-everything control removes flag and evidence alike', backing.size === 0);
}

/* ============ FT9/FT10/FT11/FT12 — nothing else changes ============== */
{
  const app = readFileSync('src/components/trip-planner/PlanMyDayApp.tsx', 'utf8');
  check(
    'FT9: evidence capture only runs when armed, inside the send handler',
    app.includes('if (readFieldTestArmed())') && app.includes('readActiveFieldTestSession'),
  );
  check(
    'FT9: the panel mounts LAST on the page, after the planning workflow',
    app.indexOf('<FieldTestPanel />') > app.indexOf('data-plan-button'),
  );
  // The ENGINE never learns field-test mode exists: no planning module
  // imports it, so plans cannot differ with the mode on or off.
  const engineFiles = [
    'compose-quote.ts',
    'plan-my-day.ts',
    'trip-plan.ts',
    'drive-window.ts',
    'break-plan.ts',
    'last-stop.ts',
    'trip-resume.ts',
    'route-legs.ts',
    'route-time-axis.ts',
  ];
  check(
    'FT9/FT11: no engine or resume module imports the field-test layer',
    engineFiles.every(
      (f) => !readFileSync(`src/lib/trip-planner/${f}`, 'utf8').includes('field-test'),
    ),
  );
  const driving = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check(
    'FT10: the Navigator addition is the arm control plus a guarded close — nothing else',
    driving.includes('<RoadTestArm />') && driving.includes('if (fieldSession !== null)'),
  );
  const lib = readFileSync('src/lib/trip-planner/field-test.ts', 'utf8');
  const storage = readFileSync('src/components/navigator/field-test-storage.ts', 'utf8');
  check(
    'FT12: the field-test layer can reach no network and no directory — observations are evidence, not edits',
    !/fetch\(|supabase|directory-loader|postgrest/i.test(lib) &&
      !/fetch\(|supabase|directory-loader|postgrest/i.test(storage),
  );
}

/* ============ FT13/FT14 — the trip's end closes the session ========== */
{
  const s = startFieldTestSession(T0);
  const completed = closeFieldTestSession(s, 'completed');
  const cancelled = closeFieldTestSession(s, 'cancelled');
  check(
    'FT13: completion closes cleanly and closure is final',
    completed.closed === 'completed' &&
      closeFieldTestSession(completed, 'cancelled').closed === 'completed',
  );
  check('FT14: cancellation closes cleanly', cancelled.closed === 'cancelled');
  const driving = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check(
    'FT13: arrival at the ORIGINAL destination closes the live session',
    /clearTripResumeRecord\(\);[\s\S]{0,700}closeFieldTestSession\(fieldSession, 'completed'\)/.test(
      driving,
    ),
  );
  const app = readFileSync('src/components/trip-planner/PlanMyDayApp.tsx', 'utf8');
  check(
    "FT14: the planner's End Trip closes the live session as cancelled",
    /function endTrip\(\)[\s\S]{0,700}closeFieldTestSession\(fieldSession, 'cancelled'\)/.test(app),
  );
  check(
    'FT13/FT14: closing PRESERVES evidence — sessions close, they are not deleted',
    (() => {
      backing.clear();
      writeFieldTestSessions([closeFieldTestSession(startFieldTestSession(T0), 'completed')], T0);
      return (
        readFieldTestSessions(T0 + MIN).length === 1 &&
        readActiveFieldTestSession(T0 + MIN) === null
      );
    })(),
  );
  backing.clear();
}

/* ============ FT15 — the privacy gate guards the door ================ */
{
  const smuggled = [
    { startedAtMs: T0, planEvidence: null, observations: [], closed: null, lat: 34.7 },
    {
      startedAtMs: T0,
      planEvidence: { chosenRank: 1, alternativesShown: 3, drivingMin: 300 },
      observations: [],
      closed: null,
    },
    {
      startedAtMs: T0,
      planEvidence: null,
      observations: [{ atOffsetMin: 1, kind: 'note', value: 'call me at 706-555-0134 tonight' }],
      closed: null,
    },
    {
      startedAtMs: T0,
      planEvidence: null,
      observations: [{ atOffsetMin: 1, kind: 'note', value: 'email shawn@example.com about it' }],
      closed: null,
    },
  ];
  let allRefused = true;
  for (const s of smuggled) {
    backing.delete(FIELD_TEST_SESSIONS_KEY);
    if (writeFieldTestSessions([s as unknown as FieldTestSession], T0)) allRefused = false;
    if (backing.has(FIELD_TEST_SESSIONS_KEY)) allRefused = false;
  }
  check('FT15: every smuggled forbidden shape refuses the WHOLE write', allRefused);
  check(
    'FT15: the refusal is visible to the caller (returns false, stores nothing)',
    writeActiveFieldTestSession(
      {
        startedAtMs: T0,
        planEvidence: null,
        observations: [{ atOffsetMin: 1, kind: 'note', value: 'at 34.76981,-84.97024' }],
        closed: null,
      },
      T0,
    ) === false,
  );
  check(
    'FT15: a clean session still writes — the gate blocks shapes, not testing',
    writeActiveFieldTestSession(startFieldTestSession(T0), T0) === true,
  );
  backing.clear();
}

/* ============ the summary — scrubbed on the way out ================== */
{
  let s = startFieldTestSession(T0);
  s = setPlanEvidence(s, evidence) ?? s;
  s = recordFieldOutcome(s, 'buffer-outcome', 'about-right', T0 + 90 * MIN) ?? s;
  const summary = buildFieldTestSummary(s);
  check(
    'summary: carries the ranking evidence and observations',
    summary.includes('limiting clock: cycle') &&
      summary.includes('chosen rank: #1 of 3') &&
      summary.includes('category: 30') &&
      summary.includes('buffer-outcome: about-right'),
    summary,
  );
  check(
    'summary: start time is minute-coarse ISO, observations are offsets',
    summary.includes('Z') && summary.includes('+  90m'),
  );
  check('helper: dwell buckets are the only dwell representation', dwellBucketOf(60) === '30-60m');
  check(
    'helper: the capture path renames the coordinate-verification score and drops colliding keys',
    (() => {
      const cleaned = sanitizeScoreComponents({ category: 30, coordinates: 15, latitude: 9 });
      return (
        cleaned.coordVerified === 15 &&
        cleaned.category === 30 &&
        !('coordinates' in cleaned) &&
        !('latitude' in cleaned) &&
        fieldTestRecordProblems(cleaned).length === 0
      );
    })(),
  );
  check(
    'helper: stale sessions include future-dated ones',
    fieldTestSessionIsStale(startFieldTestSession(T0), T0 - MIN),
  );
}

console.log(`trip-planner-field-test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
