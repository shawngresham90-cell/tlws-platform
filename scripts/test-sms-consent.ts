/**
 * SMS consent evidence tests (read-only, no DB).
 *
 * Proves the Text Request / TCPA / 10DLC compliance rules that live in the pure
 * client-safe module (`@/lib/leads/sms-consent`):
 *   - the disclosure text is the EXACT provider-approved wording, and the
 *     separate SMS Terms link is NOT folded into it;
 *   - the version is a fixed string and the source map only contains real routes;
 *   - a CHECKED box + durable evidence records an affirmative opt-in with a
 *     server timestamp;
 *   - fail-closed: a checked box whose evidence FAILS resolves to opted-out, and
 *     an unchecked box always resolves to opted-out — the mutable flag is never
 *     true without durable evidence;
 *   - the timestamp is server-injected (never client-asserted) and present ONLY
 *     when consent is true (matches the DB check constraint);
 *   - retries are idempotent BUT VERIFIED: a submission-token collision only
 *     counts as durable consent when the stored row matches the request in every
 *     security-relevant field; a reused token with a different phone/email/form/
 *     version, or a missing row, fails closed;
 *   - submission tokens are strictly UUID-validated, and a malformed token is
 *     dropped (recorded tokenless) rather than trusted or blocking submission;
 *   - the on-screen field links /privacy inside the disclosure and /sms-terms
 *     separately, and keeps those links OUT of the <label>.
 *
 * Run (from the repo root):
 *   npx esbuild scripts/test-sms-consent.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-sms-consent.cjs && node /tmp/test-sms-consent.cjs
 */
import { readFileSync } from 'fs';
import {
  SMS_CONSENT_DISCLOSURE,
  SMS_CONSENT_VERSION,
  SMS_CONSENT_SOURCES,
  isSmsConsentSource,
  isValidSubmissionId,
  normalizeEmail,
  normalizePhone,
  buildSmsConsentRecord,
  consentEvidenceMatches,
  resolveConsentGrant,
} from '@/lib/leads/sms-consent';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

/* ── The disclosure is the EXACT provider-approved wording ─────────────── */
const EXPECTED_DISCLOSURE =
  'By checking yes, you agree to receive SMS text messages (updates about your school ' +
  'application and enrollment, and occasional related information) from Trucking Life Academy ' +
  'at the number provided. Consent is not a condition of any purchase or service. Msg & data ' +
  'rates may apply. Msg frequency varies. Reply STOP to opt out. Reply HELP for help. By ' +
  'submitting this form, you also agree to our Privacy Policy.';
check(
  'disclosure is the exact provider wording',
  SMS_CONSENT_DISCLOSURE === EXPECTED_DISCLOSURE,
  SMS_CONSENT_DISCLOSURE,
);
check(
  'disclosure names Trucking Life Academy',
  SMS_CONSENT_DISCLOSURE.includes('Trucking Life Academy'),
);
check('disclosure has STOP', SMS_CONSENT_DISCLOSURE.includes('Reply STOP to opt out'));
check('disclosure has HELP', SMS_CONSENT_DISCLOSURE.includes('Reply HELP for help'));
check(
  'disclosure uses "Msg & data rates"',
  SMS_CONSENT_DISCLOSURE.includes('Msg & data rates may apply'),
);
check(
  'disclosure uses "Msg frequency varies"',
  SMS_CONSENT_DISCLOSURE.includes('Msg frequency varies'),
);
check('disclosure states not a condition', SMS_CONSENT_DISCLOSURE.includes('not a condition'));
check(
  'disclosure ends with "By submitting this form ... Privacy Policy."',
  SMS_CONSENT_DISCLOSURE.includes('By submitting this form, you also agree to our Privacy Policy.'),
);
// The SMS Terms link is a SEPARATE nearby reference, never part of the approved
// disclosure text.
check('disclosure does NOT claim SMS Terms', !SMS_CONSENT_DISCLOSURE.includes('SMS Terms'));

/* ── Version is a fixed, stable string ─────────────────────────────────── */
check(
  'version is a non-empty string',
  typeof SMS_CONSENT_VERSION === 'string' && SMS_CONSENT_VERSION.length > 0,
);
check(
  'version looks like a date',
  /^\d{4}-\d{2}-\d{2}$/.test(SMS_CONSENT_VERSION),
  SMS_CONSENT_VERSION,
);

/* ── Source map only contains real, public routes ──────────────────────── */
const sourceKeys = Object.keys(SMS_CONSENT_SOURCES);
check('two known sources', sourceKeys.length === 2, sourceKeys);
check(
  'academy-application → /academy/apply',
  SMS_CONSENT_SOURCES['academy-application'] === '/academy/apply',
);
check('founder-lead → /founders', SMS_CONSENT_SOURCES['founder-lead'] === '/founders');
for (const [k, url] of Object.entries(SMS_CONSENT_SOURCES)) {
  check(`${k} url is absolute`, typeof url === 'string' && url.startsWith('/'), url);
}

/* ── isSmsConsentSource: known keys pass, everything else fails ─────────── */
check('guard accepts academy-application', isSmsConsentSource('academy-application'));
check('guard accepts founder-lead', isSmsConsentSource('founder-lead'));
check('guard rejects unknown', !isSmsConsentSource('sponsor'));
check('guard rejects empty', !isSmsConsentSource(''));
check('guard rejects null', !isSmsConsentSource(null));
check('guard rejects number', !isSmsConsentSource(42));
for (const evil of ['constructor', '__proto__', 'hasOwnProperty', 'toString']) {
  check(`guard rejects prototype key "${evil}"`, !isSmsConsentSource(evil));
}

/* ── CHECKED box → affirmative opt-in WITH a server timestamp ───────────── */
const NOW = '2026-07-23T12:00:00.000Z';
const optedIn = buildSmsConsentRecord(
  {
    sourceForm: 'academy-application',
    email: ' Jane@Example.com ',
    phone: ' (555) 555-5555 ',
    consent: true,
    submissionId: '  11111111-1111-1111-1111-111111111111  ',
  },
  NOW,
);
check('checked: sms_consent true', optedIn.sms_consent === true);
check('checked: timestamp is the injected server clock', optedIn.sms_consent_at === NOW);
check('checked: version stamped', optedIn.sms_consent_version === SMS_CONSENT_VERSION);
check('checked: disclosure stored verbatim', optedIn.disclosure_text === SMS_CONSENT_DISCLOSURE);
check('checked: source_url from map', optedIn.source_url === '/academy/apply');
check('checked: email trimmed + lowercased', optedIn.email === 'jane@example.com');
check('checked: phone trimmed', optedIn.phone === '(555) 555-5555');
check(
  'checked: submission_id trimmed',
  optedIn.submission_id === '11111111-1111-1111-1111-111111111111',
);

/* ── UNCHECKED box → still recorded, but stays OPTED OUT ────────────────── */
const optedOut = buildSmsConsentRecord(
  { sourceForm: 'founder-lead', email: 'x@y.com', phone: '5551234567', consent: false },
  NOW,
);
check('unchecked: sms_consent false', optedOut.sms_consent === false);
check('unchecked: NO timestamp (stays opted out)', optedOut.sms_consent_at === null);
check('unchecked: still carries version', optedOut.sms_consent_version === SMS_CONSENT_VERSION);
check('unchecked: still carries disclosure', optedOut.disclosure_text === SMS_CONSENT_DISCLOSURE);
check('unchecked: no submission_id → null', optedOut.submission_id === null);
check(
  'unchecked: providing a phone is NOT consent',
  optedOut.phone === '5551234567' && optedOut.sms_consent === false,
);

/* ── Only a literal `true` counts as consent (never a truthy coercion) ──── */
for (const notTrue of [undefined, null, 0, '', 'true', 1, {}]) {
  const r = buildSmsConsentRecord(
    // deliberately wrong type to prove server-side coercion is strict
    { sourceForm: 'founder-lead', consent: notTrue as unknown as boolean },
    NOW,
  );
  check(
    `non-true consent (${JSON.stringify(notTrue)}) → false, null ts`,
    r.sms_consent === false && r.sms_consent_at === null,
  );
}

/* ── The DB check invariant holds for every record we build ─────────────── */
for (const r of [optedIn, optedOut]) {
  check(
    'invariant: timestamp implies consent',
    r.sms_consent === true || r.sms_consent_at === null,
    r,
  );
}

/* ── Empty/whitespace contact fields normalize to null ─────────────────── */
const blank = buildSmsConsentRecord(
  { sourceForm: 'founder-lead', email: '   ', phone: '', consent: true, submissionId: '   ' },
  NOW,
);
check('blank email → null', blank.email === null);
check('blank phone → null', blank.phone === null);
check('blank submission_id → null', blank.submission_id === null);

/* ── FAIL-CLOSED: mutable flag is true ONLY when opted-in AND durable ───── */
check('grant: checked + durable evidence → true', resolveConsentGrant(true, true) === true);
check(
  'grant: checked + evidence FAILED → false (fail closed)',
  resolveConsentGrant(true, false) === false,
);
check('grant: unchecked + durable decline → false', resolveConsentGrant(false, true) === false);
check('grant: unchecked + no evidence → false', resolveConsentGrant(false, false) === false);
// Never leave the flag true without both conditions — exhaustive over booleans.
for (const requested of [true, false]) {
  for (const durable of [true, false]) {
    const granted = resolveConsentGrant(requested, durable);
    check(
      `grant(${requested},${durable}): true implies both true`,
      granted === false || (requested === true && durable === true),
    );
  }
}
// Strict: non-true inputs never grant.
check(
  'grant: truthy-but-not-true requested → false',
  resolveConsentGrant(1 as unknown as boolean, true) === false,
);
check(
  'grant: truthy-but-not-true durable → false',
  resolveConsentGrant(true, 1 as unknown as boolean) === false,
);

/* ── Normalization helpers used for evidence comparison ────────────────── */
check('normalizeEmail lowercases + trims', normalizeEmail('  A@B.COM ') === 'a@b.com');
check('normalizeEmail whitespace → null', normalizeEmail('   ') === null);
check('normalizeEmail null → null', normalizeEmail(null) === null);
check('normalizePhone trims', normalizePhone('  555 ') === '555');
check('normalizePhone empty → null', normalizePhone('') === null);

/* ── Submission token: strict UUID format + length validation ───────────── */
check('valid uuid accepted', isValidSubmissionId('22222222-2222-2222-2222-222222222222'));
check(
  'valid random-style uuid accepted',
  isValidSubmissionId('9b2e4c7a-1d3f-4a5b-8c6d-0e1f2a3b4c5d'),
);
check('reject non-uuid', !isValidSubmissionId('not-a-uuid'));
check('reject empty', !isValidSubmissionId(''));
check(
  'reject too-long (uuid + suffix)',
  !isValidSubmissionId('22222222-2222-2222-2222-222222222222-extra'),
);
check('reject overlong garbage', !isValidSubmissionId('x'.repeat(500)));
check('reject null', !isValidSubmissionId(null));
check('reject number', !isValidSubmissionId(12345));
// A malformed token is dropped to null (recorded tokenless) — the submission
// still works and consent is still recorded.
const malformed = buildSmsConsentRecord(
  {
    sourceForm: 'founder-lead',
    email: 'a@b.com',
    phone: '5551112222',
    consent: true,
    submissionId: 'not-a-uuid',
  },
  NOW,
);
check('malformed submission_id dropped to null', malformed.submission_id === null);
check('malformed token still records affirmative consent', malformed.sms_consent === true);

/* ── RETRY-SAFE: a token collision is TRUSTED ONLY when the stored evidence
      matches this exact request in every security-relevant field ──────────── */
const SID = '22222222-2222-2222-2222-222222222222';
const baseInput = {
  sourceForm: 'founder-lead' as const,
  email: 'a@b.com',
  phone: '5551112222',
  consent: true,
  submissionId: SID,
};
const expected = buildSmsConsentRecord(baseInput, NOW);
// A prior row written by the same builder (older timestamp — not compared).
const storedSame = buildSmsConsentRecord(baseInput, '2020-01-01T00:00:00.000Z');
check(
  'legitimate retry, identical evidence → match',
  consentEvidenceMatches(storedSame, expected) === true,
);

// Reused token but a DIFFERENT field → never a match (fail closed).
check(
  'reused id, different phone → no match',
  consentEvidenceMatches(
    buildSmsConsentRecord({ ...baseInput, phone: '5559998888' }, NOW),
    expected,
  ) === false,
);
check(
  'reused id, different email → no match',
  consentEvidenceMatches(
    buildSmsConsentRecord({ ...baseInput, email: 'z@z.com' }, NOW),
    expected,
  ) === false,
);
check(
  'reused id, different source → no match',
  consentEvidenceMatches(
    buildSmsConsentRecord({ ...baseInput, sourceForm: 'academy-application' }, NOW),
    expected,
  ) === false,
);
check(
  'reused id, different disclosure version → no match',
  consentEvidenceMatches({ ...expected, sms_consent_version: '2000-01-01' }, expected) === false,
);
check(
  'reused id, different disclosure text → no match',
  consentEvidenceMatches(
    { ...expected, disclosure_text: expected.disclosure_text + ' x' },
    expected,
  ) === false,
);
check(
  'reused id, stored row was a decline → no match',
  consentEvidenceMatches({ ...expected, sms_consent: false }, expected) === false,
);
check(
  'reused id, token itself differs → no match',
  consentEvidenceMatches(
    { ...expected, submission_id: '33333333-3333-3333-3333-333333333333' },
    expected,
  ) === false,
);
check(
  'duplicate id, stored row missing (null) → no match',
  consentEvidenceMatches(null, expected) === false,
);
check(
  'duplicate id, stored row undefined → no match',
  consentEvidenceMatches(undefined, expected) === false,
);
// A decline request can never "match" its way to eligibility.
check(
  'decline request never matches',
  consentEvidenceMatches(expected, buildSmsConsentRecord({ ...baseInput, consent: false }, NOW)) ===
    false,
);
// A tokenless expected record never matches (no idempotency key to trust).
check(
  'expected without a valid token → no match',
  consentEvidenceMatches(
    expected,
    buildSmsConsentRecord({ ...baseInput, submissionId: undefined }, NOW),
  ) === false,
);

// Composed with fail-closed: a verified retry stays opted IN; a mismatch does
// not, and a missing table (no evidence at all) fails closed.
check(
  'verified retry grants consent',
  resolveConsentGrant(true, consentEvidenceMatches(storedSame, expected)) === true,
);
check(
  'reuse mismatch fails closed',
  resolveConsentGrant(
    true,
    consentEvidenceMatches(
      buildSmsConsentRecord({ ...baseInput, phone: '5559998888' }, NOW),
      expected,
    ),
  ) === false,
);
check(
  'no evidence at all → opted out',
  resolveConsentGrant(true, consentEvidenceMatches(null, expected)) === false,
);

/* ── Accessibility: the field links /privacy inside the disclosure and
      /sms-terms separately, and keeps links OUT of the <label> ──────────── */
try {
  const field = readFileSync('src/components/conversion/SmsConsentField.tsx', 'utf8');
  check('field links /privacy', field.includes('href="/privacy"'));
  check('field links /sms-terms', field.includes('href="/sms-terms"'));
  check(
    'field opens policy links in a new tab safely',
    field.includes('rel="noopener noreferrer"'),
  );
  check(
    'checkbox is described by the disclosure (aria-describedby)',
    field.includes('aria-describedby={descId}'),
  );
  check('checkbox has a focus-visible ring', field.includes('focus-visible:ring'));
  // The links live outside the <label>; a <label> containing a <Link would make
  // a link click toggle the checkbox.
  const labelMatch = field.match(/<label[^>]*>([\s\S]*?)<\/label>/);
  check(
    'links are OUTSIDE the <label>',
    !!labelMatch && !labelMatch[1].includes('<Link'),
    labelMatch?.[1],
  );
} catch (e) {
  check('could read SmsConsentField.tsx', false, (e as Error).message);
}

console.log(`\nsms-consent: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
