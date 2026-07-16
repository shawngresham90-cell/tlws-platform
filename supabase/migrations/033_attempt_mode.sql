-- 033_attempt_mode.sql
-- Practice Tests M3 (code review): attempt analytics fields.
--
-- Additive only. Both runners previously posted indistinguishable payloads,
-- so a test_attempts row could not tell a Timed exam from a Study session and
-- time-to-complete was never captured — permanently unrecoverable data for a
-- study product. The server clamps elapsed_seconds against the catalog time
-- limit, so localStorage clock tampering cannot poison the analytics.
--
-- Rollback (manual):
--   alter table public.test_attempts
--     drop column if exists mode,
--     drop column if exists elapsed_seconds;

alter table public.test_attempts
  add column if not exists mode text
    check (mode in ('study', 'timed')),
  add column if not exists elapsed_seconds integer
    check (elapsed_seconds >= 0);

comment on column public.test_attempts.mode is
  'Which runner produced the attempt: study (instant feedback) or timed (exam simulation). Null for pre-M3 rows.';
comment on column public.test_attempts.elapsed_seconds is
  'Seconds from session start to submission, clamped server-side to the test''s time limit. Null for pre-M3 rows.';
