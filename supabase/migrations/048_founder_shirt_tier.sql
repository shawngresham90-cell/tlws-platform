-- =====================================================================
-- 048: add the `founder_shirt` tier to the founders tier CHECK constraint.
--
-- NOT YET APPLIED. Committed for review first, like every prior schema
-- change on this project.
--
-- WHY
-- The approved 51-entry Founder Wall roster includes a Founder / Shirt tier
-- ($35, 20 spots). The tier CHECK constraint created in migration 005 admits
-- only iron / steel / brick / student_sponsor / equipment_sponsor, so those
-- 16 rows cannot be inserted without this change. The two sponsor tiers are
-- deliberately NOT reused: they are uncapped tiers with different published
-- meanings, and routing shirt buyers through one would both mislabel them
-- publicly and break the "4 of 20 spots left" arithmetic (capacity null).
--
-- WHAT THIS IS NOT
-- This migration does not insert, update, delete, or reorder a single row.
-- It widens one constraint. The roster reconciliation is a separate,
-- separately-authorized operational package
-- (docs/operations/founder-wall-51-roster.sql) and is NOT run from here.
--
-- SAFETY PROPERTIES
--   - ADDITIVE: every existing tier value stays valid. The new value is a
--     superset of the old one, so re-validation of existing rows cannot fail.
--   - IDEMPOTENT: safe to run twice.
--   - NO ROW REWRITE: no UPDATE touches founders.
--   - NO CAPACITY CHANGE: tier capacities live in application config
--     (src/components/community/tiers.ts), not in the database. Iron 10,
--     Steel 25 and Brick 50 are untouched.
--   - REVERSIBLE, and the rollback FAILS SAFELY rather than destroying data.
-- =====================================================================

BEGIN;

-- Widen the tier constraint. Drop-and-recreate is the only way to alter a
-- CHECK in Postgres; `if exists` keeps it idempotent, and the recreate
-- re-validates every existing row against a strictly larger set, which
-- cannot reject anything that was already valid.
ALTER TABLE public.founders DROP CONSTRAINT IF EXISTS founders_tier_check;

ALTER TABLE public.founders
  ADD CONSTRAINT founders_tier_check
  CHECK (
    tier IN (
      'iron',
      'steel',
      'brick',
      'student_sponsor',
      'equipment_sponsor',
      'founder_shirt' -- added by 048
    )
  );

-- Prove the widened constraint admits the new value and still rejects junk,
-- without leaving a row behind. Any failure aborts the whole migration.
DO $$
BEGIN
  -- must ACCEPT the new tier
  BEGIN
    INSERT INTO public.founders (display_name, tier, is_public, status)
    VALUES ('__migration_probe__', 'founder_shirt', false, 'hidden');
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION '048 failed: founder_shirt was not accepted by the new constraint';
  END;
  DELETE FROM public.founders WHERE display_name = '__migration_probe__';

  -- must still REJECT an unknown tier
  BEGIN
    INSERT INTO public.founders (display_name, tier, is_public, status)
    VALUES ('__migration_probe_bad__', 'not_a_real_tier', false, 'hidden');
    DELETE FROM public.founders WHERE display_name = '__migration_probe_bad__';
    RAISE EXCEPTION '048 failed: an invalid tier was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL; -- expected
  END;
END $$;

COMMIT;


-- =====================================================================
-- ROLLBACK — narrows the constraint back to the pre-048 set.
--
-- IT REFUSES TO RUN IF ANY founder_shirt ROW EXISTS. Narrowing the
-- constraint with such rows present would either fail on re-validation or,
-- worse, invite someone to "fix" it by deleting real founders. Failing
-- loudly with a count is the safe behaviour: the operator must consciously
-- decide what happens to those people's recognition first.
-- =====================================================================
-- BEGIN;
--
-- DO $$
-- DECLARE n int;
-- BEGIN
--   SELECT count(*) INTO n FROM public.founders WHERE tier = 'founder_shirt';
--   IF n > 0 THEN
--     RAISE EXCEPTION
--       'Refusing to roll back 048: % founder_shirt row(s) exist. Re-tier or '
--       'remove them under owner authorization first — this rollback will not '
--       'delete founder records.', n;
--   END IF;
-- END $$;
--
-- ALTER TABLE public.founders DROP CONSTRAINT IF EXISTS founders_tier_check;
-- ALTER TABLE public.founders
--   ADD CONSTRAINT founders_tier_check
--   CHECK (tier IN ('iron','steel','brick','student_sponsor','equipment_sponsor'));
--
-- COMMIT;
