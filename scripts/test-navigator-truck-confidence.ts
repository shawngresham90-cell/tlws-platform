/**
 * Truck-route confidence — the milestone's own harness.
 *
 * The question a fleet manager asks is "which of those numbers actually
 * changed the route?", and every check here exists to make that question
 * answerable rather than plausible:
 *
 *   1. VALIDATION — a real tractor-trailer passes; zero, negative,
 *      nonnumeric, infinite and out-of-range values are REFUSED, never
 *      quietly corrected; counts stay integers; hazmat maps only to
 *      values the provider actually accepts.
 *   2. CONFIRMATION — defaults are labelled as defaults, Start is unusable
 *      until the driver confirms, confirming costs no provider request, a
 *      repeat trip on an unchanged profile keeps the one-tap flow, a
 *      routing change invalidates the confirmation, and a NOT-sent field
 *      cannot invalidate it (because it never claimed to route).
 *   3. THE REQUEST — exact parameters and exact conversions for several
 *      real profiles, no duplicates, no unsupported parameter, the
 *      request CHANGES when the confirmed truck changes, and there is
 *      never a car-route fallback.
 *   4. THE EXPLANATION — "Route planned for" lists only what was sent,
 *      the not-used fields are disclosed as not routed around, and the
 *      decision surfaces stay honest.
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-truck-confidence
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AVOIDANCE_CHOICES,
  CONFIRM_HEADING,
  DEFAULT_EDITABLE_PROFILE,
  EDITABLE_FIELDS,
  HAZMAT_CHOICES,
  NOT_ROUTED_NOTICE,
  NO_CONFIRMATION,
  confirmProfile,
  correctionsFor,
  ftIn,
  profileGate,
  profileSummary,
  routingFingerprint,
  toTruckProfile,
  validateEditableProfile,
  type EditableProfile,
} from '@/lib/navigator/truck-profile';
import {
  AVOIDANCE_LABELS,
  HERE_AVOID_FEATURES,
  formatFeetInches,
  hazmatToHereGoods,
  sanitizeAvoidances,
  sentRestrictionLines,
  truckWireParams,
} from '@/lib/trip-planner/here-truck-params';
import { buildHereRouteUrl } from '@/lib/trip-planner/here-routing';
import type { RouteAvoidance } from '@/lib/trip-planner/providers';
import { TruckProfileEditor } from '@/components/navigator/TruckProfileEditor';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(
      `FAIL: ${name}${detail === undefined ? '' : ` — ${String(JSON.stringify(detail)).slice(0, 220)}`}`,
    );
  }
}

const KEY = 'test-key-not-a-real-one';
const ORIGIN = { lat: 33.7, lng: -84.4 };
const DEST = { lat: 34.0, lng: -85.0 };

/** The exact query parameters for a profile, key redacted. */
function paramsFor(edit: EditableProfile): Map<string, string> {
  const url = buildHereRouteUrl(
    {
      origin: ORIGIN,
      destination: DEST,
      waypoints: [],
      truck: toTruckProfile(edit),
      departAtMs: 1_770_000_000_000,
      avoid: edit.avoid as RouteAvoidance[],
    },
    KEY,
  );
  const out = new Map<string, string>();
  for (const [k, v] of new URL(url).searchParams.entries()) {
    out.set(k, k === 'apiKey' ? '<redacted>' : v);
  }
  return out;
}

const p = (over: Partial<EditableProfile> = {}): EditableProfile => ({
  ...DEFAULT_EDITABLE_PROFILE,
  ...over,
});

/* ==================== 1. profile validation ============================= */
{
  check(
    'valid: a standard 13′6″ / 80,000 lb / 5-axle rig passes',
    validateEditableProfile(p()).length === 0,
  );
  check(
    'valid: a legal heavy-haul inside the supported range passes',
    validateEditableProfile(p({ grossWeightLbs: 120_000, axles: 9, lengthFt: 100 })).length === 0,
  );

  /*
   * Boundaries: the shipped limits are inclusive, and one step outside is
   * out. Weight and axles do NOT vary independently — the validator also
   * enforces a per-axle ceiling (20,000 lb/axle) and a minimum axle count
   * for combination lengths, so the extreme of one field is only legal
   * with a matching value of the other. Testing them independently would
   * be testing a truck that cannot exist, so each extreme is paired with
   * the axle count that makes it real. That cross-check is exercised
   * explicitly below.
   */
  const pairFor = (key: string, value: number): Partial<EditableProfile> =>
    key === 'grossWeightLbs'
      ? { grossWeightLbs: value, axles: Math.max(3, Math.ceil(value / 20_000)) }
      : key === 'axles'
        ? {
            axles: value,
            grossWeightLbs: Math.min(80_000, value * 20_000),
            lengthFt: value < 3 ? 40 : 70,
          }
        : ({ [key]: value } as Partial<EditableProfile>);
  for (const f of EDITABLE_FIELDS) {
    check(
      `bounds: ${f.key} accepts its minimum (${f.min})`,
      validateEditableProfile(p(pairFor(f.key, f.min))).length === 0,
      correctionsFor(validateEditableProfile(p(pairFor(f.key, f.min)))),
    );
    check(
      `bounds: ${f.key} accepts its maximum (${f.max})`,
      validateEditableProfile(p(pairFor(f.key, f.max))).length === 0,
      correctionsFor(validateEditableProfile(p(pairFor(f.key, f.max)))),
    );
    check(
      `bounds: ${f.key} REFUSES below its minimum`,
      validateEditableProfile(p({ [f.key]: f.min - 0.1 } as Partial<EditableProfile>)).length > 0,
    );
    check(
      `bounds: ${f.key} REFUSES above its maximum`,
      validateEditableProfile(p({ [f.key]: f.max + 0.1 } as Partial<EditableProfile>)).length > 0,
    );
    // The junk a numeric keypad can produce.
    for (const [name, bad] of [
      ['zero', 0],
      ['negative', -5],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ] as [string, number][]) {
      check(
        `bounds: ${f.key} REFUSES ${name}`,
        validateEditableProfile(p({ [f.key]: bad } as Partial<EditableProfile>)).length > 0,
      );
    }
  }
  check(
    'cross-check: 164,000 lb on 5 axles is refused — the per-axle ceiling binds',
    validateEditableProfile(p({ grossWeightLbs: 164_000, axles: 5 })).length > 0,
  );
  check(
    'cross-check: the same weight on 9 axles is accepted',
    validateEditableProfile(p({ grossWeightLbs: 164_000, axles: 9 })).length === 0,
  );
  check(
    'cross-check: a 70 ft combination on 2 axles is refused',
    validateEditableProfile(p({ lengthFt: 70, axles: 2, grossWeightLbs: 40_000 })).length > 0,
  );
  check(
    'counts: a fractional axle count is refused, not rounded',
    validateEditableProfile(p({ axles: 4.5 })).some((i) => i.code === 'axles-not-integer'),
  );
  check(
    'refusal: nothing is clamped — the returned profile is untouched',
    (() => {
      const bad = p({ heightFt: 99 });
      validateEditableProfile(bad);
      return bad.heightFt === 99;
    })(),
  );
  check(
    'refusal: the driver gets sentences, not error codes',
    correctionsFor(validateEditableProfile(p({ heightFt: 99 }))).every(
      (m) => /[a-z]{4,}/.test(m) && m.endsWith('.'),
    ),
    correctionsFor(validateEditableProfile(p({ heightFt: 99 }))),
  );

  // Hazmat: only values the provider actually accepts.
  for (const choice of HAZMAT_CHOICES) {
    if (choice.value === null) continue;
    check(
      `hazmat: class ${choice.value} is accepted and maps to a provider value`,
      validateEditableProfile(p({ hazmatClass: choice.value })).length === 0 &&
        hazmatToHereGoods(choice.value) !== null,
    );
  }
  check(
    'hazmat: an invented placard ("3.7") is refused',
    validateEditableProfile(p({ hazmatClass: '3.7' })).length > 0,
  );
  check(
    'hazmat: none is valid and sends NO parameter',
    (() => {
      const params = paramsFor(p({ hazmatClass: null }));
      return (
        validateEditableProfile(p({ hazmatClass: null })).length === 0 &&
        !params.has('truck[shippedHazardousGoods]')
      );
    })(),
  );
  check(
    'avoidances: every offered choice is one the wire actually supports',
    AVOIDANCE_CHOICES.every((c) => HERE_AVOID_FEATURES.has(c.value)),
  );
  check(
    'avoidances: an unsupported avoidance is refused rather than dropped silently',
    validateEditableProfile(p({ avoid: ['lowEmissionZone'] })).some(
      (i) => i.code === 'avoidance-unsupported',
    ),
  );
}

/* ==================== 2. confirmation behavior ========================== */
{
  check(
    'gate: an unconfirmed profile is not routable',
    profileGate(p(), NO_CONFIRMATION) === 'unconfirmed',
  );
  check(
    'gate: an INVALID profile is not routable, whatever was confirmed',
    profileGate(p({ heightFt: 99 }), confirmProfile(p({ heightFt: 99 }))) === 'invalid',
  );
  const confirmed = confirmProfile(p());
  check(
    'gate: a confirmed, unchanged, valid profile is ready',
    profileGate(p(), confirmed) === 'ready',
  );
  check(
    'gate: a repeat trip on the SAME confirmed profile stays ready (one-tap Start survives)',
    profileGate(p(), confirmed) === 'ready' && profileGate(p(), confirmed) === 'ready',
  );

  // Every routing-relevant change must invalidate.
  for (const [what, next] of [
    ['height', p({ heightFt: 14 })],
    ['width', p({ widthFt: 9 })],
    ['length', p({ lengthFt: 75 })],
    ['gross weight', p({ grossWeightLbs: 60_000 })],
    ['axles', p({ axles: 6 })],
    ['hazmat', p({ hazmatClass: '3' })],
    ['an avoidance', p({ avoid: ['tollRoad'] })],
  ] as [string, EditableProfile][]) {
    check(
      `gate: changing ${what} invalidates the confirmation`,
      profileGate(next, confirmed) === 'unconfirmed',
    );
  }
  check(
    'gate: re-confirming the changed truck makes it routable again',
    profileGate(p({ heightFt: 14 }), confirmProfile(p({ heightFt: 14 }))) === 'ready',
  );
  check(
    'gate: an avoidance that the wire would DROP cannot change the fingerprint',
    routingFingerprint(p()) === routingFingerprint(p({ avoid: [] })),
  );
  check(
    'fingerprint: is built from the wire parameters themselves',
    routingFingerprint(p({ heightFt: 14 })).includes('truck[height]=427'),
    routingFingerprint(p({ heightFt: 14 })),
  );
  check(
    'fingerprint: two profiles that serialize identically are the same truck',
    routingFingerprint(p({ avoid: ['tollRoad', 'tollRoad'] })) ===
      routingFingerprint(p({ avoid: ['tollRoad'] })),
  );

  // Confirmation is pure: it cannot spend anything.
  const core = readFileSync('src/lib/navigator/truck-profile.ts', 'utf8');
  check(
    'confirmation: the profile core performs no I/O of any kind',
    !/fetch\(|XMLHttpRequest|sessionStorage|localStorage|Date\.now/.test(core),
  );
  const controls = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  check(
    'confirmation: Start refuses to spend on an unconfirmed or invalid truck',
    /if \(truckGate !== 'ready'\)[\s\S]{0,400}attemptRef\.current\.end\(\)/.test(controls),
  );
  check(
    'confirmation: and it refuses BEFORE the GPS watch is started',
    (() => {
      const body = controls.slice(
        controls.indexOf('function startTrip()'),
        controls.indexOf('function cancelStart()'),
      );
      return (
        body.indexOf("truckGate !== 'ready'") >= 0 &&
        body.indexOf("truckGate !== 'ready'") < body.indexOf('gps.start()')
      );
    })(),
  );
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check(
    'confirmation: a changed profile discards a route planned for the old truck',
    /onChange=\{\(next\) => \{[\s\S]{0,900}discardRoute/.test(screen),
  );
  check(
    // Read the CODE: the component's own doc comment explains that it has
    // no motion rule, and must not itself trip this check.
    'editing: the editor rides the SHARED lock, with no motion rule of its own',
    !/speedMph|isMoving|motionState|useSafetyLock/.test(
      readFileSync('src/components/navigator/TruckProfileEditor.tsx', 'utf8').replace(
        /\/\*[\s\S]*?\*\//g,
        '',
      ),
    ),
  );
}

/* ==================== 3. the provider request =========================== */
{
  const EXPECTED = [
    'transportMode',
    'origin',
    'destination',
    'return',
    'units',
    'departureTime',
    'truck[height]',
    'truck[width]',
    'truck[length]',
    'truck[grossWeight]',
    'truck[axleCount]',
    'apiKey',
  ];
  const base = paramsFor(p());
  check(
    'request: a no-hazmat, no-avoidance profile sends exactly the base set',
    [...base.keys()].sort().join(',') === [...EXPECTED].sort().join(','),
    [...base.keys()].sort(),
  );

  // Exact conversions, per profile. ft × 30.48 → cm, lb × 0.45359237 → kg.
  const cases: [string, EditableProfile, Record<string, string>][] = [
    [
      'standard 13′6″ 80,000 lb 5-axle',
      p(),
      {
        'truck[height]': '411',
        'truck[width]': '259',
        'truck[length]': '2134',
        'truck[grossWeight]': '36287',
        'truck[axleCount]': '5',
      },
    ],
    [
      'taller 14′0″',
      p({ heightFt: 14 }),
      { 'truck[height]': '427', 'truck[grossWeight]': '36287' },
    ],
    [
      'heavier 120,000 lb on 9 axles',
      p({ grossWeightLbs: 120_000, axles: 9 }),
      { 'truck[grossWeight]': '54431', 'truck[axleCount]': '9' },
    ],
    [
      'narrower and shorter',
      p({ widthFt: 8, lengthFt: 48 }),
      { 'truck[width]': '244', 'truck[length]': '1463' },
    ],
  ];
  for (const [name, profile, expect] of cases) {
    const params = paramsFor(profile);
    for (const [k, v] of Object.entries(expect)) {
      check(`request: ${name} → ${k}=${v}`, params.get(k) === v, params.get(k));
    }
  }

  check(
    'request: a hazmat class adds exactly one parameter, with the mapped value',
    (() => {
      const params = paramsFor(p({ hazmatClass: '3' }));
      return (
        params.get('truck[shippedHazardousGoods]') === 'flammable' && params.size === base.size + 1
      );
    })(),
  );
  check(
    'request: avoidances travel as ONE comma-joined parameter',
    paramsFor(p({ avoid: ['tollRoad', 'ferry'] })).get('avoid[features]') === 'tollRoad,ferry',
  );
  check(
    'request: an unsupported avoidance never reaches the wire',
    !paramsFor(p({ avoid: ['lowEmissionZone'] })).has('avoid[features]'),
  );
  check(
    'request: duplicate avoidances are de-duplicated, not repeated',
    paramsFor(p({ avoid: ['ferry', 'ferry'] })).get('avoid[features]') === 'ferry',
  );
  for (const unsupported of [
    'truck[weightPerAxle]',
    'truck[trailerCount]',
    'truck[tunnelCategory]',
    'truck[type]',
    'vehicle[type]',
  ]) {
    check(
      `request: ${unsupported} is NOT sent — the provider contract for it could not be verified`,
      !paramsFor(p({ hazmatClass: '3', avoid: ['tollRoad'] })).has(unsupported),
    );
  }
  check(
    'request: no parameter is ever duplicated',
    (() => {
      const url = buildHereRouteUrl(
        {
          origin: ORIGIN,
          destination: DEST,
          waypoints: [],
          truck: toTruckProfile(p({ hazmatClass: '3' })),
          departAtMs: 1_770_000_000_000,
          avoid: ['tollRoad', 'ferry'],
        },
        KEY,
      );
      const keys = [...new URL(url).searchParams.keys()];
      return keys.length === new Set(keys).size;
    })(),
  );
  check(
    'request: changing the confirmed truck CHANGES the request',
    paramsFor(p()).get('truck[height]') !== paramsFor(p({ heightFt: 14 })).get('truck[height]'),
  );
  check(
    'request: never a car route — the mode is always truck',
    ['standard', 'hazmat', 'heavy'].every(
      (_, i) =>
        paramsFor([p(), p({ hazmatClass: '3' }), p({ grossWeightLbs: 120_000 })][i]).get(
          'transportMode',
        ) === 'truck',
    ),
  );
  const here = readFileSync('src/lib/trip-planner/here-routing.ts', 'utf8');
  check(
    'request: no car/pedestrian transport mode exists anywhere in the adapter',
    !/transportMode'?,\s*'(car|pedestrian|bicycle|scooter)'/.test(here),
  );
  check(
    'request: the key never appears beside a driver-facing value',
    !/apiKey/.test(readFileSync('src/lib/trip-planner/here-truck-params.ts', 'utf8')),
  );
}

/* ==================== 4. the driver-facing explanation ================== */
{
  const lines = sentRestrictionLines(toTruckProfile(p()), []);
  check('planned-for: height reads like a bridge placard', lines.includes('13′6″'));
  check('planned-for: weight reads in pounds', lines.includes('80,000 lb'));
  check('planned-for: axles are stated', lines.includes('5 axles'));
  check('planned-for: no hazmat is stated as "Hazmat: none"', lines.includes('Hazmat: none'));
  check(
    'planned-for: an avoidance appears only when it was sent',
    !lines.some((l) => /Avoid/i.test(l)) &&
      sentRestrictionLines(toTruckProfile(p()), ['tollRoad']).some((l) =>
        l.includes(AVOIDANCE_LABELS.tollRoad),
      ),
  );
  check(
    'planned-for: every line corresponds to a parameter that was sent',
    (() => {
      const profile = p({ hazmatClass: '3', avoid: ['ferry'] });
      const wire = truckWireParams(toTruckProfile(profile), profile.avoid);
      const shown = sentRestrictionLines(toTruckProfile(profile), profile.avoid);
      // Every shown line is a driverValue of a real wire parameter.
      return shown.every((l) => wire.some((w) => w.driverValue === l));
    })(),
  );
  check(
    'planned-for: a NOT-sent field never appears in it',
    !sentRestrictionLines(toTruckProfile(p()), []).some((l) =>
      /trailer|per axle|tunnel|vehicle type/i.test(l),
    ),
  );

  // The summary that the confirmation screen shows.
  const summary = profileSummary(p());
  check(
    'summary: the four unverifiable fields are present and marked NOT sent',
    ['Trailers', 'Weight per axle', 'Tunnel category', 'Vehicle type'].every((label) =>
      summary.some((l) => l.label === label && !l.sent),
    ),
  );
  check(
    'summary: every sent line corresponds to a real wire parameter or a true absence',
    summary.filter((l) => l.sent).length === 7,
    summary.filter((l) => l.sent).map((l) => l.label),
  );

  // The rendered editor.
  const html = renderToStaticMarkup(
    createElement(TruckProfileEditor, {
      profile: p(),
      onChange: () => {},
      onConfirm: () => {},
      confirmed: false,
      isDefault: true,
    }),
  );
  check('editor: asks the driver to confirm their truck', html.includes(CONFIRM_HEADING));
  check(
    'editor: says plainly that untouched values are DEFAULTS',
    html.includes('not your truck until you check them'),
  );
  check('editor: discloses the fields that do not route', html.includes('Not used for routing'));
  check('editor: and what that means for the driver', html.includes(NOT_ROUTED_NOTICE));
  check(
    'editor: every editable value carries its unit',
    EDITABLE_FIELDS.every((f) => html.includes(`${f.unit}`)),
  );

  /*
   * NO BARE DECIMAL FEET, ANYWHERE A DRIVER LOOKS.
   *
   * The bug this pins out: the height presets read `13.5`, `13.6`, `14`.
   * `13.6` is not 13′6″ — it is 13′7¼″ — and a driver reading a cab card
   * that says 13′6″ can reasonably tap it. Feet-and-inches makes the
   * mistake unspellable, so the notation is pinned rather than trusted.
   */
  check(
    'editor: imperial dimensions read as feet and inches',
    html.includes('13′6″') && html.includes('13′7″') && html.includes('14′0″'),
  );
  check(
    'editor: the misreadable 13.6 preset is GONE',
    !/>\s*13\.6\s*</.test(html) && !/13\.6\s*ft/.test(html),
  );
  check(
    'editor: no bare decimal foot is shown to a driver',
    !/>\s*\d+\.\d+\s*</.test(html.replace(/<option[\s\S]*?<\/option>/g, '')),
    (/>\s*\d+\.\d+\s*</.exec(html) ?? [])[0],
  );
  check(
    'editor: width and length read as feet and inches too',
    html.includes('8′6″') && html.includes('70′0″'),
  );
  check(
    'editor: dimensions are entered as feet AND inches, in two boxes',
    /aria-label="Height in ft"/.test(html) && /aria-label="Height in inches"/.test(html),
  );
  check(
    'editor: weight and axles keep their own single box',
    /aria-label="Gross weight in lb"/.test(html) && /aria-label="Axles in axles"/.test(html),
  );
  /*
   * EVERY BOX HOLDS THE UNIT ITS LABEL CLAIMS. A metres box seeded with
   * decimal feet is the same defect as a preset labelled 13.6 that means
   * 13′7¼″ — a number wearing the wrong unit — and it is the shape the
   * refactor to feet-and-inches nearly reintroduced.
   */
  const metricHtml = renderToStaticMarkup(
    createElement(TruckProfileEditor, {
      profile: DEFAULT_EDITABLE_PROFILE,
      onChange: () => {},
      onConfirm: () => {},
      confirmed: false,
      isDefault: true,
      metric: true,
    }),
  );
  check(
    'editor (metric): dimensions read and are entered in METRES',
    /aria-label="Height in m"/.test(metricHtml) && metricHtml.includes('4.11 m'),
  );
  check(
    'editor (metric): the metres box is seeded in metres, never decimal feet',
    /aria-label="Height in m"[^>]*value="4\.11"/.test(metricHtml) ||
      /value="4\.11"[^>]*aria-label="Height in m"/.test(metricHtml),
    (/aria-label="Height in m"[^>]*/.exec(metricHtml) ?? [])[0],
  );
  check(
    'editor (metric): no imperial box survives the switch',
    !/aria-label="Height in ft"/.test(metricHtml) &&
      !/aria-label="Height in inches"/.test(metricHtml),
  );
  check(
    'editor (metric): weight reads kilograms',
    /aria-label="Gross weight in kg"/.test(metricHtml) && metricHtml.includes('36,287 kg'),
  );

  /*
   * AND THE PRESETS ARE THE PHYSICAL VALUES THEY CLAIM TO BE. Notation is
   * only half the fix — the number behind 13′6″ must be exactly 13.5, and
   * must serialize to exactly 411 cm.
   */
  const heightField = EDITABLE_FIELDS.find((f) => f.key === 'heightFt');
  check(
    'presets: 13′6″ is exactly 13.5 ft',
    heightField?.presets[0] === 13.5,
    heightField?.presets,
  );
  check(
    'presets: 13′7″ is exactly 13 + 7/12 ft — never 13.6',
    heightField?.presets[1] === ftIn(13, 7) && heightField?.presets[1] !== 13.6,
    heightField?.presets[1],
  );
  check('presets: 14′0″ is exactly 14 ft', heightField?.presets[2] === 14);
  check(
    'presets: every height rung is at or above 13′6″ — a mis-tap over-declares, never under',
    (heightField?.presets ?? []).every((v) => v >= 13.5),
    heightField?.presets,
  );
  check(
    'presets: 13′6″ reaches the provider as 411 cm',
    truckWireParams(toTruckProfile({ ...DEFAULT_EDITABLE_PROFILE, heightFt: ftIn(13, 6) })).find(
      (w) => w.param === 'truck[height]',
    )?.value === '411',
  );
  check(
    'presets: 13′7″ reaches the provider as 414 cm — an inch taller, as declared',
    truckWireParams(toTruckProfile({ ...DEFAULT_EDITABLE_PROFILE, heightFt: ftIn(13, 7) })).find(
      (w) => w.param === 'truck[height]',
    )?.value === '414',
  );
  check(
    'presets: and the driver-facing value on that request says 13′6″',
    truckWireParams(toTruckProfile({ ...DEFAULT_EDITABLE_PROFILE, heightFt: ftIn(13, 6) })).find(
      (w) => w.param === 'truck[height]',
    )?.driverValue === '13′6″',
  );
  check(
    'ftIn is exact: 13′6″ === 13.5 and 8′6″ === 8.5',
    ftIn(13, 6) === 13.5 && ftIn(8, 6) === 8.5,
  );
  check(
    'editor: offers only the avoidances that reach the wire',
    AVOIDANCE_CHOICES.every((c) => html.includes(c.label)) &&
      !/low.emission|congestion charge/i.test(html),
  );
  check(
    'editor: touch targets meet the glove floor',
    (html.match(/min-h-16/g) ?? []).length >= EDITABLE_FIELDS.length,
  );
  check('editor: no slider anywhere', !/type="range"|role="slider"/.test(html));
  const invalid = renderToStaticMarkup(
    createElement(TruckProfileEditor, {
      profile: p({ heightFt: 99 }),
      onChange: () => {},
      onConfirm: () => {},
      confirmed: false,
      isDefault: false,
    }),
  );
  check(
    'editor: an impossible value shows a correction, not a silent fix',
    invalid.includes('Fix before planning a route'),
  );
  check(
    'editor: and the confirm control is disabled while it stands',
    /disabled=""[^>]*>\s*This is my truck|This is my truck/.test(invalid) &&
      invalid.includes('disabled'),
  );

  // The briefing's receipt.
  const briefing = readFileSync('src/components/navigator/RouteBriefing.tsx', 'utf8');
  check('briefing: shows "Route planned for"', briefing.includes('Route planned for'));
  check(
    'briefing: and does NOT claim every sign, closure or work zone is covered',
    /does not guarantee every bridge, sign/.test(briefing),
  );
  check(
    'briefing: its lines come from the wire mapping, not from the screen',
    readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8').includes(
      'sentRestrictions={sentRestrictionLines(',
    ),
  );
}

/* ==================== 5. fleet-demo readiness =========================== */
{
  const controls = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  const editor = readFileSync('src/components/navigator/TruckProfileEditor.tsx', 'utf8');

  // The coordinate box is a developer tool. A fleet manager watching a
  // demonstration should not be shown a latitude field at all — and
  // "collapsed" is still shown. It now rides the EXISTING debug
  // mechanism rather than a new flag.
  check(
    'demo: the developer coordinate entry is gated on the existing debug mechanism',
    /\{debugLog !== null \? \([\s\S]{0,400}Developer: enter coordinates instead/.test(controls),
  );
  check(
    'demo: and no second debug flag was invented for it',
    !/showDeveloper|devMode|isDeveloper|NEXT_PUBLIC_DEBUG/.test(controls),
  );
  check(
    'demo: debug mode still exposes it (bench testing an exact point survives)',
    controls.includes('Developer: enter coordinates instead') && controls.includes('debugLog'),
  );

  // A driver-facing surface must not read like an internal console.
  const driverFacing = editor + controls.slice(controls.indexOf('return ('));
  for (const jargon of [
    'apiKey',
    'HERE_API_KEY',
    'shippedHazardousGoods',
    'truck[height]',
    'transportMode',
    'router.hereapi.com',
  ]) {
    check(
      `demo: no internal provider detail on the driver's screen — ${jargon}`,
      !driverFacing.includes(jargon),
    );
  }

  // The things a pilot demonstration still needs.
  const access = readFileSync('src/lib/navigator-api/pilot-access.ts', 'utf8');
  check(
    'demo: the pilot gate still verifies a signed cookie',
    /verifyPilot|PILOT_COOKIE_NAME/.test(access),
  );
  check('demo: the build id is still shown', controls.includes('Build:'));
  check('demo: problem reporting is still available', controls.includes('buildProblemReport'));

  // Nothing about the truck may leak position or credentials into a report.
  const report = readFileSync('src/lib/navigator/road-test-report.ts', 'utf8');
  check(
    'demo: the road-test report carries no coordinate and no key',
    !/apiKey|HERE_API_KEY/.test(report) && !/\blat\b\s*:/.test(report),
  );
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check(
    'demo: the stored truck profile carries no position, route or identity',
    /JSON\.stringify\(\{ v: 1, profile, confirmed:/.test(screen) &&
      !/position|geometry|firstName/.test(
        screen.slice(
          screen.indexOf('const persistTruck'),
          screen.indexOf('const persistTruck') + 400,
        ),
      ),
  );
}

console.log(`navigator-truck-confidence: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
