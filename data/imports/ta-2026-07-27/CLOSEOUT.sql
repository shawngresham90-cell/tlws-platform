-- TA/Petro closeout — authorized 2026-07-27 (separate from the enrichment run).
--
-- Scope of the authorization, and what this file does with it:
--   1. Site 0269 TA Knoxville West — coordinate enrichment with a ONE-RECORD,
--      EXACT-ID same-site exception for its two published companion records.
--      The GLOBAL collision guard is unchanged; the exception below names the
--      two companion UUIDs and re-proves every property the authorization
--      requires before excluding them.                          -> EXECUTED
--   2. Correction A (Atlanta South duplicate unpublish) — executed via the
--      guarded statement in CORRECTIONS-PROPOSALS.sql §A.       -> EXECUTED
--   3. Sites 0001/0142 (Ashland/Richmond) — exact-address identity
--      verification FAILED: both candidate rows carry address = NULL in
--      production, and city/zip/name alone are forbidden anchors. No write.
--                                                               -> QUARANTINED
--   4. Correction B (Petro Florence relabel) — dry-run of the collision
--      precondition FAILED: published pin 33dd16f0 "Blue Beacon Truck Wash
--      #51 - Florence" (3003 TV Rd) sits inside the collision box of the
--      official 0393 coordinate. The granted same-site exception covers ONLY
--      site 0269's two named companions, so the guard stands. No write.
--                                                               -> QUARANTINED
--
-- Rollbacks: CLOSEOUT-ROLLBACK.sql (written before execution).
-- Pre-state and manifest: CLOSEOUT-MANIFEST.md.

-- ===========================================================================
-- 1. Site 0269 — coordinate enrichment with the exact-ID same-site exception
-- ===========================================================================
begin;
do $$
declare n integer;
begin
  -- Identity: the exact row, still in its verified pre-state.
  select count(*) into n from public.locations
   where id = 'cd4783d1-b67c-4c09-b056-6a72f5606229' and deleted_at is null
     and name = 'TA Knoxville West' and state = 'TN' and city = 'Knoxville'
     and address = '615 Watt Rd' and category_slug = 'truck-stops'
     and is_published and lat is null and lng is null and parking_spaces = 176;
  if n <> 1 then raise exception 'Precondition failed: 0269 row not in verified pre-state.'; end if;

  -- The exception's own preconditions: BOTH named companions must be live,
  -- published, companion service categories, identify TA Knoxville West or
  -- #269 by name, and already hold EXACTLY the official coordinate.
  select count(*) into n from public.locations l
   where l.id in ('7ac0bc00-385a-48e5-875a-1576872a51f5',
                  '46c70f80-8582-44d1-a7b6-ea9423392fea')
     and l.deleted_at is null and l.is_published
     and l.category_slug in ('cat-scales','tire-repair')
     and (l.name ilike '%TA Knoxville West%' or l.name ~* '#\s*0*269\y')
     and l.lat = 35.8731 and l.lng = -84.2379;
  if n <> 2 then raise exception 'Exception precondition failed: % of 2 companions qualify.', n; end if;

  -- The UNMODIFIED global collision check, minus ONLY the two exact ids the
  -- exception names. Any third pin in the radius still aborts.
  select count(*) into n from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id <> 'cd4783d1-b67c-4c09-b056-6a72f5606229'
     and l.id not in ('7ac0bc00-385a-48e5-875a-1576872a51f5',
                      '46c70f80-8582-44d1-a7b6-ea9423392fea')
     and abs(l.lat - 35.8731) < 0.0015 and abs(l.lng - (-84.2379)) < 0.0015;
  if n <> 0 then raise exception '% non-exempt collision(s) with a published pin.', n; end if;

  -- Blank-only coordinate write. parking_spaces (176) and publication state
  -- are NOT in the SET list — they cannot change.
  update public.locations
     set lat = 35.8731, lng = -84.2379,
         geocode_source = 'batch-csv', geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(), updated_at = now()
   where id = 'cd4783d1-b67c-4c09-b056-6a72f5606229'
     and lat is null and lng is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Expected exactly 1 update, got %.', n; end if;

  -- Post-checks: space count intact, no publication/featured/indexable drift.
  select count(*) into n from public.locations
   where id = 'cd4783d1-b67c-4c09-b056-6a72f5606229'
     and parking_spaces = 176 and is_published
     and not is_featured and not is_indexable;
  if n <> 1 then raise exception 'Post-check failed on 0269.'; end if;
end $$;
commit;

-- ===========================================================================
-- 2. Correction A — executed exactly as prepared:
--    CORRECTIONS-PROPOSALS.sql §A (guards: duplicate identity, twin published
--    + mappable + imported-from-official, expected-count 1, nothing deleted,
--    row of record still live). Inline value-matched rollback there.
-- ===========================================================================
-- (statement not duplicated here; see CORRECTIONS-PROPOSALS.sql lines 55-98)

-- ===========================================================================
-- 3 & 4. NOT EXECUTED — quarantined with reasons above. The B statement in
--    CORRECTIONS-PROPOSALS.sql §B remains prepared and unexecuted; its own
--    collision precondition is the guard that (correctly) blocks it today.
-- ===========================================================================
