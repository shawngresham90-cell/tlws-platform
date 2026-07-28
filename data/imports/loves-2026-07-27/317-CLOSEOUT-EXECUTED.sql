-- Love's #317 Skippers VA — the EXACT guarded SQL executed 2026-07-28
-- (inert record; already applied; safe to re-run — TXN 1 requires
-- overnight_parking = false and TXN 2 requires is_published = false, so
-- re-execution matches zero rows and raises, changing nothing).

-- TXN 1: overnight confirmation, row still unpublished
begin;
do $$
declare n int;
begin
  update public.locations set overnight_parking = true, updated_at = now()
   where id = '5a5fa4df-c324-4405-bdb6-977ffb7f01a5'
     and name = 'Love''s Travel Stop #317'
     and state = 'VA' and city = 'Skippers'
     and is_published = false
     and lat = 36.605447 and lng = -77.560647
     and parking_spaces = 72 and overnight_parking = false
     and is_featured = false and is_indexable = false
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '#317 TXN1 overnight: expected exactly 1 row, got % — ABORT', n;
  end if;
end $$;
commit;

-- (row audited unpublished between the transactions)

-- TXN 2: publication, requires the confirmed overnight flag
begin;
do $$
declare n int;
begin
  update public.locations set is_published = true, updated_at = now()
   where id = '5a5fa4df-c324-4405-bdb6-977ffb7f01a5'
     and name = 'Love''s Travel Stop #317'
     and state = 'VA' and city = 'Skippers'
     and is_published = false
     and lat = 36.605447 and lng = -77.560647
     and parking_spaces = 72 and overnight_parking = true
     and is_featured = false and is_indexable = false
     and deleted_at is null;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '#317 TXN2 publish: expected exactly 1 row, got % — ABORT', n;
  end if;
end $$;
commit;
