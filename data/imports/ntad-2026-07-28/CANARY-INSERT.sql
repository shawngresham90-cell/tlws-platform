-- NTAD canary — guarded, idempotent INSERT package (2026-07-28).
-- *** PREPARED ONLY — NOT EXECUTED. Execution requires a separate, explicit
-- owner authorization. ***
--
-- Five fully verified public facilities (see CANARY-EVIDENCE.md), inserted
-- UNPUBLISHED with source 'ntad-2019-v04'. Fields deliberately NOT set:
-- parking_spaces (no current official count — NULL, so the row can never
-- enter any parking recommendation), overnight_parking (false — not
-- confirmed; for DE, false is the STATE-CONFIRMED current value: 10-hour
-- maximum stay), geo, is_featured, is_indexable (defaults; never written).
--
-- Guards per row, inside one transaction:
--  * duplicate slug with a DIFFERENT source -> abort (identity conflict);
--  * duplicate slug with THIS source -> skip (idempotent re-run);
--  * any live row within +/-0.0015 degrees -> abort (collision; offline
--    review 2026-07-28 found zero within 250 m for all five);
--  * exactly one row inserted otherwise.

begin;

do $$
declare
  n int;
  inserted int := 0;
  skipped int := 0;
  r record;
begin
  for r in
    select * from (values
      ('Guilford Welcome Center (I-91 North)', 'VT', 'Guilford',
       42.812017, -72.5662,
       'guilford-welcome-center-i-91-north-guilford-vt',
       'State welcome center on I-91 North at mile 5.6, before Exit 1. Confirmed active by the Vermont Information Centers Division (informationcenter.vermont.gov, 2026-07-28); dedicated truck/bus parking area on site. Truck space count not yet confirmed by a current official source. Construction advisory at verification time: overnight ramp-paving closures (9 p.m.-7 a.m. windows).'),
      ('Kennebunk Service Plaza (I-95 Northbound)', 'ME', 'Kennebunk',
       43.410379, -70.55824,
       'kennebunk-service-plaza-i-95-northbound-kennebunk-me',
       'Maine Turnpike Authority service plaza, I-95 northbound at Mile 25. Confirmed active by the MTA (maineturnpike.com, 2026-07-28): 24-hour fuel and food, spaces for long-haul operators to park. Truck space count not yet confirmed by a current official source.'),
      ('Smyrna Rest Area (US 13)', 'DE', 'Smyrna',
       39.3235, -75.6175,
       'smyrna-rest-area-us-13-smyrna-de',
       'DelDOT rest area and visitor information center at US 13 / DE-1 Exit 119, open 24 hours (deldot.gov, 2026-07-28). Truck parking area with anti-idle hookups; posted truck-parking limit of 10 hours - overnight stays are restricted. Truck space count not yet confirmed by a current official source.'),
      ('Darien Service Plaza (I-95 Southbound)', 'CT', 'Darien',
       41.068057, -73.504342,
       'darien-service-plaza-i-95-southbound-darien-ct',
       'CTDOT service plaza on I-95 southbound near mile 10 in Darien. Facility confirmed current by CTDOT program pages and 2024-2025 advisories (portal.ct.gov, 2026-07-28); I-95 plazas provide truck parking areas. Truck space count not yet confirmed by a current official source.'),
      ('Gold Run Safety Roadside Rest Area (I-80 Eastbound)', 'CA', 'Gold Run',
       39.17545, -120.85773,
       'gold-run-safety-roadside-rest-area-i-80-eastbound-gold-run-ca',
       'Caltrans Safety Roadside Rest Area on I-80 eastbound in Placer County near Dutch Flat. Reopening confirmed by Caltrans District 3 (dot.ca.gov news release 23-027; verified 2026-07-28). Truck space count intentionally omitted: the 2019 federal survey and current Caltrans materials disagree, and neither figure is direction-confirmed for the eastbound side.')
    ) as v(name, state, city, lat, lng, detail_slug, description)
  loop
    -- Identity guard: same slug from a different source is a conflict.
    if exists (select 1 from public.locations
                where detail_slug = r.detail_slug
                  and source is distinct from 'ntad-2019-v04'
                  and deleted_at is null) then
      raise exception 'NTAD canary %: slug % exists with a different source - ABORT',
        r.state, r.detail_slug;
    end if;

    -- Idempotency: already inserted by this package -> skip.
    if exists (select 1 from public.locations
                where detail_slug = r.detail_slug
                  and source = 'ntad-2019-v04'
                  and deleted_at is null) then
      skipped := skipped + 1;
      continue;
    end if;

    -- Collision guard: no live row of any kind within the box.
    perform 1 from public.locations l
      where l.deleted_at is null
        and l.lat between r.lat - 0.0015 and r.lat + 0.0015
        and l.lng between r.lng - 0.0015 and r.lng + 0.0015;
    if found then
      raise exception 'NTAD canary %: unexpected pin within collision box of % - ABORT',
        r.state, r.name;
    end if;

    insert into public.locations
      (name, state, city, category_slug, detail_slug, lat, lng,
       parking_spaces, overnight_parking, is_published, source, description)
    values
      (r.name, r.state, r.city, 'parking', r.detail_slug, r.lat, r.lng,
       null, false, false, 'ntad-2019-v04', r.description);
    get diagnostics n = row_count;
    if n <> 1 then
      raise exception 'NTAD canary %: expected exactly 1 insert, got % - ABORT', r.state, n;
    end if;
    inserted := inserted + 1;
  end loop;

  if inserted + skipped <> 5 then
    raise exception 'NTAD canary: expected 5 rows processed, got % inserted + % skipped - ABORT',
      inserted, skipped;
  end if;
  raise notice 'NTAD canary: % inserted, % skipped (idempotent)', inserted, skipped;
end $$;

commit;

-- HELD - deliberately absent from this file (see CANARY-MANIFEST.json):
--   AL Grand Bay Welcome Center (no current truck-parking evidence;
--   status unconfirmed), VT Guilford North Parking Area (identity hold),
--   ME NHS Rest Stop or Truck Facility 9 (identity hold).
