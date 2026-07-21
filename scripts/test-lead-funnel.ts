/**
 * Offline tests for the email funnel foundation (Block 2, M3): first-touch
 * attribution merging and segment mapping. Run:
 *
 *   npx esbuild scripts/test-lead-funnel.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-lead-funnel.cjs && node /tmp/test-lead-funnel.cjs
 */
import { LEAD_SOURCES, mergeLead, segmentFor } from '@/lib/leads/funnel';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

/* ----------------------------------------------------- segments */
for (const source of LEAD_SOURCES) {
  const seg = segmentFor(source);
  check(`segment for ${source} is mapped`, seg.key !== 'unsegmented', seg);
  check(`segment for ${source} has send guidance`, seg.firstSend.length > 0);
}
check('unknown source → unsegmented fallback', segmentFor('mystery').key === 'unsegmented');
check('null source → unsegmented fallback', segmentFor(null).key === 'unsegmented');

/* ------------------------------------------- first-touch merging */
{
  // Repeat signup from a different source must NOT clobber attribution.
  const update = mergeLead(
    { source: 'practice-test', utm: { utm_source: 'youtube' }, sms_consent: false },
    { source: 'newsletter', utm: { utm_source: 'facebook' }, sms_consent: false },
  );
  check('merge: original source preserved', !('source' in update));
  check('merge: original utm preserved', !('utm' in update));
}
{
  // Missing fields fill in.
  const update = mergeLead(
    { source: 'newsletter', first_name: null, phone: null },
    { source: 'founder', first_name: 'Pat', phone: '555-555-5555' },
  );
  check('merge: missing name fills in', update.first_name === 'Pat');
  check('merge: missing phone fills in', update.phone === '555-555-5555');
  check('merge: source still preserved', !('source' in update));
}
{
  // SMS consent: later opt-in sticks; later default-false never revokes.
  check(
    'merge: sms opt-in sticks',
    mergeLead({ sms_consent: false }, { sms_consent: true }).sms_consent === true,
  );
  check(
    'merge: sms consent never revoked by a false',
    !('sms_consent' in mergeLead({ sms_consent: true }, { sms_consent: false })),
  );
}
{
  // A lead that somehow has no source yet picks one up.
  const update = mergeLead({ source: null, utm: {} }, { source: 'newsletter', utm: { a: 'b' } });
  check('merge: empty source backfills', update.source === 'newsletter');
  check('merge: empty utm backfills', update.utm?.a === 'b');
}
{
  // Identical repeat: nothing to update.
  const update = mergeLead(
    { source: 'newsletter', first_name: 'Pat', phone: '5', sms_consent: true, utm: { a: 'b' } },
    { source: 'newsletter', first_name: 'Pat', phone: '5', sms_consent: true, utm: { a: 'b' } },
  );
  check('merge: identical repeat → no update', Object.keys(update).length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
