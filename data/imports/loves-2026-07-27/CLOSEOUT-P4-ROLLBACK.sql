-- Phase 4 rollback — de-enrich #451 IN and #317 VA, VALUE-MATCHED.
-- Prepared and committed BEFORE any write. Fires only if the row still holds
-- exactly the staged coordinate with batch-csv provenance; restores the
-- exact pre-write state (coordless, spaces NULL, no geocode metadata;
-- publication and overnight state were never touched by Phase 4).

begin;

-- #451 IN (1822b81f) — pre-write: published, overnight true, lat/lng NULL,
-- spaces NULL, interstate 'I-65', exit '95'.
update public.locations set
  lat = null, lng = null, parking_spaces = null,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
 where id = '1822b81f-648c-4711-a265-fe1800ccb423'
   and lat = 39.551539 and lng = -86.044627 and parking_spaces = 70
   and geocode_source = 'batch-csv';

-- #317 VA (5a5fa4df) — pre-write: unpublished, overnight false, lat/lng NULL,
-- spaces NULL, interstate 'I-95', exit '4'.
update public.locations set
  lat = null, lng = null, parking_spaces = null,
  geocode_source = null, geocode_confidence = null, coord_verification_status = null,
  last_geocoded_at = null, updated_at = now()
 where id = '5a5fa4df-c324-4405-bdb6-977ffb7f01a5'
   and lat = 36.605447 and lng = -77.560647 and parking_spaces = 72
   and geocode_source = 'batch-csv';

commit;
