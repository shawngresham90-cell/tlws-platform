/**
 * Web-storage safety tests (offline, source-level).
 *
 * `localStorage.getItem` / `setItem` do not merely return null when storage is
 * unavailable — they **throw**. Safari private browsing, enterprise policy, a
 * privacy extension, and a full quota all raise a `SecurityError` or
 * `QuotaExceededError` on plain reads and writes.
 *
 * The defect: `StudyRunner` and `TimedRunner` guarded every write and every
 * remove, but hydrated with a bare
 * `window.localStorage.getItem(studyStorageKey(...))` inside a `useEffect`. A
 * throw there takes the whole practice-test runner down for a driver whose
 * browser blocks storage — even though both files are already written to
 * degrade gracefully (`deserializeSession(null, …)` starts a fresh session).
 *
 * This asserts every direct storage call in the codebase is inside a
 * try/catch, so the next one added is caught before it ships.
 *
 * Run:
 *   npx esbuild scripts/test-storage-safety.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-storage-safety.cjs && node /tmp/test-storage-safety.cjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const ROOT = process.cwd();
const files = walk(join(ROOT, 'src'));

/**
 * Is the call at `index` lexically inside a `try { … }`? Walks backwards
 * tracking brace depth: a `try {` whose block has not closed yet encloses it.
 */
function insideTry(src: string, index: number): boolean {
  let depth = 0;
  for (let i = index; i >= 0; i--) {
    const ch = src[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        // Opening brace of an enclosing block — is it a `try`?
        if (/\btry\s*$/.test(src.slice(Math.max(0, i - 12), i))) return true;
      } else depth--;
    }
  }
  return false;
}

const STORAGE_CALL =
  /\b(?:window\.)?(localStorage|sessionStorage)\.(getItem|setItem|removeItem|clear|key)\s*\(/g;

const unguarded: string[] = [];
let calls = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(STORAGE_CALL)) {
    calls++;
    if (!insideTry(src, m.index)) {
      const line = src.slice(0, m.index).split('\n').length;
      unguarded.push(`${relative(ROOT, file)}:${line} → ${m[1]}.${m[2]}() outside try/catch`);
    }
  }
}

check('scan: found storage calls to check', calls >= 10, calls);
check(
  'storage: every direct call is inside try/catch (a blocked store throws)',
  unguarded.length === 0,
  unguarded,
);

/* -------------------- the two runners that had the hole ---------------- */
for (const rel of ['src/components/test/StudyRunner.tsx', 'src/components/test/TimedRunner.tsx']) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  check(
    `${rel}: hydration read is guarded and falls back`,
    /let raw: string \| null = null;[\s\S]{0,400}try \{[\s\S]{0,200}getItem\(/.test(src),
    src.match(/getItem\([^)]*\)/)?.[0],
  );
  check(
    `${rel}: still degrades to a usable session`,
    /deserialize\w*Session\(raw,/.test(src),
    src.match(/deserialize\w*Session\([^)]*/)?.[0],
  );
}

/* --------------- the brace walker itself behaves as claimed ------------ */
{
  const guarded = 'function f(){ try { localStorage.getItem("k"); } catch {} }';
  const bare = 'function f(){ localStorage.getItem("k"); }';
  const afterTry = 'function f(){ try { a(); } catch {} localStorage.getItem("k"); }';
  const idx = (s: string) => s.indexOf('localStorage.getItem');
  check('walker: sees a call inside try', insideTry(guarded, idx(guarded)));
  check('walker: sees a bare call', !insideTry(bare, idx(bare)));
  check('walker: a closed try does not cover later code', !insideTry(afterTry, idx(afterTry)));
}

console.log(`\nstorage-safety: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
