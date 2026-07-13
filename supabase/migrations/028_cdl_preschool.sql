-- 028_cdl_preschool.sql
-- CDL Pre-School Founding Student campaign (Milestone: Pre-School integration).
--
-- ⚠️ COMMITTED BUT NOT APPLIED. Additive only — creates two new tables and one
-- history table. Touches nothing that exists. Until this migration is applied,
-- the public wall renders its clean empty state (20 spots available) and the
-- claim API returns a friendly "claims aren't open yet" error.
--
-- DELIBERATELY SEPARATE from the Trucking Life Academy Founders Wall:
-- `campaign_settings` is a hard singleton (id boolean pk check(id)) and
-- `campaign_progress` counts every public `founders` row, so reusing those
-- tables would corrupt the $7,100 Academy campaign. The Pre-School campaign
-- gets its own tables and never joins the Academy ones.
--
-- Privacy model (two tables, hard separation):
--   * preschool_founding_claims  — PRIVATE intake. Holds purchaser email and
--     verification state. RLS enabled with NO policies: anon and authenticated
--     see nothing; only the service role (server routes + admin) touches it.
--   * preschool_founding_students — PUBLIC wall. No email, no order data, no
--     payment data — the columns the wall renders and nothing else. Rows are
--     created only by the admin approval action after manually verifying the
--     purchase against Stan Store records.
--
-- Rollback (manual, destructive — only if the feature is abandoned):
--   drop table public.preschool_claim_history;
--   drop table public.preschool_founding_students;
--   drop table public.preschool_founding_claims;
--   drop function public.preschool_enforce_capacity();

-- ---------------------------------------------------------------------------
-- 1. Private claim intake
-- ---------------------------------------------------------------------------
create table public.preschool_founding_claims (
  id uuid primary key default gen_random_uuid(),
  -- Private: used only to verify the purchase against Stan Store records.
  purchaser_email text not null check (char_length(purchaser_email) <= 200),
  display_name text not null check (char_length(display_name) between 2 and 80),
  is_anonymous boolean not null default false,
  business_name text check (char_length(business_name) <= 120),
  website_url text check (char_length(website_url) <= 300),
  -- The purchaser's own confirmations from the claim form.
  confirmed_checkout boolean not null default false,
  consent_public_display boolean not null default false,
  -- Moderation state. Nothing publishes automatically.
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Set by the admin after manually comparing purchaser_email with Stan Store.
  verified_purchase boolean not null default false,
  admin_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preschool_claims_status_idx
  on public.preschool_founding_claims (status, created_at desc);

-- One live pending claim per email (case-insensitive): resubmitting while a
-- claim awaits review is rejected at the DB even if the route check races.
create unique index preschool_claims_pending_email_uidx
  on public.preschool_founding_claims (lower(purchaser_email))
  where status = 'pending';

create trigger set_updated_at
  before update on public.preschool_founding_claims
  for each row execute function public.tlws_set_updated_at();

-- Locked: RLS on, zero policies. Service role only (it bypasses RLS).
alter table public.preschool_founding_claims enable row level security;
revoke all on public.preschool_founding_claims from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Public Founding Student Wall
-- ---------------------------------------------------------------------------
create table public.preschool_founding_students (
  id uuid primary key default gen_random_uuid(),
  -- Provenance link back to the private claim; never exposed publicly.
  claim_id uuid references public.preschool_founding_claims (id) on delete set null,
  -- Founding spot 1..20, assigned by the admin. Unique: no shared spots.
  spot_number integer unique check (spot_number between 1 and 20),
  display_name text not null check (char_length(display_name) between 1 and 80),
  is_anonymous boolean not null default false,
  business_name text check (char_length(business_name) <= 120),
  website_url text check (char_length(website_url) <= 300),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index preschool_students_published_idx
  on public.preschool_founding_students (is_published, spot_number)
  where is_published;

create trigger set_updated_at
  before update on public.preschool_founding_students
  for each row execute function public.tlws_set_updated_at();

-- Hard capacity: the wall can never hold more than 20 rows, whatever the
-- application layer does. (spot_number's 1..20 unique check already caps
-- numbered rows; this trigger caps the row count itself.)
create or replace function public.preschool_enforce_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.preschool_founding_students) >= 20 then
    raise exception 'Founding Student capacity (20) reached';
  end if;
  return new;
end;
$$;
revoke execute on function public.preschool_enforce_capacity() from anon, authenticated;

create trigger enforce_capacity
  before insert on public.preschool_founding_students
  for each row execute function public.preschool_enforce_capacity();

-- Public read of published rows only; zero public writes.
alter table public.preschool_founding_students enable row level security;
create policy anon_read_preschool_students
  on public.preschool_founding_students
  for select to anon
  using (is_published);
grant select on public.preschool_founding_students to anon;
revoke insert, update, delete on public.preschool_founding_students from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Moderation audit history
-- ---------------------------------------------------------------------------
create table public.preschool_claim_history (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.preschool_founding_claims (id) on delete cascade,
  action text not null check (
    action in ('approve', 'reject', 'publish', 'unpublish', 'edit', 'assign-spot', 'verify-purchase')
  ),
  admin text not null,
  changed_fields jsonb not null default '{}',
  note text,
  created_at timestamptz not null default now()
);

create index preschool_history_claim_idx
  on public.preschool_claim_history (claim_id, created_at desc);

-- Locked like the claims table: audit trail is admin-only.
alter table public.preschool_claim_history enable row level security;
revoke all on public.preschool_claim_history from anon, authenticated;
