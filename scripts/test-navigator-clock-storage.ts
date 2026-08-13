/**
 * Driver-entered clocks in storage — behaviour against a real store.
 *
 * `test-navigator-hos-clocks` proves the CONVERSION (remaining ⇄ engine)
 * over a swept range. This proves what happens to those values on the way
 * to disk and back, which is where the milestone's sharpest promise
 * lives: a returning driver is never handed a fresh eleven hours, and a
 * damaged clock record costs the clocks and NOTHING ELSE.
 *
 * Covers required proof cases 9, 10, 11 and 12.
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-clock-storage
 */
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

class MemoryStorage {
  private map = new Map<string, string>();
  hostile = false;
  getItem(key: string): string | null {
    if (this.hostile) throw new Error('storage disabled');
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.hostile) throw new Error('quota exceeded');
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    if (this.hostile) throw new Error('storage disabled');
    this.map.delete(key);
  }
  plant(key: string, raw: string): void {
    this.map.set(key, raw);
  }
  raw(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  clearAll(): void {
    this.map.clear();
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: local,
  sessionStorage: session,
};
(globalThis as unknown as { localStorage: unknown }).localStorage = local;
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = session;

/* eslint-disable @typescript-eslint/no-var-requires */
const { CLOCKS_KEY, clearClocks, readClocks, writeClocks } =
  require('@/components/navigator/clocks-storage') as typeof import('@/components/navigator/clocks-storage');
const { TRUCK_PROFILE_KEY, readTruck, writeTruck } =
  require('@/components/navigator/truck-storage') as typeof import('@/components/navigator/truck-storage');
const { engineStateFor, freshShiftClocks, fromEngineClockState } =
  require('@/lib/navigator/hos-clocks') as typeof import('@/lib/navigator/hos-clocks');
type DriverEnteredClocks = import('@/lib/navigator/hos-clocks').DriverEnteredClocks;
const { confirmProfile, DEFAULT_EDITABLE_PROFILE } =
  require('@/lib/navigator/truck-profile') as typeof import('@/lib/navigator/truck-profile');
/* eslint-enable @typescript-eslint/no-var-requires */

const NOW = 1_754_000_000_000;
const MID_SHIFT: DriverEnteredClocks = {
  drivingMin: 305,
  windowMin: 470,
  untilBreakMin: 185,
  cycleMin: 1_325,
  cycleRule: '70/8',
};

/* ===================================================================== */
/* CASE 9: a returning driver is NOT given fresh clocks                   */
/* ===================================================================== */
{
  local.clearAll();
  const first = readClocks();
  check('9. a first-time driver reads UNSET', first.kind === 'unset', first);
  check('9. and unset yields no engine state at all', engineStateFor(first, NOW) === null);

  // The dangerous near-miss: a returning driver with an empty store must
  // get the same answer, not a convenient default.
  local.plant('tlws-navigator-driver-v1', '{"v":1,"firstName":"Shawn"}');
  local.plant(
    TRUCK_PROFILE_KEY,
    JSON.stringify({ v: 1, profile: DEFAULT_EDITABLE_PROFILE, confirmed: null }),
  );
  const returning = readClocks();
  check(
    '9. a RETURNING driver with a saved name and truck still reads UNSET',
    returning.kind === 'unset',
    returning,
  );
  check('9. nothing wrote a clock record as a side effect', local.raw(CLOCKS_KEY) === null);
}

/* ===================================================================== */
/* CASE 10: partial clocks restore EXACTLY after a reload                 */
/* ===================================================================== */
{
  local.clearAll();
  writeClocks({ kind: 'set', entered: MID_SHIFT, enteredAtMs: NOW, fromFreshShift: false });

  // A "reload" is a fresh read against the same store.
  const back = readClocks();
  check('10. the record survives', back.kind === 'set');
  if (back.kind === 'set') {
    check(
      '10. every entered minute returns EXACTLY, not rounded',
      back.entered.drivingMin === 305 &&
        back.entered.windowMin === 470 &&
        back.entered.untilBreakMin === 185 &&
        back.entered.cycleMin === 1_325 &&
        back.entered.cycleRule === '70/8',
      back.entered,
    );
    check('10. and the entry timestamp survives', back.enteredAtMs === NOW);
    check('10. it is not marked as a fresh shift', back.fromFreshShift === false);
    // Through the engine and back, after a reload — the full loop a
    // driver's numbers actually take.
    const roundTripped = fromEngineClockState(engineStateFor(back, NOW)!);
    check(
      '10. and they survive the trip through the engine too',
      JSON.stringify(roundTripped) === JSON.stringify(MID_SHIFT),
      { roundTripped, MID_SHIFT },
    );
  }

  // An edit REPLACES rather than merges: every field differs, and every
  // field must land, with nothing stale left behind from the old record.
  const LATER: DriverEnteredClocks = {
    drivingMin: 200,
    windowMin: 300,
    untilBreakMin: 100,
    cycleMin: 900,
    cycleRule: '70/8',
  };
  writeClocks({ kind: 'set', entered: LATER, enteredAtMs: NOW + 60_000, fromFreshShift: false });
  const afterEdit = readClocks();
  check(
    '10. an edit replaces the record rather than merging into it',
    afterEdit.kind === 'set' && JSON.stringify(afterEdit.entered) === JSON.stringify(LATER),
    afterEdit,
  );
  check(
    '10. and the edit carries its own timestamp',
    afterEdit.kind === 'set' && afterEdit.enteredAtMs === NOW + 60_000,
  );

  /*
   * The read is the trust boundary, not the write. `writeClocks` stores
   * what it is handed — the editor validates before calling — so the
   * guarantee that matters is that an IMPOSSIBLE record cannot be read
   * back as truth no matter how it got there (a half-write, a hand edit,
   * an older build with a looser rule).
   *
   * This exact shape is the one that caught a bad fixture while this
   * harness was being written: 120 minutes of driving left means 540
   * used, which cannot fit inside the 370 minutes of window that
   * 470-remaining implies. The 14-hour window does not pause.
   */
  const impossible = { ...MID_SHIFT, drivingMin: 120 };
  writeClocks({ kind: 'set', entered: impossible, enteredAtMs: NOW, fromFreshShift: false });
  check(
    '10. an impossible record reads back UNSET, never repaired into something plausible',
    readClocks().kind === 'unset',
    readClocks(),
  );
}

/* ===================================================================== */
/* CASE 11: fresh shift only via the explicit, confirmed path             */
/* ===================================================================== */
{
  local.clearAll();
  check('11. nothing is stored until the driver acts', readClocks().kind === 'unset');

  writeClocks({
    kind: 'set',
    entered: freshShiftClocks('70/8'),
    enteredAtMs: NOW,
    fromFreshShift: true,
  });
  const fresh = readClocks();
  check('11. a confirmed fresh shift stores full clocks', fresh.kind === 'set');
  if (fresh.kind === 'set') {
    check(
      '11. full means what the ENGINE means by full',
      fresh.entered.drivingMin === 660 &&
        fresh.entered.windowMin === 840 &&
        fresh.entered.untilBreakMin === 480 &&
        fresh.entered.cycleMin === 4_200,
      fresh.entered,
    );
    check('11. and the record says it came from that choice', fresh.fromFreshShift === true);
  }
  // The provenance flag is what lets the screen tell "I chose full" from
  // "I typed 11:00", which are different claims.
  writeClocks({
    kind: 'set',
    entered: freshShiftClocks('70/8'),
    enteredAtMs: NOW,
    fromFreshShift: false,
  });
  const typed = readClocks();
  check(
    '11. identical values typed by hand are NOT marked as a fresh shift',
    typed.kind === 'set' && typed.fromFreshShift === false,
  );
}

/* ===================================================================== */
/* CASE 12: corrupt clocks destroy nothing else                           */
/* ===================================================================== */
{
  const corrupt: [string, string][] = [
    ['not JSON', 'wat'],
    ['not an object', '"clocks"'],
    ['null', 'null'],
    ['missing version', '{"entered":{}}'],
    ['wrong version', '{"v":9,"entered":{}}'],
    ['missing entered', '{"v":1,"enteredAtMs":1}'],
    ['non-numeric minutes', '{"v":1,"entered":{"drivingMin":"lots"},"enteredAtMs":1}'],
    [
      'unknown cycle rule',
      '{"v":1,"entered":{"drivingMin":60,"windowMin":60,"untilBreakMin":60,"cycleMin":60,"cycleRule":"80/9"},"enteredAtMs":1}',
    ],
    [
      'out of range for its own rule',
      '{"v":1,"entered":{"drivingMin":9999,"windowMin":840,"untilBreakMin":480,"cycleMin":4200,"cycleRule":"70/8"},"enteredAtMs":1}',
    ],
    [
      'impossible: drove more than the window was open',
      '{"v":1,"entered":{"drivingMin":600,"windowMin":840,"untilBreakMin":420,"cycleMin":4200,"cycleRule":"70/8"},"enteredAtMs":1}',
    ],
    [
      'missing timestamp',
      '{"v":1,"entered":{"drivingMin":60,"windowMin":60,"untilBreakMin":60,"cycleMin":60,"cycleRule":"70/8"}}',
    ],
  ];

  for (const [label, raw] of corrupt) {
    local.clearAll();
    // A VALID truck and a VALID name sit beside the damaged clocks.
    writeTruck(DEFAULT_EDITABLE_PROFILE, confirmProfile(DEFAULT_EDITABLE_PROFILE));
    local.plant('tlws-navigator-driver-v1', '{"v":1,"firstName":"Shawn"}');
    session.plant('tlws-navigator-trip-v1', '{"v":1,"savedAtMs":123}');
    local.plant(CLOCKS_KEY, raw);

    let threw = false;
    let clocks;
    try {
      clocks = readClocks();
    } catch {
      threw = true;
    }
    check(`12. corrupt clocks (${label}): reading does not throw`, !threw);
    check(
      `12. corrupt clocks (${label}): yield UNSET, never a fresh driver`,
      clocks?.kind === 'unset',
      clocks,
    );
    // The whole point: the other records are untouched.
    const truck = readTruck();
    check(
      `12. corrupt clocks (${label}): the confirmed truck SURVIVES`,
      truck !== null && truck.confirmation.confirmedFingerprint !== null,
      truck,
    );
    check(
      `12. corrupt clocks (${label}): the trip snapshot survives`,
      session.raw('tlws-navigator-trip-v1') !== null,
    );
    check(
      `12. corrupt clocks (${label}): the saved name survives`,
      local.raw('tlws-navigator-driver-v1') !== null,
    );
  }

  // And the reverse: a corrupt TRUCK must not cost the clocks.
  local.clearAll();
  writeClocks({ kind: 'set', entered: MID_SHIFT, enteredAtMs: NOW, fromFreshShift: false });
  local.plant(TRUCK_PROFILE_KEY, 'CORRUPT');
  check('12. a corrupt truck record yields no truck', readTruck() === null);
  check('12. and the clocks survive it', readClocks().kind === 'set');

  // Storage that throws on every call is the same answer, both ways.
  local.clearAll();
  local.hostile = true;
  let threw = false;
  try {
    writeClocks({ kind: 'set', entered: MID_SHIFT, enteredAtMs: NOW, fromFreshShift: false });
    check('12. hostile storage reads UNSET', readClocks().kind === 'unset');
    clearClocks();
  } catch {
    threw = true;
  }
  local.hostile = false;
  check('12. hostile storage never throws into the render path', !threw);
}

/* ===================================================================== */
/* Clearing is explicit and local                                         */
/* ===================================================================== */
{
  local.clearAll();
  writeTruck(DEFAULT_EDITABLE_PROFILE, confirmProfile(DEFAULT_EDITABLE_PROFILE));
  writeClocks({ kind: 'set', entered: MID_SHIFT, enteredAtMs: NOW, fromFreshShift: false });
  clearClocks();
  check('clear: the clocks are gone', readClocks().kind === 'unset');
  check('clear: and the truck is not', readTruck() !== null);
  check('clear: the record itself is removed', local.raw(CLOCKS_KEY) === null);

  // Saving an unset state is the same as clearing — no empty record.
  writeClocks({ kind: 'set', entered: MID_SHIFT, enteredAtMs: NOW, fromFreshShift: false });
  writeClocks({ kind: 'unset' });
  check(
    'clear: saving UNSET removes the record rather than storing a blank',
    local.raw(CLOCKS_KEY) === null,
  );
}

console.log(`navigator-clock-storage: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
