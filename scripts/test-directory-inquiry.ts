/**
 * Directory inquiry parsing — the CRM read path.
 *
 * The funnel adds no column to `sponsors`. It writes two labelled lines into
 * the existing `notes` and the offer id into the existing `tier_interest`; the
 * admin inbox parses them back into columns. This asserts that round trip end
 * to end (funnel writer → parser), that a non-directory lead is never
 * mislabelled, and that a hostile note cannot produce a bad link or lose the
 * human message.
 *
 * Run:
 *   npx esbuild scripts/test-directory-inquiry.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-directory-inquiry.cjs && node /tmp/test-directory-inquiry.cjs
 */
import { readFileSync } from 'node:fs';
import { isDirectoryInquiry, parseDirectoryInquiry } from '@/lib/admin/directory-inquiry';
import { FUNNEL_INTEREST, corridorLabel, listingContextLine } from '@/lib/directory/funnel';
import { OFFERS } from '@/lib/directory/offers';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const billingLine = (b: 'Monthly' | 'Annual') =>
  `Billing preference: ${b} (preference only — no payment was taken)`;

// ---- round trip: exactly what the form composes is what the inbox reads ----
const ctx = {
  name: 'joes-tire-and-truck-service',
  slug: 'joes-tire-and-truck-service-elkton-md',
  category: 'repair',
  state: 'MD',
  interstate: 'I-95',
};
const composed = [listingContextLine(ctx), billingLine('Annual'), 'Call me after 4pm.'].join(
  '\n\n',
);
const p = parseDirectoryInquiry(FUNNEL_INTEREST.featured, composed);

check('round trip: type', p.type === 'featured-listing', String(p.type));
check('round trip: type label', p.typeLabel === 'Featured listing', String(p.typeLabel));
check('round trip: name', p.listingName === ctx.name, String(p.listingName));
check('round trip: slug', p.listingSlug === ctx.slug, String(p.listingSlug));
check(
  'round trip: path',
  p.listingPath === `/directory/location/${ctx.slug}`,
  String(p.listingPath),
);
check('round trip: category', p.category === 'repair', String(p.category));
check('round trip: state', p.state === 'MD', String(p.state));
check('round trip: corridor', p.corridor === 'I-95', String(p.corridor));
check('round trip: billing', p.billing === 'annual', String(p.billing));
check(
  'round trip: message keeps only the human text',
  p.message === 'Call me after 4pm.',
  String(p.message),
);
check('round trip: recognised as directory', isDirectoryInquiry(p));

// The two machine lines must not leak into the readable message.
check('message drops the listing line', !/Regarding directory listing/i.test(p.message ?? ''));
check('message drops the billing line', !/Billing preference/i.test(p.message ?? ''));

// ---- every offer id parses to a labelled type ----
for (const o of OFFERS) {
  const q = parseDirectoryInquiry(o.id, composed);
  check(`${o.id} maps to a label`, q.type === o.id && !!q.typeLabel, String(q.typeLabel));
}
check(
  'monthly parses',
  parseDirectoryInquiry(FUNNEL_INTEREST.corridor, billingLine('Monthly')).billing === 'monthly',
);
// Billing alone, with no offer id and no listing line, is not a directory
// inquiry — the parser must not claim one from a stray line.
check(
  'billing alone is not a directory inquiry',
  parseDirectoryInquiry(null, billingLine('Monthly')).billing === null,
);

// ---- partial context: nothing is invented ----
const minimal = parseDirectoryInquiry(
  FUNNEL_INTEREST.claim,
  listingContextLine({ slug: 'plain-stop-de', name: 'Plain Stop' }),
);
check('minimal: type', minimal.type === 'listing-claim');
check('minimal: no category invented', minimal.category === null, String(minimal.category));
check('minimal: no state invented', minimal.state === null, String(minimal.state));
check('minimal: no corridor invented', minimal.corridor === null, String(minimal.corridor));
check('minimal: no billing invented', minimal.billing === null, String(minimal.billing));
check('minimal: empty message is null, not ""', minimal.message === null, String(minimal.message));

// listingContextLine refuses to write a line with no listing, so the parser
// must never fabricate one from an interest alone.
check('no listing line without a slug', listingContextLine({ name: 'Nameless' }) === '');
const interestOnly = parseDirectoryInquiry(
  FUNNEL_INTEREST.corridor,
  'Just interested, no listing.',
);
check('interest-only: still a directory inquiry', isDirectoryInquiry(interestOnly));
check('interest-only: no listing path', interestOnly.listingPath === null);
check('interest-only: message survives', interestOnly.message === 'Just interested, no listing.');

// ---- non-directory leads are untouched ----
const legacy = parseDirectoryInquiry('founding-sponsor', 'We want to fund a classroom.');
check('legacy: no type', legacy.type === null, String(legacy.type));
check('legacy: not a directory inquiry', !isDirectoryInquiry(legacy));
check('legacy: message untouched', legacy.message === 'We want to fund a classroom.');
const blank = parseDirectoryInquiry(null, null);
check('blank: no type', blank.type === null);
check('blank: no message', blank.message === null);
check('blank: not a directory inquiry', !isDirectoryInquiry(blank));
check('whitespace tier is not a type', parseDirectoryInquiry('   ', null).type === null);
check(
  'unknown tier is not a type',
  parseDirectoryInquiry('listing-claim-but-not-really', null).type === null,
);

// ---- hostile notes cannot produce a bad link or a lost message ----
const hostile = [
  'Regarding directory listing: Evil (/directory/location/../../admin)',
  'Regarding directory listing: Evil (https://evil.example/x)',
  'Regarding directory listing: Evil (/admin/sponsors)',
  'Regarding directory listing: Evil (javascript:alert(1))',
];
for (const note of hostile) {
  const h = parseDirectoryInquiry(null, note);
  check(`hostile path rejected: ${note.slice(-28)}`, h.listingPath === null, String(h.listingPath));
  check(`hostile note keeps its text: ${note.slice(-28)}`, (h.message ?? '').includes('Evil'));
}
const injected = parseDirectoryInquiry(
  FUNNEL_INTEREST.claim,
  `${listingContextLine({ slug: 'ok-stop-md', name: '<script>alert(1)</script>' })}\n\nhi`,
);
check(
  'injected name is carried as text, path stays a slug',
  injected.listingPath === '/directory/location/ok-stop-md',
  String(injected.listingPath),
);
check(
  'parsed path is always slug-shaped',
  /^\/directory\/location\/[a-z0-9-]+$/.test(injected.listingPath ?? ''),
);

// A note that merely mentions the phrase mid-sentence must not be parsed as
// the machine line (the pattern is anchored to the start of a line).
const mention = parseDirectoryInquiry(
  null,
  'I was reading directory listing: stuff (/directory/location/x)',
);
check('mid-line mention is not parsed', mention.listingPath === null, String(mention.listingPath));

// ---- corridorLabel round-trips only real corridor tokens ----
check('corridorLabel i95', corridorLabel('i95') === 'I-95');
check('corridorLabel I-40', corridorLabel('I-40') === 'I-40');
check('corridorLabel rejects text', corridorLabel('US-1') === null);
check('corridorLabel rejects empty', corridorLabel('') === null);

// ---- the admin page reads, never writes, a directory record ----
const page = readFileSync('src/app/admin/(dashboard)/sponsors/page.tsx', 'utf8');
check('admin page uses the parser', /parseDirectoryInquiry/.test(page));
check('admin page never updates locations', !/from\('locations'\)|update\(/.test(page));
// No mutation path exists on this page at all: it is a server component with
// no server action, no form, and no fetch. The only writable control is the
// pre-existing lead StatusSelect.
check('admin page declares no server action', !/'use server'/.test(page));
check('admin page posts nothing', !/<form|fetch\(|method="post"/i.test(page));
check('admin page says a claim does not change a listing', /never changes a\s+listing/i.test(page));

// ---- no migration was introduced for any of this ----
const data = readFileSync('src/lib/admin/data.ts', 'utf8');
for (const col of ['stage', 'next_action', 'next_action_date', 'notes', 'tier_interest']) {
  check(`sponsors select includes existing column ${col}`, data.includes(col));
}
check('no new table is queried', !/from\('sponsor_directory|claims'\)/.test(data));

console.log(`directory-inquiry: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
