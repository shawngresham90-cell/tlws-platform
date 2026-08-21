-- Migration 057: an authoritative term for a paid featured listing.
--
-- PROPOSED — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Not applied as of this commit. The application ships a compatibility bridge
-- (src/lib/directory/data.ts) that detects the absence of `featured_until` and
-- keeps every public Directory surface on the pre-057 rule, so merging the code
-- before applying this file changes nothing a visitor can see. Featured
-- ACTIVATION is blocked until the column exists — see
-- docs/operations/revenue-2-featured-expiry.md for the ordered procedure.
--
-- NOTE: no CI/Netlify step applies files in this directory (verified against
-- .github/workflows/ci.yml and netlify.toml); this file is the repository
-- record of a guarded MCP application performed by the owner.
--
-- WHAT WAS WRONG
--
-- A paid featured listing was `locations.is_featured = true` and nothing else.
-- The term the business actually bought lived in `sponsors.notes` and
-- `sponsors.next_action_date`, which no public read consults. So after the paid
-- period ended the listing kept:
--
--   * its Sponsored badge on every card and its detail page,
--   * its featured-first position on category and corridor pages,
--   * its featured map treatment,
--   * and its slot against the three-per-page capacity limit,
--
-- until a human remembered to untick it. "Term expired" and "placement hidden"
-- were two different events, and only the second one was visible to drivers.
-- Corridor sponsors never had this defect: `directory_sponsors` has carried a
-- real `starts_at`/`ends_at` window since migration 024, filtered on render.
--
-- WHAT THIS DOES
--
-- Adds ONE column. Public eligibility becomes `is_featured AND now <
-- featured_until` (plus the published/not-deleted/not-held rules that already
-- applied), evaluated on read. Expiration therefore needs no cron, no job and
-- no write at the moment it happens — the row simply stops qualifying.
--
-- There is deliberately no `featured_starts_at`. Reproduced against the real
-- action on main at 9d339fb: activation writes `is_featured = true` immediately
-- and the public path has no date to consult, so a future start date was
-- already a fiction. Rather than teach every surface a second date, activation
-- now refuses a future start and derives the window from the moment of
-- activation. See src/lib/directory/featured-window.ts for the reasoning.
--
-- SAFETY
--
--   * Additive. One nullable column, one CHECK, one partial index.
--   * Writes no data values. No row is featured, unfeatured or otherwise
--     modified. The post-conditions below fail the transaction if any row's
--     `is_featured` changed during the migration.
--   * No default. A default timestamp would silently give every future row a
--     term nobody agreed; a default of now() would be worse still.
--   * No RLS change, no grant change, no policy change. Migration 054's public
--     API surface lockdown is untouched.
--   * Verified against live production before writing: `public.locations` has
--     ZERO rows with `is_featured = true`, so the CHECK below is satisfied by
--     every existing row and validates without a rewrite.
--
-- ROLLBACK
--
--   alter table public.locations drop constraint locations_featured_term_check;
--   drop index if exists public.locations_featured_active_idx;
--   alter table public.locations drop column featured_until;
--
-- Do NOT run that rollback while any row has `is_featured = true` with a
-- `featured_until` in the future: dropping the column destroys the record of a
-- term a business paid for, and the application would fall back to treating
-- that placement as open-ended. Stop the placements first, or prefer a
-- corrective migration. See the operations doc.

begin;

-- Drift guard: abort if any target object already exists (fail-closed).
do $guard$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'locations'
               and column_name in ('featured_until', 'featured_starts_at')) then
    raise exception 'schema drift: a featured-term column already exists on public.locations';
  end if;
  if exists (select 1 from pg_constraint
             where conrelid = 'public.locations'::regclass
               and conname = 'locations_featured_term_check') then
    raise exception 'schema drift: locations_featured_term_check already exists';
  end if;
  if exists (select 1 from pg_indexes
             where schemaname = 'public' and tablename = 'locations'
               and indexname = 'locations_featured_active_idx') then
    raise exception 'schema drift: locations_featured_active_idx already exists';
  end if;
end
$guard$;

-- The instant a paid featured placement stops being public. NULL means "no
-- term recorded", which the application treats as a fault and refuses to
-- display — never as "runs forever".
alter table public.locations
  add column featured_until timestamptz;

comment on column public.locations.featured_until is
  'End of the paid featured term. Public featured treatment requires is_featured AND now() < featured_until. NULL with is_featured true is a fault: the application withholds the placement rather than treating it as open-ended. Set only by the admin placement actions, never by import.';

-- A featured row must carry a term.
--
-- Deliberately NOT written with now() — a CHECK constraint must be immutable,
-- and one that consulted the clock would re-evaluate on every future UPDATE and
-- start rejecting writes to rows whose term had merely passed. This says only
-- "if it is featured, somebody recorded when it ends". Whether that instant is
-- in the past is a question for the read path, which is where expiry belongs.
--
-- Existing rows: verified zero `is_featured = true` in production before this
-- was written, so this validates immediately.
alter table public.locations
  add constraint locations_featured_term_check
    check (not is_featured or featured_until is not null);

-- Serves the capacity counts and the featured-first read on the two surfaces a
-- featured listing appears on. Partial on the flag rather than on the clock:
-- a predicate containing now() is not immutable and cannot index.
--
-- Justified rather than speculative: `locations_pub_cat_featured` already
-- indexes (category_slug, is_published, is_featured DESC, name) for ordering,
-- but capacity now asks a different question — "which rows are featured AND
-- still in term, on this category or this corridor" — and answers it on every
-- activation and every admin console load. The featured set is tiny (0 today,
-- a hard ceiling of 3 per surface), so this index stays small.
create index locations_featured_active_idx
  on public.locations (category_slug, interstate, featured_until)
  where is_featured = true and deleted_at is null;

-- Post-conditions (fail-closed).
do $verify$
declare
  featured_count integer;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'locations'
                   and column_name = 'featured_until'
                   and data_type = 'timestamp with time zone') then
    raise exception 'post-condition failed: featured_until missing or not timestamptz';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'locations'
               and column_name = 'featured_until'
               and column_default is not null) then
    raise exception 'post-condition failed: featured_until acquired a default';
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.locations'::regclass
                   and conname = 'locations_featured_term_check') then
    raise exception 'post-condition failed: locations_featured_term_check missing';
  end if;
  -- Nothing became featured, and nothing that was featured stopped being so.
  select count(*) into featured_count from public.locations where is_featured = true;
  if featured_count <> 0 then
    raise exception
      'post-condition failed: expected 0 featured rows (the verified pre-state), found %. Re-run the reconciliation in docs/operations/revenue-2-featured-expiry.md before applying.',
      featured_count;
  end if;
  if exists (select 1 from public.locations where featured_until is not null) then
    raise exception 'post-condition failed: a featured_until value appeared during migration';
  end if;
end
$verify$;

commit;
