-- 031_practice_tests_attempts.sql
-- CDL Practice Tests — Milestone 2 (Study Mode) attempt infrastructure.
--
-- ⚠️ COMMITTED, applied together with 029/030 when the owner applies the
-- Practice Tests set. Additive only.
--
-- One atomic counter-increment function for question miss analytics. Called
-- exclusively by the service role inside POST /api/tests/attempt after it
-- grades an attempt server-side; anon and authenticated can never execute it
-- (matching the repo doctrine: zero anon writes, all writes via server routes).
--
-- Rollback (manual):
--   drop function public.tlws_increment_question_misses(uuid[]);

create or replace function public.tlws_increment_question_misses(p_question_ids uuid[])
returns void
language sql
set search_path = ''
as $$
  update public.questions
     set miss_count = miss_count + 1
   where id = any (p_question_ids);
$$;

comment on function public.tlws_increment_question_misses(uuid[]) is
  'Service-role only: bumps miss_count for the questions missed in a graded attempt. Feeds the future admin "most-missed" report.';

revoke execute on function public.tlws_increment_question_misses(uuid[]) from public;
revoke execute on function public.tlws_increment_question_misses(uuid[]) from anon, authenticated;
grant execute on function public.tlws_increment_question_misses(uuid[]) to service_role;
