/**
 * CAT Scale milestone tests — CI-safe (the proprietary CSV is NOT present in
 * CI and is not needed: these tests exercise the shared route parser, the
 * distance math, the committed safe artifacts, and the privacy / honesty
 * contracts statically).
 *
 * Release-blocking properties:
 *   - US/Canada separation and the exact source accounting
 *   - CATScaleNumber uniqueness (from the committed accounting)
 *   - ManagerName/FaxNumber appear in no committed artifact
 *   - the raw CSV is gitignored and untracked
 *   - route parser is conservative: EXIT never becomes MM, ambiguity is
 *     honest, host STORE numbers are never treated as scale numbers
 *   - runtime queries are published-only
 *   - haversine + exact 20/50/100-mile boundaries
 *   - the Near Me component never persists the driver's location
 *
 * Run: npx esbuild scripts/test-cat-scale.ts --bundle --platform=node \
 *   --format=cjs --alias:@=./src --outfile=/tmp/test-cat-scale.cjs \
 *   && node /tmp/test-cat-scale.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
// eslint-disable-next-line import/no-relative-packages -- shared with the local intake tool
import { parseRouteText, hostBrand, hostStoreNumber } from './cat-scale-route-parse.mjs';
import { haversineMiles, withDistance, sortByDistance, withinRadius } from '@/lib/map/geo';
import { stateByCode } from '@/lib/directory/states';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const IMPORT_DIR = path.join(process.cwd(), 'data/imports/cat-scale-2026-07-29');
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(IMPORT_DIR, f), 'utf8'));

/* ----------------------------------------------------- route parser: routes */
check('parses single interstate', parseRouteText('I-40, Exit 287').route === 'I-40');
check('interstate class', parseRouteText('I-40, Exit 287').routeClass === 'interstate');
check('parses "I 80" spacing', parseRouteText('I 80 Exit 12').route === 'I-80');
check('US route honest class', parseRouteText('US-287 North').routeClass === 'us-route');
check('US route value', parseRouteText('US 287').route === 'US-287');
check('state route class', parseRouteText('SR-99 at Main St').routeClass === 'state-route');
check('toll class', parseRouteText('Ohio Turnpike Plaza').routeClass === 'toll');
check(
  'street address is unknown',
  parseRouteText('2525 32nd Avenue N.E.').routeClass === 'unknown',
);
check(
  'two interstates → ambiguous, no route claimed',
  (() => {
    const p = parseRouteText('I-35 & I-80 junction, Exit 126');
    return p.routeClass === 'multiple-interstates' && p.route === null && p.exit === null;
  })(),
);

/* ------------------------------------------------------ route parser: exits */
check('single exit parsed', parseRouteText('I-40, Exit 287').exit === '287');
check('lettered exit kept', parseRouteText('I-75 Exit 41A').exit === '41A');
check('exit range rejected', parseRouteText('I-90, Exit 12/13').exit === null);
check('two exit tokens rejected', parseRouteText('I-20 Exit 5 or Exit 6').exit === null);
check('exit without interstate not claimed', parseRouteText('US-30, Exit 4').exit === null);

/* -------------------------------------------- EXIT never becomes a mile marker */
check('exit is NEVER copied into mileMarker', parseRouteText('I-40, Exit 287').mileMarker === null);
check(
  'no MM without explicit token (big sample of shapes)',
  ['I-10 Exit 4', 'I-95 Exit 12B', 'Exit 100, I-70', 'I-5, Exit 99 SB'].every(
    (t) => parseRouteText(t).mileMarker === null,
  ),
);
check('explicit mile marker parsed', parseRouteText('I-80 mile marker 318.5').mileMarker === 318.5);
check('explicit MM token parsed', parseRouteText('I-15 MM 12').mileMarker === 12);
check('milepost token parsed', parseRouteText('I-70 milepost 44').mileMarker === 44);

/* ------------------------------------------------- route parser: direction */
check('northbound parsed', parseRouteText('I-65 Exit 208 northbound').direction === 'northbound');
check('SB shorthand parsed', parseRouteText('I-5, Exit 99 SB').direction === 'southbound');
check('no direction invented', parseRouteText('I-40, Exit 287').direction === null);

/* --------------------------------------------- host store number ≠ scale number */
check('store number extracted', hostStoreNumber("Love's Travel Stop #368") === '368');
check('brand detected', hostBrand("Love's Travel Stop #368") === 'loves');
const intakeSrc = fs.readFileSync(path.join(process.cwd(), 'scripts/cat-scale-intake.mjs'), 'utf8');
check(
  'intake never compares a host STORE number to a CAT scale number',
  !/hostStoreNumber\([^)]*\)\s*={2,3}\s*[^=\n]*catScaleNumber|catScaleNumber\s*={2,3}\s*[^=\n]*hostStoreNumber/.test(
    intakeSrc,
  ),
);
check(
  'intake verifies the pinned SHA-256 before parsing',
  intakeSrc.includes('82d72c33bea798e3d4fdac9af4ac17c8f05f55c8ae3814253008026035b8f959') &&
    /checksum mismatch/.test(intakeSrc),
);
check(
  'intake strips ManagerName/FaxNumber at the privacy boundary',
  /PRIVATE_COLUMNS = \['ManagerName', 'FaxNumber'\]/.test(intakeSrc) &&
    !/managerName|faxNumber/.test(intakeSrc.replace(/ManagerName|FaxNumber/g, '')),
);

/* ------------------------------------------------------- committed artifacts */
// Owner use policy (USE-POLICY.md, 2026-07-29): the committed directory may
// hold aggregates + documentation ONLY. Anything tabulated from the export
// (scale-number maps, the Canada manifest) lives in gitignored local/.
const COMMITTED_ALLOWLIST = new Set([
  'ACCOUNTING.json',
  'SOURCE.md',
  'PROPOSED-IMPORT-PLAN.md',
  'USE-POLICY.md',
]);
const committedFiles = fs
  .readdirSync(IMPORT_DIR)
  .filter((f) => fs.statSync(path.join(IMPORT_DIR, f)).isFile());
check(
  'use policy: committed dir holds aggregates/docs only (no tabulated manifests)',
  committedFiles.every((f) => COMMITTED_ALLOWLIST.has(f)) &&
    !committedFiles.includes('RECONCILIATION.json') &&
    !committedFiles.includes('CANADA-HELD-MANIFEST.json'),
  committedFiles,
);
check('use policy: USE-POLICY.md committed', committedFiles.includes('USE-POLICY.md'));
check(
  'use policy: intake writes tabulated manifests to local/ only',
  /LOCAL_DIR, 'RECONCILIATION\.json'/.test(intakeSrc) &&
    /LOCAL_DIR, 'CANADA-HELD-MANIFEST\.json'/.test(intakeSrc),
);
const accounting = readJson('ACCOUNTING.json');
check('accounting: 2,339 total records', accounting.totals.all === 2339);
check('accounting: 2,289 US records', accounting.totals.us === 2289);
check('accounting: 50 Canada-held records', accounting.totals.canadaHeld === 50);
check(
  'accounting: US + Canada = total',
  accounting.totals.us + accounting.totals.canadaHeld === accounting.totals.all,
);
check('accounting: zero unknown-state rows', accounting.totals.unknownState === 0);
check(
  'accounting: every CATScaleNumber unique and non-blank',
  accounting.totals.uniqueNonBlankScaleNumbers === 2339 &&
    accounting.totals.blankScaleNumbers === 0 &&
    accounting.totals.duplicateScaleNumbers === 0,
);
check(
  'accounting: all coordinates valid (US and Canada)',
  accounting.totals.usValidCoords === 2289 && accounting.totals.canadaValidCoords === 50,
);
check(
  'accounting: route classes sum to 2,289 (complete highway accounting)',
  Object.values(accounting.usRouteClasses as Record<string, number>).reduce((a, b) => a + b, 0) ===
    2289,
);
check(
  'accounting: state counts sum to 2,289 (complete state accounting)',
  Object.values(accounting.usStateCounts as Record<string, number>).reduce((a, b) => a + b, 0) ===
    2289,
);
check(
  'accounting: reconciliation classes sum to 2,289 (each row exactly once)',
  Object.values(accounting.reconciliation as Record<string, number>).reduce((a, b) => a + b, 0) ===
    2289,
);
check(
  'accounting: multi-scale complexes acknowledged (never deduped by address alone)',
  accounting.multiScaleComplexes.complexes > 0 &&
    accounting.multiScaleComplexes.scalesInvolved > accounting.multiScaleComplexes.complexes,
);

const LOCAL_REC = path.join(IMPORT_DIR, 'local/RECONCILIATION.json');
const LOCAL_CA = path.join(IMPORT_DIR, 'local/CANADA-HELD-MANIFEST.json');
if (!fs.existsSync(LOCAL_REC) || !fs.existsSync(LOCAL_CA)) {
  console.log(
    'note: local/ manifests absent (CI) — content checks covered by ACCOUNTING aggregates',
  );
}
const reconciliation = fs.existsSync(LOCAL_REC)
  ? JSON.parse(fs.readFileSync(LOCAL_REC, 'utf8'))
  : null;
const CLASSES = new Set([
  'exact-match',
  'enrichment-candidate',
  'net-new',
  'possible-duplicate',
  'multi-scale-complex',
  'identity-conflict',
  'quarantined',
]);
if (reconciliation) {
  const recEntries = Object.entries(reconciliation.us as Record<string, { class: string }>);
  check('reconciliation (local): exactly 2,289 US rows classified', recEntries.length === 2289);
  check(
    'reconciliation (local): every class is a known class',
    recEntries.every(([, v]) => CLASSES.has(v.class)),
  );
}

const CA_PROVINCES = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));
if (fs.existsSync(LOCAL_CA)) {
  const canadaManifest = JSON.parse(fs.readFileSync(LOCAL_CA, 'utf8'));
  check(
    'canada manifest (local): exactly 50 rows held',
    canadaManifest.count === 50 && canadaManifest.rows.length === 50,
  );
  check(
    'canada manifest (local): only Canadian provinces',
    canadaManifest.rows.every((r: { province: string }) => CA_PROVINCES.has(r.province)),
  );
  check(
    'canada manifest (local): no coordinates/addresses/phones reproduced',
    canadaManifest.rows.every(
      (r: Record<string, unknown>) =>
        !('lat' in r) &&
        !('lng' in r) &&
        !('address' in r) &&
        !('phone' in r) &&
        !('postalCode' in r),
    ),
  );
  check(
    'canada decision recorded (local): excluded from US totals, held not discarded',
    /excluded from US import candidates/i.test(canadaManifest.decision) &&
      /No Canadian import is authorized/i.test(canadaManifest.decision),
  );
}
check(
  'US accounting excludes Canada (no province in US state counts)',
  Object.keys(accounting.usStateCounts).every((s) => !CA_PROVINCES.has(s)),
);

/* ---------------------------------------------------------------- privacy */
const committedArtifacts = fs
  .readdirSync(IMPORT_DIR)
  .filter((f) => fs.statSync(path.join(IMPORT_DIR, f)).isFile());
for (const f of committedArtifacts) {
  const text = fs.readFileSync(path.join(IMPORT_DIR, f), 'utf8');
  // Doc references to the COLUMN NAMES and to the policy BAN phrasing are
  // allowed; actual field keys or values are not.
  const stripped = text
    .replace(/ManagerName|FaxNumber/g, '')
    .replace(/manager names?|fax numbers?/gi, '');
  check(`privacy: ${f} carries no manager/fax field or value`, !/manager|fax/i.test(stripped));
}
check(
  'privacy: raw CSV is gitignored',
  fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8').includes('*extraction*.csv'),
);
check(
  'privacy: local full-detail directory is gitignored',
  fs
    .readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8')
    .includes('data/imports/cat-scale-2026-07-29/local/'),
);
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
check(
  'privacy: no CSV or local detail file is git-tracked',
  !/extraction.*\.csv|cat-scale-2026-07-29\/local\//.test(tracked),
);

/* ------------------------------------------------- published-only queries */
const dataSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/directory/data.ts'), 'utf8');
const catBlock = dataSrc.slice(dataSrc.indexOf('CAT Scale browse-route + near-me'));
check(
  'runtime queries are published-only (map pool + count)',
  (catBlock.match(/\.eq\('is_published', true\)/g) ?? []).length >= 2,
);
const genericCorridor = dataSrc.slice(
  dataSrc.indexOf('getCorridorEntriesForCategories'),
  dataSrc.indexOf('getParkingCorridorEntries'),
);
check(
  'generic corridor query is published-only',
  genericCorridor.includes(".eq('is_published', true)"),
);

/* --------------------------------------------------- haversine + boundaries */
// One degree of latitude ≈ 69.09 straight-line miles.
const oneDegLat = haversineMiles({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
check('haversine: 1° latitude ≈ 69.09 mi', Math.abs(oneDegLat - 69.09) < 0.05, oneDegLat);
// Symmetry and zero distance.
check(
  'haversine: zero distance',
  haversineMiles({ lat: 33.5, lng: -86.8 }, { lat: 33.5, lng: -86.8 }) === 0,
);
const ab = haversineMiles({ lat: 33.749, lng: -84.388 }, { lat: 36.1627, lng: -86.7816 });
const ba = haversineMiles({ lat: 36.1627, lng: -86.7816 }, { lat: 33.749, lng: -84.388 });
check('haversine: symmetric', Math.abs(ab - ba) < 1e-9);
check('haversine: Atlanta→Nashville ≈ 214 mi straight-line', Math.abs(ab - 214) < 3, ab);

// Exact 20/50/100-mile boundaries: withinRadius is inclusive (<=) — a scale
// at exactly the radius is shown; a hair past it is not. Tested with exact
// synthetic distances so no floating-point roundtrip can blur the boundary.
for (const R of [20, 50, 100]) {
  const kept = withinRadius(
    [
      { id: 'exact', distanceMiles: R },
      { id: 'inside', distanceMiles: R - 0.01 },
      { id: 'beyond', distanceMiles: R + 0.000001 },
    ],
    R,
  ).map((i) => i.id);
  check(
    `boundary: exactly ${R} mi included, beyond excluded`,
    kept.length === 2 && kept.includes('exact') && kept.includes('inside'),
    kept,
  );
}
const origin = { lat: 40, lng: -100 };
function pointAtMiles(m: number) {
  return { lat: 40 + m / oneDegLat, lng: -100 };
}
// Nearest-first ordering.
const sorted = sortByDistance(
  withDistance(
    [
      { id: 'far', ...pointAtMiles(80) },
      { id: 'near', ...pointAtMiles(5) },
      { id: 'mid', ...pointAtMiles(30) },
    ],
    origin,
  ),
);
check('nearest-first ordering', sorted.map((s) => s.id).join(',') === 'near,mid,far');

/* --------------------------------------- Near Me: no location persistence */
const nearMeRaw = fs.readFileSync(
  path.join(process.cwd(), 'src/components/directory/CatScaleNearMe.tsx'),
  'utf8',
);
// Strip comments — the privacy contract is documented in prose, but the
// CODE must contain zero storage/network/logging calls.
const nearMeSrc = nearMeRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check(
  'near me: no storage/cookie/DB APIs at all',
  !/localStorage|sessionStorage|document\.cookie|indexedDB|caches\./.test(nearMeSrc),
);
check(
  'near me: no network call with coordinates',
  !/fetch\(|axios|XMLHttpRequest|navigator\.sendBeacon/.test(nearMeSrc),
);
check('near me: no console logging of location', !/console\./.test(nearMeSrc));
check(
  'near me: geolocation read once on tap, never watched',
  (nearMeSrc.match(/getCurrentPosition/g) ?? []).length === 1 && !/watchPosition/.test(nearMeSrc),
);
check(
  'near me: distances labeled approximate straight-line',
  /approximate straight-line distance/i.test(nearMeSrc),
);
check(
  'near me: manual city/ZIP fallback on denial',
  /denied/.test(nearMeSrc) && /searchLocation/.test(nearMeSrc),
);
check('near me: 20/50/100 radii exactly', /RADII = \[20, 50, 100\] as const/.test(nearMeSrc));

/* ------------------------------------------- runtime US-only surface area */
check(
  'runtime state pages reject Canadian provinces',
  stateByCode('AB' as never) == null && stateByCode('ON' as never) == null,
);
check(
  'runtime state pages accept US states',
  stateByCode('GA') != null && stateByCode('TX') != null,
);

console.log(`cat-scale: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
