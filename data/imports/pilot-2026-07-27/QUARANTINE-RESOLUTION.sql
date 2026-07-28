-- Pilot quarantine resolution — the 13 individually authorized records.
-- EXECUTED 2026-07-28 verbatim, zero guard failures: mixed canary
-- (#17 MI, #35 IN, #700 OH inserts+publishes, #95 FL enrichment) audited,
-- then the remaining 6 inserts and 3 enrichments. Measured after:
-- live 2,274 (+9) · published 1,896 (+9) · with_coords 1,364 (+13) ·
-- published-unmappable 551 (−4) · control digest 4b5aed26… byte-identical ·
-- 0 duplicate slugs · held rows (#195 OR, #749 VA, #290 MD, #187 TN)
-- untouched. Gate 3a 809 -> 818/820 · Gate 3b 788 -> 801/803.
--
-- Scope: the 9 net-new inserts (#282 CA, #46 KY, #17 MI, #266 NM, #387 NV,
-- #303 OH, #12 OH, #35 IN, #700 OH) and the 4 published-coordless
-- enrichments (#1330 AR, #1550 AL, #353 KY, #95 FL) from
-- QUARANTINE-REVIEW.md. Explicitly OUT of scope: #195 OR (needs independent
-- page/parcel evidence), #749 VA (unresolved identity), #290 MD and #187 TN
-- (closure review), every zero-space, Canadian, duplicate or held record.
--
-- THE GLOBAL COLLISION GUARD IS NOT WEAKENED. Each exception is scoped to
-- one exact record and its exact documented neighbour UUID(s), whose
-- identity (name + category + publication + position) is re-proven inside
-- the same transaction; a third, unexpected pin inside the box aborts.
-- The store-number guard likewise runs unchanged except for the exact
-- re-proven clash row's UUID (#35's Family Express, #700's own CAT-scale
-- row) — a by-ID exclusion after the clash row's identity is re-proven, not
-- a pattern change.
--
-- ORDER: mixed canary first (#17 MI insert · #35 IN insert · #700 OH insert
-- · #95 FL enrichment), audit, then the remaining 9. Value-matched rollback:
-- QUARANTINE-RESOLUTION-ROLLBACK.sql (prepared before any write).
--
-- Expected if all 13 pass (RECOMPUTE live, never trust): +9 published
-- net-new locations, +4 published rows become mappable; after the pending
-- 25-row publication, Gate 3a 809 -> 818 of 820, Gate 3b 788 -> 801 of 803;
-- live rows +9; with_coords +13; published +9; published_unmappable -4.

-- ============================ MIXED CANARY ============================

-- ===== #17 MI — Pilot Travel Center #17 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Identity re-proof: the exempted neighbour must still be exactly the row
  -- the review documented — right UUID, name, category, published, and inside
  -- the guard box relative to the official coordinate. Anything else aborts.
  select count(*) into n from public.locations l
   where l.id = '92690d91-86e8-47bf-9a48-647aaa6140d0' and l.deleted_at is null and l.is_published
     and l.name = 'TA Battle Creek' and l.category_slug = 'truck-stops'
     and l.lat is not null
     and abs(l.lat - 42.3029751720004) < 0.0015 and abs(l.lng - -85.08241893488058) < 0.0015;
  if n <> 1 then raise exception '#17 MI: exempted neighbour 92690d91-86e8-47bf-9a48-647aaa6140d0 no longer matches its documented identity.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('92690d91-86e8-47bf-9a48-647aaa6140d0')
     and abs(l.lat - 42.3029751720004) < 0.0015 and abs(l.lng - -85.08241893488058) < 0.0015;
  if n <> 0 then raise exception '#17 MI: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'pilot-travel-center-17-battle-creek-mi';
  if n <> 0 then raise exception '#17 MI: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'MI' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '17'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)';
  if n <> 0 then raise exception '#17 MI: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'Pilot Travel Center #17', '15901 11 Mile Rd', 'Battle Creek', 'MI', '49014',
     42.3029751720004, -85.08241893488058, 'I-94', '104', 75,
     'pilot-travel-center-17-battle-creek-mi', 'pilot-travel-center-17-battle-creek-mi', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#17 MI: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-17-battle-creek-mi'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#17 MI: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #17 MI — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'pilot-travel-center-17-battle-creek-mi' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 42.3029751720004 and lng = -85.08241893488058
     and parking_spaces = 75 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#17 MI: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-17-battle-creek-mi' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#17 MI: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #35 IN — Pilot Travel Center #35 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Store-number clash re-proof: the documented clash row must still be
  -- exactly the reviewed record (unrelated third-party chain, Rensselaer IN, ~55 mi away, coordless); only then is it excluded
  -- from the store-number guard BY EXACT ID. The guard itself is unchanged.
  select count(*) into n from public.locations l
   where l.id = '1f830c7e-1a16-4115-930e-f93f59c31b80' and l.deleted_at is null
     and l.name = 'Family Express #35';
  if n <> 1 then raise exception '#35 IN: documented clash row 1f830c7e-1a16-4115-930e-f93f59c31b80 no longer matches.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and abs(l.lat - 41.736021) < 0.0015 and abs(l.lng - -86.336832) < 0.0015;
  if n <> 0 then raise exception '#35 IN: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'pilot-travel-center-35-south-bend-in';
  if n <> 0 then raise exception '#35 IN: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'IN' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '35'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)'
     and l.id <> '1f830c7e-1a16-4115-930e-f93f59c31b80';
  if n <> 0 then raise exception '#35 IN: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'Pilot Travel Center #35', '6424 W Brick Rd', 'South Bend', 'IN', '46628',
     41.736021, -86.336832, 'I-90', '72', 70,
     'pilot-travel-center-35-south-bend-in', 'pilot-travel-center-35-south-bend-in', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#35 IN: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-35-south-bend-in'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#35 IN: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #35 IN — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'pilot-travel-center-35-south-bend-in' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 41.736021 and lng = -86.336832
     and parking_spaces = 70 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#35 IN: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-35-south-bend-in' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#35 IN: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #700 OH — Flying J Travel Center #700 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Store-number clash re-proof: the documented clash row must still be
  -- exactly the reviewed record (the site’s own colocated cat-scales service row at the same address (map-pin rule: it carries no coordinate)); only then is it excluded
  -- from the store-number guard BY EXACT ID. The guard itself is unchanged.
  select count(*) into n from public.locations l
   where l.id = '861f3ac4-7494-480b-821c-05f6c9cf886d' and l.deleted_at is null
     and l.name = 'CAT Scale — Flying J Travel Center #700, Perrysburg';
  if n <> 1 then raise exception '#700 OH: documented clash row 861f3ac4-7494-480b-821c-05f6c9cf886d no longer matches.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and abs(l.lat - 41.534688838750284) < 0.0015 and abs(l.lng - -83.4607347506996) < 0.0015;
  if n <> 0 then raise exception '#700 OH: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'flying-j-travel-center-700-perrysburg-oh';
  if n <> 0 then raise exception '#700 OH: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'OH' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '700'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)'
     and l.id <> '861f3ac4-7494-480b-821c-05f6c9cf886d';
  if n <> 0 then raise exception '#700 OH: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'Flying J Travel Center #700', '26415 Warns Dr', 'Perrysburg', 'OH', '43551',
     41.534688838750284, -83.4607347506996, 'I-280', '1B', 150,
     'flying-j-travel-center-700-perrysburg-oh', 'flying-j-travel-center-700-perrysburg-oh', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#700 OH: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'flying-j-travel-center-700-perrysburg-oh'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#700 OH: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #700 OH — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'flying-j-travel-center-700-perrysburg-oh' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 41.534688838750284 and lng = -83.4607347506996
     and parking_spaces = 150 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#700 OH: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'flying-j-travel-center-700-perrysburg-oh' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#700 OH: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #95 FL — ENRICH published coordless row 76f653aa-907b-4800-865a-1dd03003185a
begin;
do $$
declare n integer;
begin
  -- Target re-proof: exact UUID, still published, truck-stops, and BLANK
  -- coordinates (blank-only). Any drift aborts.
  select count(*) into n from public.locations l
   where l.id = '76f653aa-907b-4800-865a-1dd03003185a' and l.deleted_at is null and l.is_published
     and l.category_slug = 'truck-stops' and l.name = 'Pilot Travel Center #95 (Wildwood, 493 SR 44)'
     and l.lat is null and l.lng is null;
  if n <> 1 then raise exception '#95 FL: target row drifted from its documented state.'; end if;
  select count(*) into n from public.locations where id = '76f653aa-907b-4800-865a-1dd03003185a' and parking_spaces is not null;
  if n <> 0 then raise exception '#95 FL: parking_spaces is no longer blank — blank-only violated.'; end if;

  select count(*) into n from public.locations l
   where l.id = '245d9e0f-cb95-461e-822a-e458c03212ed' and l.deleted_at is null and l.is_published
     and l.name = 'TA Wildwood (TravelCenters of America)' and l.category_slug = 'truck-stops';
  if n <> 1 then raise exception '#95 FL: exempted neighbour 245d9e0f-cb95-461e-822a-e458c03212ed no longer matches its documented identity.'; end if;

  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), no other
  -- published pin may sit inside the box around the official coordinate.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('245d9e0f-cb95-461e-822a-e458c03212ed', '76f653aa-907b-4800-865a-1dd03003185a')
     and abs(l.lat - 28.873918542991504) < 0.0015 and abs(l.lng - -82.09515797982287) < 0.0015;
  if n <> 0 then raise exception '#95 FL: % unexpected published pin(s) inside the box.', n; end if;

  -- Write: official coordinate (+ count only where blank) + provenance.
  -- Nothing else. Never is_indexable / is_featured / overnight / geo.
  update public.locations
     set lat = 28.873918542991504,
         lng = -82.09515797982287,
         parking_spaces = 10,
         geocode_source = 'batch-csv',
         geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(),
         updated_at = now()
   where id = '76f653aa-907b-4800-865a-1dd03003185a' and lat is null and lng is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#95 FL: expected to enrich exactly 1 row, updated %.', n; end if;
end $$;
commit;

-- CANARY AUDIT (read-only) before the remainder: the 3 inserted rows are
-- published, mappable, positive-parking, unfeatured, unindexed, no overnight;
-- #95's row is now mappable with spaces 10; control digest unchanged; no new
-- pin within 150 m of anything except the re-proven exempted neighbours.

-- ============================ REMAINDER ============================

-- ===== #282 CA — Pilot Travel Center #282 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Identity re-proof: the exempted neighbour must still be exactly the row
  -- the review documented — right UUID, name, category, published, and inside
  -- the guard box relative to the official coordinate. Anything else aborts.
  select count(*) into n from public.locations l
   where l.id = '5c4f1bd6-e79e-48b2-8d3c-b0cf4b91b934' and l.deleted_at is null and l.is_published
     and l.name = 'TA Barstow' and l.category_slug = 'truck-stops'
     and l.lat is not null
     and abs(l.lat - 34.8549172) < 0.0015 and abs(l.lng - -117.0874803) < 0.0015;
  if n <> 1 then raise exception '#282 CA: exempted neighbour 5c4f1bd6-e79e-48b2-8d3c-b0cf4b91b934 no longer matches its documented identity.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('5c4f1bd6-e79e-48b2-8d3c-b0cf4b91b934')
     and abs(l.lat - 34.8549172) < 0.0015 and abs(l.lng - -117.0874803) < 0.0015;
  if n <> 0 then raise exception '#282 CA: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'pilot-travel-center-282-barstow-ca';
  if n <> 0 then raise exception '#282 CA: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'CA' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '282'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)';
  if n <> 0 then raise exception '#282 CA: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'Pilot Travel Center #282', '2591 Commerce Pkwy', 'Barstow', 'CA', '92311',
     34.8549172, -117.0874803, 'I-15', '178', 18,
     'pilot-travel-center-282-barstow-ca', 'pilot-travel-center-282-barstow-ca', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#282 CA: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-282-barstow-ca'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#282 CA: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #282 CA — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'pilot-travel-center-282-barstow-ca' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 34.8549172 and lng = -117.0874803
     and parking_spaces = 18 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#282 CA: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-282-barstow-ca' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#282 CA: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #46 KY — ONE9 Travel Center #46 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Identity re-proof: the exempted neighbour must still be exactly the row
  -- the review documented — right UUID, name, category, published, and inside
  -- the guard box relative to the official coordinate. Anything else aborts.
  select count(*) into n from public.locations l
   where l.id = 'ce461491-1e00-4179-92b7-126cd264a7f3' and l.deleted_at is null and l.is_published
     and l.name = 'TA Truck Service Franklin' and l.category_slug = 'truck-stops'
     and l.lat is not null
     and abs(l.lat - 36.716046) < 0.0015 and abs(l.lng - -86.525849) < 0.0015;
  if n <> 1 then raise exception '#46 KY: exempted neighbour ce461491-1e00-4179-92b7-126cd264a7f3 no longer matches its documented identity.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('ce461491-1e00-4179-92b7-126cd264a7f3')
     and abs(l.lat - 36.716046) < 0.0015 and abs(l.lng - -86.525849) < 0.0015;
  if n <> 0 then raise exception '#46 KY: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'one9-travel-center-46-franklin-ky';
  if n <> 0 then raise exception '#46 KY: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'KY' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '46'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)';
  if n <> 0 then raise exception '#46 KY: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'ONE9 Travel Center #46', '2929 Scottsville Rd', 'Franklin', 'KY', '42134',
     36.716046, -86.525849, 'I-65', '6', 35,
     'one9-travel-center-46-franklin-ky', 'one9-travel-center-46-franklin-ky', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#46 KY: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'one9-travel-center-46-franklin-ky'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#46 KY: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #46 KY — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'one9-travel-center-46-franklin-ky' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 36.716046 and lng = -86.525849
     and parking_spaces = 35 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#46 KY: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'one9-travel-center-46-franklin-ky' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#46 KY: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #266 NM — Pilot Travel Center #266 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Identity re-proof: the exempted neighbour must still be exactly the row
  -- the review documented — right UUID, name, category, published, and inside
  -- the guard box relative to the official coordinate. Anything else aborts.
  select count(*) into n from public.locations l
   where l.id = '811fb0fb-5059-42cf-a5e6-6f4bf08cd8c2' and l.deleted_at is null and l.is_published
     and l.name = 'TA Las Cruces' and l.category_slug = 'truck-stops'
     and l.lat is not null
     and abs(l.lat - 32.296515098320114) < 0.0015 and abs(l.lng - -106.8102598392868) < 0.0015;
  if n <> 1 then raise exception '#266 NM: exempted neighbour 811fb0fb-5059-42cf-a5e6-6f4bf08cd8c2 no longer matches its documented identity.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('811fb0fb-5059-42cf-a5e6-6f4bf08cd8c2')
     and abs(l.lat - 32.296515098320114) < 0.0015 and abs(l.lng - -106.8102598392868) < 0.0015;
  if n <> 0 then raise exception '#266 NM: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'pilot-travel-center-266-las-cruces-nm';
  if n <> 0 then raise exception '#266 NM: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'NM' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '266'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)';
  if n <> 0 then raise exception '#266 NM: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'Pilot Travel Center #266', '2681 W Amador Ave', 'Las Cruces', 'NM', '88005',
     32.296515098320114, -106.8102598392868, 'I-10', '139', 28,
     'pilot-travel-center-266-las-cruces-nm', 'pilot-travel-center-266-las-cruces-nm', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#266 NM: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-266-las-cruces-nm'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#266 NM: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #266 NM — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'pilot-travel-center-266-las-cruces-nm' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 32.296515098320114 and lng = -106.8102598392868
     and parking_spaces = 28 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#266 NM: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-266-las-cruces-nm' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#266 NM: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #387 NV — ONE9 Travel Center #387 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Identity re-proof: the exempted neighbour must still be exactly the row
  -- the review documented — right UUID, name, category, published, and inside
  -- the guard box relative to the official coordinate. Anything else aborts.
  select count(*) into n from public.locations l
   where l.id = '704ccbb5-06de-46c0-9df7-88bcb9230865' and l.deleted_at is null and l.is_published
     and l.name = 'TA Express Carlin' and l.category_slug = 'truck-stops'
     and l.lat is not null
     and abs(l.lat - 40.71970773701785) < 0.0015 and abs(l.lng - -116.10611350066375) < 0.0015;
  if n <> 1 then raise exception '#387 NV: exempted neighbour 704ccbb5-06de-46c0-9df7-88bcb9230865 no longer matches its documented identity.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('704ccbb5-06de-46c0-9df7-88bcb9230865')
     and abs(l.lat - 40.71970773701785) < 0.0015 and abs(l.lng - -116.10611350066375) < 0.0015;
  if n <> 0 then raise exception '#387 NV: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'one9-travel-center-387-carlin-nv';
  if n <> 0 then raise exception '#387 NV: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'NV' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '387'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)';
  if n <> 0 then raise exception '#387 NV: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'ONE9 Travel Center #387', '791 10th St', 'Carlin', 'NV', '89822',
     40.71970773701785, -116.10611350066375, 'I-80', '280', 60,
     'one9-travel-center-387-carlin-nv', 'one9-travel-center-387-carlin-nv', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#387 NV: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'one9-travel-center-387-carlin-nv'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#387 NV: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #387 NV — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'one9-travel-center-387-carlin-nv' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 40.71970773701785 and lng = -116.10611350066375
     and parking_spaces = 60 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#387 NV: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'one9-travel-center-387-carlin-nv' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#387 NV: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #303 OH — Pilot Travel Center #303 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Identity re-proof: the exempted neighbour must still be exactly the row
  -- the review documented — right UUID, name, category, published, and inside
  -- the guard box relative to the official coordinate. Anything else aborts.
  select count(*) into n from public.locations l
   where l.id = '5d0a8618-d22f-4b27-85d5-f9f034e0a566' and l.deleted_at is null and l.is_published
     and l.name = 'Petro Napoleon' and l.category_slug = 'truck-stops'
     and l.lat is not null
     and abs(l.lat - 41.416480909036544) < 0.0015 and abs(l.lng - -84.10480444773451) < 0.0015;
  if n <> 1 then raise exception '#303 OH: exempted neighbour 5d0a8618-d22f-4b27-85d5-f9f034e0a566 no longer matches its documented identity.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('5d0a8618-d22f-4b27-85d5-f9f034e0a566')
     and abs(l.lat - 41.416480909036544) < 0.0015 and abs(l.lng - -84.10480444773451) < 0.0015;
  if n <> 0 then raise exception '#303 OH: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'pilot-travel-center-303-napoleon-oh';
  if n <> 0 then raise exception '#303 OH: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'OH' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '303'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)';
  if n <> 0 then raise exception '#303 OH: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'Pilot Travel Center #303', '905 American Rd', 'Napoleon', 'OH', '43545',
     41.416480909036544, -84.10480444773451, null, '41', 75,
     'pilot-travel-center-303-napoleon-oh', 'pilot-travel-center-303-napoleon-oh', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#303 OH: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-303-napoleon-oh'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#303 OH: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #303 OH — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'pilot-travel-center-303-napoleon-oh' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 41.416480909036544 and lng = -84.10480444773451
     and parking_spaces = 75 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#303 OH: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-303-napoleon-oh' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#303 OH: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #12 OH — Pilot Travel Center #12 — INSERT (unpublished)
begin;
do $$
declare n integer;
begin
  -- Identity re-proof: the exempted neighbour must still be exactly the row
  -- the review documented — right UUID, name, category, published, and inside
  -- the guard box relative to the official coordinate. Anything else aborts.
  select count(*) into n from public.locations l
   where l.id = '3032b5f3-fdf5-498d-92bc-25bf2b05dfda' and l.deleted_at is null and l.is_published
     and l.name = 'TA Toledo' and l.category_slug = 'truck-stops'
     and l.lat is not null
     and abs(l.lat - 41.52268729754443) < 0.0015 and abs(l.lng - -83.46222870809477) < 0.0015;
  if n <> 1 then raise exception '#12 OH: exempted neighbour 3032b5f3-fdf5-498d-92bc-25bf2b05dfda no longer matches its documented identity.'; end if;
  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), NO other
  -- published pin may sit inside the box. An unexpected pin aborts.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('3032b5f3-fdf5-498d-92bc-25bf2b05dfda')
     and abs(l.lat - 41.52268729754443) < 0.0015 and abs(l.lng - -83.46222870809477) < 0.0015;
  if n <> 0 then raise exception '#12 OH: % unexpected published pin(s) inside the box.', n; end if;
  -- Global duplicate guards, unweakened.
  select count(*) into n from public.locations where detail_slug = 'pilot-travel-center-12-perrysburg-oh';
  if n <> 0 then raise exception '#12 OH: detail_slug already exists.'; end if;
  select count(*) into n
    from public.locations l
   where l.state = 'OH' and l.deleted_at is null
     and substring(l.name from '#\s*(\d+)') = '12'
     and l.name !~* '^(southern tire mart|speedway|blue beacon|pro stop)'
     and l.name !~* '\(CAT #[0-9]+\)';
  if n <> 0 then raise exception '#12 OH: store number already exists in state.'; end if;

  insert into public.locations
    (type, category_slug, name, address, city, state, zip, lat, lng,
     interstate, exit_number, parking_spaces,
     slug, detail_slug, source, is_published, is_featured)
  values
    ('truck_stop', 'truck-stops', 'Pilot Travel Center #12', '3430 Libbey Rd', 'Perrysburg', 'OH', '43551',
     41.52268729754443, -83.46222870809477, 'I-80', '71', 23,
     'pilot-travel-center-12-perrysburg-oh', 'pilot-travel-center-12-perrysburg-oh', 'pilot-master-2026-07-27', false, false);
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#12 OH: expected to insert exactly 1 row, inserted %.', n; end if;

  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-12-perrysburg-oh'
     and (is_published or is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#12 OH: post-check failed — forbidden flag set.'; end if;
end $$;
commit;

-- ===== #12 OH — PUBLISH (separate guarded transaction)
begin;
do $$
declare n integer;
begin
  update public.locations
     set is_published = true, updated_at = now()
   where detail_slug = 'pilot-travel-center-12-perrysburg-oh' and source = 'pilot-master-2026-07-27'
     and category_slug = 'truck-stops' and deleted_at is null
     and not is_published and lat = 41.52268729754443 and lng = -83.46222870809477
     and parking_spaces = 23 and parking_spaces > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#12 OH: expected to publish exactly 1 row, published %.', n; end if;
  select count(*) into n from public.locations
   where detail_slug = 'pilot-travel-center-12-perrysburg-oh' and (is_featured or is_indexable or overnight_parking);
  if n <> 0 then raise exception '#12 OH: publish post-check failed.'; end if;
end $$;
commit;

-- ===== #1330 AR — ENRICH published coordless row 69f1f244-c4c0-480b-9e95-f1b02554cb6b
begin;
do $$
declare n integer;
begin
  -- Target re-proof: exact UUID, still published, truck-stops, and BLANK
  -- coordinates (blank-only). Any drift aborts.
  select count(*) into n from public.locations l
   where l.id = '69f1f244-c4c0-480b-9e95-f1b02554cb6b' and l.deleted_at is null and l.is_published
     and l.category_slug = 'truck-stops' and l.name = 'ONE9 Travel Center (Pilot Company)'
     and l.lat is null and l.lng is null;
  if n <> 1 then raise exception '#1330 AR: target row drifted from its documented state.'; end if;
  select count(*) into n from public.locations where id = '69f1f244-c4c0-480b-9e95-f1b02554cb6b' and parking_spaces is not null;
  if n <> 0 then raise exception '#1330 AR: parking_spaces is no longer blank — blank-only violated.'; end if;

  select count(*) into n from public.locations l
   where l.id = 'e945424b-b704-4e3e-9eaa-0ed1ba82fb98' and l.deleted_at is null and l.is_published
     and l.name = 'Diesel Truck Repairs' and l.category_slug = 'roadside-service';
  if n <> 1 then raise exception '#1330 AR: exempted neighbour e945424b-b704-4e3e-9eaa-0ed1ba82fb98 no longer matches its documented identity.'; end if;

  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), no other
  -- published pin may sit inside the box around the official coordinate.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('e945424b-b704-4e3e-9eaa-0ed1ba82fb98', '69f1f244-c4c0-480b-9e95-f1b02554cb6b')
     and abs(l.lat - 34.912544273597874) < 0.0015 and abs(l.lng - -91.19621866623427) < 0.0015;
  if n <> 0 then raise exception '#1330 AR: % unexpected published pin(s) inside the box.', n; end if;

  -- Write: official coordinate (+ count only where blank) + provenance.
  -- Nothing else. Never is_indexable / is_featured / overnight / geo.
  update public.locations
     set lat = 34.912544273597874,
         lng = -91.19621866623427,
         parking_spaces = 42,
         geocode_source = 'batch-csv',
         geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(),
         updated_at = now()
   where id = '69f1f244-c4c0-480b-9e95-f1b02554cb6b' and lat is null and lng is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#1330 AR: expected to enrich exactly 1 row, updated %.', n; end if;
end $$;
commit;

-- ===== #1550 AL — ENRICH published coordless row d7247403-1ed3-49de-83a5-af2862cdbd9f
begin;
do $$
declare n integer;
begin
  -- Target re-proof: exact UUID, still published, truck-stops, and BLANK
  -- coordinates (blank-only). Any drift aborts.
  select count(*) into n from public.locations l
   where l.id = 'd7247403-1ed3-49de-83a5-af2862cdbd9f' and l.deleted_at is null and l.is_published
     and l.category_slug = 'truck-stops' and l.name = 'Pilot Travel Center #1550 (Good Hope)'
     and l.lat is null and l.lng is null;
  if n <> 1 then raise exception '#1550 AL: target row drifted from its documented state.'; end if;

  select count(*) into n from public.locations l
   where l.id = 'f972d0f0-b603-4694-824f-36718afa596b' and l.deleted_at is null and l.is_published
     and l.name = 'Jack''s Truck Stop' and l.category_slug = 'truck-stops';
  if n <> 1 then raise exception '#1550 AL: exempted neighbour f972d0f0-b603-4694-824f-36718afa596b no longer matches its documented identity.'; end if;

  select count(*) into n from public.locations l
   where l.id = '0e24e007-db84-40db-bfc1-222e5d0eebad' and l.deleted_at is null and l.is_published
     and l.name = 'Truck Wash at Jack''s Truck Stop' and l.category_slug = 'truck-washes';
  if n <> 1 then raise exception '#1550 AL: exempted neighbour 0e24e007-db84-40db-bfc1-222e5d0eebad no longer matches its documented identity.'; end if;

  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), no other
  -- published pin may sit inside the box around the official coordinate.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('f972d0f0-b603-4694-824f-36718afa596b', '0e24e007-db84-40db-bfc1-222e5d0eebad', 'd7247403-1ed3-49de-83a5-af2862cdbd9f')
     and abs(l.lat - 34.116865025472514) < 0.0015 and abs(l.lng - -86.86373995824155) < 0.0015;
  if n <> 0 then raise exception '#1550 AL: % unexpected published pin(s) inside the box.', n; end if;

  -- Write: official coordinate (+ count only where blank) + provenance.
  -- Nothing else. Never is_indexable / is_featured / overnight / geo.
  update public.locations
     set lat = 34.116865025472514,
         lng = -86.86373995824155,
         geocode_source = 'batch-csv',
         geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(),
         updated_at = now()
   where id = 'd7247403-1ed3-49de-83a5-af2862cdbd9f' and lat is null and lng is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#1550 AL: expected to enrich exactly 1 row, updated %.', n; end if;
end $$;
commit;

-- ===== #353 KY — ENRICH published coordless row a8a32662-d389-4d96-9653-6fde235726d0
begin;
do $$
declare n integer;
begin
  -- Target re-proof: exact UUID, still published, truck-stops, and BLANK
  -- coordinates (blank-only). Any drift aborts.
  select count(*) into n from public.locations l
   where l.id = 'a8a32662-d389-4d96-9653-6fde235726d0' and l.deleted_at is null and l.is_published
     and l.category_slug = 'truck-stops' and l.name = 'Pilot Travel Center #353'
     and l.lat is null and l.lng is null;
  if n <> 1 then raise exception '#353 KY: target row drifted from its documented state.'; end if;

  select count(*) into n from public.locations l
   where l.id = '076b546a-e264-4c18-abfc-bb32380ceaf5' and l.deleted_at is null and l.is_published
     and l.name = 'Motel 6 Georgetown, KY - Lexington North' and l.category_slug = 'hotels-truck-parking';
  if n <> 1 then raise exception '#353 KY: exempted neighbour 076b546a-e264-4c18-abfc-bb32380ceaf5 no longer matches its documented identity.'; end if;

  select count(*) into n from public.locations l
   where l.id = '5b586188-4b1d-455f-931c-8157582a9f92' and l.deleted_at is null and l.is_published
     and l.name = 'First American Truck Wash and Chrome Shop' and l.category_slug = 'truck-washes';
  if n <> 1 then raise exception '#353 KY: exempted neighbour 5b586188-4b1d-455f-931c-8157582a9f92 no longer matches its documented identity.'; end if;

  -- THIRD-PIN ABORT: beyond the exact exempted neighbour(s), no other
  -- published pin may sit inside the box around the official coordinate.
  select count(*) into n
    from public.locations l
   where l.deleted_at is null and l.is_published and l.lat is not null
     and l.id not in ('076b546a-e264-4c18-abfc-bb32380ceaf5', '5b586188-4b1d-455f-931c-8157582a9f92', 'a8a32662-d389-4d96-9653-6fde235726d0')
     and abs(l.lat - 38.27605548759607) < 0.0015 and abs(l.lng - -84.55335544912026) < 0.0015;
  if n <> 0 then raise exception '#353 KY: % unexpected published pin(s) inside the box.', n; end if;

  -- Write: official coordinate (+ count only where blank) + provenance.
  -- Nothing else. Never is_indexable / is_featured / overnight / geo.
  update public.locations
     set lat = 38.27605548759607,
         lng = -84.55335544912026,
         geocode_source = 'batch-csv',
         geocode_confidence = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at = now(),
         updated_at = now()
   where id = 'a8a32662-d389-4d96-9653-6fde235726d0' and lat is null and lng is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '#353 KY: expected to enrich exactly 1 row, updated %.', n; end if;
end $$;
commit;

