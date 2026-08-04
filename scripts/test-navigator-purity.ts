/**
 * Navigator purity gate (milestone N0, architecture decision AD-2).
 *
 * Structural, merge-blocking: nothing under `src/lib/navigator/` — at any
 * depth — may import React or `next/*` (static OR dynamic import), call
 * `fetch`, touch browser globals (`window`, `document`, `navigator`), read
 * a clock (`Date.now`, `Date()`, `new Date` in any form,
 * `performance.now`), schedule timers, log, or reach persistence
 * (`localStorage`, `indexedDB`, Supabase). Time and I/O arrive as
 * parameters and ports — the property that keeps every engine decision
 * replayable in this offline runner.
 *
 * The scanner is SELF-TESTED below against known-evasion samples
 * (subdirectory placement is covered by the recursive walk; dynamic
 * import; parenless `new Date`; template-literal interpolation hiding a
 * call) because an adversarial audit proved the first version of this
 * gate passed all of them.
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

/** Every .ts/.tsx under dir, RECURSIVELY — subfolders must not exit the gate. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * Reduce source to scannable code: string LITERAL TEXT is blanked but
 * template-interpolation code is PRESERVED (a `${fetch(...)}` is code);
 * block comments and line comments — including trailing ones — are
 * stripped so prose about a ban never trips it.
 */
export function codeOf(source: string): string {
  let s = source;
  // Template literals: keep each ${...} body, drop the literal text.
  for (let i = 0; i < 10; i++) {
    const next = s.replace(
      /`(?:[^`\\$]|\\.|\$(?!\{))*(?:\$\{((?:[^`{}]|\{[^}]*\})*)\})?(?:[^`\\$]|\\.|\$(?!\{))*`/g,
      (_m, expr) => (expr ? `(${expr})` : "''"),
    );
    if (next === s) break;
    s = next;
  }
  s = s
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return s;
}

type Ban = { name: string; re: RegExp };
/** Bans applied to the raw source (import syntax can hide in strings only via codeOf anyway). */
const RAW_BANS: Ban[] = [
  { name: 'imports react', re: /from\s+['"]react['"]/ },
  { name: 'imports next/*', re: /from\s+['"]next(\/|['"])/ },
  { name: 'requires react/next', re: /require\(\s*['"](react|next)/ },
];
/** Bans applied to comment-and-literal-stripped code. */
const CODE_BANS: Ban[] = [
  { name: 'dynamic import()', re: /\bimport\s*\(/ },
  { name: 'calls fetch', re: /\bfetch\s*\(/ },
  { name: 'touches window', re: /\bwindow\s*[.[]/ },
  { name: 'touches document', re: /\bdocument\s*[.[]/ },
  { name: 'touches navigator global', re: /\bnavigator\s*[.[]/ },
  { name: 'reads the clock via Date', re: /\bnew\s+Date\b|\bDate\s*[.(]/ },
  { name: 'reads performance.now', re: /\bperformance\s*\.\s*now\s*\(/ },
  { name: 'schedules setTimeout', re: /\bsetTimeout\s*\(/ },
  { name: 'schedules setInterval', re: /\bsetInterval\s*\(/ },
  { name: 'uses localStorage', re: /\blocalStorage\b/ },
  { name: 'uses sessionStorage', re: /\bsessionStorage\b/ },
  { name: 'uses indexedDB', re: /\bindexedDB\b/i },
  { name: 'imports supabase', re: /supabase/i },
  { name: 'logs to console', re: /\bconsole\s*\.\s*(log|info|warn|error|debug)\s*\(/ },
];

function violationsIn(source: string): string[] {
  const code = codeOf(source);
  const hits: string[] = [];
  for (const ban of RAW_BANS) if (ban.re.test(source)) hits.push(ban.name);
  for (const ban of CODE_BANS) if (ban.re.test(code)) hits.push(ban.name);
  return hits;
}

// ------------------------------------------------ scanner self-test
// Each sample slipped past the first version of this gate (audit-proven).
const MUST_CATCH: [string, string][] = [
  ['dynamic import()', "const nav = await import('next/navigation');"],
  ['reads the clock via Date', 'const t = Date();'],
  ['reads the clock via Date', 'const d = new Date;'],
  ['calls fetch', 'const msg = `status: ${await fetch(url)}`;'],
  ['calls fetch', 'fetch(url);'],
  ['touches navigator global', 'const g = navigator.geolocation;'],
  ['schedules setInterval', 'setInterval(cb, 1000);'],
];
for (const [ban, sample] of MUST_CATCH) {
  check(
    `self-test: catches ${ban} in ${JSON.stringify(sample.slice(0, 40))}`,
    violationsIn(sample).includes(ban),
  );
}
const MUST_ALLOW: string[] = [
  '// only Date.now() is banned — a trailing comment about fetch( too',
  "const label = 'window.fetch is banned here';",
  '/* new Date is disallowed */ const x = 1;',
  'const s = `plain template, no interpolation`;',
  'const nowMs = opts.nowMs; // time arrives as a parameter',
];
for (const sample of MUST_ALLOW) {
  const v = violationsIn(sample);
  check(
    `self-test: allows benign ${JSON.stringify(sample.slice(0, 44))}`,
    v.length === 0,
    v.join(','),
  );
}

// ---------------------------------------------------------------- structure
check('src/lib/navigator exists', existsSync(LIB_DIR));
const files = existsSync(LIB_DIR) ? walk(LIB_DIR) : [];
check('navigator core is non-empty', files.length > 0, files.length);
check(
  'no .tsx (no React surface) inside the pure core',
  files.every((f) => f.endsWith('.ts')),
);
for (const required of ['types.ts', 'ports.ts']) {
  check(
    `N0 scaffold file present: ${required}`,
    files.some((f) => f.endsWith(`/${required}`) || f.endsWith(required)),
  );
}
check('N0 route-group layout exists', existsSync('src/app/(navigator)/layout.tsx'));

// ---------------------------------------------------------------- purity bans
for (const f of files) {
  const source = readFileSync(f, 'utf8');
  const hits = violationsIn(source);
  check(`${f}: no purity violations`, hits.length === 0, hits.join(', '));
  // Imports may only reach ./ or ../ inside the core, or other pure
  // `@/lib/**` modules — never components, app routes, or API layers.
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  check(
    `${f}: imports stay inside the pure lib layer (relative or @/lib/**)`,
    imports.every((s) => s.startsWith('./') || s.startsWith('../') || s.startsWith('@/lib/')),
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
