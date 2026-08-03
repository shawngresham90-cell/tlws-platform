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
  EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL,
  EMAIL_CONSENT_RECORDING_ENABLED,
  EMAIL_CONSENT_VERSION,
  EMAIL_CONSENT_SOURCE_FORMS,
  UNSUBSCRIBE_METHODS,
  buildEmailConsentRecord,
  buildEmailUnsubscribeRecord,
  canRecordEmailConsent,
  hasApprovedDisclosure,
} from '@/lib/leads/email-consent';
import { NEWSLETTER_EVENTS } from '@/lib/leads/analytics';
import {
  LEAD_SOURCES,
  leadFilterParam,
  parseLeadFilter,
  segmentFor,
  type LeadFilter,
} from '@/lib/leads/funnel';

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
const ADMIN_DATA = readFileSync('src/lib/admin/data.ts', 'utf8');
const ADMIN_PAGE = readFileSync('src/app/admin/(dashboard)/leads/page.tsx', 'utf8');

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

/* ── 8. The event fires only after a durable write ───────────────────────── */

const trackIndex = FORM.indexOf('trackEvent(');
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

/* ── 9. A new subscriber and a repeat submit are counted apart ───────────── */

// The old bug: one event for both outcomes, so the signup number counted
// SUBMISSIONS. `done` is component state with no persistence, so a reload let
// the same person fire it again.
{
  const names: string[] = Object.values(NEWSLETTER_EVENTS);
  check(
    'the two outcomes have two distinct event names',
    names.length === 2 && new Set(names).size === 2,
    names,
  );
}
check(
  'the form branches on the created flag rather than firing one event',
  /body\.data\?\.created\s*\?\s*NEWSLETTER_EVENTS\.captured\s*:\s*NEWSLETTER_EVENTS\.alreadySubscribed/.test(
    FORM,
  ),
);
check('the form no longer hardcodes an event string', !/trackEvent\('newsletter/.test(FORM));
check(
  'the route reports whether it created the lead',
  /return ok\(\{[^}]*created[^}]*\}/.test(ROUTE),
);
check(
  'created is set only on a successful insert',
  /leadId = inserted\.data\.id;\s*\n\s*created = true;/.test(ROUTE),
);
check('created starts false', /let created = false;/.test(ROUTE));
// The 23505 race path adopts an existing row — that is not a new subscriber,
// so it must not be able to reach `created = true`.
// Scoped to the 23505 branch itself. Slicing to `if (!leadId)` would swallow
// the sibling else-branch, where `created = true` legitimately lives — the
// assertion would then be reading the very line it is supposed to exclude.
{
  const raceBlock = ROUTE.slice(ROUTE.indexOf("'23505'"), ROUTE.indexOf('lead_insert_failed'));
  check('the race block was located', raceBlock.includes('lead_insert_race_unresolved'));
  check(
    'adopting a raced row is not counted as a new subscriber',
    !raceBlock.includes('created = true'),
    raceBlock,
  );
}

/* ── 9b. No PII in either analytics event ────────────────────────────────── */

check('the tracked call passes no properties at all', !/trackEvent\(\s*[^)]*,\s*\{/.test(FORM));
for (const token of ['email', 'phone', 'first_name', 'firstName', 'zip', 'utm']) {
  check(
    `the tracked call passes no ${token}`,
    !new RegExp(`trackEvent\\([^)]*${token}`, 'i').test(FORM),
  );
}
// `created` describes the write, not the person. It may CHOOSE the event name;
// it may not be sent alongside it. The distinction is the argument count, so
// assert that directly rather than scanning for the word — the branch mentions
// `created` by necessity, and a scan for it would flag the correct code.
{
  const open = FORM.indexOf('trackEvent(');
  const call = FORM.slice(open + 'trackEvent('.length, FORM.indexOf(')', open));
  check('the trackEvent call was located', open > -1 && call.length > 0);
  check(
    'the event is dispatched with a name and nothing else',
    call.replace(/\s+$/, '').replace(/,$/, '').split(',').length === 1,
    call,
  );
}

/* ── 10. Consent evidence is append-only and version-locked ──────────────── */

check(
  'recording is OFF until the migration and the wording land',
  !EMAIL_CONSENT_RECORDING_ENABLED,
);
check(
  'no disclosure wording has been invented',
  EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL === '',
);
check(
  'the constant names its own blocker, so nobody fills it in casually',
  ['src/lib/leads/email-consent.ts']
    .map((f) => readFileSync(f, 'utf8'))
    .every((src) => src.includes('EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL')),
);
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
  check(
    'the row stores the disclosure verbatim',
    row.disclosure_text === EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL,
  );
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
  /revoke all on public\.email_consents\s+from anon, authenticated/.test(MIGRATION),
);
check(
  'append-only: even service_role cannot update or delete',
  /revoke update, delete, truncate on public\.email_consents\s+from service_role/.test(MIGRATION),
);
check(
  'service_role gets only insert and select',
  /grant insert, select on public\.email_consents\s+to service_role/.test(MIGRATION),
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
  MIGRATION.includes('export before dropping'),
);

/* ── 11b. Opt-out evidence has somewhere to land ─────────────────────────── */

// The gap this closes: `email_consents` is append-only with UPDATE and DELETE
// revoked, so before this table existed a later unsubscribe had nowhere to go.
// The only ways to record one would have been to edit a consent row — which
// the privileges forbid, correctly — or to keep a mutable flag somewhere else,
// which is the class of bug this whole change is about.
check('an unsubscribe table exists', MIGRATION.includes('public.email_unsubscribes'));
check(
  'opt-outs are append-only too',
  /revoke update, delete, truncate on public\.email_unsubscribes\s+from service_role/.test(
    MIGRATION,
  ),
);
check(
  'anon and authenticated cannot read opt-outs',
  /revoke all on public\.email_unsubscribes\s+from anon, authenticated/.test(MIGRATION),
);
check('the opt-out method is constrained', MIGRATION.includes('email_unsubscribes_method_known'));
check(
  'an opt-out does not require a prior consent row',
  !/references public\.email_consents/.test(MIGRATION),
);
check(
  'opt-out retries de-duplicate on submission_id',
  MIGRATION.includes('email_unsubscribes_submission_id_key'),
);

// The TypeScript allowlist and the SQL check constraint are two statements of
// one rule. If they drift, a method the app treats as valid is rejected by the
// database on insert — at the moment someone is trying to unsubscribe.
{
  const clause = MIGRATION.slice(MIGRATION.indexOf("method in ('"));
  const sqlMethods = (clause.slice(0, clause.indexOf(')')).match(/'([a-z-]+)'/g) ?? []).map((m) =>
    m.replace(/'/g, ''),
  );
  check(
    'every TypeScript opt-out method is accepted by the database',
    UNSUBSCRIBE_METHODS.every((m) => sqlMethods.includes(m)),
    { UNSUBSCRIBE_METHODS, sqlMethods },
  );
  check(
    'the database accepts no opt-out method the app does not know',
    sqlMethods.every((m) => (UNSUBSCRIBE_METHODS as readonly string[]).includes(m)),
    { UNSUBSCRIBE_METHODS, sqlMethods },
  );
}

/* ── 11c. Subscription status is derived, never stored ───────────────────── */

check(
  'a status view exists',
  MIGRATION.includes('create or replace view public.email_subscription_status'),
);
check(
  'the view reads under the caller, not its owner',
  MIGRATION.includes('security_invoker = on'),
);
check(
  'a tie between consent and opt-out resolves to not-subscribed',
  MIGRATION.includes('c.at > u.at') && !MIGRATION.includes('c.at >= u.at'),
);
// A stored boolean is the thing this design exists to avoid: it can be set by
// code with no evidence behind it, and once it disagrees with the log there is
// no way to tell which is lying.
check(
  'no subscription flag is added to any table',
  !/alter table[\s\S]*add column[\s\S]*subscrib/i.test(MIGRATION),
);
check(
  'the view is not writable by anon or authenticated',
  /revoke all on public\.email_subscription_status\s+from anon, authenticated/.test(MIGRATION),
);
check(
  'the rollback drops the view and both tables',
  [
    'drop view  if exists public.email_subscription_status',
    'drop table if exists public.email_unsubscribes',
    'drop table if exists public.email_consents',
  ].every((stmt) => MIGRATION.includes(stmt)),
);

/* ── 11d. Opt-out records are buildable without any gate ─────────────────── */

{
  const row = buildEmailUnsubscribeRecord({ email: '  MiXeD@Example.TEST ', method: 'link' });
  check(
    'the opt-out address is normalized to match the column constraint',
    row.email === 'mixed@example.test',
  );
  check('an opt-out with no note stores null, not blank', row.note === null);
  check('an opt-out with no token stores null', row.submission_id === null);
  check(
    'a note is trimmed and kept',
    buildEmailUnsubscribeRecord({ email: 'a@b.test', method: 'reply', note: '  asked by email  ' })
      .note === 'asked by email',
  );
  check(
    'a whitespace-only note is stored as null',
    buildEmailUnsubscribeRecord({ email: 'a@b.test', method: 'manual', note: '   ' }).note === null,
  );
  // The consent gate must NOT apply here. An opt-out has to be recordable in
  // exactly the state the platform is in today — recording off, wording
  // unapproved — or there is a window where someone can ask to stop and we
  // have nowhere to put it.
  check('recording an opt-out does not depend on the consent switch', !canRecordEmailConsent());
  check(
    'an opt-out row carries no disclosure or version it cannot honestly have',
    !('disclosure_text' in row) && !('email_consent_version' in row),
  );
  check('an opt-out row carries no network identifiers', !('ip' in row) && !('user_agent' in row));
}
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

/* ── 12. Segmentation survives, and the admin list tells the truth ───────── */

// Every canonical source must be one a route actually writes. A source listed
// before anything writes it renders a permanently empty bucket that reads as
// "no signups yet" rather than "this does not exist".
{
  const writers = [ROUTE, readFileSync('src/app/api/tests/attempt/route.ts', 'utf8')].join('\n');
  const FORMS = [FORM, readFileSync('src/components/community/BecomeFounderForm.tsx', 'utf8')].join(
    '\n',
  );
  for (const source of LEAD_SOURCES) {
    check(
      `something actually writes the "${source}" source`,
      writers.includes(`'${source}'`) || FORMS.includes(`source: '${source}'`),
    );
  }
}

// Chips are labelled by segment and filter by source, so two sources sharing a
// label would render two identical chips that do different things.
{
  const labels = LEAD_SOURCES.map((s) => segmentFor(s).label);
  check(
    'each source maps to its own segment label',
    new Set(labels).size === labels.length,
    labels,
  );
  check(
    'an unknown source is labelled, not dropped',
    segmentFor('something-new').label === segmentFor(null).label,
  );
  check('a null source still gets a label', segmentFor(null).label.length > 0);
}

// Source values are interpolated into a PostgREST `not.in.(...)` list. A comma,
// parenthesis or quote in one would break the filter — silently changing which
// rows the owner sees rather than failing loudly.
for (const source of LEAD_SOURCES) {
  check(`the "${source}" source is safe to interpolate into a filter`, /^[a-z0-9-]+$/.test(source));
}

// Round-trip: a chip's link must parse back to the filter that rendered it.
{
  const filters: LeadFilter[] = [
    { kind: 'all' },
    { kind: 'other' },
    ...LEAD_SOURCES.map((source) => ({ kind: 'source', source }) as const),
  ];
  for (const filter of filters) {
    const param = leadFilterParam(filter);
    check(
      `the ${filter.kind === 'source' ? filter.source : filter.kind} filter round-trips`,
      JSON.stringify(parseLeadFilter(param)) === JSON.stringify(filter),
      { filter, param, parsed: parseLeadFilter(param) },
    );
  }
  // A typo or a stale bookmark must not query for a source that cannot exist —
  // that would render an empty list reading as "no leads from this source".
  for (const bogus of ['newsletterr', 'FOUNDER', '', '   ', 'all', "'; drop table leads;--"]) {
    check(`"${bogus}" falls back to the unfiltered view`, parseLeadFilter(bogus).kind === 'all');
  }
  check(
    'a repeated query param takes the first value',
    parseLeadFilter(['founder', 'newsletter']).kind === 'source',
  );
  check('an absent query param is the unfiltered view', parseLeadFilter(undefined).kind === 'all');
}

// The counts.
check('the lead list applies an explicit cap', /\.limit\(LEAD_PAGE_SIZE\)/.test(ADMIN_DATA));
check('the cap is a named constant', /export const LEAD_PAGE_SIZE = \d+/.test(ADMIN_DATA));
check(
  'the list reports the real total, not the fetched length',
  ADMIN_DATA.includes("{ count: 'exact' }") &&
    ADMIN_DATA.includes('truncated: total > rows.length'),
);
check(
  'per-source counts are head-only, so no row data crosses the wire for a chip',
  /select\('id', \{ count: 'exact', head: true \}\)/.test(ADMIN_DATA),
);
check(
  'the unrecognized bucket is derived by subtraction, so it cannot contradict the total',
  ADMIN_DATA.includes('Math.max(0, total - known)'),
);
check('the other-filter includes rows with a null source', ADMIN_DATA.includes('source.is.null'));
check(
  'the page renders the database total rather than rows.length',
  ADMIN_PAGE.includes('{tally.total}') && !/\({rows\.length}\)/.test(ADMIN_PAGE),
);
check('the page says when it is showing only part of the list', ADMIN_PAGE.includes('truncated'));

// Phone was fetched on every admin load and rendered nowhere.
check(
  'the admin lead query does not select phone',
  !/phone/.test(
    ADMIN_DATA.slice(
      ADMIN_DATA.indexOf('export async function getLeads'),
      ADMIN_DATA.indexOf('export type LeadTally'),
    ),
  ),
);
check(
  'the admin lead row type has no phone',
  !/export type LeadRow = \{[^}]*phone/.test(ADMIN_DATA),
);
check('the admin page renders no phone', !/r\.phone/.test(ADMIN_PAGE));

// Read-only by construction: this page has no mutation path at all.
for (const verb of ['insert(', 'update(', 'delete(', 'upsert(']) {
  check(`the admin lead page never calls ${verb}`, !ADMIN_PAGE.includes(verb));
}
check(
  'the lead data layer never writes',
  !/\.(insert|update|upsert|delete)\(/.test(
    ADMIN_DATA.slice(ADMIN_DATA.indexOf('export async function getLeads')),
  ),
);

/* ── 13. No secrets referenced or logged ─────────────────────────────────── */

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
