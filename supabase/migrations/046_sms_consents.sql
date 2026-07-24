-- 046: SMS consent evidence log (Text Request / TCPA / 10DLC).
--
-- PROPOSED — do not apply without explicit approval.
--
-- An append-only record of SMS consent captured at the point of collection,
-- stored SEPARATELY from any contact's telephone number and never inferred
-- from the presence of a phone value. One row per applicable form submission
-- that displayed the disclosure: `sms_consent` = true (opted in) or false
-- (shown the disclosure and declined). This does not create consent for any
-- existing contact — only new submissions write here.
--
-- Server-authoritative: the API sets `sms_consent_at` (server time, only when
-- true), the fixed `sms_consent_version`, the `source_form` + `source_url`,
-- and the exact `disclosure_text`. Client-supplied consent metadata is never
-- trusted. No SMS is sent by anything here.
--
-- Additive + idempotent. Does not touch existing tables, the phone columns on
-- applications/leads, or the admin auth system.

create table if not exists public.sms_consents (
  id uuid primary key default gen_random_uuid(),
  -- Where the consent was collected (server-set, bounded).
  source_form text not null,
  source_url text not null,
  -- Linking identity + the number the consent applies to. The phone here is
  -- the record of WHAT was consented, not the BASIS for consent.
  email text,
  phone text,
  -- The consent decision and its evidence.
  sms_consent boolean not null,
  sms_consent_at timestamptz,
  sms_consent_version text not null,
  disclosure_text text not null,
  -- Per-submission idempotency token (client-generated, reused across retries
  -- of the same submit). Nullable; when present it is unique so a retried
  -- request de-duplicates to one append-only row. See the unique index below.
  submission_id text,
  created_at timestamptz not null default now(),
  -- A timestamp may exist only for an affirmative opt-in.
  constraint sms_consents_at_only_when_true
    check (sms_consent = true or sms_consent_at is null)
);

create index if not exists sms_consents_email_idx on public.sms_consents (lower(email));
create index if not exists sms_consents_created_idx on public.sms_consents (created_at desc);
-- Retry-safe: at most one evidence row per submission token. NULLs are allowed
-- to repeat (a partial unique index), so tokenless callers still append freely.
create unique index if not exists sms_consents_submission_id_key
  on public.sms_consents (submission_id)
  where submission_id is not null;

-- Private by construction: RLS on with NO policies, so no anon/authenticated
-- client can ever read or write. Only the server's service-role client (which
-- bypasses RLS) inserts rows; consent records are never publicly exposed.
alter table public.sms_consents enable row level security;
revoke all on public.sms_consents from anon, authenticated;
