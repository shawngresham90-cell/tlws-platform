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

/* ------------------- merging: first-touch attribution, last-wins contact */
{
  // Repeat signup from a different source must NOT clobber attribution.
  const update = mergeLead(
    { source: 'practice-test', utm: { utm_source: 'youtube' } },
    { source: 'newsletter', utm: { utm_source: 'facebook' } },
  );
  check('merge: original source preserved', !('source' in update));
  check('merge: original utm preserved', !('utm' in update));
}
{
  // Contact fields are explicit-last-wins: a later genuine submission can
  // CORRECT a planted or stale value (security review, finding 2).
  const update = mergeLead(
    { source: 'newsletter', first_name: 'Wrong', phone: 'attacker-555' },
    { source: 'founder', first_name: 'Pat', phone: '555-555-5555' },
  );
  check('merge: provided name corrects the stored one', update.first_name === 'Pat');
  check('merge: provided phone corrects the stored one', update.phone === '555-555-5555');
  check('merge: source still preserved', !('source' in update));
}
{
  // A form that didn't collect a field leaves it alone.
  const update = mergeLead({ first_name: 'Pat', phone: '5' }, { first_name: null, phone: '' });
  check('merge: absent contact fields never cleared', Object.keys(update).length === 0);
}
{
  // SMS consent: explicit values win in BOTH directions (a genuine later
  // submission can revoke forged consent); undefined = form didn't ask.
  check(
    'merge: explicit sms opt-in updates',
    mergeLead({ sms_consent: false }, { sms_consent: true }).sms_consent === true,
  );
  check(
    'merge: explicit sms false revokes (correctable consent)',
    mergeLead({ sms_consent: true }, { sms_consent: false }).sms_consent === false,
  );
  check(
    'merge: form that did not collect consent leaves it alone',
    !('sms_consent' in mergeLead({ sms_consent: true }, { sms_consent: undefined })),
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
