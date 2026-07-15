/**
 * Unit tests for the geocoding queue triage (research tooling). Drives the real
 * lib: classifyQueueStatic, classifyQueueValidated, splitQueues,
 * duplicateCoordinateFindings, queueCsv round-trip.
 *
 * Run:
 *   npx esbuild scripts/test-geocoding-queues.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-geocoding-queues.cjs && node /tmp/test-geocoding-queues.cjs
 */
import { parseGeocodingCsv, type GeocodingRow, type ValidatedRow } from '@/lib/directory/geocoding';
import {
  classifyQueueStatic,
  classifyQueueValidated,
  splitQueues,
  duplicateCoordinateFindings,
  queueCsv,
} from '@/lib/directory/geocoding-queues';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

const EMPTY_EVIDENCE = {
  confidenceReason: '', sourceCount: null, sourceUrls: [], lastResearched: '', reviewerNotes: '',
  sideOfRoadConfirmed: null, propertyConfirmed: null, cityStateValidated: null, priority: '' as const,
  concernFlag: false, status: '' as const,
};

function row(over: Partial<GeocodingRow> = {}): GeocodingRow {
  return {
    listing_id: '00000000-0000-0000-0000-000000000001',
    business_name: 'Test Stop', category: 'truck-stops', address: '1 Main St', city: 'Nashville',
    state: 'TN', zip: '37000', current_latitude: null, current_longitude: null,
    proposed_latitude: 36.1, proposed_longitude: -86.7, confidence: 'high',
    source_url: 'https://example.com', verification_notes: '', action: 'ready',
    evidence: { ...EMPTY_EVIDENCE },
    ...over,
  };
}
function validated(over: Partial<ValidatedRow> = {}): ValidatedRow {
  return { ...row(), applicable: true, problems: [], problemDetails: [], wouldOverwrite: false, live: null, ...over };
}

/* ---------------------- classifyQueueStatic ---------------------- */
{
  check('ready: action=ready + high + valid coords', classifyQueueStatic(row()).queue === 'ready');
  check('rejected: action=skip', classifyQueueStatic(row({ action: 'skip' })).queue === 'rejected');
  check('rejected: unresolved confidence', classifyQueueStatic(row({ confidence: 'unresolved' })).queue === 'rejected');
  check('rejected: no coordinates', classifyQueueStatic(row({ proposed_latitude: null, proposed_longitude: null })).queue === 'rejected');
  check('rejected: invalid coordinates', classifyQueueStatic(row({ proposed_latitude: 999, proposed_longitude: -86 })).queue === 'rejected');
  check('manual-review: action=manual-review', classifyQueueStatic(row({ action: 'manual-review', confidence: 'medium' })).queue === 'manual-review');
  check('manual-review: ready action but medium confidence', classifyQueueStatic(row({ action: 'ready', confidence: 'medium' })).queue === 'manual-review');
  check('manual-review: low confidence with coords', classifyQueueStatic(row({ action: 'manual-review', confidence: 'low' })).queue === 'manual-review');
}

/* ---------------------- classifyQueueValidated ---------------------- */
{
  check('validated ready: applicable + no overwrite', classifyQueueValidated(validated()).queue === 'ready');
  check('validated manual-review: applicable but would overwrite', classifyQueueValidated(validated({ wouldOverwrite: true })).queue === 'manual-review');
  check('validated rejected: unknown-listing-id', classifyQueueValidated(validated({ applicable: false, problems: ['unknown-listing-id'] })).queue === 'rejected');
  check('validated rejected: identity-mismatch', classifyQueueValidated(validated({ applicable: false, problems: ['identity-mismatch'] })).queue === 'rejected');
  check('validated rejected: invalid-coordinates', classifyQueueValidated(validated({ applicable: false, problems: ['invalid-coordinates'] })).queue === 'rejected');
  check('validated rejected: duplicate-listing-id', classifyQueueValidated(validated({ applicable: false, problems: ['duplicate-listing-id'] })).queue === 'rejected');
  check('validated manual-review: not-high-confidence only', classifyQueueValidated(validated({ applicable: false, confidence: 'medium', problems: ['not-high-confidence'] })).queue === 'manual-review');
  check('validated rejected: action=skip beats soft problems', classifyQueueValidated(validated({ applicable: false, action: 'skip', problems: ['not-ready'] })).queue === 'rejected');
}

/* ---------------------- splitQueues ---------------------- */
{
  const rows = [row(), row({ action: 'skip' }), row({ action: 'manual-review', confidence: 'medium' })];
  const s = splitQueues(rows, classifyQueueStatic);
  check('split: 1 ready', s.ready.length === 1);
  check('split: 1 manual-review', s.manualReview.length === 1);
  check('split: 1 rejected', s.rejected.length === 1);
  check('split: total preserved', s.ready.length + s.manualReview.length + s.rejected.length === rows.length);
  check('split: verdicts recorded', s.verdicts.size === rows.length);
}

/* ---------------------- duplicateCoordinateFindings ---------------------- */
{
  const a = row({ listing_id: '00000000-0000-0000-0000-00000000000a', proposed_latitude: 36.5, proposed_longitude: -86.5 });
  const b = row({ listing_id: '00000000-0000-0000-0000-00000000000b', proposed_latitude: 36.5, proposed_longitude: -86.5 });
  const c = row({ listing_id: '00000000-0000-0000-0000-00000000000c', proposed_latitude: 35.0, proposed_longitude: -85.0 });
  const dups = duplicateCoordinateFindings([a, b, c]);
  check('duplicate coords: one finding for the shared coordinate', dups.length === 1, dups);
  check('duplicate coords: two listing ids', dups[0]?.listingIds.length === 2);
  check('duplicate coords: unique coords not flagged', !dups.some((d) => d.latitude === 35.0));
  // same listing_id repeated is NOT a cross-listing duplicate
  const same = duplicateCoordinateFindings([a, { ...a }]);
  check('duplicate coords: same listing_id twice is not flagged', same.length === 0);
}

/* ---------------------- queueCsv round-trips ---------------------- */
{
  const rows = [row(), row({ listing_id: '00000000-0000-0000-0000-00000000000b', action: 'skip', confidence: 'unresolved' })];
  const s = splitQueues(rows, classifyQueueStatic);
  const csv = queueCsv(rows, s.verdicts);
  const reparsed = parseGeocodingCsv(csv);
  check('queueCsv: re-parses with no errors', reparsed.errors.length === 0, reparsed.errors);
  check('queueCsv: preserves row count', reparsed.rows.length === rows.length);
  check('queueCsv: has queue_reasons column', csv.split('\n')[0].includes('queue_reasons'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
