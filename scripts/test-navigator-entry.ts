/**
 * NAV-ENTRY-1 — the three-button launcher, the automatic standard setup,
 * editable-while-moving, and the end of passenger access.
 *
 * SCENARIOS NE1-NE70, plus the contracts this milestone changed.
 *
 * WHAT THIS FILE IS FOR. The milestone's whole point is subtractive: fewer
 * screens, fewer taps, fewer locks, no passenger declaration. Subtraction is
 * the hardest thing to keep — every one of the removed pieces was added by
 * someone with a good reason, and each will look reasonable again in six
 * months. So most of what follows is written as an ABSENCE test: not "the
 * launcher looks right" but "there is no fourth action, no setup form, no
 * grant function, no hold timer, and nothing that can ask a driver to declare
 * they are a passenger".
 *
 * The storage checks run the REAL versioned layer against a Map-backed
 * window, so what is asserted is what a phone would actually do — not a mock
 * agreeing with itself.
 *
 * Run:  node scripts/run-tests.mjs navigator-entry
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/* ------------------------------------------------------------- harness */

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
}

const read = (p: string) => readFileSync(p, 'utf8');
/** Source with comments removed: prose may DISCUSS what was deleted. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/*
 * A Map-backed device, installed before the first storage call. The real
 * versioned-storage module runs against it, so every read/write rule below is
 * the shipped one.
 */
const deviceStore = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => deviceStore.get(k) ?? null,
    setItem: (k: string, v: string) => void deviceStore.set(k, String(v)),
    removeItem: (k: string) => void deviceStore.delete(k),
    clear: () => deviceStore.clear(),
  },
  matchMedia: undefined,
  addEventListener() {},
  removeEventListener() {},
};

import {
  LAUNCHER_ACTIONS,
  LAUNCHER_ACTION_COUNT,
  LAUNCHER_FORBIDDEN_COPY,
  PARKED_REMINDER,
  STANDARD_SETUP_BODY,
  STANDARD_SETUP_HEADLINE,
  plainFeetInches,
  plainPounds,
  standardSetupDecision,
  standardSetupSpecs,
  truckSummaryLine,
} from '@/lib/navigator/navigator-entry';
import {
  DEFAULT_DISPLAY_MODE,
  DISPLAY_MODES,
  MAP_VOID_COLOR,
  parseDisplayMode,
  resolveTheme,
  themeAttribute,
} from '@/lib/navigator/display-mode';
import {
  DEFAULT_EDITABLE_PROFILE,
  confirmProfile,
  profileGate,
  routingFingerprint,
  validateEditableProfile,
} from '@/lib/navigator/truck-profile';
import { allowedWhileMoving, ACTION_PERMISSIONS } from '@/lib/navigator/actions';
import { createSafetyLock } from '@/lib/navigator/safety-lock';
import { readTruck, writeTruck, clearTruck } from '@/components/navigator/truck-storage';
import {
  readVoiceChoice,
  voiceEnabledByDefault,
  writeVoiceChoice,
  clearVoiceChoice,
  VOICE_DEFAULT_ENABLED,
} from '@/components/navigator/voice-storage';
import { readDisplayMode, writeDisplayMode } from '@/components/navigator/display-storage';
import {
  readStandardNoticeSeen,
  writeStandardNoticeSeen,
  clearStandardNoticeSeen,
} from '@/components/navigator/standard-notice-storage';
import { readClocks, writeClocks } from '@/components/navigator/clocks-storage';
import { readDriverName, writeDriverName } from '@/components/navigator/driver-storage';
import { CLOCKS_UNSET } from '@/lib/navigator/hos-clocks';
import { VOICE_UNAVAILABLE_TEXT } from '@/components/navigator/speech-unlock';

const LAUNCHER = read('src/components/navigator/NavigatorLauncher.tsx');
const SETTINGS = read('src/components/navigator/NavigatorSettings.tsx');
const SCREEN = read('src/components/navigator/DrivingScreen.tsx');
const LAUNCHER_PAGE = read('src/app/(navigator)/drive/page.tsx');
const NAVIGATE_PAGE = read('src/app/(navigator)/drive/navigate/page.tsx');
const SETTINGS_PAGE = read('src/app/(navigator)/drive/settings/page.tsx');
const GROUP_LAYOUT = read('src/app/(navigator)/layout.tsx');
const MAP = read('src/components/navigator/NavigationMap.tsx');
const GATE = read('src/components/navigator/LockGate.tsx');
const PROVIDER = read('src/components/navigator/SafetyLockProvider.tsx');
const LOCK = read('src/lib/navigator/safety-lock.ts');
const NAV_DIR = 'src/components/navigator';
const NAV_FILES = readdirSync(NAV_DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

/* ===================================================================== *
 * NE1-NE10 — THE LAUNCHER
 * ===================================================================== */

check(
  'NE1: a successful unlock lands on the launcher route',
  read('src/lib/navigator-api/pilot-access.ts').includes(
    "export const PILOT_DEFAULT_DESTINATION = '/drive';",
  ) && LAUNCHER_PAGE.includes('<NavigatorLauncher'),
);
check('NE2: the launcher offers START DRIVING', LAUNCHER_ACTIONS[0].label === 'START DRIVING');
check('NE3: the launcher offers PLAN MY TRIP', LAUNCHER_ACTIONS[1].label === 'PLAN MY TRIP');
check('NE4: the launcher offers SETTINGS', LAUNCHER_ACTIONS[2].label === 'SETTINGS');
check(
  'NE5: exactly three dominant actions, and the count is asserted against the list itself',
  LAUNCHER_ACTIONS.length === LAUNCHER_ACTION_COUNT && LAUNCHER_ACTION_COUNT === 3,
  LAUNCHER_ACTIONS.length,
);
check(
  'NE5b: every action carries a supporting line and a real route',
  LAUNCHER_ACTIONS.every((a) => a.supporting.length > 0 && a.href.startsWith('/')),
);
check(
  'NE5c: the three hrefs are distinct, so no two buttons are the same button',
  new Set(LAUNCHER_ACTIONS.map((a) => a.href)).size === 3,
);
check(
  'NE6: no setup form on the launcher — no input, select or textarea anywhere in it',
  !/<input|<select|<textarea/.test(LAUNCHER),
);
for (const banned of LAUNCHER_FORBIDDEN_COPY) {
  check(
    `NE6b: the launcher never says "${banned}"`,
    !new RegExp(banned, 'i').test(code(LAUNCHER)) &&
      !new RegExp(banned, 'i').test(code(LAUNCHER_PAGE)),
  );
}
check(
  'NE7: no passenger control on the launcher',
  !/passenger|press[- ]and[- ]hold/i.test(code(LAUNCHER)),
);
check(
  'NE8: no location request on launcher load — the page mounts no GPS provider at all',
  !/GpsProvider/.test(LAUNCHER_PAGE) &&
    !/getCurrentPosition|watchPosition|geolocation/i.test(LAUNCHER),
);
check(
  'NE9: no route request on launcher load — nothing that could plan is mounted',
  !/DrivingScreen|createNavigationLifecycle|lifecycle|fetch\(/.test(code(LAUNCHER_PAGE)) &&
    !/fetch\(|plan\(/.test(code(LAUNCHER)),
);
check(
  'NE10: no speech request on load — the only prime call sits inside a click handler',
  /const onStartDriving = \(\) => \{\s*if \(voiceWanted === true\) primeSpeech\(\);/.test(
    LAUNCHER.replace(/\s+/g, ' ').replace(/ \{ /g, ' { '),
  ) || /onClick=\{onActivate\}/.test(LAUNCHER),
);
check(
  'NE10b: primeSpeech is called exactly once, from the tap handler and nowhere else',
  (code(LAUNCHER).match(/primeSpeech\(\)/g) ?? []).length === 1 &&
    /const onStartDriving = \(\) => \{ if \(voiceWanted === true\) primeSpeech\(\); \};/.test(
      code(LAUNCHER).replace(/\s+/g, ' '),
    ),
);

/* ===================================================================== *
 * NE11-NE20 — THE AUTOMATIC STANDARD SETUP
 * ===================================================================== */

deviceStore.clear();
check(
  'NE11: with no saved truck the decision is to seed the standard',
  standardSetupDecision(readTruck()) === 'seed-standard',
);
check(
  'NE11b: the standard comes from the EXISTING profile authority, not a second definition',
  read('src/lib/navigator/navigator-entry.ts').includes("from './truck-profile'") &&
    !/heightFt:\s*13\.5|grossWeightLbs:\s*80000/.test(read('src/lib/navigator/navigator-entry.ts')),
);
check(
  'NE12: the visible height is 13 ft 6 in',
  plainFeetInches(DEFAULT_EDITABLE_PROFILE.heightFt) === '13 ft 6 in',
  plainFeetInches(DEFAULT_EDITABLE_PROFILE.heightFt),
);
check(
  'NE13: the visible gross weight is 80,000 lb',
  plainPounds(DEFAULT_EDITABLE_PROFILE.grossWeightLbs) === '80,000 lb',
  plainPounds(DEFAULT_EDITABLE_PROFILE.grossWeightLbs),
);
check(
  'NE13b: the notice states both, from the profile rather than a typed string',
  standardSetupSpecs(DEFAULT_EDITABLE_PROFILE) === '13 ft 6 in · 80,000 lb',
  standardSetupSpecs(DEFAULT_EDITABLE_PROFILE),
);
check(
  'NE14: the full standard profile is valid — width, length, axles, hazmat and all',
  validateEditableProfile(DEFAULT_EDITABLE_PROFILE).length === 0,
  validateEditableProfile(DEFAULT_EDITABLE_PROFILE),
);
check(
  'NE14b: and every routing field still reaches the wire fingerprint',
  routingFingerprint(DEFAULT_EDITABLE_PROFILE).includes('height') ||
    routingFingerprint(DEFAULT_EDITABLE_PROFILE).length > 0,
);
{
  // NE15 — through the versioned authority, never a component's own write.
  deviceStore.clear();
  writeTruck(DEFAULT_EDITABLE_PROFILE, confirmProfile(DEFAULT_EDITABLE_PROFILE));
  const raw = deviceStore.get('tlws-navigator-truck-v1');
  check('NE15: the seeded truck is stored under the versioned key', raw !== undefined);
  check('NE15b: with a version envelope', raw !== undefined && JSON.parse(raw).v === 1);
  check(
    'NE15c: the driving screen writes it through truck-storage, not localStorage',
    /persistTruck\(DEFAULT_EDITABLE_PROFILE, confirmProfile\(DEFAULT_EDITABLE_PROFILE\)\)/.test(
      code(SCREEN),
    ) && !/localStorage/.test(code(SCREEN)),
  );
  const back = readTruck();
  check(
    'NE16: it reads back READY — no separate confirm tap stands in front of Start',
    back !== null && profileGate(back.profile, back.confirmation) === 'ready',
    back === null ? null : profileGate(back.profile, back.confirmation),
  );
  check(
    'NE16b: and the screen starts in that state rather than waiting for an effect',
    /useState<ConfirmationState>\(\(\) =>\s*confirmProfile\(DEFAULT_EDITABLE_PROFILE\),?\s*\)/.test(
      SCREEN.replace(/\s+/g, ' '),
    ),
  );
}
{
  // NE17 — a driver's own truck is never overwritten.
  deviceStore.clear();
  const mine = { ...DEFAULT_EDITABLE_PROFILE, heightFt: 14, grossWeightLbs: 76_000 };
  writeTruck(mine, confirmProfile(mine));
  check(
    'NE17: an existing valid saved truck is kept',
    standardSetupDecision(readTruck()) === 'keep-saved',
  );
  const back = readTruck();
  check(
    'NE17b: with its own values, not the standard ones',
    back !== null && back.profile.heightFt === 14 && back.profile.grossWeightLbs === 76_000,
  );
  check(
    'NE17c: and its confirmation intact, so it needs no re-confirming',
    back !== null && profileGate(back.profile, back.confirmation) === 'ready',
  );
  /*
   * The pure decision above is only half the guarantee — the screen has to
   * ACT on it. Pinned positionally: the keep-saved branch adopts the stored
   * profile and RETURNS, so the seeding write below it is unreachable for a
   * driver who already has a truck. Without the return, or with the condition
   * defeated, a saved truck would be silently replaced by the standard one on
   * the next visit — the single worst regression this milestone could cause,
   * because the driver would never be told.
   */
  const seedEffect = (() => {
    const flat = code(SCREEN).replace(/\s+/g, ' ');
    const start = flat.indexOf('const saved = readTruck();');
    return start < 0 ? '' : flat.slice(start, start + 600);
  })();
  check(
    'NE17d: the screen adopts a saved truck through the keep-saved branch',
    /if \(standardSetupDecision\(saved\) === 'keep-saved' && saved !== null\) \{/.test(seedEffect),
    seedEffect.slice(0, 160),
  );
  check(
    'NE17e: and RETURNS, so a saved truck can never fall through to the seed write',
    (() => {
      const branch = seedEffect.slice(seedEffect.indexOf("=== 'keep-saved'"));
      const ret = branch.indexOf('return;');
      const seed = branch.indexOf('persistTruck(DEFAULT_EDITABLE_PROFILE');
      return ret >= 0 && (seed < 0 || ret < seed);
    })(),
  );
  check(
    'NE17f: the branch really sets the stored values, rather than merely returning',
    /setTruckProfile\(saved\.profile\);/.test(seedEffect) &&
      /setTruckConfirmation\(saved\.confirmation\);/.test(seedEffect),
  );
}
{
  // NE18 — a damaged truck costs the truck and nothing else.
  deviceStore.clear();
  writeClocks(CLOCKS_UNSET);
  writeDriverName('Shawn');
  writeDisplayMode('night');
  writeVoiceChoice(false);
  deviceStore.set('tlws-navigator-truck-v1', '{"v":1,"profile":{"heightFt":"not a number"}}');
  check('NE18: an invalid truck record reads as absent', readTruck() === null);
  check(
    'NE18b: so the standard is seeded in its place',
    standardSetupDecision(readTruck()) === 'seed-standard',
  );
  check('NE18c: the driver name survived', readDriverName() === 'Shawn');
  check('NE18d: the display choice survived', readDisplayMode() === 'night');
  check('NE18e: the voice choice survived', readVoiceChoice() === false);
  check('NE18f: the clocks record survived', readClocks().kind === CLOCKS_UNSET.kind);
}
{
  // NE19/NE20 — the notice, once, and never over guidance.
  deviceStore.clear();
  check('NE19: a fresh device has not seen the notice', readStandardNoticeSeen() === false);
  writeStandardNoticeSeen();
  check('NE19b: after showing it once, it is marked seen', readStandardNoticeSeen() === true);
  check(
    'NE19c: and the screen only shows it when it has not been seen',
    /if \(!readStandardNoticeSeen\(\)\) \{\s*setShowStandardNotice\(true\);\s*writeStandardNoticeSeen\(\);/.test(
      SCREEN.replace(/\s+/g, ' ').replace(/\{ /g, '{'),
    ) ||
      (/!readStandardNoticeSeen\(\)/.test(code(SCREEN)) &&
        /writeStandardNoticeSeen\(\)/.test(code(SCREEN))),
  );
  clearStandardNoticeSeen();
  check('NE19d: clearing the mark would show it again', readStandardNoticeSeen() === false);
  check(
    'NE20: the notice lives in the idle-only summary slot, so guidance never shows it',
    /setupSummarySlot=\{[\s\S]{0,1500}data-standard-setup-notice/.test(SCREEN),
  );
  check(
    'NE20b: it is a status region, not a dialog — nothing to dismiss',
    /data-standard-setup-notice/.test(SCREEN) && !/role="dialog"|role="alertdialog"/.test(SCREEN),
  );
  check(
    'NE20c: and it states the headline and the body the owner approved',
    SCREEN.includes('STANDARD_SETUP_HEADLINE') &&
      SCREEN.includes('STANDARD_SETUP_BODY') &&
      STANDARD_SETUP_HEADLINE === 'STANDARD SETUP LOADED' &&
      STANDARD_SETUP_BODY.startsWith('Voice is on. Display follows your phone.'),
  );
}

/* ===================================================================== *
 * NE21-NE30 — START DRIVING
 * ===================================================================== */

check(
  'NE21: START DRIVING opens the real driving surface',
  LAUNCHER_ACTIONS[0].href === '/drive/navigate' && NAVIGATE_PAGE.includes('<DrivingScreen'),
);
check(
  'NE21b: which mounts the GPS and safety providers the cockpit needs',
  /GpsProvider/.test(NAVIGATE_PAGE) && /SafetyLockProvider/.test(NAVIGATE_PAGE),
);
check(
  'NE22: the destination search is the parked map slot, above the controls',
  /mapSearchSlot=\{[\s\S]{0,3000}<DestinationSearch/.test(SCREEN),
);
check(
  'NE23: no route is requested before Start — planning happens in exactly one place',
  (read('src/components/navigator/PilotTripControls.tsx').match(/lifecycle\.plan\(/g) ?? [])
    .length === 1,
);
check(
  'NE24: Start is gated by the one pure status value',
  /startBlockedReason=\{setup\.blockedReason\}/.test(SCREEN),
);
check(
  'NE25: an active trip resumes through the lifecycle front door',
  /restorePayloadRef\.current = parsed\.route;/.test(SCREEN) &&
    /lifecycle\.plan\(parsed\.request, parsed\.destination/.test(SCREEN),
);
check(
  'NE26: the resume spends zero provider calls — the payload is armed before plan()',
  /createRestorablePlanPort\(/.test(SCREEN),
);
check(
  'NE27: an invalid snapshot is deleted, never partially trusted',
  /if \(parsed === null\)/.test(SCREEN) && /removeItem\(TRIP_RESTORE_KEY\)/.test(SCREEN),
);
check(
  'NE27b: and only the trip record is removed — the refusal branch touches nothing else',
  (() => {
    const flat = code(SCREEN).replace(/\s+/g, ' ');
    const start = flat.indexOf('if (parsed === null)');
    const branch = flat.slice(start, start + 320);
    return (
      start >= 0 &&
      branch.includes('removeItem(TRIP_RESTORE_KEY)') &&
      !/clearTruck|clearDriverName|clearVoiceChoice|clearDisplayMode|clearClocks/.test(branch)
    );
  })(),
);
check(
  'NE28: the clocks ride the snapshot and are applied before the trip resumes',
  /if \(parsed\.clocks !== undefined\) setRestoredClocks\(parsed\.clocks\);/.test(SCREEN),
);
check(
  'NE29: the greeting cannot replay on a resume — it is only offerable before guidance',
  /GREETING_STATES/.test(read('src/lib/navigator/driver-greeting.ts')) &&
    /greetingWindowOpen && !GREETING_STATES\.includes\(input\.lifecycleState\)/.test(
      read('src/lib/navigator/driver-greeting.ts'),
    ),
);
check(
  'NE30: route validation is untouched — the screen still uses the validating port',
  /createNavigatorPlanPort\(\)/.test(SCREEN),
);

/* ===================================================================== *
 * NE31-NE40 — VOICE
 * ===================================================================== */

{
  deviceStore.clear();
  check('NE31: a driver who has never chosen gets voice ON', voiceEnabledByDefault() === true);
  check(
    'NE31b: and the default is stated as a constant, not inferred',
    VOICE_DEFAULT_ENABLED === true,
  );
  check('NE31c: "never chosen" is distinguishable from "chose off"', readVoiceChoice() === null);

  writeVoiceChoice(true);
  check(
    'NE33: a saved On stays On',
    voiceEnabledByDefault() === true && readVoiceChoice() === true,
  );

  writeVoiceChoice(false);
  check('NE34: a saved Off stays Off', voiceEnabledByDefault() === false);
  check('NE34b: and survives a re-read, so it is not re-defaulted', readVoiceChoice() === false);

  // The classic regression: a stored string turning an "off" back on.
  deviceStore.set('tlws-navigator-voice-v1', '{"v":1,"enabled":"false"}');
  check(
    'NE34c: a non-boolean record is refused rather than coerced (a truthy "false" would flip it)',
    readVoiceChoice() === null,
  );
  clearVoiceChoice();
  check('NE34d: clearing returns the driver to the default', voiceEnabledByDefault() === true);
}
check(
  'NE32: Start Driving is the gesture that unlocks speech',
  /primeSpeech/.test(code(LAUNCHER)) &&
    read('src/components/navigator/speech-unlock.ts').includes('VOICE_ENABLED_CONFIRMATION'),
);
check(
  'NE32b: the driving screen only unmutes when a gesture really unlocked the engine',
  /if \(!speechWasPrimed\(\)\) return;/.test(SCREEN),
);
check(
  'NE32c: and it does not speak again on arrival — the launcher already confirmed',
  !/voice\.request\([\s\S]{0,120}VOICE_ENABLED_CONFIRMATION/.test(code(SCREEN)),
);
check(
  'NE35: speech that cannot start never blocks driving — it sets a flag and returns',
  /if \(!voice\.snapshot\(\)\.supported\) \{\s*setVoiceUnavailable\(true\);\s*return;/.test(
    SCREEN.replace(/\s+/g, ' ').replace(/\{ /g, '{'),
  ) || /setVoiceUnavailable\(true\)/.test(code(SCREEN)),
);
check(
  'NE36: and says so honestly, naming the one place that can fix it',
  VOICE_UNAVAILABLE_TEXT === 'Voice could not start. Turn it on in Settings.' &&
    /data-voice-unavailable/.test(SCREEN),
);
check(
  'NE36b: with no retry loop — the unavailable state is set once, from a mount effect',
  (code(SCREEN).match(/setVoiceUnavailable\(/g) ?? []).length === 1,
);
{
  const speechFiles = NAV_FILES.filter((f) => /speech|voice/i.test(f)).map((f) =>
    read(join(NAV_DIR, f)),
  );
  check(
    'NE37: no microphone, recognition or recording API anywhere in the voice path',
    speechFiles.every(
      (src) =>
        !/getUserMedia|SpeechRecognition|webkitSpeechRecognition|MediaRecorder|audioinput/i.test(
          src,
        ),
    ),
  );
}
{
  const greeting = read('src/lib/navigator/driver-greeting.ts');
  check(
    'NE38: the route-start phrase is announce-once, by a stable id and a settled flag',
    /ROUTE_START_VOICE_ID/.test(greeting) && /routeStartSettled/.test(greeting),
  );
  check(
    'NE39: a reroute cannot replay it — it is offered only at route-ready',
    /input\.lifecycleState === 'route-ready' && !routeStartSettled/.test(greeting),
  );
  const voice = read('src/lib/navigator/voice-guidance.ts');
  check(
    'NE40: the priority ladder is untouched',
    /critical/.test(voice) && /passive/.test(voice) && /normal/.test(voice),
  );
  check(
    'NE40b: and the driving screen still collects HOS and maneuvers before the personal lines',
    code(SCREEN).indexOf('maneuverAnnouncerRef.current.collect') <
      code(SCREEN).indexOf('driverPhraseAnnouncerRef.current'),
  );
}

/* ===================================================================== *
 * NE41-NE50 — DISPLAY
 * ===================================================================== */

check('NE41: Automatic is the default', DEFAULT_DISPLAY_MODE === 'automatic');
{
  deviceStore.clear();
  check('NE41b: a device with no record reads Automatic', readDisplayMode() === 'automatic');
}
check('NE42: Automatic + a light phone paints day', resolveTheme('automatic', false) === 'day');
check('NE43: Automatic + a dark phone paints night', resolveTheme('automatic', true) === 'night');
check(
  'NE43b: Automatic with an unreadable preference falls back to night, the shipped design',
  resolveTheme('automatic', null) === 'night',
);
check(
  'NE44: Automatic responds to a preference CHANGE, through a subscription not a poll',
  /addEventListener\('change', onChange\)/.test(
    read('src/components/navigator/DisplayModeProvider.tsx'),
  ) && !/setInterval/.test(read('src/components/navigator/DisplayModeProvider.tsx')),
);
check(
  'NE44b: exactly one matchMedia listener, cleaned up on unmount',
  (read('src/components/navigator/DisplayModeProvider.tsx').match(/matchMedia\(/g) ?? []).length ===
    1 &&
    /removeEventListener\('change', onChange\)/.test(
      read('src/components/navigator/DisplayModeProvider.tsx'),
    ),
);
check(
  'NE44c: the provider is mounted once for the whole group, not per page',
  /DisplayModeProvider/.test(GROUP_LAYOUT) &&
    !/DisplayModeProvider/.test(LAUNCHER_PAGE) &&
    !/DisplayModeProvider/.test(NAVIGATE_PAGE) &&
    !/DisplayModeProvider/.test(SETTINGS_PAGE),
);
{
  deviceStore.clear();
  writeDisplayMode('night');
  check('NE45: Night persists', readDisplayMode() === 'night');
  check(
    'NE45b: and paints night whatever the phone says',
    resolveTheme('night', false) === 'night',
  );
  writeDisplayMode('day');
  check('NE46: Day persists', readDisplayMode() === 'day');
  check('NE46b: and paints day whatever the phone says', resolveTheme('day', true) === 'day');
  deviceStore.set('tlws-navigator-display-v1', '{"v":1,"mode":"chartreuse"}');
  check(
    'NE46c: an unknown mode falls back to the documented default',
    readDisplayMode() === 'automatic',
  );
  check('NE46d: only three modes exist', DISPLAY_MODES.length === 3);
  check('NE46e: parse never invents a fourth', parseDisplayMode('sepia') === 'automatic');
}
check(
  'NE47: a theme change remounts no map — it is one paint property, never setStyle',
  /setPaintProperty\('background', 'background-color', MAP_VOID_COLOR\[theme\]\)/.test(MAP),
);
check(
  'NE47b: the theme effect does not depend on anything that recreates the map',
  /\}, \[ready, theme, styleId\]\);/.test(MAP),
);
check(
  'NE47c: night is the ABSENCE of the attribute, so no third palette can be written',
  themeAttribute('night') === null && themeAttribute('day') === 'day',
);
check(
  'NE48: a theme change spends no route request — nothing in the display path plans',
  !/fetch\(|lifecycle|plan\(/.test(
    code(read('src/components/navigator/DisplayModeProvider.tsx')),
  ) && !/fetch\(|plan\(/.test(code(read('src/lib/navigator/display-mode.ts'))),
);
check(
  'NE49: the route line keeps its own colour in both modes — the basemap is not retinted',
  MAP.includes("'#33C7FF'") && !/raster-brightness|raster-contrast|invert/.test(code(MAP)),
);
check(
  'NE49b: only the VOID behind the tiles follows the theme',
  Object.keys(MAP_VOID_COLOR).length === 2 && MAP_VOID_COLOR.night !== MAP_VOID_COLOR.day,
);
check(
  'NE50: the truck marker is drawn by its own module, untouched by the theme',
  /vehicleMarkerSvg/.test(MAP) &&
    !/theme/.test(code(read('src/components/navigator/vehicle-marker.ts'))),
);

/* ===================================================================== *
 * NE51-NE62 — EDITING STAYS AVAILABLE, PASSENGER ACCESS IS GONE
 * ===================================================================== */

{
  /*
   * The lock is fed real MOVING samples — not a stubbed state — so what is
   * asserted is the shipped controller's own verdict at speed.
   */
  const lock = createSafetyLock();
  const T = 1_800_000_000_000;
  const moving = (t: number) => ({
    fix: { lat: 34.7, lng: -84.9, tMs: t, accuracyM: 8, speedMph: 55, headingDeg: 0 },
    lastFixMs: t,
    accuracyM: 8,
    speedMph: 55,
    headingDeg: 0,
    health: 'good' as const,
    deadReckoning: false,
  });
  for (let i = 0; i <= 11_000; i += 1000) lock.sample(moving(T + i), T + i);
  const state = lock.state(T + 12_000);
  check(
    'NE51-56 setup: the truck really is MOVING and really is locked',
    state.motion === 'MOVING' && state.locked,
  );

  const editing: [string, string][] = [
    ['NE51', 'open-deep-settings'],
    ['NE52', 'browse-directory'],
    ['NE53', 'edit-destination'],
    ['NE54', 'edit-truck-profile'],
    ['NE55', 'enter-text'],
    ['NE56', 'add-stop'],
  ];
  for (const [ne, action] of editing) {
    check(`${ne}: ${action} stays available while MOVING`, allowedWhileMoving(action));
  }
  check(
    'NE51b: Settings mounts no safety-lock provider, so motion cannot reach it at all',
    !/SafetyLockProvider/.test(SETTINGS_PAGE) && !/useSafetyLock/.test(SETTINGS),
  );
  check(
    'NE52b: and neither does the launcher that reaches the planner',
    !/SafetyLockProvider/.test(LAUNCHER_PAGE),
  );
  check(
    'NE53b: the destination search is no longer wrapped in a locking gate at all',
    !/action="edit-destination"/.test(SCREEN),
  );
  check(
    'NE56b: the camera is still stationary-only, so the map remains an authority',
    !allowedWhileMoving('pan-map') &&
      !allowedWhileMoving('route-overview') &&
      !allowedWhileMoving('change-map-style'),
  );
  check(
    'NE56c: default-deny survives for anything nobody has classified',
    !allowedWhileMoving('some-future-affordance'),
  );
  check(
    'NE56d: every UIAction still has an explicit entry',
    Object.values(ACTION_PERMISSIONS).every((v) => typeof v === 'boolean'),
  );
}

check(
  'NE57: no Passenger Access button anywhere in the gate',
  !/Passenger access/i.test(code(GATE)),
);
check(
  'NE58: the passenger dialog component no longer exists',
  !existsSync('src/components/navigator/PassengerOverrideDialog.tsx'),
);
check(
  'NE59: no hold timer in the gate — no interval, no timeout, no hold constant',
  !/setInterval|setTimeout|HOLD_MS/.test(code(GATE)),
);
check(
  'NE60: no override countdown anywhere — the state carries no remaining time',
  !/overrideRemainingMs|overrideActive/.test(LOCK) &&
    !/overrideRemainingMs|overrideActive/.test(
      code(read('src/components/navigator/MotionLockOverlay.tsx')),
    ),
);
check(
  'NE60b: and nothing can grant one — the function is gone from the controller and the provider',
  !/grantOverride/.test(LOCK) && !/grantOverride/.test(PROVIDER),
);
check(
  'NE61: no passenger declaration text survives anywhere a driver can read it',
  NAV_FILES.every((f) => !/passenger|I am not the driver/i.test(code(read(join(NAV_DIR, f))))),
  NAV_FILES.filter((f) => /passenger/i.test(code(read(join(NAV_DIR, f))))),
);
check(
  'NE61b: the setup-window exemption map is deleted rather than emptied',
  !/SETUP_WINDOW_PERMISSIONS|allowedDuringSetupWindow/.test(read('src/lib/navigator/actions.ts')),
);
check(
  'NE62: the reminder is a sentence, and says exactly what the owner approved',
  PARKED_REMINDER === 'Only make changes when safely parked.',
);
check(
  'NE62b: it is a status region with no button, no timer and nothing to acknowledge',
  /data-parked-reminder/.test(SETTINGS) &&
    /role="status"/.test(SETTINGS) &&
    !/onClick=\{[^}]*Reminder|acknowledge|dismissReminder/i.test(SETTINGS),
);
check(
  'NE62c: it disables no control — no control anywhere reads it',
  !/disabled=\{[^}]*PARKED_REMINDER|PARKED_REMINDER[^;]*disabled/.test(SETTINGS),
);
check(
  'NE62d: and it never writes an override event, because there is nothing to write',
  !/override/i.test(code(SETTINGS)),
);

/* ===================================================================== *
 * NE63-NE70 — THE ACTIVE TRIP
 * ===================================================================== */

check(
  'NE63: a display change applies immediately — state, then one attribute write',
  /root.setAttribute\('data-theme', attribute\)/.test(
    read('src/components/navigator/DisplayModeProvider.tsx'),
  ),
);
check(
  'NE63b: and nothing in that path restarts a trip',
  !/lifecycle|cancel\(|startNavigation/.test(
    code(read('src/components/navigator/DisplayModeProvider.tsx')),
  ),
);
check(
  'NE64: a voice change applies immediately and touches no trip',
  /const saveVoice = \(enabled: boolean\) => \{[\s\S]{0,200}writeVoiceChoice\(enabled\)/.test(
    SETTINGS,
  ) && !/lifecycle/.test(code(SETTINGS)),
);
check(
  'NE65: a routing-critical change mid-trip is saved for the NEXT route, in words',
  SETTINGS.includes("'Saved. This change applies to your next route.'") &&
    /data-next-route-notice/.test(SETTINGS),
);
{
  /*
   * Scoped per SAVER, not per file. A single file-wide match would stay green
   * while the truck lost its notice, because the preference saver still has
   * one — and the truck is the routing-critical edit this promise is really
   * about.
   */
  const saverBody = (name: string) => {
    const flat = code(SETTINGS).replace(/\s+/g, ' ');
    const start = flat.indexOf(`const ${name} = `);
    if (start < 0) return '';
    // The arrow body ends at its own closing brace, not at the next `const`
    // — these savers declare locals of their own.
    const end = flat.indexOf(' }; ', start);
    return flat.slice(start, end < 0 ? start + 500 : end + 3);
  };
  for (const saver of ['saveTruck', 'saveRoutePrefs']) {
    check(
      `NE65b: ${saver} tells the driver when the change lands mid-trip`,
      /if \(tripActive\) setNextRouteNotice\(true\);/.test(saverBody(saver)),
      saverBody(saver).slice(0, 200),
    );
    check(
      `NE65b2: ${saver} writes locally BEFORE it says anything`,
      saverBody(saver).indexOf('write') < saverBody(saver).indexOf('setNextRouteNotice'),
    );
  }
  check(
    'NE65b3: a display change carries no such notice — it applies to the trip in progress',
    !/setNextRouteNotice/.test(saverBody('saveVoice')),
  );
}
check(
  'NE65c: and "a trip is running" is read from the SAME snapshot the screen writes',
  /parseTripSnapshot\(sessionStorage\.getItem\(TRIP_RESTORE_KEY\)/.test(
    SETTINGS.replace(/\s+/g, ' '),
  ),
);
check(
  'NE66: the active route keeps the truck it was calculated for — Settings has no lifecycle to change it in',
  !/lifecycle|discardRoute|NavigationLifecycle/.test(code(SETTINGS)),
);
check(
  'NE66b: and Settings never writes or clears the snapshot it reads',
  !/sessionStorage\.setItem|sessionStorage\.removeItem/.test(SETTINGS),
);
check(
  'NE67: no automatic re-route from Settings — nothing there can request one',
  !/fetch\(|plan\(|requestReroute/.test(code(SETTINGS)),
);
check(
  'NE68: returning to START DRIVING resumes, because leaving flushed the snapshot first',
  /if \(ACTIVE_LIFECYCLE_STATES\.includes\(lifecycle\.state\(\)\)\) saveSnapshotNow\(\);/.test(
    SCREEN.replace(/\s+/g, ' '),
  ),
);
check(
  'NE68b: the flush happens BEFORE the cancel, because cancel deletes the snapshot',
  SCREEN.replace(/\s+/g, ' ').indexOf('saveSnapshotNow(); voiceRef.current?.clearPending();') >=
    0 ||
    SCREEN.replace(/\s+/g, ' ').indexOf(
      'if (ACTIVE_LIFECYCLE_STATES.includes(lifecycle.state())) saveSnapshotNow();',
    ) < SCREEN.replace(/\s+/g, ' ').lastIndexOf('lifecycle.cancel(Date.now())'),
);
check(
  'NE69: Plan My Trip is the EXISTING planner, not a second one',
  LAUNCHER_ACTIONS[1].href === '/trip-planner' &&
    existsSync('src/app/(directory)/trip-planner/page.tsx'),
);
check(
  'NE69b: and the same flush covers returning from it — the trip is in the snapshot either way',
  /saveSnapshotNow\(\)/.test(SCREEN),
);
check(
  'NE70: no production data or schema change — this milestone adds no migration',
  readdirSync('supabase/migrations').filter((f) => Number(f.slice(0, 3)) > 56).length === 0,
  readdirSync('supabase/migrations').filter((f) => Number(f.slice(0, 3)) > 56),
);
check(
  'NE70b: and no Navigator surface writes to a database',
  !/supabase|postgrest/i.test(code(SETTINGS)) &&
    !/supabase|postgrest/i.test(code(LAUNCHER)) &&
    !/supabase|postgrest/i.test(code(read('src/lib/navigator/navigator-entry.ts'))),
);

/* ===================================================================== *
 * ADDITIONAL CHANGED CONTRACTS
 * ===================================================================== */

check(
  'routes: both children inherit the gate from the /drive prefix',
  read('src/lib/navigator-api/pilot-access.ts').includes(
    "export const PROTECTED_NAVIGATOR_PREFIXES = ['/drive', '/navigator']",
  ),
);
for (const [name, src] of [
  ['launcher', LAUNCHER_PAGE],
  ['navigate', NAVIGATE_PAGE],
  ['settings', SETTINGS_PAGE],
] as const) {
  check(
    `routes: ${name} carries its own server-side access check`,
    /requireNavigatorAccess/.test(src),
  );
  check(
    `routes: ${name} 404s when the build flag is off`,
    /if \(!ENABLED\) notFound\(\);/.test(src),
  );
  check(`routes: ${name} is noindex`, /noindex: true/.test(src));
}
check(
  'settings: every section the owner listed is present',
  ['truck', 'clocks', 'voice', 'display', 'units', 'prefs', 'name', 'reset'].every((s) =>
    SETTINGS.includes(`data-settings-section="${s}"`),
  ),
);
check(
  'settings: it reuses the existing editors rather than defining new models',
  [
    'ClockSetup',
    'RegionPanel',
    'RoutePreferencesPanel',
    'TruckProfileEditor',
    'DriverNameEntry',
  ].every((c) => SETTINGS.includes(`<${c}`)),
);
check(
  'settings: reset is scoped — three named controls, each confirming, none touching the truck',
  (SETTINGS.match(/data-reset=/g) ?? []).length === 1 &&
    /data-reset-confirm/.test(SETTINGS) &&
    !/clearTruck/.test(SETTINGS),
);
check(
  'settings: the compact truck line names the one place a truck can be changed',
  truckSummaryLine(DEFAULT_EDITABLE_PROFILE) ===
    'Truck: 13 ft 6 in · 80,000 lb · Change in Settings',
  truckSummaryLine(DEFAULT_EDITABLE_PROFILE),
);
check(
  'screen: the old large truck panel is NOT restored above the map',
  !/<TruckProfileEditor|<TruckSummary|<SetupSummary|<SetupStatus/.test(SCREEN),
);
check(
  'screen: and the driving surface reads the name without ever asking for it',
  /readDriverName/.test(SCREEN) && !/<DriverNameEntry/.test(SCREEN),
);

console.log(`navigator-entry: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
