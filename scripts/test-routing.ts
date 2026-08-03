/**
 * Unit tests for directory routing/slug helpers — the pure functions behind
 * every /directory URL. Covers slugify, detail-slug base/uniqueness/validation,
 * interstate designation<->slug, and exit slug round-trips.
 *
 * Run:
 *   npx esbuild scripts/test-routing.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-routing.cjs && node /tmp/test-routing.cjs
 */
import { slugify } from '@/lib/directory/admin';
import {
  detailSlugBase,
  uniqueDetailSlug,
  isValidDetailSlug,
  detailHref,
} from '@/lib/directory/detail-slug';
import {
  interstateSlug,
  interstateBySlug,
  exitSlug,
  exitFromSlug,
} from '@/lib/directory/interstates';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/* ---------------------- slugify ---------------------- */
{
  check('slugify basic', slugify('Pilot Travel Center #404') === 'pilot-travel-center-404');
  check('slugify collapses punctuation', slugify("Love's Truck Care / Speedco") === 'love-s-truck-care-speedco');
  check('slugify trims edge hyphens', slugify('  -Foo-  ') === 'foo');
  check('slugify empty → listing', slugify('!!!') === 'listing');
  check('slugify caps at 80 chars', slugify('a'.repeat(200)).length <= 80);
}

/* ---------------------- detailSlugBase ---------------------- */
{
  check('detailSlugBase composes name-city-state', detailSlugBase('Pilot Travel Center #4558', 'Dalton', 'GA') === 'pilot-travel-center-4558-dalton-ga');
  check('detailSlugBase lowercases state', detailSlugBase('X', 'Y', 'TN').endsWith('-tn'));
  check('detailSlugBase empty → listing', detailSlugBase('', '', '') === 'listing');
  check('detailSlugBase caps at 100', detailSlugBase('a'.repeat(200), 'b', 'cc').length <= 100);
}

/* ---------------------- uniqueDetailSlug ---------------------- */
{
  check('unique: free base returned as-is', uniqueDetailSlug('foo', new Set()) === 'foo');
  check('unique: taken base → base-2', uniqueDetailSlug('foo', new Set(['foo'])) === 'foo-2');
  check('unique: base + base-2 taken → base-3', uniqueDetailSlug('foo', new Set(['foo', 'foo-2'])) === 'foo-3');
}

/* ---------------------- isValidDetailSlug ---------------------- */
{
  check('valid slug accepted', isValidDetailSlug('pilot-travel-center-4558-dalton-ga'));
  check('single char accepted', isValidDetailSlug('a'));
  check('uppercase rejected', !isValidDetailSlug('Pilot-GA'));
  check('leading hyphen rejected', !isValidDetailSlug('-foo'));
  check('trailing hyphen rejected', !isValidDetailSlug('foo-'));
  check('spaces rejected', !isValidDetailSlug('foo bar'));
  check('slashes rejected (no traversal)', !isValidDetailSlug('foo/bar'));
  check('empty rejected', !isValidDetailSlug(''));
}

/* ---------------------- detailHref ---------------------- */
{
  check('detailHref path', detailHref('foo-bar-ga') === '/directory/location/foo-bar-ga');
}

/* ---------------------- interstate slug <-> designation ---------------------- */
{
  check('I-75 → i75', interstateSlug('I-75') === 'i75');
  check('I75 (no dash) → i75', interstateSlug('I75') === 'i75');
  check('I-24 → i24', interstateSlug('I-24') === 'i24');
  check('non-interstate → null', interstateSlug('US-31') === null);
  check('garbage → null', interstateSlug('nope') === null);

  const known = interstateBySlug('i75');
  check('i75 → known corridor with state order', known?.designation === 'I-75' && (known?.stateOrder.length ?? 0) === 6);
  const generated = interstateBySlug('i24');
  check('i24 → generated corridor (no hand copy)', generated?.designation === 'I-24' && generated?.stateOrder.length === 0);
  check('invalid slug → undefined', interstateBySlug('x99y') === undefined);

  // Round trip: designation → slug → designation.
  for (const d of ['I-75', 'I-24', 'I-65', 'I-40']) {
    const s = interstateSlug(d)!;
    check(`round-trip ${d}`, interstateBySlug(s)?.designation === d);
  }
}

/* ---------------------- exit slug round-trip ---------------------- */
{
  check('exitSlug numeric', exitSlug('201') === 'exit-201');
  check('exitSlug alnum lowercased', exitSlug('7B') === 'exit-7b');
  check('exitSlug 180B', exitSlug('180B') === 'exit-180b');
  check('exitSlug trims/normalizes', exitSlug(' 12 A ') === 'exit-12-a');

  const known = ['81', '7B', '180B', '12 A'];
  for (const e of known) {
    check(`exitFromSlug round-trips ${e}`, exitFromSlug(exitSlug(e), known) === e);
  }
  check('exitFromSlug unknown → undefined', exitFromSlug('exit-999', known) === undefined);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
