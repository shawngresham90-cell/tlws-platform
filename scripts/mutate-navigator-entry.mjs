#!/usr/bin/env node
/**
 * Mutation checks for NAV-ENTRY-1.
 *
 * A green suite proves nothing on its own. Each mutation below damages
 * exactly one thing the milestone promised, re-runs the harnesses that
 * should notice, and REQUIRES them to go red. A mutation that survives is
 * reported as a coverage hole, not as a pass.
 *
 * The ten come straight from the milestone's own list of ways this could
 * regress — every one of them is a change someone could make next year with
 * a perfectly good reason, which is exactly why each needs a test standing
 * in front of it.
 *
 * Every file is restored from its captured original, even if a run throws.
 *
 * Run:  node scripts/mutate-navigator-entry.mjs
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

const ENTRY = 'src/lib/navigator/navigator-entry.ts';
const LAUNCHER = 'src/components/navigator/NavigatorLauncher.tsx';
const SCREEN = 'src/components/navigator/DrivingScreen.tsx';
const SETTINGS = 'src/components/navigator/NavigatorSettings.tsx';
const ACTIONS = 'src/lib/navigator/actions.ts';
const GATE = 'src/components/navigator/LockGate.tsx';
const VOICE = 'src/components/navigator/voice-storage.ts';
const DISPLAY = 'src/components/navigator/DisplayModeProvider.tsx';
const MAP = 'src/components/navigator/NavigationMap.tsx';

const MUTATIONS = [
  {
    name: '1. a fourth launcher action is added',
    file: ENTRY,
    from: '] as LauncherAction[]);',
    to: `  Object.freeze({
    id: 'settings',
    label: 'QUICK SETUP',
    supporting: 'Just the truck and clocks.',
    href: '/drive/settings',
  }),
] as LauncherAction[]);`,
    mustFail: 'navigator-entry',
  },
  {
    name: '2. the launcher asks for location on load',
    file: LAUNCHER,
    from: '  useEffect(() => {\n    setVoiceWanted(voiceEnabledByDefault());\n  }, []);',
    to: '  useEffect(() => {\n    setVoiceWanted(voiceEnabledByDefault());\n    navigator.geolocation.getCurrentPosition(() => {});\n  }, []);',
    mustFail: 'navigator-entry',
  },
  {
    name: '3. a saved truck is overwritten by the standard one',
    file: SCREEN,
    from: "    if (standardSetupDecision(saved) === 'keep-saved' && saved !== null) {",
    to: '    if (false) {',
    mustFail: 'navigator-entry',
  },
  {
    name: '4. voice is forced On over a saved Off choice',
    file: VOICE,
    from: '  return stored.ok ? stored.value.enabled : null;',
    to: '  return stored.ok ? true : null;',
    mustFail: 'navigator-entry',
  },
  {
    name: '5. Passenger Access is reintroduced in the locked gate',
    file: GATE,
    from: "        <span aria-hidden=\"true\">{unknown ? '📡 ' : '⏸ '}</span>",
    to: "        <span aria-hidden=\"true\">{unknown ? '📡 ' : '⏸ '}</span>Passenger access",
    mustFail: 'navigator-entry safety-gating safety-invariants',
  },
  {
    name: '6. motion-based disabling of editing returns',
    file: ACTIONS,
    from: "  'edit-destination': true,",
    to: "  'edit-destination': false,",
    mustFail: 'navigator-entry navigator-pilot',
  },
  {
    name: '7. display mode is treated as route state (a mode change plans a route)',
    file: DISPLAY,
    from: '  const setMode = useCallback((next: DisplayMode) => {\n    setModeState(next);\n    writeDisplayMode(next);\n  }, []);',
    to: '  const setMode = useCallback((next: DisplayMode) => {\n    setModeState(next);\n    writeDisplayMode(next);\n    void fetch("/api/navigator/route");\n  }, []);',
    mustFail: 'navigator-entry',
  },
  {
    name: '8. the map is restyled on a theme change (a remount)',
    file: MAP,
    from: "        map.setPaintProperty('background', 'background-color', MAP_VOID_COLOR[theme]);",
    to: '        map.setStyle({ version: 8, sources: {}, layers: [] });',
    mustFail: 'navigator-entry',
  },
  {
    name: '9. a mid-trip truck edit is applied to the CURRENT route',
    file: SETTINGS,
    from: '    if (tripActive) setNextRouteNotice(true);\n  };\n\n  const saveRoutePrefs',
    to: '  };\n\n  const saveRoutePrefs',
    mustFail: 'navigator-entry',
  },
  {
    name: '10. leaving the driving screen drops the active trip (no flush before cancel)',
    file: SCREEN,
    from: '      if (ACTIVE_LIFECYCLE_STATES.includes(lifecycle.state())) saveSnapshotNow();',
    to: '',
    mustFail: 'navigator-entry navigator-trip-restore navigator-truck-confidence',
  },
];

function run(harnesses) {
  try {
    execSync(`node scripts/run-tests.mjs ${harnesses}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
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

const harnessSet = [...new Set(MUTATIONS.flatMap((m) => m.mustFail.split(' ')))].join(' ');
if (!run(harnessSet)) {
  console.error(`BASELINE IS RED (${harnessSet}). Mutation results would be meaningless.`);
  process.exit(1);
}
console.log(`baseline green: ${harnessSet}\n`);

let survived = 0;
for (const m of MUTATIONS) {
  const original = originals.get(m.file);
  if (!original.includes(m.from)) {
    console.log(`✗ NOT APPLIED  ${m.name}\n              (anchor text not found in ${m.file})`);
    survived += 1;
    continue;
  }
  const mutated = original.replace(m.from, m.to);
  if (mutated === original) {
    console.log(`✗ NO-OP EDIT   ${m.name}`);
    survived += 1;
    continue;
  }
  fs.writeFileSync(m.file, mutated);
  const green = run(m.mustFail);
  fs.writeFileSync(m.file, original);
  if (green) {
    console.log(
      `✗ SURVIVED     ${m.name}\n              (${m.mustFail} stayed green — coverage hole)`,
    );
    survived += 1;
  } else {
    console.log(`✓ caught       ${m.name}`);
  }
}

console.log(
  `\n${MUTATIONS.length - survived}/${MUTATIONS.length} mutations caught` +
    (survived > 0 ? ` — ${survived} SURVIVED` : ''),
);
process.exit(survived > 0 ? 1 : 0);
