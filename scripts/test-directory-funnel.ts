/**
 * Directory claim / featured-placement funnel — bounding, privacy, and
 * event-contract tests.
 *
 * Offline. Exercises the pure helpers in src/lib/directory/funnel.ts, which are
 * the single place every value that reaches a URL or an analytics event is
 * bounded. Proves: no PII escapes, untrusted input cannot smuggle markup or
 * query params into a link, failed submits are a distinct event from successes,
 * and the funnel never claims verification or promises results.
 *
 * Run:
 *   npx esbuild scripts/test-directory-funnel.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-directory-funnel.cjs && node /tmp/test-directory-funnel.cjs
 */
import { readFileSync } from 'node:fs';
import {
  DIRECTORY_EVENTS,
  FUNNEL_INTEREST,
  boundCorridor,
  boundState,
  boundToken,
  funnelHref,
  intentLabel,
  listingContextLine,
  listingEventProps,
} from '@/lib/directory/funnel';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---- bounding primitives ----
check('boundToken lowercases and slugs', boundToken("Pat's Tire") === 'pat-s-tire');
check('boundToken caps length', (boundToken('a'.repeat(200), 48) ?? '').length <= 48);
check('boundToken drops empties', boundToken('   ') === null && boundToken(undefined) === null);
check(
  'boundToken strips trailing hyphen after cut',
  !(boundToken('ab '.repeat(40), 10) ?? '').endsWith('-'),
);
check('boundState accepts 2-letter', boundState(' oh ') === 'OH');
check('boundState rejects other', boundState('Ohio') === null && boundState('O') === null);
check('boundCorridor I-40 -> i40', boundCorridor('I-40') === 'i40');
check('boundCorridor I 95 -> i95', boundCorridor('I 95') === 'i95');
check('boundCorridor rejects non-interstate', boundCorridor('US-301') === null);

// ---- injection / smuggling cannot reach a URL ----
const nasty = {
  slug: 'ok-slug',
  name: '"><script>alert(1)</script>',
  category: 'tire-repair&admin=1',
  state: 'OH',
};
const href = funnelHref('claim', nasty, 'directory-listing');
check('href has no angle brackets', !href.includes('<') && !href.includes('>'));
check('href has no raw quote', !href.includes('"'));
check('href cannot inject an extra param', !/[&?]admin=/.test(href));
check('href keeps the interest param', href.includes(`interest=${FUNNEL_INTEREST.claim}`));
check('href targets the existing sponsors route', href.startsWith('/sponsors?'));
check('href anchors the inquiry form', href.endsWith('#inquire'));
check(
  'featured href uses the existing interest value',
  funnelHref('featured', { slug: 'x' }).includes('interest=directory-placement'),
);

// ---- analytics payloads carry no PII ----
const props = listingEventProps(
  {
    id: '11111111-2222-3333-4444-555555555555',
    slug: 'martino-commercial-tire-west-palm-beach-fl',
    name: 'Martino Commercial Tire',
    category: 'tire-repair',
    state: 'FL',
    interstate: 'I-95',
  },
  { surface: 'directory-listing' },
);
const serialized = JSON.stringify(props);
check('event carries listing id', props.listing_id?.startsWith('11111111'));
check('event carries bounded slug', props.slug === 'martino-commercial-tire-west-palm-beach-fl');
check(
  'event carries category/state/corridor',
  props.category === 'tire-repair' && props.state === 'FL' && props.corridor === 'i95',
);
for (const forbidden of ['@', 'email', 'phone', 'message', 'address', 'password', 'token']) {
  check(`event payload excludes '${forbidden}'`, !serialized.toLowerCase().includes(forbidden));
}
check('event never includes a raw display name', !serialized.includes('Martino Commercial Tire'));
check('empty context yields empty payload', Object.keys(listingEventProps({})).length === 0);

// ---- context line is honest and only present with a real listing ----
const line = listingContextLine({
  name: 'Martino Commercial Tire',
  slug: 'martino-commercial-tire-west-palm-beach-fl',
  category: 'tire-repair',
  state: 'FL',
});
check(
  'context line names the listing path',
  line.includes('/directory/location/martino-commercial-tire-west-palm-beach-fl'),
);
check('context line is labelled', line.startsWith('Regarding directory listing:'));
check('no listing -> no fabricated line', listingContextLine({}) === '');
check('context line makes no ownership claim', !/verified|approved|owner confirmed/i.test(line));

// ---- event names are stable and distinct ----
const names = Object.values(DIRECTORY_EVENTS);
check('event names unique', new Set(names).size === names.length);
// Compared as plain strings: the literal types never overlap, so a typed
// comparison would be a compile-time tautology rather than a real assertion.
const eventName = (n: string): string => n;
check(
  'submit and fail are distinct events',
  eventName(DIRECTORY_EVENTS.formSubmit) !== eventName(DIRECTORY_EVENTS.formFail),
);
check(
  'claim and featured are distinct events',
  eventName(DIRECTORY_EVENTS.claimInterest) !== eventName(DIRECTORY_EVENTS.featuredInterest),
);
for (const n of names) check(`event '${n}' is snake_case`, /^[a-z][a-z0-9_]*$/.test(n));

// ---- copy safety: no promises, no pricing, no verification claims ----
const cta = readFileSync('src/components/directory/ListingFunnelCtas.tsx', 'utf8');
const form = readFileSync('src/components/sponsors/SponsorInquiryForm.tsx', 'utf8');
const BANNED = [
  /\$\s?\d/, // a price
  /guarantee/i,
  /\bmore leads\b/i,
  /\btop of (?:the )?(?:search|results)\b/i,
  /\bwe promise\b/i,
  /\bverified owner\b/i,
];
for (const re of BANNED) {
  check(`CTA copy avoids ${re}`, !re.test(cta), re.source);
  check(`form copy avoids ${re}`, !re.test(form), re.source);
}
check(
  'CTA states review happens before change',
  /reviews it personally|reviewed before anything changes/i.test(cta),
);
check('CTA states no payment is collected', /no payment is collected/i.test(cta));
check('CTA does not assert the listing is claimed', !/is now claimed|listing claimed/i.test(cta));
check('form keeps the no-rate-committed line', /no rate is committed/i.test(form));

// ---- funnel reuses existing infrastructure (no new vendor / table / payment) ----
check('CTA posts nowhere itself', !/fetch\(/.test(cta));
check('form still posts to the existing sponsor route', form.includes("'/api/sponsor-inquiry'"));
check('form still uses Turnstile', form.includes('TurnstileWidget'));
check('form remounts the challenge on failure', /setChallengeKey\(\(k\) => k \+ 1\)/.test(form));
check('failure path fires the fail event', form.includes('DIRECTORY_EVENTS.formFail'));
check('success path fires the submit event', form.includes('DIRECTORY_EVENTS.formSubmit'));
const funnelSrc = readFileSync('src/lib/directory/funnel.ts', 'utf8');
check(
  'funnel adds no analytics vendor',
  !/gtag|segment|mixpanel|amplitude|posthog/i.test(funnelSrc),
);
check('funnel writes no database', !/supabase|insert\(|from\(/i.test(funnelSrc));

// ---- events component never blocks the user action ----
const events = readFileSync('src/components/directory/DirectoryEvents.tsx', 'utf8');
check('click listener is passive', /\{\s*passive:\s*true\s*\}/.test(events));
check('click listener never preventDefault', !/preventDefault/.test(events));
check('events component renders nothing', /return null;/.test(events));
check('listing view fires once per listing', /viewedRef/.test(events));

// ---- interest labels ----
check('claim label', intentLabel('claim') === 'Claim this listing');
check('featured label', intentLabel('featured') === 'Ask about featured placement');
check('claim interest value', FUNNEL_INTEREST.claim === 'listing-claim');
check('claim interest fits tier_interest max 60', FUNNEL_INTEREST.claim.length <= 60);

console.log(`directory-funnel: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
