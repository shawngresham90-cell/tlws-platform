-- Nationwide truck-parking expansion — reproducible read-only reconciliation.
--
-- READ-ONLY. Every statement is a SELECT. This is the query that produced
-- RECONCILIATION-216.csv; running it again reproduces that file's contents.
--
-- Scope: the 216 "no usable street address" rows (class 2 of
-- data/imports/nationwide-audit/ACCOUNTING.md), reproduced here against live
-- data and then classified individually. Nothing is discarded.
--
-- Verification: the id set of this query digests to
--   1d707c73ad5f2aad741a20b7d88c7d92
-- which is byte-identical to the id digest of RECONCILIATION-216.csv.

WITH u AS (
  SELECT *,
    (name ~* '(love''?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton)'
     OR coalesce(description,'') ~* '(love''?s travel|pilot travel|flying\s*j|sapp\s*bros|goasis|thornton)')
      AS held_brand,
    (address IS NOT NULL AND btrim(address) <> ''
     AND address !~* 'mile marker|median service|(north|south|east|west)bound|^i-\d|near us|exit \d')
      AS street_addr
  FROM public.locations
  WHERE NOT is_published AND deleted_at IS NULL
),
class2 AS (SELECT * FROM u WHERE NOT held_brand AND NOT street_addr),
typed AS (
  SELECT *,
    -- Facility typing. Order matters: a row TDOT converted from a weigh
    -- station into truck parking is PARKING, so it is matched before the
    -- generic weigh/inspection rule that its name would otherwise trip.
    CASE
      WHEN name ~* 'truck parking area .*former|former .*weigh station'      THEN 'truck_parking'
      WHEN name ~* 'welcome cent'                                            THEN 'welcome_center'
      WHEN name ~* 'service plaza|travel plaza|service area'                 THEN 'service_plaza'
      WHEN name ~* 'weigh|inspection|scale house|scale complex|check station|port of entry'
                                                                             THEN 'weigh_inspection'
      WHEN name ~* 'rest area|rest stop|safety rest|rest plaza'              THEN 'rest_area'
      WHEN name ~* 'truck parking|parking area|parking hub|truck hub|turnout|staging|overnight|parking club|parking lot|parking -'
                                                                             THEN 'truck_parking'
      ELSE 'non_parking_business'
    END AS facility_type,
    -- Source authority. A state DOT / agency domain is primary; a tourism
    -- board or a third-party rest-area aggregator is not, however accurate it
    -- may happen to be.
    CASE WHEN website ~* '\.gov|dot\.|state\.|maryland\.gov' THEN 'official'
         WHEN website IS NOT NULL                            THEN 'third_party'
         ELSE 'none' END AS source_class,
    -- coalesce is load-bearing: `NULL ~* ...` is NULL, and `NOT NULL` is NULL,
    -- so a row with no description would fall THROUGH its quarantine branch
    -- into the ELSE. 23 of the 216 have no description.
    (coalesce(description,'') ~* 'truck park|truck spac|tractor-trailer|truck spots|semi park|truck/rv') AS truck_parking_evidence,
    coalesce(CASE
      WHEN name ~* '\m(nb|northbound)\M' THEN 'NB'
      WHEN name ~* '\m(sb|southbound)\M' THEN 'SB'
      WHEN name ~* '\m(eb|eastbound)\M'  THEN 'EB'
      WHEN name ~* '\m(wb|westbound)\M'  THEN 'WB'
      ELSE '' END, '') AS direction
  FROM class2
)
SELECT
  id, state, interstate, category_slug, facility_type, direction,
  source_class,
  CASE WHEN truck_parking_evidence THEN 'yes' ELSE 'no' END AS truck_parking_evidence,
  CASE
    WHEN facility_type = 'non_parking_business'
      THEN 'C:out-of-scope-not-parking'
    -- A weigh station is not parking unless an authoritative source says a
    -- driver may park there. Default is refusal, never assumption.
    WHEN facility_type = 'weigh_inspection' AND NOT truck_parking_evidence
      THEN 'C:quarantine-inspection-only-no-parking-evidence'
    WHEN facility_type = 'weigh_inspection'
      THEN 'C:quarantine-weigh-needs-parking-confirmation'
    WHEN source_class <> 'official'
      THEN 'C:quarantine-no-official-source'
    WHEN NOT truck_parking_evidence
      THEN 'C:quarantine-truck-parking-unconfirmed'
    -- Everything a Tier-A row needs EXCEPT a rooftop coordinate, which no
    -- reachable source can currently supply (see BLOCKED-SOURCES.md).
    ELSE 'A-PENDING-COORDINATE'
  END AS tier_disposition,
  name
FROM typed
ORDER BY facility_type, state, name;

-- Integrity checks for the CSV -------------------------------------------
--
-- SELECT count(*), md5(string_agg(id::text, '' ORDER BY id::text)) FROM ...
--   expected: 216, 1d707c73ad5f2aad741a20b7d88c7d92
--
-- Distribution, expected:
--   non_parking_business 92 · rest_area 44 · weigh_inspection 43
--   welcome_center 18 · truck_parking 14 · service_plaza 5
--
-- Dispositions, expected:
--   C:out-of-scope-not-parking                        92
--   C:quarantine-inspection-only-no-parking-evidence  42
--   A-PENDING-COORDINATE                              35
--   C:quarantine-no-official-source                   29
--   C:quarantine-truck-parking-unconfirmed            17
--   C:quarantine-weigh-needs-parking-confirmation      1
--                                                    ---
--                                                    216
