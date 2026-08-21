-- FOUNDER-WALL-FUNDED-1 · APPLY
--
-- NOT APPLIED BY THE PR THAT INTRODUCED IT. Production application is a
-- separate, owner-authorized, post-merge gate.
--
-- Scope: public.founders ONLY.
--   * MOVE  Ricky M. Rosenbalm             steel/8 -> iron/7   (by row id)
--   * MOVE  Phil Ciarco — NPM Trucking LLC  steel/9 -> iron/8   (by row id)
--   * ADD   Wayne's Meat Market                     -> iron/5
--   * ADD   Globe Life                              -> iron/6
--   * ADD   Margaret Abbey                          -> brick/21
--
-- The three added rows carry paid_at = 2026-02-08 (owner-supplied) and NULL
-- for amount_cents, payment_provider and payment_ref.
--
-- The two moves change tier + position and NOTHING else: amount_cents,
-- payment_provider, payment_ref, paid_at, status and is_public are all left
-- exactly as they are. campaign_settings is never touched by this file.
--
-- Steel positions 8 and 9 are VACATED, not renumbered. Remaining steel
-- founders keep positions 1-7, 10, 11, so every surviving founder's stored
-- position — and therefore their relative order — is untouched. Gaps are fine;
-- only uniqueness within a tier matters, and that is asserted below.
--
-- ============================================================================
-- paid_at — OWNER-SUPPLIED, NOT INVENTED
-- ============================================================================
-- public.founders.paid_at is `timestamptz NOT NULL DEFAULT now()`. Every row
-- MUST carry a payment timestamp; there is no way to insert a founder without
-- one. Rather than let the default stamp the three new rows with whatever
-- moment APPLY happens to run, the value is supplied explicitly.
--
-- The owner confirmed on 2026-08-21: all three paid on 2026-02-08.
--
-- The placeholder guard below is kept deliberately. If this value is ever
-- blanked or reset while editing, the script aborts before writing rather
-- than falling back to now().
-- ============================================================================
\set new_rows_paid_at '2026-02-08'

BEGIN;

DO $$
DECLARE
  v_ricky   CONSTANT uuid := '4086e3dd-b14f-44a5-aae4-57b77434993a';
  v_phil    CONSTANT uuid := '84af1472-7efd-4dba-a104-80e24bb76a4c';
  v_paid    text := :'new_rows_paid_at';
  v_paid_ts timestamptz;
  v_n       int;
BEGIN
  ---------------------------------------------------------------- owner gate
  IF v_paid IS NULL OR v_paid = 'OWNER_MUST_SET_THIS' THEN
    RAISE EXCEPTION
      'paid_at not supplied. public.founders.paid_at is NOT NULL and this script will not invent a contribution date. Set :new_rows_paid_at at the top of APPLY.sql to the date the owner wants recorded.';
  END IF;
  v_paid_ts := v_paid::timestamptz;

  ------------------------------------------- pre-state must match PRECHECK
  SELECT count(*) INTO v_n FROM public.founders;
  IF v_n <> 51 THEN
    RAISE EXCEPTION 'founder total is %, expected the reviewed 51', v_n;
  END IF;

  PERFORM 1 FROM public.founders
   WHERE id = v_ricky AND display_name = 'Ricky M. Rosenbalm'
     AND tier = 'steel' AND position = 8;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ricky M. Rosenbalm is not the reviewed steel/8 row (id %)', v_ricky;
  END IF;

  PERFORM 1 FROM public.founders
   WHERE id = v_phil AND display_name = 'Phil Ciarco — NPM Trucking LLC'
     AND tier = 'steel' AND position = 9;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Phil Ciarco is not the reviewed steel/9 row (id %)', v_phil;
  END IF;

  SELECT count(*) INTO v_n FROM public.founders WHERE display_name = 'Ricky M. Rosenbalm';
  IF v_n <> 1 THEN RAISE EXCEPTION 'expected exactly 1 Ricky M. Rosenbalm, found %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.founders WHERE display_name = 'Phil Ciarco — NPM Trucking LLC';
  IF v_n <> 1 THEN RAISE EXCEPTION 'expected exactly 1 Phil Ciarco, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.founders
   WHERE display_name IN ('Wayne''s Meat Market', 'Globe Life', 'Margaret Abbey');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'one of the three new names already exists (% found) - stop and re-check', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.founders WHERE tier = 'iron' AND position IN (5,6,7,8);
  IF v_n <> 0 THEN RAISE EXCEPTION 'iron positions 5-8 are not free (% occupied)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.founders WHERE tier = 'brick' AND position = 21;
  IF v_n <> 0 THEN RAISE EXCEPTION 'brick position 21 is not free'; END IF;

  ------------------------------------------------------------------ 1. MOVES
  -- tier + position ONLY. No financial or payment column appears here.
  UPDATE public.founders SET tier = 'iron', position = 7, updated_at = now() WHERE id = v_ricky;
  UPDATE public.founders SET tier = 'iron', position = 8, updated_at = now() WHERE id = v_phil;

  ------------------------------------------------------------------- 2. ADDS
  -- amount_cents / payment_provider / payment_ref stay NULL on purpose: these
  -- are owner-directed wall placements, not recorded payments. They are
  -- is_public + 'approved' solely because the owner explicitly asked for them
  -- to appear on the wall.
  INSERT INTO public.founders
    (display_name, business_name, business_url, tier, position, status, is_public,
     amount_cents, message, logo_url, payment_provider, payment_ref, paid_at)
  VALUES
    ('Wayne''s Meat Market', NULL, NULL, 'iron',  5,  'approved', true,
     NULL, NULL, NULL, NULL, NULL, v_paid_ts),
    ('Globe Life',           NULL, NULL, 'iron',  6,  'approved', true,
     NULL, NULL, NULL, NULL, NULL, v_paid_ts),
    ('Margaret Abbey',       NULL, NULL, 'brick', 21, 'approved', true,
     NULL, NULL, NULL, NULL, NULL, v_paid_ts);

  ----------------------------------------------------------------- 3. VERIFY
  SELECT count(*) INTO v_n FROM public.founders;
  IF v_n <> 54 THEN RAISE EXCEPTION 'post-state total is %, expected 54', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.founders WHERE tier = 'iron';
  IF v_n <> 8 THEN RAISE EXCEPTION 'iron is %, expected 8', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.founders WHERE tier = 'steel';
  IF v_n <> 9 THEN RAISE EXCEPTION 'steel is %, expected 9', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.founders WHERE tier = 'brick';
  IF v_n <> 21 THEN RAISE EXCEPTION 'brick is %, expected 21', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.founders WHERE tier = 'founder_shirt';
  IF v_n <> 16 THEN RAISE EXCEPTION 'founder_shirt is %, expected 16', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.founders WHERE tier = 'steel' AND position IN (8,9);
  IF v_n <> 0 THEN RAISE EXCEPTION 'steel positions 8/9 still occupied (%)', v_n; END IF;

  SELECT count(*) INTO v_n FROM (
    SELECT display_name FROM public.founders
     WHERE display_name IN
       ('Ricky M. Rosenbalm','Phil Ciarco — NPM Trucking LLC',
        'Wayne''s Meat Market','Globe Life','Margaret Abbey')
     GROUP BY display_name HAVING count(*) <> 1
  ) d;
  IF v_n <> 0 THEN RAISE EXCEPTION 'a target name is not present exactly once'; END IF;

  SELECT count(*) INTO v_n FROM (
    SELECT tier, position FROM public.founders
     GROUP BY tier, position HAVING count(*) > 1
  ) d;
  IF v_n <> 0 THEN RAISE EXCEPTION 'duplicate tier/position pairs: %', v_n; END IF;

  -- The moved rows kept every financial + payment field.
  PERFORM 1 FROM public.founders
   WHERE id = v_ricky AND tier = 'iron' AND position = 7
     AND amount_cents = 50000
     AND paid_at = '2026-07-13 02:28:10.532489+00'::timestamptz
     AND payment_provider IS NULL AND payment_ref IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ricky financial/payment fields changed'; END IF;

  PERFORM 1 FROM public.founders
   WHERE id = v_phil AND tier = 'iron' AND position = 8
     AND amount_cents = 50000
     AND paid_at = '2026-08-02 00:26:31.442987+00'::timestamptz
     AND payment_provider IS NULL AND payment_ref IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Phil financial/payment fields changed'; END IF;

  -- The three new rows carry no invented money.
  SELECT count(*) INTO v_n FROM public.founders
   WHERE display_name IN ('Wayne''s Meat Market','Globe Life','Margaret Abbey')
     AND (amount_cents IS NOT NULL OR payment_provider IS NOT NULL OR payment_ref IS NOT NULL);
  IF v_n <> 0 THEN RAISE EXCEPTION 'a new row carries invented payment data'; END IF;

  -- ...and that they carry the owner-supplied date, not now().
  SELECT count(*) INTO v_n FROM public.founders
   WHERE display_name IN ('Wayne''s Meat Market','Globe Life','Margaret Abbey')
     AND paid_at = v_paid_ts;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'expected 3 new rows stamped %, found %', v_paid_ts, v_n;
  END IF;

  RAISE NOTICE 'FOUNDER-WALL-FUNDED-1 applied: 54 founders (iron 8, steel 9, brick 21, shirt 16)';
END $$;

COMMIT;
