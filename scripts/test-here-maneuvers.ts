/**
 * Navigator milestone N1: parseHereResponse retains full maneuver objects.
 *
 * Fixture-based parse tests only — no network, no API key. The acceptance
 * criterion for N1 is that the new `maneuvers` field is purely additive:
 * meters/seconds/positions/instructions must be byte-for-byte what the
 * pre-N1 parser produced for the same payloads, malformed routes still
 * return null, and malformed action entries are skipped with the same
 * leniency the instruction list has always had.
 *
 * Run:
 *   npx esbuild scripts/test-here-maneuvers.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-here-maneuvers.cjs && node /tmp/test-here-maneuvers.cjs
 */
import { parseHereResponse, type HereManeuver } from '@/lib/trip-planner/here-routing';
import { encodeTestPolyline } from './helpers/flexible-polyline-encode';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** Build a HERE-shaped response from per-section specs. */
function hereResponse(
  sections: {
    lengthM: number;
    durationS: number;
    coords: [number, number][];
    actions?: unknown[];
  }[],
) {
  return {
    routes: [
      {
        sections: sections.map((s) => ({
          summary: { length: s.lengthM, duration: s.durationS },
          polyline: s.coords.length ? encodeTestPolyline(s.coords) : undefined,
          actions: s.actions,
        })),
      },
    ],
  };
}

const A = (over: Record<string, unknown> = {}) => ({
  action: 'turn',
  instruction: 'Turn right onto Watt Road.',
  direction: 'right',
  severity: 'quite',
  offset: 1,
  length: 320,
  duration: 45,
  ...over,
});

// ------------------------------------------------------------ happy path
{
  const parsed = parseHereResponse(
    hereResponse([
      {
        lengthM: 5000,
        durationS: 300,
        coords: [
          [35.0, -84.0],
          [35.1, -84.1],
          [35.2, -84.2],
        ],
        actions: [
          A({ action: 'depart', instruction: 'Head north.', offset: 0, direction: undefined }),
          A(),
          A({ action: 'arrive', instruction: 'Arrive.', offset: 2, severity: undefined }),
        ],
      },
    ]),
  );
  check('happy: parses', parsed !== null);
  if (parsed) {
    check('happy: 3 maneuvers', parsed.maneuvers.length === 3, parsed.maneuvers.length);
    check('happy: instructions unchanged alongside', parsed.instructions.length === 3);
    const [m0, m1, m2] = parsed.maneuvers;
    check(
      'happy: action kinds',
      m0.action === 'depart' && m1.action === 'turn' && m2.action === 'arrive',
    );
    check(
      'happy: offsets verbatim in single section',
      m0.offset === 0 && m1.offset === 1 && m2.offset === 2,
    );
    check('happy: direction null when absent', m0.direction === null && m1.direction === 'right');
    check('happy: severity null when absent', m2.severity === null && m1.severity === 'quite');
    check('happy: length/duration retained', m1.lengthM === 320 && m1.durationS === 45);
  }
}

// ------------------------------------------------- multi-section rebase
{
  const parsed = parseHereResponse(
    hereResponse([
      {
        lengthM: 1000,
        durationS: 60,
        coords: [
          [35.0, -84.0],
          [35.01, -84.01],
        ],
        actions: [A({ action: 'depart', instruction: 'Go.', offset: 0 })],
      },
      {
        lengthM: 2000,
        durationS: 120,
        coords: [
          [35.02, -84.02],
          [35.03, -84.03],
          [35.04, -84.04],
        ],
        actions: [A({ action: 'turn', instruction: 'Turn.', offset: 1 })],
      },
    ]),
  );
  check('rebase: parses', parsed !== null);
  if (parsed) {
    check('rebase: 5 concatenated positions', parsed.positions.length === 5);
    check(
      'rebase: second-section offset rebased past first section geometry',
      parsed.maneuvers[1].offset === 2 + 1,
      parsed.maneuvers.map((m: HereManeuver) => m.offset),
    );
  }
}

// -------------------------------------------------- malformed leniency
{
  const parsed = parseHereResponse(
    hereResponse([
      {
        lengthM: 5000,
        durationS: 300,
        coords: [
          [35.0, -84.0],
          [35.2, -84.2],
        ],
        actions: [
          A(),
          { instruction: 'No action kind — display only.' },
          { action: 'turn' }, // no instruction: neither list
          A({ offset: -4 }), // negative offset -> section start
          A({ offset: 'x' }), // non-numeric offset -> section start
          A({ offset: 999 }), // beyond geometry -> clamped to last point
          { action: 42, instruction: 'Numeric action kind.' }, // display only
          null, // tolerated by the actions loop shape
        ].filter((x) => x !== null),
      },
    ]),
  );
  check('leniency: parses despite malformed entries', parsed !== null);
  if (parsed) {
    check(
      'leniency: display instructions keep instruction-only entries',
      parsed.instructions.length === 6,
      parsed.instructions.length,
    );
    check(
      'leniency: maneuvers keep only well-formed entries',
      parsed.maneuvers.length === 4,
      parsed.maneuvers.length,
    );
    check(
      'leniency: bad offsets default to section start',
      parsed.maneuvers[1].offset === 0 && parsed.maneuvers[2].offset === 0,
    );
    check(
      'leniency: oversized offset clamped to last position index',
      parsed.maneuvers[3].offset === parsed.positions.length - 1,
      parsed.maneuvers[3].offset,
    );
  }
}

// ------------------------------------------------------ parity + nulls
{
  const legacyShape = hereResponse([
    {
      lengthM: 5000,
      durationS: 300,
      coords: [
        [35.0, -84.0],
        [35.2, -84.2],
      ],
      actions: [{ instruction: 'Old-shape instruction.' }],
    },
  ]);
  const parsed = parseHereResponse(legacyShape);
  check('parity: legacy instruction-only payload still parses', parsed !== null);
  if (parsed) {
    check('parity: meters/seconds unchanged', parsed.meters === 5000 && parsed.seconds === 300);
    check('parity: instructions preserved', parsed.instructions[0] === 'Old-shape instruction.');
    check('parity: maneuvers empty rather than invented', parsed.maneuvers.length === 0);
  }

  check('null: no routes', parseHereResponse({}) === null);
  check('null: empty sections', parseHereResponse({ routes: [{ sections: [] }] }) === null);
  check(
    'null: negative summary still rejects the whole route',
    parseHereResponse(
      hereResponse([
        {
          lengthM: -1,
          durationS: 300,
          coords: [
            [35, -84],
            [35.1, -84.1],
          ],
        },
      ]),
    ) === null,
  );
  check(
    'null: undecodable polyline still rejects the whole route',
    parseHereResponse({
      routes: [
        {
          sections: [
            {
              summary: { length: 10, duration: 10 },
              polyline: '!!!not-a-polyline!!!',
              actions: [A()],
            },
          ],
        },
      ],
    }) === null,
  );
}

// -------------------------------------------------------- maneuver cap
{
  const actions = Array.from({ length: 1200 }, (_, i) =>
    A({ instruction: `Turn ${i}.`, offset: 0 }),
  );
  const parsed = parseHereResponse(
    hereResponse([
      {
        lengthM: 5000,
        durationS: 300,
        coords: [
          [35.0, -84.0],
          [35.2, -84.2],
        ],
        actions,
      },
    ]),
  );
  check('cap: parses', parsed !== null);
  if (parsed) {
    check(
      'cap: maneuvers bounded at 1000 (defense, not truncation policy)',
      parsed.maneuvers.length === 1000,
    );
    check(
      'cap: display instructions keep their own historical cap',
      parsed.instructions.length === 60,
    );
  }
}

console.log(`here-maneuvers: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
