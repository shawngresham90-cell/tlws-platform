/**
 * N6 HOS strip — the 60-second advance loop through the REAL hos-engine,
 * threshold escalation of the warning line, and the strip's permanent
 * presence on the driving screen. The engine itself is byte-untouched by
 * this milestone; its own harnesses remain the authority on HOS law.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-hos-integration.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-nav-hos.cjs && node /tmp/test-nav-hos.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  HOS_TICK_MS,
  NOTICE_MIN,
  WARNING_MIN,
  CRITICAL_MIN,
  formatHM,
  hosWarning,
  hosStripView,
  tickClocks,
} from '@/lib/navigator/hos-strip';
import { freshClockState, remainingClocks, advance } from '@/lib/trip-planner/hos-engine';
import { HosStrip } from '@/components/navigator/HosStrip';
import { HosWarningLine } from '@/components/navigator/HosWarningLine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const T0 = 1_754_000_000_000;

// ------------------------------------------ 60-second cadence, real engine
{
  check('cadence constant is 60 s (doc 05 §9)', HOS_TICK_MS === 60_000);
  let state = freshClockState(T0);
  for (let i = 0; i < 60; i++) state = tickClocks(state, 1, 'driving');
  const r = remainingClocks(state);
  check('60 one-minute driving ticks burn exactly 1 h of driving', r.drivingMin === 600, r);
  check('…and 1 h of the window', r.windowMin === 780);
  check('…and 1 h of the break clock', r.untilBreakMin === 420);
  check('…and 1 h of the cycle', r.cycleMin === 4140);

  // Tick equivalence: sixty 1-min ticks === one 60-min advance.
  const bulk = advance(freshClockState(T0), 'driving', 60).state;
  check(
    'tick loop equals one bulk advance',
    JSON.stringify(remainingClocks(bulk)) === JSON.stringify(r),
  );

  // Non-driving ticks do not burn the driving clock.
  const idle = tickClocks(freshClockState(T0), 1, 'on-duty');
  check('an on-duty tick burns window, not driving', remainingClocks(idle).drivingMin === 660);
  check(
    'zero/negative/NaN elapsed are no-ops',
    tickClocks(state, 0, 'driving') === state &&
      tickClocks(state, -5, 'driving') === state &&
      tickClocks(state, Number.NaN, 'driving') === state,
  );
}

// --------------------------------------------------- threshold escalation
{
  const at = (untilBreakMin: number) =>
    hosWarning({
      drivingMin: 400,
      windowMin: 500,
      untilBreakMin,
      cycleMin: 3000,
      legalDrivingMin: 400,
      limitedBy: '11-hour',
    });
  check(
    'calm clocks → no warning text',
    at(NOTICE_MIN + 1).severity === 'none' && at(61).text === null,
  );
  check('≤60 min → notice', at(60).severity === 'notice');
  check('notice text names the break clock', at(48).text === 'Break required in 0:48');
  check('≤30 min → warning', at(30).severity === 'warning');
  check('≤15 min → critical', at(CRITICAL_MIN).severity === 'critical');
  check(
    '0 → overdue wording, no negative time',
    at(0).text === 'Break required now' && at(0).severity === 'critical',
  );
  check(
    'WARNING_MIN sits between the tiers',
    NOTICE_MIN > WARNING_MIN && WARNING_MIN > CRITICAL_MIN,
  );

  // The BINDING clock decides: window tighter than break → window line.
  const windowBound = hosWarning({
    drivingMin: 400,
    windowMin: 20,
    untilBreakMin: 45,
    cycleMin: 3000,
    legalDrivingMin: 20,
    limitedBy: '14-hour',
  });
  check(
    'binding clock wins (window 0:20 beats break 0:45)',
    windowBound.clock === 'window' && windowBound.text === 'On-duty window ends in 0:20',
  );
  const drivingOut = hosWarning({
    drivingMin: 0,
    windowMin: 90,
    untilBreakMin: 90,
    cycleMin: 3000,
    legalDrivingMin: 0,
    limitedBy: '11-hour',
  });
  check('driving exhaustion reads as reached', drivingOut.text === 'Driving limit reached');
  const cycleBound = hosWarning({
    drivingMin: 300,
    windowMin: 300,
    untilBreakMin: 300,
    cycleMin: 10,
    legalDrivingMin: 10,
    limitedBy: 'cycle',
  });
  check('cycle can be the binding clock', cycleBound.clock === 'cycle');
}

// ----------------------------------------------------------- formatting
{
  check('formatHM 402 → 6:42 (doc 01 §4 style)', formatHM(402) === '6:42');
  check('formatHM 555 → 9:15', formatHM(555) === '9:15');
  check('formatHM 108 → 1:48', formatHM(108) === '1:48');
  check('formatHM 5 → 0:05 (padded)', formatHM(5) === '0:05');
  check('formatHM never negative', formatHM(-30) === '0:00');
  const view = hosStripView(freshClockState(T0));
  check(
    'fresh view: 11:00 drive / 14:00 window, full fractions',
    view.driveText === '11:00' &&
      view.windowText === '14:00' &&
      view.driveFraction === 1 &&
      view.windowFraction === 1,
  );
}

// ------------------------------------------------------- rendered strip
{
  const html = renderToStaticMarkup(
    createElement(HosStrip, {
      // The strip no longer invents a fresh driver when nothing is
      // entered — that assumption was the defect the pre-trip setup
      // milestone removed. A test that wants populated clocks must now
      // SAY which clocks, which is the honest shape for a test anyway.
      initialClocks: freshClockState(T0),
      drivingActive: false,
      sourceLabel: "No trip loaded — showing a fresh driver's full clocks.",
    }),
  );
  check(
    'strip renders drive/window clocks as text',
    html.includes('Drive time left') &&
      html.includes('On-duty window left') &&
      html.includes('11:00') &&
      html.includes('14:00'),
  );
  check('strip states its clock provenance honestly', html.includes('No trip loaded'));
  check('strip has an accessible landmark name', html.includes('aria-label="Hours of service"'));
  check('calm state announced as text', html.includes('Clocks are comfortable.'));

  const warnHtml = renderToStaticMarkup(
    createElement(HosWarningLine, {
      warning: { severity: 'warning', text: 'Break required in 0:28', clock: 'break' },
    }),
  );
  check(
    'warning escalation carried in WORDS, not color',
    warnHtml.includes('Warning: Break required in 0:28'),
  );
  const critHtml = renderToStaticMarkup(
    createElement(HosWarningLine, {
      warning: { severity: 'critical', text: 'Break required now', clock: 'break' },
    }),
  );
  check(
    'critical escalation reads Urgent and goes assertive',
    critHtml.includes('Urgent: Break required now') && critHtml.includes('aria-live="assertive"'),
  );
}

// ------------------------------------------- wiring + lifecycle structure
{
  const screen = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  check(
    'strip is PERMANENT on the driving screen (unconditional render)',
    /<HosStrip/.test(screen) && !/\{[^}]*&&\s*<HosStrip/.test(strip(screen)),
  );
  check(
    'clocks only burn while guidance is genuinely active',
    screen.includes("view.status === 'navigating' || view.status === 'position-degraded'"),
  );
  const comp = strip(readFileSync('src/components/navigator/HosStrip.tsx', 'utf8'));
  check('60 s interval cleared on unmount', /clearInterval\(tick\)/.test(comp));
  check('strip adds no text input', !/<input|<textarea/i.test(comp));
  check(
    'strip touches no storage/fetch/console',
    !/localStorage|sessionStorage|indexedDB|\bfetch\s*\(|console\./.test(comp),
  );
  const engine = readFileSync('src/lib/trip-planner/hos-engine.ts', 'utf8');
  check(
    'hos-engine remains byte-level free of navigator imports (reuse, not fork)',
    !/navigator/.test(engine),
  );
}

console.log(`navigator-hos-integration: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
