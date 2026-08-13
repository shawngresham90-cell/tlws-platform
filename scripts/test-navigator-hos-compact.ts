/**
 * Compact HOS + truck summary (pilot round 3) — behavioral harness.
 *
 * PR #304 gave the map the whole driving screen and the 230 px HOS card
 * yielded to it: clocks kept counting and the HOS voice kept firing, but
 * the driver could no longer SEE them. This pins the compact strip that
 * brings them back, that the truck profile now shows ONCE (parked panel;
 * the final milestone removed the cockpit chip that repeated it over the
 * live map), and — the part that matters most — that none of it
 * introduced a second HOS authority or a silent clock reset.
 *
 * What it pins:
 *   1. the pure compact view: four labelled clocks, values from the
 *      engine, the LIMITING clock taken from the engine's own
 *      `limitedBy` (never re-sorted here), severity from the shipped
 *      thresholds, unknown values labelled and never invented
 *   2. severity carried by WORDS, not color alone
 *   3. the rendered strip: labels beside numbers, the planning-aid
 *      disclaimer, the limiting marker, a 64 px tap target, no animation
 *   4. one HosStrip instance owns clocks + tick + voice; the compact and
 *      detailed presentations are the same instance (no restart when
 *      guidance starts, reroutes, or ends)
 *   5. clock persistence across a reload: strict validation, optional
 *      field (an older snapshot still restores its trip), damaged clocks
 *      lose the clocks and never the trip, and a restored state is
 *      applied exactly once
 *   6. the detailed clocks open behind the EXISTING stationary-only gate
 *      while the compact strip stays readable while moving
 *   7. the truck profile is shown ONCE, on the parked page — the docked
 *      cockpit chip is gone (final pilot milestone) and no profile
 *      overlay rides the live map
 *   8. the detailed truck panel still exists for the parked page
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-hos-compact
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { freshClockState, remainingClocks } from '@/lib/trip-planner/hos-engine';
import type { ClockState } from '@/lib/trip-planner/types';
import { clockSeverity, formatHM, CRITICAL_MIN, WARNING_MIN } from '@/lib/navigator/hos-strip';
import {
  cellStateWord,
  hosCompactView,
  hosCompactViewFrom,
  type HosCompactView,
} from '@/lib/navigator/hos-compact';
import { HosCompactStrip, HOS_PLANNING_AID } from '@/components/navigator/HosCompactStrip';
import { HosStrip } from '@/components/navigator/HosStrip';
import { TruckProfilePanel } from '@/components/navigator/TruckProfilePanel';
import {
  parseClockState,
  parseTripSnapshot,
  serializeTripSnapshot,
} from '@/lib/navigator/trip-restore';
import { DEFAULT_TRUCK_PROFILE } from '@/lib/trip-planner/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(
      `FAIL: ${name}${detail === undefined ? '' : ` — ${String(JSON.stringify(detail)).slice(0, 200)}`}`,
    );
  }
}

const T0 = 1_754_000_000_000;
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
const HOS_COMPONENT = readFileSync('src/components/navigator/HosStrip.tsx', 'utf8');
const COMPACT_COMPONENT = readFileSync('src/components/navigator/HosCompactStrip.tsx', 'utf8');
const COMPACT_CORE = readFileSync('src/lib/navigator/hos-compact.ts', 'utf8');

/** A clock state with the four clocks at chosen remaining minutes. */
function clocksWith(over: Partial<ClockState>): ClockState {
  return { ...freshClockState(T0), ...over };
}

/* ============================ 1. the pure view ========================== */
{
  const fresh = hosCompactView(freshClockState(T0));
  check(
    'view: four cells, in a fixed order, all labelled',
    fresh.cells.map((c) => c.label).join(',') === 'DRIVE,WINDOW,CYCLE,BREAK',
    fresh.cells.map((c) => c.label),
  );
  check(
    'view: fresh driver reads 11:00 / 14:00 / 70:00 / 8:00',
    fresh.cells[0].text === '11:00' &&
      fresh.cells[1].text === '14:00' &&
      fresh.cells[2].text === '70:00' &&
      fresh.cells[3].text === '8:00',
    fresh.cells.map((c) => c.text),
  );
  // The numbers must be the ENGINE's, not this module's arithmetic.
  const remaining = remainingClocks(freshClockState(T0));
  check(
    'view: every value is the engine value, formatted — nothing recomputed',
    fresh.cells[0].text === formatHM(remaining.drivingMin) &&
      fresh.cells[1].text === formatHM(remaining.windowMin) &&
      fresh.cells[2].text === formatHM(remaining.cycleMin) &&
      fresh.cells[3].text === formatHM(remaining.untilBreakMin),
  );
  check(
    'view: the compact core imports the engine and never re-implements a rule',
    COMPACT_CORE.includes("from '@/lib/trip-planner/hos-engine'") &&
      !/MAX_DRIVING_MIN|MAX_WINDOW_MIN|BREAK_AFTER_DRIVING_MIN|cycleCapMin/.test(COMPACT_CORE),
  );
}

/* ================== 2. the limiting clock is the engine's ================ */
{
  // Break binds first for a fresh driver who has been driving 7:45.
  const breakBinding = clocksWith({ drivingSinceBreakMin: 465 });
  const v = hosCompactView(breakBinding);
  check(
    'limiting: BREAK is marked when the break clock binds',
    v.limitingKey === 'break' && v.cells.find((c) => c.key === 'break')?.limiting === true,
    v.limitingKey,
  );
  check(
    'limiting: exactly ONE cell is ever marked',
    v.cells.filter((c) => c.limiting).length === 1,
  );
  // Drive binds when the driving clock is lowest.
  const driveBinding = clocksWith({ drivingUsedMin: 650, drivingSinceBreakMin: 0 });
  check(
    'limiting: DRIVE is marked when driving binds',
    hosCompactView(driveBinding).limitingKey === 'drive',
  );
  // The marker must agree with the engine on every case we try.
  for (const c of [breakBinding, driveBinding, freshClockState(T0)]) {
    const engine = remainingClocks(c);
    const map: Record<string, string> = {
      '11-hour': 'drive',
      '14-hour': 'window',
      '30-minute-break': 'break',
      cycle: 'cycle',
    };
    check(
      `limiting: agrees with the engine's own limitedBy (${engine.limitedBy})`,
      hosCompactView(c).limitingKey === map[engine.limitedBy],
    );
  }
  check(
    'limiting: the core reads limitedBy rather than sorting clocks itself',
    COMPACT_CORE.includes('LIMITED_BY_TO_KEY') && !/\.sort\(/.test(COMPACT_CORE),
  );
}

/* ============ 3. severity in words, from the shipped thresholds ========== */
{
  const warn = hosCompactViewFrom({
    drivingMin: WARNING_MIN,
    windowMin: 600,
    untilBreakMin: 400,
    cycleMin: 3000,
    limitedBy: '11-hour',
    legalDrivingMin: WARNING_MIN,
  });
  const driveCell = warn.cells[0];
  check(
    'severity: a warning clock reads LOW in words',
    driveCell.state === 'low' && cellStateWord('low') === 'LOW',
  );
  const crit = hosCompactViewFrom({
    drivingMin: CRITICAL_MIN,
    windowMin: 600,
    untilBreakMin: 400,
    cycleMin: 3000,
    limitedBy: '11-hour',
    legalDrivingMin: CRITICAL_MIN,
  });
  check('severity: a critical clock reads URGENT', crit.cells[0].state === 'urgent');
  const over = hosCompactViewFrom({
    drivingMin: 0,
    windowMin: 600,
    untilBreakMin: 400,
    cycleMin: 3000,
    limitedBy: '11-hour',
    legalDrivingMin: 0,
  });
  check('severity: a spent clock reads OVER, not a louder URGENT', over.cells[0].state === 'over');
  check(
    'severity: thresholds are the SHIPPED ones (clockSeverity), not new numbers',
    clockSeverity(WARNING_MIN) === 'warning' &&
      clockSeverity(CRITICAL_MIN) === 'critical' &&
      COMPACT_CORE.includes('clockSeverity'),
  );
  check(
    'severity: every non-calm state has a WORD (never color alone)',
    cellStateWord('soon') === 'SOON' &&
      cellStateWord('low') === 'LOW' &&
      cellStateWord('urgent') === 'URGENT' &&
      cellStateWord('over') === 'OVER' &&
      cellStateWord('ok') === '',
  );
}

/* ==================== 4. unknown clocks are never invented =============== */
{
  const unknown = hosCompactViewFrom({
    drivingMin: Number.NaN,
    windowMin: 600,
    untilBreakMin: 400,
    cycleMin: 3000,
    limitedBy: '14-hour',
    legalDrivingMin: 600,
  });
  const cell = unknown.cells[0];
  check(
    'unknown: a non-finite clock has no minutes and no text',
    cell.minutes === null && cell.text === null,
  );
  check('unknown: it is never rendered as zero', cell.text !== '0:00');
  check('unknown: the accessible sentence says unknown', /unknown/.test(cell.spoken), cell.spoken);
}

/* ========================= 5. the rendered strip ======================== */
{
  const view: HosCompactView = hosCompactView(clocksWith({ drivingSinceBreakMin: 465 }));
  const html = renderToStaticMarkup(createElement(HosCompactStrip, { view, onOpen: () => {} }));
  check(
    'render: every clock shows its LABEL beside the number',
    ['DRIVE', 'WINDOW', 'CYCLE', 'BREAK'].every((l) => html.includes(l)),
  );
  check(
    'render: the planning-aid disclaimer rides with the clocks',
    html.includes(HOS_PLANNING_AID),
  );
  check(
    'render: the disclaimer does not claim to be an ELD',
    /not an ELD/i.test(HOS_PLANNING_AID) && !/\bis an ELD\b/i.test(html),
  );
  check('render: the limiting clock is marked', html.includes('Limiting clock'));
  check(
    'render: each cell carries its full meaning for assistive tech',
    html.includes('driving time left') && html.includes('on-duty window left'),
  );
  check('render: the tap target is the 64px glove floor', html.includes('min-h-16'));
  check(
    'render: values sit at or above the 18px drive floor',
    /clamp\(18px/.test(COMPACT_COMPONENT) && !/text-(?:xs|sm)\b/.test(COMPACT_COMPONENT),
  );
  check(
    'render: no animation on the moving surface',
    !/animate-|transition-|motion-safe:/.test(COMPACT_COMPONENT),
  );
  check(
    'render: the strip computes nothing — presentation only',
    !/remainingClocks|advance\(|Date\.now/.test(COMPACT_COMPONENT),
  );
  // Non-interactive (moving, gate closed) still READS the same.
  const readOnly = renderToStaticMarkup(
    createElement(HosCompactStrip, { view, interactive: false }),
  );
  check(
    'render: locked/non-interactive still shows every clock',
    ['DRIVE', 'WINDOW', 'CYCLE', 'BREAK'].every((l) => readOnly.includes(l)) &&
      !readOnly.includes('<button'),
  );
}

/* ============ 6. ONE instance owns clocks, tick and the voice ============ */
{
  const compactHtml = renderToStaticMarkup(
    createElement(HosStrip, {
      drivingActive: true,
      sourceLabel: 'Pilot trip loaded',
      compact: true,
    }),
  );
  check(
    'strip: compact mode renders the four-clock strip',
    compactHtml.includes('DRIVE') && compactHtml.includes('BREAK'),
  );
  const fullHtml = renderToStaticMarkup(
    createElement(HosStrip, { drivingActive: false, sourceLabel: 'No trip loaded' }),
  );
  check(
    'strip: parked mode still renders the detailed card, now with all four clocks',
    fullHtml.includes('Drive time left') &&
      fullHtml.includes('On-duty window left') &&
      fullHtml.includes('Cycle time left') &&
      fullHtml.includes('Until 30-minute break'),
  );
  check('strip: the detailed card carries the disclaimer too', fullHtml.includes(HOS_PLANNING_AID));
  check(
    'wiring: the driving screen mounts exactly ONE HosStrip for both presentations',
    (SCREEN.match(/<HosStrip/g) ?? []).length === 1 && /compact=\{fullScreen\}/.test(SCREEN),
  );
  check(
    'wiring: the strip is never conditionally unmounted (clocks cannot restart)',
    !/\{[^}]*&&\s*<HosStrip/.test(strip(SCREEN)),
  );
  const comp = strip(HOS_COMPONENT);
  check('wiring: the 60 s advance still lives in the one strip', comp.includes('HOS_TICK_MS'));
  check(
    'wiring: the HOS voice announcer still lives in the one strip',
    comp.includes('createHosAnnouncer'),
  );
  check(
    'wiring: voice collection is unchanged — same announcer, same collect call',
    /announcerRef\.current\.collect\(view\.warning, view\.remaining\)/.test(comp),
  );
  check('wiring: interval still cleared on unmount', /clearInterval\(tick\)/.test(comp));
  check(
    'wiring: the strip itself touches no storage/fetch/console',
    !/localStorage|sessionStorage|indexedDB|\bfetch\s*\(|console\./.test(comp),
  );
}

/* ================= 7. the detail opens behind the shipped gate =========== */
{
  check(
    'gate: the cockpit detail is wrapped in a LockGate on an EXISTING action',
    /<LockGate action="view-trip-summary" lockedLabel="Detailed clocks"/.test(SCREEN),
  );
  const actions = readFileSync('src/lib/navigator/actions.ts', 'utf8');
  check(
    'gate: that action is stationary-only in the shared map (no new permission)',
    /'view-trip-summary':\s*false/.test(actions),
  );
  check(
    'gate: the compact strip itself never inspects motion (doc 06 §1)',
    !/speedMph|motion ===|locked/.test(COMPACT_COMPONENT),
  );
  check(
    'gate: the gate only appears on an attempt — nothing permanent in the cockpit',
    /detail === null \? null :/.test(SCREEN),
  );
}

/* ================ 8. clocks survive a reload (no silent reset) =========== */
{
  const clocks = clocksWith({
    drivingUsedMin: 300,
    drivingSinceBreakMin: 120,
    windowElapsedMin: 400,
  });
  const snapshot = serializeTripSnapshot({
    route: {
      kind: 'route',
      routeId: 'r1',
      positions: [
        { lat: 35, lng: -85 },
        { lat: 35.1, lng: -85 },
      ],
      distanceMiles: 7,
      durationSeconds: 600,
      maneuvers: [{ action: 'depart', instruction: 'Go.', direction: null, offset: 0 }],
      validationState: 'valid',
      warnings: [],
    },
    request: {
      origin: { lat: 35, lng: -85 },
      destination: { lat: 35.1, lng: -85 },
      truck: DEFAULT_TRUCK_PROFILE,
      departAtMs: T0,
    },
    destination: {
      position: { lat: 35.1, lng: -85 },
      facility: 'warehouse',
      positionSource: 'unknown',
    },
    savedAtMs: T0,
    clocks,
  });
  const parsed = parseTripSnapshot(snapshot, T0 + 1000);
  check(
    'reload: the snapshot round-trips the clocks',
    parsed !== null && parsed.clocks !== undefined,
  );
  check(
    'reload: every counter comes back exactly, not approximately',
    parsed?.clocks?.drivingUsedMin === 300 &&
      parsed?.clocks?.drivingSinceBreakMin === 120 &&
      parsed?.clocks?.windowElapsedMin === 400 &&
      parsed?.clocks?.cycleRule === clocks.cycleRule,
    parsed?.clocks,
  );
  check(
    'reload: the restored clocks show the SAME remaining time as before the reload',
    parsed?.clocks !== undefined &&
      hosCompactView(parsed.clocks).cells[0].text === hosCompactView(clocks).cells[0].text,
  );
  // Backwards compatibility: a snapshot written before this change.
  const older = JSON.parse(snapshot) as Record<string, unknown>;
  delete older.clocks;
  const parsedOld = parseTripSnapshot(JSON.stringify(older), T0 + 1000);
  check(
    'reload: a snapshot with no clocks still restores its TRIP (no deploy-time stranding)',
    parsedOld !== null && parsedOld.clocks === undefined,
  );
  // Damaged clocks lose the clocks, never the trip.
  const damaged = JSON.parse(snapshot) as Record<string, unknown>;
  damaged.clocks = { ...(damaged.clocks as object), drivingUsedMin: 'lots' };
  const parsedDamaged = parseTripSnapshot(JSON.stringify(damaged), T0 + 1000);
  check(
    'reload: damaged clocks are dropped and the trip still restores',
    parsedDamaged !== null && parsedDamaged.clocks === undefined,
  );
  // Strict validation of the clock shape itself.
  check('reload: a non-object clock state is refused', parseClockState('11:00') === null);
  check(
    'reload: an unknown cycle rule is refused, never coerced',
    parseClockState({ ...clocks, cycleRule: '80/9' }) === null,
  );
  check(
    'reload: a negative counter is refused',
    parseClockState({ ...clocks, drivingUsedMin: -60 }) === null,
  );
  check(
    "reload: the engine's own -1 'no window open' sentinel is accepted",
    parseClockState({ ...clocks, windowElapsedMin: -1 })?.windowElapsedMin === -1,
  );
  check(
    'reload: an empty on-duty bucket array is refused',
    parseClockState({ ...clocks, onDutyByDayMin: [] }) === null,
  );
  check(
    'wiring: the screen persists the live clocks with the trip snapshot',
    /clocks: hosClocksRef\.current/.test(SCREEN) && /onClocksChange=\{onHosClocks\}/.test(SCREEN),
  );
  check(
    'wiring: restored clocks are handed to the strip, applied once',
    /restoredClocks=\{hosRestoredClocks\}/.test(SCREEN) && /appliedRestoreRef/.test(HOS_COMPONENT),
  );
  check(
    /*
     * The clocks still ride the TRIP key, and the driving screen now
     * writes THAT AND NOTHING ELSE.
     *
     * Every other record — the confirmed truck, the driver's name, the
     * region preference — moved into its own `*-storage.ts` module during
     * the pre-trip setup milestone. That is what makes "a corrupt clock
     * record must not destroy a valid truck profile" structural rather
     * than promised: separate keys, separate parsers, and no try/catch on
     * this screen that can span them.
     *
     * The trip snapshot stays here, and stays in sessionStorage, because
     * it is about ONE DRIVE and should not outlive the tab.
     */
    'wiring: clocks ride the EXISTING trip key — and the screen writes only that',
    (SCREEN.match(/sessionStorage\.setItem\(\s*TRIP_RESTORE_KEY/g) ?? []).length === 1 &&
      (SCREEN.match(/sessionStorage\.setItem\(/g) ?? []).length === 1 &&
      (SCREEN.match(/localStorage/g) ?? []).length === 0 &&
      !SCREEN.includes("'tlws-navigator-region-v1'") &&
      !SCREEN.includes("'tlws-navigator-truck-v1'"),
  );
  check(
    'wiring: the truck record is reached by function call, through its own module',
    /from '\.\/truck-storage'/.test(SCREEN) && /readTruck\(\)/.test(SCREEN),
  );
}

/* ========= 9. truck profile: parked panel ONCE, no cockpit chip ========= */
{
  /*
   * FINAL PILOT MILESTONE: the docked truck chip is GONE. It repeated
   * numbers the driver had already verified on the parked panel before
   * Start — height, weight, axles, hazmat, trailers — and mid-drive the
   * space it occupied belongs to the map. These pins are the absence:
   * the component no longer exists, no profile figure rides the live
   * map, and the removal is documented where the chip used to render so
   * nobody "helpfully" adds it back.
   */
  check('truck: the docked chip component no longer exists', !/TruckChip/.test(SCREEN));
  check(
    'truck: no profile numbers ride the live map surface',
    !SCREEN.includes('13′6″') && !SCREEN.includes('80,000') && !SCREEN.includes('5 axles'),
  );
  check(
    'truck: the removal is deliberate and documented in place',
    SCREEN.includes('NO TRUCK-PROFILE OVERLAY HERE'),
  );
  check(
    'truck: the freed space is promised to the map, not a replacement box',
    SCREEN.includes('goes to the map, not to a replacement box'),
  );
  // The detailed panel remains for the parked page.
  const panel = renderToStaticMarkup(
    createElement(TruckProfilePanel, { truck: DEFAULT_TRUCK_PROFILE }),
  );
  check(
    'truck: the detailed parked panel still lists every value',
    panel.includes('Height') &&
      panel.includes('Width') &&
      panel.includes('Length') &&
      panel.includes('Gross weight') &&
      panel.includes('Axles') &&
      panel.includes('Hazmat'),
  );
  check(
    'truck: the parked panel still names what is NOT routed around',
    panel.includes('Not routed around'),
  );
  const controls = readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8');
  const editor = readFileSync('src/components/navigator/TruckProfileEditor.tsx', 'utf8');
  check(
    // The read-only panel became an EDITOR (truck-route confidence
    // milestone): a driver who cannot change the numbers cannot honestly
    // confirm them. Its disclosure survives inside the editor.
    'truck: the parked trip surface still shows the full truck detail',
    controls.includes('{truckSlot}') &&
      editor.includes('Not used for routing') &&
      editor.includes('NOT_ROUTED_NOTICE'),
  );
  check(
    'truck: the large panel never renders on the cockpit surface',
    !/TruckProfilePanel/.test(SCREEN),
  );
}

console.log(`navigator-hos-compact: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
