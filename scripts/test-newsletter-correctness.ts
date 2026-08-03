/**
 * Newsletter correctness — the data-loss fix, the consent-evidence model, and
 * the analytics gate.
 *
 * Confirmed against production on 2026-08-02: a newsletter submission upserted
 * a whole row, so a form that never asked for a field wrote `null` over it. An
 * existing founder lead lost their name, phone, first-touch campaign and
 * acquisition source to a homepage email signup. These assertions exist so that
 * cannot come back.
 *
 * Route behaviour is asserted against the source text rather than by executing
 * the handler: it needs a service-role Supabase client, and these harnesses run
 * with no network and no database. The merge POLICY is pure and is tested by
 * calling it directly, which is where the actual decisions live.
 *
 *   npx esbuild scripts/test-newsletter-correctness.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import { readFileSync } from 'node:fs';
import {
  buildLeadInsert,
  buildLeadPatch,
  isNoOpPatch,
  IMMUTABLE_AFTER_INSERT,
} from '@/lib/leads/merge';
import {
  EMAIL_CONSENT_DISCLOSURE,
  EMAIL_CONSENT_RECORDING_ENABLED,
  EMAIL_CONSENT_VERSION,
  EMAIL_CONSENT_SOURCE_FORMS,
  buildEmailConsentRecord,
  canRecordEmailConsent,
  hasApprovedDisclosure,
} from '@/lib/leads/email-consent';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const ROUTE = readFileSync('src/app/api/lead/route.ts', 'utf8');
const FORM = readFileSync('src/components/sections/NewsletterForm.tsx', 'utf8');
const MIGRATION = readFileSync('supabase/migrations/049_email_consents.sql', 'utf8');

/* ── 1. A repeat newsletter signup preserves everything it did not collect ── */

// The newsletter form collects an email and nothing else.
const newsletterRepeat = buildLeadPatch({});

check('repeat newsletter signup writes no first_name', !('first_name' in newsletterRepeat));
check('repeat newsletter signup writes no phone', !('phone' in newsletterRepeat));
check('repeat newsletter signup writes no source', !('source' in newsletterRepeat));
check('repeat newsletter signup writes no utm', !('utm' in newsletterRepeat));
check('repeat newsletter signup writes no sms_consent', !('sms_consent' in newsletterRepeat));
check('a newsletter-only repeat is a complete no-op', isNoOpPatch(newsletterRepeat));

// Explicit nulls and blanks are "not collected", not "erase it".
for (const [label, fields] of [
  ['explicit nulls', { firstName: null, phone: null }],
  ['undefined', { firstName: undefined, phone: undefined }],
  ['empty strings', { firstName: '', phone: '' }],
  ['whitespace only', { firstName: '   ', phone: '  ' }],
] as const) {
  const patch = buildLeadPatch(fields);
  check(`${label} never erase first_name`, !('first_name' in patch), patch);
  check(`${label} never erase phone`, !('phone' in patch), patch);
  check(`${label} produce a no-op patch`, isNoOpPatch(patch), patch);
}

/* ── 2. First touch is immutable ─────────────────────────────────────────── */

check(
  'source and utm are declared immutable after insert',
  IMMUTABLE_AFTER_INSERT.includes('source') && IMMUTABLE_AFTER_INSERT.includes('utm'),
  IMMUTABLE_AFTER_INSERT,
);
check('email is immutable after insert', IMMUTABLE_AFTER_INSERT.includes('email'));
check('created_at is immutable after insert', IMMUTABLE_AFTER_INSERT.includes('created_at'));

// No patch, from any input, may ever contain an immutable column.
const everyPatchShape = [
  buildLeadPatch({}),
  buildLeadPatch({ firstName: 'Ada' }),
  buildLeadPatch({ phone: '+15550000000' }),
  buildLeadPatch({ firstName: 'Ada', phone: '+15550000000', smsConsentGranted: true }),
];
for (const patch of everyPatchShape) {
  for (const col of IMMUTABLE_AFTER_INSERT) {
    check(`patch never contains "${col}"`, !(col in patch), patch);
  }
}

/* ── 3. Newsletter participation is still recorded ───────────────────────── */

// A genuinely new address captures its first touch, once.
const firstTouch = buildLeadInsert({
  email: 'new@example.com',
  source: 'newsletter',
  utm: { utm_source: 'youtube' },
});
check('a new lead records its source', firstTouch.source === 'newsletter');
check('a new lead records its attribution', JSON.stringify(firstTouch.utm).includes('youtube'));
check('a new lead with no name stores null, not blank', firstTouch.first_name === null);
check('a new lead defaults sms_consent to false', firstTouch.sms_consent === false);
// Participation for an EXISTING lead is the append-only consent row, not an
// overwrite of how they first arrived.
check(
  'newsletter is an allowed consent source form, so participation has somewhere to land',
  (EMAIL_CONSENT_SOURCE_FORMS as readonly string[]).includes('newsletter'),
);

/* ── 4. Fields the form DID collect are still written ────────────────────── */

const founderRepeat = buildLeadPatch({
  firstName: '  Ada  ',
  phone: ' +15550000000 ',
  smsConsentGranted: true,
});
check('a collected first_name is written', founderRepeat.first_name === 'Ada');
check('a collected phone is written', founderRepeat.phone === '+15550000000');
check('a granted sms consent is written', founderRepeat.sms_consent === true);
check('a patch with real values is not a no-op', !isNoOpPatch(founderRepeat));

/* ── 5. Consent only ever rises ──────────────────────────────────────────── */

check(
  'a form that did not ask cannot lower sms_consent',
  !('sms_consent' in buildLeadPatch({ smsConsentGranted: undefined })),
);
check(
  'a declined SMS opt-in does not write false over an existing true',
  !('sms_consent' in buildLeadPatch({ smsConsentGranted: false })),
);
check(
  'the route only computes an SMS grant for the founder form',
  ROUTE.includes("data.source === 'founder' ? granted : undefined"),
);

/* ── 6. A failed write never reports success ─────────────────────────────── */

check('a failed lookup returns an error, not an insert', ROUTE.includes('lead_lookup_failed'));
check('a failed update returns an error', ROUTE.includes('lead_update_failed'));
check('a failed insert returns an error', ROUTE.includes('lead_insert_failed'));
check(
  'an unresolved insert race returns an error rather than a false success',
  ROUTE.includes('lead_insert_race_unresolved'),
);
check(
  'every failure path returns a 500 db_error',
  (ROUTE.match(/return fail\('Could not save your info\. Try again\.', 500, 'db_error'\)/g) ?? [])
    .length >= 4,
);
check(
  'success is returned only once, at the end',
  (ROUTE.match(/return ok\(/g) ?? []).length === 1,
);
check('a missing lead id fails closed instead of returning ok', ROUTE.includes('lead_write_no_id'));
// The concurrent-insert path adopts the existing row rather than erroring.
check('a duplicate insert is resolved, not surfaced', ROUTE.includes("'23505'"));

/* ── 7. Idempotency ──────────────────────────────────────────────────────── */

check(
  'the route skips the UPDATE entirely when there is nothing to write',
  ROUTE.includes('if (!isNoOpPatch(patch))'),
);
check(
  'repeated identical calls produce identical patches',
  JSON.stringify(buildLeadPatch({ firstName: 'Ada' })) ===
    JSON.stringify(buildLeadPatch({ firstName: 'Ada' })),
);
check(
  'the blind upsert is gone from the lead route',
  !/\.upsert\(\s*\{\s*\n?\s*email:/.test(ROUTE) && !ROUTE.includes("onConflict: 'email'"),
);

/* ── 8. Plausible fires only after a durable write ───────────────────────── */

const trackIndex = FORM.indexOf("trackEvent('newsletter_lead_captured')");
const guardIndex = FORM.indexOf('if (!res.ok || !body.ok)');
check('the newsletter form fires an event', trackIndex > -1);
check('the failure guard exists', guardIndex > -1);
check(
  'the event fires AFTER the success guard, never before',
  guardIndex > -1 && trackIndex > guardIndex,
  { guardIndex, trackIndex },
);
check(
  'the failure branch returns before reaching the event',
  /if \(!res\.ok \|\| !body\.ok\)[\s\S]{0,240}?return;/.test(FORM),
);
check(
  'a network error also returns without firing the event',
  FORM.indexOf('Network error.') > -1 && FORM.indexOf('Network error.') > trackIndex,
);

/* ── 9. No PII in the analytics event ────────────────────────────────────── */

check(
  'the newsletter event carries no properties at all',
  FORM.includes("trackEvent('newsletter_lead_captured')") &&
    !/trackEvent\('newsletter_lead_captured',/.test(FORM),
);
for (const token of ['email', 'phone', 'first_name', 'firstName', 'zip', 'utm']) {
  check(
    `the tracked call passes no ${token}`,
    !new RegExp(`trackEvent\\('newsletter_lead_captured'[^)]*${token}`, 'i').test(FORM),
  );
}

/* ── 10. Consent evidence is append-only and version-locked ──────────────── */

check(
  'recording is OFF until the migration and the wording land',
  !EMAIL_CONSENT_RECORDING_ENABLED,
);
check('no disclosure wording has been invented', EMAIL_CONSENT_DISCLOSURE === '');
check('empty wording does not count as approval', !hasApprovedDisclosure());
check('nothing may be recorded yet', !canRecordEmailConsent());
check('whitespace is not approval', !hasApprovedDisclosure('   '));
check('real wording would count as approval', hasApprovedDisclosure('Any approved sentence.'));
check('the flag alone cannot enable recording without wording', !canRecordEmailConsent(true, ''));
check(
  'wording alone cannot enable recording without the flag',
  !canRecordEmailConsent(false, 'Any approved sentence.'),
);
check('both together would enable it', canRecordEmailConsent(true, 'Any approved sentence.'));
check('the pre-approval version is marked unapproved', EMAIL_CONSENT_VERSION === 'v0-unapproved');

// The wording and its version must move together — the row is only evidence
// if the version identifies the exact text stored beside it.
{
  const now = new Date('2026-08-02T00:00:00.000Z');
  const row = buildEmailConsentRecord({
    sourceForm: 'newsletter',
    sourceUrl: 'https://example.test/',
    email: '  MiXeD@Example.TEST ',
    consent: true,
    now,
  });
  check('the row stores the disclosure verbatim', row.disclosure_text === EMAIL_CONSENT_DISCLOSURE);
  check('the row stores the version', row.email_consent_version === EMAIL_CONSENT_VERSION);
  check('the email is normalized lowercase and trimmed', row.email === 'mixed@example.test');
  check('an opt-in gets a server timestamp', row.email_consent_at === now.toISOString());
  check('no IP field exists on the record', !('ip' in row) && !('ip_address' in row));
  check(
    'no user-agent field exists on the record',
    !('user_agent' in row) && !('userAgent' in row),
  );

  const declined = buildEmailConsentRecord({
    sourceForm: 'newsletter',
    sourceUrl: 'https://example.test/',
    email: 'a@b.test',
    consent: false,
    now,
  });
  check('a decline is recorded, not discarded', declined.email_consent === false);
  check('a decline carries NO consent timestamp', declined.email_consent_at === null);
}

/* ── 11. The migration enforces it in the database too ───────────────────── */

check('the migration is marked do-not-apply', /DO NOT APPLY/i.test(MIGRATION));
check('the table is not sms_consents', MIGRATION.includes('public.email_consents'));
check('RLS is enabled', MIGRATION.includes('enable row level security'));
check(
  'anon and authenticated are revoked',
  /revoke all on public\.email_consents from anon, authenticated/.test(MIGRATION),
);
check(
  'append-only: even service_role cannot update or delete',
  /revoke update, delete, truncate on public\.email_consents from service_role/.test(MIGRATION),
);
check(
  'service_role gets only insert and select',
  /grant insert, select on public\.email_consents to service_role/.test(MIGRATION),
);
check(
  'a timestamp is constrained to affirmative consent only',
  MIGRATION.includes('email_consents_at_only_when_true'),
);
check(
  'blank wording is rejected at the database',
  MIGRATION.includes('email_consents_disclosure_not_blank'),
);
check(
  'blank version is rejected at the database',
  MIGRATION.includes('email_consents_version_not_blank'),
);
check(
  'retries de-duplicate on submission_id',
  MIGRATION.includes('email_consents_submission_id_key'),
);
check('the migration ships a rollback', /ROLLBACK/.test(MIGRATION));
check(
  'the rollback refuses to drop evidence that exists',
  MIGRATION.includes('export evidence before dropping'),
);
check(
  'evidence is deliberately not FK-cascaded to leads',
  /NOT a foreign key|NOT a FK/i.test(MIGRATION),
);
// Scoped to the actual column list, not the whole file: the table's own
// COMMENT says "No IP, no user agent", and a naive scan matches that prose and
// fails on the documentation instead of the schema.
{
  const body = MIGRATION.slice(
    MIGRATION.indexOf('create table if not exists public.email_consents ('),
    MIGRATION.indexOf('comment on table'),
  )
    .replace(/--.*$/gm, '')
    .replace(/constraint[\s\S]*?\)\s*\)?/gi, ' ');
  check('the column list was located', body.includes('email_consent_version'), body.length);
  check('no IP column', !/\b(ip|ip_address|remote_addr|client_ip)\b/i.test(body), body);
  check('no user-agent column', !/\b(user_agent|useragent|ua)\b/i.test(body), body);
}

/* ── 12. No secrets referenced or logged ─────────────────────────────────── */

for (const [label, src] of [
  ['the lead route', ROUTE],
  ['the newsletter form', FORM],
  ['the migration', MIGRATION],
] as const) {
  const body = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, '');
  for (const token of [
    'SERVICE_ROLE_KEY',
    'ADMIN_PASSWORD',
    'ADMIN_SESSION_SECRET',
    'TURNSTILE_SECRET',
    'HERE_API_KEY',
    'ANON_KEY',
  ]) {
    check(`${label} references no ${token}`, !body.includes(token));
  }
}
// Logs carry codes and ids, never payloads.
for (const m of ROUTE.matchAll(/log\.(?:error|info)\(([^;]*?)\);/g)) {
  const call = m[1];
  check('a log line carries no email', !/\bemail\b/.test(call), call);
  check('a log line carries no phone', !/\bphone\b/.test(call), call);
  check('a log line carries no utm', !/\butm\b/.test(call), call);
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
