-- =====================================================================
-- READ-ONLY AUDIT QUERIES — truck parking verification, 2026-07-31.
--
-- Every statement here is a SELECT. Nothing in this file writes, and
-- nothing in this repository runs it automatically. It is committed so the
-- findings in parking-verification-audit-2026-07-31.md can be reproduced
-- and re-checked later against the same definitions.
--
-- The eligibility definitions are taken from the application code, not
-- restated by hand:
--   planner pool          lib/trip-planner/directory-loader.ts
--   parking_spaces > 0    lib/trip-planner/directory-layer.ts
--                         (hasConfirmedTruckParking — zero-space safety rule)
--   overnight vocabulary  lib/directory/overnight.ts
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Baseline metrics (§2 of the report)
-- ---------------------------------------------------------------------
WITH b AS (SELECT * FROM locations WHERE deleted_at IS NULL)
SELECT
  count(*)                                                                        AS all_rows,
  count(*) FILTER (WHERE is_published)                                            AS published,
  count(*) FILTER (WHERE is_published AND lat IS NOT NULL AND lng IS NOT NULL)    AS planner_pool,
  count(*) FILTER (WHERE is_published AND lat IS NOT NULL AND lng IS NOT NULL
                     AND parking_spaces > 0)                                      AS planner_parking_eligible,
  count(*) FILTER (WHERE is_published AND parking_spaces > 0)                     AS driver_useful_parking,
  count(*) FILTER (WHERE is_published AND interstate IS NOT NULL
                     AND exit_number IS NOT NULL)                                 AS route_usable,
  count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL)                     AS has_coords_all,
  count(*) FILTER (WHERE is_published AND (lat IS NULL OR lng IS NULL))           AS published_no_coords,
  count(*) FILTER (WHERE overnight_status = 'confirmed')                          AS on_confirmed,
  count(*) FILTER (WHERE overnight_status = 'prohibited')                         AS on_prohibited,
  count(*) FILTER (WHERE overnight_status = 'unknown' OR overnight_status IS NULL) AS on_unknown
FROM b;


-- ---------------------------------------------------------------------
-- 2. Provenance + contradiction checks (§3.1, §3.7, §3.8, §3.9)
-- ---------------------------------------------------------------------
WITH b AS (SELECT * FROM locations WHERE deleted_at IS NULL)
SELECT
  count(*) FILTER (WHERE overnight_status = 'confirmed'
                     AND (overnight_status_source IS NULL
                       OR overnight_status_source = ''))          AS confirmed_no_source,
  count(*) FILTER (WHERE overnight_status = 'confirmed'
                     AND overnight_status_verified_at IS NULL)    AS confirmed_no_verified_at,
  count(*) FILTER (WHERE overnight_status = 'confirmed'
                     AND parking_spaces IS NULL)                  AS confirmed_but_no_space_count,
  count(*) FILTER (WHERE lat IS NOT NULL
                     AND coord_verification_status IS NULL)       AS coords_no_provenance,
  count(*) FILTER (WHERE lat IS NOT NULL AND geocode_source IS NULL) AS coords_no_geocode_source,
  count(*) FILTER (WHERE manually_verified_at IS NOT NULL)        AS manually_verified,
  count(*) FILTER (WHERE verified_at IS NOT NULL)                 AS verified_at_set,
  count(*) FILTER (WHERE is_published AND interstate IS NOT NULL
                     AND exit_number IS NULL)                     AS pub_interstate_no_exit,
  count(*) FILTER (WHERE is_published AND interstate IS NULL
                     AND exit_number IS NOT NULL)                 AS pub_exit_no_interstate,
  count(*) FILTER (WHERE is_published AND interstate IS NULL
                     AND exit_number IS NULL)                     AS pub_no_route_at_all,
  count(*) FILTER (WHERE exit_number ~* '^\s*mile')               AS exit_field_holds_mile_ref,
  count(*) FILTER (WHERE exit_number ~ '[/]')                     AS exit_holds_two_values,
  count(*) FILTER (WHERE is_published AND parking_spaces = 0)     AS published_zero_spaces,
  count(*) FILTER (WHERE interstate IS NOT NULL
                     AND interstate !~ '^I-[0-9]+$')              AS interstate_nonstandard
FROM b;


-- ---------------------------------------------------------------------
-- 3. ZIP/state consistency (§3.2) — INTERNAL evidence only.
--
-- The expected state for a ZIP-3 prefix is learned from this database's own
-- rows, never asserted from outside. The majority verdict must itself be
-- attested by at least 3 rows before it may contradict anything.
-- Result on 2026-07-31: 0 rows.
-- ---------------------------------------------------------------------
WITH b AS (SELECT * FROM locations WHERE deleted_at IS NULL),
z AS (
  SELECT left(zip,3) AS zip3, state, count(*) AS n
    FROM b WHERE zip ~ '^[0-9]{5}' GROUP BY 1,2
),
dom AS (
  SELECT DISTINCT ON (zip3) zip3, state AS dom_state, n AS dom_n
    FROM z ORDER BY zip3, n DESC
),
tot AS (SELECT zip3, sum(n) AS total FROM z GROUP BY zip3)
SELECT b.id, b.name, b.city, b.state AS row_state, b.zip, d.dom_state, d.dom_n
  FROM b
  JOIN dom d ON d.zip3 = left(b.zip,3)
  JOIN tot t ON t.zip3 = left(b.zip,3)
 WHERE b.zip ~ '^[0-9]{5}'
   AND b.state <> d.dom_state
   AND d.dom_n >= 3
   AND t.total >= 4;


-- ---------------------------------------------------------------------
-- 4. Duplicate modality A — same address AND same category (§3.4).
-- The only true-duplicate shape. Result on 2026-07-31: 1 pair, already
-- suppressed (one row published, one not).
-- ---------------------------------------------------------------------
WITH n AS (
  SELECT id, name, city, state, category_slug, is_published, parking_spaces,
         exit_number, source, created_at,
         lower(regexp_replace(coalesce(address,''), '[^a-zA-Z0-9]+', ' ', 'g')) AS addr_n
    FROM locations
   WHERE deleted_at IS NULL AND address IS NOT NULL AND address <> ''
)
SELECT addr_n, city, state, category_slug, count(*) AS n,
       array_agg(name ORDER BY created_at)          AS names,
       array_agg(id::text ORDER BY created_at)      AS ids,
       array_agg(is_published ORDER BY created_at)  AS published,
       array_agg(coalesce(source,'-') ORDER BY created_at) AS sources
  FROM n
 GROUP BY addr_n, city, state, category_slug
HAVING count(*) > 1
 ORDER BY state, city;


-- ---------------------------------------------------------------------
-- 5. Capacity double-counting at shared addresses (§3.5).
--
-- Co-located rows (travel center + scale + tire bay + wash at one address)
-- are legitimate and must NOT be collapsed. The defect is that several
-- repeat the SAME parking count, so summing across rows overstates real
-- capacity. Result on 2026-07-31: 13 addresses, 16 redundant rows,
-- 2,189 double-counted spaces.
-- ---------------------------------------------------------------------
WITH n AS (
  SELECT id, is_published, parking_spaces,
         city, state,
         lower(regexp_replace(coalesce(address,''), '[^a-zA-Z0-9]+', ' ', 'g')) AS addr_n
    FROM locations
   WHERE deleted_at IS NULL AND address IS NOT NULL AND address <> ''
),
grp AS (
  SELECT addr_n, city, state,
         count(*)                                                        AS rows_at_addr,
         count(*) FILTER (WHERE parking_spaces > 0)                      AS rows_with_spaces,
         count(DISTINCT parking_spaces) FILTER (WHERE parking_spaces > 0) AS distinct_space_values,
         max(parking_spaces)                                             AS max_spaces,
         sum(parking_spaces) FILTER (WHERE parking_spaces > 0
                                       AND is_published)                 AS summed_published
    FROM n GROUP BY addr_n, city, state
)
SELECT
  count(*) FILTER (WHERE rows_at_addr > 1)      AS addresses_with_multiple_rows,
  count(*) FILTER (WHERE rows_with_spaces > 1)  AS addresses_with_multiple_space_counts,
  count(*) FILTER (WHERE rows_with_spaces > 1
                     AND distinct_space_values = 1) AS addresses_repeating_same_count,
  sum(summed_published - max_spaces) FILTER (WHERE rows_with_spaces > 1
                     AND distinct_space_values = 1) AS double_counted_spaces,
  sum(rows_with_spaces - 1) FILTER (WHERE rows_with_spaces > 1
                     AND distinct_space_values = 1) AS redundant_rows
FROM grp;


-- ---------------------------------------------------------------------
-- 6. Coordinate collisions between DISTINCT businesses (§3.6).
--
-- Two different street addresses cannot share one point, so at least one
-- row in each pair is imprecise. Which one is wrong cannot be decided
-- without an authoritative geocoder — these are quarantine candidates,
-- not corrections. Result on 2026-07-31: 4 pairs.
-- ---------------------------------------------------------------------
WITH c AS (
  SELECT id, name, city, state, category_slug, address, lat, lng
    FROM locations
   WHERE deleted_at IS NULL AND lat IS NOT NULL AND lng IS NOT NULL
)
SELECT round(lat::numeric,5) AS lat5, round(lng::numeric,5) AS lng5, category_slug,
       count(*) AS n,
       array_agg(name ORDER BY name)              AS names,
       array_agg(coalesce(address,'-') ORDER BY name) AS addrs
  FROM c
 GROUP BY 1,2,3
HAVING count(*) > 1
 ORDER BY count(*) DESC;


-- ---------------------------------------------------------------------
-- 7. The recoverable queue (§4): published, states a positive parking
-- count, but has no coordinates — driver-useful yet invisible to the
-- Trip Planner and Near Me. Result on 2026-07-31: 79 rows.
--
-- Before acting on this list, apply the exclusions:
--   category_slug = 'cat-scales'                  -> prohibited
--   Love's / Pilot / Flying J / ONE9 / TA / Petro -> completed operator work
-- ---------------------------------------------------------------------
SELECT id, name, city, state, address, zip, interstate, exit_number,
       parking_spaces, category_slug, source, overnight_status
  FROM locations
 WHERE deleted_at IS NULL
   AND is_published
   AND (lat IS NULL OR lng IS NULL)
   AND parking_spaces > 0
 ORDER BY state, city, name;


-- ---------------------------------------------------------------------
-- 8. Where the coordinate gap concentrates, by state (§4).
-- ---------------------------------------------------------------------
WITH b AS (SELECT * FROM locations WHERE deleted_at IS NULL AND is_published)
SELECT state,
       count(*)                                              AS published,
       count(*) FILTER (WHERE lat IS NOT NULL)               AS with_coords,
       count(*) FILTER (WHERE lat IS NULL)                   AS missing_coords,
       count(*) FILTER (WHERE parking_spaces > 0)            AS driver_useful,
       count(*) FILTER (WHERE parking_spaces > 0
                          AND lat IS NULL)                   AS useful_but_invisible
  FROM b
 GROUP BY state
HAVING count(*) FILTER (WHERE lat IS NULL) > 0
 ORDER BY 6 DESC, 4 DESC;
