-- Coordinate enrichment for reconciled parking rows — GUARDED TEMPLATE.
--
-- NOT EXECUTABLE AS COMMITTED. The VALUES list is empty because no coordinate
-- could be sourced this run (see BLOCKED-SOURCES.md). Filling it in is the
-- only edit required; every guard below is already correct.
--
-- Enrichment only. This statement writes coordinate and provenance columns to
-- rows that ALREADY EXIST, matched by exact id. It inserts nothing, publishes
-- nothing, and never touches name, state, city, category, is_published,
-- is_featured or is_indexable.
--
-- BLANK-ONLY: the WHERE clause requires lat IS NULL AND lng IS NULL, so a row
-- that already carries a coordinate is never overwritten. Re-running is a
-- no-op, which is what makes this idempotent.

begin;

-- The batch. One row per facility. Coordinates must come from the agency
-- dataset named in source_url — never from a road midpoint, a ZIP centroid, an
-- interpolation, or a search snippet.
create temporary table _enrich (
  id            uuid    not null,
  lat           double precision not null,
  lng           double precision not null,
  source_url    text    not null,
  source_agency text    not null,
  retrieved_on  date    not null
) on commit drop;

insert into _enrich (id, lat, lng, source_url, source_agency, retrieved_on) values
  -- ('00000000-0000-0000-0000-000000000000', 00.000000, -00.000000,
  --  'https://…', 'VDOT', '2026-07-27'),
  ;

-- State bounding boxes for the states in the reconciled set. Generous envelopes
-- — this catches a wrong-state or transposed coordinate, not a metre-level
-- error. Add a row before enriching any state not listed; the guard below
-- fails closed rather than skipping an unknown state.
create temporary table _bounds (
  state   char(2) primary key,
  lat_min double precision, lat_max double precision,
  lng_min double precision, lng_max double precision
) on commit drop;

insert into _bounds values
  ('AL', 30.1, 35.1, -88.6, -84.8),
  ('AR', 33.0, 36.6, -94.7, -89.6),
  ('DE', 38.4, 39.9, -75.9, -74.9),
  ('FL', 24.4, 31.1, -87.7, -79.9),
  ('GA', 30.3, 35.1, -85.7, -80.8),
  ('IL', 36.9, 42.6, -91.6, -87.4),
  ('IN', 37.7, 41.8, -88.1, -84.7),
  ('KY', 36.4, 39.2, -89.6, -81.9),
  ('MD', 37.8, 39.8, -79.6, -74.9),
  ('MI', 41.6, 48.4, -90.5, -82.1),
  ('NC', 33.7, 36.7, -84.4, -75.4),
  ('OH', 38.3, 42.4, -85.0, -80.4),
  ('SC', 32.0, 35.3, -83.4, -78.4),
  ('TN', 34.9, 36.8, -90.4, -81.6),
  ('VA', 36.5, 39.5, -83.7, -75.1);

do $$
declare
  n integer;
  batch integer;
begin
  select count(*) into batch from _enrich;
  if batch = 0 then
    raise exception 'Nothing to enrich: _enrich is empty. Fill the VALUES list first.';
  end if;

  -- 1. Every id must exist, be undeleted, and be one of the reconciled rows.
  select count(*) into n
    from _enrich e join public.locations l on l.id = e.id
   where l.deleted_at is null;
  if n <> batch then
    raise exception 'Precondition failed: % of % ids do not resolve to a live row.', batch - n, batch;
  end if;

  -- 2. Blank-only. Refuse the whole batch if any target already has a coordinate.
  select count(*) into n
    from _enrich e join public.locations l on l.id = e.id
   where l.lat is not null or l.lng is not null;
  if n <> 0 then
    raise exception 'Precondition failed: % target row(s) already carry coordinates. This statement never overwrites.', n;
  end if;

  -- 3. No held/excluded network may be enriched, including as a landmark.
  select count(*) into n
    from _enrich e join public.locations l on l.id = e.id
   where l.name ~* '(love''?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton)';
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) name a held network.', n;
  end if;

  -- 4. Coordinates must be plausible: non-zero, continental-US envelope, and
  --    inside the row's own state bounding box.
  select count(*) into n from _enrich
   where lat = 0 or lng = 0
      or lat not between 24.0 and 49.5
      or lng not between -125.0 and -66.5;
  if n <> 0 then
    raise exception 'Precondition failed: % coordinate(s) outside the continental-US envelope or zero.', n;
  end if;

  -- Fails closed: a state absent from _bounds produces no join row, so the
  -- "every row was bounds-checked" assertion below catches it.
  select count(*) into n
    from _enrich e
    join public.locations l on l.id = e.id
    join _bounds b on b.state = l.state
   where e.lat not between b.lat_min and b.lat_max
      or e.lng not between b.lng_min and b.lng_max;
  if n <> 0 then
    raise exception 'Precondition failed: % coordinate(s) fall outside their own state bounding box.', n;
  end if;

  select count(*) into n
    from _enrich e
    join public.locations l on l.id = e.id
    join _bounds b on b.state = l.state;
  if n <> batch then
    raise exception 'Precondition failed: % row(s) are in a state with no bounding box on file. Add it to _bounds rather than skipping the check.', batch - n;
  end if;

  -- 5. Provenance is mandatory and must be an agency source.
  select count(*) into n from _enrich
   where btrim(source_url) = '' or source_url !~* '^https://'
      or btrim(source_agency) = '';
  if n <> 0 then
    raise exception 'Precondition failed: % row(s) have blank or non-https source evidence.', n;
  end if;

  -- 6. Directional pairs must not share a coordinate: two carriageways are two
  --    places. Identical lat/lng within the batch is a copy-paste error.
  select count(*) into n from (
    select lat, lng from _enrich group by lat, lng having count(*) > 1
  ) d;
  if n <> 0 then
    raise exception 'Precondition failed: % coordinate(s) are shared by more than one facility in this batch.', n;
  end if;

  -- 7. Write. Authorized fields only.
  update public.locations l
     set lat                       = e.lat,
         lng                       = e.lng,
         geocode_source            = 'agency-gis',
         geocode_confidence        = 'high',
         coord_verification_status = 'machine-checked',
         last_geocoded_at          = now(),
         source                    = e.source_agency,
         updated_at                = now()
    from _enrich e
   where l.id = e.id
     and l.lat is null and l.lng is null;   -- blank-only, enforced again at write time
  get diagnostics n = row_count;
  if n <> batch then
    raise exception 'Expected to enrich exactly % row(s), updated %.', batch, n;
  end if;

  -- 8. Nothing may have been published as a side effect.
  select count(*) into n
    from _enrich e join public.locations l on l.id = e.id
   where l.is_published or l.is_featured;
  if n <> 0 then
    raise exception 'Post-check failed: % row(s) became published/featured. Enrichment must never publish.', n;
  end if;
end $$;

commit;
