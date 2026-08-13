/**
 * The saved driver name — behaviour, not just source shape.
 *
 * The name changed status in the pre-trip setup milestone: it used to die
 * with the tab and now survives to the next morning. That is a privacy
 * decision as much as a convenience one, so the properties that made the
 * old ephemeral design safe are re-proven here against a real storage
 * double:
 *
 *   - a blank name produces NO greeting, ever, and no stored record;
 *   - a saved name comes back after a reload, and can be edited or
 *     cleared without touching anything else;
 *   - a corrupt or hand-edited record yields NOTHING rather than
 *     something plausible — the value reaches a speech synthesiser;
 *   - the name never enters a search, a route request, a report or a log.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-driver-name.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --jsx=automatic \
 *     --outfile=/tmp/test-navigator-driver-name.cjs && node /tmp/test-navigator-driver-name.cjs
 */
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

/* ------------------------------------------------------------------ */
/* A real storage double, installed before the module under test loads. */
/* ------------------------------------------------------------------ */

class MemoryStorage {
  private map = new Map<string, string>();
  /** Set to make every operation throw, the way private mode can. */
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
  /** Test-only: plant a raw record, the way a hand edit would. */
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
(globalThis as unknown as { window: unknown }).window = {
  localStorage: local,
  sessionStorage: session,
};
(globalThis as unknown as { localStorage: unknown }).localStorage = local;
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = session;

/* eslint-disable @typescript-eslint/no-var-requires */
// Required AFTER the globals exist, so the module sees a real store.
const { DRIVER_KEY, clearDriverName, readDriverName, writeDriverName } =
  require('@/components/navigator/driver-storage') as typeof import('@/components/navigator/driver-storage');
const { normalizeFirstName } =
  require('@/lib/navigator/driver-greeting') as typeof import('@/lib/navigator/driver-greeting');
/* eslint-enable @typescript-eslint/no-var-requires */

const NAME = 'Shawn';

/* ===================================================================== */
/* 1. BLANK NAME — nothing invented, nothing stored                       */
/* ===================================================================== */
{
  local.clearAll();
  check('blank: nothing saved means nothing read back', readDriverName() === null);
  check('blank: and no record was created by reading', local.keys().length === 0, local.keys());

  for (const blank of ['', '   ', '\t', '\n']) {
    local.clearAll();
    writeDriverName(blank);
    check(
      `blank: "${JSON.stringify(blank)}" is refused, not stored`,
      local.raw(DRIVER_KEY) === null && readDriverName() === null,
      local.raw(DRIVER_KEY),
    );
  }
  // The greeting core is what decides, and it must keep refusing.
  check('blank: the validator refuses whitespace', !normalizeFirstName('   ').ok);
  check('blank: the validator refuses an empty string', !normalizeFirstName('').ok);
}

/* ===================================================================== */
/* 2. SAVE, RELOAD, EDIT, CLEAR                                           */
/* ===================================================================== */
{
  local.clearAll();
  writeDriverName(NAME);
  check('save: the name is stored', local.raw(DRIVER_KEY) !== null);
  check('save: it reads back exactly', readDriverName() === NAME, readDriverName());

  // A "reload" is simply a fresh read against the same store — the module
  // holds no memory of its own, which is the property that makes a
  // reload work at all.
  check('reload: the name survives', readDriverName() === NAME);

  writeDriverName('Dana');
  check('edit: the new name replaces the old', readDriverName() === 'Dana');
  check('edit: exactly one record exists', local.keys().length === 1, local.keys());

  clearDriverName();
  check('clear: the name is gone', readDriverName() === null);
  check('clear: and so is the record', local.raw(DRIVER_KEY) === null);
}

// Trimming and the shapes real drivers have.
{
  const cases: [string, string | null][] = [
    ['  Shawn  ', 'Shawn'],
    ["O'Brien", "O'Brien"],
    ['Anne-Marie', 'Anne-Marie'],
    ['José', 'José'],
    ['Shawn Gresham', null], // a first name only
    ['<script>', null],
    ['a@b.com', null],
    ['555-1212', null],
    ['-', null],
  ];
  for (const [input, expected] of cases) {
    local.clearAll();
    writeDriverName(input);
    check(
      `shape: ${JSON.stringify(input)} → ${JSON.stringify(expected)}`,
      readDriverName() === expected,
      readDriverName(),
    );
  }
}

/* ===================================================================== */
/* 3. CORRUPT STORAGE FAILS TO NOTHING                                    */
/* ===================================================================== */
{
  const corrupt: [string, string][] = [
    ['not JSON at all', 'wat'],
    ['JSON but not an object', '"Shawn"'],
    ['null', 'null'],
    ['missing version', '{"firstName":"Shawn"}'],
    ['wrong version', '{"v":2,"firstName":"Shawn"}'],
    ['missing name', '{"v":1}'],
    ['name is not a string', '{"v":1,"firstName":42}'],
    ['name is an object', '{"v":1,"firstName":{"toString":"nope"}}'],
    ['name fails the allow-list', '{"v":1,"firstName":"<script>alert(1)</script>"}'],
    ['name is far too long', `{"v":1,"firstName":"${'a'.repeat(200)}"}`],
    ['name carries a control character', '{"v":1,"firstName":"Sh\\u0007awn"}'],
  ];
  for (const [label, raw] of corrupt) {
    local.clearAll();
    local.plant(DRIVER_KEY, raw);
    let threw = false;
    let value: string | null = 'unset';
    try {
      value = readDriverName();
    } catch {
      threw = true;
    }
    check(`corrupt (${label}): does not throw`, !threw);
    check(`corrupt (${label}): yields NO name`, value === null, value);
  }

  // Storage that refuses to work at all is the same answer.
  local.clearAll();
  local.hostile = true;
  let threw = false;
  try {
    writeDriverName(NAME);
    check('hostile storage: read yields no name', readDriverName() === null);
    clearDriverName();
  } catch {
    threw = true;
  }
  local.hostile = false;
  check('hostile storage: never throws into the render path', !threw);
}

/* ===================================================================== */
/* 4. INDEPENDENCE — the name owns its own key                            */
/* ===================================================================== */
{
  local.clearAll();
  local.plant('tlws-navigator-truck-v1', '{"v":1,"profile":{"heightFt":13.5}}');
  local.plant('tlws-navigator-clocks-v1', 'CORRUPT');
  writeDriverName(NAME);
  check('independence: the name saved beside a corrupt clock record', readDriverName() === NAME);
  clearDriverName();
  check(
    'independence: clearing the name left the truck record alone',
    local.raw('tlws-navigator-truck-v1') !== null,
  );
  check(
    'independence: and left the clock record alone',
    local.raw('tlws-navigator-clocks-v1') === 'CORRUPT',
  );
  check('independence: the key is versioned', DRIVER_KEY === 'tlws-navigator-driver-v1');
}

/* ===================================================================== */
/* 5. THE NAME NEVER REACHES THE NETWORK                                  */
/* ===================================================================== */
{
  /*
   * Source rails, because a render cannot prove the absence of a code
   * path. Every module that could carry the name toward a wire is read
   * and checked for it — the ports that transmit, the request builders,
   * the report the driver copies and sends, and the pilot log.
   */
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
      `network: ${path.split('/').pop()} never mentions the driver name`,
      !/firstName|driverName|driver-storage/.test(src),
      path,
    );
  }

  // The storage module is the ONLY place the key or the value lives, and
  // it must not import anything that transmits. Comments are stripped
  // first: prose about a ban ("never reaches analytics") must not trip
  // the ban, the same convention the other privacy rails use.
  const storageRaw = readFileSync('src/components/navigator/driver-storage.ts', 'utf8');
  const storage = storageRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check(
    'network: the name module fetches nothing',
    !/fetch\(|axios|XMLHttpRequest|navigator\.sendBeacon/.test(storage),
  );
  check(
    'network: the name module imports no port',
    !/-port'|\/ports'/.test(storage),
    storage.match(/import[^;]+;/g)?.slice(0, 8),
  );
  check(
    'network: the name module touches no analytics',
    !/analytics|trackEvent|plausible|gtag/i.test(storage),
  );
  check('network: the name module touches no database', !/supabase/i.test(storage));
}

console.log(`navigator-driver-name: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
