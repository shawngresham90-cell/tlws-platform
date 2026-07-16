-- 029_practice_tests_modes.sql
-- CDL Practice Tests foundation (Milestone 1).
--
-- ⚠️ COMMITTED BUT NOT APPLIED. Additive only — extends public.tests with the
-- mode config (Study / Timed), the passing threshold, ordering, and SEO fields
-- the public pages need. Touches no existing row and drops nothing. Until the
-- owner applies it, the Practice Tests pages render from the TS catalog
-- (src/lib/tests/catalog.ts) and fail soft to a "question bank coming soon"
-- state, so nothing breaks in the gap.
--
-- RLS is already correct from migration 010: anon reads published tests + their
-- questions, zero anon writes (011). New columns inherit the existing
-- anon_read_tests SELECT policy automatically — they are public metadata.
--
-- Rollback (manual, only if the feature is abandoned):
--   alter table public.tests
--     drop column if exists time_limit_seconds,
--     drop column if exists pass_threshold_pct,
--     drop column if exists sort_order,
--     drop column if exists endorsement_code,
--     drop column if exists icon,
--     drop column if exists meta_title,
--     drop column if exists meta_description,
--     drop column if exists intro_md,
--     drop column if exists related_kc_category_slug;

alter table public.tests
  add column if not exists time_limit_seconds int
    check (time_limit_seconds is null or time_limit_seconds > 0),
  add column if not exists pass_threshold_pct int not null default 80
    check (pass_threshold_pct between 1 and 100),
  add column if not exists sort_order int not null default 0,
  add column if not exists endorsement_code text
    check (endorsement_code is null or char_length(endorsement_code) <= 4),
  add column if not exists icon text,
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists intro_md text,
  add column if not exists related_kc_category_slug text;

comment on column public.tests.time_limit_seconds is
  'Timed-mode limit in seconds; null = untimed (Study mode only).';
comment on column public.tests.pass_threshold_pct is
  'Passing score percent. The CDL permit standard is 80.';
comment on column public.tests.sort_order is
  'Display order on the Practice Tests hub (ascending).';
comment on column public.tests.endorsement_code is
  'CDL endorsement letter (H, N, T, P, S) or null for the base General Knowledge permit.';
comment on column public.tests.related_kc_category_slug is
  'Knowledge Center category slug to cross-link. KC integration lands in a later milestone.';

-- Published tests, in display order — powers the hub without a full scan.
create index if not exists tests_published_sort
  on public.tests (sort_order) where is_published = true;
