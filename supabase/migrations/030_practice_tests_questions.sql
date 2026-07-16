-- 030_practice_tests_questions.sql
-- CDL Practice Tests foundation (Milestone 1).
--
-- ⚠️ COMMITTED BUT NOT APPLIED. Additive only — enriches public.questions so a
-- study item can carry an optional diagram/road-sign image, a difficulty band,
-- and topic tags. Touches no existing row and drops nothing. The base columns
-- from migration 007 (prompt, choices, correct_key, explanation, cfr_cite,
-- verified_date) are untouched.
--
-- Answer-key exposure is intentional: this is a free study tool, so questions
-- (including correct_key + explanation) are served to the anon client under the
-- existing anon_read_questions policy. Usability over bank protection — decided
-- and finalized in the Practice Tests blueprint.
--
-- Rollback (manual, only if abandoned):
--   alter table public.questions
--     drop column if exists image_url,
--     drop column if exists difficulty,
--     drop column if exists tags;

alter table public.questions
  add column if not exists image_url text,
  add column if not exists difficulty smallint not null default 1
    check (difficulty between 1 and 3),
  add column if not exists tags text[] not null default '{}';

comment on column public.questions.image_url is
  'Optional diagram / road-sign image for the question. Null for text-only items.';
comment on column public.questions.difficulty is
  '1 = easy, 2 = medium, 3 = hard. Feeds weighted study drilling in a later milestone.';
comment on column public.questions.tags is
  'Topic tags for grouping and weak-spot review (e.g. {air-brakes,cargo}).';

-- Tag lookups for topic-scoped study sets.
create index if not exists questions_tags on public.questions using gin (tags);
