-- NTAD canary — AS-EXECUTED guarded insert SQL (2026-07-28).
-- *** EXECUTED 2026-07-28 under the owner's five-row authorization. ***
-- Safe to re-run: every state block skips when its row already exists with
-- source 'ntad-2019-v04' (idempotent) and aborts on any identity or
-- collision surprise.
--
-- One guarded transaction per state (a failure quarantines only that
-- state). Each row lands UNPUBLISHED with parking_spaces NULL (no current
-- official count exists; CA's 24-vs-7 conflict stores neither figure) and
-- overnight_parking false (for DE, false is the STATE-CONFIRMED current
-- value: 10-hour maximum stay). is_featured / is_indexable are NOT written
-- (NOT NULL DEFAULT false). No geo write.
--
-- Execution note of record: the first attempt (staged without the
-- schema-required `type` and `slug` columns) failed closed on 23502 with
-- ZERO rows written; this file is the corrected, as-executed version.

-- STATE 1/5: VT
begin;
do $$
declare n int;
begin
  if exists (select 1 from public.locations where (detail_slug='guilford-welcome-center-i-91-north-guilford-vt' or slug='guilford-welcome-center-i-91-north') and source is distinct from 'ntad-2019-v04' and deleted_at is null) then
    raise exception 'VT: slug exists with different source - ABORT'; end if;
  if exists (select 1 from public.locations where detail_slug='guilford-welcome-center-i-91-north-guilford-vt' and source='ntad-2019-v04' and deleted_at is null) then
    raise notice 'VT: already inserted, skipping'; return; end if;
  perform 1 from public.locations l where l.deleted_at is null
    and l.lat between 42.812017-0.0015 and 42.812017+0.0015
    and l.lng between -72.5662-0.0015 and -72.5662+0.0015;
  if found then raise exception 'VT: unexpected pin in collision box - ABORT'; end if;
  insert into public.locations (type, name, state, city, slug, category_slug, detail_slug, lat, lng, parking_spaces, overnight_parking, is_published, source, description)
  values ('parking','Guilford Welcome Center (I-91 North)','VT','Guilford','guilford-welcome-center-i-91-north','parking','guilford-welcome-center-i-91-north-guilford-vt',42.812017,-72.5662,null,false,false,'ntad-2019-v04',
    'State welcome center on I-91 North at mile 5.6, before Exit 1. Confirmed active by the Vermont Information Centers Division (informationcenter.vermont.gov, 2026-07-28); dedicated truck/bus parking area on site. Truck space count not yet confirmed by a current official source. Construction advisory at verification time: overnight ramp-paving closures (9 p.m.-7 a.m. windows). Coordinate provenance: 2019 NTAD (Jason''s Law) survey.');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'VT: expected 1 insert, got % - ABORT', n; end if;
end $$;
commit;

-- STATE 2/5: ME
begin;
do $$
declare n int;
begin
  if exists (select 1 from public.locations where (detail_slug='kennebunk-service-plaza-i-95-northbound-kennebunk-me' or slug='kennebunk-service-plaza-i-95-northbound') and source is distinct from 'ntad-2019-v04' and deleted_at is null) then
    raise exception 'ME: slug exists with different source - ABORT'; end if;
  if exists (select 1 from public.locations where detail_slug='kennebunk-service-plaza-i-95-northbound-kennebunk-me' and source='ntad-2019-v04' and deleted_at is null) then
    raise notice 'ME: already inserted, skipping'; return; end if;
  perform 1 from public.locations l where l.deleted_at is null
    and l.lat between 43.410379-0.0015 and 43.410379+0.0015
    and l.lng between -70.55824-0.0015 and -70.55824+0.0015;
  if found then raise exception 'ME: unexpected pin in collision box - ABORT'; end if;
  insert into public.locations (type, name, state, city, slug, category_slug, detail_slug, lat, lng, parking_spaces, overnight_parking, is_published, source, description)
  values ('parking','Kennebunk Service Plaza (I-95 Northbound)','ME','Kennebunk','kennebunk-service-plaza-i-95-northbound','parking','kennebunk-service-plaza-i-95-northbound-kennebunk-me',43.410379,-70.55824,null,false,false,'ntad-2019-v04',
    'Maine Turnpike Authority service plaza, I-95 northbound at Mile 25. Confirmed active by the MTA (maineturnpike.com, 2026-07-28): 24-hour fuel and food, spaces for long-haul operators to park. Truck space count not yet confirmed by a current official source. Coordinate provenance: 2019 NTAD (Jason''s Law) survey.');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ME: expected 1 insert, got % - ABORT', n; end if;
end $$;
commit;

-- STATE 3/5: DE
begin;
do $$
declare n int;
begin
  if exists (select 1 from public.locations where (detail_slug='smyrna-rest-area-us-13-smyrna-de' or slug='smyrna-rest-area-us-13') and source is distinct from 'ntad-2019-v04' and deleted_at is null) then
    raise exception 'DE: slug exists with different source - ABORT'; end if;
  if exists (select 1 from public.locations where detail_slug='smyrna-rest-area-us-13-smyrna-de' and source='ntad-2019-v04' and deleted_at is null) then
    raise notice 'DE: already inserted, skipping'; return; end if;
  perform 1 from public.locations l where l.deleted_at is null
    and l.lat between 39.3235-0.0015 and 39.3235+0.0015
    and l.lng between -75.6175-0.0015 and -75.6175+0.0015;
  if found then raise exception 'DE: unexpected pin in collision box - ABORT'; end if;
  insert into public.locations (type, name, state, city, slug, category_slug, detail_slug, lat, lng, parking_spaces, overnight_parking, is_published, source, description)
  values ('parking','Smyrna Rest Area (US 13)','DE','Smyrna','smyrna-rest-area-us-13','parking','smyrna-rest-area-us-13-smyrna-de',39.3235,-75.6175,null,false,false,'ntad-2019-v04',
    'DelDOT rest area and visitor information center at US 13 / DE-1 Exit 119, open 24 hours (deldot.gov, 2026-07-28). Truck parking area with anti-idle hookups; posted truck-parking limit of 10 hours - overnight stays are restricted. Truck space count not yet confirmed by a current official source. Coordinate provenance: 2019 NTAD (Jason''s Law) survey.');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'DE: expected 1 insert, got % - ABORT', n; end if;
end $$;
commit;

-- STATE 4/5: CT
begin;
do $$
declare n int;
begin
  if exists (select 1 from public.locations where (detail_slug='darien-service-plaza-i-95-southbound-darien-ct' or slug='darien-service-plaza-i-95-southbound') and source is distinct from 'ntad-2019-v04' and deleted_at is null) then
    raise exception 'CT: slug exists with different source - ABORT'; end if;
  if exists (select 1 from public.locations where detail_slug='darien-service-plaza-i-95-southbound-darien-ct' and source='ntad-2019-v04' and deleted_at is null) then
    raise notice 'CT: already inserted, skipping'; return; end if;
  perform 1 from public.locations l where l.deleted_at is null
    and l.lat between 41.068057-0.0015 and 41.068057+0.0015
    and l.lng between -73.504342-0.0015 and -73.504342+0.0015;
  if found then raise exception 'CT: unexpected pin in collision box - ABORT'; end if;
  insert into public.locations (type, name, state, city, slug, category_slug, detail_slug, lat, lng, parking_spaces, overnight_parking, is_published, source, description)
  values ('parking','Darien Service Plaza (I-95 Southbound)','CT','Darien','darien-service-plaza-i-95-southbound','parking','darien-service-plaza-i-95-southbound-darien-ct',41.068057,-73.504342,null,false,false,'ntad-2019-v04',
    'CTDOT service plaza on I-95 southbound near mile 10 in Darien. Facility confirmed current by CTDOT program pages and 2024-2025 advisories (portal.ct.gov, 2026-07-28); I-95 plazas provide truck parking areas. Truck space count not yet confirmed by a current official source. Coordinate provenance: 2019 NTAD (Jason''s Law) survey.');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'CT: expected 1 insert, got % - ABORT', n; end if;
end $$;
commit;

-- STATE 5/5: CA
begin;
do $$
declare n int;
begin
  if exists (select 1 from public.locations where (detail_slug='gold-run-safety-roadside-rest-area-i-80-eastbound-gold-run-ca' or slug='gold-run-safety-roadside-rest-area-i-80-eastbound') and source is distinct from 'ntad-2019-v04' and deleted_at is null) then
    raise exception 'CA: slug exists with different source - ABORT'; end if;
  if exists (select 1 from public.locations where detail_slug='gold-run-safety-roadside-rest-area-i-80-eastbound-gold-run-ca' and source='ntad-2019-v04' and deleted_at is null) then
    raise notice 'CA: already inserted, skipping'; return; end if;
  perform 1 from public.locations l where l.deleted_at is null
    and l.lat between 39.17545-0.0015 and 39.17545+0.0015
    and l.lng between -120.85773-0.0015 and -120.85773+0.0015;
  if found then raise exception 'CA: unexpected pin in collision box - ABORT'; end if;
  insert into public.locations (type, name, state, city, slug, category_slug, detail_slug, lat, lng, parking_spaces, overnight_parking, is_published, source, description)
  values ('parking','Gold Run Safety Roadside Rest Area (I-80 Eastbound)','CA','Gold Run','gold-run-safety-roadside-rest-area-i-80-eastbound','parking','gold-run-safety-roadside-rest-area-i-80-eastbound-gold-run-ca',39.17545,-120.85773,null,false,false,'ntad-2019-v04',
    'Caltrans Safety Roadside Rest Area on I-80 eastbound in Placer County near Dutch Flat. Reopening confirmed by Caltrans District 3 (dot.ca.gov news release 23-027; verified 2026-07-28). Truck space count intentionally omitted: the 2019 federal survey and current Caltrans materials disagree, and neither figure is direction-confirmed for the eastbound side. Coordinate provenance: 2019 NTAD (Jason''s Law) survey.');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'CA: expected 1 insert, got % - ABORT', n; end if;
end $$;
commit;

-- HELD - deliberately absent from this file (see CANARY-MANIFEST.json):
--   AL Grand Bay Welcome Center (no current truck-parking evidence;
--   status unconfirmed), VT Guilford North Parking Area (identity hold),
--   ME NHS Rest Stop or Truck Facility 9 (identity hold).
