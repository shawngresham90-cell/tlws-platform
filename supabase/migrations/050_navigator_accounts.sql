-- 050: Navigator driver accounts — identity, and the four things worth keeping.
--
-- PROPOSED — DO NOT APPLY WITHOUT EXPLICIT APPROVAL, and do not apply from a
-- feature branch. Nothing writes here until NAVIGATOR_ACCESS_MODE=account, and
-- that mode is not switched on by the change that adds this file.
--
-- DEPENDS ON 049. Marketing consent is NOT stored here. It lives in the
-- append-only evidence log from 049_email_consents.sql, and the answer to "may
-- we email this driver?" is read from `public.email_subscription_status`. That
-- migration is written but NOT YET APPLIED, so applying this one without it
-- leaves the signup flow unable to record consent. Apply 049 first.
--
-- WHY NOT A BOOLEAN ON THE PROFILE. It was specified that way, and it is the
-- obvious design, and 049 spent two pages explaining why this codebase does
-- not do it: a flag can be written by code that has no evidence behind it,
-- and once it disagrees with the log there is no way to tell which is lying.
-- `sms_consents` is already live with real rows on that model. A second,
-- contradictory consent model in the same database would make "did this person
-- agree?" a question with two answers.
--
-- So this migration stores IDENTITY and STATE. Consent is evidence, elsewhere.
--
-- TWO TABLES, DIFFERENT LIFETIMES:
--
--   navigator_profiles  one row per driver. Who they are.
--   navigator_state     up to four rows per driver. What they set up.
--
-- They are separate because they are deleted differently in practice and
-- because the state rows are opaque payloads the database has no business
-- validating field-by-field, while the profile is structured identity that
-- benefits from constraints.
--
-- Additive and idempotent. Touches no existing table. Does not alter the admin
-- auth system, the pilot gate, or anything the Trip Planner owns.

-- =========================================================================
-- 1. THE DRIVER
-- =========================================================================
-- `user_id` is BOTH the primary key and the foreign key. One profile per
-- account, enforced structurally rather than by a unique index that a second
-- insert path could forget.

create table if not exists public.navigator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- What the Navigator calls them. First name only: the greeting says "Morning,
  -- Shawn", and nothing in this product needs a legal name.
  first_name text not null,

  -- A denormalized copy of auth.users.email, kept because the marketing export
  -- must be able to name an address without reading the auth schema, and
  -- because a driver may change their email in a later milestone without the
  -- consent evidence (which is keyed by address) silently re-pointing.
  --
  -- Normalization enforced at the database, matching email_consents: one
  -- spelling per address is a property of the data, not of the current code.
  email text not null,

  -- Optional. Stored as entered AND as digits, because the entered form is
  -- what the driver recognizes on screen and the digit form is what a CSV
  -- import and a de-duplication actually need.
  phone text,
  phone_e164 text,

  -- What they accepted, and which wording they accepted.
  --
  -- terms_accepted_at is NULLABLE and expected to stay null for now: this
  -- platform has no Terms of Service page. The column exists so that adding
  -- one later is a copy change and a backfill decision rather than a
  -- migration, and so the absence is visible rather than implied.
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz not null,
  consent_copy_version text not null,

  signup_source text not null default 'navigator',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint navigator_profiles_first_name_not_blank
    check (length(btrim(first_name)) > 0 and length(first_name) <= 80),

  -- Same rule as public.email_consents.email, deliberately identical: these
  -- two are joined by address in the marketing export, and a join between two
  -- differently-normalized columns silently loses people.
  constraint navigator_profiles_email_normalized
    check (email = lower(btrim(email)) and length(email) > 0 and length(email) <= 320),

  -- Digits only, plausible length. Not a claim that the number is reachable —
  -- only that it is not prose.
  constraint navigator_profiles_phone_e164_shape
    check (phone_e164 is null or phone_e164 ~ '^\+?[1-9][0-9]{7,14}$'),

  -- A parsed number cannot exist without the raw one it was parsed from.
  constraint navigator_profiles_phone_pairing
    check (phone_e164 is null or phone is not null),

  constraint navigator_profiles_consent_version_not_blank
    check (length(btrim(consent_copy_version)) > 0),

  constraint navigator_profiles_signup_source_known
    check (signup_source in ('navigator', 'admin', 'import'))
);

comment on table public.navigator_profiles is
  'One row per Navigator driver account. Identity and acceptance only. Marketing consent is NOT here — it is append-only evidence in email_consents/sms_consents, read through email_subscription_status. Never expose this table publicly; there is no anon policy and there must never be one.';
comment on column public.navigator_profiles.email is
  'Lowercased, trimmed. Normalization matches public.email_consents.email exactly, because the marketing export joins the two by address.';
comment on column public.navigator_profiles.terms_accepted_at is
  'Null until a Terms of Service page exists. The signup screen currently asks a driver to accept the Privacy Policy only, and records nothing it did not actually show them.';
comment on column public.navigator_profiles.consent_copy_version is
  'Version of the acceptance wording shown at signup. Bumped in the same commit as any edit to that wording.';
comment on column public.navigator_profiles.phone_e164 is
  'Digit-normalized phone, or null. SMS consent evidence may not be recorded without one — enforced in the application, because the consent row lives in another table.';

create index if not exists navigator_profiles_email_idx
  on public.navigator_profiles (email);
create index if not exists navigator_profiles_created_idx
  on public.navigator_profiles (created_at desc);

drop trigger if exists set_updated_at on public.navigator_profiles;
create trigger set_updated_at before update on public.navigator_profiles
  for each row execute function public.tlws_set_updated_at();

-- =========================================================================
-- 2. THE SETUP
-- =========================================================================
-- Four domains, one row each, so a corrupt clock record cannot cost a driver
-- the truck they verified. That independence is the same property the local
-- versioned-storage layer was built for, and syncing them into one blob would
-- throw it away.
--
-- WHAT MAY NEVER GO IN HERE — the list is enforced by a check constraint on
-- `domain` and by a test that reads this file:
--   no position, no position history, no destination, no search text,
--   no route, no geometry, no turn-by-turn record, no provider response.
-- A driver's location is not account data. It is not stored server-side at
-- all, and the only way to keep that true is to have nowhere to put it.

create table if not exists public.navigator_state (
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The four syncable domains. Bounded by check constraint so adding a fifth
  -- is a reviewed migration — which is the point, because the review is where
  -- someone asks whether the new domain contains a location.
  domain text not null,

  -- The record itself, exactly as the local versioned-storage layer holds it.
  -- Opaque on purpose: the shape is owned by the client parser that already
  -- validates it, and duplicating that shape here would create a second
  -- definition to keep in step.
  payload jsonb not null,

  -- The local record's schema version, carried through so a client reading
  -- cloud state can reject a payload it does not understand instead of
  -- coercing it.
  payload_version integer not null,

  -- The conflict rail. Last write wins PER DOMAIN, by this column, and the
  -- client refuses to upload a payload older than the one already here — so
  -- "newer replaced by older" cannot happen even if two devices race.
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  primary key (user_id, domain),

  constraint navigator_state_domain_known
    check (domain in ('truck', 'route_prefs', 'hos_clocks', 'onboarding')),

  constraint navigator_state_payload_is_object
    check (jsonb_typeof(payload) = 'object'),

  -- A bound, not a target. The four real payloads are a few hundred bytes;
  -- anything approaching this is a bug or an abuse, and the database should
  -- refuse it rather than store it.
  constraint navigator_state_payload_bounded
    check (pg_column_size(payload) <= 16384),

  constraint navigator_state_payload_version_sane
    check (payload_version >= 1 and payload_version <= 1000)
);

comment on table public.navigator_state is
  'User-owned Navigator setup: truck, route preferences, driver-entered HOS clocks, onboarding progress. NOTHING LOCATION-SHAPED MAY BE STORED HERE — no position, no destination, no search, no route, no movement history. The domain check constraint is the enforcement; widening it requires a reviewed migration.';
comment on column public.navigator_state.domain is
  'One of four. Separate rows so the domains fail independently — a corrupt clock record must not cost a driver the truck they verified.';
comment on column public.navigator_state.updated_at is
  'The conflict rail. Per-domain last-write-wins is resolved on this column, and the client will not upload a payload older than the stored one.';

create index if not exists navigator_state_user_idx
  on public.navigator_state (user_id);

drop trigger if exists set_updated_at on public.navigator_state;
create trigger set_updated_at before update on public.navigator_state
  for each row execute function public.tlws_set_updated_at();

-- =========================================================================
-- 3. ROW LEVEL SECURITY
-- =========================================================================
-- Ownership is derived from the session (auth.uid()) and NEVER from a
-- client-supplied value. Every policy is `to authenticated` — anon has no
-- policy on either table, and no policy match means zero rows, so an
-- unauthenticated caller reading these tables gets an empty set rather than
-- an error that would confirm they exist.
--
-- There is deliberately NO policy granting anyone read access to another
-- driver's row. Not for admins either: the admin dashboard uses a shared
-- password, not a Supabase identity, so an "admins can read all" policy would
-- have no principal to attach to. The marketing export reads with the service
-- role, which bypasses RLS by design and is server-only.
--
-- WITH CHECK on insert and update is what stops a driver writing a row that
-- belongs to someone else: `using` filters what they can see, `with check`
-- filters what they can leave behind. A policy with only `using` on an update
-- lets a caller move a row to another user_id on the way out.

alter table public.navigator_profiles enable row level security;
alter table public.navigator_state    enable row level security;

drop policy if exists navigator_profiles_select_own on public.navigator_profiles;
create policy navigator_profiles_select_own on public.navigator_profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists navigator_profiles_insert_own on public.navigator_profiles;
create policy navigator_profiles_insert_own on public.navigator_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists navigator_profiles_update_own on public.navigator_profiles;
create policy navigator_profiles_update_own on public.navigator_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No delete policy, on purpose. A driver deletes their ACCOUNT, not their
-- profile row: the row disappears through the cascade from auth.users. Letting
-- a client delete the profile alone would leave an account with no profile —
-- signed in, with nowhere to put their name.
drop policy if exists navigator_profiles_delete_own on public.navigator_profiles;

drop policy if exists navigator_state_select_own on public.navigator_state;
create policy navigator_state_select_own on public.navigator_state
  for select to authenticated using (user_id = auth.uid());

drop policy if exists navigator_state_insert_own on public.navigator_state;
create policy navigator_state_insert_own on public.navigator_state
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists navigator_state_update_own on public.navigator_state;
create policy navigator_state_update_own on public.navigator_state
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Deleting one's own state IS allowed: "forget my truck" is a reasonable
-- thing to want without deleting the whole account.
drop policy if exists navigator_state_delete_own on public.navigator_state;
create policy navigator_state_delete_own on public.navigator_state
  for delete to authenticated using (user_id = auth.uid());

-- Least privilege on top of RLS. `authenticated` gets exactly the verbs the
-- policies above describe; `anon` gets nothing at all on either table.
--
-- THE REVOKE MUST NAME `authenticated`, AND FOR A WHILE IT DID NOT.
--
-- A `grant` is additive, and on Supabase these tables do not start empty of
-- privileges. The project bootstrap runs
--
--   grant all on all tables in schema public to anon, authenticated, service_role;
--   alter default privileges in schema public grant all on tables to …;
--
-- so every new table in `public` arrives with ALL privileges already held by
-- `authenticated` — including DELETE, and including TRUNCATE. Granting the
-- three verbs we wanted therefore added nothing and removed nothing, and the
-- comment above described an intent the statements did not carry out.
--
-- TRUNCATE is the one that matters, because ROW LEVEL SECURITY DOES NOT APPLY
-- TO IT. Policies filter SELECT, INSERT, UPDATE and DELETE; `truncate` is a
-- table-level operation checked against the table privilege alone. A signed-in
-- driver holding TRUNCATE could therefore destroy EVERY driver's profile and
-- every driver's synced truck, route preferences and clocks in one statement —
-- while the same driver, going through the policies, cannot read or delete so
-- much as one other row. Verified on a real PostgreSQL, not reasoned about:
-- §8k–§8n of `scripts/test-live-postgres.mjs`.
--
-- Migration 051 already had this right (`revoke all … from anon, authenticated`).
-- 050 is brought into line here, and 052 repairs any project where the older
-- form was already applied.
revoke all on public.navigator_profiles from anon, authenticated;
revoke all on public.navigator_state    from anon, authenticated;
grant select, insert, update on public.navigator_profiles to authenticated;
grant select, insert, update, delete on public.navigator_state to authenticated;

-- =========================================================================
-- 4. THE MARKETING EXPORT SOURCE
-- =========================================================================
-- One view, so the CSV route cannot invent its own definition of "consented".
-- It joins identity (here) to evidence (049) on the normalized address, and a
-- driver appears ONLY when the evidence view says the latest instruction was
-- an opt-in. A profile with no evidence row does not appear — absence is not
-- consent, which is the rule 049 states and this view inherits by joining
-- rather than by defaulting.
--
-- security_invoker = on: read under the caller's own permissions, so the view
-- cannot become a way around the revokes below.

create or replace view public.navigator_marketing_contacts
with (security_invoker = on) as
select
  p.user_id,
  p.first_name,
  p.email,
  p.phone,
  p.phone_e164,
  p.created_at,
  s.last_consent_at
from public.navigator_profiles p
join public.email_subscription_status s on s.email = p.email
where s.is_subscribed is true;

comment on view public.navigator_marketing_contacts is
  'Drivers who may be emailed marketing: identity joined to append-only consent evidence, filtered to is_subscribed. A withdrawal recorded in email_unsubscribes removes a driver from this view on the next read, with no update to any profile row. Server/admin only — never granted to anon or authenticated.';

revoke all on public.navigator_marketing_contacts from anon, authenticated;
grant select on public.navigator_marketing_contacts to service_role;

-- =========================================================================
-- ROLLBACK
-- =========================================================================
-- navigator_state is derived data — a driver's phone still holds it locally,
-- so dropping it costs a re-sync, not the record. navigator_profiles is NOT
-- derived: dropping it destroys the link between an account and the consent
-- evidence that names it. Export before running this.
--
--   drop view  if exists public.navigator_marketing_contacts;
--   drop table if exists public.navigator_state;
--   drop table if exists public.navigator_profiles;
--
-- Dropping these does NOT delete the auth.users rows, and must not: a driver
-- who verified an email still has an account, and their consent evidence in
-- email_consents is independent of both by design.
