/**
 * Driver glanceability (Block 2, priority J).
 *
 * A driving screen is read in about a second, from a phone mount, at
 * speed. The failure mode is not any one bad element — it is accretion:
 * every milestone adds one more genuinely useful line, none of them
 * individually wrong, until the card takes three seconds to parse. This
 * harness renders the REAL driving surface and counts what a driver has
 * to read, so accretion has to be argued for rather than merged.
 *
 * Two invariants:
 *   1. A BUDGET on how many text lines the map-first surface shows.
 *   2. A HIERARCHY: the turn is the biggest thing on the screen, and
 *      nothing may tie it or beat it.
 *
 * Sizes come from the Tailwind type scale in the markup, which is what
 * actually renders. No browser is involved and none of this is a pixel
 * measurement.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-glanceability.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --jsx=automatic \
 *     --loader:.css=empty --outfile=/tmp/test-glance.cjs \
 *   && node /tmp/test-glance.cjs
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DrivingScreenView } from '@/components/navigator/DrivingScreen';
import { GpsProvider } from '@/components/navigator/GpsProvider';
import { SafetyLockProvider } from '@/components/navigator/SafetyLockProvider';
import { createVoiceGuidance, type SpeechPort } from '@/lib/navigator/voice-guidance';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const silent: SpeechPort = { supported: true, speak: (_t, d) => d(), cancel: () => {} };

// The busiest honest case: a turn with a following turn, a named road, an
// ETA, and an offline notice all at once. If the surface is glanceable
// here it is glanceable always.
const view = {
  status: 'navigating' as const,
  maneuvers: {
    next: {
      action: 'turn',
      instruction: 'Turn right onto Old Mill Road toward the receiving gate.',
      direction: 'right',
      mileMi: 4.6,
    },
    following: {
      action: 'turn',
      instruction: 'Turn left onto Dock Street.',
      direction: 'left',
      mileMi: 4.9,
    },
    distanceMi: 0.4,
  },
  remainingMi: 12.3,
  routeMile: 4.2,
  totalMi: 16.5,
  speedMph: 58,
  lastKnown: false,
};

const html = renderToStaticMarkup(
  createElement(
    GpsProvider,
    null,
    createElement(
      SafetyLockProvider,
      null,
      createElement(DrivingScreenView, {
        view: view as never,
        watching: true,
        onStart: () => {},
        onStop: () => {},
        voice: createVoiceGuidance(silent),
        mapSlot: createElement('div', { 'data-test-map': 'live' }, 'MAP'),
        fullScreen: true,
        roadName: 'Old Mill Road',
        etaText: '3:45 PM',
        offlineText: 'Offline — guidance continues on the route you have.',
      }),
    ),
  ),
);

/*
 * The boundary between what shares the viewport with the map and what
 * sits past the fold. In full-screen mode the below-the-fold region is
 * the component's own `space-y-4 p-4` container — everything before it
 * is what a driver can see without scrolling.
 *
 * If that marker ever moves, this harness must fail loudly rather than
 * quietly measure the whole page: an unbounded count would pass the
 * budget check for the wrong reason.
 */
const FOLD = 'class="space-y-4 p-4"';
const foldAt = html.indexOf(FOLD);
const surface = foldAt > 0 ? html.slice(0, foldAt) : html;

// ============================== the budget ==============================
{
  // Every element carrying its own visible text, in render order.
  const lines = [...surface.matchAll(/<(p|dt|dd|button|summary)\b[^>]*>([^<]*[^\s<][^<]*)</g)].map(
    (m) => m[2].trim(),
  );
  const real = lines.filter((t) => t.length > 0);

  /*
   * The budget is not a round number picked for comfort — it is what the
   * surface renders TODAY with everything showing at once: distance,
   * instruction, road name, following turn, status, offline notice, the
   * three-cell compact strip with its labels, the HOS clocks with theirs,
   * the HOS warning line, the HOS source label, and Mute + Stop.
   *
   * Pinning it at today's count is the point. The next line added to the
   * driving surface fails this test, and whoever adds it has to say why
   * it earns a place — or take something else off. That is the only
   * defence against accretion that survives contact with a backlog.
   *
   * Two of today's twenty are the weakest, and both are owner design
   * decisions rather than defects, so they are reported and not changed:
   *
   *   "No trip loaded — showing a fresh driver's full clocks." (in a real
   *   trip: "Pilot trip loaded — clocks still assume a fresh driver (no
   *   ELD linked)") is a ~55-character provenance sentence that never
   *   changes during a trip. It is also an HONESTY disclosure — the
   *   clocks are assumptions, not ELD data — so it must not simply be
   *   hidden while driving. Shortening it, or moving it past the fold
   *   with the caveat preserved some other way, is the owner's call.
   *
   *   "Clocks are comfortable." is the absence of a warning. A driver does
   *   not need to read "nothing is wrong" at a glance, but suppressing it
   *   changes the HOS strip's own design.
   */
  check('glance: the above-the-fold boundary was actually found', foldAt > 0);

  const BUDGET = 20;
  check(
    `glance: the driving surface shows at most ${BUDGET} text lines with everything on`,
    real.length <= BUDGET,
    real,
  );
  check('glance: and it is not trivially empty', real.length >= 6, real.length);
  console.log(`  measured: ${real.length} text lines on the busiest driving surface`);
}

// ============================== the hierarchy ===========================
{
  // Tailwind's scale, in rendering order. Only the classes these surfaces
  // actually use need weights.
  const SCALE: Record<string, number> = {
    'text-sm': 1,
    'text-base': 2,
    'text-lg': 3,
    'text-xl': 4,
    'text-2xl': 5,
    'text-3xl': 6,
    'text-4xl': 7,
  };
  function sizeOf(fragment: string): number {
    let best = 0;
    for (const m of fragment.matchAll(/(?:^|\s|")(?:sm:)?(text-(?:sm|base|lg|xl|\dxl))/g)) {
      best = Math.max(best, SCALE[m[1]] ?? 0);
    }
    return best;
  }

  // The instruction element, by the class combination only it carries.
  const instrMatch = /<p[^>]*class="[^"]*line-clamp-2[^"]*"[^>]*>/.exec(surface);
  check('hierarchy: the instruction line is present', instrMatch !== null);
  const instrSize = instrMatch === null ? 0 : sizeOf(instrMatch[0]);

  const distMatch = /<p class="([^"]*)">\s*In\s/.exec(surface);

  /*
   * Design Blueprint Phase 1 inverted the top of this hierarchy, by owner
   * decision (blueprint law 5: numerals are the biggest thing on screen):
   * the DISTANCE numeral is now the largest element, and the instruction
   * is the largest PROSE beneath it. The distance line's size comes from
   * the --size-maneuver design variable (60px — larger than every Tailwind
   * size class this surface uses), so the static proof is that the
   * distance <p> reads that variable, in the data face, with tabular
   * figures — and that no other element reaches even the instruction.
   */
  check(
    'hierarchy: the distance numeral is the largest thing on the screen',
    distMatch !== null &&
      distMatch[1].includes('var(--size-maneuver)') &&
      distMatch[1].includes('font-data') &&
      distMatch[1].includes('num-data'),
    distMatch?.[1],
  );
  check('hierarchy: the TURN is the largest prose on the screen', instrSize >= 5, instrSize);

  // Nothing else on the surface may tie or beat the instruction on the
  // Tailwind scale…
  const others = [...surface.matchAll(/<(?:p|div|dl|dd|dt|button)\b[^>]*class="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((c) => !c.includes('line-clamp-2'));
  const biggestOther = Math.max(0, ...others.map((c) => sizeOf(`"${c}"`)));
  check('hierarchy: nothing else is as large as the turn', biggestOther < instrSize, {
    biggestOther,
    instrSize,
  });
  // …and nothing may borrow the maneuver numeral's size variable: at most
  // the distance line and its decorative arrow (which shares the visual
  // row and is aria-hidden) may read it. Anything else claiming that size
  // is a new largest element smuggled past the token scan.
  const maneuverSized = (surface.match(/var\(--size-maneuver\)/g) ?? []).length;
  check(
    'hierarchy: only the distance row reads the maneuver size',
    maneuverSized >= 1 && maneuverSized <= 2,
    maneuverSized,
  );

  // The map is the surface's primary element and must not be crowded out.
  check(
    'glance: the map still owns the space the readouts do not',
    surface.includes('data-test-map="live"') && /min-h-\[38dvh\] flex-1/.test(surface),
  );
  // The maneuver comes FIRST, above the map: a driver looking down reads
  // the turn before anything else.
  check(
    'glance: the turn is read before the map',
    surface.indexOf('line-clamp-2') < surface.indexOf('data-test-map="live"'),
  );
}

// ============================== nothing decorative ======================
{
  // Everything on this surface must be information. No branding, no
  // marketing, no navigation chrome competing with the turn.
  check(
    'glance: no site chrome on the driving surface',
    !/Trucking Life|Founder|Shop|Newsletter|Subscribe/i.test(surface),
  );
  check(
    'glance: state is never carried by colour alone — the status is text',
    /role="status"/.test(surface) && /Navigating/.test(surface),
  );
}

console.log(`navigator-glanceability: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
