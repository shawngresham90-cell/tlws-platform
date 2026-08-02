-- 049: Email consent evidence log.
--
-- PROPOSED — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Not applied as of this commit. `EMAIL_CONSENT_RECORDING_ENABLED` in
-- src/lib/leads/email-consent.ts is false, so nothing writes here yet and the
-- absence of this table breaks nothing.
--
-- An append-only record of EMAIL consent captured at the point of collection.
-- Deliberately separate from `sms_consents` (migration 046): two different
-- regimes, two different retention and deletion stories, and one shared table
-- would make "delete my SMS consent" ambiguous about email rows. One row per
-- form submission that displayed the disclosure — `email_consent` = true
-- (opted in) or false (was shown the disclosure and declined).
--
-- This creates consent for NOBODY retroactively. Existing leads captured before
-- this ships have no row here, and that is correct: no disclosure was recorded
-- for them, so no evidence exists to write.
--
-- Server-authoritative. The API sets `email_consent_at` (server clock, only for
-- an affirmative opt-in), the fixed `email_consent_version`, the `source_form`,
-- `source_url`, and the exact `disclosure_text`. Client-supplied consent
-- metadata is never trusted.
--
-- NO NETWORK IDENTIFIERS. No IP, no user agent — matching `sms_consents`, the
-- approved evidence model. Adding them would be a privacy expansion requiring
-- its own review and a privacy-policy update.
--
-- No email is sent by anything here. Additive and idempotent; touches no
-- existing table.

create table if not exists public.email_consents (
  id uuid primary key default gen_random_uuid(),

  -- Where the consent was collected. Bounded by a server-side allowlist.
  source_form text not null,
  source_url  text not null,

  -- The address the consent applies to, normalized lowercase by the API.
  -- Intentionally NOT a foreign key to public.leads: evidence must survive the
  -- deletion of the lead it describes, which an ON DELETE CASCADE would
  -- destroy — the opposite of what a compliance record is for.
  email text not null,

  -- The decision and its evidence.
  email_consent         boolean not null,
  email_consent_at      timestamptz,
  email_consent_version text not null,
  disclosure_text       text not null,

  -- Per-submission idempotency token (client-generated, reused across retries
  -- of the same submit). Nullable; unique when present, so a retried request
  -- de-duplicates to one append-only row instead of stacking duplicates.
  submission_id text,

  created_at timestamptz not null default now(),

  -- A timestamp may exist only for an affirmative opt-in. A decline carrying a
  -- consent time would imply a moment of agreement that never happened.
  constraint email_consents_at_only_when_true
    check ((email_consent_at is null) or (email_consent = true)),

  -- Evidence with empty wording proves nothing.
  constraint email_consents_disclosure_not_blank
    check (length(btrim(disclosure_text)) > 0),
  constraint email_consents_version_not_blank
    check (length(btrim(email_consent_version)) > 0)
);

comment on table public.email_consents is
  'Append-only email-consent evidence. One row per form submission that displayed the disclosure. Separate from sms_consents by design. No IP, no user agent. Never written retroactively.';
comment on column public.email_consents.disclosure_text is
  'The EXACT wording shown to the person at collection time. Stored verbatim so the row proves what was actually agreed to, not what the current code says.';
comment on column public.email_consents.email_consent_version is
  'Version of disclosure_text. Incremented in the same commit as any wording edit — the pair is what makes the row evidence.';
comment on column public.email_consents.email is
  'Normalized lowercase address. Deliberately NOT a FK to public.leads: evidence must outlive the lead record it describes.';

create unique index if not exists email_consents_submission_id_key
  on public.email_consents (submission_id)
  where submission_id is not null;

-- Lookup by address for a subject-access or deletion request.
create index if not exists email_consents_email_idx
  on public.email_consents (lower(email));

-- ── RLS / least privilege ────────────────────────────────────────────────
-- Default-deny with no policies: no policy match = zero rows, for anon and
-- authenticated alike. The API writes with the service role, which bypasses
-- RLS by design, so no policy is needed for the write path either.
alter table public.email_consents enable row level security;

-- No GRANTs to anon or authenticated. A consent log is not public data and no
-- signed-in user has a reason to read anyone's row — including their own,
-- which the API can serve without exposing the table. Granting SELECT here
-- would widen access with no consumer asking for it.
revoke all on public.email_consents from anon, authenticated;

-- APPEND-ONLY, enforced by privilege rather than convention: even the service
-- role cannot UPDATE or DELETE. Evidence that can be edited is not evidence.
-- Retention pruning, if it is ever wanted, must arrive as its own reviewed
-- migration with a SECURITY DEFINER function — not as an ambient permission.
grant insert, select on public.email_consents to service_role;
revoke update, delete, truncate on public.email_consents from service_role;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- Safe while unapplied and while the table is empty. If rows exist they are
-- compliance evidence: export them before running this, because dropping the
-- table destroys the only proof of what those people agreed to.
--
--   do $$
--   begin
--     if exists (select 1 from public.email_consents limit 1) then
--       raise exception 'email_consents has rows — export evidence before dropping';
--     end if;
--   end $$;
--
--   drop index if exists public.email_consents_email_idx;
--   drop index if exists public.email_consents_submission_id_key;
--   drop table if exists public.email_consents;
