/**
 * Unit tests for `lib/directory/interstates` — the corridor registry behind
 * /directory/i75-style hub pages and exit-page slugs.
 *
 * Run:
 *   npx esbuild scripts/test-interstates.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-interstates.cjs && node /tmp/test-interstates.cjs
 */
import {
  interstateSlug,
  interstateBySlug,
  exitSlug,
  exitFromSlug,
} from '@/lib/directory/interstates';
import { stateByCode } from '@/lib/directory/states';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/* ---------------------- interstateSlug ---------------------- */
{
  check('I-75 → i75', interstateSlug('I-75') === 'i75');
  check('I-24 → i24', interstateSlug('I-24') === 'i24');
  check('lowercase i-65 accepted', interstateSlug('i-65') === 'i65');
  check('no-hyphen form accepted', interstateSlug('I 40') === 'i40');
  check('US route rejected', interstateSlug('US-45') === null);
  check('garbage rejected', interstateSlug('Main St') === null);
}

/* ---------------------- registry copy (live corridors) ---------------------- */
{
  for (const [slug, states] of [
    ['i75', ['FL', 'GA', 'TN', 'KY', 'OH', 'MI']],
    ['i65', ['AL', 'TN', 'KY', 'IN']],
    ['i24', ['IL', 'KY', 'TN', 'GA']],
  ] as const) {
    const c = interstateBySlug(slug);
    check(`${slug} has registry entry`, !!c);
    check(`${slug} keeps its designation`, c?.designation === `I-${slug.slice(1)}`);
    check(`${slug} has hand-written intro (not generated fallback)`, !!c && !c.intro.startsWith('Truck stops, parking, scales'));
    check(`${slug} state order matches corridor geography`, c?.stateOrder.join() === states.join(), c?.stateOrder);
    for (const code of c?.stateOrder ?? []) {
      check(`${slug} state code ${code} is a real state`, !!stateByCode(code));
    }
  }
}

/* ---------------------- fallback corridors ---------------------- */
{
  const c = interstateBySlug('i40');
  check('unknown corridor still resolves', !!c && c.designation === 'I-40');
  check('unknown corridor gets generated copy', !!c && c.intro.includes('I-40'));
  check('unknown corridor has empty state order (alphabetical fallback)', c?.stateOrder.length === 0);
  check('non-interstate slug rejected', interstateBySlug('georgia') === undefined);
  check('bare "i" rejected', interstateBySlug('i') === undefined);
}

/* ---------------------- exit slugs ---------------------- */
{
  check('numeric exit', exitSlug('201') === 'exit-201');
  check('lettered exit lowercased', exitSlug('7B') === 'exit-7b');
  check('messy exit normalized', exitSlug(' 11 A ') === 'exit-11-a');
  const known = ['201', '7B', '11'];
  check('exitFromSlug round-trips numeric', exitFromSlug(exitSlug('201'), known) === '201');
  check('exitFromSlug round-trips lettered', exitFromSlug(exitSlug('7B'), known) === '7B');
  check('exitFromSlug misses unknown', exitFromSlug('exit-999', known) === undefined);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
