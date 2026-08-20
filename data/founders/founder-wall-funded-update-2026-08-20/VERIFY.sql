-- FOUNDER-WALL-FUNDED-1 · VERIFY (READ-ONLY)
-- Run AFTER APPLY.sql. Every row of section 1 must read PASS.

\echo '--- 1. assertions ---'
SELECT 'total = 54'        AS check,
       CASE WHEN count(*) = 54 THEN 'PASS' ELSE 'FAIL: ' || count(*) END AS result
FROM public.founders
UNION ALL SELECT 'iron = 8',
       CASE WHEN count(*) = 8  THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM public.founders WHERE tier = 'iron'
UNION ALL SELECT 'steel = 9',
       CASE WHEN count(*) = 9  THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM public.founders WHERE tier = 'steel'
UNION ALL SELECT 'brick = 21',
       CASE WHEN count(*) = 21 THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM public.founders WHERE tier = 'brick'
UNION ALL SELECT 'founder_shirt = 16 (untouched)',
       CASE WHEN count(*) = 16 THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM public.founders WHERE tier = 'founder_shirt'
UNION ALL SELECT 'steel 8/9 vacated',
       CASE WHEN count(*) = 0  THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM public.founders WHERE tier = 'steel' AND position IN (8,9)
UNION ALL SELECT 'no duplicate tier/position',
       CASE WHEN count(*) = 0  THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM (SELECT tier, position FROM public.founders
       GROUP BY tier, position HAVING count(*) > 1) d
UNION ALL SELECT 'each target name appears exactly once',
       CASE WHEN count(*) = 0  THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM (SELECT display_name FROM public.founders
       WHERE display_name IN ('Ricky M. Rosenbalm','Phil Ciarco — NPM Trucking LLC',
                              'Wayne''s Meat Market','Globe Life','Margaret Abbey')
       GROUP BY display_name HAVING count(*) <> 1) d
UNION ALL SELECT 'new rows carry no invented payment data',
       CASE WHEN count(*) = 0  THEN 'PASS' ELSE 'FAIL: ' || count(*) END
FROM public.founders
 WHERE display_name IN ('Wayne''s Meat Market','Globe Life','Margaret Abbey')
   AND (amount_cents IS NOT NULL OR payment_provider IS NOT NULL OR payment_ref IS NOT NULL)
UNION ALL SELECT 'Ricky kept amount + paid_at',
       CASE WHEN count(*) = 1  THEN 'PASS' ELSE 'FAIL' END
FROM public.founders
 WHERE id = '4086e3dd-b14f-44a5-aae4-57b77434993a'
   AND tier = 'iron' AND position = 7 AND amount_cents = 50000
   AND paid_at = '2026-07-13 02:28:10.532489+00'::timestamptz
UNION ALL SELECT 'Phil kept amount + paid_at',
       CASE WHEN count(*) = 1  THEN 'PASS' ELSE 'FAIL' END
FROM public.founders
 WHERE id = '84af1472-7efd-4dba-a104-80e24bb76a4c'
   AND tier = 'iron' AND position = 8 AND amount_cents = 50000
   AND paid_at = '2026-08-02 00:26:31.442987+00'::timestamptz;

\echo '--- 2. the iron course, in wall order ---'
SELECT position, display_name, status, is_public,
       amount_cents, payment_provider, payment_ref
FROM public.founders WHERE tier = 'iron' ORDER BY position;

\echo '--- 3. brick tail ---'
SELECT position, display_name FROM public.founders
 WHERE tier = 'brick' AND position >= 19 ORDER BY position;

\echo '--- 4. campaign_settings AFTER (must equal the PRECHECK values) ---'
SELECT id, goal_cents, raised_cents_override, updated_at FROM public.campaign_settings;
