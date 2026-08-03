/**
 * Boundary tests for the donor-audit extraction (see docs/donor-audit-extraction.md).
 *
 * The two extracted modules are meant to be inert: pure logic, no framework, no
 * backend, and — for this PR — not referenced by anything that ships. That is a
 * claim about the repository, not about a function's return value, so it is
 * asserted here by reading source files rather than by calling code. Run:
 *
 *   npx esbuild scripts/test-extraction-boundaries.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-extraction-boundaries.cjs && node /tmp/test-extraction-boundaries.cjs
 *
 * Note on method: every content scan runs against a comment-stripped copy of the
 * source. Both extracted modules discuss Supabase, React, HERE routing and the
 * Trip Planner in their own header prose — explaining precisely why they depend
 * on none of them — and a naive substring scan would match that prose and fail
 * on the documentation instead of the code. Import checks read declared module
 * specifiers directly, which is exact rather than approximate.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const EXTRACTED = ['src/lib/pwa/install-prompt.ts', 'src/lib/navigator/direction-of-travel.ts'];

/** The only module specifiers the extracted utilities are permitted to import. */
const ALLOWED_IMPORTS = ['@/lib/map/geo', '@/lib/map/bounds'];

/* -------------------------------------------------------------- utilities */

/**
 * Remove block comments, then whole-line `//` comments. Deliberately does NOT
 * touch trailing `//` — the escaped slash that ends a regex literal (`\//i`)
 * looks exactly like the start of a line comment, and stripping it would mangle
 * the very detection patterns under test.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Every module specifier the file declares, from static, type-only and dynamic imports. */
function importSpecifiers(source: string): string[] {
  const body = stripComments(source);
  const found = new Set<string>();
  for (const re of [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]/g,
  ]) {
    for (const m of body.matchAll(re)) found.add(m[1]);
  }
  return [...found];
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(?:ts|tsx|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

/* ------------------------------------------------- the files exist and are read */

const sources = new Map<string, string>();
for (const path of EXTRACTED) {
  const exists = existsSync(path);
  check(`${path} exists`, exists);
  if (exists) sources.set(path, readFileSync(path, 'utf8'));
}

/* ------------------------------------------------------- dependency boundary */

for (const [path, source] of sources) {
  const specifiers = importSpecifiers(source);
  const disallowed = specifiers.filter((s) => !ALLOWED_IMPORTS.includes(s));
  check(`${path} imports only the approved geo primitives`, disallowed.length === 0, disallowed);

  check(
    `${path} imports no React`,
    !specifiers.some((s) => s === 'react' || s.startsWith('react/') || s.startsWith('react-')),
    specifiers,
  );
  check(
    `${path} imports no Next.js`,
    !specifiers.some((s) => s === 'next' || s.startsWith('next/')),
    specifiers,
  );
  check(
    `${path} imports no Supabase client or database layer`,
    !specifiers.some((s) => /supabase/i.test(s)),
    specifiers,
  );
  check(
    `${path} imports nothing from the Trip Planner, HOS, or HERE routing`,
    !specifiers.some((s) => /trip-planner|\/hos\b|here-routing|here-geocode/i.test(s)),
    specifiers,
  );
  check(
    `${path} imports nothing from the donor's rejected subsystems`,
    !specifiers.some((s) => /auth|admin|affiliate|onboarding|settings|store\//i.test(s)),
    specifiers,
  );
}

/* ------------------------------------------------------------ no secrets, no env */

const FORBIDDEN_TOKENS = [
  'process.env',
  'createClient',
  'supabase',
  'service_role',
  'SERVICE_ROLE',
  'serviceRole',
  'NEXT_PUBLIC',
  'apiKey',
  'api_key',
  'API_KEY',
  'Authorization',
  'Bearer ',
];

for (const [path, source] of sources) {
  const body = stripComments(source);
  for (const token of FORBIDDEN_TOKENS) {
    check(`${path} contains no \`${token}\` outside comments`, !body.includes(token));
  }
  check(`${path} reads no environment variable`, !/\bprocess\b|\bimport\.meta\.env\b/.test(body));
  check(
    `${path} performs no network I/O`,
    !/\bfetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/.test(body),
  );
  check(
    `${path} mutates no DOM`,
    !/\bdocument\b|innerHTML|appendChild|addEventListener|localStorage|sessionStorage/.test(body),
  );
}

/* ---------------------------------------- who may reference the extractions */

// The PWA foundation milestone (docs/pwa-foundation.md) ended the inert era
// for install-prompt: it is now wired to exactly one shipped surface, the
// install card. The Navigator extraction remains inert — Navigator is a
// future milestone and nothing that ships may touch it yet.

const srcFiles = walk('src').filter((f) => !EXTRACTED.includes(f));
const EXTRACTED_SPECIFIERS = ['@/lib/pwa/install-prompt', '@/lib/navigator/direction-of-travel'];

{
  const referencing = srcFiles.filter((f) =>
    readFileSync(f, 'utf8').includes('@/lib/pwa/install-prompt'),
  );
  check(
    'install-prompt is imported only by the install card (the sanctioned PWA surface)',
    referencing.length === 1 && referencing[0] === 'src/components/pwa/InstallCard.tsx',
    referencing,
  );
}
{
  const referencing = srcFiles.filter((f) =>
    readFileSync(f, 'utf8').includes('@/lib/navigator/direction-of-travel'),
  );
  check(
    'no shipped module imports @/lib/navigator/direction-of-travel — Navigator is still inert',
    referencing.length === 0,
    referencing,
  );
}

/* ------------------------------ the protected subsystems are untouched by this work */

const PROTECTED_DIRS = [
  'src/lib/trip-planner',
  'src/lib/hos',
  'src/lib/directory',
  'src/lib/store',
  'src/lib/tests',
  'src/app/api/trip-planner',
];

for (const dir of PROTECTED_DIRS) {
  const files = walk(dir);
  check(`${dir} exists and was scanned`, files.length > 0, files.length);
  const contaminated = files.filter((f) => {
    const text = readFileSync(f, 'utf8');
    return (
      EXTRACTED_SPECIFIERS.some((s) => text.includes(s)) || text.includes('direction-of-travel')
    );
  });
  check(`${dir} references nothing from the extraction`, contaminated.length === 0, contaminated);
}

/* --------------- the PWA foundation exists in exactly its canonical shape */

// The foundation milestone introduced one worker (public/sw.js) and one
// manifest (src/app/manifest.ts, the Next file convention). Duplicate or
// legacy locations must never appear beside them — two manifests or two
// workers is how installs and caches silently diverge.
for (const artifact of ['public/sw.js', 'src/app/manifest.ts']) {
  check(`${artifact} exists — the PWA foundation's canonical artifact`, existsSync(artifact));
}
const FORBIDDEN_DUPLICATES = [
  'public/manifest.json',
  'public/manifest.webmanifest',
  'public/service-worker.js',
  'src/app/manifest.json',
  'src/app/sw.ts',
];
for (const artifact of FORBIDDEN_DUPLICATES) {
  check(`${artifact} does not exist — one canonical worker/manifest only`, !existsSync(artifact));
}

check(
  'no workbox or PWA build dependency was added',
  !JSON.stringify({
    ...(JSON.parse(readFileSync('package.json', 'utf8')).dependencies ?? {}),
    ...(JSON.parse(readFileSync('package.json', 'utf8')).devDependencies ?? {}),
  }).match(/workbox|vite-plugin-pwa|next-pwa|serwist/i),
);

/* ----------------------------------- no donor source was copied into the repo */

// Identifiers that only ever appear in the donor archive — its planning-tool
// directories, its package name, and the requirement tags its modules cite. If
// any of these turn up in TLWS, something was pasted in rather than rewritten.
//
// This file is excluded from its own scan: it is the declaration site for the
// marker list, so it necessarily contains every one of them. Everything else
// under src/ and scripts/ is checked.
const SELF = 'scripts/test-extraction-boundaries.ts';
const donorMarkers = ['_bmad', 'trucking-life-pwa', 'BMAD', 'NFR-S7', 'AR33', 'AR38'];
const allRepoFiles = [...walk('src'), ...walk('scripts')].filter((f) => f !== SELF);
check(
  'the marker scan covers the rest of the repository',
  allRepoFiles.length > 400,
  allRepoFiles.length,
);
for (const marker of donorMarkers) {
  const hits = allRepoFiles.filter((f) => readFileSync(f, 'utf8').includes(marker));
  check(`no file carries the donor marker "${marker}"`, hits.length === 0, hits);
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
