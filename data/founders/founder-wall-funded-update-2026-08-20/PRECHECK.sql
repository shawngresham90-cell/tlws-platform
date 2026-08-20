-- FOUNDER-WALL-FUNDED-1 · PRECHECK (READ-ONLY)
--
-- Run this FIRST, against production, and compare the output to
-- manifest.json -> preflight. APPLY.sql re-asserts every one of these
-- conditions inside its transaction and aborts if any has drifted, so a stale
-- precheck can never turn into a bad write.
--
-- This file performs NO writes. It is safe to run at any time.

\echo '--- 1. tier counts + position ranges ---'
SELECT tier,
       count(*)                                  AS n,
       min(position)                             AS min_pos,
       max(position)                             AS max_pos,
       count(*) FILTER (WHERE position IS NULL)  AS null_positions
FROM public.founders
GROUP BY tier
ORDER BY tier;

\echo '--- 2. founder total ---'
SELECT count(*) AS total_founders FROM public.founders;

\echo '--- 3. the two rows to MOVE (must be exactly one each, both steel) ---'
SELECT id, display_name, tier, position, status, is_public,
       amount_cents, payment_provider, payment_ref, paid_at
FROM public.founders
WHERE display_name IN ('Ricky M. Rosenbalm', 'Phil Ciarco — NPM Trucking LLC')
ORDER BY display_name;

\echo '--- 4. the three names to ADD (must all be 0) ---'
SELECT 'Wayne''s Meat Market' AS name,
       count(*) AS existing
FROM public.founders WHERE display_name = 'Wayne''s Meat Market'
UNION ALL
SELECT 'Globe Life', count(*) FROM public.founders WHERE display_name = 'Globe Life'
UNION ALL
SELECT 'Margaret Abbey', count(*) FROM public.founders WHERE display_name = 'Margaret Abbey';

\echo '--- 5. loose spelling sweep (catches near-duplicates the exact match misses) ---'
SELECT id, display_name, tier, position
FROM public.founders
WHERE display_name ILIKE '%rosenbalm%' OR display_name ILIKE '%ciarco%'
   OR display_name ILIKE '%wayne%'     OR business_name ILIKE '%wayne%'
   OR display_name ILIKE '%globe%'     OR business_name ILIKE '%globe%'
   OR display_name ILIKE '%abbey%'
ORDER BY tier, position;

\echo '--- 6. duplicate positions within a tier (must return zero rows) ---'
SELECT tier, position, count(*)
FROM public.founders
GROUP BY tier, position HAVING count(*) > 1;

\echo '--- 7. campaign_settings BEFORE (APPLY must not change this) ---'
SELECT id, goal_cents, raised_cents_override, updated_at FROM public.campaign_settings;
