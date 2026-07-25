/**
 * Design-token and document-structure guards (offline, source-level).
 *
 * The bug that motivated this: four components used `bg-asphalt-900`. The
 * asphalt ramp stops at 600/700/800 + DEFAULT, so Tailwind emitted **no rule
 * at all** and the elements fell back to the browser default — white. Two of
 * them were text inputs styled `text-ink`, which put near-white text on a white
 * field: axe measured 1.13:1 on the Trip Planner sign-in email box, i.e. what
 * the driver typed was invisible. Nothing in the toolchain complains about a
 * class that matches no rule, so this harness does.
 *
 * The colour families come from tailwind.config.ts itself, so adding a shade
 * there automatically permits it here — the test only ever fails on a token the
 * theme does not define.
 *
 * Also guards the document-structure fixes made alongside it: exactly one
 * <main> landmark, unique FAQ heading ids, and the resting underline on links
 * that sit inside running text (WCAG 1.4.1).
 *
 * Run:
 *   npx esbuild scripts/test-design-tokens.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-design-tokens.cjs && node /tmp/test-design-tokens.cjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import config from '../tailwind.config';

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
    else if (/\.(tsx|ts|css)$/.test(p)) out.push(p);
  }
  return out;
}

const ROOT = process.cwd();
const files = walk(join(ROOT, 'src'));
check('scan: found source files', files.length > 100, files.length);

/* ------------------------------------------------ colour tokens are real */
const colors = (config.theme?.extend?.colors ?? {}) as Record<
  string,
  string | Record<string, string>
>;
const families = Object.keys(colors);
check('tokens: theme defines colour families', families.length >= 5, families);

/** family → the shade suffixes it allows (empty string = bare `bg-<family>`). */
const allowed = new Map<string, Set<string>>();
for (const [family, value] of Object.entries(colors)) {
  const shades = new Set<string>();
  if (typeof value === 'string') shades.add('');
  else for (const key of Object.keys(value)) shades.add(key === 'DEFAULT' ? '' : key.toLowerCase());
  allowed.set(family, shades);
}

// A utility prefix, one of our families, an optional shade, an optional
// opacity modifier. Deliberately not anchored to `className` — a token can
// appear in a `cn()` argument, a lookup table, or a plain string constant.
const tokenRe = new RegExp(
  String.raw`(?<![A-Za-z0-9])[a-z][a-z-]*-(${families.join('|')})(?:-([A-Za-z0-9]+))?(?:\/[0-9]+)?(?![A-Za-z0-9-])`,
  'g',
);

const unknown: string[] = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(tokenRe)) {
    const family = m[1];
    const shade = (m[2] ?? '').toLowerCase();
    if (!allowed.get(family)?.has(shade)) {
      unknown.push(
        `${relative(ROOT, file)} → ${m[0]} (no "${family}${shade ? `-${shade}` : ''}" in the theme)`,
      );
    }
  }
}
check(
  'tokens: every colour utility resolves to a theme token',
  unknown.length === 0,
  unknown.slice(0, 10),
);

// Prove the guard actually bites — the exact shape of the original bug.
{
  const probe = 'w-full rounded-card border border-line bg-asphalt-900 px-4 py-3 text-ink';
  const found = [...probe.matchAll(tokenRe)].filter(
    (m) => !allowed.get(m[1])?.has((m[2] ?? '').toLowerCase()),
  );
  check(
    'tokens: guard catches bg-asphalt-900 (the original defect)',
    found.length === 1 && found[0][0] === 'bg-asphalt-900',
    found.map((f) => f[0]),
  );
  const clean = 'rounded-card border border-line bg-asphalt-800/60 text-diesel-300 ring-signal';
  const cleanBad = [...clean.matchAll(tokenRe)].filter(
    (m) => !allowed.get(m[1])?.has((m[2] ?? '').toLowerCase()),
  );
  check('tokens: guard does not fire on valid tokens', cleanBad.length === 0, cleanBad);
}

/* ------------------------------------------------------ one main landmark */
{
  const mains = files.filter((f) => /<main[\s>]/.test(readFileSync(f, 'utf8')));
  check(
    'landmarks: exactly one file renders <main> (the root layout)',
    mains.length === 1 && mains[0].endsWith(join('src', 'app', 'layout.tsx')),
    mains.map((m) => relative(ROOT, m)),
  );
}

/* --------------------------------------------- FAQ heading ids are unique */
{
  const faq = readFileSync(join(ROOT, 'src/components/academy/AcademyFaq.tsx'), 'utf8');
  check(
    'faq: heading id is derived, not a fixed string',
    !faq.includes('id="faq-heading"') && faq.includes('id={headingId}'),
  );
  check('faq: the landmark label points at that id', faq.includes('aria-labelledby={headingId}'));
}

/* ------------------------------ flex form fields can actually shrink ----- */
{
  // A flex item defaults to `min-width: auto`, and a text input's intrinsic
  // width is ~200px. `flex-1` without `min-w-0` therefore refuses to shrink:
  // the Knowledge Center search box pushed its Search button off a 320px
  // screen and scrolled the whole page sideways by 59px.
  const offenders: string[] = [];
  for (const file of files.filter((f) => f.endsWith('.tsx'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<(input|select|textarea)\b[^>]*>/gs)) {
      const tag = m[0];
      if (/\bflex-1\b/.test(tag) && !/\bmin-w-0\b/.test(tag)) {
        offenders.push(`${relative(ROOT, file)} → <${m[1]} … flex-1> without min-w-0`);
      }
    }
  }
  check('layout: every flex-1 form field can shrink (min-w-0)', offenders.length === 0, offenders);

  const search = readFileSync(join(ROOT, 'src/components/kc/SearchBox.tsx'), 'utf8');
  check(
    'layout: KC search input carries min-w-0',
    /min-w-0[^"]*flex-1|flex-1[^"]*min-w-0/.test(search),
  );
  check('layout: KC search button does not shrink away', search.includes('shrink-0'));

  // Same class of bug one level up: `min-w-0` lets a control shrink, but a
  // `flex-1` item in a wrapping row shrinks instead of wrapping. The map
  // toolbar's search shared a row with "Use my location" and collapsed to 26px
  // on a 320px screen. It has to claim the full width below `sm` to wrap.
  const mapForm =
    /<form[^>]*onSubmit=\{runSearch\}[\s\S]*?>/.exec(
      readFileSync(join(ROOT, 'src/components/map/MapExplorer.tsx'), 'utf8'),
    )?.[0] ?? '';
  check(
    'layout: map search takes its own row on small screens',
    /\bw-full\b/.test(mapForm),
    mapForm,
  );
  check(
    'layout: map search still shares the toolbar row from sm up',
    /\bsm:flex-1\b/.test(mapForm),
    mapForm,
  );
}

/* ------------------------- keyboard focus is visible on date/time fields - */
{
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
  // Chromium delegates focus inside a date/time input to its sub-fields, so the
  // host never matches :focus-visible. Combined with the codebase's usual
  // `focus:outline-none` field styling, tabbing to the Trip Planner's departure
  // time left no focus indicator at all (WCAG 2.4.7).
  const focusBlock = css.match(/input:focus-visible[\s\S]*?\}/)?.[0] ?? '';
  for (const type of ['date', 'datetime-local', 'month', 'time', 'week']) {
    check(
      `focus: input[type='${type}'] gets a ring on :focus`,
      focusBlock.includes(`input[type='${type}']:focus`),
      focusBlock.slice(0, 200),
    );
  }
  check(
    'focus: the ring is a box-shadow, so focus:outline-none cannot cancel it',
    /box-shadow:[\s\S]*colors\.signal/.test(focusBlock),
  );

  // Every date/time field in the codebase relies on that rule.
  const dateFields: string[] = [];
  for (const file of files.filter((f) => f.endsWith('.tsx'))) {
    const src = readFileSync(file, 'utf8');
    if (/type="(date|datetime-local|month|time|week)"/.test(src))
      dateFields.push(relative(ROOT, file));
  }
  check('focus: date/time fields exist to be covered', dateFields.length > 0, dateFields);
}

/* --------------------------- in-prose links carry a resting underline ---- */
{
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
  check('links: .link-inline utility exists', /\.link-inline\s*\{/.test(css));
  check(
    'links: .link-inline actually underlines at rest',
    /\.link-inline\s*\{[^}]*underline/.test(css),
    css.match(/\.link-inline\s*\{[^}]*\}/)?.[0],
  );

  // Each of these was flagged by axe as link-in-text-block: sodium amber
  // measures 1.25:1 against muted body copy, and the footer's legal links are
  // the same colour as the sentence they sit in.
  for (const rel of [
    'src/app/(academy)/academy/page.tsx',
    'src/app/(academy)/academy/faq/page.tsx',
    'src/app/(marketing)/cdl-pre-school/page.tsx',
    'src/app/(directory)/directory/page.tsx',
    'src/app/(marketing)/knowledge/page.tsx',
    'src/components/layout/Footer.tsx',
  ]) {
    check(
      `links: ${rel} uses .link-inline`,
      readFileSync(join(ROOT, rel), 'utf8').includes('link-inline'),
    );
  }
}

console.log(`\ndesign-tokens: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
