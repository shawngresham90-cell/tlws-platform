-- Pilot / Flying J / ONE9 publication CANARY — 10 locations, GUARDED.
--
-- NOT EXECUTED. Publication requires separate authorization, distinct from
-- insertion and from enrichment.
--
-- Source of record: all_locations.csv
-- sha256 d39ab57d51999f2468ff2f32790f8ab43a20b859559b0052e353272c9d1e330a
-- 875 official-network locations: 820 U.S. + 55 Canada.
-- Independently verified: 43 U.S. states, 803 U.S. with a positive parking
-- count, 17 with zero, 72,189 stated U.S. spaces, no duplicate store numbers,
-- coordinates or name/address/state triples.
--
-- CANADA IS EXCLUDED FROM EVERY U.S. DENOMINATOR. 875 is never the U.S. number.
--
-- BRAND IDENTITY IS PRESERVED. The operator's own Name value is stored verbatim
-- and the stable store number is appended. Nothing is renamed to "Pilot":
-- Pilot Travel Center, Flying J Travel Center, ONE9 Travel Center, ONE9 Dealer,
-- Pilot Dealer, Mr. Fuel Travel Center, Pilot Licensed Location, Flying J
-- Cardlock, Shell Cardlock, EZ Trip, Xpress Fuel, Pride, Stamart and Arco all
-- keep their published names.
--
-- OVERNIGHT PERMISSION IS NOT IN THIS EXPORT AND IS NOT INVENTED.
-- locations.overnight_parking is NOT NULL DEFAULT false, so it cannot hold
-- "unknown". Every row this package touches therefore lands at false, which
-- here means NOT CONFIRMED, not "prohibited". A positive operator space count
-- confirms truck parking for directory and map purposes only. No row from this
-- import may be offered as overnight or HOS-rest parking, and parking
-- restrictions and duration limits stay unknown, until another authoritative
-- source states them.
--
-- Ten locations with a positive official parking-space count, each in a
-- different state and on a different corridor, spread across the country
-- (max 3 per region) and weighted to corridors the directory currently has no
-- published parking on. Every one must already have been inserted by
-- INSERT-NET-NEW.sql and therefore already carries an operator coordinate.
--
--   1. #876  Flying J Travel Center, Ruther Glen, VA  I-95  250 spaces  [SE]
--   2. #904  Flying J Travel Center, Big Springs, NE  I-80  500 spaces  [MW]
--   3. #646  Flying J Travel Center, South Beloit, IL  I-90  186 spaces  [MW]
--   4. #650  Flying J Travel Center, Lake Station, IN  I-94  375 spaces  [MW]
--   5. #690  Flying J Travel Center, Lordsburg, NM  I-10  265 spaces  [SW]
--   6. #381  Pilot Travel Center, Hesperia, CA  I-15  217 spaces  [W]
--   7. #621  Flying J Travel Center, Limon, CO  I-70  162 spaces  [W]
--   8. #432  Pilot Travel Center, Waco, TX  I-35  271 spaces  [SW]
--   9. #233  Flying J Travel Center, Oakland, OR  I-5  140 spaces  [W]
--  10. #222  Pilot Travel Center, Sturbridge, MA  I-84  108 spaces  [NE]
--
-- Publishing these makes them visible as TRUCK PARKING. It does NOT make them
-- overnight or HOS-rest recommendations; overnight_parking stays false.

begin;

create temporary table _canary (source_ref text primary key, state char(2)) on commit drop;
insert into _canary values
  ('876', 'VA'),
  ('904', 'NE'),
  ('646', 'IL'),
  ('650', 'IN'),
  ('690', 'NM'),
  ('381', 'CA'),
  ('621', 'CO'),
  ('432', 'TX'),
  ('233', 'OR'),
  ('222', 'MA');

do $$
declare n integer;
begin
  -- 1. All ten resolve to exactly one unpublished network row each.
  select count(*) into n
    from _canary c join public.locations l
      on l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
   where l.deleted_at is null and l.category_slug = 'truck-stops'
     and l.source = 'pilot-master-2026-07-27';
  if n <> 10 then raise exception 'Expected 10 canary rows, matched %.', n; end if;

  -- 2. COORDINATES REQUIRED.
  select count(*) into n
    from _canary c join public.locations l
      on l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
   where l.source = 'pilot-master-2026-07-27' and (l.lat is null or l.lng is null);
  if n <> 0 then raise exception '% canary row(s) have no coordinate.', n; end if;

  -- 3. POSITIVE OFFICIAL PARKING COUNT REQUIRED. A zero-space location may
  --    never enter a parking canary.
  select count(*) into n
    from _canary c join public.locations l
      on l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
   where l.source = 'pilot-master-2026-07-27' and coalesce(l.parking_spaces, 0) < 1;
  if n <> 0 then raise exception '% canary row(s) have no stated parking spaces.', n; end if;

  -- 4. None already published (idempotent).
  select count(*) into n
    from _canary c join public.locations l
      on l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
   where l.source = 'pilot-master-2026-07-27' and l.is_published;
  if n <> 0 then raise exception '% canary row(s) are already published.', n; end if;

  -- 5. Publish. is_featured, is_indexable and overnight_parking untouched.
  update public.locations l
     set is_published = true, updated_at = now()
    from _canary c
   where l.state = c.state and substring(l.name from '#\s*(\d+)') = c.source_ref
     and l.category_slug = 'truck-stops' and l.source = 'pilot-master-2026-07-27'
     and l.lat is not null and l.lng is not null and coalesce(l.parking_spaces, 0) > 0;
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'Expected to publish exactly 10 row(s), published %.', n; end if;

  -- 6. Publication must not have claimed overnight parking.
  select count(*) into n from public.locations
   where source = 'pilot-master-2026-07-27' and is_published and overnight_parking;
  if n <> 0 then raise exception 'Post-check failed: % published row(s) claim overnight parking.', n; end if;
end $$;

commit;
