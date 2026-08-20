-- FOUNDER-WALL-FUNDED-1 · ROLLBACK
--
-- Reverses APPLY.sql exactly: puts Ricky and Phil back in steel at their
-- original positions and deletes the three added rows.
--
-- SAFE TO RUN ONLY IF the three added rows are still exactly as APPLY created
-- them. It deletes BY NAME AND by the "no payment data" signature, so a row
-- that has since been edited to carry real payment information is left alone
-- rather than silently destroyed.
--
-- Restores tier/position ONLY on the moved rows. Their financial and payment
-- fields were never modified, so there is nothing to restore there.

BEGIN;

DO $$
DECLARE
  v_ricky CONSTANT uuid := '4086e3dd-b14f-44a5-aae4-57b77434993a';
  v_phil  CONSTANT uuid := '84af1472-7efd-4dba-a104-80e24bb76a4c';
  v_n     int;
BEGIN
  SELECT count(*) INTO v_n FROM public.founders WHERE tier = 'steel' AND position IN (8,9);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'steel positions 8/9 are occupied — the wall moved on, roll back by hand';
  END IF;

  UPDATE public.founders SET tier = 'steel', position = 8, updated_at = now() WHERE id = v_ricky;
  UPDATE public.founders SET tier = 'steel', position = 9, updated_at = now() WHERE id = v_phil;

  DELETE FROM public.founders
   WHERE display_name IN ('Wayne''s Meat Market','Globe Life','Margaret Abbey')
     AND amount_cents IS NULL
     AND payment_provider IS NULL
     AND payment_ref IS NULL;

  SELECT count(*) INTO v_n FROM public.founders;
  IF v_n <> 51 THEN RAISE EXCEPTION 'post-rollback total is %, expected 51', v_n; END IF;

  RAISE NOTICE 'FOUNDER-WALL-FUNDED-1 rolled back: 51 founders restored';
END $$;

COMMIT;
