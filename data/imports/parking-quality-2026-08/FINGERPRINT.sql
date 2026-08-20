-- PARKING-QUALITY-1 — read-only inventory fingerprint.
--
-- SELECT only. Running this file cannot modify a row. It reproduces the
-- exact set the audit classified, so a reviewer can confirm the package
-- describes today's database and not a stale snapshot.
--
-- Expected at rule version 1, against main 82bcbcfe:
--   row_count            96
--   id_fingerprint       d6b4b07201ec7b595269eb2df6b3e20e33eef18373875caeab5bc1952e590d42
--   published_parking    76

-- 1. The exact inventory under audit.
SELECT count(*) AS row_count
FROM public.locations
WHERE category_slug = 'parking' AND deleted_at IS NULL AND is_published = false;

-- 2. Fingerprint: sha256 over the newline-joined, ascending id list.
SELECT encode(digest(string_agg(id::text, E'\n' ORDER BY id::text), 'sha256'), 'hex')
         AS id_fingerprint
FROM public.locations
WHERE category_slug = 'parking' AND deleted_at IS NULL AND is_published = false;

-- 3. Published parking baseline (the context the duplicate scan runs against).
SELECT count(*) AS published_parking
FROM public.locations
WHERE category_slug = 'parking' AND deleted_at IS NULL AND is_published = true;

-- 4. Provenance split — why 91 rows cannot be coordinate-verified today.
SELECT coalesce(source, '(null)') AS source,
       count(*)                                                   AS rows,
       count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS with_coordinates,
       count(*) FILTER (WHERE geocode_source IS NOT NULL)          AS with_geocode_provenance,
       count(*) FILTER (WHERE manually_verified_at IS NOT NULL)    AS manually_verified
FROM public.locations
WHERE category_slug = 'parking' AND deleted_at IS NULL AND is_published = false
GROUP BY source
ORDER BY rows DESC;

-- 5. Overnight evidence columns across BOTH pools (expected: zero sources).
SELECT is_published,
       count(*)                                                        AS rows,
       count(*) FILTER (WHERE overnight_status = 'confirmed')          AS confirmed,
       count(*) FILTER (WHERE overnight_status = 'prohibited')         AS prohibited,
       count(*) FILTER (WHERE overnight_status_source IS NOT NULL)     AS with_source,
       count(*) FILTER (WHERE overnight_parking IS TRUE)               AS legacy_boolean_true
FROM public.locations
WHERE category_slug = 'parking' AND deleted_at IS NULL
GROUP BY is_published;
