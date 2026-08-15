/**
 * Consent, identity, and who ends up in a marketing file.
 *
 * The failures this guards against are not crashes. A consent bug ships as
 * working software and shows up later as one address in a marketing list that
 * never agreed to be there, or as a driver who ticked the box and hears
 * nothing. Neither throws, neither logs, and neither is visible in a browser.
 *
 * So the rules are tested as pure functions with every timestamp injected, and
 * the structural rules — RLS shape, secrets, what the migration is allowed to
 * store — are read off the files themselves.
 *
 * Filesystem + pure imports only. No database, no network, CI-safe.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CONSENT_COPY,
  CONSENT_COPY_VERSION,
  GENERIC_OTP_FAILED_MESSAGE,
  GENERIC_OTP_SENT_MESSAGE,
  OTP_RESEND_COOLDOWN_SECONDS,
  consentEvidenceFor,
  isPlausibleEmail,
  isWellFormedOtp,
  normalizeEmail,
  normalizePhone,
  resendAvailableInSeconds,
  validateSignup,
  type SignupInput,
} from '@/lib/navigator-account/signup-contract';
import {
  STAN_CSV_HEADERS,
  STAN_MANUAL_IMPORT_LIMIT,
  buildStanCsv,
  parseSince,
  stanExportFilename,
  type MarketingContactRow,
} from '@/lib/navigator-account/stan-export';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const shipped = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?<!:)\/\/[^\n]*/g, ' ');

const MIGRATION = 'supabase/migrations/050_navigator_accounts.sql';
const ACTIONS = 'src/app/(navigator)/navigator/account/actions.ts';
const FORM = 'src/components/navigator/AccountForm.tsx';
const PAGE = 'src/app/(navigator)/navigator/account/page.tsx';
const CSV_ROUTE = 'src/app/admin/(dashboard)/navigator/marketing/csv/route.ts';

const base: SignupInput = {
  firstName: 'Shawn',
  email: 'driver@example.com',
  phone: '',
  acceptedPrivacy: true,
  emailMarketing: false,
  smsMarketing: false,
};
const ok = (over: Partial<SignupInput> = {}) => validateSignup({ ...base, ...over });

/* ── 1. what a signup must supply ────────────────────────────────────── */

check('a complete signup validates', ok().length === 0, ok());
check('first name is required', ok({ firstName: '' }).includes('first-name-required'));
check('…and whitespace is not a name', ok({ firstName: '   ' }).includes('first-name-required'));
check(
  'an absurd name is refused',
  ok({ firstName: 'x'.repeat(81) }).includes('first-name-too-long'),
);
check('email is required', ok({ email: '' }).includes('email-required'));
for (const bad of ['nope', 'a@b', 'a b@c.com', '@example.com', 'driver@', 'driver@com']) {
  check(`"${bad}" is refused as an address`, ok({ email: bad }).includes('email-invalid'));
}
for (const good of ['a@b.co', 'first.last+tag@sub.example.co.uk', 'DRIVER@EXAMPLE.COM']) {
  check(`"${good}" is accepted`, ok({ email: good }).length === 0, ok({ email: good }));
}
check('the privacy box is required', ok({ acceptedPrivacy: false }).includes('privacy-required'));
check(
  'every problem is reported at once, not just the first',
  ok({ firstName: '', email: '', acceptedPrivacy: false }).length === 3,
);

/* ── 2. the phone is optional, and half a phone is not ───────────────── */

check('no phone is fine', ok({ phone: '' }).length === 0);
check('whitespace-only phone is fine', ok({ phone: '   ' }).length === 0);
check('a real phone is fine', ok({ phone: '(555) 123-4567' }).length === 0);
check('a broken phone is refused', ok({ phone: '12' }).includes('phone-invalid'));
check('letters are not a phone', ok({ phone: 'call me' }).includes('phone-invalid'));

check('a bare US 10-digit gains a country code', normalizePhone('5551234567') === '+15551234567');
check('punctuation is stripped', normalizePhone('(555) 123-4567') === '+15551234567');
check('a leading 1 is handled', normalizePhone('1-555-123-4567') === '+15551234567');
check('an international number survives', normalizePhone('+44 20 7946 0958') === '+442079460958');
check('empty is null, not an error value', normalizePhone('') === null);
check('undefined is null', normalizePhone(undefined) === null);
check('too short is null', normalizePhone('123') === null);
check('too long is null', normalizePhone('1234567890123456789') === null);
check('a leading zero is refused', normalizePhone('+0123456789') === null);

/* ── 3. consent: never assumed, never pre-ticked, never invented ─────── */

check(
  'marketing consent defaults to OFF in the contract',
  base.emailMarketing === false && base.smsMarketing === false,
);
check(
  'refusing all marketing still produces a valid signup',
  ok({ emailMarketing: false, smsMarketing: false }).length === 0,
);
check(
  'SMS consent without a phone is refused',
  ok({ smsMarketing: true, phone: '' }).includes('sms-consent-needs-phone'),
);
check(
  'SMS consent with an UNPARSEABLE phone is refused too',
  ok({ smsMarketing: true, phone: '12' }).includes('sms-consent-needs-phone'),
);
check(
  'SMS consent with a real phone is accepted',
  ok({ smsMarketing: true, phone: '5551234567' }).length === 0,
);
check(
  'email consent needs no phone — the two are independent',
  ok({ emailMarketing: true, phone: '' }).length === 0,
);

{
  // A decline is evidence. "Said no" and "was never asked" must not collapse.
  const declined = consentEvidenceFor({ ...base, emailMarketing: false });
  check(
    'declining email still writes a row',
    declined.length === 1 && declined[0].granted === false,
  );
  const granted = consentEvidenceFor({ ...base, emailMarketing: true });
  check('accepting email writes a granted row', granted[0].granted === true);
  check(
    'no phone ⇒ no SMS row at all',
    declined.every((r) => r.channel !== 'sms'),
  );

  const withPhone = consentEvidenceFor({ ...base, phone: '5551234567', smsMarketing: false });
  check(
    'a phone means the SMS question WAS asked, so a decline is recorded',
    withPhone.length === 2,
  );
  check(
    'and the recorded SMS answer is the one given',
    withPhone.find((r) => r.channel === 'sms')?.granted === false,
  );
  check(
    'every row carries the exact wording shown, not a summary',
    granted[0].disclosureText === CONSENT_COPY.emailMarketing &&
      withPhone.find((r) => r.channel === 'sms')?.disclosureText === CONSENT_COPY.smsMarketing,
  );
  check('…and the version that pins it', granted[0].version === CONSENT_COPY_VERSION);
}

check(
  'the acceptance copy claims only what exists — Privacy, not Terms',
  /Privacy Policy/.test(CONSENT_COPY.acceptance) && !/Terms/i.test(CONSENT_COPY.acceptance),
);
check(
  'the transactional note separates sign-in mail from marketing',
  /sign-in code/i.test(CONSENT_COPY.transactionalNote) &&
    /separate from marketing/i.test(CONSENT_COPY.transactionalNote),
);
check(
  'the SMS copy carries rates and STOP',
  /rates may apply/i.test(CONSENT_COPY.smsMarketing) && /STOP/.test(CONSENT_COPY.smsMarketing),
);

/* ── 4. the one-time code ────────────────────────────────────────────── */

check('six digits is a code', isWellFormedOtp('123456'));
check('a leading zero survives', isWellFormedOtp('012345'));
check('five digits is not', !isWellFormedOtp('12345'));
check('seven digits is not', !isWellFormedOtp('1234567'));
check('letters are not', !isWellFormedOtp('12345a'));
check('empty is not', !isWellFormedOtp(''));
check('surrounding space is forgiven', isWellFormedOtp(' 123456 '));
check(
  'a resend is blocked immediately after sending',
  resendAvailableInSeconds(1_000_000, 1_000_000) === OTP_RESEND_COOLDOWN_SECONDS,
);
check(
  '…and allowed once the cooldown passes',
  resendAvailableInSeconds(1_000_000, 1_000_000 + OTP_RESEND_COOLDOWN_SECONDS * 1000) === 0,
);
check('a first send is never blocked', resendAvailableInSeconds(null, 1_000_000) === 0);
check(
  'neither generic message reveals whether the address is known',
  !/exist|registered|unknown|no account|not found/i.test(GENERIC_OTP_SENT_MESSAGE) &&
    !/exist|registered|unknown|no account|not found/i.test(GENERIC_OTP_FAILED_MESSAGE),
);

/* ── 5. the export: only the consented, only once ────────────────────── */

const row = (over: Partial<MarketingContactRow> = {}): MarketingContactRow => ({
  first_name: 'Shawn',
  email: 'a@example.com',
  phone: '(555) 123-4567',
  phone_e164: '+15551234567',
  created_at: '2026-08-01T00:00:00Z',
  ...over,
});

check(
  'the header is exactly what Stan maps on',
  STAN_CSV_HEADERS.join(',') === 'First Name,Last Name,Email,Phone',
);
{
  const out = buildStanCsv([row(), row({ email: 'b@example.com', first_name: 'Dana' })]);
  const lines = out.csv.trim().split('\r\n');
  check('a header plus one line per contact', lines.length === 3, lines);
  check('last name is present and empty', lines[1].split(',')[1] === '');
  check('the normalized phone is preferred', lines[1].endsWith('+15551234567'));
  check('the count is reported', out.included === 2);
}
{
  const out = buildStanCsv([row(), row(), row({ email: 'A@Example.com' })]);
  check('one person appears once, however their address is spelled', out.included === 1, out);
  check('duplicates are counted, not hidden', out.droppedDuplicate === 2);
}
{
  const out = buildStanCsv([
    row({ email: null }),
    row({ email: '' }),
    row({ email: 'nope' }),
    row(),
  ]);
  check('rows with no usable address are dropped', out.included === 1);
  check('…and reported rather than silently vanishing', out.droppedNoEmail === 3);
}
{
  // A comma or a quote in a name must not shift every later column.
  const out = buildStanCsv([
    row({ first_name: 'Shawn, Jr.' }),
    row({ email: 'q@example.com', first_name: 'A "Big" Rig' }),
  ]);
  check('a comma in a name is quoted', out.csv.includes('"Shawn, Jr."'));
  check('a quote in a name is escaped', out.csv.includes('"A ""Big"" Rig"'));
}
check('the Stan ceiling is recorded', STAN_MANUAL_IMPORT_LIMIT === 5000);
check(
  'an oversized export says so',
  buildStanCsv(Array.from({ length: 5001 }, (_, i) => row({ email: `d${i}@example.com` })))
    .overStanLimit,
);
check('a normal export does not', !buildStanCsv([row()]).overStanLimit);

check(
  'an absent since filter means everyone',
  parseSince(undefined) === null && parseSince('') === null,
);
check(
  'an UNPARSEABLE since means everyone, not nobody',
  parseSince('last tuesday') === null && parseSince('2026-13-45') === null,
);
check('a real date parses', parseSince('2026-08-01') === '2026-08-01T00:00:00.000Z');
check(
  'the filename records the window',
  stanExportFilename(null, '2026-08-15T00:00:00Z').includes('all-2026-08-15') &&
    stanExportFilename('2026-08-01T00:00:00Z', '2026-08-15T00:00:00Z').includes('since-2026-08-01'),
);

/* ── 6. the export route cannot be reached without an admin session ──── */

{
  const src = shipped(CSV_ROUTE);
  check(
    'the handler authenticates ITSELF — layouts do not wrap route handlers',
    /isAdminAuthed\(\)/.test(src),
  );
  check(
    '…before it reads anything',
    src.indexOf('isAdminAuthed') < src.indexOf('createAdminClient'),
  );
  check(
    'it answers 401, not a redirect that would download a login page',
    /status: 401/.test(src) && !/redirect\(/.test(src),
  );
  check(
    'it reads the view, and does not re-derive who consented',
    /navigator_marketing_contacts/.test(src) && !/is_subscribed/.test(src),
  );
  check(
    'a missing migration is a 503, never an empty file that reads as "nobody consented"',
    /marketing-view-unavailable/.test(src) && /status: 503/.test(src),
  );
  check(
    'counts ride in headers, not as a row the importer would ingest',
    /x-tlws-included/.test(src),
  );
  check('the download is never cached', /no-store/.test(src));
}

/* ── 7. the migration stores identity and setup — and no location ────── */

{
  const sql = read(MIGRATION);
  check(
    'both tables cascade from auth.users',
    (sql.match(/references auth\.users\(id\) on delete cascade/g) ?? []).length === 2,
  );
  check(
    'RLS is enabled on both',
    /alter table public\.navigator_profiles enable row level security/.test(sql) &&
      /alter table public\.navigator_state\s+enable row level security/.test(sql),
  );
  check(
    'every policy derives ownership from the session, never from client input',
    (sql.match(/auth\.uid\(\)/g) ?? []).length >= 7,
  );
  check(
    'writes carry WITH CHECK, so a row cannot be moved to another user on the way out',
    (sql.match(/with check \(user_id = auth\.uid\(\)\)/g) ?? []).length >= 4,
  );
  check(
    'anon is revoked on both tables',
    /revoke all on public\.navigator_profiles from anon/.test(sql) &&
      /revoke all on public\.navigator_state\s+from anon/.test(sql),
  );
  check(
    'the marketing view is service-role only',
    /revoke all on public\.navigator_marketing_contacts from anon, authenticated/.test(sql),
  );
  check(
    '…and reads under the caller, so it is not a way around the revokes',
    /security_invoker = on/.test(sql),
  );

  /*
   * The rule that matters most in this file. The four domains are the whole
   * allowlist; a fifth cannot be written without a migration, which is where
   * someone gets to ask whether it is a location.
   */
  const domains = sql.match(/check \(domain in \(([^)]+)\)\)/);
  check(
    'the state table accepts exactly four domains',
    domains !== null && domains[1].split(',').length === 4,
    domains?.[1],
  );
  for (const d of ['truck', 'route_prefs', 'hos_clocks', 'onboarding']) {
    check(`…including ${d}`, domains !== null && domains[1].includes(`'${d}'`));
  }
  for (const forbidden of [
    'position',
    'location',
    'destination',
    'search',
    'route_history',
    'geometry',
    'breadcrumb',
  ]) {
    check(`no column or domain named for ${forbidden}`, !new RegExp(`'${forbidden}'`).test(sql));
  }
  check('the payload is bounded', /pg_column_size\(payload\) <= \d+/.test(sql));
  check(
    'consent booleans are NOT on the profile — consent is evidence',
    !/email_marketing_opt_in/.test(sql) && !/sms_marketing_opt_in/.test(sql),
  );
  check(
    'terms acceptance is nullable, because there is no Terms page',
    /terms_accepted_at timestamptz,/.test(sql),
  );
  check('privacy acceptance is required', /privacy_accepted_at timestamptz not null/.test(sql));
  check(
    'the migration says it must not be applied blind',
    /DO NOT APPLY WITHOUT EXPLICIT APPROVAL/.test(sql),
  );
  check('…and that it depends on 049', /DEPENDS ON 049/.test(sql));
}

/* ── 8. no secret, no token, no password anywhere near the client ────── */

{
  const form = shipped(FORM);
  check('the form has no password field', !/type="password"/.test(form));
  check('…and no username', !/username/i.test(form));
  check(
    'no marketing box is pre-ticked',
    !/defaultChecked/.test(form) && !/checked=\{true\}/.test(form),
  );
  check('the required box links the policy it names', /href="\/privacy"/.test(form));
  check('the SMS box appears only when a phone is usable', /phoneUsable && \(/.test(form));
  check(
    'the code field invites the OS to fill it',
    /autoComplete="one-time-code"/.test(form) && /inputMode="numeric"/.test(form),
  );
  check('the button says what it does', /Email My 6-Digit Code/.test(form));

  for (const secret of [
    'SUPABASE_SERVICE_ROLE_KEY',
    'NAVIGATOR_PREVIEW_PASSWORD',
    'HERE_API_KEY',
  ]) {
    check(`${secret} is never read from the form`, !form.includes(secret));
  }
  check(
    'the service-role client is never imported by a client component',
    !form.includes('supabase/admin'),
  );
}
{
  const actions = shipped(ACTIONS);
  check('the actions are server-only', /^'use server'/.test(read(ACTIONS).trimStart()));
  check(
    'a code request is rate limited before it can send mail',
    actions.indexOf('otpLimiter.allow') < actions.indexOf('signInWithOtp'),
  );
  check('verification is rate limited too', /verifyLimiter\.allow/.test(actions));
  check(
    'shouldCreateUser stays true, so Supabase cannot answer differently for a known address',
    /shouldCreateUser: true/.test(actions) && !/shouldCreateUser: false/.test(actions),
  );
  check('the provider error is never handed to the caller', !/error\.message/.test(actions));
  check('deletion requires typing the word', /!== 'DELETE'/.test(actions));
  check(
    'withdrawal appends rather than updates',
    /email_unsubscribes/.test(actions) && !/\.update\(/.test(actions),
  );
  check('consent evidence is written with the service role', actions.includes('createAdminClient'));
  check(
    'no Navigator surface logs — including this one',
    !/console\./.test(actions) && !/trackEvent/.test(actions),
  );
}
{
  const page = shipped(PAGE);
  check(
    'account controls live on the account page',
    /signOutAction/.test(page) && /deleteAccountAction/.test(page),
  );
  check(
    '…and the driving screen has none of them',
    !shipped('src/components/navigator/DrivingScreen.tsx').includes('signOutAction'),
  );
  check('the page re-decides on every request', /dynamic = 'force-dynamic'/.test(page));
}

console.log(`navigator-accounts: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
