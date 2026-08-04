/**
 * Navigator purity gate (milestone N0, architecture decision AD-2).
 *
 * Structural, merge-blocking: nothing under `src/lib/navigator/` may import
 * React or `next/*`, call `fetch`, touch browser globals (`window`,
 * `document`, `navigator`), read a clock (`Date.now`, `performance.now`),
 * schedule timers, or reach persistence (`localStorage`, `indexedDB`,
 * Supabase). Time and I/O arrive as parameters and ports — the property
 * that keeps every engine decision replayable in this offline runner.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-purity.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --outfile=/tmp/test-navigator-purity.cjs && node /tmp/test-navigator-purity.cjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail)}`}`);
  }
}

const LIB_DIR = 'src/lib/navigator';

/** Strip block + line comments and string literals so bans hit code only. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

// ---------------------------------------------------------------- structure
check('src/lib/navigator exists', existsSync(LIB_DIR));
const files = existsSync(LIB_DIR)
  ? readdirSync(LIB_DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
  : [];
check('navigator core is non-empty', files.length > 0, files.length);
check('no .tsx (no React surface) inside the pure core', files.every((f) => f.endsWith('.ts')));
for (const required of ['types.ts', 'ports.ts']) {
  check(`N0 scaffold file present: ${required}`, files.includes(required));
}
check(
  'N0 route-group layout exists',
  existsSync('src/app/(navigator)/layout.tsx'),
);

// ---------------------------------------------------------------- purity bans
const RAW_BANS: { name: string; re: RegExp }[] = [
  { name: 'imports react', re: /from\s+['"]react['"]/ },
  { name: 'imports next/*', re: /from\s+['"]next(\/|['"])/ },
  { name: 'requires react/next', re: /require\(\s*['"](react|next)/ },
];
const CODE_BANS: { name: string; re: RegExp }[] = [
  { name: 'calls fetch', re: /\bfetch\s*\(/ },
  { name: 'touches window', re: /\bwindow\s*[.[]/ },
  { name: 'touches document', re: /\bdocument\s*[.[]/ },
  { name: 'touches navigator global', re: /\bnavigator\s*[.[]/ },
  { name: 'reads Date.now', re: /\bDate\s*\.\s*now\s*\(/ },
  { name: 'constructs bare new Date()', re: /new\s+Date\s*\(\s*\)/ },
  { name: 'reads performance.now', re: /\bperformance\s*\.\s*now\s*\(/ },
  { name: 'schedules setTimeout', re: /\bsetTimeout\s*\(/ },
  { name: 'schedules setInterval', re: /\bsetInterval\s*\(/ },
  { name: 'uses localStorage', re: /\blocalStorage\b/ },
  { name: 'uses sessionStorage', re: /\bsessionStorage\b/ },
  { name: 'uses indexedDB', re: /\bindexedDB\b/i },
  { name: 'imports supabase', re: /supabase/i },
  { name: 'logs to console', re: /\bconsole\s*\.\s*(log|info|warn|error|debug)\s*\(/ },
];

for (const f of files) {
  const source = readFileSync(join(LIB_DIR, f), 'utf8');
  const code = codeOf(source);
  for (const ban of RAW_BANS) {
    check(`${f}: ${ban.name} — banned`, !ban.re.test(source));
  }
  for (const ban of CODE_BANS) {
    check(`${f}: ${ban.name} — banned`, !ban.re.test(code));
  }
  // Imports may only reach ./ siblings or other pure `@/lib/**` modules —
  // never components, app routes, or API layers.
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  check(
    `${f}: imports stay inside the pure lib layer (./ siblings or @/lib/**)`,
    imports.every((s) => s.startsWith('./') || s.startsWith('@/lib/')),
    imports.join(', '),
  );
  check(
    `${f}: no component/app imports`,
    imports.every((s) => !s.includes('components/') && !s.includes('/app/')),
    imports.join(', '),
  );
}

console.log(`navigator-purity: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
