-- Nationwide audit — read-only verification queries.

-- 1) Table-wide invariants (expected after the run:
--    total 1556, published 1165, unpublished 391, coords 534, geo 0, indexable 0)
SELECT count(*) AS total,
       count(*) FILTER (WHERE is_published) AS published,
       count(*) FILTER (WHERE NOT is_published) AS unpublished,
       count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS has_coords,
       count(*) FILTER (WHERE geo IS NOT NULL) AS has_geo,
       count(*) FILTER (WHERE is_indexable) AS indexable,
       count(*) FILTER (WHERE geocode_source = 'batch-csv') AS batch_csv
FROM public.locations WHERE deleted_at IS NULL;

-- 2) Per-state / per-category result for the newly published rows
SELECT state, category_slug, count(*) AS published_now
FROM public.locations
WHERE geocode_source = 'batch-csv' AND is_published
GROUP BY state, category_slug ORDER BY state, category_slug;

-- 3) Held/excluded-network integrity: must remain unpublished with no coordinates
SELECT count(*) AS held_rows,
       count(*) FILTER (WHERE is_published) AS held_published,
       count(*) FILTER (WHERE lat IS NOT NULL) AS held_with_coords
FROM public.locations
WHERE deleted_at IS NULL
  AND (name ~* '(love''?s|pilot|flying\s*j|sapp\s*bros|goasis|thornton)'
    OR coalesce(description,'') ~* '(love''?s travel|pilot travel|flying\s*j|sapp\s*bros|goasis|thornton)')
  AND NOT is_published;

-- 4) Coordinate-proximity collisions among all coordinate-bearing rows (<60 m).
--    Expected: only documented legitimate colocations (a scale/service sharing a
--    truck-stop address), never two rows describing the same business.
WITH c AS (SELECT id, name, address, city, state, category_slug, lat, lng
           FROM public.locations WHERE lat IS NOT NULL AND deleted_at IS NULL)
SELECT a.state, a.city, a.name AS a_name, a.category_slug AS a_cat,
       b.name AS b_name, b.category_slug AS b_cat,
       round((6371000*acos(least(1,greatest(-1,
         cos(radians(a.lat))*cos(radians(b.lat))*cos(radians(b.lng)-radians(a.lng))
         + sin(radians(a.lat))*sin(radians(b.lat))))))::numeric,0) AS dist_m
FROM c a JOIN c b ON a.id < b.id
WHERE (6371000*acos(least(1,greatest(-1,
        cos(radians(a.lat))*cos(radians(b.lat))*cos(radians(b.lng)-radians(a.lng))
        + sin(radians(a.lat))*sin(radians(b.lat)))))) < 60
ORDER BY dist_m;

-- 5) Duplicate directory keys (must be zero)
SELECT 'detail_slug' AS key, detail_slug AS value, count(*) FROM public.locations
GROUP BY detail_slug HAVING count(*) > 1
UNION ALL
SELECT 'type|state|city|slug', type||'|'||state||'|'||city||'|'||slug, count(*)
FROM public.locations GROUP BY type, state, city, slug HAVING count(*) > 1;

-- 6) Every newly published row must carry valid coordinates and a detail slug
SELECT count(*) AS published_batch,
       count(*) FILTER (WHERE lat IS NULL OR lng IS NULL) AS missing_coords,
       count(*) FILTER (WHERE detail_slug IS NULL OR detail_slug = '') AS missing_slug,
       count(*) FILTER (WHERE category_slug IS NULL) AS missing_category
FROM public.locations WHERE geocode_source = 'batch-csv' AND is_published;
