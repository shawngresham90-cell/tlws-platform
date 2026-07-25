-- ROLLBACK for the entire TA/Petro batch.
-- Selects EXACTLY the rows this batch inserted and nothing else: before the run,
-- 0 rows carried this source label (verified), so the label is a precise handle.
-- Inspect first:
select id, name, city, state, created_at from public.locations where source='official-ta-petro-20260725-5ebe0e9f' order by state, name;
-- Then, to revert:
-- begin;
-- delete from public.locations where source='official-ta-petro-20260725-5ebe0e9f';
-- commit;
