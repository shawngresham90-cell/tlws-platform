# Newsletter correctness — data loss, consent evidence, analytics

**Date:** 2026-08-02 (updated 2026-08-03) · **Base:** `main` @ `a71a467` · **Status:** code fix active; consent evidence and analytics both blocked on an owner action.

> Supersedes the narrower version of this work in PR #228. Same base commit, same data-loss fix, plus: the created-vs-existing response flow, unsubscribe evidence and a derived status view in migration 049, executed verification of that migration, and the admin source filter.

Triggered by a live verification: a real submission on 2026-08-02 returned a success message, wrote to `public.leads` — and destroyed data in the process.

---

## 1. The data-loss root cause

`/api/lead` upserted a **whole row** on every submission:

```ts
.upsert({ email, first_name, phone, sms_consent, source, utm }, { onConflict: 'email' })
```

`leads.email` is `UNIQUE`, so a repeat signup took the conflict path and overwrote **every listed column**. The newsletter form collects only an email, so the other values were filled from an empty payload:

| Column | What a newsletter repeat wrote | Consequence |
|---|---|---|
| `first_name` | `null` | A name given on the founder form is erased |
| `phone` | `null` | A phone number given on the founder form is erased |
| `source` | `'newsletter'` | A founder or academy lead is relabelled newsletter-only |
| `utm` | `{}` | First-touch attribution is destroyed |
| `sms_consent` | `false` | **A real SMS opt-in is silently revoked** |

That last row is the worst of them. `granted` is computed only for `source === 'founder'`; every other source produced `false`, and `false` was written over an existing `true`. The `sms_consents` evidence log would then say the driver opted in while the flag said they had not.

Observed live on the verification account: `created_at` 2026-07-14, `updated_at` 2026-08-02, `first_name` null, `phone` null, `utm` `{}`.

## 2. New upsert behaviour

Insert-or-merge, with the policy in `src/lib/leads/merge.ts` (pure and directly tested) rather than inline in the route.

**New address** → `INSERT` the whole row. First touch (`source`, `utm`) is captured here, once.

**Existing address** → `UPDATE` containing **only the columns that submission actually collected**. Untouched columns do not appear in the statement at all — they are not rewritten with the value we just read. That distinction matters under concurrency: two submissions racing on the same address cannot clobber each other's untouched columns, because neither statement mentions them.

Rules now enforced:

- `source`, `utm`, `email`, `created_at` are **immutable after insert** — declared in `IMMUTABLE_AFTER_INSERT` and asserted against every possible patch shape.
- `null`, `undefined`, `''` and whitespace all mean *"this form did not collect it"* — never *"erase it"*.
- `sms_consent` **only ever rises.** A form that did not display the SMS disclosure passes `undefined`, not `false`, so it cannot revoke a real opt-in.
- A repeat signup carrying nothing new performs **no write at all** — genuinely idempotent, and `updated_at` stays honest.
- A concurrent insert (`23505`) adopts the winning row and merges into it rather than failing a submission that is, from the driver's side, fine.
- Every failure path returns `500 db_error`. There is exactly **one** `return ok(...)` in the route, reached only after a durable write.

## 3. Email-consent evidence — schema proposal

`supabase/migrations/049_email_consents.sql`. **Written, not applied.**

```
email_consents(
  id                     uuid pk default gen_random_uuid(),
  source_form            text not null,      -- server allowlist
  source_url             text not null,
  email                  text not null,      -- normalized lowercase
  email_consent          boolean not null,   -- opted in / shown and declined
  email_consent_at       timestamptz,        -- server clock, opt-in only
  email_consent_version  text not null,
  disclosure_text        text not null,      -- verbatim wording shown
  submission_id          text,               -- unique when present
  created_at             timestamptz not null default now()
)
```

Deliberate choices:

- **Not `sms_consents`.** Two legal regimes in one log would make `sms_consent` mean "some consent" and leave an SMS-scoped deletion request ambiguous about email rows.
- **No FK to `leads`.** Evidence must outlive the lead record it describes; an `ON DELETE CASCADE` would destroy exactly what a compliance record is for.
- **No IP, no user agent.** `sms_consents` — the approved model this mirrors — stores neither, and the brief permits them only if already conventional here. They are not. Recorded as a deliberate exclusion, not an omission.
- **Append-only by privilege, not convention.** `grant insert, select … to service_role` and `revoke update, delete, truncate`. Even the service role cannot edit evidence. Retention pruning, if ever wanted, arrives as its own reviewed migration.
- **RLS enabled with no policies**, and `revoke all … from anon, authenticated`. Default-deny; no signed-in user has a reason to read the log.
- **Constraints:** a timestamp may exist only for an affirmative opt-in; blank wording and blank version are both rejected at the database.
- **Rollback included**, and it refuses to drop a table that already holds evidence.

**Nothing writes here yet.** `EMAIL_CONSENT_RECORDING_ENABLED` is `false`, and `canRecordEmailConsent()` requires *both* the flag and approved wording — so flipping the flag alone still records nothing.

Two further constraints were added when the migration was restructured:

- **`email` must already be lowercase and trimmed**, enforced by check constraint rather than assumed from the API. The route normalizes at the Zod boundary, but "the current code does it" is not a property of the data — a second writer that forgot would split one person's history across two spellings and hide half their evidence from the status view below.

### 3a. Unsubscribe evidence

`email_consents` is append-only with `UPDATE` and `DELETE` revoked. That is right for consent, and it left a hole: **a later unsubscribe had nowhere to land.** The only options would have been to edit a consent row — which the privileges correctly forbid — or to keep a mutable flag somewhere, which is the same class of bug as the upsert this whole change exists to fix.

```
email_unsubscribes(
  id             uuid pk default gen_random_uuid(),
  email          text not null,   -- lowercase + trimmed, enforced
  method         text not null,   -- link | one-click | reply | complaint | manual
  note           text,            -- for the reply / manual paths
  submission_id  text,            -- unique when present
  created_at     timestamptz not null default now()
)
```

- **A separate table, not a column on `email_consents`.** A consent row carries the disclosure wording and version that make it evidence; an unsubscribe has no disclosure. Merging them would mean either `NOT NULL` columns an opt-out cannot honestly fill, or dropping those constraints and weakening the consent evidence to accommodate its opposite.
- **No prior consent required.** Someone can ask to stop because a friend forwarded them an email or because they were on the list before any of this existed. A system that could not record that without a matching opt-in would be refusing the one request it must always honour.
- **No consent gate.** `buildEmailUnsubscribeRecord()` deliberately does *not* consult `EMAIL_CONSENT_RECORDING_ENABLED` or the approved wording. Gating opt-outs behind the same switches that hold back collection would create a window where someone can ask to stop and there is nowhere to put it.
- **`method` is a bounded allowlist** in both SQL and TypeScript, and a test asserts the two lists match in both directions — so a value added to one without the other fails the build rather than failing every insert at the moment someone is trying to unsubscribe.

### 3b. Current status is derived, never stored

`email_subscription_status` is a **view**, not a column:

| Column | Meaning |
|---|---|
| `email` | the address, from either evidence table |
| `last_consent_at` / `last_consent_granted` | newest consent row and its decision |
| `last_unsubscribe_at` / `last_unsubscribe_method` | newest opt-out, if any |
| `is_subscribed` | `true` only when an affirmative consent is the most recent instruction |
| `status` | `subscribed` · `unsubscribed` · `declined` |

- **Latest instruction wins.** Someone may unsubscribe and later sign up again; both are real, and the newer one is current.
- **Ties fail closed.** A consent and an unsubscribe at the same instant resolve to *not* subscribed. Wrongly not sending costs an email nobody gets; wrongly sending mails a person who asked us to stop.
- **`declined` is not `unsubscribed`.** Shown the disclosure and said no is a different fact from having been on the list and left.
- **Absence is a decision.** An address with no evidence does not appear in the view at all, and the table comment says so explicitly: *no rows means not sendable*, never "assume subscribed". Addresses captured before this ships have no rows, which is correct — no disclosure was recorded for them.
- **`security_invoker = on`**, so the view is read under the caller's own permissions and cannot become a route around the `revoke`s on the base tables.
- The rule is **not** reimplemented in TypeScript. Two copies of a consent rule can disagree, and once they do there is no way to tell which one a given send used.

### 3c. The migration was executed and tested, not just written

Reasoning about SQL is not the same as running it. `scripts/verify-migration-049.mjs` applies 049 to a throwaway Postgres and asserts what it actually does — **44 assertions, all passing** against PostgreSQL 16.13.

It is deliberately *not* a `scripts/test-*.ts` harness: those are offline by contract and `run-tests.mjs` runs all of them, so one needing a database would fail CI everywhere. It refuses any host that is not a local socket or loopback, creates its own uniquely-named scratch database, and drops it afterwards.

What running it proved that reading it could not:

| Checked | Result |
|---|---|
| Applies cleanly; idempotent on re-apply | pass |
| 7 latest-wins scenarios incl. rejoin, decline-after-opt-in, opt-out with no prior consent | pass |
| Same-instant tie resolves to **not** subscribed | pass |
| Address with no evidence returns zero rows | pass |
| Uppercase / untrimmed email rejected (both tables) | pass |
| Blank wording, blank version, timestamp-on-decline rejected | pass |
| Unknown `method` rejected; every TypeScript method accepted | pass |
| Replayed `submission_id` cannot stack a row; tokenless rows still append | pass |
| `service_role` cannot `UPDATE`, `DELETE` or `TRUNCATE` either table | pass |
| `anon` / `authenticated` denied on both tables **and** the view | pass |
| A role granted only the view still cannot read through it (`security_invoker` proven, not assumed) | pass |
| Rollback guard refuses while evidence exists; runs clean on an empty schema and leaves zero objects | pass |

The rollback is extracted from the migration's own comment block by the script, so the commented SQL is executed rather than merely present.

## 4. OWNER DECISION REQUIRED — `EMAIL-CONSENT-01`

**The exact disclosure sentence shown beside the newsletter email field.**

`EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL` is deliberately an empty string. Consent wording is a legal statement about what Trucking Life will and will not do with an address, and nothing in this repo may invent it.

The approved text has to settle four questions. These are questions, not suggested wording:

1. What is being sent — what kind of email, roughly how often?
2. Who is sending it?
3. How does someone stop receiving it?
4. Is the address shared with anyone outside Trucking Life?

To apply: paste the exact sentence into `EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL` and change `EMAIL_CONSENT_VERSION` from `v0-unapproved` to `v1` **in the same commit**. The pair is what makes a stored row evidence; a test asserts they cannot drift apart.

Note the ordering constraint: the disclosure must also be **rendered on the form** before it can honestly be recorded as shown. That is a separate follow-up, gated on the same approved text.

## 5. Plausible configuration audit

| Question | Answer |
|---|---|
| Does `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` exist in the Netlify environment? | **No.** Confirmed absent from the site's configured variables. |
| Is the expected domain known from committed code? | **Yes** — `src/lib/seo/site.ts:5` carries the canonical production URL as the fallback for `NEXT_PUBLIC_SITE_URL`. Plausible wants the bare hostname from that URL, without scheme or trailing slash. |
| Is adding it sufficient to load Plausible? | **Yes.** `PlausibleAnalytics` returns `null` when the variable is unset and otherwise renders the queue shim plus the vendor script. It is already mounted in `src/app/layout.tsx`. No code change needed. |
| Do the newsletter events fire only after a durable write? | **Yes.** It sits after the `if (!res.ok || !body.ok) { … return; }` guard, and the route returns `ok` only once, after the database write succeeds. Asserted by index comparison, not by eye. |

### Safe configuration action for Shawn (manual, no values here)

1. Netlify → the site → **Site configuration → Environment variables → Add a variable**.
2. Key: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
3. Value: the bare production hostname — the host portion of the canonical URL in `src/lib/seo/site.ts:5`, with no `https://`, no `www.` unless that is genuinely the canonical host, and no trailing slash.
4. Scope: **all deploy contexts** is fine, or production-only if preview traffic should stay out of the numbers. Because the value is a `NEXT_PUBLIC_` build-time inline, it must be present at **build** scope, not runtime only.
5. Mark it **not secret** — it is a public hostname and is visible in the page source by design.
6. Redeploy. The variable is inlined at build time, so an existing deploy will not pick it up.
7. Verify: view source on the homepage and confirm a `script` tag with `data-domain` set to that host. Then submit the newsletter form once and confirm the custom event appears in Plausible.

Because Plausible has never been loaded, **no newsletter conversion has ever been recorded** — for anyone. There is no historical data to lose and none to migrate.

### 5a. The event counted submissions, not subscribers

A second defect, independent of the missing configuration. `/api/lead` returned the same `2xx` whether it created a lead or found the address already present, so the form fired one conversion event for both. Worse, `done` is component state with no persistence — a reload, a client-side nav back, or a return visit re-rendered the form and let the same person fire it again.

Had Plausible been configured, the signup number would have drifted upward with no new people behind it.

The route now returns `created`, set only on a successful `INSERT`, and the form fires one of two names:

| Event | Meaning |
|---|---|
| `newsletter_lead_captured` | a new lead row was created — one per subscriber |
| `newsletter_already_subscribed` | the submission succeeded; nobody new joined |

The repeat count is worth having on its own: a high already-subscribed rate means the form is being shown to people who already joined, which is a placement problem rather than a growth signal.

`created` is a fact about the write, not about the person. It selects the event name and is never sent as a property — a test asserts the dispatch takes a name and nothing else, so no properties reach the vendor from either event. The `23505` insert-race path adopts an existing row and is asserted never to set `created`.

**Analytics sinks are now isolated.** `trackEvent` fired Plausible, the GTM `dataLayer` and Vercel Analytics inside one `try/catch`, so a vendor that threw took the remaining sinks down with it and the event vanished everywhere with no signal. Each sink now runs in its own guard: one bad script costs one sink.

## 5b. Admin lead list — filter and honest counts

Every number on `/admin/leads` was a `.length` over the fetched array, and the fetch had no explicit limit — so it was silently capped by PostgREST's default max-rows. Past that cap the heading and the segment chips described one page of leads while presenting themselves as the list. At two leads the difference is invisible; at two thousand it under-reports with no visible sign.

- Counts come from `count: 'exact'` queries over the **whole table**; per-source chips use `head: true`, so no row data crosses the wire for a chip.
- The fetch cap is ours and named (`LEAD_PAGE_SIZE`), and the page says *"showing the N most recent of M"* when it is showing a prefix.
- **A source filter**, applied in the database. Filtering in the page would spend the cap on rows about to be discarded, so a filtered view could come back empty while matching rows sat just past the limit.
- `LEAD_SOURCES` was exported and consumed nowhere. It now drives the chips, so it cannot drift from reality unnoticed — and each entry is asserted to be a value some route actually writes, because a source listed before anything writes it renders a permanently empty bucket reading as "no signups yet" rather than "this does not exist".
- Rows whose source is not in that list get an **`other`** bucket rather than being counted in the total and absent from every chip. The filter is `source.is.null or source.not.in.(…)`, because Postgres `not in` drops nulls — which would have hidden unsourced leads entirely. The bucket's count is derived by subtraction from the total, so it cannot contradict it.
- An unrecognised `?source=` value falls back to the unfiltered view rather than querying for it, so a typo cannot render an empty list that reads as "no leads from this source".
- **Phone is no longer selected.** It was fetched on every admin load and rendered nowhere — a PII column read for no consumer.

## 6. Credential rotation — recommended

While confirming that `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` was absent, the environment-variable read returned secret values in clear text into this session's transcript. Nothing was displayed in chat and nothing is committed here, but the values did leave Netlify.

Recommended rotation, by **name only**:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TURNSTILE_SECRET_KEY`
- `HERE_API_KEY`

The two `NEXT_PUBLIC_*` values and the Turnstile **site** key are public by design and do not need rotating.

Rotate `SUPABASE_SERVICE_ROLE_KEY` last and deliberately — it is the credential the lead route writes with, and replacing it requires updating Netlify before the old key is revoked, or lead capture breaks in between.

## 7. What this change does *not* do

No migration applied to any Supabase project. No production data written — the only database access was read-only: an aggregate `count(*) group by source` over `public.leads`, returning two rows and no personal data. Migration 049 was executed **only** against a throwaway local PostgreSQL 16 cluster, which was destroyed afterwards.

No Netlify configuration changed. No secret values printed. No Store pricing, no Amazon visibility, no PWA, no Navigator, no HERE routing, no HOS, no Trip Planner, no parking data, no Founder Wall. PR #220, #221 and #227 were not touched.

The newsletter form's rendered copy is untouched — adding disclosure text to the page is a separate change, gated on `EMAIL-CONSENT-01`.

**No sending machinery.** Nothing here sends email, and nothing reads `email_subscription_status` yet, because there is no sender to read it. The view exists so that when one arrives it has a correct answer to consult instead of inventing a flag.

**No unsubscribe endpoint.** The evidence table and the record builder exist; no route writes to them. Wiring an opt-out path needs the same owner-approved wording and an applied migration, and building a link that does not yet resolve would be worse than not having one.

**No export.** Considered and left out deliberately: a CSV of subscriber addresses is a different risk surface — it needs its own decisions about who may download it, what it contains, and whether the download itself is logged — and bolting it onto this change would broaden a data-integrity fix into a data-egress feature.
