-- TA/Petro publication canary — publish EXACTLY 10 locations.
--
-- The only column written is is_published (false -> true). No insert, no
-- delete, no other column, no other row. Single transaction with an exact
-- ROW_COUNT = 10 guard; any mismatch raises, which aborts the do-block and
-- rolls the whole statement back automatically.
--
-- Selection rules applied when these 10 IDs were chosen (all verified live,
-- read-only, before execution):
--   * source = the checkpoint's exact label (never fuzzy name matching)
--   * is_published = false, deleted_at is null
--   * name/city/address/zip/slug/detail_slug all non-blank
--   * lat/lng present and within CONUS bounds
--   * 10 distinct states across distinct freight corridors
--   * both brands represented (4 Petro, 6 TA)
--   * 0 matches against Love's / Sapp Bros / Pilot / Flying J / Goasis /
--     Thorntons, 0 held or manually-verified rows
--   * 0 detail_slug collisions, 0 type|state|city|slug collisions
--
-- Rollback: ROLLBACK-canary-10.sql (same directory, same 10 IDs).

do $$
declare
  n integer;
  canary uuid[] := array[
    '3e9bf81d-9821-459a-83c6-2f4a11b1cdd8',  -- Petro Santa Nella, CA      I-5
    '084a6d0f-99c9-445c-a4d6-eebf25906a95',  -- Petro North Hillsboro, TX  I-35
    '04ebc594-6cbb-4dfb-8412-18fbfdcdda8e',  -- Petro Perrysburg, OH       I-75/I-80
    '524f9828-f30b-4fd0-8c19-517ca2a94810',  -- Petro Carnesville, GA      I-85
    '0481b552-960a-4de2-8de1-194eeb097d46',  -- TA Barkeyville, PA         I-80
    '171981b9-7bdd-4511-ad0f-1aa1601e647a',  -- TA Springer, NM            I-25
    '0b73fd3d-ca53-46a7-a467-e8441d4437a4',  -- TA Express Palmyra, MO     US-61
    '04fe8734-4e5c-446e-9bc3-a9f0ca276035',  -- TA Rawlins, WY             I-80
    '354bc376-dbe6-4584-b8a5-1b4ec6e55c70',  -- TA Express Tampa, FL       I-4/I-75
    '02564379-d8e9-432b-813a-607b86ce9dc6'   -- TA Lake Station, IN        I-80/I-94
  ]::uuid[];
begin
  update public.locations
     set is_published = true
   where id = any(canary)
     and source = 'official-ta-petro-20260725-5ebe0e9f'
     and is_published = false
     and deleted_at is null;

  get diagnostics n = row_count;

  if n <> 10 then
    raise exception
      'PUBLISH GUARD: expected to publish exactly 10 rows, matched %. Nothing committed.', n;
  end if;

  raise notice 'Canary published: % rows.', n;
end $$;
