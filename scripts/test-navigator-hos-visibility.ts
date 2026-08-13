/**
 * Hiding the clocks — the pure decision, the stored preference, and what
 * actually happens to a running clock when a driver taps the button.
 *
 * The declutter milestone's sharpest promise is that hiding is a
 * PRESENTATION change and nothing else. That is easy to say and easy to
 * get wrong in four different ways — an unmount that drops the state, an
 * effect that re-seeds it, a tick that stops with the panel, a voice
 * announcer skipped behind an early return — and none of them are
 * visible in a static render. So the collapse is driven for real here,
 * against the mounted component, with a fake clock advancing under it.
 *
 * Covers required proof cases 1-17 and 22. Cases 18-21 and 24 are
 * geometry and reachability, which belong to
 * `scripts/bench/navigator-declutter.mjs` and the pre-trip bench —
 * a renderer cannot honestly measure unobstructed map area.
 *
 * Run:
 *   node scripts/run-tests.mjs navigator-hos-visibility
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFileSync } from 'node:fs';
import { writeSync } from 'node:fs';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let now = 1_754_000_000_000;
const realNow = Date.now;
Date.now = () => now;

/* A controllable 60-second tick, so "still advancing" is provable. */
type FakeInterval = { cb: () => void; everyMs: number; nextAt: number };
const intervals = new Map<number, FakeInterval>();
let intervalSeq = 0;
(globalThis as any).setInterval = (cb: () => void, everyMs: number) => {
  intervalSeq += 1;
  intervals.set(intervalSeq, { cb, everyMs: Math.max(1, everyMs), nextAt: now + everyMs });
  return intervalSeq;
};
(globalThis as any).clearInterval = (id: number) => {
  intervals.delete(id);
};
function advance(ms: number): void {
  const target = now + ms;
  while (true) {
    let next: FakeInterval | null = null;
    for (const iv of intervals.values()) {
      if (iv.nextAt <= target && (next === null || iv.nextAt < next.nextAt)) next = iv;
    }
    if (next === null) break;
    now = next.nextAt;
    next.nextAt += next.everyMs;
    next.cb();
  }
  now = target;
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
  keys(): string[] {
    return [...this.map.keys()];
  }
  clearAll(): void {
    this.map.clear();
  }
}
const local = new MemoryStorage();
const session = new MemoryStorage();
(globalThis as any).window = { localStorage: local, sessionStorage: session };
(globalThis as any).localStorage = local;
(globalThis as any).sessionStorage = session;

import { createElement, useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { HosStrip } from '@/components/navigator/HosStrip';
import { DrivingScreenView } from '@/components/navigator/DrivingScreen';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { createVoiceGuidance, type SpeechPort } from '@/lib/navigator/voice-guidance';
import { toEngineClockState } from '@/lib/navigator/hos-clocks';
import { hosCompactViewFrom } from '@/lib/navigator/hos-compact';
import { remainingClocks } from '@/lib/trip-planner/hos-engine';
import {
  asVisibility,
  clocksToggleLabel,
  hasUrgentClock,
  hosPresentation,
  toggledVisibility,
  CLOCKS_HIDDEN_NOTE,
  HIDE_CLOCKS_LABEL,
  HOS_VISIBILITY_DEFAULT,
  SHOW_CLOCKS_LABEL,
} from '@/lib/navigator/hos-visibility';
import {
  clearHosVisibility,
  readHosVisibility,
  writeHosVisibility,
  HOS_VISIBILITY_KEY,
} from '@/components/navigator/hos-visibility-storage';
import type { DrivingView } from '@/lib/navigator/navigation-controller';

let passed = 0;
let failed = 0;
function say(line: string): void {
  writeSync(1, `${line}\n`);
}
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    say(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const MID_SHIFT = toEngineClockState(
  { drivingMin: 305, windowMin: 470, untilBreakMin: 185, cycleMin: 1_325, cycleRule: '70/8' },
  now,
);
const URGENT = toEngineClockState(
  { drivingMin: 40, windowMin: 60, untilBreakMin: 8, cycleMin: 300, cycleRule: '70/8' },
  now,
);
const OVERDUE = toEngineClockState(
  { drivingMin: 0, windowMin: 20, untilBreakMin: 0, cycleMin: 200, cycleRule: '70/8' },
  now,
);

const flat = (v: any): string =>
  v === null || v === undefined
    ? ''
    : typeof v === 'string' || typeof v === 'number'
      ? String(v)
      : Array.isArray(v)
        ? v.map(flat).join(' ')
        : flat(v.children);

/* ===================================================================== */
/* 1. THE PURE DECISION                                                   */
/* ===================================================================== */
{
  check('1. the documented first-use default is SHOWN', HOS_VISIBILITY_DEFAULT === 'shown');
  check('labels are words, not a glyph', HIDE_CLOCKS_LABEL === 'Hide clocks');
  check('and the other way round', SHOW_CLOCKS_LABEL === 'Show clocks');
  check(
    'the toggle names the ACTION for the current state',
    clocksToggleLabel('shown') === HIDE_CLOCKS_LABEL,
  );
  check('and the other one when hidden', clocksToggleLabel('hidden') === SHOW_CLOCKS_LABEL);
  check('toggling is an involution', toggledVisibility(toggledVisibility('shown')) === 'shown');
  check('a stored word is narrowed, not trusted', asVisibility('shown') === 'shown');
  check('anything else is refused', asVisibility('yes') === null && asVisibility(1) === null);

  const calm = hosCompactViewFrom(remainingClocks(MID_SHIFT));
  const urgent = hosCompactViewFrom(remainingClocks(URGENT));
  const over = hosCompactViewFrom(remainingClocks(OVERDUE));
  check('7. a calm driver has no urgent clock', !hasUrgentClock(calm));
  check('7. an urgent clock is detected', hasUrgentClock(urgent));
  check('7. an overdue clock is detected', hasUrgentClock(over));
  check('7. no clocks entered is silence, not an emergency', !hasUrgentClock(null));

  check('shown always renders the full strip', hosPresentation('shown', calm).kind === 'full');
  check(
    'shown renders the full strip even when urgent',
    hosPresentation('shown', urgent).kind === 'full',
  );
  check('hidden and calm is the bare control', hosPresentation('hidden', calm).kind === 'control');
  check('7. hidden and URGENT still warns', hosPresentation('hidden', urgent).kind === 'warning');
  check('7. hidden and OVER still warns', hosPresentation('hidden', over).kind === 'warning');
  check(
    'hidden with no clocks entered stays silent',
    hosPresentation('hidden', null).kind === 'control',
  );
}

/* ===================================================================== */
/* 8+9. THE STORED PREFERENCE                                             */
/* ===================================================================== */
{
  local.clearAll();
  check('8. a first-time driver gets the documented default', readHosVisibility() === 'shown');
  check('8. and reading it stored nothing', local.keys().length === 0, local.keys());

  writeHosVisibility('hidden');
  check('8. the choice is saved', local.raw(HOS_VISIBILITY_KEY) !== null);
  check('8. and it survives a reload', readHosVisibility() === 'hidden');
  writeHosVisibility('shown');
  check('8. changing it back replaces the record', readHosVisibility() === 'shown');
  clearHosVisibility();
  check('8. clearing returns to the default', readHosVisibility() === 'shown');
  check('8. and removes the record', local.raw(HOS_VISIBILITY_KEY) === null);

  const corrupt: [string, string][] = [
    ['not JSON', 'wat'],
    ['not an object', '"hidden"'],
    ['null', 'null'],
    ['missing version', '{"visibility":"hidden"}'],
    ['wrong version', '{"v":9,"visibility":"hidden"}'],
    ['missing value', '{"v":1}'],
    ['a word this build does not know', '{"v":1,"visibility":"collapsed"}'],
    ['a number', '{"v":1,"visibility":0}'],
    ['an object', '{"v":1,"visibility":{"kind":"hidden"}}'],
  ];
  for (const [label, raw] of corrupt) {
    local.clearAll();
    // A valid clock record sits beside the damaged preference.
    local.plant('tlws-navigator-clocks-v1', '{"v":1,"entered":{},"enteredAtMs":1}');
    local.plant(HOS_VISIBILITY_KEY, raw);
    let threw = false;
    let value: unknown = 'unset';
    try {
      value = readHosVisibility();
    } catch {
      threw = true;
    }
    check(`9. corrupt preference (${label}): does not throw`, !threw);
    check(`9. corrupt preference (${label}): falls back to the default`, value === 'shown', value);
    check(
      `9. corrupt preference (${label}): the clock record is untouched`,
      local.raw('tlws-navigator-clocks-v1') !== null,
    );
  }

  local.clearAll();
  local.hostile = true;
  let threw = false;
  try {
    writeHosVisibility('hidden');
    check('9. hostile storage still answers with the default', readHosVisibility() === 'shown');
    clearHosVisibility();
  } catch {
    threw = true;
  }
  local.hostile = false;
  check('9. hostile storage never throws into the render path', !threw);
}

/* ===================================================================== */
/* 10. THE PREFERENCE NEVER REACHES THE NETWORK                           */
/* ===================================================================== */
{
  const wireModules = [
    'src/components/navigator/search-port.ts',
    'src/components/navigator/route-port.ts',
    'src/lib/navigator-api/destination-search.ts',
    'src/lib/navigator/route-session.ts',
    'src/lib/navigator/navigation-lifecycle.ts',
    'src/lib/navigator/road-test-report.ts',
    'src/lib/navigator/problem-report.ts',
    'src/lib/navigator/pilot-mode.ts',
    'src/lib/navigator/trip-restore.ts',
    'src/lib/trip-planner/here-truck-params.ts',
    'src/lib/trip-planner/here-routing.ts',
  ];
  for (const path of wireModules) {
    const src = readFileSync(path, 'utf8');
    check(
      `10. ${path.split('/').pop()} never mentions the clocks preference`,
      !/hosVisibility|hos-visible|HOS_VISIBILITY/.test(src),
      path,
    );
  }
  const storageRaw = readFileSync('src/components/navigator/hos-visibility-storage.ts', 'utf8');
  const storage = storageRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check(
    '10. the preference module fetches nothing',
    !/fetch\(|XMLHttpRequest|sendBeacon/.test(storage),
  );
  check('10. imports no port', !/-port'|\/ports'/.test(storage));
  check('10. touches no analytics', !/analytics|trackEvent|plausible|gtag/i.test(storage));
  check('10. and no database', !/supabase/i.test(storage));
}

/* ===================================================================== */
/* 2-6. THE COLLAPSE, DRIVEN FOR REAL                                     */
/* ===================================================================== */
{
  const spoken: string[] = [];
  const speech: SpeechPort = {
    supported: true,
    speak: (t, done) => {
      spoken.push(t);
      done();
    },
    cancel: () => {},
  };
  /* Unmuted by default — `startMuted` is opt-in, so HOS lines speak. */
  const voice = createVoiceGuidance(speech);

  /* A wrapper that owns the visibility exactly the way the screen does. */
  function Rig({ clocks }: { clocks: typeof MID_SHIFT }) {
    const [visibility, setVisibility] = useState<'shown' | 'hidden'>('shown');
    return createElement(HosStrip, {
      initialClocks: clocks,
      drivingActive: true,
      sourceLabel: 'test',
      voice,
      compact: true,
      visibility,
      onToggleVisibility: () => setVisibility((v) => (v === 'shown' ? 'hidden' : 'shown')),
    } as any);
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Rig, { clocks: MID_SHIFT }));
  });
  const text = () => flat(renderer.toJSON());
  const tapClocks = () => {
    const btn = renderer.root.findAll(
      (n) => n.type === 'button' && /clocks/i.test(String(n.props['aria-label'] ?? '')),
    )[0];
    act(() => {
      btn.props.onClick();
    });
  };

  check('2. the strip is on screen by default', text().includes('DRIVE'));
  const shownText = text();
  check('2. showing the clocks offers Hide clocks', shownText.includes(HIDE_CLOCKS_LABEL));

  tapClocks();
  const hidden = text();
  check('2. Hide clocks removes the visual strip', !hidden.includes('DRIVE'), hidden.slice(0, 160));
  check('2. and offers Show clocks in its place', hidden.includes(SHOW_CLOCKS_LABEL));
  check('2. the driver is told the clocks are still running', hidden.includes(CLOCKS_HIDDEN_NOTE));

  /*
   * 5. HIDDEN CLOCKS KEEP ADVANCING.
   *
   * Twenty minutes of driving pass with the strip hidden. Showing it
   * again must reveal a clock that MOVED — proving the tick never
   * stopped — rather than the value it had when it was hidden.
   */
  act(() => {
    advance(20 * 60_000);
  });
  tapClocks();
  const after = text();
  check('3. Show clocks brings the strip back', after.includes('DRIVE'));
  check(
    '5. the clocks advanced while they were hidden',
    after.includes('4:45'),
    after.slice(0, 200),
  );
  check(
    '4. and they were not reset to the entered values',
    !after.includes('5:05'),
    after.slice(0, 200),
  );

  /* 6. voice still fires while hidden. */
  const urgentSpoken: string[] = [];
  const speech2: SpeechPort = {
    supported: true,
    speak: (t, done) => {
      urgentSpoken.push(t);
      done();
    },
    cancel: () => {},
  };
  const voice2 = createVoiceGuidance(speech2);
  let r2!: TestRenderer.ReactTestRenderer;
  act(() => {
    r2 = TestRenderer.create(
      createElement(HosStrip, {
        initialClocks: URGENT,
        drivingActive: true,
        sourceLabel: 'test',
        voice: voice2,
        compact: true,
        visibility: 'hidden',
        onToggleVisibility: () => {},
      } as any),
    );
  });
  act(() => {
    advance(2 * 60_000);
  });
  const hiddenUrgent = flat(r2.toJSON());
  check(
    '6. an HOS warning is spoken while the clocks are hidden',
    urgentSpoken.length > 0,
    urgentSpoken.slice(0, 3),
  );
  check(
    '7. and the urgent condition is on screen despite being hidden',
    /Break required/.test(hiddenUrgent),
    hiddenUrgent.slice(0, 200),
  );
  check(
    '7. the ELD authority travels with the hidden-state warning',
    hiddenUrgent.includes('ELD is authoritative.'),
  );
  check(
    '7. but the full strip is still NOT drawn',
    !hiddenUrgent.includes('DRIVE'),
    hiddenUrgent.slice(0, 160),
  );

  act(() => {
    renderer.unmount();
    r2.unmount();
  });
}

/* ===================================================================== */
/* 13-17. THE COMPACT CARD, RENDERED                                      */
/* ===================================================================== */
{
  const silent: SpeechPort = { supported: true, speak: (_t, d) => d(), cancel: () => {} };
  const base = {
    status: 'navigating' as const,
    maneuvers: {
      next: {
        action: 'turn',
        instruction: 'Turn right onto Old Mill Road toward the receiving gate.',
        direction: 'right',
        mileMi: 4.6,
      },
      following: null,
      distanceMi: 0.4,
    },
    remainingMi: 12.3,
    routeMile: 4.2,
    totalMi: 16.5,
    speedMph: 58,
    lastKnown: false,
  };
  function render(over: Partial<DrivingView>, extra: Record<string, unknown> = {}): string {
    return renderToStaticMarkup(
      createElement(
        GpsProvider,
        null,
        createElement(
          SafetyLockProvider,
          null,
          createElement(DrivingScreenView, {
            view: { ...base, ...over } as never,
            watching: true,
            onStart: () => {},
            onStop: () => {},
            voice: createVoiceGuidance(silent),
            mapSlot: createElement('div', { 'data-test-map': 'live' }, 'MAP'),
            fullScreen: true,
            roadName: 'Old Mill Road',
            etaText: '3:45 PM',
            hosEnteredClocks: MID_SHIFT,
            ...extra,
          }),
        ),
      ),
    );
  }
  const card = (html: string) => {
    const at = html.indexOf('aria-label="Next maneuver"');
    return at < 0 ? '' : html.slice(at, at + 2200);
  };

  const normal = render({});
  const c = card(normal);
  check('13. the card is present', c.length > 0);
  check(
    '13. it carries the maneuver arrow',
    /aria-hidden="true"[^>]*>[^<]*[↰↱⬆⬈⬉↩⤴]/u.test(c),
    c.slice(0, 300),
  );
  check('13. the instruction', c.includes('Turn right onto Old Mill Road'));
  check('13. the live distance', /In\s*0\.4\s*mi/.test(c.replace(/<[^>]+>/g, ' ')));
  check('13. and the road name', c.includes('Old Mill Road'));
  check(
    '13. the ELD line still travels with the driving clocks',
    normal.includes('ELD is authoritative.'),
  );

  /* 14. a missing road name must not produce "on undefined" or a hole. */
  const noRoad = render({}, { roadName: null });
  check('14. a missing road name simply omits the line', !/>\s*on\s*</.test(card(noRoad)));
  check('14. and the instruction still stands', card(noRoad).includes('Turn right onto'));

  /* 14. a very long exit name must clamp rather than grow the card. */
  const longName = render(
    {
      maneuvers: {
        next: {
          action: 'turn',
          instruction:
            'Turn right onto Interstate 24 West toward Chattanooga / Nashville Exit 178B Commercial Vehicle Route',
          direction: 'right',
          mileMi: 4.6,
        },
        following: null,
        distanceMi: 0.4,
      },
    } as never,
    { roadName: 'Interstate 24 West toward Chattanooga and Nashville Exit 178B' },
  );
  const lc = card(longName);
  check('14. a long instruction is clamped, not clipped blind', lc.includes('line-clamp-2'));
  check('14. a long road name truncates', /class="[^"]*truncate[^"]*"[^>]*>\s*on /.test(lc));
  check('14. and the card keeps its cap', lc.includes('max-h-[28dvh]'));

  /* 15. left and right stay on their own sides. */
  const right = card(render({}));
  const left = card(
    render({
      maneuvers: {
        next: {
          action: 'turn',
          instruction: 'Turn left onto Depot Road.',
          direction: 'left',
          mileMi: 4.6,
        },
        following: null,
        distanceMi: 0.4,
      },
    } as never),
  );
  const glyphOf = (html: string) =>
    /aria-hidden="true"[^>]*>([^<]*)</u.exec(html)?.[1]?.trim() ?? '';
  check('15. a right turn and a left turn do not share a glyph', glyphOf(right) !== glyphOf(left), {
    right: glyphOf(right),
    left: glyphOf(left),
  });
  check('15. the right-turn glyph points right', /[↱⬈➡]/u.test(glyphOf(right)), glyphOf(right));
  check('15. the left-turn glyph points left', /[↰⬉⬅]/u.test(glyphOf(left)), glyphOf(left));

  /*
   * 16. THE DISTANCE MOVES WITH THE VIEW.
   *
   * Not "In 0.1 mi": under a fifth of a mile the shipped formatter
   * switches to feet, which is the unit a driver wants that close to a
   * turn. Asserting the exact string would have pinned the wrong thing
   * and hidden the switch. What matters is that the card re-renders the
   * value from the view, and that the near case is in feet.
   */
  const farText = card(render({})).replace(/<[^>]+>/g, ' ');
  const near = card(render({ maneuvers: { ...base.maneuvers, distanceMi: 0.1 } } as never));
  const nearText = near.replace(/<[^>]+>/g, ' ');
  check('16. a closer maneuver renders a different distance', farText !== nearText);
  check(
    '16. and switches to feet inside a fifth of a mile',
    /\d+\s*ft/.test(nearText),
    nearText.slice(0, 120),
  );
  check('16. while the far case stays in miles', /0\.4\s*mi/.test(farText), farText.slice(0, 120));

  /* 17. the map is still the full-bleed background. */
  check('17. the map is the absolute z-0 background', normal.includes('absolute inset-0 z-0'));
  check('17. and the overlays are layered above it', normal.includes('relative z-10'));
  check(
    '17. the guidance surface is measurable for the bench',
    normal.includes('data-driving-surface'),
  );
  check('18. the HOS area is measurable for the bench', normal.includes('data-hos-region'));

  /*
   * 20. The controls the SURFACE owns are on the surface. Route overview
   * arrives through `overviewSlot`, which the driving container fills and
   * this render deliberately does not — its presence and its tap size are
   * measured in the browser bench, where a slot that renders nothing
   * cannot pass by being absent from a prop list.
   */
  for (const label of ['Stop', 'voice']) {
    check(`20. ${label} is present on the driving surface`, new RegExp(label, 'i').test(normal));
  }
  check(
    '20. and the overview slot is rendered where the container fills it',
    readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8').includes(
      'fullScreen ? overviewSlot : null',
    ),
  );

  /* 11 + 12. the merged promises this milestone must not weaken. */
  const CANADA = render(
    {},
    { hosUnavailableNotice: 'Canadian HOS is not calculated in this pilot.' },
  );
  check(
    '11. Canada still states that its HOS is not calculated',
    CANADA.includes('Canadian HOS is not calculated in this pilot.'),
  );
  check('11. and shows no US clock strip in its place', !CANADA.includes('DRIVE'));
}

/* ===================================================================== */
/* 12 + 22. STRUCTURAL PROMISES CARRIED FORWARD                           */
/* ===================================================================== */
{
  const SCREEN = readFileSync('src/components/navigator/DrivingScreen.tsx', 'utf8');
  const STRIP = readFileSync('src/components/navigator/HosStrip.tsx', 'utf8');

  /* 12. THE CYCLE-RECAP REFUSAL IS LOAD-BEARING. */
  for (const path of [
    'src/components/navigator/DrivingScreen.tsx',
    'src/components/navigator/HosStrip.tsx',
    'src/components/navigator/HosCompactStrip.tsx',
    'src/lib/navigator/hos-visibility.ts',
  ]) {
    const src = readFileSync(path, 'utf8');
    check(
      `12. ${path.split('/').pop()} imports no recap projection`,
      !/recapProjection|recap-projection|hos-exceptions/.test(src),
      path,
    );
  }
  check(
    '12. no Navigator surface displays a recap date',
    !/recap (on|by) |recaps? (on|at) \d/i.test(SCREEN),
  );

  /*
   * 4. ONE MOUNTED STRIP, in every visibility state.
   *
   * The whole promise rests on this: if the collapse were expressed as
   * `{visible ? <HosStrip/> : null}` the clocks would restart on every
   * tap, and no amount of careful state handling inside the component
   * would save it.
   */
  check(
    '4. the driving screen mounts exactly one HosStrip',
    (SCREEN.match(/<HosStrip/g) ?? []).length === 1,
    (SCREEN.match(/<HosStrip/g) ?? []).length,
  );
  check(
    '4. and never conditions that mount on the visibility',
    !/hosVisibility[^\n]*\?[^\n]*<HosStrip/.test(SCREEN) &&
      !/visibility === 'shown'[^\n]*&&[^\n]*<HosStrip/.test(SCREEN),
  );
  check(
    '4. the visibility reaches the strip as a PROP, not a mount decision',
    /visibility=\{hosVisibility\}/.test(SCREEN),
  );
  check(
    '5. the sixty-second tick is declared unconditionally',
    /useEffect\(\(\) => \{\s*const tick = setInterval/.test(
      STRIP.replace(/\s+/g, ' ').replace(/ /g, ' '),
    ) || /const tick = setInterval/.test(STRIP),
  );
  /*
   * 6. The announcer must sit ABOVE the branch that decides what to
   * draw, or a hidden strip would stop speaking. Compared against the
   * CALL, not the import at the top of the file — which is where the
   * first draft of this check was looking, and it passed for the wrong
   * reason.
   */
  const announceAt = STRIP.indexOf('announcerRef.current.collect');
  const branchAt = STRIP.indexOf('hosPresentation(visibility');
  check(
    '6. the voice announcer runs before any presentation branch',
    announceAt > 0 && branchAt > announceAt,
    {
      announceAt,
      branchAt,
    },
  );

  /* 22. a reload restores both records, and neither costs a request. */
  check(
    '22. the screen restores the saved visibility on mount',
    /setHosVisibility\(readHosVisibility\(\)\)/.test(SCREEN),
  );
  check(
    '22. and the saved clocks, still from their own record',
    /setClockEntry\(readClocks\(\)\)/.test(SCREEN),
  );
  check(
    '22. the preference write is the only thing a toggle does',
    /writeHosVisibility\(next\)/.test(SCREEN) && !/writeHosVisibility[^\n]*fetch/.test(SCREEN),
  );
  check(
    '23. the start attempt guard is untouched by this milestone',
    /createStartAttempt/.test(
      readFileSync('src/components/navigator/PilotTripControls.tsx', 'utf8'),
    ),
  );
}

Date.now = realNow;
say(`navigator-hos-visibility: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
