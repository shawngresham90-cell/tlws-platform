/**
 * Milestone 21 unit tests: completeness scoring (exact values, determinism,
 * category-awareness), quality issue detectors (missing/malformed fields,
 * duplicates vs co-location, stale slug/verification, thin listings), and
 * trust statuses (evidence-only, deterministic clock).
 *
 * Run:
 *   npx esbuild scripts/test-quality.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-quality.cjs && node /tmp/test-quality.cjs
 */
import { scoreCompleteness, completenessLabel, completenessDistribution } from '@/lib/directory/completeness';
import { detectIssues, isThinListing, issuesCsv, type QualityListing } from '@/lib/directory/issues';
import { trustStatus } from '@/lib/directory/trust';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const NOW = new Date('2026-07-11T00:00:00Z');

/* ------------------------- completeness ------------------------- */
{
  const full = {
    name: 'Pilot #4558',
    category: 'truck-stops',
    address: '324 Carbondale Rd',
    city: 'Calhoun',
    state: 'GA',
    zip: '30701',
    interstate: 'I-75',
    exitNumber: '306',
    lat: 34.4,
    lng: -84.9,
    phone: '(706) 555-0100',
    website: 'https://example.com',
    amenities: ['Showers', 'Fuel', 'Overnight OK'],
    parkingSpaces: 80,
    description: 'A full-service truck stop with fuel, showers, parking, and a real diner on site.',
    tpcUrl: 'https://truckparkingclub.com/l/1',
    verifiedAt: '2026-07-01T00:00:00Z',
    approvedReviews: 2,
  };
  const perfect = scoreCompleteness(full);
  check('score: fully complete = 100', perfect.score === 100, perfect.score);
  check('score: label Excellent', perfect.label === 'Excellent');
  check('score: nothing missing', perfect.missing.length === 0);
  check('score: deterministic', scoreCompleteness(full).score === perfect.score);

  const empty = scoreCompleteness({
    name: '',
    category: 'mystery',
    city: '',
    state: '',
    amenities: [],
  });
  check('score: empty listing = 0', empty.score === 0, empty.score);
  check('score: label Incomplete', empty.label === 'Incomplete');

  // Exact arithmetic: name(6)+category(6)+city(4)+state(2) of applicable 100 → 18%.
  const partial = scoreCompleteness({
    name: 'Stop',
    category: 'truck-stops',
    city: 'Dalton',
    state: 'GA',
    amenities: [],
  });
  check('score: exact partial value', partial.score === 18, partial.score);

  // Category-awareness: a weigh station without phone/website/TPC/parking
  // fields is scored only on what applies to it.
  const weighFields = {
    name: 'GA DPS Scale',
    category: 'weigh-stations' as const,
    address: 'I-75 SB MM 179',
    city: 'Forsyth',
    state: 'GA',
    zip: '31029',
    interstate: 'I-75',
    exitNumber: '179',
    lat: 33.0,
    lng: -83.9,
    description: 'Southbound weigh station with rolling scales; usually open weekday mornings.',
    amenities: [],
    verifiedAt: '2026-07-01T00:00:00Z',
    approvedReviews: 0,
  };
  const weigh = scoreCompleteness(weighFields);
  const sameAsTruckStop = scoreCompleteness({ ...weighFields, category: 'truck-stops' });
  check('score: weigh station not punished for phone/website', weigh.score > sameAsTruckStop.score, `${weigh.score} vs ${sameAsTruckStop.score}`);
  check('score: weigh station missing list has no phone/website', !weigh.missing.includes('Phone') && !weigh.missing.includes('Website'));
  check('score: truck stop DOES get phone in missing list', sameAsTruckStop.missing.includes('Phone'));

  check('label boundaries', completenessLabel(85) === 'Excellent' && completenessLabel(84) === 'Good' && completenessLabel(65) === 'Good' && completenessLabel(64) === 'Needs work' && completenessLabel(40) === 'Needs work' && completenessLabel(39) === 'Incomplete');
  const dist = completenessDistribution([90, 70, 50, 10]);
  check('distribution buckets', dist.Excellent === 1 && dist.Good === 1 && dist['Needs work'] === 1 && dist.Incomplete === 1);
}

/* ------------------------- issue detection ------------------------- */
const q = (over: Partial<QualityListing>): QualityListing => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: 'Stop',
  categorySlug: 'truck-stops',
  address: '1 Road',
  city: 'Dalton',
  state: 'GA',
  zip: '30720',
  phone: '(706) 555-0100',
  website: 'https://example.com',
  description: 'A perfectly reasonable description for a truck stop on I-75.',
  amenities: ['Showers'],
  interstate: 'I-75',
  exitNumber: '333',
  lat: 34.7,
  lng: -84.9,
  tpcUrl: null,
  detailSlug: 'stop-dalton-ga',
  published: true,
  deleted: false,
  verifiedAt: '2026-07-01T00:00:00Z',
  parkingSpaces: 50,
  freeParking: true,
  paidParking: false,
  reservedParking: false,
  overnightParking: true,
  ...over,
});

{
  const clean = q({ name: 'Stop', detailSlug: 'stop-dalton-ga' });
  const cleanIssues = detectIssues([clean], NOW);
  check('issues: clean listing has none', cleanIssues.length === 0, cleanIssues.map((i) => i.type));

  const types = (row: QualityListing) => detectIssues([row], NOW).map((i) => i.type);
  check('issues: malformed phone', types(q({ phone: 'call me maybe' })).includes('malformed-phone'));
  check('issues: malformed website', types(q({ website: 'javascript:alert(1)' })).includes('malformed-website'));
  check('issues: malformed tpc url', types(q({ tpcUrl: 'https://evil.com/x' })).includes('malformed-tpc-url'));
  check('issues: half coordinates', types(q({ lng: null })).includes('malformed-coordinates'));
  check('issues: swapped coordinates', types(q({ lat: -84.9, lng: 34.7 })).includes('malformed-coordinates'));
  check('issues: missing address (published high)', detectIssues([q({ address: null })], NOW).some((i) => i.type === 'missing-address' && i.severity === 'high'));
  check('issues: missing zip', types(q({ zip: null })).includes('missing-zip'));
  check('issues: exit without number', types(q({ exitNumber: null })).includes('missing-exit'));
  check('issues: stale verification (>365d)', types(q({ verifiedAt: '2024-01-01T00:00:00Z' })).includes('stale-verification'));
  check('issues: fresh verification silent', !types(q({ verifiedAt: '2026-06-01T00:00:00Z' })).includes('stale-verification'));
  check('issues: stale slug after rename', types(q({ detailSlug: 'old-name-dalton-ga' })).includes('stale-slug'));
  check('issues: collision-suffix slug is fine', !types(q({ detailSlug: 'stop-dalton-ga-2' })).includes('stale-slug'));
  check('issues: tpc candidate (parking category)', types(q({ categorySlug: 'parking' })).includes('tpc-candidate'));
  check('issues: weigh station skips phone/website', !types(q({ categorySlug: 'weigh-stations', phone: null, website: null })).some((t) => t === 'missing-phone' || t === 'missing-website'));

  // thin listing
  check('thin: no address → thin', isThinListing(q({ address: null, phone: null, website: null, description: null, amenities: [], lat: null, lng: null, parkingSpaces: null, freeParking: false, overnightParking: false })));
  check('thin: rich listing not thin', !isThinListing(q({})));
  check('thin: unpublished never thin-flagged', !isThinListing(q({ published: false, address: null })));

  // duplicates vs co-location
  const dupA = q({ id: 'a', name: 'TA Dalton', address: '100 Connector 3', lat: 34.7, lng: -84.9 });
  const dupB = q({ id: 'b', name: 'TA Dalton', address: '100 Connector 3', lat: 34.7, lng: -84.9 });
  const dupIssues = detectIssues([dupA, dupB], NOW);
  check('issues: exact duplicate suspect', dupIssues.filter((i) => i.type === 'duplicate-suspect').length === 2);

  const coA = q({ id: 'c', name: 'Petro Stopping Center', address: '200 Highway 41', categorySlug: 'truck-stops' });
  const coB = q({ id: 'd', name: 'CAT Scale — Petro', address: '200 Highway 41', categorySlug: 'cat-scales' });
  const coIssues = detectIssues([coA, coB], NOW);
  check('issues: co-location is info, not duplicate', coIssues.some((i) => i.type === 'possible-co-location' && i.severity === 'info') && !coIssues.some((i) => i.type === 'duplicate-suspect'));

  const csv = issuesCsv(detectIssues([q({ name: '=EVIL()', phone: 'bad' })], NOW));
  check('issues: CSV formula-guarded', csv.includes("'=EVIL()"));
}

/* ------------------------- trust ------------------------- */
{
  check('trust: recent verification', trustStatus({ verifiedAt: '2026-06-01T00:00:00Z' }, NOW) === 'recently-verified');
  check('trust: older verification', trustStatus({ verifiedAt: '2025-12-01T00:00:00Z' }, NOW) === 'verified');
  check('trust: stale needs re-verification', trustStatus({ verifiedAt: '2024-01-01T00:00:00Z' }, NOW) === 'needs-reverification');
  check('trust: community confirmed via approved review', trustStatus({ approvedReviews: 1 }, NOW) === 'community-confirmed');
  check('trust: community confirmed via approved correction', trustStatus({ approvedCorrections: 2 }, NOW) === 'community-confirmed');
  check('trust: nothing → unverified', trustStatus({}, NOW) === 'unverified');
  check('trust: popularity is not evidence', trustStatus({ approvedReviews: 0 }, NOW) === 'unverified');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
