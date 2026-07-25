-- ⚠️ NOT EXECUTED. Rollback companion to INDEXABILITY-rollout.sql. Run only to
-- revert a previously-authorized is_indexable rollout.
--
-- Reverts is_indexable true -> false for the 304 published TA/Petro rows.
-- Scoped by the exact source label AND is_published=true AND is_indexable=true;
-- sets ONLY is_indexable; exact ROW_COUNT=304 guard with auto-rollback on
-- mismatch. Idempotent. Never touches is_published or any other field.
--
-- Source label: official-ta-petro-20260725-5ebe0e9f (from ../sql/CHECKPOINT.md).

do $$
declare n integer;
begin
  update public.locations
     set is_indexable = false
   where source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true
     and is_indexable = true
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 304 then
    raise exception 'INDEXABILITY ROLLBACK GUARD: expected 304, matched %. Rolled back.', n;
  end if;
  raise notice 'is_indexable set false on % TA/Petro rows.', n;
end $$;
