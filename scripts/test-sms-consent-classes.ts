/**
 * SMS consent — classes/follow-up + optional marketing (2026-07-30).
 *
 * Two SEPARATE consents on the academy application (/academy/apply), the only
 * public form that collects a phone number for classes/enrollment/follow-up.
 *
 * Invariants under test:
 *   - both boxes start unchecked, neither is required, marketing is optional
 *   - a phone number alone never creates consent
 *   - the two decisions stay distinguishable end to end
 *   - the displayed disclosure is byte-identical to the stored evidence
 *   - "Privacy Policy" links to the real /privacy route that exists
 *   - the founders form's previously approved wording is untouched
 *   - no schema change is required and none is applied
 *
 * Pure functions + filesystem only; no database access, CI-safe.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ACADEMY_SMS_CLASSES_DISCLOSURE,
  ACADEMY_SMS_MARKETING_DISCLOSURE,
  ACADEMY_SMS_CONSENT_VERSION,
  SMS_CONSENT_DISCLOSURE,
  SMS_CONSENT_VERSION,
  SMS_CONSENT_SOURCES,
  disclosureFor,
  buildSmsConsentRecord,
} from '@/lib/leads/sms-consent';
import { applicationStep2Schema } from '@/lib/api/schemas';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(process.cwd(), p));

/* ------------------------------------------- exact owner-supplied wording */
const CLASSES_EXPECTED =
  'By checking this box, you agree to receive SMS text messages (classes and follow up) from ' +
  'Trucking Life With Shawn at the number provided. Consent is not a condition of any purchase ' +
  'or service. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out. Reply ' +
  'HELP for help. By submitting this form, you also agree to our Privacy Policy.';
const MARKETING_EXPECTED =
  'I also agree to receive occasional promotional offers and marketing messages via SMS from ' +
  'Trucking Life With Shawn. Consent is not a condition of any purchase or service. Reply STOP ' +
  'to opt out.';

check(
  'classes disclosure matches the supplied language exactly',
  ACADEMY_SMS_CLASSES_DISCLOSURE === CLASSES_EXPECTED,
);
check(
  'marketing disclosure matches the supplied language exactly',
  ACADEMY_SMS_MARKETING_DISCLOSURE === MARKETING_EXPECTED,
);
check(
  'the two disclosures are separate strings, not combined',
  !ACADEMY_SMS_CLASSES_DISCLOSURE.includes('promotional') &&
    !ACADEMY_SMS_MARKETING_DISCLOSURE.includes('classes and follow up'),
);
check(
  'both say consent is not a condition of purchase or service',
  /Consent is not a condition of any purchase or service\./.test(ACADEMY_SMS_CLASSES_DISCLOSURE) &&
    /Consent is not a condition of any purchase or service\./.test(
      ACADEMY_SMS_MARKETING_DISCLOSURE,
    ),
);
check(
  'both offer STOP to opt out',
  /Reply STOP to opt out\./.test(ACADEMY_SMS_CLASSES_DISCLOSURE) &&
    /Reply STOP to opt out\./.test(ACADEMY_SMS_MARKETING_DISCLOSURE),
);

/* ------------------------------------ founders form wording left untouched */
check(
  'founders disclosure text unchanged',
  SMS_CONSENT_DISCLOSURE.includes('Trucking Life Academy') &&
    SMS_CONSENT_DISCLOSURE.includes('school application and enrollment'),
);
check('founders disclosure version unchanged', SMS_CONSENT_VERSION === '2026-07-23');
check(
  'academy disclosures carry their own new version',
  ACADEMY_SMS_CONSENT_VERSION === '2026-07-30',
);
check(
  'each form resolves to its own disclosure',
  disclosureFor('academy-application').text === ACADEMY_SMS_CLASSES_DISCLOSURE &&
    disclosureFor('academy-application-marketing').text === ACADEMY_SMS_MARKETING_DISCLOSURE &&
    disclosureFor('founder-lead').text === SMS_CONSENT_DISCLOSURE,
);

/* ------------------------------------------------- defaults + optionality */
const empty = applicationStep2Schema.safeParse({
  application_id: '11111111-2222-3333-4444-555555555555',
});
check('step 2 parses with no consent supplied at all', empty.success);
check(
  'both consents default to FALSE (unchecked)',
  empty.success && empty.data.sms_consent === false && empty.data.sms_marketing_consent === false,
);
const classesOnly = applicationStep2Schema.safeParse({
  application_id: '11111111-2222-3333-4444-555555555555',
  sms_consent: true,
});
check(
  'marketing is optional: classes-only submission succeeds and marketing stays false',
  classesOnly.success &&
    classesOnly.data.sms_consent === true &&
    classesOnly.data.sms_marketing_consent === false,
);
const marketingOnly = applicationStep2Schema.safeParse({
  application_id: '11111111-2222-3333-4444-555555555555',
  sms_marketing_consent: true,
});
check(
  'declining classes while accepting marketing still submits (neither is required)',
  marketingOnly.success &&
    marketingOnly.data.sms_consent === false &&
    marketingOnly.data.sms_marketing_consent === true,
);

/* ------------------- a phone number alone never manufactures consent */
const NOW = '2026-07-30T12:00:00.000Z';
const withPhoneNoConsent = buildSmsConsentRecord(
  { sourceForm: 'academy-application', phone: '555-555-0100', email: 'a@b.com', consent: false },
  NOW,
);
check(
  'phone provided + box unchecked = recorded decline, no timestamp',
  withPhoneNoConsent.sms_consent === false && withPhoneNoConsent.sms_consent_at === null,
);
check(
  'a decline still keeps the phone on the evidence row',
  withPhoneNoConsent.phone === '555-555-0100',
);
for (const junk of [undefined, null, 'true', 1, {}]) {
  check(
    `non-true consent value (${JSON.stringify(junk)}) is a decline`,
    buildSmsConsentRecord(
      { sourceForm: 'academy-application', phone: '555', consent: junk as never },
      NOW,
    ).sms_consent === false,
  );
}

/* ---------------------------- the two decisions stay distinguishable */
const classesRow = buildSmsConsentRecord(
  { sourceForm: 'academy-application', phone: '555', consent: true },
  NOW,
);
const marketingRow = buildSmsConsentRecord(
  { sourceForm: 'academy-application-marketing', phone: '555', consent: true },
  NOW,
);
check(
  'each consent is stored under its own source form',
  classesRow.source_form === 'academy-application' &&
    marketingRow.source_form === 'academy-application-marketing',
);
check(
  'each row stores the exact wording the user saw',
  classesRow.disclosure_text === ACADEMY_SMS_CLASSES_DISCLOSURE &&
    marketingRow.disclosure_text === ACADEMY_SMS_MARKETING_DISCLOSURE,
);
check(
  'an affirmative opt-in is timestamped',
  classesRow.sms_consent_at === NOW && marketingRow.sms_consent_at === NOW,
);
check(
  'both academy rows point at the apply page',
  classesRow.source_url === '/academy/apply' && marketingRow.source_url === '/academy/apply',
);
check(
  'the marketing source is registered',
  SMS_CONSENT_SOURCES['academy-application-marketing'] === '/academy/apply',
);

/* ------------------------------------------------ Privacy Policy route */
check('the /privacy route exists in the app', exists('src/app/(marketing)/privacy/page.tsx'));
const field = read('src/components/conversion/SmsConsentField.tsx');
check('the disclosure links to /privacy', /href="\/privacy"/.test(field));
check(
  'only the words "Privacy Policy" become the link',
  /const marker = 'Privacy Policy'/.test(field),
);
check(
  'the link opens safely in a new tab',
  /rel="noopener noreferrer"/.test(field) && /target="_blank"/.test(field),
);
check(
  'the paragraph is rendered from the shared constant (display == evidence)',
  /disclosureFor\(source\)\.text/.test(field),
);

/* -------------------------------------------------------- form wiring */
const form = read('src/components/apply/ApplyForm.tsx');
check('form initializes classes consent unchecked', /sms_consent: false/.test(form));
check('form initializes marketing consent unchecked', /sms_marketing_consent: false/.test(form));
check(
  'both checkboxes are rendered, each with its own source',
  /source="academy-application"/.test(form) && /source="academy-application-marketing"/.test(form),
);
check(
  'the two consents are submitted as distinct fields',
  /sms_consent: s2\.sms_consent/.test(form) &&
    /sms_marketing_consent: s2\.sms_marketing_consent/.test(form),
);
check(
  'neither checkbox is marked required',
  !/id="sms_consent"[\s\S]{0,300}required/.test(form) &&
    !/id="sms_marketing_consent"[\s\S]{0,300}required/.test(form),
);
check(
  'submitting is not gated on either consent',
  !/sms_consent[^\n]*\|\|[^\n]*setSubmitting/.test(form) &&
    !/if \(!s2\.sms_(marketing_)?consent\)/.test(form),
);

/* ------------------------------------------------------- server wiring */
const route = read('src/app/api/application/step2/route.ts');
check(
  'server records a separate marketing evidence row',
  /sourceForm: 'academy-application-marketing'/.test(route),
);
check(
  'server keeps the two decisions distinct in the audit event',
  /sms_consent: granted, sms_marketing_consent: marketingGranted/.test(route),
);
check(
  'marketing consent never writes an applications column',
  !/sms_marketing_consent:\s*marketingGranted,?\s*\n\s*(has_permit|age_confirmed|cdl_class)/.test(
    route,
  ) && !/update\[[^\]]*marketing/.test(route),
);
check(
  'classes consent still fails closed on durable evidence',
  /resolveConsentGrant\(consentRequested, durable\)/.test(route),
);
check(
  'marketing consent also fails closed',
  /resolveConsentGrant\(marketingRequested, marketingDurable\)/.test(route),
);
check(
  'the stored consent text comes from the academy constant',
  /disclosureFor\('academy-application'\)\.text/.test(route),
);
check('no SMS is sent by this change', !/twilio|sendSms|send_sms|messages\.create/i.test(route));

/* ------------------------------- existing behavior + data preserved */
check(
  'step 2 still updates the same non-consent fields',
  /has_permit/.test(route) &&
    /cdl_class/.test(route) &&
    /funding_type/.test(route) &&
    /step2_completed: true/.test(route),
);
check(
  'the update is scoped to the one application row',
  /\.eq\('id', data\.application_id\)/.test(route),
);
check(
  'nothing back-fills or rewrites existing contacts',
  !/\.update\([^)]*\)\s*\.neq\(/.test(route) && !/\.update\([^)]*\)\s*\.is\(/.test(route),
);
check(
  'no migration file was added for this change',
  !exists('supabase/migrations/049_sms_marketing_consent.sql'),
);
const proposal = 'data/plans/sms-consent-2026-07-30/PROPOSED-MIGRATION.sql';
check('the optional normalization is proposed, not applied', exists(proposal));
check(
  'the proposed migration has zero executable SQL lines',
  read(proposal)
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .filter((l) => l.trim().length > 0).length === 0,
);

console.log(`sms-consent-classes: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
