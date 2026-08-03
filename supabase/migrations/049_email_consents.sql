-- 049: Email subscription evidence — consent in, consent out, status derived.
--
-- PROPOSED — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Not applied as of this commit. `EMAIL_CONSENT_RECORDING_ENABLED` in
-- src/lib/leads/email-consent.ts is false, so nothing writes here yet and the
-- absence of these objects breaks nothing.
--
-- THREE OBJECTS, ONE IDEA: the answer to "may we email this person?" is
-- DERIVED FROM EVIDENCE, never stored as a flag somebody can set.
--
--   public.email_consents            append-only. Someone was shown a
--                                    disclosure and said yes (or no).
--   public.email_unsubscribes        append-only. Someone asked to stop.
--   public.email_subscription_status a view. Latest evidence wins.
--
-- A stored boolean was the obvious alternative and is the thing to avoid. A
-- flag can be written by code that has no evidence behind it, can be flipped
-- by an unrelated form the way `leads` columns were being flipped before this
-- work, and — once it disagrees with the log — gives no way to tell which of
-- the two is lying. A view cannot disagree with the evidence, because it IS
-- the evidence, read in one direction.
--
-- LATEST WINS, TIES FAIL CLOSED. Someone may unsubscribe and later sign up
-- again; both are real, and the newer one is the current instruction. When a
-- consent and an unsubscribe carry the SAME instant, the unsubscribe wins —
-- the cost of wrongly not sending is an email nobody gets, and the cost of
-- wrongly sending is mailing a person who told us to stop.
--
-- NOTHING HERE IS RETROACTIVE. Addresses captured before this ships have no
-- rows in either table and therefore do not appear in the view at all. That is
-- correct: no disclosure was recorded for them, so no evidence exists to
-- write, and their absence must read as "not sendable" rather than as
-- "subscribed". See the view comment — absence is a decision, not a gap.
--
-- NO NETWORK IDENTIFIERS anywhere in this migration. No IP, no user agent,
-- matching `sms_consents` (046), the approved evidence model. Adding them
-- would be a privacy expansion needing its own review and a privacy-policy
-- update.
--
-- No email is sent by anything here. Additive and idempotent; touches no
-- existing table.

-- =========================================================================
-- 1. CONSENT IN — append-only
-- =========================================================================
-- One row per form submission that displayed the disclosure. `email_consent`
-- = true (opted in) or false (was shown the disclosure and declined). A
-- decline is evidence too: it is the difference between "said no" and "was
-- never asked", and only the log can tell those apart.
--
-- Deliberately separate from `sms_consents` (046): two different regimes, two
-- different retention and deletion stories, and one shared table would make
-- "delete my SMS consent" ambiguous about email rows.
--
-- Server-authoritative. The API sets `email_consent_at` (server clock, only
-- for an affirmative opt-in), the fixed `email_consent_version`, the
-- `source_form`, `source_url`, and the exact `disclosure_text`.
-- Client-supplied consent metadata is never trusted.

create table if not exists public.email_consents (
  id uuid primary key default gen_random_uuid(),

  -- Where the consent was collected. Bounded by a server-side allowlist.
  source_form text not null,
  source_url  text not null,

  -- The address the consent applies to.
  --
  -- Intentionally NOT a foreign key to public.leads: evidence must survive the
  -- deletion of the lead it describes, which an ON DELETE CASCADE would
  -- destroy — the opposite of what a compliance record is for.
  --
  -- Normalization is enforced below rather than assumed. The API lowercases at
  -- the parse boundary, but "the current code does it" is not a property of
  -- the data; a second writer that forgets would split one person's history
  -- across two spellings and quietly hide half their evidence from the view.
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
    check (length(btrim(email_consent_version)) > 0),

  -- One spelling per address, guaranteed by the database.
  constraint email_consents_email_normalized
    check (email = lower(btrim(email)) and length(email) > 0)
);

comment on table public.email_consents is
  'Append-only email-consent evidence. One row per form submission that displayed the disclosure. Separate from sms_consents by design. No IP, no user agent. Never written retroactively.';
comment on column public.email_consents.disclosure_text is
  'The EXACT wording shown to the person at collection time. Stored verbatim so the row proves what was actually agreed to, not what the current code says.';
comment on column public.email_consents.email_consent_version is
  'Version of disclosure_text. Incremented in the same commit as any wording edit — the pair is what makes the row evidence.';
comment on column public.email_consents.email is
  'Lowercased, trimmed address, enforced by check constraint. Deliberately NOT a FK to public.leads: evidence must outlive the lead record it describes.';

create unique index if not exists email_consents_submission_id_key
  on public.email_consents (submission_id)
  where submission_id is not null;

-- Serves both the per-address history read (a subject-access or deletion
-- request) and the view's latest-per-address scan.
create index if not exists email_consents_email_created_idx
  on public.email_consents (email, created_at desc);

-- =========================================================================
-- 2. CONSENT OUT — append-only
-- =========================================================================
-- Why a second table rather than a row in the first: a consent row must carry
-- the disclosure wording and version that make it evidence, and an unsubscribe
-- has no disclosure. Forcing them together would mean either NOT NULL columns
-- that unsubscribes cannot honestly fill, or dropping those constraints and
-- weakening the consent evidence to accommodate its opposite.
--
-- No prior consent row is required. Someone can ask to stop because a friend
-- forwarded them an email, because they were on the list before any of this
-- existed, or because they simply do not want it — and a system that could not
-- record that instruction without a matching opt-in would be refusing the one
-- request it must always honour.

create table if not exists public.email_unsubscribes (
  id uuid primary key default gen_random_uuid(),

  -- Same rules as email_consents.email: not a FK, normalization enforced.
  email text not null,

  -- How the request arrived. Bounded so the set stays reviewable; extending it
  -- is a migration, which is the point — a new opt-out path deserves a look.
  --   link      the unsubscribe link in an email footer
  --   one-click RFC 8058 List-Unsubscribe-Post, actioned by the mail client
  --   reply     they replied asking to stop; recorded by hand
  --   complaint a spam report relayed by the sending provider
  --   manual    any other owner-recorded request, explained in `note`
  method text not null,

  -- Free text for the `reply` and `manual` paths, where the instruction
  -- arrived as prose and the row should say where it came from. Never used to
  -- store anything the person did not send us.
  note text,

  -- Per-request idempotency token. A double-clicked unsubscribe link is one
  -- instruction, not two.
  submission_id text,

  created_at timestamptz not null default now(),

  constraint email_unsubscribes_email_normalized
    check (email = lower(btrim(email)) and length(email) > 0),

  constraint email_unsubscribes_method_known
    check (method in ('link', 'one-click', 'reply', 'complaint', 'manual'))
);

comment on table public.email_unsubscribes is
  'Append-only record of requests to stop receiving email. No prior consent row is required — an opt-out must always be recordable. No IP, no user agent.';
comment on column public.email_unsubscribes.created_at is
  'When the instruction was received. This is the event time; there is no separate timestamp to disagree with it.';
comment on column public.email_unsubscribes.method is
  'How the request arrived. Bounded by check constraint so adding an opt-out path requires a reviewed migration.';

create unique index if not exists email_unsubscribes_submission_id_key
  on public.email_unsubscribes (submission_id)
  where submission_id is not null;

create index if not exists email_unsubscribes_email_created_idx
  on public.email_unsubscribes (email, created_at desc);

-- =========================================================================
-- 3. CURRENT STATUS — derived, never stored
-- =========================================================================
-- `distinct on` picks the newest row per address; the `id` tiebreak makes that
-- choice deterministic when two rows share a timestamp, so the same evidence
-- always yields the same answer.

create or replace view public.email_subscription_status
with (security_invoker = on) as
with latest_consent as (
  select distinct on (email)
    email,
    email_consent as granted,
    created_at    as at
  from public.email_consents
  order by email, created_at desc, id desc
),
latest_unsubscribe as (
  select distinct on (email)
    email,
    created_at as at,
    method
  from public.email_unsubscribes
  order by email, created_at desc, id desc
)
select
  coalesce(c.email, u.email) as email,
  c.at                       as last_consent_at,
  c.granted                  as last_consent_granted,
  u.at                       as last_unsubscribe_at,
  u.method                   as last_unsubscribe_method,

  -- The whole point of this migration, in one expression. Strict `>` is the
  -- fail-closed tiebreak described at the top of this file.
  (c.granted is true and (u.at is null or c.at > u.at)) as is_subscribed,

  case
    when c.granted is true and (u.at is null or c.at > u.at) then 'subscribed'
    when u.at is not null and (c.at is null or u.at >= c.at) then 'unsubscribed'
    when c.granted is false                                  then 'declined'
    -- Unreachable: email_consents.email_consent is NOT NULL, so a row in
    -- `latest_consent` is always true or false, and the full outer join
    -- guarantees at least one side is present. Kept so an unexpected state
    -- surfaces as a visible label rather than a silent NULL.
    else 'unknown'
  end as status
from latest_consent c
full outer join latest_unsubscribe u on u.email = c.email;

comment on view public.email_subscription_status is
  'Current email subscription state, derived from append-only evidence. Latest instruction wins; a tie resolves to unsubscribed. AN ADDRESS ABSENT FROM THIS VIEW HAS NO EVIDENCE AND IS NOT SENDABLE — absence means no recorded consent, not consent. Any send must check is_subscribed here; never read a flag on public.leads for this.';
comment on column public.email_subscription_status.is_subscribed is
  'True only when an affirmative consent is the most recent instruction. Equal timestamps resolve to false.';
comment on column public.email_subscription_status.status is
  'subscribed | unsubscribed | declined. "declined" means shown the disclosure and said no, which is not the same as having unsubscribed.';

-- ── RLS / least privilege ────────────────────────────────────────────────
-- Default-deny with no policies: no policy match = zero rows, for anon and
-- authenticated alike. The API writes with the service role, which bypasses
-- RLS by design, so no policy is needed for the write path either.
alter table public.email_consents     enable row level security;
alter table public.email_unsubscribes enable row level security;

-- No GRANTs to anon or authenticated. A consent log is not public data and no
-- signed-in user has a reason to read anyone's row — including their own,
-- which the API can serve without exposing the table. Granting SELECT here
-- would widen access with no consumer asking for it.
revoke all on public.email_consents             from anon, authenticated;
revoke all on public.email_unsubscribes         from anon, authenticated;
revoke all on public.email_subscription_status  from anon, authenticated;

-- APPEND-ONLY, enforced by privilege rather than convention: even the service
-- role cannot UPDATE or DELETE. Evidence that can be edited is not evidence.
-- Retention pruning, if it is ever wanted, must arrive as its own reviewed
-- migration with a SECURITY DEFINER function — not as an ambient permission.
grant insert, select on public.email_consents     to service_role;
grant insert, select on public.email_unsubscribes to service_role;
revoke update, delete, truncate on public.email_consents     from service_role;
revoke update, delete, truncate on public.email_unsubscribes from service_role;

-- Read-only by nature, and `security_invoker = on` means it is read under the
-- caller's own permissions rather than the view owner's — so the view cannot
-- become a way around the revokes above.
grant select on public.email_subscription_status to service_role;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- Safe while unapplied and while both tables are empty. If rows exist they are
-- compliance evidence: export them before running this, because dropping the
-- tables destroys the only proof of what those people agreed to — and, in the
-- unsubscribe table, the only proof of who asked us to stop. The guard below
-- refuses rather than trusting whoever runs it to have checked.
--
--   do $$
--   begin
--     if exists (select 1 from public.email_consents limit 1)
--        or exists (select 1 from public.email_unsubscribes limit 1) then
--       raise exception 'email evidence tables have rows — export before dropping';
--     end if;
--   end $$;
--
--   drop view  if exists public.email_subscription_status;
--   drop index if exists public.email_unsubscribes_email_created_idx;
--   drop index if exists public.email_unsubscribes_submission_id_key;
--   drop table if exists public.email_unsubscribes;
--   drop index if exists public.email_consents_email_created_idx;
--   drop index if exists public.email_consents_submission_id_key;
--   drop table if exists public.email_consents;
