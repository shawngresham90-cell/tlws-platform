#!/usr/bin/env node
/**
 * Mutation checks for the Navigator Fast Start milestone.
 *
 * A green test suite proves nothing on its own — a test that asserts
 * `true === true` passes forever. These mutations damage exactly one
 * safety-critical or contract-critical line each, re-run the harness,
 * and REQUIRE it to go red. A mutation that survives is reported as a
 * hole in the coverage, not as a pass.
 *
 * Every mutation is reverted afterwards, and the file is restored from
 * the captured original text even if a run throws.
 *
 * Run:  node scripts/mutate-navigator-fast-start.mjs
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

const LOCK = 'src/lib/navigator/safety-lock.ts';
const PREFS = 'src/lib/navigator/route-preferences.ts';
const GATE = 'src/lib/navigator/actions.ts';
const SETUP = 'src/lib/navigator/setup-status.ts';

/**
 * Each mutation names the DEFECT it simulates — a real way this could
 * regress — and which harness must notice.
 */
const MUTATIONS = [
  {
    /*
     * THE SAFETY-CRITICAL ONE. This is the "someone simplified it"
     * regression: grace granted on ANY signal loss rather than only
     * after a VERIFIED STATIONARY reading, which would hand a driver the
     * setup surface when a moving truck loses GPS.
     *
     * It takes two edits because the guard is deliberately doubled:
     * `stationaryLostAtMs` is only stamped while STATIONARY, and
     * `lastDetermined === 'STATIONARY'` re-checks the same fact. Mutating
     * either alone is an EQUIVALENT MUTANT — the surviving guard still
     * produces correct behaviour — so a single-line mutation staying
     * green would prove redundancy, not a coverage hole. Both must go
     * for the unsafe behaviour to actually appear.
     */
    name: 'grace is given after MOVING was determined (motion lock weakened)',
    file: LOCK,
    edits: [
      { from: "      lastDetermined === 'STATIONARY' &&\n", to: '' },
      {
        from: "      if (motion === 'STATIONARY' && stationaryLostAtMs === null) stationaryLostAtMs = nowMs;",
        to: '      if (stationaryLostAtMs === null) stationaryLostAtMs = nowMs;',
      },
    ],
    mustFail: 'navigator-fast-start',
  },
  {
    name: 'grace never expires (parked window becomes permanent)',
    file: LOCK,
    from: '      nowMs - stationaryLostAtMs < STATIONARY_GRACE_MS;',
    to: '      nowMs - stationaryLostAtMs < Number.MAX_SAFE_INTEGER;',
    mustFail: 'navigator-fast-start',
  },
  {
    name: 'one sample of real movement no longer cancels the grace',
    file: LOCK,
    from: '      stationaryLostAtMs = null;\n      belowSinceMs = null;',
    to: '      belowSinceMs = null;',
    mustFail: 'navigator-fast-start',
  },
  {
    name: 'a signal loss during setup reports itself as "moving"',
    file: LOCK,
    from: "      lockReason: !locked ? null : motion === 'MOVING' ? 'moving' : 'location-unknown',",
    to: "      lockReason: !locked ? null : 'moving',",
    mustFail: 'navigator-fast-start safety-gating',
  },
  {
    name: 'saved preferences stop reaching the wire',
    file: PREFS,
    from: '  return ROUTE_PREFERENCE_SPECS.filter((s) => prefs[s.key])',
    to: '  return ROUTE_PREFERENCE_SPECS.filter(() => false)',
    mustFail: 'navigator-fast-start',
  },
  {
    name: 'a preference change no longer invalidates the built route',
    file: PREFS,
    from: "  return preferencesToAvoid(before).join(',') !== preferencesToAvoid(after).join(',');",
    to: '  return false;',
    mustFail: 'navigator-fast-start',
  },
  {
    name: 'the OFF state of a preference goes unnamed',
    file: PREFS,
    from: "  return ROUTE_PREFERENCE_SPECS.map((s) => (prefs[s.key] ? s.onLabel : s.offLabel)).join(' · ');",
    to: "  return ROUTE_PREFERENCE_SPECS.filter((s) => prefs[s.key]).map((s) => s.onLabel).join(' · ');",
    mustFail: 'navigator-fast-start',
  },
  {
    name: 'the screen collapses over an unconfirmed truck',
    file: SETUP,
    from: "  const configured = REQUIRED_ITEMS.filter((k) => k !== 'destination').every(\n    (k) => items.find((i) => i.key === k)?.state === 'done',\n  );",
    to: '  const configured = true;',
    mustFail: 'navigator-fast-start',
  },
  {
    name: 'the blank-clocks warning hides until a destination is chosen',
    file: SETUP,
    from: "      configured && input.clocks === 'unset' ? CLOCKS_UNAVAILABLE_WARNING : null,",
    to: "      blockedReason === null && input.clocks === 'unset' ? CLOCKS_UNAVAILABLE_WARNING : null,",
    mustFail: 'navigator-fast-start',
  },
  {
    name: 'the setup window starts permitting a driving action',
    file: GATE,
    from: 'export function allowedDuringSetupWindow(action: string): boolean {',
    to: 'export function allowedDuringSetupWindow(action: string): boolean {\n  if (action) return true;',
    mustFail: 'navigator-fast-start safety-gating',
  },
];

function run(harnesses) {
  try {
    execSync(`node scripts/run-tests.mjs ${harnesses}`, { stdio: 'pipe' });
    return true; // green
  } catch {
    return false; // red
  }
}

const originals = new Map();
for (const m of MUTATIONS) {
  if (!originals.has(m.file)) originals.set(m.file, fs.readFileSync(m.file, 'utf8'));
}
const restore = () => {
  for (const [file, text] of originals) fs.writeFileSync(file, text);
};
process.on('exit', restore);
process.on('SIGINT', () => process.exit(130));

// The suite must be green BEFORE any mutation, or "it went red" proves nothing.
const harnessSet = [...new Set(MUTATIONS.flatMap((m) => m.mustFail.split(' ')))].join(' ');
if (!run(harnessSet)) {
  console.error(`BASELINE IS RED (${harnessSet}). Mutation results would be meaningless.`);
  process.exit(1);
}
console.log(`baseline green: ${harnessSet}\n`);

let survived = 0;
for (const m of MUTATIONS) {
  const original = originals.get(m.file);
  // One mutation may need several edits — see the doubled grace guard.
  const edits = m.edits ?? [{ from: m.from, to: m.to }];
  const missing = edits.filter((e) => !original.includes(e.from));
  if (missing.length > 0) {
    // An anchor that no longer matches means the mutation silently did
    // nothing. Counting that as "caught" would be the exact dishonesty
    // this script exists to prevent, so it counts as a survivor.
    console.log(`✗ NOT APPLIED  ${m.name}\n              (anchor text not found in ${m.file})`);
    survived++;
    continue;
  }
  let mutated = original;
  for (const e of edits) mutated = mutated.replace(e.from, e.to);
  if (mutated === original) {
    console.log(`✗ NO-OP EDIT   ${m.name}`);
    survived++;
    continue;
  }
  fs.writeFileSync(m.file, mutated);
  const green = run(m.mustFail);
  fs.writeFileSync(m.file, original);
  if (green) {
    console.log(
      `✗ SURVIVED     ${m.name}\n              (${m.mustFail} stayed green — coverage hole)`,
    );
    survived++;
  } else {
    console.log(`✓ caught       ${m.name}`);
  }
}

restore();
console.log(
  `\n${MUTATIONS.length - survived}/${MUTATIONS.length} mutations caught` +
    (survived ? `, ${survived} SURVIVED` : ''),
);
process.exit(survived ? 1 : 0);
