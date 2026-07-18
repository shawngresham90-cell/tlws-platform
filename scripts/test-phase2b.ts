/**
 * Phase 2B unit tests: Census adapter (offline, injected fetch), concurrency
 * normalization, review enrichment, stale-review protection, staged
 * backfill, and duplicate prevention. Pure logic — no network, no database;
 * the fake fetch proves the adapter makes zero real calls.
 *
 * Run:
 *   npx esbuild scripts/test-phase2b.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=/tmp/test-phase2b.cjs \
 *   && node /tmp/test-phase2b.cjs
 */
import {
  normalizeCensusAddress,
  classifyCensusResponse,
  censusGeocodeOne,
  censusGeocodeBatch,
  censusResultsToReviewRows,
  createCensusGeocoder,
  type CensusQuery,
  type CensusApiResponse,
} from '@/lib/directory/census-geocoder';
import { resolveCorridor, concurrencyReport, CONCURRENCY_RULES } from '@/lib/directory/concurrency';
import {
  proposalMethod,
  geocodeSourceForMethod,
  enrichReviewRow,
  isStaleReview,
} from '@/lib/directory/review-enrichment';
import {
  assignStages,
  summarizeStages,
  projectedCoverage,
  neverAutoGeocode,
} from '@/lib/directory/backfill-stages';
import { runGeocodePipeline, type PipelineListing } from '@/lib/directory/geocode-pipeline';
import { buildCalibrations } from '@/lib/directory/calibration';
import { parseGeocodingCsv, validateBatch, type ValidatedRow } from '@/lib/directory/geocoding';
import { toCsv } from '@/lib/directory/csv';
import { GEOCODING_COLUMNS } from '@/lib/directory/geocoding';
import { findDuplicatePairs } from '@/lib/directory/duplicates';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const UUID = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;

/* ------------------------------------------------ address normalization */
const q = (address: string): CensusQuery => ({
  id: UUID(1),
  address,
  city: 'Macon',
  state: 'GA',
  zip: '31201',
});
check('census: PO box rejected', normalizeCensusAddress(q('PO Box 123')).rejection === 'po-box');
check('census: P.O. Box rejected', normalizeCensusAddress(q('P.O. Box 9')).rejection === 'po-box');
check('census: blank rejected', normalizeCensusAddress(q('  ')).rejection === 'blank-address');
check(
  'census: highway-only rejected',
  normalizeCensusAddress(q('I-40 & SR 5')).rejection === 'highway-only-address',
);
check(
  'census: exit-style highway rejected',
  normalizeCensusAddress(q('I-75 at Exit 296')).rejection === 'highway-only-address',
);
check(
  'census: street address passes',
  normalizeCensusAddress(q('3404 Highway 63 N')).line === '3404 Highway 63 N',
);
check(
  'census: suite stripped',
  normalizeCensusAddress(q('100 Main St Suite 4')).line === '100 Main St',
);
check(
  'census: whitespace collapsed',
  normalizeCensusAddress(q('100   Main  St')).line === '100 Main St',
);

/* ------------------------------------------------ response classification */
const gaMatch = (over: Record<string, unknown> = {}): CensusApiResponse => ({
  result: {
    addressMatches: [
      {
        coordinates: { x: -83.63, y: 32.84 },
        matchedAddress: '100 MAIN ST, MACON, GA, 31201',
        addressComponents: { state: 'GA' },
        matchType: 'Exact',
        ...over,
      },
    ],
  },
});
const cls = (api: CensusApiResponse) =>
  classifyCensusResponse(q('100 Main St'), '100 Main St, Macon, GA 31201', api);

check(
  'census: exact in-state → high',
  (() => {
    const r = cls(gaMatch());
    return r.status === 'exact' && r.confidence === 'high';
  })(),
);
check(
  'census: non-exact in-state → approximate/medium',
  (() => {
    const r = cls(gaMatch({ matchType: 'Non_Exact' }));
    return r.status === 'approximate' && r.confidence === 'medium';
  })(),
);
check(
  'census: no matches → no-match',
  cls({ result: { addressMatches: [] } }).rejection === 'no-match',
);
check(
  'census: two matches → tie',
  (() => {
    const api = gaMatch();
    api.result!.addressMatches!.push({ ...api.result!.addressMatches![0] });
    return cls(api).rejection === 'tie';
  })(),
);
check(
  'census: wrong state component → rejected',
  cls(gaMatch({ addressComponents: { state: 'TX' } })).rejection === 'wrong-state',
);
check(
  'census: right label, out-of-bounds coords → rejected',
  (() => {
    const api = gaMatch({ coordinates: { x: -97.7, y: 30.3 } }); // Austin TX coords, GA claim
    return cls(api).rejection === 'wrong-state';
  })(),
);
check(
  'census: 0,0 coords → impossible',
  cls(gaMatch({ coordinates: { x: 0, y: 0 } })).rejection === 'impossible-coordinates',
);
check(
  'census: submitted + matched addresses preserved',
  (() => {
    const r = cls(gaMatch());
    return r.submittedAddress.includes('100 Main St') && r.matchedAddress.includes('100 MAIN ST');
  })(),
);

/* ------------------------------------------------ retry / rate limiting */
async function runAsyncChecks() {
  let calls = 0;
  const flaky = async (_url: string) => {
    calls++;
    if (calls < 3) return { status: 503, json: async () => ({}) };
    return { status: 200, json: async () => gaMatch() as unknown };
  };
  const sleeps: number[] = [];
  const fakeSleep = async (ms: number) => {
    sleeps.push(ms);
  };

  const retried = await censusGeocodeOne(q('100 Main St'), { fetchFn: flaky, sleep: fakeSleep });
  check('census: retries through 5xx then succeeds', retried.status === 'exact' && calls === 3);
  check('census: backoff doubled', sleeps.length === 2 && sleeps[1] === 2 * sleeps[0], sleeps);

  calls = 0;
  const always429 = async () => {
    calls++;
    return { status: 429, json: async () => ({}) };
  };
  const gaveUp = await censusGeocodeOne(q('100 Main St'), {
    fetchFn: always429,
    sleep: fakeSleep,
    maxRetries: 2,
  });
  check(
    'census: gives up after retries → service-error rejection',
    gaveUp.status === 'rejected' && gaveUp.matchType === 'service-error' && calls === 3,
  );

  let fetchCount = 0;
  const counting = async () => {
    fetchCount++;
    return { status: 200, json: async () => gaMatch() as unknown };
  };
  const batchSleeps: number[] = [];
  await censusGeocodeBatch(
    [q('100 Main St'), { ...q('200 Main St'), id: UUID(2) }, { ...q('300 Main St'), id: UUID(3) }],
    {
      fetchFn: counting,
      sleep: async (ms) => {
        batchSleeps.push(ms);
      },
      minIntervalMs: 500,
    },
  );
  check(
    'census: batch preserves politeness interval',
    batchSleeps.filter((m) => m === 500).length === 2,
  );
  check('census: batch hits service once per query', fetchCount === 3);
  check(
    'census: rejected-before-submit makes zero calls',
    await (async () => {
      let n = 0;
      await censusGeocodeOne(q('PO Box 1'), {
        fetchFn: async () => {
          n++;
          return { status: 200, json: async () => ({}) };
        },
      });
      return n === 0;
    })(),
  );

  /* ------------------------------------------------ adapter seam */
  const adapter = createCensusGeocoder({
    fetchFn: async () => ({ status: 200, json: async () => gaMatch() as unknown }),
  });
  const adapterHit = await adapter.geocode({
    address: '100 Main St',
    city: 'Macon',
    state: 'GA',
    zip: '31201',
  });
  check('census: adapter returns high for exact', adapterHit?.confidence === 'high');
  const adapterMiss = await createCensusGeocoder({
    fetchFn: async () => ({ status: 200, json: async () => ({ result: { addressMatches: [] } }) }),
  }).geocode({ address: '100 Main St', city: 'Macon', state: 'GA', zip: '31201' });
  check('census: adapter returns null on rejection', adapterMiss === null);
}

/* ------------------------------------------------ review-queue rows */
const reviewRows = censusResultsToReviewRows(
  [cls(gaMatch())],
  new Map([
    [
      UUID(1),
      {
        name: 'Test',
        categorySlug: 'truck-stops',
        address: '100 Main St',
        city: 'Macon',
        state: 'GA',
        zip: '31201',
        lat: null,
        lng: null,
      },
    ],
  ]),
);
const reviewCsv = toCsv([[...GEOCODING_COLUMNS], ...reviewRows]);
const reparsed = parseGeocodingCsv(reviewCsv);
check('census: review rows parse under console contract', reparsed.rows.length === 1);
check(
  'census: review rows are manual-review only',
  reparsed.rows.every((r) => r.action === 'manual-review'),
);
check(
  'census: review rows never auto-applicable',
  validateBatch(
    reparsed.rows,
    new Map([
      [
        UUID(1),
        {
          id: UUID(1),
          name: 'Test',
          address: '100 Main St',
          city: 'Macon',
          state: 'GA',
          lat: null,
          lng: null,
        },
      ],
    ]),
  ).every((r) => !r.applicable),
);

/* ------------------------------------------------ concurrency */
check(
  'concurrency: rules documented',
  CONCURRENCY_RULES.every((r) => r.reason.length > 20),
);
const watt = resolveCorridor('TN', 'I-75', '369');
check('concurrency: Watt Road I-75/369 → I-40', watt.canonical === 'I-40' && watt.rule !== null);
check(
  'concurrency: original tag preserved',
  watt.tagged === 'I-75' && watt.aliases.includes('I-75') && watt.aliases.includes('I-40'),
);
check(
  'concurrency: in-range I-75 TN exit untouched',
  resolveCorridor('TN', 'I-75', '141').canonical === 'I-75',
);
check('concurrency: no exit → pass-through', resolveCorridor('TN', 'I-75', '').rule === null);
check(
  'concurrency: other states untouched',
  resolveCorridor('GA', 'I-75', '369').canonical === 'I-75',
);
const cReport = concurrencyReport([
  { id: 'a', name: 'Watt Rd Petro', state: 'TN', interstate: 'I-75', exitNumber: '369' },
  { id: 'b', name: 'Normal stop', state: 'TN', interstate: 'I-75', exitNumber: '141' },
]);
check(
  'concurrency: report lists only normalized rows',
  cReport.length === 1 && cReport[0].id === 'a',
);

/* ------------------------------------------------ enrichment + staleness */
const mkRow = (over: Partial<ValidatedRow>): ValidatedRow =>
  ({
    listing_id: UUID(9),
    business_name: 'Stop',
    category: 'truck-stops',
    address: '1 Rd',
    city: 'Macon',
    state: 'GA',
    zip: '31201',
    current_latitude: null,
    current_longitude: null,
    proposed_latitude: 32.8,
    proposed_longitude: -83.6,
    confidence: 'medium',
    source_url: '',
    verification_notes: 'mile-marker interpolation; between mileposts 100 and 110',
    action: 'manual-review',
    evidence: {
      confidenceReason: '',
      sourceCount: null,
      sourceUrls: [],
      lastResearched: '',
      reviewerNotes: '',
      sideOfRoadConfirmed: null,
      propertyConfirmed: null,
      cityStateValidated: null,
      priority: '',
      concernFlag: false,
      status: '',
    },
    applicable: false,
    problems: [],
    problemDetails: [],
    wouldOverwrite: false,
    live: { name: 'Stop', lat: null, lng: null, interstate: 'I-75' },
    ...over,
  }) as ValidatedRow;

check(
  'enrich: interpolation method detected',
  proposalMethod(mkRow({})) === 'corridor-interpolation',
);
check(
  'enrich: census method detected',
  proposalMethod(
    mkRow({ verification_notes: 'census exact match (Exact); submitted: x; matched: y' }),
  ) === 'census-geocoder',
);
check(
  'enrich: manual fallback',
  proposalMethod(mkRow({ verification_notes: 'hand research' })) === 'manual',
);
check(
  'enrich: method → geocode_source mapping',
  geocodeSourceForMethod('corridor-interpolation') === 'interpolation' &&
    geocodeSourceForMethod('census-geocoder') === 'external-api',
);
const enriched = enrichReviewRow(mkRow({}), 'I-75');
check('enrich: on-corridor point has zero distance', enriched.corridorDistanceMiles === 0);
const farRow = enrichReviewRow(
  mkRow({ proposed_latitude: 36.2, proposed_longitude: -115.1 }),
  'I-75',
); // Vegas
check(
  'enrich: far point flags corridor + state warnings',
  farRow.warnings.includes('far-from-corridor') && farRow.warnings.includes('outside-state-bounds'),
);
check(
  'enrich: overwrite warning',
  enrichReviewRow(mkRow({ wouldOverwrite: true }), 'I-75').warnings.includes('would-overwrite'),
);
check(
  'enrich: low confidence warning',
  enrichReviewRow(mkRow({ confidence: 'low' }), 'I-75').warnings.includes('low-confidence'),
);

check('stale: unchanged coords not stale', !isStaleReview(null, null, null, null));
check('stale: matching coords not stale', !isStaleReview(32.8, -83.6, 32.8, -83.6));
check('stale: live gained coords → stale', isStaleReview(null, null, 32.8, -83.6));
check('stale: live changed coords → stale', isStaleReview(32.8, -83.6, 32.9, -83.6));
check('stale: live lost coords → stale', isStaleReview(32.8, -83.6, null, null));
check('stale: float noise tolerated', !isStaleReview(32.8, -83.6, 32.8000000001, -83.6));

/* ------------------------------------------------ stages */
const L = (over: Partial<PipelineListing>): PipelineListing => ({
  id: over.id ?? UUID(10),
  name: 'S',
  categorySlug: 'truck-stops',
  address: '',
  city: 'Macon',
  state: 'GA',
  zip: '31201',
  lat: null,
  lng: null,
  interstate: 'I-75',
  exitNumber: '',
  ...over,
});
const CAL = buildCalibrations([
  {
    listingId: 'x1',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '100',
    lat: 32.0,
    lng: -83.7,
    source: 't',
  },
  {
    listingId: 'x2',
    state: 'GA',
    interstate: 'I-75',
    exitNumber: '110',
    lat: 32.15,
    lng: -83.75,
    source: 't',
  },
  {
    listingId: 'x3',
    state: 'TN',
    interstate: 'I-40',
    exitNumber: '365',
    lat: 35.87,
    lng: -84.3,
    source: 't',
  },
  {
    listingId: 'x4',
    state: 'TN',
    interstate: 'I-40',
    exitNumber: '373',
    lat: 35.9,
    lng: -84.15,
    source: 't',
  },
]).calibrations;
const stagePipe = runGeocodePipeline(
  [
    L({ id: UUID(11), exitNumber: '105' }), // A: I-75 GA interpolation
    L({ id: UUID(12), state: 'TN', interstate: 'I-40', exitNumber: '370' }), // B: I-40 TN
    L({ id: UUID(13), state: 'TN', interstate: 'I-75', exitNumber: '369' }), // B via concurrency → I-40 TN
    L({ id: UUID(14), state: 'NC', interstate: 'I-95', exitNumber: '', address: '5 Elm St' }), // census candidate
    L({ id: UUID(15), state: 'NC', interstate: 'I-95', exitNumber: '', address: '9 Oak St' }), // census approx → D
    L({ id: UUID(16), address: '', exitNumber: '' }), // D unresolved
  ],
  CAL,
  { generatedAt: 't' },
);
const censusForStages = [
  { ...cls(gaMatch()), id: UUID(14), status: 'exact' as const, confidence: 'high' as const },
  {
    ...cls(gaMatch({ matchType: 'Non_Exact' })),
    id: UUID(15),
    status: 'approximate' as const,
    confidence: 'medium' as const,
  },
];
const staged = assignStages(stagePipe, censusForStages);
const byId = new Map(staged.map((s) => [s.id, s]));
check('stage: I-75 GA interpolation → A', byId.get(UUID(11))?.stage === 'A');
check('stage: I-40 TN interpolation → B', byId.get(UUID(12))?.stage === 'B');
check(
  'stage: concurrency row interpolates on I-40 but stages as D (human-confirm)',
  byId.get(UUID(13))?.stage === 'D' && byId.get(UUID(13))?.corridor === 'I-40',
  byId.get(UUID(13)),
);
check('stage: census exact → C', byId.get(UUID(14))?.stage === 'C');
check('stage: census approximate → D', byId.get(UUID(15))?.stage === 'D');
check('stage: unresolved → D', byId.get(UUID(16))?.stage === 'D');

const sums = summarizeStages(staged);
const cov = projectedCoverage(100, 10, sums);
check(
  'stage: coverage cumulative, D adds nothing',
  (() => {
    const a = cov.find((c) => c.stage === 'A')!.cumulative;
    const c3 = cov.find((c) => c.stage === 'C')!.cumulative;
    const d = cov.find((c) => c.stage === 'D')!.cumulative;
    return a === 11 && c3 === 13 && d === c3;
  })(),
  cov,
);

const never = neverAutoGeocode(stagePipe);
check(
  'never-auto: unresolved no-address row listed',
  never.some((n) => n.id === UUID(16)),
);
check(
  'never-auto: concurrency row listed',
  never.some((n) => n.id === UUID(13)),
  never,
);

// Suspect/invalid existing coordinates land in the D research queue, never vanish.
const suspectPipe = runGeocodePipeline(
  [
    L({ id: UUID(21), lat: 40.0, lng: -84.0 }), // wrong-state → existing-suspect
    L({ id: UUID(22), lat: 0, lng: 0 }), // existing-invalid
  ],
  CAL,
  { generatedAt: 't' },
);
const suspectStaged = assignStages(suspectPipe, []);
check(
  'stage: suspect + invalid rows reach D',
  suspectStaged.filter((r) => r.stage === 'D').length === 2,
  suspectStaged,
);
const suspectNever = neverAutoGeocode(suspectPipe);
check(
  'never-auto: suspect + invalid rows listed',
  suspectNever.length === 2 && suspectNever.every((n) => /adjudication/.test(n.reason)),
  suspectNever,
);
check(
  'enrich: free-text census mention stays manual',
  proposalMethod(mkRow({ verification_notes: 'Census tract confirmed on satellite' })) === 'manual',
);

/* ------------------------------------------------ duplicate prevention */
const dups = findDuplicatePairs([
  { id: 'p1', name: 'Stop One', city: 'Macon', state: 'GA', lat: 32.075, lng: -83.725 },
  { id: 'p2', name: 'Stop Two', city: 'Macon', state: 'GA', lat: 32.0751, lng: -83.7251 },
  { id: 'p3', name: 'Far Stop', city: 'Macon', state: 'GA', lat: 33.5, lng: -84.5 },
]);
check(
  'dupes: near-identical coords pair flagged',
  dups.some(
    (p) =>
      p.reasons.includes('coords') &&
      ((p.aId === 'p1' && p.bId === 'p2') || (p.aId === 'p2' && p.bId === 'p1')),
  ),
);
check('dupes: distant rows not flagged', !dups.some((p) => p.aId === 'p3' || p.bId === 'p3'));

void runAsyncChecks().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
});
