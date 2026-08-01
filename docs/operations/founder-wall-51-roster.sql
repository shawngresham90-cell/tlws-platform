-- =====================================================================
-- FOUNDER WALL — approved 51-entry roster reconciliation.
--
-- NOT EXECUTED. NOT RUN BY ANY MIGRATION. NOT RUN BY ANYTHING IN THIS REPO.
--
-- Committed for review before it touches production, and deliberately kept
-- OUT of migration 048: a schema change and a data change must be separately
-- reviewable and separately revertible. 048 widens one constraint; this file
-- moves people's names on a public wall.
--
-- PREREQUISITE: migration 048 must be applied first, or every founder_shirt
-- insert below fails the tier CHECK constraint.
--
-- Owner-approved 2026-08-01. Final totals:
--   Iron          4 x 100000 =   400,000
--   Steel        11 x  50000 =   550,000
--   Brick        20 x  10000 =   200,000
--   Founder/Shirt 16 x   3500 =    56,000
--   -------------------------------------------
--   raised                    = 1,206,000  ($12,060)
--   goal                      = 1,155,000  ($11,550)
--   remaining                 =         0  (clamped by remainingCents)
--   over goal                 =    51,000  ($510)
--   public wall entries       =        51
--
-- INTENTIONAL DUPLICATES — DO NOT COLLAPSE:
--   * Jose Cotto holds one Steel spot AND one Brick spot (two rows).
--   * Barry Van Hammee Jr holds TWO Founder/Shirt spots (two rows).
--
-- PRIVACY: amount_cents is written but NEVER read by the public path.
-- src/lib/community/founders.ts does not select it. No payment_provider or
-- payment_ref is written anywhere below — zero of the 31 existing rows carry
-- one, and none is invented here.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Guard 1: the schema must already admit founder_shirt (migration 048).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    INSERT INTO founders (display_name, tier, is_public, status)
    VALUES ('__roster_probe__', 'founder_shirt', false, 'hidden');
    DELETE FROM founders WHERE display_name = '__roster_probe__';
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Migration 048 has not been applied — founder_shirt is not a valid tier yet.';
  END;
END $$;

-- ---------------------------------------------------------------------
-- Guard 2: the starting state must be the audited one.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int; g bigint; r bigint;
BEGIN
  SELECT count(*) INTO n FROM founders;
  IF n <> 31 THEN RAISE EXCEPTION 'founders count is %, expected 31', n; END IF;

  SELECT goal_cents, raised_cents_override INTO g, r FROM campaign_settings WHERE id = true;
  IF g IS DISTINCT FROM 1155000 THEN RAISE EXCEPTION 'goal_cents is %, expected 1155000', g; END IF;
  IF r IS DISTINCT FROM 1130500 THEN RAISE EXCEPTION 'raised override is %, expected 1130500', r; END IF;

  -- every name we intend to UPDATE must exist exactly once
  IF (SELECT count(*) FROM founders WHERE display_name = 'Davis Claudeton')  <> 1
  OR (SELECT count(*) FROM founders WHERE display_name = 'Shell Faroods')    <> 1
  OR (SELECT count(*) FROM founders WHERE display_name = 'RUSH')             <> 1
  OR (SELECT count(*) FROM founders WHERE display_name = 'Idle Demon')       <> 1 THEN
    RAISE EXCEPTION 'a row targeted for correction is missing or ambiguous';
  END IF;

  -- and every name we intend to INSERT must NOT exist
  IF EXISTS (
    SELECT 1 FROM founders WHERE display_name IN (
      'Rosedale Transport','Phil Ciarco — NPM Trucking LLC','Keith Cambell','One Busted Trucker',
      'James R. Shaw','Ernest Murry','Stacey Beavers','Chad Huckelby','Bear & Bug Logistics',
      'Kyle Koerner','Deirdre Monice Sanders','Edward Colon','Zac Elrod','Matt Allgood',
      'Barry Van Hammee Jr','Jesus Chapa','Gunny','Luxury Autos','Cameron Barnes'
    )
  ) THEN
    RAISE EXCEPTION 'a roster entry marked "missing" already exists — re-audit before running';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Name corrections (owner-approved 2026-08-01).
--    Row IDs are PRESERVED — these are UPDATEs, never delete-and-reinsert.
-- ---------------------------------------------------------------------
UPDATE founders SET display_name = 'Shell Fardods',  updated_at = now()
 WHERE display_name = 'Shell Faroods';

UPDATE founders SET display_name = 'Rush Enterprises', updated_at = now()
 WHERE display_name = 'RUSH';

UPDATE founders SET display_name = 'Idle Demon Inc',   updated_at = now()
 WHERE display_name = 'Idle Demon';

-- ---------------------------------------------------------------------
-- 2. Private contribution amounts, per approved tier rate.
--    Davis Claudeton moves 105000 -> 100000: the owner set the final roster
--    at a flat $1,000 per Iron spot, which is what makes the campaign
--    arithmetic land on exactly $12,060.
-- ---------------------------------------------------------------------
UPDATE founders SET amount_cents = 100000, updated_at = now() WHERE tier = 'iron';
UPDATE founders SET amount_cents =  50000, updated_at = now() WHERE tier = 'steel';
UPDATE founders SET amount_cents =  10000, updated_at = now() WHERE tier = 'brick';

-- ---------------------------------------------------------------------
-- 3. Missing roster entries.
--    payment_provider and payment_ref stay NULL throughout — no payment
--    transaction exists for these and none is invented.
-- ---------------------------------------------------------------------

-- Iron (position 3 in roster order; Davis moves to 4 in step 4)
INSERT INTO founders (display_name, tier, amount_cents, is_public, status, position, paid_at)
VALUES ('Rosedale Transport', 'iron', 100000, true, 'approved', 3, now());

-- Steel
INSERT INTO founders (display_name, tier, amount_cents, is_public, status, position, paid_at)
VALUES ('Phil Ciarco — NPM Trucking LLC', 'steel', 50000, true, 'approved', 9, now());

-- Brick
INSERT INTO founders (display_name, tier, amount_cents, is_public, status, position, paid_at)
VALUES
  ('Keith Cambell',      'brick', 10000, true, 'approved', 19, now()),
  ('One Busted Trucker', 'brick', 10000, true, 'approved', 20, now());

-- Founder / Shirt — 16 spots at $35.
-- Barry Van Hammee Jr is listed TWICE on purpose (positions 11 and 12); he
-- holds two spots. Do not de-duplicate.
INSERT INTO founders (display_name, tier, amount_cents, is_public, status, position, paid_at)
VALUES
  ('James R. Shaw',           'founder_shirt', 3500, true, 'approved',  1, now()),
  ('Ernest Murry',            'founder_shirt', 3500, true, 'approved',  2, now()),
  ('Stacey Beavers',          'founder_shirt', 3500, true, 'approved',  3, now()),
  ('Chad Huckelby',           'founder_shirt', 3500, true, 'approved',  4, now()),
  ('Bear & Bug Logistics',    'founder_shirt', 3500, true, 'approved',  5, now()),
  ('Kyle Koerner',            'founder_shirt', 3500, true, 'approved',  6, now()),
  ('Deirdre Monice Sanders',  'founder_shirt', 3500, true, 'approved',  7, now()),
  ('Edward Colon',            'founder_shirt', 3500, true, 'approved',  8, now()),
  ('Zac Elrod',               'founder_shirt', 3500, true, 'approved',  9, now()),
  ('Matt Allgood',            'founder_shirt', 3500, true, 'approved', 10, now()),
  ('Barry Van Hammee Jr',     'founder_shirt', 3500, true, 'approved', 11, now()),
  ('Barry Van Hammee Jr',     'founder_shirt', 3500, true, 'approved', 12, now()),
  ('Jesus Chapa',             'founder_shirt', 3500, true, 'approved', 13, now()),
  ('Gunny',                   'founder_shirt', 3500, true, 'approved', 14, now()),
  ('Luxury Autos',            'founder_shirt', 3500, true, 'approved', 15, now()),
  ('Cameron Barnes',          'founder_shirt', 3500, true, 'approved', 16, now());

-- ---------------------------------------------------------------------
-- 4. Public wall order — positions match the approved roster within each
--    tier. Only founder rows are reordered; nothing outside this table.
-- ---------------------------------------------------------------------
UPDATE founders SET position = v.pos, updated_at = now()
  FROM (VALUES
    ('David Gresham', 'iron', 1), ('Thomas Fields', 'iron', 2), ('Davis Claudeton', 'iron', 4),

    ('Gary Ford','steel',1), ('Jose Cotto','steel',2), ('Greg Walker','steel',3),
    ('Mario Capston','steel',4), ('Jon Blankenship','steel',5), ('Rush Enterprises','steel',6),
    ('Idle Demon Inc','steel',7), ('Ricky M. Rosenbalm','steel',8),
    ('Lauren Gresham','steel',10), ('Frederick C. Knapp','steel',11),

    ('Sam Tusk','brick',1), ('Chris Nalley','brick',2), ('Terry Hostetler','brick',3),
    ('Billy Joe Poole','brick',4), ('J.A. Gresham','brick',5), ('R.A. Harper','brick',6),
    ('Steve Snyder','brick',7), ('Jose Cotto','brick',8), ('Sean Conway','brick',9),
    ('David Chasteen','brick',10), ('Clint E. Ingram','brick',11), ('Bryce Jennex','brick',12),
    ('Will Bethstern','brick',13), ('Shell Fardods','brick',14), ('Phil Tuts','brick',15),
    ('Joe Wise','brick',16), ('Joel Jenkins','brick',17), ('Daniel Quijada','brick',18)
  ) AS v(name, tier, pos)
 WHERE founders.display_name = v.name
   AND founders.tier = v.tier;

-- ---------------------------------------------------------------------
-- 5. Campaign total. goal_cents is NOT touched.
-- ---------------------------------------------------------------------
UPDATE campaign_settings
   SET raised_cents_override = 1206000, updated_at = now()
 WHERE id = true
   AND goal_cents = 1155000
   AND raised_cents_override = 1130500;

-- ---------------------------------------------------------------------
-- 6. Verify EVERYTHING before committing. Any mismatch aborts the lot.
-- ---------------------------------------------------------------------
DO $$
DECLARE n int; rem bigint; raised bigint;
BEGIN
  IF (SELECT count(*) FROM founders) <> 51 THEN
    RAISE EXCEPTION 'founders total is %, expected 51', (SELECT count(*) FROM founders); END IF;
  IF (SELECT count(*) FROM founders WHERE is_public) <> 51 THEN
    RAISE EXCEPTION 'public founders is not 51'; END IF;

  IF (SELECT count(*) FROM founders WHERE tier='iron')          <> 4  THEN RAISE EXCEPTION 'iron <> 4';  END IF;
  IF (SELECT count(*) FROM founders WHERE tier='steel')         <> 11 THEN RAISE EXCEPTION 'steel <> 11'; END IF;
  IF (SELECT count(*) FROM founders WHERE tier='brick')         <> 20 THEN RAISE EXCEPTION 'brick <> 20'; END IF;
  IF (SELECT count(*) FROM founders WHERE tier='founder_shirt') <> 16 THEN RAISE EXCEPTION 'shirt <> 16'; END IF;

  -- intentional duplicates must SURVIVE
  IF (SELECT count(*) FROM founders WHERE display_name='Jose Cotto') <> 2 THEN
    RAISE EXCEPTION 'Jose Cotto must hold exactly 2 spots (steel + brick)'; END IF;
  IF (SELECT count(*) FROM founders WHERE display_name='Barry Van Hammee Jr') <> 2 THEN
    RAISE EXCEPTION 'Barry Van Hammee Jr must hold exactly 2 shirt spots'; END IF;

  -- private subtotals
  IF (SELECT sum(amount_cents) FROM founders WHERE tier='iron')          <> 400000 THEN RAISE EXCEPTION 'iron subtotal'; END IF;
  IF (SELECT sum(amount_cents) FROM founders WHERE tier='steel')         <> 550000 THEN RAISE EXCEPTION 'steel subtotal'; END IF;
  IF (SELECT sum(amount_cents) FROM founders WHERE tier='brick')         <> 200000 THEN RAISE EXCEPTION 'brick subtotal'; END IF;
  IF (SELECT sum(amount_cents) FROM founders WHERE tier='founder_shirt') <>  56000 THEN RAISE EXCEPTION 'shirt subtotal'; END IF;
  IF (SELECT sum(amount_cents) FROM founders) <> 1206000 THEN RAISE EXCEPTION 'roster sum <> 1206000'; END IF;

  -- campaign
  SELECT raised_cents_override INTO raised FROM campaign_settings WHERE id = true;
  IF raised <> 1206000 THEN RAISE EXCEPTION 'raised override is %, expected 1206000', raised; END IF;
  SELECT remaining_cents INTO rem FROM campaign_progress;
  IF rem <> 0 THEN RAISE EXCEPTION 'remaining is %, expected 0', rem; END IF;
  IF (SELECT founder_count FROM campaign_progress) <> 51 THEN RAISE EXCEPTION 'view count <> 51'; END IF;

  -- no fabricated payments, ever
  SELECT count(*) INTO n FROM founders WHERE payment_provider IS NOT NULL OR payment_ref IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION '% payment reference(s) present — none may be fabricated', n; END IF;
END $$;

COMMIT;


-- =====================================================================
-- ROLLBACK — restores the pre-reconciliation state (31 founders, $11,305).
-- Deletes ONLY the 20 rows this package inserted; the 31 pre-existing rows
-- are restored by value, never removed.
-- =====================================================================
-- BEGIN;
--   DELETE FROM founders WHERE tier = 'founder_shirt';
--   DELETE FROM founders WHERE display_name IN
--     ('Rosedale Transport','Phil Ciarco — NPM Trucking LLC','Keith Cambell','One Busted Trucker');
--   UPDATE founders SET display_name = 'Shell Faroods' WHERE display_name = 'Shell Fardods';
--   UPDATE founders SET display_name = 'RUSH'          WHERE display_name = 'Rush Enterprises';
--   UPDATE founders SET display_name = 'Idle Demon'    WHERE display_name = 'Idle Demon Inc';
--   UPDATE founders SET amount_cents = 105000 WHERE display_name = 'Davis Claudeton';
--   -- NOTE: the 25 rows whose amount_cents was NULL before this package are
--   -- NOT restored to NULL automatically — capture their ids pre-run if a
--   -- byte-exact revert is required.
--   UPDATE campaign_settings
--      SET raised_cents_override = 1130500, updated_at = now()
--    WHERE id = true;
--   -- expect: 31 founders, remaining 24500 ($245)
-- COMMIT;
