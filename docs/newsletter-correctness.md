# Newsletter correctness — data loss, consent evidence, analytics

**Date:** 2026-08-02 · **Base:** `main` @ `a71a467` · **Status:** code fix active; consent evidence and analytics both blocked on an owner action.

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

## 4. OWNER DECISION REQUIRED — `EMAIL-CONSENT-01`

**The exact disclosure sentence shown beside the newsletter email field.**

`EMAIL_CONSENT_DISCLOSURE` is deliberately an empty string. Consent wording is a legal statement about what Trucking Life will and will not do with an address, and nothing in this repo may invent it.

The approved text has to settle four questions. These are questions, not suggested wording:

1. What is being sent — what kind of email, roughly how often?
2. Who is sending it?
3. How does someone stop receiving it?
4. Is the address shared with anyone outside Trucking Life?

To apply: paste the exact sentence into `EMAIL_CONSENT_DISCLOSURE` and change `EMAIL_CONSENT_VERSION` from `v0-unapproved` to `v1` **in the same commit**. The pair is what makes a stored row evidence; a test asserts they cannot drift apart.

Note the ordering constraint: the disclosure must also be **rendered on the form** before it can honestly be recorded as shown. That is a separate follow-up, gated on the same approved text.

## 5. Plausible configuration audit

| Question | Answer |
|---|---|
| Does `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` exist in the Netlify environment? | **No.** Confirmed absent from the site's configured variables. |
| Is the expected domain known from committed code? | **Yes** — `src/lib/seo/site.ts:5` carries the canonical production URL as the fallback for `NEXT_PUBLIC_SITE_URL`. Plausible wants the bare hostname from that URL, without scheme or trailing slash. |
| Is adding it sufficient to load Plausible? | **Yes.** `PlausibleAnalytics` returns `null` when the variable is unset and otherwise renders the queue shim plus the vendor script. It is already mounted in `src/app/layout.tsx`. No code change needed. |
| Does `newsletter_lead_captured` fire only after a durable write? | **Yes.** It sits after the `if (!res.ok || !body.ok) { … return; }` guard, and the route returns `ok` only once, after the database write succeeds. Asserted by index comparison, not by eye. |

### Safe configuration action for Shawn (manual, no values here)

1. Netlify → the site → **Site configuration → Environment variables → Add a variable**.
2. Key: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
3. Value: the bare production hostname — the host portion of the canonical URL in `src/lib/seo/site.ts:5`, with no `https://`, no `www.` unless that is genuinely the canonical host, and no trailing slash.
4. Scope: **all deploy contexts** is fine, or production-only if preview traffic should stay out of the numbers. Because the value is a `NEXT_PUBLIC_` build-time inline, it must be present at **build** scope, not runtime only.
5. Mark it **not secret** — it is a public hostname and is visible in the page source by design.
6. Redeploy. The variable is inlined at build time, so an existing deploy will not pick it up.
7. Verify: view source on the homepage and confirm a `script` tag with `data-domain` set to that host. Then submit the newsletter form once and confirm the custom event appears in Plausible.

Because Plausible has never been loaded, **no newsletter conversion has ever been recorded** — for anyone. There is no historical data to lose and none to migrate.

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

No migration applied. No production data written. No Netlify configuration changed. No Store pricing, no Amazon visibility, no PWA, no Navigator. The newsletter form's rendered copy is untouched — adding disclosure text to the page is a separate change, gated on `EMAIL-CONSENT-01`.
