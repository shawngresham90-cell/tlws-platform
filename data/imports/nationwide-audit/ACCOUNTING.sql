-- Reproduces classes 1-3 of ACCOUNTING.md from live data (read-only).
-- Classes 4-7 additionally require the committed Census results
-- (data/geocoding/census/raw/GeocodeResults.csv) joined to the class-3 pool.

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
)
SELECT
  count(*)                                                        AS unpublished_total,   -- 519
  count(*) FILTER (WHERE held_brand)                              AS class1_held_brand,   -- 101
  count(*) FILTER (WHERE NOT held_brand AND NOT street_addr)      AS class2_no_address,   -- 216
  count(*) FILTER (WHERE NOT held_brand AND street_addr)          AS addressable_pool     -- 202
FROM u;

-- The addressable pool minus the 28 mission-excluded ids (10 of which are in
-- the pool) is the 192-row candidate set that was joined to the Census results.
