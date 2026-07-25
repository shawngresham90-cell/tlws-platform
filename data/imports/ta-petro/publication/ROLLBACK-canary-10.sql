-- Rollback for the TA/Petro publication canary (10 locations).
--
-- Reverts is_published true -> false for EXACTLY the 10 canary IDs, and only
-- for rows that still carry the verified batch source label. Touches no other
-- column and no other row. Idempotent: re-running after a completed rollback
-- matches 0 rows and aborts on the guard rather than changing anything.
--
-- Source label comes from data/imports/ta-petro/sql/CHECKPOINT.md, never from
-- name matching.
--
-- Usage:
--   psql "$DATABASE_URL" -f ROLLBACK-canary-10.sql
-- or paste into the project's authenticated Supabase SQL connection.

-- Verify first (expect 10 while the canary is live):
--   select count(*) from public.locations
--   where source = 'official-ta-petro-20260725-5ebe0e9f'
--     and is_published = true;

do $$
declare
  n integer;
  canary uuid[] := array[
    '3e9bf81d-9821-459a-83c6-2f4a11b1cdd8',  -- Petro Santa Nella, CA
    '084a6d0f-99c9-445c-a4d6-eebf25906a95',  -- Petro North Hillsboro, TX
    '04ebc594-6cbb-4dfb-8412-18fbfdcdda8e',  -- Petro Perrysburg, OH
    '524f9828-f30b-4fd0-8c19-517ca2a94810',  -- Petro Carnesville, GA
    '0481b552-960a-4de2-8de1-194eeb097d46',  -- TA Barkeyville, PA
    '171981b9-7bdd-4511-ad0f-1aa1601e647a',  -- TA Springer, NM
    '0b73fd3d-ca53-46a7-a467-e8441d4437a4',  -- TA Express Palmyra, MO
    '04fe8734-4e5c-446e-9bc3-a9f0ca276035',  -- TA Rawlins, WY
    '354bc376-dbe6-4584-b8a5-1b4ec6e55c70',  -- TA Express Tampa, Seffner, FL
    '02564379-d8e9-432b-813a-607b86ce9dc6'   -- TA Lake Station, IN
  ]::uuid[];
begin
  update public.locations
     set is_published = false
   where id = any(canary)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = true;

  get diagnostics n = row_count;

  if n <> 10 then
    raise exception
      'ROLLBACK GUARD: expected to unpublish exactly 10 rows, matched %. No change committed.', n;
  end if;

  raise notice 'Rollback applied: % canary rows returned to unpublished.', n;
end $$;

-- Post-rollback verification (expect 0 published, 304 batch, 1556 live):
--   select
--     (select count(*) from public.locations
--        where source='official-ta-petro-20260725-5ebe0e9f') as batch,
--     (select count(*) from public.locations
--        where source='official-ta-petro-20260725-5ebe0e9f'
--          and is_published) as published,
--     (select count(*) from public.locations) as live_total;
