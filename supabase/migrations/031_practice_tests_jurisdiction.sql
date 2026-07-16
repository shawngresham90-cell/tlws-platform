-- 031_practice_tests_jurisdiction.sql
-- CDL Practice Tests foundation (Milestone 1) — future-facing stub.
--
-- ⚠️ COMMITTED BUT NOT APPLIED. Additive only. Lets a federal test later be
-- cloned into per-state variants (e.g. a Georgia General Knowledge test)
-- WITHOUT another schema change when that milestone arrives. No UI consumes
-- these columns in Milestone 1 — state-specific tests are deliberately out of
-- scope here. The column ships now purely so the future work is a data change,
-- not a migration.
--
-- Rollback (manual):
--   alter table public.tests
--     drop column if exists jurisdiction,
--     drop column if exists states;

alter table public.tests
  add column if not exists jurisdiction text not null default 'federal'
    check (jurisdiction in ('federal', 'state')),
  add column if not exists states text[] not null default '{}';

comment on column public.tests.jurisdiction is
  'federal | state. All Milestone 1 tests are federal. State variants are a later milestone.';
comment on column public.tests.states is
  'Two-letter state codes this variant targets; empty for a federal test.';

create index if not exists tests_jurisdiction on public.tests (jurisdiction);
