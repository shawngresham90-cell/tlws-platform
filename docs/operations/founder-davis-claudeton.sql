-- =====================================================================
-- INERT PACKAGE — NOT EXECUTED. Requires the site owner's go-ahead.
--
-- Founder recognition: Davis Claudeton, $1,050 contribution.
-- Public campaign display: "$945 left to open the school".
--
-- Nothing in this repository runs this file. It is committed so the exact
-- statements can be reviewed BEFORE they touch production, which is how
-- every prior data change on this project has been handled.
--
-- ONE DECISION IS STILL OPEN — see TIER below.
-- =====================================================================


-- ---------------------------------------------------------------------
-- WHY $1,050 AND NOT $1,000
--
-- The "remaining" number is NOT stored anywhere. The `campaign_progress`
-- view derives it:
--
--     remaining_cents = GREATEST(goal_cents - raised_cents_override, 0)
--
-- from the single `campaign_settings` row. So the only way to make the
-- public display read $945 is to move `raised_cents_override`.
--
--     goal            1,155,000  ($11,550)   unchanged
--     raised (before)    955,500  ($9,555)
--     remaining (before) 199,500  ($1,995)   <- what the site shows today
--
--     contribution       105,000  ($1,050)
--     raised (after)   1,060,500  ($10,605)
--     remaining (after)   94,500  ($945)     <- the requested number
--
-- $1,000 would have left $995 remaining, not $945. The owner confirmed the
-- contribution is $1,050 and that $945 is the intended display.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- TIER — THE ONE FIELD NOT INFERABLE FROM THE DATA
--
-- `tier` is NOT NULL and there is no amount->tier mapping to read from:
-- components/community/tiers.ts states dollar thresholds are deliberately
-- NOT hard-coded ("amounts aren't final"). The only evidence in the table
-- is two `steel` rows at $500 each. $1,050 is above that, and `iron` is the
-- top capped tier (10 spots, 2 filled), so `iron` is the default below.
--
-- CONFIRM OR CHANGE THIS ONE WORD BEFORE RUNNING. Everything else is
-- determined by the data.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT SET
--
--   payment_provider / payment_ref  -> left NULL. No payment transaction
--     exists for this contribution, and none is invented. Zero of the 27
--     existing founder rows carry a payment ref either, so this matches
--     the table's actual convention.
--
--   The contribution amount is recorded in `amount_cents` and STAYS
--     PRIVATE. lib/community/founders.ts never selects that column, so it
--     cannot reach the public wall — that privacy model is intentional and
--     is left exactly as it is. This package does not publish $1,050 next
--     to anyone's name.
--
--   No other founder row is read, updated or reordered.
-- ---------------------------------------------------------------------

BEGIN;

-- Guard 1: refuse to run twice.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM founders WHERE display_name = 'Davis Claudeton') THEN
    RAISE EXCEPTION 'Davis Claudeton already exists — package already applied';
  END IF;
END $$;

-- Guard 2: refuse to run if the campaign numbers are not what this package
-- was written against. Protects against another change landing in between.
DO $$
DECLARE g bigint; r bigint;
BEGIN
  SELECT goal_cents, raised_cents_override INTO g, r FROM campaign_settings WHERE id = true;
  IF g IS DISTINCT FROM 1155000 OR r IS DISTINCT FROM 955500 THEN
    RAISE EXCEPTION 'campaign_settings moved (goal=%, raised=%); expected 1155000/955500', g, r;
  END IF;
END $$;

-- 1. The founder record. `position` continues that tier's existing sequence.
INSERT INTO founders (
  display_name, business_name, business_url,
  tier, amount_cents, message, logo_url,
  payment_provider, payment_ref,
  is_public, status, position, paid_at
)
VALUES (
  'Davis Claudeton', NULL, NULL,
  'iron',            -- <-- TIER: confirm before running
  105000,            -- $1,050, private (never selected by the public reader)
  NULL, NULL,
  NULL, NULL,        -- no payment transaction exists; none invented
  true, 'approved',
  (SELECT COALESCE(MAX(position), 0) + 1 FROM founders WHERE tier = 'iron'),
  now()
);

-- 2. The public campaign total, so "remaining" reads $945.
UPDATE campaign_settings
   SET raised_cents_override = 1060500,
       updated_at = now()
 WHERE id = true
   AND goal_cents = 1155000
   AND raised_cents_override = 955500;

-- 3. Verify before committing. Any mismatch aborts the whole transaction.
DO $$
DECLARE fc int; rem bigint; cnt int;
BEGIN
  SELECT founder_count, remaining_cents INTO fc, rem FROM campaign_progress;
  SELECT count(*) INTO cnt FROM founders WHERE display_name = 'Davis Claudeton';

  IF cnt <> 1          THEN RAISE EXCEPTION 'expected exactly 1 Davis Claudeton row, got %', cnt; END IF;
  IF rem <> 94500      THEN RAISE EXCEPTION 'remaining_cents is % — expected 94500 ($945)', rem; END IF;
  IF fc  <> 28         THEN RAISE EXCEPTION 'founder_count is % — expected 28', fc; END IF;
  RAISE NOTICE 'OK: founder_count=%, remaining=$%', fc, rem / 100;
END $$;

COMMIT;


-- =====================================================================
-- ROLLBACK — restores the exact prior state.
-- =====================================================================
-- BEGIN;
--   DELETE FROM founders WHERE display_name = 'Davis Claudeton';
--   UPDATE campaign_settings
--      SET raised_cents_override = 955500, updated_at = now()
--    WHERE id = true;
--   -- expect: founder_count 27, remaining_cents 199500 ($1,995)
-- COMMIT;
